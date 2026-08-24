/**
 * Dream Mode — Background memory consolidation service.
 *
 * During sleep, the human brain replays the day's events, strengthens
 * important neural connections, prunes weak ones, and transfers
 * short-term memories to long-term storage.
 *
 * Dream Mode runs periodically when the user is idle:
 * 1. Consolidates episodic → semantic memory (extract facts from events)
 * 2. Decays unused memories (forgetting curve)
 * 3. Detects contradictions between facts
 * 4. Strengthens frequently-accessed memories
 * 5. Prunes memories that exceed storage limits
 *
 * Integration with Circadian Rhythm:
 * - During WAKE phase: light background consolidation
 * - During SLEEP phase: intensive consolidation triggered by circadian system
 * - Consolidation intensity modulated by circadian sleepSettings
 *
 * v0.6.8: фабрика createDreamMode() с per-instance состоянием;
 * свободные функции — тонкие обёртки над слотом активного инстанса.
 */

import type { HostConfig as NeuroClawConfig } from "./host-config.ts";
import { setConsolidationCallback, getSleepSettings, isInSleepPhase } from "./circadian-rhythm.ts";
import { bus } from "./event-bus.ts";
import { consolidate, getSemanticVersion } from "./hippocampus.ts";
import type { BrainAgentConfig } from "./types.ts";

type DreamLogger = { info: (msg: string) => void };

export interface ConsolidationResult {
  merged: number;
  pruned: number;
  strengthened: number;
  contradictions: number;
  revised: number;
}

export interface DreamModeInstance {
  start: (
    config: BrainAgentConfig,
    logger?: DreamLogger,
    neuroClawConfig?: NeuroClawConfig,
  ) => void;
  stop: () => void;
  forceConsolidation: (
    config: BrainAgentConfig,
    logger?: DreamLogger,
    neuroClawConfig?: NeuroClawConfig,
    intensity?: number,
  ) => Promise<ConsolidationResult>;
  getStats: () => {
    isRunning: boolean;
    lastConsolidation: number;
    isConsolidating: boolean;
    circadianIntegrated: boolean;
    currentIntensity: number;
  };
}

/**
 * Create a Dream Mode service instance with its own state.
 * Все состояние (таймер, флаги, версия последней консолидации) живёт в замыкании.
 */
export function createDreamMode(): DreamModeInstance {
  let dreamInterval: ReturnType<typeof setInterval> | null = null;
  let isConsolidating = false;
  let lastConsolidation = 0;
  /** Semantic store version at last consolidation; -1 = first run always does full AI review. */
  let lastConsolidatedVersion = -1;

  /** Store references for circadian callback */
  let storedConfig: BrainAgentConfig | null = null;
  let storedLogger: DreamLogger | undefined;
  let storedNeuroClawConfig: NeuroClawConfig | undefined;

  /**
   * Run a single consolidation cycle.
   * @param circadianTriggered - If true, this consolidation was triggered by
   *        the circadian system during sleep phase, so use sleep settings.
   */
  async function runConsolidation(
    config: BrainAgentConfig,
    logger?: DreamLogger,
    neuroClawConfig?: NeuroClawConfig,
    circadianTriggered = false,
  ): Promise<void> {
    if (isConsolidating) return; // Prevent overlapping runs
    isConsolidating = true;

    try {
      // Get consolidation settings from circadian system
      const sleepSettings = getSleepSettings();
      const inSleep = isInSleepPhase();

      // Determine consolidation intensity
      // During circadian sleep: use full intensity
      // During regular interval: use reduced intensity (background)
      const intensityMultiplier =
        circadianTriggered || inSleep ? sleepSettings.consolidationIntensity : 0.3; // Light background consolidation

      // Skip AI review when circadian-triggered and semantic memory hasn't changed
      const currentVersion = getSemanticVersion();
      const skipAI = circadianTriggered && currentVersion === lastConsolidatedVersion;

      const result = await consolidate(config, neuroClawConfig, logger, intensityMultiplier, skipAI);
      lastConsolidation = Date.now();
      lastConsolidatedVersion = currentVersion;

      if (
        result.merged > 0 ||
        result.pruned > 0 ||
        result.strengthened > 0 ||
        result.contradictions > 0 ||
        result.revised > 0
      ) {
        const source = circadianTriggered ? "sleep-cycle" : "interval";
        logger?.info(
          `BrainAgent DreamMode [${source}]: consolidated — merged=${result.merged}, pruned=${result.pruned}, strengthened=${result.strengthened}, contradictions=${result.contradictions}, revised=${result.revised}`,
        );
      }

      bus.emit("dream:consolidation-complete", result);
    } catch (err) {
      logger?.info(`BrainAgent DreamMode: error during consolidation — ${String(err)}`);
    } finally {
      isConsolidating = false;
    }
  }

  function start(
    config: BrainAgentConfig,
    logger?: DreamLogger,
    neuroClawConfig?: NeuroClawConfig,
  ): void {
    if (dreamInterval) return; // Already running

    // Store references for circadian callback
    storedConfig = config;
    storedLogger = logger;
    storedNeuroClawConfig = neuroClawConfig;

    const intervalMs = config.memory.dreamIntervalMinutes * 60 * 1000;

    logger?.info(
      `BrainAgent DreamMode: starting (interval: ${config.memory.dreamIntervalMinutes}min)`,
    );

    // Register with circadian system for sleep-triggered consolidation
    if (config.circadian?.enabled) {
      setConsolidationCallback(async () => {
        await runConsolidation(config, logger, neuroClawConfig, true);
      });
      logger?.info("BrainAgent DreamMode: registered with circadian rhythm system");
    }

    // Run initial consolidation after a brief warmup
    setTimeout(() => void runConsolidation(config, logger, neuroClawConfig, false), 30_000);

    dreamInterval = setInterval(() => {
      void runConsolidation(config, logger, neuroClawConfig, false);
    }, intervalMs);
  }

  function stop(): void {
    if (dreamInterval) {
      clearInterval(dreamInterval);
      dreamInterval = null;
    }
    storedConfig = null;
    storedLogger = undefined;
    storedNeuroClawConfig = undefined;
    lastConsolidatedVersion = -1;
  }

  async function forceConsolidation(
    config: BrainAgentConfig,
    logger?: DreamLogger,
    neuroClawConfig?: NeuroClawConfig,
    intensity?: number,
  ): Promise<ConsolidationResult> {
    // Use provided intensity or get from circadian settings
    const sleepSettings = getSleepSettings();
    const effectiveIntensity = intensity ?? sleepSettings.consolidationIntensity;

    const result = await consolidate(config, neuroClawConfig, logger, effectiveIntensity);
    lastConsolidation = Date.now();

    if (logger) {
      logger.info(
        `BrainAgent DreamMode: forced consolidation (intensity: ${(effectiveIntensity * 100).toFixed(0)}%) — merged=${result.merged}, pruned=${result.pruned}, strengthened=${result.strengthened}, contradictions=${result.contradictions}, revised=${result.revised}`,
      );
    }

    bus.emit("dream:consolidation-complete", result);
    return result;
  }

  function getStats() {
    const sleepSettings = getSleepSettings();
    return {
      isRunning: dreamInterval !== null,
      lastConsolidation,
      isConsolidating,
      circadianIntegrated: storedConfig?.circadian?.enabled ?? false,
      currentIntensity: sleepSettings.consolidationIntensity,
    };
  }

  return { start, stop, forceConsolidation, getStats };
}

// ── Active instance slot + тонкие обёртки (внешний API сохранён) ────

let active: DreamModeInstance | null = null;

function current(): DreamModeInstance {
  if (!active) active = createDreamMode();
  return active;
}

/**
 * Start the dream mode background service.
 * Runs consolidation at the configured interval.
 * Also registers with circadian system for sleep-triggered consolidation.
 */
export function startDreamMode(
  config: BrainAgentConfig,
  logger?: DreamLogger,
  neuroClawConfig?: NeuroClawConfig,
): void {
  current().start(config, logger, neuroClawConfig);
}

/**
 * Stop the dream mode background service.
 */
export function stopDreamMode(): void {
  current().stop();
}

/**
 * Force an immediate consolidation (used by /brainagent dream command).
 * @param intensity - Consolidation intensity (0-1). Default uses circadian settings.
 */
export function forceConsolidation(
  config: BrainAgentConfig,
  logger?: DreamLogger,
  neuroClawConfig?: NeuroClawConfig,
  intensity?: number,
): Promise<ConsolidationResult> {
  return current().forceConsolidation(config, logger, neuroClawConfig, intensity);
}

export function getDreamStats(): {
  isRunning: boolean;
  lastConsolidation: number;
  isConsolidating: boolean;
  circadianIntegrated: boolean;
  currentIntensity: number;
} {
  return current().getStats();
}
