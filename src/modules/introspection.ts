/**
 * Introspection Engine — Processing trace and confidence assessment.
 *
 * Records a full processing trace for each interaction cycle,
 * enabling explainability (/brainagent explain) and optional
 * confidence injection into the LLM prompt.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bus } from "./event-bus.ts";
import type {
  BrainAgentConfig,
  MetaAwareness,
  ProcessingTrace,
  SelfDialogueEntry,
  TraceStep,
} from "./types.ts";

// ── State ───────────────────────────────────────────────────────────

let storageDir = "";
let traces: ProcessingTrace[] = [];
let currentTrace: ProcessingTrace | null = null;
let maxTraces = 3;
let injectConfidence = true;

// ── Meta-Consciousness State ─────────────────────────────────────────

let selfDialogue: SelfDialogueEntry[] = [];
let metaSnapshots: MetaAwareness[] = [];
let maxSelfDialogue = 10;
let maxMetaSnapshots = 5;

// ── Initialization ──────────────────────────────────────────────────

export function initIntrospection(workspaceDir: string, config: BrainAgentConfig): void {
  storageDir = join(workspaceDir, ".brainagent", "introspection");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  maxTraces = config.introspection.maxTraces;
  injectConfidence = config.introspection.injectConfidence;
  maxSelfDialogue = config.introspection.maxSelfDialogue;
  maxMetaSnapshots = config.introspection.maxMetaSnapshots;

  // Reset in-memory state before loading from disk
  traces = [];
  currentTrace = null;
  selfDialogue = [];
  metaSnapshots = [];

  loadState();
}

function loadState(): void {
  if (!storageDir) return;
  try {
    const path = join(storageDir, "traces.json");
    if (existsSync(path)) {
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      // Support both legacy (plain array) and new format
      if (Array.isArray(raw)) {
        traces = raw;
      } else {
        traces = Array.isArray(raw.traces) ? raw.traces : [];
        selfDialogue = Array.isArray(raw.selfDialogue) ? raw.selfDialogue : [];
        metaSnapshots = Array.isArray(raw.metaSnapshots) ? raw.metaSnapshots : [];
      }
    }
  } catch {
    traces = [];
    selfDialogue = [];
    metaSnapshots = [];
  }
}

function persistState(): void {
  if (!storageDir) return;
  try {
    writeFileSync(
      join(storageDir, "traces.json"),
      JSON.stringify({ traces, selfDialogue, metaSnapshots }, null, 2),
      "utf-8",
    );
  } catch {
    /* non-critical */
  }
}

// ── Core API ────────────────────────────────────────────────────────

/** Begin a new trace for the current interaction cycle. */
export function startTrace(input: string): void {
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

/** Add a processing step to the current trace. */
export function addTraceStep(module: string, hook: string, output: string): void {
  if (!currentTrace) return;

  const step: TraceStep = {
    module,
    hook,
    timestamp: Date.now(),
    outputSummary: output.length > 100 ? output.slice(0, 100) + "..." : output,
  };

  currentTrace.steps.push(step);
}

/**
 * Finalize the current trace with outcome data.
 * Computes confidence and moves the trace to the ring buffer.
 */
export function completeTrace(cerebellumPassed: boolean, issues: string[], reward: number): void {
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

/**
 * Build a confidence context injection for the LLM prompt.
 * Returns undefined if injection is disabled or no prior traces exist.
 */
export function buildConfidenceContext(): string | undefined {
  if (!injectConfidence || traces.length === 0) return undefined;

  const lastTrace = traces[traces.length - 1];
  const avgConfidence = traces.reduce((sum, t) => sum + t.finalConfidence, 0) / traces.length;

  if (avgConfidence > 0.7) return undefined; // High confidence — no need to inject

  return [
    "## Self-Assessment (Introspection)",
    avgConfidence < 0.5
      ? "Recent responses have been uncertain — be extra careful and precise."
      : "Double-check reasoning for accuracy.",
  ].join("\n");
}

/** Get the last completed trace for /brainagent explain. */
export function getLastTrace(): ProcessingTrace | undefined {
  return traces.length > 0 ? traces[traces.length - 1] : undefined;
}

/** Get diagnostics stats. */
export function getIntrospectionStats(): {
  traceCount: number;
  avgConfidence: number;
  selfDialogueCount: number;
  metaSnapshotCount: number;
} {
  const avg =
    traces.length > 0 ? traces.reduce((sum, t) => sum + t.finalConfidence, 0) / traces.length : 0;
  return {
    traceCount: traces.length,
    avgConfidence: avg,
    selfDialogueCount: selfDialogue.length,
    metaSnapshotCount: metaSnapshots.length,
  };
}

// ── Meta-Consciousness API ──────────────────────────────────────────

/**
 * Assess current consciousness state based on recent traces.
 * Returns a MetaAwareness snapshot with detected gaps.
 */
export function reflectOnConsciousness(): MetaAwareness {
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
  const lastSnapshot = metaSnapshots.length > 0 ? metaSnapshots[metaSnapshots.length - 1] : null;
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
    metaSnapshots = metaSnapshots.slice(-maxMetaSnapshots);
  }

  if (gaps.length > 0) {
    bus.emitSync("meta:gap-detected", { gaps });
  }

  persistState();
  return snapshot;
}

/**
 * Detect what the system doesn't know about itself — consciousness gaps.
 */
export function detectConsciousnessGaps(): string[] {
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

/**
 * Internal self-dialogue: ask and answer a question about own state.
 * The answer is generated heuristically from available trace data.
 */
export function askSelf(question: string): SelfDialogueEntry {
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
    selfDialogue = selfDialogue.slice(-maxSelfDialogue);
  }

  persistState();

  bus.emitSync("meta:self-question", { question, answer });

  return entry;
}

/**
 * Build meta-consciousness context for prompt injection.
 * Returns a summary of self-awareness or undefined if not relevant.
 */
export function buildMetaConsciousnessContext(): string | undefined {
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

/** Get copy of self-dialogue history. */
export function getSelfDialogue(): SelfDialogueEntry[] {
  return [...selfDialogue];
}

/** Get copy of meta-awareness snapshots. */
export function getMetaSnapshots(): MetaAwareness[] {
  return [...metaSnapshots];
}

/**
 * Count recent traces with confidence below the given threshold.
 * Used by the autonomy introspection→goals feedback loop.
 */
export function getRecentLowConfidenceCount(threshold = 0.5): number {
  return traces.filter((t) => t.finalConfidence < threshold).length;
}
