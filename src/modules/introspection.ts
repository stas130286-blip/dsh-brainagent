/**
 * Introspection Engine — Processing trace and confidence assessment.
 *
 * Records a full processing trace for each interaction cycle,
 * enabling explainability (/brainagent explain) and optional
 * confidence injection into the LLM prompt.
 *
 * v0.7.0: фабрика createIntrospection(workspaceDir, config?) — всё состояние
 * в замыкании инстанса; свободные функции — обёртки над активным инстансом.
 * Пустой workspaceDir = detached-режим (состояние в памяти, диск не трогается) —
 * ровно поведение модульных переменных до initIntrospection.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWrite } from "./persist.ts";
import { bus } from "./event-bus.ts";
import type {
  BrainAgentConfig,
  MetaAwareness,
  ProcessingTrace,
  SelfDialogueEntry,
  TraceStep,
} from "./types.ts";

// ── Instance type ───────────────────────────────────────────────────

export type IntrospectionInstance = {
  startTrace(input: string): void;
  addTraceStep(module: string, hook: string, output: string): void;
  completeTrace(cerebellumPassed: boolean, issues: string[], reward: number): void;
  buildConfidenceContext(): string | undefined;
  getLastTrace(): ProcessingTrace | undefined;
  getIntrospectionStats(): {
    traceCount: number;
    avgConfidence: number;
    selfDialogueCount: number;
    metaSnapshotCount: number;
  };
  reflectOnConsciousness(): MetaAwareness;
  detectConsciousnessGaps(): string[];
  askSelf(question: string): SelfDialogueEntry;
  buildMetaConsciousnessContext(): string | undefined;
  getSelfDialogue(): SelfDialogueEntry[];
  getMetaSnapshots(): MetaAwareness[];
  getRecentLowConfidenceCount(threshold?: number): number;
};

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Create an introspection instance with isolated state.
 * Empty workspaceDir = detached instance: state lives in memory,
 * disk is never touched (identical to pre-init module behavior).
 */
export function createIntrospection(
  workspaceDir: string,
  config?: BrainAgentConfig,
): IntrospectionInstance {
  // ── State (closure) ───────────────────────────────────────────────
  const storageDir = workspaceDir ? join(workspaceDir, ".brainagent", "introspection") : "";
  const traces: ProcessingTrace[] = [];
  let currentTrace: ProcessingTrace | null = null;
  let maxTraces = config?.introspection.maxTraces ?? 3;
  const injectConfidence = config?.introspection.injectConfidence ?? true;
  const selfDialogue: SelfDialogueEntry[] = [];
  const metaSnapshots: MetaAwareness[] = [];
  let maxSelfDialogue = config?.introspection.maxSelfDialogue ?? 10;
  let maxMetaSnapshots = config?.introspection.maxMetaSnapshots ?? 5;

  function loadState(): void {
    if (!storageDir) return;
    try {
      const path = join(storageDir, "traces.json");
      if (existsSync(path)) {
        const raw = JSON.parse(readFileSync(path, "utf-8"));
        // Support both legacy (plain array) and new format
        traces.length = 0;
        selfDialogue.length = 0;
        metaSnapshots.length = 0;
        if (Array.isArray(raw)) {
          traces.push(...raw);
        } else {
          if (Array.isArray(raw.traces)) traces.push(...raw.traces);
          if (Array.isArray(raw.selfDialogue)) selfDialogue.push(...raw.selfDialogue);
          if (Array.isArray(raw.metaSnapshots)) metaSnapshots.push(...raw.metaSnapshots);
        }
      }
    } catch {
      traces.length = 0;
      selfDialogue.length = 0;
      metaSnapshots.length = 0;
    }
  }

  function persistState(): void {
    if (!storageDir) return;
    try {
      atomicWrite(
        join(storageDir, "traces.json"),
        JSON.stringify({ traces, selfDialogue, metaSnapshots }, null, 2),
      );
    } catch {
      /* non-critical */
    }
  }

  // ── Core API ──────────────────────────────────────────────────────

  function startTrace(input: string): void {
    currentTrace = {
      id: `trace_${Date.now()}`,
      startedAt: Date.now(),
      completedAt: 0,
      steps: [],
      finalConfidence: 0,
      cerebellumPassed: true,
      reward: 0,
      inputSnippet: input.length > 100 ? input.slice(0, 100) + "..." : input,
    };
  }

  function addTraceStep(module: string, hook: string, output: string): void {
    if (!currentTrace) return;

    const step: TraceStep = {
      module,
      hook,
      timestamp: Date.now(),
      outputSummary: output.length > 100 ? output.slice(0, 100) + "..." : output,
    };

    currentTrace.steps.push(step);
  }

  function completeTrace(cerebellumPassed: boolean, issues: string[], reward: number): void {
    if (!currentTrace) return;

    currentTrace.completedAt = Date.now();
    currentTrace.cerebellumPassed = cerebellumPassed;
    currentTrace.reward = reward;

    // Compute confidence from multiple factors
    const factors: string[] = [];
    let confidence = 0;

    // Cerebellum validation (weight: 0.4)
    const cerebellumScore = cerebellumPassed ? 1.0 : Math.max(0, 1 - issues.length * 0.25);
    confidence += cerebellumScore * 0.4;
    factors.push(`cerebellum=${(cerebellumScore * 100).toFixed(0)}%`);

    // Step count indicates thoroughness (weight: 0.2)
    const thoroughnessScore = Math.min(1, currentTrace.steps.length / 6);
    confidence += thoroughnessScore * 0.2;
    factors.push(`thoroughness=${(thoroughnessScore * 100).toFixed(0)}%`);

    // Reward signal (weight: 0.4)
    const rewardScore = Math.max(0, Math.min(1, (reward + 1) / 2));
    confidence += rewardScore * 0.4;
    factors.push(`reward=${(rewardScore * 100).toFixed(0)}%`);

    currentTrace.finalConfidence = Math.max(0, Math.min(1, confidence));

    // Push to ring buffer
    traces.push(currentTrace);
    while (traces.length > maxTraces) {
      traces.shift();
    }

    persistState();

    bus.emitSync("introspection:trace-complete", currentTrace);
    bus.emitSync("introspection:confidence-assessed", {
      confidence: currentTrace.finalConfidence,
      factors,
    });

    currentTrace = null;
  }

  function buildConfidenceContext(): string | undefined {
    if (!injectConfidence || traces.length === 0) return undefined;

    const avgConfidence = traces.reduce((sum, t) => sum + t.finalConfidence, 0) / traces.length;

    if (avgConfidence > 0.7) return undefined; // High confidence — no need to inject

    return [
      "## Self-Assessment (Introspection)",
      avgConfidence < 0.5
        ? "Recent responses have been uncertain — be extra careful and precise."
        : "Double-check reasoning for accuracy.",
    ].join("\n");
  }

  function getLastTrace(): ProcessingTrace | undefined {
    return traces.length > 0 ? traces[traces.length - 1] : undefined;
  }

  function getIntrospectionStats() {
    const avg =
      traces.length > 0
        ? traces.reduce((sum, t) => sum + t.finalConfidence, 0) / traces.length
        : 0;
    return {
      traceCount: traces.length,
      avgConfidence: avg,
      selfDialogueCount: selfDialogue.length,
      metaSnapshotCount: metaSnapshots.length,
    };
  }

  // ── Meta-Consciousness API ────────────────────────────────────────

  function detectConsciousnessGaps(): string[] {
    const gaps: string[] = [];

    // Gap: no traces at all — no self-knowledge of processing
    if (traces.length === 0) {
      gaps.push("No processing history — cannot assess own performance");
    }

    // Gap: low average confidence — uncertain about outputs
    if (traces.length > 0) {
      const avgConf = traces.reduce((s, t) => s + t.finalConfidence, 0) / traces.length;
      if (avgConf < 0.5) {
        gaps.push(
          `Low average confidence (${(avgConf * 100).toFixed(0)}%) — uncertain about own outputs`,
        );
      }
    }

    // Gap: cerebellum failures — validation issues
    const recentFailures = traces.filter((t) => !t.cerebellumPassed).length;
    if (recentFailures > 0) {
      gaps.push(`${recentFailures} recent validation failure(s) — quality assurance gaps`);
    }

    // Gap: no self-dialogue yet — no internal reflection
    if (selfDialogue.length === 0) {
      gaps.push("No self-dialogue recorded — limited introspective depth");
    }

    // Gap: negative rewards — unresolved performance issues
    const negReward = traces.filter((t) => t.reward < 0).length;
    if (negReward > 0) {
      gaps.push(`${negReward} negative-reward interaction(s) — unresolved issues`);
    }

    return gaps;
  }

  function reflectOnConsciousness(): MetaAwareness {
    const now = Date.now();

    // Determine consciousness state from recent trace data
    let consciousnessState: MetaAwareness["consciousnessState"] = "clear";

    if (traces.length === 0) {
      consciousnessState = "diffuse";
    } else {
      const recent = traces[traces.length - 1];
      const avgConf = traces.reduce((sum, t) => sum + t.finalConfidence, 0) / traces.length;

      if (avgConf > 0.7 && recent.cerebellumPassed) {
        consciousnessState = "focused";
      } else if (avgConf < 0.4) {
        consciousnessState = "fragmented";
      } else if (recent.steps.length <= 2) {
        consciousnessState = "diffuse";
      } else {
        consciousnessState = "clear";
      }
    }

    const gaps = detectConsciousnessGaps();

    // Detect change from last snapshot
    const lastSnapshot =
      metaSnapshots.length > 0 ? metaSnapshots[metaSnapshots.length - 1] : null;
    const changeDetected = lastSnapshot
      ? lastSnapshot.consciousnessState !== consciousnessState ||
        gaps.length !== lastSnapshot.gapsDetected.length
      : true;

    const snapshot: MetaAwareness = {
      timestamp: now,
      consciousnessState,
      gapsDetected: gaps,
      changeDetected,
    };

    metaSnapshots.push(snapshot);
    if (metaSnapshots.length > maxMetaSnapshots) {
      metaSnapshots.splice(0, metaSnapshots.length - maxMetaSnapshots);
    }

    if (gaps.length > 0) {
      bus.emitSync("meta:gap-detected", { gaps });
    }

    persistState();
    return snapshot;
  }

  function askSelf(question: string): SelfDialogueEntry {
    const now = Date.now();
    const qLower = question.toLowerCase();

    // Generate heuristic answers from internal state
    let answer: string;

    if (qLower.includes("confident") || qLower.includes("confidence")) {
      const avg =
        traces.length > 0 ? traces.reduce((s, t) => s + t.finalConfidence, 0) / traces.length : 0;
      answer = `My average confidence is ${(avg * 100).toFixed(0)}%. ${
        avg > 0.7
          ? "I feel relatively sure about my recent outputs."
          : avg > 0.4
            ? "I have moderate confidence — some uncertainty remains."
            : "I am quite uncertain and should proceed carefully."
      }`;
    } else if (qLower.includes("feeling") || qLower.includes("state")) {
      const last = metaSnapshots.length > 0 ? metaSnapshots[metaSnapshots.length - 1] : null;
      answer = last
        ? `My consciousness state is "${last.consciousnessState}" with ${last.gapsDetected.length} detected gap(s).`
        : "I haven't assessed my consciousness state yet.";
    } else if (qLower.includes("improve") || qLower.includes("better")) {
      const gaps = detectConsciousnessGaps();
      answer =
        gaps.length > 0
          ? `I could improve by addressing: ${gaps.slice(0, 3).join("; ")}.`
          : "No obvious improvement areas detected right now.";
    } else if (qLower.includes("why") || qLower.includes("reason")) {
      const last = traces.length > 0 ? traces[traces.length - 1] : null;
      answer = last
        ? `My last response involved ${last.steps.length} processing steps and achieved ${(last.finalConfidence * 100).toFixed(0)}% confidence.`
        : "I have no recent processing trace to analyze.";
    } else {
      // Generic introspective response
      answer = `I currently have ${traces.length} processing trace(s), ${selfDialogue.length} dialogue entries, and ${metaSnapshots.length} meta-awareness snapshot(s).`;
    }

    const entry: SelfDialogueEntry = { timestamp: now, question, answer };

    selfDialogue.push(entry);
    if (selfDialogue.length > maxSelfDialogue) {
      selfDialogue.splice(0, selfDialogue.length - maxSelfDialogue);
    }

    persistState();

    bus.emitSync("meta:self-question", { question, answer });

    return entry;
  }

  function buildMetaConsciousnessContext(): string | undefined {
    if (metaSnapshots.length === 0 && selfDialogue.length === 0) return undefined;

    const lines = ["## Meta-Consciousness (Introspection)"];

    // Latest awareness state — translate to behavioral instruction
    if (metaSnapshots.length > 0) {
      const latest = metaSnapshots[metaSnapshots.length - 1];
      const stateMap: Record<string, string | undefined> = {
        focused: "Maintain precision",
        fragmented: "Slow down and focus",
        diffuse: "Broad awareness mode",
        clear: undefined, // normal state, no injection needed
      };
      const instruction = stateMap[latest.consciousnessState];
      if (instruction) {
        lines.push(instruction);
      }
    }

    return lines.length > 1 ? lines.join("\n") : undefined;
  }

  function getSelfDialogue(): SelfDialogueEntry[] {
    return [...selfDialogue];
  }

  function getMetaSnapshots(): MetaAwareness[] {
    return [...metaSnapshots];
  }

  function getRecentLowConfidenceCount(threshold = 0.5): number {
    return traces.filter((t) => t.finalConfidence < threshold).length;
  }

  // ── Init (disk) ───────────────────────────────────────────────────

  if (storageDir) {
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }
    // Config values are applied at closure declaration; keep max* fresh
    maxTraces = config?.introspection.maxTraces ?? maxTraces;
    maxSelfDialogue = config?.introspection.maxSelfDialogue ?? maxSelfDialogue;
    maxMetaSnapshots = config?.introspection.maxMetaSnapshots ?? maxMetaSnapshots;
    loadState();
  }

  return {
    startTrace,
    addTraceStep,
    completeTrace,
    buildConfidenceContext,
    getLastTrace,
    getIntrospectionStats,
    reflectOnConsciousness,
    detectConsciousnessGaps,
    askSelf,
    buildMetaConsciousnessContext,
    getSelfDialogue,
    getMetaSnapshots,
    getRecentLowConfidenceCount,
  };
}

// ── Active-instance wrappers (backward-compatible API) ──────────────

let active: IntrospectionInstance | null = null;

function current(): IntrospectionInstance {
  if (!active) active = createIntrospection("");
  return active;
}

export function initIntrospection(workspaceDir: string, config: BrainAgentConfig): void {
  active = createIntrospection(workspaceDir, config);
}

/** Symmetric teardown — drops the active instance (no timers/subscriptions). */
export function stopIntrospection(): void {
  active = null;
}

export function startTrace(input: string): void {
  current().startTrace(input);
}

export function addTraceStep(module: string, hook: string, output: string): void {
  current().addTraceStep(module, hook, output);
}

export function completeTrace(cerebellumPassed: boolean, issues: string[], reward: number): void {
  current().completeTrace(cerebellumPassed, issues, reward);
}

export function buildConfidenceContext(): string | undefined {
  return current().buildConfidenceContext();
}

export function getLastTrace(): ProcessingTrace | undefined {
  return current().getLastTrace();
}

export function getIntrospectionStats(): {
  traceCount: number;
  avgConfidence: number;
  selfDialogueCount: number;
  metaSnapshotCount: number;
} {
  return current().getIntrospectionStats();
}

export function reflectOnConsciousness(): MetaAwareness {
  return current().reflectOnConsciousness();
}

export function detectConsciousnessGaps(): string[] {
  return current().detectConsciousnessGaps();
}

export function askSelf(question: string): SelfDialogueEntry {
  return current().askSelf(question);
}

export function buildMetaConsciousnessContext(): string | undefined {
  return current().buildMetaConsciousnessContext();
}

export function getSelfDialogue(): SelfDialogueEntry[] {
  return current().getSelfDialogue();
}

export function getMetaSnapshots(): MetaAwareness[] {
  return current().getMetaSnapshots();
}

export function getRecentLowConfidenceCount(threshold = 0.5): number {
  return current().getRecentLowConfidenceCount(threshold);
}
