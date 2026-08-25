/**
 * Default Mode Network v2 — Idle-time creative association finding.
 *
 * The brain's DMN activates during rest. Rather than doing nothing,
 * it connects disparate memories, finds hidden patterns, and prepares
 * for future needs. Dream Mode only does technical consolidation;
 * DMN adds the creative/connective thinking layer.
 *
 * v0.6.8: фабрика createDMN() с per-instance состоянием;
 * свободные функции — тонкие обёртки над слотом активного инстанса.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWrite } from "./persist.ts";
import { bus } from "./event-bus.ts";
import { getFactsByCategory, storeFact } from "./hippocampus.ts";
import type { BrainAgentConfig, BackgroundThought, DMNInsight } from "./types.ts";
import { VectorIndex } from "./vector-engine.ts";

type DMNLogger = { info: (msg: string) => void };

export interface DMNInstance {
  init: (workspaceDir: string, config: BrainAgentConfig, log?: DMNLogger) => void;
  runAssociationFinding: (config: BrainAgentConfig) => Promise<DMNInsight[]>;
  prepareProactiveContext: (
    predictions: Array<{ topic: string; confidence: number }>,
  ) => string | undefined;
  getStats: () => {
    totalInsights: number;
    lastRunTimestamp: number;
    associationsFound: number;
    backgroundThoughts: number;
  };
  generateBackgroundThoughts: (
    config: BrainAgentConfig,
    unresolvedQuestions?: string[],
    recentEmotions?: Array<{ emotion: string; intensity: number }>,
    knowledgeGaps?: Array<{ topic: string }>,
  ) => BackgroundThought[];
  getInnerMonologue: (n?: number) => BackgroundThought[];
  buildBackgroundThoughtContext: () => string | undefined;
  getRecentUnusedInsights: (maxAge?: number) => DMNInsight[];
  stop: () => void;
}

/**
 * Create a DMN instance with its own state.
 *
 * Пустой workspaceDir = detached-режим: состояние живёт в памяти,
 * диск не трогается (в точности поведение модуля до init).
 */
export function createDMN(
  workspaceDir: string,
  config?: BrainAgentConfig,
  log?: DMNLogger,
): DMNInstance {
  // ── State ─────────────────────────────────────────────────────────
  const storageDir = workspaceDir ? join(workspaceDir, ".brainagent", "dmn") : "";
  const insights: DMNInsight[] = [];
  let lastRunTimestamp = 0;
  let totalAssociationsFound = 0;
  let currentConfig: BrainAgentConfig | null = null;
  let logger: DMNLogger | undefined = log;
  const innerMonologue: BackgroundThought[] = [];
  let maxBackgroundThoughts = config?.dmn?.maxBackgroundThoughts ?? 20;

  // ── Persistence helpers ───────────────────────────────────────────

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
        insights.length = 0;
        insights.push(...(data.insights ?? []));
        lastRunTimestamp = data.lastRunTimestamp ?? 0;
        totalAssociationsFound = data.totalAssociationsFound ?? 0;
        innerMonologue.length = 0;
        innerMonologue.push(...(data.innerMonologue ?? []).slice(-maxBackgroundThoughts));
      }
    } catch {
      /* fresh start */
    }
  }

  function persistState(): void {
    if (!storageDir) return;
    try {
      atomicWrite(
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
      );
    } catch {
      /* non-critical */
    }
  }

  function init(dir: string, cfg: BrainAgentConfig, logFn?: DMNLogger): void {
    // Пересоздание через обёртку initDMN даёт новый инстанс; init здесь —
    // для симметрии API, применяет конфиг и перезагружает состояние.
    if (dir) {
      const newDir = join(dir, ".brainagent", "dmn");
      if (!existsSync(newDir)) {
        mkdirSync(newDir, { recursive: true });
      }
    }
    currentConfig = cfg;
    logger = logFn;
    maxBackgroundThoughts = cfg.dmn.maxBackgroundThoughts ?? 20;

    // Reset in-memory state before loading from disk
    insights.length = 0;
    lastRunTimestamp = 0;
    totalAssociationsFound = 0;
    innerMonologue.length = 0;

    loadState();
  }

  // ── Core API ──────────────────────────────────────────────────────

  /**
   * Run cross-domain association finding during sleep/idle.
   *
   * Retrieves semantic facts from different domains and looks for
   * unexpected similarities. When found, creates "insight" facts
   * in hippocampus and emits events.
   */
  async function runAssociationFinding(cfg: BrainAgentConfig): Promise<DMNInsight[]> {
    const maxInsights = cfg.dmn.maxInsightsPerCycle;
    const minSimilarity = cfg.dmn.minSimilarityForAssociation;

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
    const domainFacts: Array<{ domain: string; facts: Array<{ id: string; content: string }> }> =
      [];

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
  function prepareProactiveContext(
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
  function getStats() {
    return {
      totalInsights: insights.length,
      lastRunTimestamp,
      associationsFound: totalAssociationsFound,
      backgroundThoughts: innerMonologue.length,
    };
  }

  // ── Background Thinking ─────────────────────────────────────────

  /**
   * Generate background thoughts during idle/sleep.
   * Scans hippocampus for unresolved questions, recent emotional events,
   * and existing associations to produce reflective thoughts.
   */
  function generateBackgroundThoughts(
    cfg: BrainAgentConfig,
    unresolvedQuestions?: string[],
    recentEmotions?: Array<{ emotion: string; intensity: number }>,
    knowledgeGaps?: Array<{ topic: string }>,
  ): BackgroundThought[] {
    const maxPerCycle = cfg.dmn.maxThoughtsPerCycle ?? 5;
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
  function getInnerMonologue(n?: number): BackgroundThought[] {
    if (n === undefined) return [...innerMonologue];
    return innerMonologue.slice(-n);
  }

  /** Build context injection from background thoughts. */
  function buildBackgroundThoughtContext(): string | undefined {
    if (innerMonologue.length === 0) return undefined;

    const recent = innerMonologue.slice(-3);
    const lines = recent.map((t) => `- ${t.content}`).join("\n");
    return `<background-thoughts>\n${lines}\n</background-thoughts>`;
  }

  /**
   * Return recent insights that haven't been marked as useful yet.
   * Used by the autonomy DMN→goals feedback loop.
   */
  function getRecentUnusedInsights(maxAge = 24 * 60 * 60 * 1000): DMNInsight[] {
    const cutoff = Date.now() - maxAge;
    return insights.filter((i) => !i.wasUseful && i.timestamp >= cutoff);
  }

  /** Stop the instance: clear in-memory state. */
  function stop(): void {
    insights.length = 0;
    innerMonologue.length = 0;
    lastRunTimestamp = 0;
    totalAssociationsFound = 0;
    currentConfig = null;
    logger = undefined;
  }

  // Фабрика с непустым workspaceDir готовит директорию и грузит состояние
  // (эквивалент initDMN) — как в исходном модуле после init.
  if (storageDir) {
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }
    currentConfig = config ?? null;
    loadState();
  }

  return {
    init,
    runAssociationFinding,
    prepareProactiveContext,
    getStats,
    generateBackgroundThoughts,
    getInnerMonologue,
    buildBackgroundThoughtContext,
    getRecentUnusedInsights,
    stop,
  };
}

// ── Active instance slot + тонкие обёртки (внешний API сохранён) ────

let active: DMNInstance | null = null;

function current(): DMNInstance {
  // Detached-инстанс с пустым dir: состояние в памяти, диск не трогается —
  // в точности поведение модульных переменных до init.
  if (!active) active = createDMN("");
  return active;
}

export function initDMN(
  workspaceDir: string,
  config: BrainAgentConfig,
  log?: DMNLogger,
): void {
  active?.stop();
  active = createDMN(workspaceDir, config, log);
}

export function runAssociationFinding(config: BrainAgentConfig): Promise<DMNInsight[]> {
  return current().runAssociationFinding(config);
}

export function prepareProactiveContext(
  predictions: Array<{ topic: string; confidence: number }>,
): string | undefined {
  return current().prepareProactiveContext(predictions);
}

export function getDMNStats(): {
  totalInsights: number;
  lastRunTimestamp: number;
  associationsFound: number;
  backgroundThoughts: number;
} {
  return current().getStats();
}

export function generateBackgroundThoughts(
  config: BrainAgentConfig,
  unresolvedQuestions?: string[],
  recentEmotions?: Array<{ emotion: string; intensity: number }>,
  knowledgeGaps?: Array<{ topic: string }>,
): BackgroundThought[] {
  return current().generateBackgroundThoughts(
    config,
    unresolvedQuestions,
    recentEmotions,
    knowledgeGaps,
  );
}

export function getInnerMonologue(n?: number): BackgroundThought[] {
  return current().getInnerMonologue(n);
}

export function buildBackgroundThoughtContext(): string | undefined {
  return current().buildBackgroundThoughtContext();
}

export function getRecentUnusedInsights(maxAge = 24 * 60 * 60 * 1000): DMNInsight[] {
  return current().getRecentUnusedInsights(maxAge);
}

/** Симметричная остановка (освобождает состояние активного инстанса). */
export function stopDMN(): void {
  active?.stop();
  active = null;
}
