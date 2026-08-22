/**
 * Curiosity Drive — Knowledge gap tracking and exploration motivation.
 *
 * The dopamine system already marks novelty, but there's no mechanism
 * to proactively seek information. This module tracks knowledge gaps
 * (topics where hippocampus recall returned empty) and occasionally
 * generates curiosity-driven context injections, modulated by
 * serotonin (exploration drive) and acetylcholine (learning readiness).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bus } from "./event-bus.ts";
import type { BrainAgentConfig, KnowledgeGap, MessageDomain } from "./types.ts";

// ── State ───────────────────────────────────────────────────────────

let storageDir = "";
let gaps: KnowledgeGap[] = [];
let totalDetected = 0;
let questionsGenerated = 0;
let gapsFilled = 0;
let maxGaps = 15;
let minGapConfidence = 0.3;
let askProbability = 0.1;
let idCounter = 0;

// ── Initialization ──────────────────────────────────────────────────

export function initCuriosityDrive(workspaceDir: string, config: BrainAgentConfig): void {
  storageDir = join(workspaceDir, ".brainagent", "curiosity");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  maxGaps = config.curiosity.maxGaps;
  minGapConfidence = config.curiosity.minGapConfidence;
  askProbability = config.curiosity.askProbability;

  // Reset in-memory state before loading from disk
  gaps = [];
  totalDetected = 0;
  questionsGenerated = 0;
  gapsFilled = 0;
  idCounter = 0;

  loadState();
}

function loadState(): void {
  if (!storageDir) return;
  try {
    const path = join(storageDir, "state.json");
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, "utf-8")) as {
        gaps: KnowledgeGap[];
        totalDetected: number;
        questionsGenerated: number;
        gapsFilled: number;
      };
      gaps = data.gaps ?? [];
      totalDetected = data.totalDetected ?? 0;
      questionsGenerated = data.questionsGenerated ?? 0;
      gapsFilled = data.gapsFilled ?? 0;
    }
  } catch {
    /* fresh start */
  }
}

function persistState(): void {
  if (!storageDir) return;
  try {
    writeFileSync(
      join(storageDir, "state.json"),
      JSON.stringify(
        { gaps: gaps.slice(-maxGaps * 2), totalDetected, questionsGenerated, gapsFilled },
        null,
        2,
      ),
      "utf-8",
    );
  } catch {
    /* non-critical */
  }
}

// ── Core API ────────────────────────────────────────────────────────

/**
 * Detect a knowledge gap when hippocampus recall is empty
 * or prediction confidence is low for a topic.
 */
export function detectKnowledgeGap(
  topic: string,
  domain: MessageDomain,
  recallWasEmpty: boolean,
  predictionConfidence?: number,
): void {
  const isLowConfidence =
    predictionConfidence !== undefined && predictionConfidence < minGapConfidence;
  if (!recallWasEmpty && !isLowConfidence) {
    return;
  }

  const topicLower = topic.toLowerCase();

  // Check for existing gap on this topic
  const existing = gaps.find((g) => g.topic.toLowerCase() === topicLower && g.status === "open");
  if (existing) {
    existing.timesEncountered++;
    existing.lastEncountered = Date.now();
    existing.confidence = Math.min(1, existing.confidence + 0.1);
    persistState();
    return;
  }

  // Create new gap
  const confidence = recallWasEmpty ? 0.7 : 0.4;
  if (confidence < minGapConfidence) return;

  const gap: KnowledgeGap = {
    id: `gap_${Date.now()}_${++idCounter}`,
    topic,
    domain,
    confidence,
    discoveredAt: Date.now(),
    timesEncountered: 1,
    lastEncountered: Date.now(),
    status: "open",
  };

  gaps.push(gap);
  totalDetected++;

  // Enforce limit: remove oldest low-confidence gaps
  const openGaps = gaps.filter((g) => g.status === "open");
  if (openGaps.length > maxGaps) {
    openGaps.sort((a, b) => a.confidence - b.confidence);
    openGaps[0].status = "filled"; // Drop weakest
  }

  persistState();

  bus.emitSync("curiosity:gap-detected", { topic, domain });
}

/**
 * Build a curiosity-driven context injection.
 * Modulated by serotonin (exploration) and acetylcholine (learning).
 * Only triggers probabilistically.
 */
export function buildCuriosityContext(
  serotoninLevel: number,
  _acetylcholineLevel: number,
): string | undefined {
  const openGaps = gaps.filter((g) => g.status === "open");
  if (openGaps.length === 0) return undefined;

  // Modulate ask probability by serotonin (high = more exploratory)
  const effectiveProbability = askProbability * serotoninLevel * 2;
  if (Math.random() > effectiveProbability) return undefined;

  // Pick the most encountered gap
  openGaps.sort((a, b) => b.timesEncountered - a.timesEncountered);
  const gap = openGaps[0];

  questionsGenerated++;
  persistState();

  const question = `I notice we haven't discussed "${gap.topic}" in detail. If relevant, I'd like to learn more about this topic to better assist you.`;

  bus.emitSync("curiosity:question-generated", {
    topic: gap.topic,
    question,
  });

  return `## Curiosity Note\n${question}`;
}

/** Mark a gap as filled when relevant information is learned. */
export function markGapFilled(topic: string): void {
  const topicLower = topic.toLowerCase();
  for (const gap of gaps) {
    if (gap.status === "open" && gap.topic.toLowerCase() === topicLower) {
      gap.status = "filled";
      gapsFilled++;
    }
  }
  persistState();
}

/** Get diagnostics stats. */
export function getCuriosityStats(): {
  openGaps: number;
  totalDetected: number;
  questionsGenerated: number;
  gapsFilled: number;
} {
  return {
    openGaps: gaps.filter((g) => g.status === "open").length,
    totalDetected,
    questionsGenerated,
    gapsFilled,
  };
}

/** Get all currently open knowledge gaps. */
export function getOpenGaps(): KnowledgeGap[] {
  return gaps.filter((g) => g.status === "open");
}
