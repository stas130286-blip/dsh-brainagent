/**
 * Temporal Binding — Consciousness moment stream with causal links.
 *
 * The human brain binds disparate perceptions into a unified "moment"
 * of consciousness. This module creates a stream of ConsciousnessMoment
 * objects, each linked causally to the previous, giving the agent a
 * sense of temporal continuity ("I was doing X, now I'm doing Y").
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bus } from "./event-bus.ts";
import type {
  BrainAgentConfig,
  ConsciousnessMoment,
  EmotionLabel,
  MessageDomain,
} from "./types.ts";

// ── State ───────────────────────────────────────────────────────────

let storageDir = "";
let moments: ConsciousnessMoment[] = [];
let maxMoments = 30;
let idCounter = 0;

// ── Initialization ──────────────────────────────────────────────────

export function initTemporalBinding(workspaceDir: string, config: BrainAgentConfig): void {
  storageDir = join(workspaceDir, ".brainagent", "temporal-binding");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  maxMoments = config.temporalBinding.maxMoments;

  // Reset in-memory state before loading from disk
  moments = [];
  idCounter = 0;

  loadState();
}

function loadState(): void {
  if (!storageDir) return;
  try {
    const path = join(storageDir, "state.json");
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, "utf-8"));
      moments = Array.isArray(data) ? data : [];
    }
  } catch {
    moments = [];
  }
}

function persistState(): void {
  if (!storageDir) return;
  try {
    writeFileSync(join(storageDir, "state.json"), JSON.stringify(moments, null, 2), "utf-8");
  } catch {
    /* non-critical */
  }
}

// ── Core API ────────────────────────────────────────────────────────

/**
 * Create a new consciousness moment binding all current perceptions.
 * Automatically links to the previous moment for causal continuity.
 */
export function createMoment(
  input: string,
  thoughts: string[],
  emotion: EmotionLabel,
  emotionIntensity: number,
  activeMemoryIds: string[],
  intentions: string[],
  confidence: number,
  domain: MessageDomain,
): ConsciousnessMoment {
  const now = Date.now();
  const previousMoment = moments.length > 0 ? moments[moments.length - 1] : null;

  const moment: ConsciousnessMoment = {
    id: `moment_${now}_${++idCounter}`,
    timestamp: now,
    input: input.length > 150 ? input.slice(0, 150) + "..." : input,
    thoughts: thoughts.slice(0, 5),
    emotions: { label: emotion, intensity: emotionIntensity },
    activeMemoryIds: activeMemoryIds.slice(0, 10),
    intentions: intentions.slice(0, 3),
    confidence,
    causalLinkId: previousMoment?.id ?? null,
    domain,
  };

  moments.push(moment);

  // Ring buffer enforcement
  if (moments.length > maxMoments) {
    moments = moments.slice(-maxMoments);
  }

  persistState();

  bus.emitSync("temporal:moment-created", {
    momentId: moment.id,
    causalLinkId: moment.causalLinkId,
  });

  bus.emitSync("temporal:stream-updated", {
    streamLength: moments.length,
  });

  return moment;
}

/**
 * Build a temporal continuity context for prompt injection.
 * Summarizes the recent stream of consciousness moments.
 */
export function buildTemporalContext(n = 3): string | undefined {
  if (moments.length === 0) return undefined;

  const recent = moments.slice(-n);
  const lines = ["## Temporal Stream (Consciousness Continuity)"];

  for (const m of recent) {
    const emotionTag =
      m.emotions.label !== "neutral"
        ? ` [${m.emotions.label} ${(m.emotions.intensity * 100).toFixed(0)}%]`
        : "";
    const thoughtSummary = m.thoughts.length > 0 ? ` thinking: "${m.thoughts[0]}"` : "";
    lines.push(
      `- [${m.domain}]${emotionTag}${thoughtSummary} (conf: ${(m.confidence * 100).toFixed(0)}%)`,
    );
  }

  // Show causal chain
  if (recent.length > 1) {
    const chain = recent.map((m) => m.domain).join(" -> ");
    lines.push(`Flow: ${chain}`);
  }

  return lines.join("\n");
}

/** Get the most recent consciousness moment. */
export function getCurrentMoment(): ConsciousnessMoment | undefined {
  return moments.length > 0 ? moments[moments.length - 1] : undefined;
}

/** Get the full stream of consciousness moments. */
export function getMomentStream(): ConsciousnessMoment[] {
  return [...moments];
}

/** Get diagnostics stats. */
export function getTemporalBindingStats(): {
  momentCount: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
  dominantDomain: string | null;
} {
  if (moments.length === 0) {
    return { momentCount: 0, oldestTimestamp: null, newestTimestamp: null, dominantDomain: null };
  }

  // Find the most frequent domain in recent moments
  const domainCounts: Record<string, number> = {};
  for (const m of moments) {
    domainCounts[m.domain] = (domainCounts[m.domain] ?? 0) + 1;
  }
  let dominantDomain: string | null = null;
  let maxCount = 0;
  for (const [domain, count] of Object.entries(domainCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantDomain = domain;
    }
  }

  return {
    momentCount: moments.length,
    oldestTimestamp: moments[0].timestamp,
    newestTimestamp: moments[moments.length - 1].timestamp,
    dominantDomain,
  };
}
