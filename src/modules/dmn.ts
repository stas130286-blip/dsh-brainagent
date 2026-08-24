/**
 * Default Mode Network v2 — Idle-time creative association finding.
 *
 * The brain's DMN activates during rest. Rather than doing nothing,
 * it connects disparate memories, finds hidden patterns, and prepares
 * for future needs. Dream Mode only does technical consolidation;
 * DMN adds the creative/connective thinking layer.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bus } from "./event-bus.ts";
import { getFactsByCategory, storeFact } from "./hippocampus.ts";
import type { BrainAgentConfig, BackgroundThought, DMNInsight } from "./types.ts";
import { VectorIndex } from "./vector-engine.ts";

// ── State ───────────────────────────────────────────────────────────

let storageDir = "";
let insights: DMNInsight[] = [];
let lastRunTimestamp = 0;
let totalAssociationsFound = 0;
let currentConfig: BrainAgentConfig | null = null;
let logger: { info: (msg: string) => void } | undefined;

// Background thinking state
let innerMonologue: BackgroundThought[] = [];
let maxBackgroundThoughts = 20;

// ── Initialization ──────────────────────────────────────────────────

export function initDMN(
  workspaceDir: string,
  config: BrainAgentConfig,
  log?: { info: (msg: string) => void },
): void {
  storageDir = join(workspaceDir, ".brainagent", "dmn");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  currentConfig = config;
  logger = log;

  // Reset in-memory state before loading from disk
  insights = [];
  lastRunTimestamp = 0;
  totalAssociationsFound = 0;
  innerMonologue = [];
  maxBackgroundThoughts = config.dmn.maxBackgroundThoughts ?? 20;

  loadState();
}

function loadState(): void {
  if (!storageDir) return;
  try {
    const path = join(storageDir, "state.json");
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, "utf-8")) as {
        insights: DMNInsight[];
        lastRunTimestamp: number;
        totalAssociationsFound: number;
        innerMonologue?: BackgroundThought[];
      };
      insights = data.insights ?? [];
      lastRunTimestamp = data.lastRunTimestamp ?? 0;
      totalAssociationsFound = data.totalAssociationsFound ?? 0;
      innerMonologue = (data.innerMonologue ?? []).slice(-maxBackgroundThoughts);
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
        {
          insights: insights.slice(-50), // Keep last 50
          lastRunTimestamp,
          totalAssociationsFound,
          innerMonologue: innerMonologue.slice(-maxBackgroundThoughts),
        },
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
 * Run cross-domain association finding during sleep/idle.
 *
 * Retrieves semantic facts from different domains and looks for
 * unexpected similarities. When found, creates "insight" facts
 * in hippocampus and emits events.
 */
export async function runAssociationFinding(config: BrainAgentConfig): Promise<DMNInsight[]> {
  const maxInsights = config.dmn.maxInsightsPerCycle;
  const minSimilarity = config.dmn.minSimilarityForAssociation;

  // Retrieve facts from actual semantic categories stored in hippocampus
  const categories = [
    "user_info",
    "user_preference",
    "definition",
    "plan",
    "relationship",
    "problem",
    "entity",
    "solution",
    "fact",
    "opinion",
    "context",
  ];
  const domainFacts: Array<{ domain: string; facts: Array<{ id: string; content: string }> }> = [];

  for (const category of categories) {
    const facts = getFactsByCategory(category, 10);
    if (facts.length > 0) {
      domainFacts.push({
        domain: category,
        facts: facts.map((f) => ({ id: f.id, content: f.content })),
      });
    }
  }

  logger?.info(
    `DMN: retrieved facts from ${domainFacts.length} categories (${domainFacts.reduce((s, d) => s + d.facts.length, 0)} total facts)`,
  );

  if (domainFacts.length < 2) return [];

  // Build vector index for cross-domain comparison
  const index = new VectorIndex();
  const allFacts: Array<{ id: string; content: string; domain: string }> = [];

  for (const df of domainFacts) {
    for (const fact of df.facts) {
      index.add(fact.id, fact.content);
      allFacts.push({ ...fact, domain: df.domain });
    }
  }

  // Find cross-domain associations
  const newInsights: DMNInsight[] = [];
  const seenPairs = new Set<string>();

  for (const fact of allFacts) {
    if (newInsights.length >= maxInsights) break;

    const results = index.search(fact.content, 5);
    for (const result of results) {
      if (result.id === fact.id) continue;
      if (result.score < minSimilarity) continue;

      const other = allFacts.find((f) => f.id === result.id);
      if (!other || other.domain === fact.domain) continue;

      const pairKey = [fact.id, result.id].sort().join("|");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const insight: DMNInsight = {
        id: `dmn_${Date.now()}_${newInsights.length}`,
        timestamp: Date.now(),
        sourceMemoryIds: [fact.id, result.id],
        insightText: `Connection found between "${fact.content.slice(0, 60)}" (${fact.domain}) and "${other.content.slice(0, 60)}" (${other.domain})`,
        domain: `${fact.domain}+${other.domain}`,
        confidence: result.score,
        wasUseful: false,
      };

      newInsights.push(insight);
      totalAssociationsFound++;

      // Store as a semantic fact
      storeFact(insight.insightText, "dmn_insight", insight.sourceMemoryIds, []);

      bus.emitSync("dmn:insight-generated", {
        insightId: insight.id,
        description: insight.insightText,
      });

      bus.emitSync("dmn:association-found", {
        memoryIdA: fact.id,
        memoryIdB: result.id,
        similarity: result.score,
      });

      if (newInsights.length >= maxInsights) break;
    }
  }

  insights.push(...newInsights);
  lastRunTimestamp = Date.now();
  persistState();

  logger?.info(`DMN: found ${newInsights.length} cross-domain associations`);

  return newInsights;
}

/**
 * Build proactive context from predictive engine output.
 * Pre-warm relevant context for predicted user needs.
 */
export function prepareProactiveContext(
  predictions: Array<{ topic: string; confidence: number }>,
): string | undefined {
  if (predictions.length === 0) return undefined;

  const topPrediction = predictions[0];
  if (topPrediction.confidence < 0.5) return undefined;

  // Check if we have relevant DMN insights for the predicted topic
  const relevantInsights = insights.filter(
    (i) => i.domain.includes(topPrediction.topic) && !i.wasUseful,
  );

  if (relevantInsights.length === 0) return undefined;

  const insight = relevantInsights[0];
  insight.wasUseful = true;
  persistState();

  bus.emitSync("dmn:proactive-context-prepared", {
    topic: topPrediction.topic,
    confidence: topPrediction.confidence,
  });

  return `<proactive-insight>\n${insight.insightText}\n</proactive-insight>`;
}

/** Get diagnostics stats. */
export function getDMNStats(): {
  totalInsights: number;
  lastRunTimestamp: number;
  associationsFound: number;
  backgroundThoughts: number;
} {
  return {
    totalInsights: insights.length,
    lastRunTimestamp,
    associationsFound: totalAssociationsFound,
    backgroundThoughts: innerMonologue.length,
  };
}

// ── Background Thinking ─────────────────────────────────────────────

/**
 * Generate background thoughts during idle/sleep.
 * Scans hippocampus for unresolved questions, recent emotional events,
 * and existing associations to produce reflective thoughts.
 */
export function generateBackgroundThoughts(
  config: BrainAgentConfig,
  unresolvedQuestions?: string[],
  recentEmotions?: Array<{ emotion: string; intensity: number }>,
  knowledgeGaps?: Array<{ topic: string }>,
): BackgroundThought[] {
  const maxPerCycle = config.dmn.maxThoughtsPerCycle ?? 5;
  const newThoughts: BackgroundThought[] = [];

  // 1. Thoughts from unresolved questions
  if (unresolvedQuestions) {
    for (const q of unresolvedQuestions.slice(0, 2)) {
      if (newThoughts.length >= maxPerCycle) break;
      const thought: BackgroundThought = {
        id: `thought_${Date.now()}_${newThoughts.length}`,
        timestamp: Date.now(),
        content: `Unresolved question: "${q.slice(0, 100)}" — should revisit this topic`,
        source: "unresolved",
        relatedMemoryIds: [],
      };
      newThoughts.push(thought);
    }
  }

  // 2. Thoughts from recent emotional events
  if (recentEmotions) {
    const intense = recentEmotions.filter((e) => e.intensity > 0.6);
    for (const e of intense.slice(0, 2)) {
      if (newThoughts.length >= maxPerCycle) break;
      const thought: BackgroundThought = {
        id: `thought_${Date.now()}_${newThoughts.length}`,
        timestamp: Date.now(),
        content: `Recent emotional event (${e.emotion}, intensity ${(e.intensity * 100).toFixed(0)}%) — worth reflecting on`,
        source: "emotional",
        relatedMemoryIds: [],
      };
      newThoughts.push(thought);
    }
  }

  // 3. Thoughts from knowledge gaps — DMN consumes gaps (canonical
  // source: curiosity-drive) instead of generating them; 24h dedup
  // keeps the same gap from spamming the monologue
  if (knowledgeGaps) {
    const dayMs = 24 * 60 * 60 * 1000;
    const recentGapThoughts = innerMonologue.filter(
      (t) => t.source === "pending" && Date.now() - t.timestamp < dayMs,
    );
    for (const gap of knowledgeGaps.slice(0, 2)) {
      if (newThoughts.length >= maxPerCycle) break;
      // Точное сравнение фразы: короткая тема («cat») не должна
      // сталкиваться с длинной («catalog») через substring
      const marker = `Knowledge gap in "${gap.topic}"`;
      const alreadySeen =
        recentGapThoughts.some((t) => t.content.startsWith(marker)) ||
        newThoughts.some((t) => t.content.startsWith(marker));
      if (alreadySeen) continue;
      const thought: BackgroundThought = {
        id: `thought_${Date.now()}_${newThoughts.length}`,
        timestamp: Date.now(),
        content: `Knowledge gap in "${gap.topic}" — opportunity to learn more`,
        source: "pending",
        relatedMemoryIds: [],
      };
      newThoughts.push(thought);
    }
  }

  // 4. Thoughts from existing associations/insights
  const recentInsights = insights.filter(
    (i) => !i.wasUseful && Date.now() - i.timestamp < 24 * 60 * 60 * 1000,
  );
  for (const insight of recentInsights.slice(0, 1)) {
    if (newThoughts.length >= maxPerCycle) break;
    const thought: BackgroundThought = {
      id: `thought_${Date.now()}_${newThoughts.length}`,
      timestamp: Date.now(),
      content: `Interesting connection: ${insight.insightText.slice(0, 120)}`,
      source: "association",
      relatedMemoryIds: insight.sourceMemoryIds,
    };
    newThoughts.push(thought);
  }

  // Push to monologue ring buffer
  for (const t of newThoughts) {
    innerMonologue.push(t);
    bus.emitSync("dmn:thought-generated", {
      thoughtId: t.id,
      content: t.content,
      source: t.source,
    });
  }

  // Trim ring buffer
  if (innerMonologue.length > maxBackgroundThoughts) {
    innerMonologue.splice(0, innerMonologue.length - maxBackgroundThoughts);
  }

  persistState();
  logger?.info(`DMN: generated ${newThoughts.length} background thoughts`);

  return newThoughts;
}

/** Get last N background thoughts. */
export function getInnerMonologue(n?: number): BackgroundThought[] {
  if (n === undefined) return [...innerMonologue];
  return innerMonologue.slice(-n);
}

/** Build context injection from background thoughts. */
export function buildBackgroundThoughtContext(): string | undefined {
  if (innerMonologue.length === 0) return undefined;

  const recent = innerMonologue.slice(-3);
  const lines = recent.map((t) => `- ${t.content}`).join("\n");
  return `<background-thoughts>\n${lines}\n</background-thoughts>`;
}

/**
 * Return recent insights that haven't been marked as useful yet.
 * Used by the autonomy DMN→goals feedback loop.
 */
export function getRecentUnusedInsights(maxAge = 24 * 60 * 60 * 1000): DMNInsight[] {
  const cutoff = Date.now() - maxAge;
  return insights.filter((i) => !i.wasUseful && i.timestamp >= cutoff);
}
