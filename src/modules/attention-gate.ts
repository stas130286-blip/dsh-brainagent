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
 * v0.9.31: скоринг косинуса TF-IDF заменён на покрытие запроса —
 * IDF-взвешенную долю термов входа, найденных в секции. Косинус
 * «длинная секция ↔ короткий запрос» всегда был ниже порога 0.2,
 * из-за чего гейт отбрасывал все секции (Sections: avg 0).
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
import { tokenize } from "./vector-engine.ts";

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

    // Query-coverage scoring (v0.9.31). Cosine similarity between a long
    // section and a short user message is always tiny — the section vector is
    // diluted by hundreds of terms — so the old 0.2 cosine threshold dropped
    // every section (observed: 0 sections kept across all 7 cycles). Coverage
    // asks what the gate actually cares about: what share of the query's
    // IDF-weighted terms does this section mention? Section length stops
    // penalising relevance.
    const queryTerms = new Set(tokenize(currentInput));
    const sectionTerms = injections.map((text) => new Set(tokenize(text)));

    const docFrequency = new Map<string, number>();
    for (const terms of sectionTerms) {
      for (const term of terms) {
        docFrequency.set(term, (docFrequency.get(term) ?? 0) + 1);
      }
    }
    // Smoothed IDF: a term present in every section barely distinguishes them.
    const termWeight = (term: string): number =>
      Math.log(1 + injections.length / (1 + (docFrequency.get(term) ?? 0)));

    let queryWeight = 0;
    for (const term of queryTerms) queryWeight += termWeight(term);

    const scored: Array<{ text: string; score: number; idx: number }> = [];
    for (let i = 0; i < injections.length; i++) {
      let matchedWeight = 0;
      if (queryWeight > 0) {
        for (const term of queryTerms) {
          if (sectionTerms[i].has(term)) matchedWeight += termWeight(term);
        }
      }
      scored.push({
        text: injections[i],
        score: queryWeight > 0 ? matchedWeight / queryWeight : 0,
        idx: i,
      });
    }

    // Adjust threshold by norepinephrine: high NE = lower threshold (more permissive).
    const absoluteThreshold =
      config.attentionGate.minRelevanceScore * (1 - norepinephrineLevel * 0.5);
    // Relative floor: the best section always survives, so a short or unusual
    // input ("привет") can never empty the whole context and silently strip
    // identity, clock and memory blocks from the prompt.
    const bestScore = scored.reduce((max, item) => Math.max(max, item.score), 0);
    const effectiveThreshold = Math.min(absoluteThreshold, bestScore * 0.6);

    // Take the top K above threshold, then restore assembly order — identity
    // and clock blocks must keep their intended positions in the prompt.
    const ranked = [...scored].sort((a, b) => b.score - a.score);
    const keep = new Set<number>();
    let keptScore = 0;
    let dropped = 0;
    for (const item of ranked) {
      if (keep.size < config.attentionGate.maxContextSections && item.score >= effectiveThreshold) {
        keep.add(item.idx);
        keptScore += item.score;
      } else {
        dropped++;
        bus.emitSync("attention:section-dropped", {
          snippet: item.text.slice(0, 50),
          relevanceScore: item.score,
        });
      }
    }
    totalRelevanceSum += keptScore;
    let kept: string[] = injections.filter((_, idx) => keep.has(idx));

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
 * Scores each section by IDF-weighted coverage of the input's terms and
 * keeps the best ones within the section and token budgets. Norepinephrine
 * modulates the threshold: high NE makes the gate more permissive.
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
