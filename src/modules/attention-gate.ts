/**
 * Attention Gate — Selective filtering of context injections.
 *
 * The human brain doesn't process all sensory input equally. The
 * thalamic reticular nucleus acts as an attention filter, selecting
 * what reaches conscious awareness. Without this, the prompt gets
 * bloated with irrelevant context sections.
 *
 * This module scores each context injection by relevance to the
 * current input and filters out low-relevance sections, modulated
 * by norepinephrine (high NE = more permissive attention).
 *
 * v0.6.2 (волна 1 миграции на per-instance состояние, пакет B):
 *  - фабрика `createAttentionGate()` создаёт инстанс со своими
 *    счётчиками и персистентностью;
 *  - `shouldInjectForTier` — чистая функция без состояния, осталась
 *    свободной;
 *  - module-level `let` остался один — слот активного инстанса.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWrite } from "./persist.ts";
import { bus } from "./event-bus.ts";
import type { BrainAgentConfig, ContextTier } from "./types.ts";
import { VectorIndex } from "./vector-engine.ts";

// ── Типы ────────────────────────────────────────────────────────────

export type AttentionGateStats = {
  totalProcessed: number;
  totalDropped: number;
  avgRelevance: number;
};

export type AttentionGateInstance = {
  filter(
    injections: string[],
    currentInput: string,
    norepinephrineLevel: number,
    config: BrainAgentConfig,
    maxTokenBudget?: number,
  ): string[];
  getStats(): AttentionGateStats;
};

// ── Фабрика ─────────────────────────────────────────────────────────

export function createAttentionGate(workspaceDir: string): AttentionGateInstance {
  const storageDir = workspaceDir ? join(workspaceDir, ".brainagent", "attention") : "";
  let totalProcessed = 0;
  let totalDropped = 0;
  let totalRelevanceSum = 0;

  if (storageDir && !existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  function loadState(): void {
    if (!storageDir) return;
    try {
      const path = join(storageDir, "state.json");
      if (existsSync(path)) {
        const data = JSON.parse(readFileSync(path, "utf-8")) as {
          totalProcessed: number;
          totalDropped: number;
          totalRelevanceSum: number;
        };
        totalProcessed = data.totalProcessed ?? 0;
        totalDropped = data.totalDropped ?? 0;
        totalRelevanceSum = data.totalRelevanceSum ?? 0;
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
        JSON.stringify({ totalProcessed, totalDropped, totalRelevanceSum }, null, 2),
      );
    } catch {
      /* non-critical */
    }
  }

  loadState();

  function filter(
    injections: string[],
    currentInput: string,
    norepinephrineLevel: number,
    config: BrainAgentConfig,
    maxTokenBudget?: number,
  ): string[] {
    if (injections.length === 0) return injections;

    // Build a transient vector index for scoring
    const index = new VectorIndex();
    index.add("__query__", currentInput);

    // Score each injection
    const scored: Array<{ text: string; score: number; idx: number }> = [];
    for (let i = 0; i < injections.length; i++) {
      index.add(`section_${i}`, injections[i]);
      const results = index.search(currentInput, injections.length + 1);
      const match = results.find((r) => r.id === `section_${i}`);
      scored.push({
        text: injections[i],
        score: match?.score ?? 0,
        idx: i,
      });
    }

    // Adjust threshold by norepinephrine: high NE = lower threshold (more permissive)
    const effectiveThreshold =
      config.attentionGate.minRelevanceScore * (1 - norepinephrineLevel * 0.5);

    // Sort by score descending and take top K above threshold
    scored.sort((a, b) => b.score - a.score);

    let kept: string[] = [];
    let dropped = 0;
    for (const item of scored) {
      if (kept.length < config.attentionGate.maxContextSections && item.score >= effectiveThreshold) {
        kept.push(item.text);
        totalRelevanceSum += item.score;
      } else {
        dropped++;
        bus.emitSync("attention:section-dropped", {
          snippet: item.text.slice(0, 50),
          relevanceScore: item.score,
        });
      }
    }

    // Token budget enforcement: drop lowest-relevance sections once budget exhausted
    if (maxTokenBudget && maxTokenBudget > 0) {
      let cumulativeTokens = 0;
      const budgeted: string[] = [];
      for (const text of kept) {
        const estimated = Math.ceil(text.length / 4);
        if (cumulativeTokens + estimated > maxTokenBudget) {
          dropped++;
          bus.emitSync("attention:budget-exceeded", {
            budgetUsed: cumulativeTokens,
            budgetMax: maxTokenBudget,
            droppedEstimate: estimated,
          });
        } else {
          cumulativeTokens += estimated;
          budgeted.push(text);
        }
      }
      kept = budgeted;
    }

    totalProcessed += injections.length;
    totalDropped += dropped;
    persistState();

    bus.emitSync("attention:filtered", {
      total: injections.length,
      kept: kept.length,
      dropped,
    });

    return kept;
  }

  function getStats(): AttentionGateStats {
    const kept = totalProcessed - totalDropped;
    return {
      totalProcessed,
      totalDropped,
      avgRelevance: kept > 0 ? totalRelevanceSum / kept : 0,
    };
  }

  return { filter, getStats };
}

// ── Слот активного инстанса (обратная совместимость) ────────────────

let active: AttentionGateInstance | undefined;

/** Инстанс без персистентности — для вызовов до инициализации. */
function current(): AttentionGateInstance {
  return active ?? (active = createAttentionGate(""));
}

// ── Initialization ──────────────────────────────────────────────────

export function initAttentionGate(workspaceDir: string, _config: BrainAgentConfig): void {
  active = createAttentionGate(workspaceDir);
}

// ── Core API ────────────────────────────────────────────────────────

// ── Context tier gating ─────────────────────────────────────────────

const TIER_LEVELS: Record<ContextTier, number> = { core: 0, situational: 1, reflective: 2 };

/**
 * Check if a module at a given tier should inject context
 * given the maximum allowed tier for the current cycle.
 * Чистая функция без состояния — живёт вне инстансов.
 */
export function shouldInjectForTier(moduleTier: ContextTier, allowedTier: ContextTier): boolean {
  return TIER_LEVELS[moduleTier] <= TIER_LEVELS[allowedTier];
}

// ── Relevance filtering ─────────────────────────────────────────────

/**
 * Filter context injections by relevance to the current input.
 *
 * Uses TF-IDF similarity to score each section against the input.
 * Norepinephrine level modulates the threshold: high NE makes the
 * gate more permissive (lets more through for complex/urgent tasks).
 */
export function filterContextInjections(
  injections: string[],
  currentInput: string,
  norepinephrineLevel: number,
  config: BrainAgentConfig,
  maxTokenBudget?: number,
): string[] {
  return current().filter(injections, currentInput, norepinephrineLevel, config, maxTokenBudget);
}

/** Get diagnostics stats. */
export function getAttentionStats(): AttentionGateStats {
  return current().getStats();
}
