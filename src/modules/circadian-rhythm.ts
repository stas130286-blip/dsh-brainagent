/**
 * Circadian Rhythm — Sleep-Wake Cycles for the cognitive architecture.
 *
 * In the human brain, circadian rhythms regulate:
 * - When we're alert vs drowsy (cortisol/melatonin cycles)
 * - Memory consolidation (primarily during sleep)
 * - Learning plasticity (higher during wakefulness)
 * - Energy allocation (active during wake, restorative during sleep)
 *
 * This module implements analogous cycles:
 *
 * WAKE PHASE (Active Learning):
 * - Higher dopamine baseline → more motivation/reward sensitivity
 * - Higher serotonin → more exploratory behavior
 * - Higher acetylcholine → faster learning rate
 * - More frequent memory retrieval
 * - Active habit formation and pattern detection
 *
 * SLEEP PHASE (Consolidation):
 * - Lower neuromodulator levels → conservation mode
 * - Memory consolidation (dream mode integration)
 * - Pruning of weak memories and synapses
 * - Synaptic weight normalization
 * - Structural plasticity (pathway pruning)
 *
 * TRANSITIONS:
 * - Gradual transitions between phases (not binary)
 * - Activity-based detection (idle = sleep, interaction = wake)
 * - Minimum durations prevent rapid cycling
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bus } from "./event-bus.ts";
import type { BrainAgentConfig, CircadianPhase, CircadianState } from "./types.ts";

// ── State ───────────────────────────────────────────────────────────

let storageDir = "";
let currentConfig: BrainAgentConfig | null = null;
let logger: { info: (msg: string) => void; warn: (msg: string) => void } | undefined;

/** Current circadian state */
let state: CircadianState = createDefaultState();

/** Timestamp of last user activity */
let lastActivityTime = Date.now();

/** Activity counter within current window */
let activityCounter = 0;

/** Timer for periodic phase evaluation */
let evaluationTimer: ReturnType<typeof setInterval> | null = null;

/** Callback to trigger consolidation (set by dream-mode integration) */
let consolidationCallback: (() => Promise<void>) | null = null;

/** Maximum consolidation cycles per sleep session to avoid wasting LLM tokens. */
let maxSleepConsolidations = 5;

// ── Initialization ──────────────────────────────────────────────────

function createDefaultState(): CircadianState {
  return {
    phase: "wake",
    phaseProgress: 0,
    phaseStartedAt: Date.now(),
    idleTime: 0,
    activityLevel: 1.0,
    wakeInteractions: 0,
    sleepConsolidations: 0,
    wakeModulation: {
      dopamineBoost: 1.0,
      serotoninBoost: 1.0,
      acetylcholineBoost: 1.0,
      norepinephrineBoost: 1.0,
    },
    sleepSettings: {
      consolidationIntensity: 0.5,
      pruningAggressiveness: 0.3,
      synapticNormalization: false,
    },
  };
}

/**
 * Initialize the circadian rhythm system.
 */
export function initCircadianRhythm(
  workspaceDir: string,
  config: BrainAgentConfig,
  log?: { info: (msg: string) => void; warn: (msg: string) => void },
): void {
  storageDir = join(workspaceDir, ".brainagent", "circadian");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  currentConfig = config;
  logger = log;
  maxSleepConsolidations = config.circadian.maxSleepConsolidations ?? 5;

  // Reset to defaults before loading persisted state
  state = createDefaultState();
  loadState();
  updateModulationFromPhase();

  // Start periodic evaluation
  if (evaluationTimer) {
    clearInterval(evaluationTimer);
  }
  const evalInterval = config.circadian.evaluationIntervalMs ?? 30_000;
  evaluationTimer = setInterval(() => evaluatePhase(), evalInterval);

  logger?.info(
    `Circadian: initialized in ${state.phase} phase (idle threshold: ${config.circadian.idleThresholdMs / 1000}s)`,
  );
}

/**
 * Stop the circadian rhythm system.
 */
export function stopCircadianRhythm(): void {
  if (evaluationTimer) {
    clearInterval(evaluationTimer);
    evaluationTimer = null;
  }
  persistState();
}

/**
 * Register a consolidation callback (called by dream-mode).
 */
export function setConsolidationCallback(callback: () => Promise<void>): void {
  consolidationCallback = callback;
}

// ── State Persistence ───────────────────────────────────────────────

function loadState(): void {
  if (!storageDir) return;
  try {
    const path = join(storageDir, "state.json");
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, "utf-8")) as Partial<CircadianState>;
      // Merge with defaults (in case new fields were added)
      state = { ...createDefaultState(), ...data };
      // Reset timing on load (fresh session)
      state.phaseStartedAt = Date.now();
      state.idleTime = 0;
      lastActivityTime = Date.now();
    }
  } catch {
    // Fresh start
  }
}

function persistState(): void {
  if (!storageDir) return;
  try {
    writeFileSync(join(storageDir, "state.json"), JSON.stringify(state, null, 2), "utf-8");
  } catch {
    /* non-critical */
  }
}

// ── Core Phase Evaluation ───────────────────────────────────────────

/**
 * Evaluate current state and determine if a phase transition is needed.
 * Called periodically by the evaluation timer.
 */
function evaluatePhase(): void {
  if (!currentConfig?.circadian.enabled) return;

  const now = Date.now();
  const idleTime = now - lastActivityTime;
  state.idleTime = idleTime;

  // Calculate activity level (decays over time)
  const activityWindow = currentConfig.circadian.activityWindowMs;
  state.activityLevel = Math.max(0, 1 - idleTime / activityWindow);

  const phaseDuration = now - state.phaseStartedAt;
  const { idleThresholdMs, minWakeDurationMs, minSleepDurationMs, transitionDurationMs } =
    currentConfig.circadian;

  switch (state.phase) {
    case "wake":
      // Check if we should start transitioning to sleep
      if (idleTime >= idleThresholdMs && phaseDuration >= minWakeDurationMs) {
        transitionTo("transition-to-sleep");
      }
      break;

    case "transition-to-sleep":
      // Update progress through transition
      state.phaseProgress = Math.min(1, phaseDuration / transitionDurationMs);
      updateModulationFromPhase();

      // Activity during transition resets to wake
      if (activityCounter > 0) {
        activityCounter = 0;
        transitionTo("wake");
      } else if (state.phaseProgress >= 1) {
        transitionTo("sleep");
      }
      break;

    case "sleep":
      // During sleep, trigger consolidation periodically
      if (
        consolidationCallback &&
        phaseDuration > 30_000 &&
        state.sleepConsolidations < maxSleepConsolidations
      ) {
        const consolidationInterval =
          currentConfig?.circadian.sleepConsolidationIntervalMs ?? 60_000;
        const triggerWindow = consolidationInterval / 3;
        const shouldConsolidate =
          phaseDuration % consolidationInterval < triggerWindow && state.sleepConsolidations === 0;
        if (
          shouldConsolidate ||
          phaseDuration > state.sleepConsolidations * consolidationInterval
        ) {
          void triggerSleepConsolidation();
        }
      }

      // Check if activity wakes us up
      if (activityCounter > 0 && phaseDuration >= minSleepDurationMs) {
        activityCounter = 0;
        transitionTo("transition-to-wake");
      }
      break;

    case "transition-to-wake":
      // Update progress through transition
      state.phaseProgress = Math.min(1, phaseDuration / transitionDurationMs);
      updateModulationFromPhase();

      if (state.phaseProgress >= 1) {
        transitionTo("wake");
      }
      break;
  }
}

/**
 * Transition to a new phase.
 */
function transitionTo(newPhase: CircadianPhase): void {
  const oldPhase = state.phase;
  if (oldPhase === newPhase) return;

  logger?.info(`Circadian: ${oldPhase} → ${newPhase}`);

  state.phase = newPhase;
  state.phaseStartedAt = Date.now();
  state.phaseProgress = 0;

  // Reset counters on major phase changes
  if (newPhase === "wake") {
    state.wakeInteractions = 0;
    bus.emitSync("circadian:wake-started", { idleTime: state.idleTime });
  } else if (newPhase === "sleep") {
    state.sleepConsolidations = 0;
    bus.emitSync("circadian:sleep-started", { wakeInteractions: state.wakeInteractions });
  }

  updateModulationFromPhase();
  bus.emitSync("circadian:phase-changed", { oldPhase, newPhase });
  persistState();
}

/**
 * Update neuromodulator modulation based on current phase.
 */
function updateModulationFromPhase(): void {
  if (!currentConfig) return;

  const cfg = currentConfig.circadian;

  switch (state.phase) {
    case "wake":
      // Full wake modulation
      state.wakeModulation = {
        dopamineBoost: cfg.wakeDopamineBoost,
        serotoninBoost: cfg.wakeSerotoninBoost,
        acetylcholineBoost: cfg.wakeAcetylcholineBoost,
        norepinephrineBoost: 1.1, // Slightly elevated attention
      };
      state.sleepSettings = {
        consolidationIntensity: 0.3, // Light background consolidation
        pruningAggressiveness: 0.1,
        synapticNormalization: false,
      };
      break;

    case "transition-to-sleep": {
      // Gradual reduction toward sleep levels
      const sm1 = cfg.sleepModulation ?? {
        dopamine: 0.7,
        serotonin: 0.8,
        acetylcholine: 0.6,
        norepinephrine: 0.4,
      };
      const sleepProgress = state.phaseProgress;
      state.wakeModulation = {
        dopamineBoost: lerp(cfg.wakeDopamineBoost, sm1.dopamine, sleepProgress),
        serotoninBoost: lerp(cfg.wakeSerotoninBoost, sm1.serotonin, sleepProgress),
        acetylcholineBoost: lerp(cfg.wakeAcetylcholineBoost, sm1.acetylcholine, sleepProgress),
        norepinephrineBoost: lerp(1.1, sm1.norepinephrine, sleepProgress),
      };
      state.sleepSettings = {
        consolidationIntensity: lerp(0.3, cfg.sleepConsolidationIntensity, sleepProgress),
        pruningAggressiveness: lerp(0.1, cfg.sleepPruningAggressiveness, sleepProgress),
        synapticNormalization: sleepProgress > 0.7,
      };
      break;
    }

    case "sleep": {
      // Full sleep modulation (conservation mode) — from config
      const sm = cfg.sleepModulation ?? {
        dopamine: 0.7,
        serotonin: 0.8,
        acetylcholine: 0.6,
        norepinephrine: 0.4,
      };
      state.wakeModulation = {
        dopamineBoost: sm.dopamine,
        serotoninBoost: sm.serotonin,
        acetylcholineBoost: sm.acetylcholine,
        norepinephrineBoost: sm.norepinephrine,
      };
      state.sleepSettings = {
        consolidationIntensity: cfg.sleepConsolidationIntensity,
        pruningAggressiveness: cfg.sleepPruningAggressiveness,
        synapticNormalization: true,
      };
      break;
    }

    case "transition-to-wake": {
      // Gradual increase toward wake levels
      const sm2 = cfg.sleepModulation ?? {
        dopamine: 0.7,
        serotonin: 0.8,
        acetylcholine: 0.6,
        norepinephrine: 0.4,
      };
      const wakeProgress = state.phaseProgress;
      state.wakeModulation = {
        dopamineBoost: lerp(sm2.dopamine, cfg.wakeDopamineBoost, wakeProgress),
        serotoninBoost: lerp(sm2.serotonin, cfg.wakeSerotoninBoost, wakeProgress),
        acetylcholineBoost: lerp(sm2.acetylcholine, cfg.wakeAcetylcholineBoost, wakeProgress),
        norepinephrineBoost: lerp(sm2.norepinephrine, 1.1, wakeProgress),
      };
      state.sleepSettings = {
        consolidationIntensity: lerp(cfg.sleepConsolidationIntensity, 0.3, wakeProgress),
        pruningAggressiveness: lerp(cfg.sleepPruningAggressiveness, 0.1, wakeProgress),
        synapticNormalization: wakeProgress < 0.5,
      };
      break;
    }
  }
}

/**
 * Linear interpolation helper.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Trigger consolidation during sleep phase.
 */
async function triggerSleepConsolidation(): Promise<void> {
  if (!consolidationCallback) return;

  state.sleepConsolidations++;
  logger?.info(
    `Circadian: sleep consolidation #${state.sleepConsolidations} (intensity: ${(state.sleepSettings.consolidationIntensity * 100).toFixed(0)}%)`,
  );

  try {
    await consolidationCallback();
  } catch (err) {
    logger?.warn(`Circadian: consolidation error — ${String(err)}`);
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Record user activity (called on each interaction).
 * This keeps the system in wake phase during active use.
 */
export function recordActivity(): void {
  lastActivityTime = Date.now();
  activityCounter++;
  state.wakeInteractions++;

  bus.emitSync("circadian:activity-detected", { activityLevel: state.activityLevel });

  // If we're in sleep or transitioning to sleep, wake up
  if (state.phase === "sleep" || state.phase === "transition-to-sleep") {
    const phaseDuration = Date.now() - state.phaseStartedAt;
    const minSleep = currentConfig?.circadian.minSleepDurationMs ?? 60_000;

    if (state.phase === "transition-to-sleep" || phaseDuration >= minSleep) {
      transitionTo("transition-to-wake");
    }
  }
}

/**
 * Get current circadian state for diagnostics.
 */
export function getCircadianState(): CircadianState {
  return { ...state };
}

/**
 * Get neuromodulator multipliers based on current circadian phase.
 * Other modules use these to modulate their behavior.
 */
export function getCircadianModulation(): {
  dopamine: number;
  serotonin: number;
  acetylcholine: number;
  norepinephrine: number;
} {
  return {
    dopamine: state.wakeModulation.dopamineBoost,
    serotonin: state.wakeModulation.serotoninBoost,
    acetylcholine: state.wakeModulation.acetylcholineBoost,
    norepinephrine: state.wakeModulation.norepinephrineBoost,
  };
}

/**
 * Get sleep settings for consolidation modules.
 */
export function getSleepSettings(): {
  consolidationIntensity: number;
  pruningAggressiveness: number;
  synapticNormalization: boolean;
} {
  return { ...state.sleepSettings };
}

/**
 * Check if currently in a sleep-related phase.
 */
export function isInSleepPhase(): boolean {
  return state.phase === "sleep" || state.phase === "transition-to-sleep";
}

/**
 * Check if currently in a wake-related phase.
 */
export function isInWakePhase(): boolean {
  return state.phase === "wake" || state.phase === "transition-to-wake";
}

/**
 * Force a specific phase (for testing/commands).
 */
export function forcePhase(phase: CircadianPhase): void {
  logger?.info(`Circadian: forced phase change to ${phase}`);
  transitionTo(phase);
}

/**
 * Get diagnostic statistics.
 */
export function getCircadianStats(): {
  phase: CircadianPhase;
  phaseProgress: number;
  phaseDuration: number;
  idleTime: number;
  activityLevel: number;
  wakeInteractions: number;
  sleepConsolidations: number;
  modulation: {
    dopamine: number;
    serotonin: number;
    acetylcholine: number;
    norepinephrine: number;
  };
  sleepSettings: {
    consolidationIntensity: number;
    pruningAggressiveness: number;
    synapticNormalization: boolean;
  };
} {
  return {
    phase: state.phase,
    phaseProgress: state.phaseProgress,
    phaseDuration: Date.now() - state.phaseStartedAt,
    idleTime: state.idleTime,
    activityLevel: state.activityLevel,
    wakeInteractions: state.wakeInteractions,
    sleepConsolidations: state.sleepConsolidations,
    modulation: {
      dopamine: state.wakeModulation.dopamineBoost,
      serotonin: state.wakeModulation.serotoninBoost,
      acetylcholine: state.wakeModulation.acetylcholineBoost,
      norepinephrine: state.wakeModulation.norepinephrineBoost,
    },
    sleepSettings: { ...state.sleepSettings },
  };
}
