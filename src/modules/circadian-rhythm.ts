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

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWrite } from "./persist.ts";
import { bus } from "./event-bus.ts";
import type { BrainAgentConfig, CircadianPhase, CircadianState } from "./types.ts";

// ── Types ───────────────────────────────────────────────────────────

export type CircadianRhythmInstance = {
  /** Записать активность пользователя. */
  recordActivity(): void;
  /** Текущее циркадное состояние (копия). */
  getState(): CircadianState;
  /** Множители нейромодуляторов для текущей фазы. */
  getModulation(): { dopamine: number; serotonin: number; acetylcholine: number; norepinephrine: number };
  /** Настройки сна для модулей консолидации. */
  getSleepSettings(): { consolidationIntensity: number; pruningAggressiveness: number; synapticNormalization: boolean };
  /** Фаза сна (включая переход в сон). */
  isInSleepPhase(): boolean;
  /** Фаза бодрствования (включая пробуждение). */
  isInWakePhase(): boolean;
  /** Принудительная смена фазы (тесты/команды). */
  forcePhase(phase: CircadianPhase): void;
  /** Диагностика. */
  getStats(): {
    phase: CircadianPhase;
    phaseProgress: number;
    phaseDuration: number;
    idleTime: number;
    activityLevel: number;
    wakeInteractions: number;
    sleepConsolidations: number;
    modulation: { dopamine: number; serotonin: number; acetylcholine: number; norepinephrine: number };
    sleepSettings: { consolidationIntensity: number; pruningAggressiveness: number; synapticNormalization: boolean };
  };
  /** Задать callback консолидации (вызывается dream-mode). */
  setConsolidationCallback(callback: () => Promise<void>): void;
  /** Остановить таймер и сохранить состояние. */
  stop(): void;
  /** Тихий вариант stop (для замены инстанса). */
  dispose(): void;
};

// ── Фабрика ─────────────────────────────────────────────────────────

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

export function createCircadianRhythm(
  workspaceDir: string,
  config: BrainAgentConfig,
  log?: { info: (msg: string) => void; warn: (msg: string) => void },
): CircadianRhythmInstance {
  const storageDir = join(workspaceDir, ".brainagent", "circadian");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  const maxSleepConsolidations = config.circadian.maxSleepConsolidations ?? 5;

  /** Current circadian state */
  let state: CircadianState = createDefaultState();

  /** Timestamp of last user activity */
  let lastActivityTime = Date.now();

  /** Activity counter within current window */
  let activityCounter = 0;

  /** Callback to trigger consolidation (set by dream-mode integration) */
  let consolidationCallback: (() => Promise<void>) | null = null;

  // ── State Persistence ─────────────────────────────────────────────

  function loadState(): void {
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
    try {
      atomicWrite(join(storageDir, "state.json"), JSON.stringify(state, null, 2));
    } catch {
      /* non-critical */
    }
  }

  // ── Core Phase Evaluation ─────────────────────────────────────────

  /**
   * Evaluate current state and determine if a phase transition is needed.
   * Called periodically by the evaluation timer.
   */
  function evaluatePhase(): void {
    if (!config.circadian.enabled) return;

    const now = Date.now();
    const idleTime = now - lastActivityTime;
    state.idleTime = idleTime;

    // Calculate activity level (decays over time)
    const activityWindow = config.circadian.activityWindowMs;
    state.activityLevel = Math.max(0, 1 - idleTime / activityWindow);

    const phaseDuration = now - state.phaseStartedAt;
    const { idleThresholdMs, minWakeDurationMs, minSleepDurationMs, transitionDurationMs } =
      config.circadian;

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
          const consolidationInterval = config.circadian.sleepConsolidationIntervalMs ?? 60_000;
          const triggerWindow = consolidationInterval / 3;
          const shouldConsolidate =
            phaseDuration % consolidationInterval < triggerWindow &&
            state.sleepConsolidations === 0;
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

    log?.info(`Circadian: ${oldPhase} → ${newPhase}`);

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
    const cfg = config.circadian;

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
   * Trigger consolidation during sleep phase.
   */
  async function triggerSleepConsolidation(): Promise<void> {
    if (!consolidationCallback) return;

    state.sleepConsolidations++;
    log?.info(
      `Circadian: sleep consolidation #${state.sleepConsolidations} (intensity: ${(state.sleepSettings.consolidationIntensity * 100).toFixed(0)}%)`,
    );

    try {
      await consolidationCallback();
    } catch (err) {
      log?.warn(`Circadian: consolidation error — ${String(err)}`);
    }
  }

  // ── Init sequence ─────────────────────────────────────────────────

  loadState();
  updateModulationFromPhase();

  // Start periodic evaluation
  const evalInterval = config.circadian.evaluationIntervalMs ?? 30_000;
  const evaluationTimer = setInterval(() => evaluatePhase(), evalInterval);

  log?.info(
    `Circadian: initialized in ${state.phase} phase (idle threshold: ${config.circadian.idleThresholdMs / 1000}s)`,
  );

  function stopTimer(): void {
    clearInterval(evaluationTimer);
  }

  // ── Public API ────────────────────────────────────────────────────

  return {
    recordActivity: () => {
      lastActivityTime = Date.now();
      activityCounter++;
      state.wakeInteractions++;

      bus.emitSync("circadian:activity-detected", { activityLevel: state.activityLevel });

      // If we're in sleep or transitioning to sleep, wake up
      if (state.phase === "sleep" || state.phase === "transition-to-sleep") {
        const phaseDuration = Date.now() - state.phaseStartedAt;
        const minSleep = config.circadian.minSleepDurationMs ?? 60_000;

        if (state.phase === "transition-to-sleep" || phaseDuration >= minSleep) {
          transitionTo("transition-to-wake");
        }
      }
    },
    getState: () => ({ ...state }),
    getModulation: () => ({
      dopamine: state.wakeModulation.dopamineBoost,
      serotonin: state.wakeModulation.serotoninBoost,
      acetylcholine: state.wakeModulation.acetylcholineBoost,
      norepinephrine: state.wakeModulation.norepinephrineBoost,
    }),
    getSleepSettings: () => ({ ...state.sleepSettings }),
    isInSleepPhase: () => state.phase === "sleep" || state.phase === "transition-to-sleep",
    isInWakePhase: () => state.phase === "wake" || state.phase === "transition-to-wake",
    forcePhase: (phase) => {
      log?.info(`Circadian: forced phase change to ${phase}`);
      transitionTo(phase);
    },
    getStats: () => ({
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
    }),
    setConsolidationCallback: (callback) => {
      consolidationCallback = callback;
    },
    stop: () => {
      stopTimer();
      persistState();
    },
    dispose: () => {
      stopTimer();
      persistState();
    },
  };
}

// ── Активный инстанс (слот) ─────────────────────────────────────────

let active: CircadianRhythmInstance | undefined;

/**
 * Callback, зарегистрированный до (пере-)инициализации инстанса —
 * dream-mode регистрируется один раз при старте плагина.
 */
let pendingConsolidationCallback: (() => Promise<void>) | undefined;

// ── Совместимый API ─────────────────────────────────────────────────

/**
 * Initialize the circadian rhythm system.
 */
export function initCircadianRhythm(
  workspaceDir: string,
  config: BrainAgentConfig,
  log?: { info: (msg: string) => void; warn: (msg: string) => void },
): void {
  active?.dispose();
  active = createCircadianRhythm(workspaceDir, config, log);
  if (pendingConsolidationCallback) {
    active.setConsolidationCallback(pendingConsolidationCallback);
  }
}

/**
 * Stop the circadian rhythm system.
 */
export function stopCircadianRhythm(): void {
  active?.stop();
  active = undefined;
}

/**
 * Register a consolidation callback (called by dream-mode).
 */
export function setConsolidationCallback(callback: () => Promise<void>): void {
  pendingConsolidationCallback = callback;
  active?.setConsolidationCallback(callback);
}

/**
 * Record user activity (called on each interaction).
 * This keeps the system in wake phase during active use.
 * До инициализации — no-op.
 */
export function recordActivity(): void {
  active?.recordActivity();
}

/**
 * Get current circadian state for diagnostics.
 */
export function getCircadianState(): CircadianState {
  return active?.getState() ?? createDefaultState();
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
  return (
    active?.getModulation() ?? {
      dopamine: 1.0,
      serotonin: 1.0,
      acetylcholine: 1.0,
      norepinephrine: 1.0,
    }
  );
}

/**
 * Get sleep settings for consolidation modules.
 */
export function getSleepSettings(): {
  consolidationIntensity: number;
  pruningAggressiveness: number;
  synapticNormalization: boolean;
} {
  return (
    active?.getSleepSettings() ?? {
      consolidationIntensity: 0.5,
      pruningAggressiveness: 0.3,
      synapticNormalization: false,
    }
  );
}

/**
 * Check if currently in a sleep-related phase.
 */
export function isInSleepPhase(): boolean {
  return active?.isInSleepPhase() ?? false;
}

/**
 * Check if currently in a wake-related phase.
 */
export function isInWakePhase(): boolean {
  return active?.isInWakePhase() ?? true;
}

/**
 * Force a specific phase (for testing/commands).
 * До инициализации — no-op.
 */
export function forcePhase(phase: CircadianPhase): void {
  active?.forcePhase(phase);
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
  const st = active?.getState() ?? createDefaultState();
  return {
    phase: st.phase,
    phaseProgress: st.phaseProgress,
    phaseDuration: Date.now() - st.phaseStartedAt,
    idleTime: st.idleTime,
    activityLevel: st.activityLevel,
    wakeInteractions: st.wakeInteractions,
    sleepConsolidations: st.sleepConsolidations,
    modulation: {
      dopamine: st.wakeModulation.dopamineBoost,
      serotonin: st.wakeModulation.serotoninBoost,
      acetylcholine: st.wakeModulation.acetylcholineBoost,
      norepinephrine: st.wakeModulation.norepinephrineBoost,
    },
    sleepSettings: { ...st.sleepSettings },
  };
}

// ── Utility ─────────────────────────────────────────────────────────

/**
 * Linear interpolation helper.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
