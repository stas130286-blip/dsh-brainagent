/**
 * Predictive Engine — Anticipatory cognition.
 *
 * The human brain is a prediction machine. You don't react to a ball flying
 * toward you — your brain PREDICTS the trajectory and moves your hand
 * before the ball arrives. This is called "predictive coding" and it's
 * one of the most powerful principles in neuroscience.
 *
 * This module implements three types of prediction:
 *
 * 1. TEMPORAL PATTERNS — "Every Monday morning, the user asks for a report"
 *    Tracks what happens at specific times/days and pre-loads context.
 *
 * 2. SEQUENTIAL PATTERNS — "After asking about errors, user usually asks to fix them"
 *    Tracks topic → next-topic chains, like a Markov chain of conversation.
 *
 * 3. CONTEXTUAL PATTERNS — "When user opens fishing-articles, they discuss formatting"
 *    Tracks environment → topic associations.
 *
 * The result: the agent can say "Good morning! I see you usually check
 * the bot status around this time. Want me to run a diagnostic?"
 *
 * v0.6.3 (волна 1 миграции на per-instance состояние, пакет B2):
 *  - фабрика `createPredictiveEngine()` создаёт инстанс со своими
 *    паттернами и персистентностью;
 *  - module-level `let` остался один — слот активного инстанса;
 *    обёртки до инициализации лениво используют detached-инстанс
 *    (без персистентности), как раньше работали на состоянии по умолчанию.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MessageDomain } from "./types.ts";

// ── Types ───────────────────────────────────────────────────────────

export type TemporalPattern = {
  /** Day of week (0=Sun, 6=Sat) + hour block (0-23) */
  key: string;
  /** What topics/domains appear at this time */
  domainCounts: Record<string, number>;
  /** Common keywords at this time */
  keywordCounts: Record<string, number>;
  /** Total observations at this time slot */
  totalObservations: number;
};

export type SequentialPattern = {
  /** The trigger domain/topic */
  trigger: string;
  /** What follows, with frequency counts */
  followers: Record<string, number>;
  /** Total transitions observed from this trigger */
  totalTransitions: number;
};

export type ContextualPattern = {
  /** Context identifier (e.g., file path, channel, activity) */
  context: string;
  /** Topics that appear in this context */
  topicCounts: Record<string, number>;
  totalObservations: number;
};

export type Prediction = {
  type: "temporal" | "sequential" | "contextual";
  /** What we predict will be discussed/needed */
  predictedTopic: string;
  /** 0-1 confidence */
  confidence: number;
  /** Human-readable reasoning */
  reasoning: string;
};

export type PredictiveStats = {
  temporalPatterns: number;
  sequentialPatterns: number;
  contextualPatterns: number;
  totalObservations: number;
};

export type PredictiveEngineInstance = {
  observeInteraction(domain: MessageDomain, keywords: string[], context?: string): void;
  predict(currentContext?: string): Prediction[];
  getStats(): PredictiveStats;
};

// ── Фабрика ─────────────────────────────────────────────────────────

export function createPredictiveEngine(workspaceDir: string): PredictiveEngineInstance {
  const storageDir = workspaceDir ? join(workspaceDir, ".brainagent", "predictions") : "";

  const temporalPatterns = new Map<string, TemporalPattern>();
  const sequentialPatterns = new Map<string, SequentialPattern>();
  const contextualPatterns = new Map<string, ContextualPattern>();

  let lastDomain: string | undefined;

  if (storageDir && !existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  function loadPatterns(): void {
    if (!storageDir) return;
    try {
      const tPath = join(storageDir, "temporal.json");
      if (existsSync(tPath)) {
        const data = JSON.parse(readFileSync(tPath, "utf-8")) as Record<string, TemporalPattern>;
        for (const [key, val] of Object.entries(data)) temporalPatterns.set(key, val);
      }
    } catch {
      /* fresh start */
    }

    try {
      const sPath = join(storageDir, "sequential.json");
      if (existsSync(sPath)) {
        const data = JSON.parse(readFileSync(sPath, "utf-8")) as Record<string, SequentialPattern>;
        for (const [key, val] of Object.entries(data)) sequentialPatterns.set(key, val);
      }
    } catch {
      /* fresh start */
    }

    try {
      const cPath = join(storageDir, "contextual.json");
      if (existsSync(cPath)) {
        const data = JSON.parse(readFileSync(cPath, "utf-8")) as Record<string, ContextualPattern>;
        for (const [key, val] of Object.entries(data)) contextualPatterns.set(key, val);
      }
    } catch {
      /* fresh start */
    }
  }

  function persistAll(): void {
    if (!storageDir) return;
    try {
      writeFileSync(
        join(storageDir, "temporal.json"),
        JSON.stringify(Object.fromEntries(temporalPatterns), null, 2),
        "utf-8",
      );
      writeFileSync(
        join(storageDir, "sequential.json"),
        JSON.stringify(Object.fromEntries(sequentialPatterns), null, 2),
        "utf-8",
      );
      writeFileSync(
        join(storageDir, "contextual.json"),
        JSON.stringify(Object.fromEntries(contextualPatterns), null, 2),
        "utf-8",
      );
    } catch {
      /* non-critical */
    }
  }

  loadPatterns();

  // ── Observation: learn patterns from each interaction ────────────

  function observeInteraction(
    domain: MessageDomain,
    keywords: string[],
    context?: string,
  ): void {
    const now = new Date();

    // 1. Update temporal pattern
    const timeKey = `${now.getDay()}-${now.getHours()}`;
    let temporal = temporalPatterns.get(timeKey);
    if (!temporal) {
      temporal = { key: timeKey, domainCounts: {}, keywordCounts: {}, totalObservations: 0 };
      temporalPatterns.set(timeKey, temporal);
    }
    temporal.domainCounts[domain] = (temporal.domainCounts[domain] ?? 0) + 1;
    for (const kw of keywords.slice(0, 5)) {
      temporal.keywordCounts[kw] = (temporal.keywordCounts[kw] ?? 0) + 1;
    }
    temporal.totalObservations++;

    // 2. Update sequential pattern (what follows what)
    if (lastDomain && lastDomain !== domain) {
      let sequential = sequentialPatterns.get(lastDomain);
      if (!sequential) {
        sequential = { trigger: lastDomain, followers: {}, totalTransitions: 0 };
        sequentialPatterns.set(lastDomain, sequential);
      }
      sequential.followers[domain] = (sequential.followers[domain] ?? 0) + 1;
      sequential.totalTransitions++;
    }
    lastDomain = domain;

    // 3. Update contextual pattern
    if (context) {
      let ctx = contextualPatterns.get(context);
      if (!ctx) {
        ctx = { context, topicCounts: {}, totalObservations: 0 };
        contextualPatterns.set(context, ctx);
      }
      ctx.topicCounts[domain] = (ctx.topicCounts[domain] ?? 0) + 1;
      for (const kw of keywords.slice(0, 3)) {
        ctx.topicCounts[kw] = (ctx.topicCounts[kw] ?? 0) + 1;
      }
      ctx.totalObservations++;
    }

    persistAll();
  }

  // ── Prediction: anticipate what the user will need ───────────────

  function predict(currentContext?: string): Prediction[] {
    const predictions: Prediction[] = [];

    // 1. Temporal predictions: what usually happens at this time?
    const now = new Date();
    const timeKey = `${now.getDay()}-${now.getHours()}`;
    const temporal = temporalPatterns.get(timeKey);
    if (temporal && temporal.totalObservations >= 3) {
      const topDomain = getTopEntry(temporal.domainCounts);
      if (topDomain) {
        const confidence = temporal.domainCounts[topDomain.key] / temporal.totalObservations;
        if (confidence > 0.3) {
          const dayName = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][now.getDay()];
          predictions.push({
            type: "temporal",
            predictedTopic: topDomain.key,
            confidence,
            reasoning: `По ${dayName} в ${now.getHours()}:00 пользователь обычно обсуждает: ${topDomain.key} (${(confidence * 100).toFixed(0)}% из ${temporal.totalObservations} наблюдений)`,
          });
        }
      }
      // Also predict specific keywords
      const topKeyword = getTopEntry(temporal.keywordCounts);
      if (topKeyword) {
        const kwConf = temporal.keywordCounts[topKeyword.key] / temporal.totalObservations;
        if (kwConf > 0.3 && topKeyword.key !== topDomain?.key) {
          predictions.push({
            type: "temporal",
            predictedTopic: topKeyword.key,
            confidence: kwConf * 0.8, // Slightly lower for keywords
            reasoning: `Частая тема в это время: "${topKeyword.key}"`,
          });
        }
      }
    }

    // 2. Sequential predictions: what usually follows the current topic?
    if (lastDomain) {
      const sequential = sequentialPatterns.get(lastDomain);
      if (sequential && sequential.totalTransitions >= 2) {
        const topFollower = getTopEntry(sequential.followers);
        if (topFollower) {
          const confidence = sequential.followers[topFollower.key] / sequential.totalTransitions;
          if (confidence > 0.25) {
            predictions.push({
              type: "sequential",
              predictedTopic: topFollower.key,
              confidence,
              reasoning: `После "${lastDomain}" обычно следует "${topFollower.key}" (${(confidence * 100).toFixed(0)}% переходов)`,
            });
          }
        }
      }
    }

    // 3. Contextual predictions: what happens in this environment?
    if (currentContext) {
      const ctx = contextualPatterns.get(currentContext);
      if (ctx && ctx.totalObservations >= 2) {
        const topTopic = getTopEntry(ctx.topicCounts);
        if (topTopic) {
          const confidence = ctx.topicCounts[topTopic.key] / ctx.totalObservations;
          if (confidence > 0.3) {
            predictions.push({
              type: "contextual",
              predictedTopic: topTopic.key,
              confidence,
              reasoning: `В контексте "${currentContext}" обычно обсуждается: "${topTopic.key}"`,
            });
          }
        }
      }
    }

    // Sort by confidence, deduplicate
    predictions.sort((a, b) => b.confidence - a.confidence);
    const seen = new Set<string>();
    return predictions.filter((p) => {
      if (seen.has(p.predictedTopic)) return false;
      seen.add(p.predictedTopic);
      return true;
    });
  }

  // ── Stats ────────────────────────────────────────────────────────

  function getStats(): PredictiveStats {
    let totalObs = 0;
    for (const t of temporalPatterns.values()) totalObs += t.totalObservations;
    return {
      temporalPatterns: temporalPatterns.size,
      sequentialPatterns: sequentialPatterns.size,
      contextualPatterns: contextualPatterns.size,
      totalObservations: totalObs,
    };
  }

  return { observeInteraction, predict, getStats };
}

// ── Helpers (чистые, без состояния) ─────────────────────────────────

function getTopEntry(counts: Record<string, number>): { key: string; count: number } | undefined {
  let topKey: string | undefined;
  let topCount = 0;
  for (const [key, count] of Object.entries(counts)) {
    if (count > topCount) {
      topCount = count;
      topKey = key;
    }
  }
  return topKey ? { key: topKey, count: topCount } : undefined;
}

// ── Слот активного инстанса (обратная совместимость) ────────────────

let active: PredictiveEngineInstance | undefined;

/** Инстанс без персистентности — для вызовов до инициализации. */
function current(): PredictiveEngineInstance {
  return active ?? (active = createPredictiveEngine(""));
}

// ── Initialization ──────────────────────────────────────────────────

export function initPredictiveStorage(workspaceDir: string): void {
  active = createPredictiveEngine(workspaceDir);
}

// ── Core API (обёртки над активным инстансом) ───────────────────────

/**
 * Observe a user interaction and update all pattern models.
 * Called on every message to build up prediction ability.
 */
export function observeInteraction(
  domain: MessageDomain,
  keywords: string[],
  context?: string,
): void {
  current().observeInteraction(domain, keywords, context);
}

/**
 * Generate predictions based on current time, last topic, and context.
 * Returns predictions sorted by confidence (highest first).
 */
export function predict(currentContext?: string): Prediction[] {
  return current().predict(currentContext);
}

export function getPredictiveStats(): PredictiveStats {
  return current().getStats();
}
