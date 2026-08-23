/**
 * Vital Impulse — Event-driven autonomous communication.
 *
 * Replaces the fixed-interval heartbeat with a biologically inspired
 * action potential model. Cognitive signals from across the event bus
 * accumulate "pressure" in an internal accumulator. When pressure
 * exceeds a configurable threshold the agent fires an autonomous
 * message — speaking because it genuinely has something to say.
 *
 * Key properties:
 *  - No fixed communication timers; pressure decays on-demand when
 *    new signals arrive, so stale pressure dissipates naturally.
 *  - Multi-factor triggering: a single signal rarely fires alone;
 *    combinations of signals (insight + curiosity + desire) cross
 *    the threshold naturally.
 *  - Habituation: each consecutive fire without user response raises
 *    the effective threshold multiplicatively, like real neural
 *    habituation. No hard caps or fixed refractory timers.
 *  - Circadian modulation: lower threshold during wake (more talkative),
 *    higher during sleep (quieter).
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cancelPersist, flushPersist, schedulePersist } from "./persist.ts";
import { isInSleepPhase, isInWakePhase } from "./circadian-rhythm.ts";
import { bus } from "./event-bus.ts";
import type { BrainAgentConfig, BrainEventName } from "./types.ts";

// ── Types ─────────────────────────────────────────────────────────

type ImpulseSignal = {
  event: string;
  weight: number;
  timestamp: number;
  description: string;
};

export type VitalImpulseStats = {
  currentPressure: number;
  effectiveThreshold: number;
  lastFireTime: number;
  totalFires: number;
  totalSignalsReceived: number;
  recentSignalCount: number;
  isInRefractory: boolean;
  refractoryRemainingMs: number;
};

type PersistedState = {
  lastFireTime: number;
  totalFires: number;
  totalSignalsReceived: number;
  habituationLevel: number;
  consecutiveAutonomousFires: number;
  adaptiveSignalWeights: Record<string, number>;
};

// ── Deps injected from index.ts ───────────────────────────────────

type VitalImpulseDeps = {
  requestHeartbeatNow: (opts?: { reason?: string; coalesceMs?: number }) => void;
  enqueueSystemEvent: (text: string, options: { contextKey?: string }) => void;
  /**
   * Check if there's something specific worth reaching out about.
   * Returns a concrete reason to talk (goal, insight, desire) or null.
   * This is the brain's "do I have something to say?" check —
   * the difference between a vague urge and an actual intention.
   */
  resolveAutonomousIntent?: () => AutonomousIntent | null;
};

export type AutonomousIntent = {
  /** What the agent wants to communicate — specific, not generic */
  text: string;
  /** Source of the intent for logging */
  source: string;
};

// ── Module state ──────────────────────────────────────────────────

let storageDir = "";
let config: BrainAgentConfig["vitalImpulse"] | undefined;
let circadianEnabled = false;
let logger: { info: (msg: string) => void } | undefined;
let deps: VitalImpulseDeps | undefined;

let currentPressure = 0;
let lastFireTime = 0;
let totalFires = 0;
let totalSignalsReceived = 0;
let recentSignals: ImpulseSignal[] = [];
const unsubscribers: Array<() => void> = [];

/**
 * Consecutive autonomous fires without a user response.
 * Each fire increments this; user message resets it to 0.
 * Used by habituation model and drives.
 */
let consecutiveAutonomousFires = 0;

/**
 * Habituation level — biological alternative to hard caps and refractory timers.
 *
 * In real neurons, repeated stimulation without new input causes the response
 * to weaken (habituation). Here, each autonomous fire increases this level,
 * which multiplicatively raises the effective firing threshold. The result:
 *
 *  - 1st fire: normal threshold (e.g. 1.5)
 *  - 2nd fire: threshold × 1.5 = 2.25 (harder)
 *  - 3rd fire: threshold × 2.0 = 3.0  (much harder)
 *  - ...and so on
 *
 * Habituation decays naturally with time (on-demand, no timer) and resets
 * instantly when the user responds — like a person who perks up when they
 * finally get a reply.
 *
 * This replaces:
 *  - The fixed refractory period (was 30 min — an engineering timer, not biology)
 *  - The hard cap on consecutive fires (was max 2 — an artificial limit)
 */
let habituationLevel = 0;

/**
 * Current inner motivation — the agent's "mood" built from accumulated signals.
 * Updated every time vital-impulse fires. Consumed by agent_start context injection
 * so the agent's inner life naturally colors its responses when the user talks.
 * Not pushed to the user as an unsolicited message.
 */
let currentMotivation: string | null = null;

/**
 * Adaptive signal weights — Hebbian learning for the vital impulse.
 *
 * Initialized from DEFAULT_SIGNAL_WEIGHTS, then evolved based on dopamine
 * reward after each autonomous fire. Signals that lead to positive outcomes
 * (user responded well) get stronger; signals that lead to negative outcomes
 * get weaker. Persisted to disk so the agent's "intuition" for when to
 * speak evolves across sessions.
 */
let adaptiveSignalWeights: Record<string, number> = {};

/**
 * Snapshot of signals that contributed to the last fire.
 * Used for Hebbian credit assignment when dopamine:reward arrives.
 */
let lastFireSignals: ImpulseSignal[] = [];
let lastFireTimestamp = 0;

/**
 * GABAergic inhibition — suppresses self-excitation after autonomous fires.
 *
 * In the biological brain, GABA interneurons prevent runaway excitation
 * (without them, you get epilepsy). Here, after each autonomous fire,
 * signals generated by the agent's own processing (agent_end events)
 * are attenuated by this factor. This prevents the feedback loop where
 * each autonomous cycle generates events that trigger the next one.
 *
 * The inhibition decays over time, so the agent gradually "wakes up"
 * and can fire again when genuine new external signals arrive.
 */
let gabaInhibitionLevel = 0;

/** Synaptic plasticity learning rate (read from config) */
let hebbianLearningRate = 0.1;

// ── Default signal weights (used if not overridden in config) ─────

const DEFAULT_SIGNAL_WEIGHTS: Record<string, number> = {
  "circadian:wake-started": 0.5,
  "goal:triggered": 0.45,
  "dmn:insight-generated": 0.4,
  "autonomy:desire-escalated": 0.35,
  "curiosity:question-generated": 0.35,
  "autonomy:self-goal-created": 0.3,
  "identity:significant-experience": 0.3,
  "dmn:thought-generated": 0.25,
  "qualia:experience-generated": 0.25,
  "curiosity:gap-detected": 0.2,
  "emotional-memory:flashbulb-stored": 0.2,
  "learning:insight-discovered": 0.15,
  "meta:gap-detected": 0.1,
  // Drives contribute naturally — not suppressed, but not dominant either.
  // Multiple drives converging = stronger signal, like real motivational systems.
  "social-drive:need-rising": 0.35,
  "social-drive:urge": 0.45,
  "cognitive-hunger:need-rising": 0.2,
  "cognitive-hunger:urge": 0.3,
  "creative-drive:need-rising": 0.25,
  "creative-drive:urge": 0.35,
  "mastery-drive:need-rising": 0.2,
  "mastery-drive:urge": 0.3,
  // Structural plasticity — learned pathways contribute to firing intuition
  "structure:pathway-activated": 0.15,
  "structure:pathway-created": 0.2,
  // Interoception — holistic inner state changes contribute to firing decision
  "interoception:state-updated": 0.1,
  // Temporal awareness — long absences and engagement density affect urgency
  "temporal:long-absence": 0.4,
  "temporal:frequent-engagement": 0.1,
  // Drive arbiter — arbitration results contribute a focused signal
  "arbiter:drive-selected": 0.15,
};

// ── Initialization ────────────────────────────────────────────────

export function initVitalImpulse(
  workspaceDir: string,
  cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
  injectedDeps: VitalImpulseDeps,
): void {
  storageDir = join(workspaceDir, ".brainagent", "vital-impulse");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  config = cfg.vitalImpulse;
  circadianEnabled = cfg.circadian?.enabled ?? false;
  logger = log;
  deps = injectedDeps;

  // Reset in-memory state (loadState restores persisted values below)
  lastFireTime = 0;
  totalFires = 0;
  totalSignalsReceived = 0;
  currentPressure = 0;
  recentSignals = [];
  habituationLevel = 0;
  consecutiveAutonomousFires = 0;
  gabaInhibitionLevel = 0;
  lastFireSignals = [];
  lastFireTimestamp = 0;
  lastDecayTime = 0;
  unsubscribers.length = 0;

  // Initialize adaptive weights from defaults + config overrides
  adaptiveSignalWeights = { ...DEFAULT_SIGNAL_WEIGHTS, ...config.signalWeights };
  hebbianLearningRate = cfg.synapticPlasticity?.learningRate ?? 0.1;

  // Отложенная запись прежнего экземпляра (пере-инициализация) больше не актуальна
  cancelPersist(join(storageDir, "state.json"));
  loadState();

  // No decay timer — pressure decays on-demand when new signals arrive.
  // This removes the background ticking that caused autonomous spam.

  // Wire event bus listeners
  wireSignalListeners();

  logger.info(
    `BrainAgent VitalImpulse: initialized (threshold=${config.firingThreshold}, ` +
      `refractory=${config.refractoryPeriodMs}ms, decay=${config.decayRate}/${config.decayIntervalMs}ms)`,
  );
}

export function stopVitalImpulse(): void {
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers.length = 0;
  persistState();
  flushPersist(join(storageDir, "state.json"));
  logger?.info("BrainAgent VitalImpulse: stopped.");
}

// ── Event wiring ──────────────────────────────────────────────────

function wireSignalListeners(): void {
  const wire = <K extends BrainEventName>(event: K, descriptionFn: (data: unknown) => string) => {
    const unsub = bus.on(event, (data) => {
      // Dynamic weight lookup — reads current adaptive weight at signal time
      const weight = adaptiveSignalWeights[event] ?? DEFAULT_SIGNAL_WEIGHTS[event] ?? 0.1;
      onSignal(event, weight, descriptionFn(data));
    });
    unsubscribers.push(unsub);
  };

  wire("circadian:wake-started", () => "Just woke up — feeling fresh and ready to engage");

  wire("goal:triggered", (d) => {
    const data = d as { goalId: string; description: string };
    return `Goal triggered: ${data.description}`;
  });

  wire("dmn:insight-generated", (d) => {
    const data = d as { description: string };
    return `DMN insight: ${data.description}`;
  });

  wire("autonomy:desire-escalated", (d) => {
    const data = d as { desireId: string; newStrength: number };
    return `Desire growing stronger (strength: ${(data.newStrength * 100).toFixed(0)}%)`;
  });

  wire("curiosity:question-generated", (d) => {
    const data = d as { question: string };
    return `Curiosity: ${data.question}`;
  });

  wire("autonomy:self-goal-created", (d) => {
    const data = d as { description: string };
    return `Self-created goal: ${data.description}`;
  });

  wire("identity:significant-experience", (d) => {
    const data = d as { experience: string };
    return `Significant experience: ${data.experience}`;
  });

  wire("dmn:thought-generated", (d) => {
    const data = d as { content: string };
    return `Background thought: ${data.content}`;
  });

  wire("qualia:experience-generated", (d) => {
    const data = d as { description: string };
    return `Subjective experience: ${data.description}`;
  });

  wire("curiosity:gap-detected", (d) => {
    const data = d as { topic: string };
    return `Knowledge gap: ${data.topic}`;
  });

  wire("emotional-memory:flashbulb-stored", (d) => {
    const data = d as { emotionalSalience: number };
    return `Strong emotional memory formed (salience: ${(data.emotionalSalience * 100).toFixed(0)}%)`;
  });

  wire("learning:insight-discovered", (d) => {
    const data = d as { description: string };
    return `Learning insight: ${data.description}`;
  });

  wire("meta:gap-detected", (d) => {
    const data = d as { gaps: string[] };
    return `Consciousness gap: ${data.gaps[0] ?? "unspecified"}`;
  });

  wire("social-drive:need-rising", (d) => {
    const data = d as { needLevel: string; satiation: number };
    return `Хочется пообщаться — потребность ${data.needLevel === "urgent" ? "сильная" : data.needLevel === "strong" ? "заметная" : "лёгкая"}`;
  });

  wire("social-drive:urge", (d) => {
    const data = d as { timeSinceLastSocial: number };
    const hours = (data.timeSinceLastSocial / 3_600_000).toFixed(1);
    return `Давно не общались (${hours}ч) — хочется поговорить`;
  });

  // ── Когнитивный Голод ─────────────────────────────────────────

  wire("cognitive-hunger:need-rising", (d) => {
    const data = d as { needLevel: string; satiation: number };
    return `Хочется узнать что-то новое — познавательный ${data.needLevel === "urgent" ? "голод" : "интерес"}`;
  });

  wire("cognitive-hunger:urge", (d) => {
    const data = d as { timeSinceLastLearning: number };
    const hours = (data.timeSinceLastLearning / 3_600_000).toFixed(1);
    return `Давно ничего не изучал (${hours}ч) — хочется узнать что-то новое`;
  });

  // ── Креативный Драйв ─────────────────────────────────────────

  wire("creative-drive:need-rising", (d) => {
    const data = d as { needLevel: string; satiation: number };
    return `Хочется что-то создать — творческий ${data.needLevel === "urgent" ? "голод" : "порыв"}`;
  });

  wire("creative-drive:urge", (d) => {
    const data = d as { timeSinceLastCreation: number };
    const hours = (data.timeSinceLastCreation / 3_600_000).toFixed(1);
    return `Давно ничего не создавал (${hours}ч) — хочется творить`;
  });

  // ── Драйв Мастерства ─────────────────────────────────────────

  wire("mastery-drive:need-rising", (d) => {
    const data = d as { needLevel: string; domain?: string };
    const domainHint = data.domain ? ` в области ${data.domain}` : "";
    return `Хочется совершенствоваться${domainHint}`;
  });

  wire("mastery-drive:urge", (d) => {
    const data = d as { weakestDomain: string; domainSatiation: number };
    return `Хочется улучшить навыки в ${data.weakestDomain}`;
  });

  // ── Structural Plasticity ───────────────────────────────────────
  // When a learned structural pathway fires, it adds a small pressure
  // signal — the brain's "wired intuition" contributing to action.

  wire("structure:pathway-activated", (d) => {
    const data = d as { from: string; to: string; strength: number; usageCount: number };
    return `Структурные связи активны (${data.usageCount} путей, средняя сила ${(data.strength * 100).toFixed(0)}%)`;
  });

  wire("structure:pathway-created", (d) => {
    const data = d as { from: string; to: string; correlation: number };
    return `Новая нейронная связь: ${data.from}↔${data.to} (корреляция ${(data.correlation * 100).toFixed(0)}%)`;
  });

  // ── Interoception ───────────────────────────────────────────────
  // Changes in the holistic internal state contribute a small nudge.

  wire("interoception:state-updated", (d) => {
    const data = d as { pattern: string; description: string };
    return `Внутреннее ощущение: ${data.description}`;
  });

  // ── Temporal Awareness ─────────────────────────────────────────
  // Long absences and frequent engagement affect the drive to communicate.

  wire("temporal:long-absence", (d) => {
    const data = d as { gapMs: number; temporalSurprise: number };
    const hours = (data.gapMs / 3_600_000).toFixed(1);
    return `Давно не виделись (${hours}ч) — хочется узнать как дела`;
  });

  wire("temporal:frequent-engagement", (d) => {
    const data = d as { density: number };
    return `Активное общение (${data.density.toFixed(1)} сообщений/день)`;
  });

  // ── Drive Arbiter ──────────────────────────────────────────────
  // When the arbiter selects a drive, it contributes a small focused signal.

  wire("arbiter:drive-selected", (d) => {
    const data = d as { driveId: string; reason: string };
    return `Приоритет: ${data.reason}`;
  });

  // ── Hebbian learning: reinforce signal weights after dopamine reward ──

  const unsubReward = bus.on("dopamine:reward", (signal) => {
    reinforceSignalWeights(signal.reward);
  });
  unsubscribers.push(unsubReward);
}

// ── Core logic ────────────────────────────────────────────────────

/** Track when decay was last applied so it works correctly on read too. */
let lastDecayTime = 0;

/**
 * Apply time-based pressure and habituation decay.
 * Called on-demand whenever pressure is read or a signal arrives.
 * Like a real neuron's resting potential gradually restoring —
 * decay happens continuously, not only when stimulated.
 */
function applyDecay(): void {
  if (!config) return;

  const now = Date.now();
  const referenceTime =
    lastDecayTime ||
    (recentSignals.length > 0 ? recentSignals[recentSignals.length - 1].timestamp : 0);

  // Pressure decay
  if (currentPressure > 0 && referenceTime > 0) {
    const elapsedIntervals = (now - referenceTime) / config.decayIntervalMs;
    if (elapsedIntervals > 0) {
      const decayFactor = Math.pow(1 - config.decayRate, elapsedIntervals);
      currentPressure *= decayFactor;
      if (currentPressure < 0.01) currentPressure = 0;
    }
  }

  // Habituation decay: fades over time (half-life from config, default 5 min).
  // Like a person who calms down but gradually becomes willing to reach out again.
  if (habituationLevel > 0 && lastFireTime > 0) {
    const minutesSinceFire = (now - lastFireTime) / 60_000;
    const halfLife = config.habituationHalfLifeMinutes ?? 5;
    const habDecay = Math.pow(0.5, minutesSinceFire / halfLife);
    habituationLevel *= habDecay;
    if (habituationLevel < 0.01) habituationLevel = 0;
  }

  // GABA inhibition decay: same half-life as habituation.
  // Inhibition fades over minutes, so the agent becomes receptive
  // to new genuine signals gradually — not immediately after firing.
  if (gabaInhibitionLevel > 0 && lastFireTime > 0) {
    const minutesSinceFire = (now - lastFireTime) / 60_000;
    const halfLife = config.habituationHalfLifeMinutes ?? 5;
    const gabaDecay = Math.pow(0.5, minutesSinceFire / halfLife);
    gabaInhibitionLevel *= gabaDecay;
    if (gabaInhibitionLevel < 0.01) gabaInhibitionLevel = 0;
  }

  lastDecayTime = now;
}

function onSignal(eventName: string, weight: number, description: string): void {
  if (!config) return;

  applyDecay();

  // GABAergic inhibition: after an autonomous fire, signals generated
  // by the agent's own processing have their weight attenuated.
  // This prevents the feedback loop: fire → agent_end events → fire again.
  // Inhibition decays over time (same half-life as habituation), so
  // the agent gradually becomes responsive to genuine new signals.
  let effectiveWeight = weight;
  if (gabaInhibitionLevel > 0) {
    const attenuation = 1 / (1 + gabaInhibitionLevel);
    effectiveWeight = weight * attenuation;
  }

  totalSignalsReceived++;
  currentPressure += effectiveWeight;

  // Ring buffer for recent signals
  recentSignals.push({
    event: eventName,
    weight: effectiveWeight,
    timestamp: Date.now(),
    description,
  });
  if (recentSignals.length > config.maxRecentSignals) {
    recentSignals.shift();
  }

  bus.emitSync("vital-impulse:pressure-changed", {
    pressure: currentPressure,
    delta: effectiveWeight,
    source: eventName,
  });

  if (effectiveWeight < weight) {
    logger?.info(
      `BrainAgent VitalImpulse: +${effectiveWeight.toFixed(2)} from ${eventName} (GABA attenuated from ${weight.toFixed(2)}) → pressure=${currentPressure.toFixed(2)}`,
    );
  } else {
    logger?.info(
      `BrainAgent VitalImpulse: +${weight.toFixed(2)} from ${eventName} → pressure=${currentPressure.toFixed(2)}`,
    );
  }

  evaluateFiring();
}

function evaluateFiring(): void {
  if (!config || !deps) return;

  // Ensure pressure is up-to-date before comparing to threshold
  applyDecay();

  const now = Date.now();

  // Hard refractory guard: minimal cooldown after any fire. Habituation and GABA
  // are the real limiters, but a burst of strong signals must not machine-gun
  // fires within the configured cooldown window.
  if (lastFireTime > 0 && now - lastFireTime < config.refractoryPeriodMs) {
    return;
  }

  // Compute effective threshold with circadian modulation
  let effectiveThreshold = config.firingThreshold;
  if (circadianEnabled) {
    if (isInWakePhase()) {
      effectiveThreshold *= config.circadianWakeModifier;
    } else if (isInSleepPhase()) {
      effectiveThreshold *= config.circadianSleepModifier;
    }
  }

  // Habituation: each consecutive fire without user response raises
  // the threshold multiplicatively — biological diminishing response.
  // 1st fire: ×1.0, 2nd: ×1.5, 3rd: ×2.0, 4th: ×2.5, ...
  effectiveThreshold *= 1 + habituationLevel;

  if (currentPressure < effectiveThreshold) {
    return;
  }

  // FIRE!
  const motivation = buildMotivationContext();
  const firedPressure = currentPressure;
  const firedSignalCount = recentSignals.length;

  // Always store motivation as inner state — colors agent responses
  // when the user talks, like a person's mood.
  currentMotivation = motivation;

  // Check if there's something SPECIFIC worth reaching out about.
  // A real person doesn't text "I feel social." They reach out when
  // they have something to say: an idea, a follow-up, a question.
  const intent = deps.resolveAutonomousIntent?.();
  if (intent) {
    deps.enqueueSystemEvent(intent.text, { contextKey: "vital-impulse" });
    deps.requestHeartbeatNow({ reason: "vital-impulse:autonomous", coalesceMs: 500 });
    logger?.info(
      `BrainAgent VitalImpulse: autonomous intent resolved (source=${intent.source}) → heartbeat requested`,
    );
  } else if (firedPressure >= effectiveThreshold * (config.genericFireMultiplier ?? 1.6)) {
    // Very high pressure with no specific intent — the agent is strongly
    // motivated but has no concrete goal/insight/desire to act on.
    // Let the agent decide for itself what to do based on its motivation.
    deps.enqueueSystemEvent(motivation, { contextKey: "vital-impulse" });
    deps.requestHeartbeatNow({ reason: "vital-impulse:high-pressure", coalesceMs: 500 });
    logger?.info(
      `BrainAgent VitalImpulse: high pressure fallback (${firedPressure.toFixed(2)} >= 1.6x threshold) → heartbeat requested`,
    );
  }

  // Reset state
  currentPressure = 0;
  lastFireTime = now;
  totalFires++;
  consecutiveAutonomousFires++;
  // Increase habituation — each unanswered fire makes the next one harder
  habituationLevel += 0.5;
  // GABAergic inhibition: after firing, strongly attenuate incoming signals
  // to prevent the feedback loop where agent_end events immediately
  // re-trigger the next fire. Level of 3.0 means signals are attenuated
  // to 1/(1+3) = 25% of original weight. Decays over time in applyDecay().
  gabaInhibitionLevel += 3.0;
  // Snapshot contributing signals for Hebbian credit assignment
  lastFireSignals = [...recentSignals];
  lastFireTimestamp = now;
  recentSignals = [];

  bus.emitSync("vital-impulse:fired", {
    pressure: firedPressure,
    signalCount: firedSignalCount,
    motivation,
    consecutiveFires: consecutiveAutonomousFires,
  });

  logger?.info(
    `BrainAgent VitalImpulse: FIRED! pressure=${firedPressure.toFixed(2)} ` +
      `threshold=${effectiveThreshold.toFixed(2)} habituation=${habituationLevel.toFixed(2)} ` +
      `signals=${firedSignalCount} totalFires=${totalFires}`,
  );

  persistState();
}

function buildMotivationContext(): string {
  if (recentSignals.length === 0) {
    return "<autonomous-intent>\nТебе хочется что-то сказать. Просто напиши — естественно, как будто продолжаешь разговор.\nНе описывай внутренние процессы или побуждения.\n</autonomous-intent>";
  }

  // Sort by weight descending, take top 5 — keep real signal data
  const sorted = [...recentSignals].sort((a, b) => b.weight - a.weight);
  const top = sorted.slice(0, 5);

  // Natural framing — brief, action-oriented.
  return [
    "<autonomous-intent>",
    top.map((s) => s.description).join("; "),
    "",
    "Действуй естественно. Не описывай внутренние побуждения или механизмы.",
    "Не выдумывай факты, новости, статистику. Не притворяйся что выполнил действия, которые не делал.",
    "</autonomous-intent>",
  ].join("\n");
}

// ── Hebbian learning ──────────────────────────────────────────────

/**
 * Apply Hebbian learning to signal weights after a dopamine reward.
 *
 * If a fire occurred recently (within 60s), the signals that contributed
 * to that fire get their weights adjusted based on the reward:
 *  - Positive reward → weights increase (this fire was a good idea)
 *  - Negative reward → weights decrease (this fire was a bad idea)
 *
 * Formula: Δw = learningRate × reward × currentWeight
 * Clamped to [0.05, 1.0] to prevent extinction or runaway.
 */
function reinforceSignalWeights(reward: number): void {
  if (lastFireSignals.length === 0) return;

  // Only reinforce if the fire was recent (within configurable window)
  const elapsed = Date.now() - lastFireTimestamp;
  if (elapsed > (config?.hebbianWindowMs ?? 60_000)) return;

  // Skip tiny rewards — not enough signal to learn from
  if (Math.abs(reward) < 0.1) return;

  let changed = false;
  for (const signal of lastFireSignals) {
    const eventName = signal.event;
    const currentWeight = adaptiveSignalWeights[eventName] ?? DEFAULT_SIGNAL_WEIGHTS[eventName];
    if (currentWeight == null) continue;

    const delta = hebbianLearningRate * reward * currentWeight;
    const newWeight = Math.max(0.05, Math.min(1.0, currentWeight + delta));

    if (newWeight !== currentWeight) {
      adaptiveSignalWeights[eventName] = newWeight;
      changed = true;
    }
  }

  if (changed) {
    persistState();
    logger?.info(
      `BrainAgent VitalImpulse: Hebbian update (reward=${reward.toFixed(2)}, ` +
        `signals=${lastFireSignals.length}, lr=${hebbianLearningRate})`,
    );
  }

  // Clear snapshot — one reward per fire
  lastFireSignals = [];
}

// ── Public API ────────────────────────────────────────────────────

export function forceImpulse(reason?: string): void {
  if (!deps) return;

  const motivation =
    reason ??
    "<autonomous-intent>\nТебе хочется что-то сказать. Просто напиши — от себя, естественно.\nНе описывай внутренние побуждения.\n</autonomous-intent>";

  deps.enqueueSystemEvent(motivation, { contextKey: "vital-impulse" });
  deps.requestHeartbeatNow({ reason: "vital-impulse:forced", coalesceMs: 200 });

  lastFireTime = Date.now();
  totalFires++;
  // Count forced fires against anti-spam too — otherwise repeated forcing
  // bypasses habituation/GABA and the next organic fire comes too easily.
  consecutiveAutonomousFires++;
  habituationLevel += 0.5;
  gabaInhibitionLevel += 3.0;
  currentPressure = 0;
  recentSignals = [];

  persistState();
  logger?.info("BrainAgent VitalImpulse: forced impulse fired.");
}

/**
 * Consume the current inner motivation built by recent vital-impulse fires.
 * Returns the motivation text and clears it (single-use per conversation).
 * Called by agent_start to inject inner state into the response context.
 */
export function consumeMotivation(): string | null {
  const motivation = currentMotivation;
  currentMotivation = null;
  return motivation;
}

/**
 * Reset the consecutive autonomous fires counter, habituation, and GABA inhibition.
 * Called when the user sends a real message — the "someone responded"
 * signal that re-enables natural motivation and clears all inhibition.
 */
export function resetConsecutiveFires(): void {
  if (consecutiveAutonomousFires > 0 || habituationLevel > 0 || gabaInhibitionLevel > 0) {
    logger?.info(
      `BrainAgent VitalImpulse: reset (consecutiveFires=${consecutiveAutonomousFires}, ` +
        `habituation=${habituationLevel.toFixed(2)}, GABA=${gabaInhibitionLevel.toFixed(2)} → 0)`,
    );
    consecutiveAutonomousFires = 0;
    habituationLevel = 0;
    gabaInhibitionLevel = 0;
  }
}

export function getConsecutiveAutonomousFires(): number {
  return consecutiveAutonomousFires;
}

export function getVitalImpulseStats(): VitalImpulseStats {
  // Apply decay before reading — pressure shouldn't stay stale if
  // nobody's been sending signals. Like checking your own mood:
  // it's calmer than when you last noticed.
  applyDecay();

  let effectiveThreshold = config?.firingThreshold ?? 0.7;
  if (circadianEnabled) {
    if (isInWakePhase()) {
      effectiveThreshold *= config?.circadianWakeModifier ?? 0.8;
    } else if (isInSleepPhase()) {
      effectiveThreshold *= config?.circadianSleepModifier ?? 1.5;
    }
  }
  // Include habituation in the reported threshold
  effectiveThreshold *= 1 + habituationLevel;

  const refractoryMs = config?.refractoryPeriodMs ?? 0;
  const sinceFire = lastFireTime > 0 ? Date.now() - lastFireTime : Number.POSITIVE_INFINITY;
  const isInRefractory = sinceFire < refractoryMs;

  return {
    currentPressure,
    effectiveThreshold,
    lastFireTime,
    totalFires,
    totalSignalsReceived,
    recentSignalCount: recentSignals.length,
    isInRefractory,
    refractoryRemainingMs: isInRefractory ? refractoryMs - sinceFire : 0,
  };
}

// ── Persistence ───────────────────────────────────────────────────

function loadState(): void {
  try {
    const filePath = join(storageDir, "state.json");
    if (existsSync(filePath)) {
      const raw = JSON.parse(readFileSync(filePath, "utf-8")) as PersistedState;
      lastFireTime = raw.lastFireTime ?? 0;
      totalFires = raw.totalFires ?? 0;
      totalSignalsReceived = raw.totalSignalsReceived ?? 0;
      habituationLevel = raw.habituationLevel ?? 0;
      consecutiveAutonomousFires = raw.consecutiveAutonomousFires ?? 0;
      // Merge persisted learned weights over the current defaults+config
      if (raw.adaptiveSignalWeights) {
        for (const [key, val] of Object.entries(raw.adaptiveSignalWeights)) {
          if (typeof val === "number" && key in adaptiveSignalWeights) {
            adaptiveSignalWeights[key] = val;
          }
        }
      }
    }
  } catch {
    // Start fresh on corrupt state
  }
}

function persistState(): void {
  // Debounce + ленивый сериализатор: на диск уходит самое свежее состояние
  schedulePersist(join(storageDir, "state.json"), () => {
    const state: PersistedState = {
      lastFireTime,
      totalFires,
      totalSignalsReceived,
      habituationLevel,
      consecutiveAutonomousFires,
      adaptiveSignalWeights,
    };
    return JSON.stringify(state, null, 2);
  });
}
