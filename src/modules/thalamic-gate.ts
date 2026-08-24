/**
 * Thalamic Gate — Neural activation threshold for LLM calls.
 *
 * Like the biological thalamus that filters 99% of sensory input before
 * it reaches the cortex, this module decides whether an interval heartbeat
 * warrants an expensive LLM call. User messages and event-driven wakes
 * (vital-impulse, cron, exec) always bypass the gate.
 *
 * The gate reads existing module states (all already expose getters) and
 * computes a composite activation score. Zero LLM cost — pure math.
 *
 * v0.7.0: фабрика createThalamicGate(config?, signalProviders?) — всё состояние
 * в замыкании инстанса; свободные функции — обёртки над активным инстансом.
 * До init работает ленивый detached-инстанс без конфига (gate-disabled bypass) —
 * ровно поведение модульных переменных до initThalamicGate.
 */

import type { AmygdalaAssessment } from "./types.ts";

// ── Types ─────────────────────────────────────────────────────────

export type ThalamicGateConfig = {
  /** Master switch */
  enabled: boolean;
  /** Minimum score to allow an interval heartbeat through (0-1). Default 0.6 */
  activationThreshold: number;
  /** Minimum ms between gate-allowed activations. Default 60_000 */
  minIntervalBetweenActivations: number;
  /** Force-activate after this many consecutive skips (safety valve). Default 30 */
  maxConsecutiveSkips: number;
  /** Per-signal importance weights */
  signalWeights: Record<string, number>;
};

export type ThalamicContext = {
  isUserMessage: boolean;
  isEventDriven: boolean;
  isIntervalHeartbeat: boolean;
};

export type ThalamicSignal = {
  source: string;
  value: number;
  weight: number;
};

export type ThalamicDecision = {
  activate: boolean;
  score: number;
  dominantSignal: string;
  signals: ThalamicSignal[];
};

export type ThalamicGateStats = {
  totalChecks: number;
  totalActivations: number;
  totalSkips: number;
  consecutiveSkips: number;
  lastActivationTime: number;
  lastScore: number;
  lastDominantSignal: string;
};

// ── Signal provider interface ────────────────────────────────────

/**
 * Injected getters for reading module states. Each is optional —
 * the gate degrades gracefully when modules are disabled.
 */
export type SignalProviders = {
  getVitalImpulseStats?: () => { currentPressure: number; effectiveThreshold: number };
  getAmygdalaAssessment?: () => AmygdalaAssessment | undefined;
  getNeuromodulatorState?: () => { norepinephrine: number } | null;
  getSocialDriveSatiation?: () => number;
  getCognitiveHungerSatiation?: () => number;
  getCreativeDriveSatiation?: () => number;
  getMasteryDriveSatiation?: () => number;
  getGoalStackStats?: () => { triggered: number };
  getDMNStats?: () => { unusedInsightCount: number };
};

// ── Instance type ────────────────────────────────────────────────

export type ThalamicGateInstance = {
  shouldActivateCortex(ctx: ThalamicContext, nowMs?: number): ThalamicDecision;
  getStats(): ThalamicGateStats;
  reset(): void;
};

// ── Factory ──────────────────────────────────────────────────────

/**
 * Create a thalamic-gate instance with isolated state.
 * No bus subscriptions, no disk — pure computation over injected getters.
 */
export function createThalamicGate(
  config?: ThalamicGateConfig,
  signalProviders?: SignalProviders,
): ThalamicGateInstance {
  // ── Module state (closure) ───────────────────────────────────────
  let gateConfig: ThalamicGateConfig | undefined = config;
  let providers: SignalProviders = signalProviders ?? {};

  let totalChecks = 0;
  let totalActivations = 0;
  let totalSkips = 0;
  let consecutiveSkips = 0;
  let lastActivationTime = 0;
  let lastScore = 0;
  let lastDominantSignal = "";

  // ── Internal ─────────────────────────────────────────────────────

  function bypass(reason: string): ThalamicDecision {
    return { activate: true, score: 1.0, dominantSignal: reason, signals: [] };
  }

  function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
  }

  function weight(source: string): number {
    return gateConfig?.signalWeights[source] ?? 0.5;
  }

  function collectSignals(): ThalamicSignal[] {
    const signals: ThalamicSignal[] = [];

    // Vital impulse: pressure / threshold ratio (how close to autonomous fire)
    try {
      const vi = providers.getVitalImpulseStats?.();
      if (vi && vi.effectiveThreshold > 0) {
        signals.push({
          source: "vital-impulse",
          value: clamp01(vi.currentPressure / vi.effectiveThreshold),
          weight: weight("vital-impulse"),
        });
      }
    } catch {
      /* module may not be initialized */
    }

    // Amygdala: urgency from last assessment
    try {
      const assessment = providers.getAmygdalaAssessment?.();
      if (assessment) {
        signals.push({
          source: "amygdala-urgency",
          value: assessment.urgency,
          weight: weight("amygdala-urgency"),
        });
      }
    } catch {
      /* module may not be initialized */
    }

    // Norepinephrine: alertness/attention level
    try {
      const neuro = providers.getNeuromodulatorState?.();
      if (neuro) {
        signals.push({
          source: "norepinephrine",
          value: neuro.norepinephrine,
          weight: weight("norepinephrine"),
        });
      }
    } catch {
      /* module may not be initialized */
    }

    // Drive need: inverse of lowest satiation across all drives
    // Low satiation = high need = should activate
    try {
      const satiations: number[] = [];
      const social = providers.getSocialDriveSatiation?.();
      if (social !== undefined) satiations.push(social);
      const cognitive = providers.getCognitiveHungerSatiation?.();
      if (cognitive !== undefined) satiations.push(cognitive);
      const creative = providers.getCreativeDriveSatiation?.();
      if (creative !== undefined) satiations.push(creative);
      const mastery = providers.getMasteryDriveSatiation?.();
      if (mastery !== undefined) satiations.push(mastery);

      if (satiations.length > 0) {
        const lowestSatiation = Math.min(...satiations);
        signals.push({
          source: "drive-need",
          value: clamp01(1 - lowestSatiation),
          weight: weight("drive-need"),
        });
      }
    } catch {
      /* drives may not be initialized */
    }

    // Goal stack: any triggered goals waiting to execute
    try {
      const goals = providers.getGoalStackStats?.();
      if (goals && goals.triggered > 0) {
        signals.push({
          source: "goal-triggered",
          value: 1.0,
          weight: weight("goal-triggered"),
        });
      }
    } catch {
      /* module may not be initialized */
    }

    // DMN: unused high-confidence insights
    try {
      const dmn = providers.getDMNStats?.();
      if (dmn && dmn.unusedInsightCount > 0) {
        signals.push({
          source: "dmn-insight",
          value: clamp01(dmn.unusedInsightCount / 3),
          weight: weight("dmn-insight"),
        });
      }
    } catch {
      /* module may not be initialized */
    }

    return signals;
  }

  // ── Public API ───────────────────────────────────────────────────

  function shouldActivateCortex(ctx: ThalamicContext, nowMs?: number): ThalamicDecision {
    const now = nowMs ?? Date.now();

    // User messages: always activate — never gate real interaction
    if (ctx.isUserMessage) {
      return bypass("user-message");
    }

    // Event-driven (vital-impulse, cron, exec): already gated upstream
    if (ctx.isEventDriven) {
      return bypass("event-driven");
    }

    // Gate is disabled: let everything through
    if (!gateConfig?.enabled) {
      return bypass("gate-disabled");
    }

    totalChecks++;

    // Safety valve: force activate after N consecutive skips so the
    // agent never goes completely silent during long idle periods
    if (consecutiveSkips >= gateConfig.maxConsecutiveSkips) {
      consecutiveSkips = 0;
      lastActivationTime = now;
      totalActivations++;
      lastScore = 0.5;
      lastDominantSignal = "safety-valve";
      return {
        activate: true,
        score: 0.5,
        dominantSignal: "safety-valve",
        signals: [],
      };
    }

    // Cooldown: too soon since last gate-allowed activation
    if (
      lastActivationTime > 0 &&
      now - lastActivationTime < gateConfig.minIntervalBetweenActivations
    ) {
      consecutiveSkips++;
      totalSkips++;
      lastScore = 0;
      lastDominantSignal = "cooldown";
      return {
        activate: false,
        score: 0,
        dominantSignal: "cooldown",
        signals: [],
      };
    }

    // Collect activation signals from module states (zero LLM cost)
    const signals = collectSignals();

    // Score = max weighted signal (a single strong signal is enough)
    const score = signals.length > 0 ? Math.max(...signals.map((s) => s.value * s.weight)) : 0;
    const dominant =
      signals.length > 0
        ? signals.reduce((a, b) => (a.value * a.weight > b.value * b.weight ? a : b))
        : { source: "none", value: 0, weight: 0 };

    if (score >= gateConfig.activationThreshold) {
      consecutiveSkips = 0;
      lastActivationTime = now;
      totalActivations++;
      lastScore = score;
      lastDominantSignal = dominant.source;
      return { activate: true, score, dominantSignal: dominant.source, signals };
    }

    consecutiveSkips++;
    totalSkips++;
    lastScore = score;
    lastDominantSignal = dominant.source;
    return { activate: false, score, dominantSignal: dominant.source, signals };
  }

  function getStats(): ThalamicGateStats {
    return {
      totalChecks,
      totalActivations,
      totalSkips,
      consecutiveSkips,
      lastActivationTime,
      lastScore,
      lastDominantSignal,
    };
  }

  /** Reset stats (useful for testing) */
  function reset(): void {
    totalChecks = 0;
    totalActivations = 0;
    totalSkips = 0;
    consecutiveSkips = 0;
    lastActivationTime = 0;
    lastScore = 0;
    lastDominantSignal = "";
    gateConfig = undefined;
    providers = {};
  }

  return { shouldActivateCortex, getStats, reset };
}

// ── Active-instance wrappers (backward-compatible API) ───────────

let active: ThalamicGateInstance | null = null;

function current(): ThalamicGateInstance {
  if (!active) active = createThalamicGate();
  return active;
}

export function initThalamicGate(
  config: ThalamicGateConfig,
  signalProviders: SignalProviders,
): void {
  active = createThalamicGate(config, signalProviders);
}

/** Symmetric teardown — drops the active instance. */
export function stopThalamicGate(): void {
  active = null;
}

export function shouldActivateCortex(ctx: ThalamicContext, nowMs?: number): ThalamicDecision {
  return current().shouldActivateCortex(ctx, nowMs);
}

export function getThalamicGateStats(): ThalamicGateStats {
  return current().getStats();
}

/** Reset stats (useful for testing) */
export function resetThalamicGate(): void {
  current().reset();
}
