/**
 * Temporal Awareness — Subjective sense of time passing.
 *
 * Humans don't perceive time uniformly. A week of daily conversations
 * feels different from a week of silence. After a long absence, we
 * naturally acknowledge the gap: "It's been a while!" After frequent
 * exchanges, we feel the flow of continuity: "As we were discussing..."
 *
 * This module tracks interaction timestamps, computes a "typical gap"
 * using an exponential moving average (EMA), and emits bus events when
 * the current gap deviates significantly from the norm:
 *
 *  - temporal:long-absence  — gap ≫ typical (user has been away)
 *  - temporal:frequent-engagement — high interaction density
 *
 * These signals flow into Vital Impulse (weighted in signalWeights)
 * and context injection, allowing the agent to naturally acknowledge
 * temporal patterns without hardcoded timers.
 *
 * No fixed timers — evaluation happens on each interaction.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bus } from "./event-bus.ts";
import type { BrainAgentConfig } from "./types.ts";

// ── Types ─────────────────────────────────────────────────────────

type PersistedState = {
  timestamps: number[];
  typicalGapMs: number;
  totalInteractions: number;
};

export type TemporalAwarenessStats = {
  typicalGapMs: number;
  lastInteractionTime: number;
  currentGapMs: number;
  interactionDensity: number;
  totalInteractions: number;
  temporalSurprise: number;
};

export type TemporalAwarenessInstance = {
  /** Записать взаимодействие и оценить временные паттерны. */
  recordInteraction(): void;
  /** Сводная статистика временного восприятия. */
  getStats(): TemporalAwarenessStats;
  /** Контекст для промпта (null, если нет ничего примечательного). */
  buildContext(): string | null;
  /** Сохранить состояние. */
  stop(): void;
  /** Тихий вариант stop (для замены инстанса). */
  dispose(): void;
};

// ── Фабрика ───────────────────────────────────────────────────────

export function createTemporalAwareness(
  workspaceDir: string,
  cfg: BrainAgentConfig,
  log?: { info: (msg: string) => void },
): TemporalAwarenessInstance {
  const config = cfg.temporalAwareness;

  let timestamps: number[] = [];
  let typicalGapMs = 0;
  let totalInteractions = 0;

  const storageDir = join(workspaceDir, ".brainagent");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  // Загрузка персистентного состояния
  try {
    const path = join(storageDir, "temporal-awareness.json");
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, "utf-8")) as PersistedState;
      timestamps = data.timestamps ?? [];
      typicalGapMs = data.typicalGapMs ?? 0;
      totalInteractions = data.totalInteractions ?? 0;
    }
  } catch {
    // Fresh start
  }

  function persistState(): void {
    try {
      const data: PersistedState = {
        timestamps,
        typicalGapMs,
        totalInteractions,
      };
      writeFileSync(
        join(storageDir, "temporal-awareness.json"),
        JSON.stringify(data, null, 2),
        "utf-8",
      );
    } catch {
      // Non-critical
    }
  }

  /**
   * Compute interaction density as interactions per day within the density window.
   */
  function computeDensity(now: number): number {
    if (timestamps.length < 2) return 0;

    const windowStart = now - config.densityWindowMs;
    const withinWindow = timestamps.filter((t) => t >= windowStart);

    if (withinWindow.length < 2) return 0;

    const windowSpanMs = now - withinWindow[0];
    if (windowSpanMs <= 0) return 0;

    const daysInWindow = windowSpanMs / (24 * 60 * 60 * 1000);
    return withinWindow.length / Math.max(daysInWindow, 0.01); // avoid division by zero
  }

  /**
   * Record a new interaction and evaluate temporal patterns.
   * Should be called once per user message (from index.ts processing cycle).
   */
  function recordInteraction(): void {
    const now = Date.now();
    const lastTime = timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0;

    // Add timestamp to rolling window
    timestamps.push(now);
    if (timestamps.length > config.gapHistorySize) {
      timestamps = timestamps.slice(-config.gapHistorySize);
    }
    totalInteractions++;

    // Compute gap since last interaction
    const gapMs = lastTime > 0 ? now - lastTime : 0;

    // Update typical gap via EMA (only if we have a previous interaction)
    if (lastTime > 0 && gapMs > 0) {
      if (typicalGapMs === 0) {
        // Bootstrap: first gap becomes the initial estimate
        typicalGapMs = gapMs;
      } else {
        typicalGapMs = typicalGapMs * (1 - config.gapEmaAlpha) + gapMs * config.gapEmaAlpha;
      }

      // Compute temporal surprise: how unexpected is this gap?
      const temporalSurprise = typicalGapMs > 0 ? gapMs / typicalGapMs : 1;

      // Emit long-absence event if gap >> typical
      if (temporalSurprise >= config.longAbsenceMultiplier && gapMs > 60 * 1000) {
        bus.emit("temporal:long-absence", {
          gapMs,
          subjectiveGap: temporalSurprise,
          temporalSurprise,
        });

        log?.info(
          `BrainAgent TemporalAwareness: long absence detected ` +
            `(gap=${formatDuration(gapMs)}, typical=${formatDuration(typicalGapMs)}, ` +
            `surprise=${temporalSurprise.toFixed(1)}x)`,
        );
      }
    }

    // Compute interaction density (interactions per day over the density window)
    const density = computeDensity(now);
    if (density >= config.highDensityThreshold) {
      bus.emit("temporal:frequent-engagement", { density });

      log?.info(
        `BrainAgent TemporalAwareness: frequent engagement ` +
          `(density=${density.toFixed(1)} interactions/day)`,
      );
    }

    persistState();
  }

  function getStats(): TemporalAwarenessStats {
    const now = Date.now();
    const lastTime = timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0;
    const currentGapMs = lastTime > 0 ? now - lastTime : 0;
    const temporalSurprise = typicalGapMs > 0 ? currentGapMs / typicalGapMs : 1;

    return {
      typicalGapMs,
      lastInteractionTime: lastTime,
      currentGapMs,
      interactionDensity: computeDensity(now),
      totalInteractions,
      temporalSurprise,
    };
  }

  /**
   * Build a context string for injection into the agent's prompt.
   * Describes the temporal relationship between interactions.
   */
  function buildContext(): string | null {
    if (timestamps.length < 2) return null;

    const now = Date.now();
    const lastTime = timestamps[timestamps.length - 1];
    const currentGapMs = now - lastTime;

    // Only inject if there's something noteworthy
    const temporalSurprise = typicalGapMs > 0 ? currentGapMs / typicalGapMs : 1;
    const density = computeDensity(now);

    const lines: string[] = [];

    // Long absence context
    if (temporalSurprise >= config.longAbsenceMultiplier && currentGapMs > 60 * 1000) {
      lines.push(
        `It has been ${formatDuration(currentGapMs)} since the last interaction ` +
          `(typical gap: ${formatDuration(typicalGapMs)}).`,
      );
    }

    // High engagement context
    if (density >= config.highDensityThreshold) {
      lines.push("Active conversation — we've been talking frequently.");
    }

    if (lines.length === 0) return null;

    return `## Temporal Awareness\n${lines.join("\n")}`;
  }

  log?.info(
    `BrainAgent TemporalAwareness: initialized (typicalGap=${formatDuration(typicalGapMs)}, ` +
      `interactions=${totalInteractions})`,
  );

  return {
    recordInteraction,
    getStats,
    buildContext,
    stop: () => {
      persistState();
      log?.info("BrainAgent TemporalAwareness: stopped.");
    },
    dispose: () => {
      persistState();
    },
  };
}

// ── Активный инстанс (слот) ───────────────────────────────────────

let active: TemporalAwarenessInstance | undefined;

// ── Совместимый API ───────────────────────────────────────────────

export function initTemporalAwareness(
  workspaceDir: string,
  cfg: BrainAgentConfig,
  log?: { info: (msg: string) => void },
): void {
  active?.dispose();
  active = createTemporalAwareness(workspaceDir, cfg, log);
}

export function stopTemporalAwareness(): void {
  active?.stop();
  active = undefined;
}

/**
 * Record a new interaction and evaluate temporal patterns.
 * До инициализации — no-op.
 */
export function recordInteraction(): void {
  active?.recordInteraction();
}

export function getTemporalAwarenessStats(): TemporalAwarenessStats {
  return (
    active?.getStats() ?? {
      typicalGapMs: 0,
      lastInteractionTime: 0,
      currentGapMs: 0,
      interactionDensity: 0,
      totalInteractions: 0,
      temporalSurprise: 1,
    }
  );
}

/**
 * Build a context string for injection into the agent's prompt.
 * Describes the temporal relationship between interactions.
 */
export function buildTemporalContext(): string | null {
  return active?.buildContext() ?? null;
}

// ── Utility ───────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60 * 1000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 60 * 60 * 1000) return `${(ms / (60 * 60 * 1000)).toFixed(0)}m`;
  if (ms < 24 * 60 * 60 * 1000) return `${(ms / (60 * 60 * 1000)).toFixed(1)}h`;
  return `${(ms / (24 * 60 * 60 * 1000)).toFixed(1)}d`;
}
