/**
 * Interoception — Holistic internal state sensing module.
 *
 * In the human brain, interoception is the sense of the body's internal state:
 * hunger, heartbeat, muscle tension, gut feelings. It synthesizes signals from
 * many subsystems into a unified "how do I feel right now?" awareness.
 *
 * This module does the same for BrainAgent: it reads all drive states,
 * neuromodulator levels, and vital-impulse pressure, then produces
 * named composite patterns that describe the agent's overall inner state.
 *
 * Named patterns:
 *  - restless:    high pressure + multiple drives unsatisfied
 *  - content:     all drives satiated + low pressure + high serotonin
 *  - inspired:    creative need + cognitive hunger + high dopamine
 *  - frustrated:  mastery need + low dopamine + high norepinephrine
 *  - focused:     one dominant drive + others calm + high acetylcholine
 *  - exploratory: cognitive hunger + curiosity signals + moderate creative need
 *
 * The interoceptive state is emitted on the event bus and can be consumed
 * by vital-impulse (as a pressure signal) and by context injection
 * (so the agent's inner state colors its responses naturally).
 */

import { bus } from "./event-bus.ts";
import type {
  CognitiveHungerStats,
  CreativeDriveStats,
  MasteryDriveStats,
  SocialDriveStats,
} from "./types.ts";
import type { VitalImpulseStats } from "./vital-impulse.ts";

// ── Types ─────────────────────────────────────────────────────────

export type InteroceptivePattern =
  | "restless"
  | "content"
  | "inspired"
  | "frustrated"
  | "focused"
  | "exploratory"
  | "neutral";

export type InteroceptiveState = {
  /** Dominant named pattern */
  pattern: InteroceptivePattern;
  /** Confidence in the pattern classification (0-1) */
  confidence: number;
  /** Short human-readable description of the inner state */
  description: string;
  /** Individual drive need levels (0-1, higher = more need) */
  driveNeeds: {
    social: number;
    cognitive: number;
    creative: number;
    mastery: number;
  };
  /** Aggregate need across all drives (0-1) */
  aggregateNeed: number;
  /** Current vital impulse pressure (0+) */
  pressure: number;
  /** Timestamp of last evaluation */
  timestamp: number;
};

type DriveStatGetters = {
  getSocialDriveStats?: () => SocialDriveStats;
  getCognitiveHungerStats?: () => CognitiveHungerStats;
  getCreativeDriveStats?: () => CreativeDriveStats;
  getMasteryDriveStats?: () => MasteryDriveStats;
  getVitalImpulseStats?: () => VitalImpulseStats;
  getNeuromodulatorState?: () => {
    dopamine: number;
    serotonin: number;
    norepinephrine: number;
    acetylcholine: number;
  };
};

// ── Module state ──────────────────────────────────────────────────

let statGetters: DriveStatGetters = {};
let logger: { info: (msg: string) => void } | undefined;
let lastState: InteroceptiveState | null = null;
const unsubscribers: Array<() => void> = [];

// ── Initialization ────────────────────────────────────────────────

export function initInteroception(
  getters: DriveStatGetters,
  log?: { info: (msg: string) => void },
): void {
  statGetters = getters;
  logger = log;
  lastState = null;
  unsubscribers.length = 0;

  // Re-evaluate interoceptive state after each dopamine reward cycle
  // (the natural "check-in" moment when the brain assesses how things went)
  const unsubReward = bus.on("dopamine:reward", () => {
    evaluate();
  });
  unsubscribers.push(unsubReward);

  // Also evaluate when vital impulse fires (significant internal event)
  const unsubFired = bus.on("vital-impulse:fired", () => {
    evaluate();
  });
  unsubscribers.push(unsubFired);

  logger?.info("BrainAgent Interoception: initialized");
}

export function stopInteroception(): void {
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers.length = 0;
  logger?.info("BrainAgent Interoception: stopped.");
}

// ── Core evaluation ───────────────────────────────────────────────

function evaluate(): void {
  const social = statGetters.getSocialDriveStats?.();
  const cognitive = statGetters.getCognitiveHungerStats?.();
  const creative = statGetters.getCreativeDriveStats?.();
  const mastery = statGetters.getMasteryDriveStats?.();
  const impulse = statGetters.getVitalImpulseStats?.();
  const neuro = statGetters.getNeuromodulatorState?.();

  // Drive needs (0 = fully satiated, 1 = starving)
  const socialNeed = social ? social.need : 0;
  const cognitiveNeed = cognitive ? cognitive.need : 0;
  const creativeNeed = creative ? creative.need : 0;
  const masteryNeed = mastery ? mastery.need : 0;

  const pressure = impulse?.currentPressure ?? 0;
  const dopamine = neuro?.dopamine ?? 0.5;
  const serotonin = neuro?.serotonin ?? 0.5;
  const norepinephrine = neuro?.norepinephrine ?? 0.5;
  const acetylcholine = neuro?.acetylcholine ?? 0.5;

  const aggregateNeed = (socialNeed + cognitiveNeed + creativeNeed + masteryNeed) / 4;

  // Classify pattern
  const { pattern, confidence, description } = classifyPattern({
    socialNeed,
    cognitiveNeed,
    creativeNeed,
    masteryNeed,
    aggregateNeed,
    pressure,
    dopamine,
    serotonin,
    norepinephrine,
    acetylcholine,
  });

  const state: InteroceptiveState = {
    pattern,
    confidence,
    description,
    driveNeeds: {
      social: socialNeed,
      cognitive: cognitiveNeed,
      creative: creativeNeed,
      mastery: masteryNeed,
    },
    aggregateNeed,
    pressure,
    timestamp: Date.now(),
  };

  // Only emit if pattern changed or confidence shifted significantly
  const changed =
    !lastState ||
    lastState.pattern !== state.pattern ||
    Math.abs(lastState.confidence - state.confidence) > 0.15;

  lastState = state;

  if (changed) {
    bus.emitSync("interoception:state-updated", {
      pattern: state.pattern,
      confidence: state.confidence,
      description: state.description,
      aggregateNeed: state.aggregateNeed,
    });

    logger?.info(
      `BrainAgent Interoception: ${state.pattern} (confidence=${(state.confidence * 100).toFixed(0)}%) — ${state.description}`,
    );
  }
}

// ── Pattern classification ────────────────────────────────────────

type ClassifierInput = {
  socialNeed: number;
  cognitiveNeed: number;
  creativeNeed: number;
  masteryNeed: number;
  aggregateNeed: number;
  pressure: number;
  dopamine: number;
  serotonin: number;
  norepinephrine: number;
  acetylcholine: number;
};

function classifyPattern(input: ClassifierInput): {
  pattern: InteroceptivePattern;
  confidence: number;
  description: string;
} {
  // Score each pattern — highest score wins
  const scores: Array<{
    pattern: InteroceptivePattern;
    score: number;
    description: string;
  }> = [
    scoreContent(input),
    scoreRestless(input),
    scoreInspired(input),
    scoreFrustrated(input),
    scoreFocused(input),
    scoreExploratory(input),
  ];

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];

  // Confidence = how much the winner stands out from the runner-up
  const gap = best.score - second.score;
  const confidence = Math.min(1, Math.max(0.3, gap / Math.max(0.01, best.score)));

  if (best.score < 0.2) {
    return {
      pattern: "neutral",
      confidence: 0.5,
      description: "Спокойное, ровное состояние — ни одна потребность не доминирует",
    };
  }

  return {
    pattern: best.pattern,
    confidence,
    description: best.description,
  };
}

function scoreContent(input: ClassifierInput) {
  // Content: all drives satisfied, low pressure, high serotonin
  const lowNeed = 1 - input.aggregateNeed; // higher when needs are low
  const lowPressure = Math.max(0, 1 - input.pressure);
  const score = lowNeed * 0.4 + input.serotonin * 0.3 + lowPressure * 0.3;
  return {
    pattern: "content" as InteroceptivePattern,
    score: input.aggregateNeed < 0.3 ? score : score * 0.3,
    description:
      "Довольство и умиротворение — потребности удовлетворены, хочется наслаждаться моментом",
  };
}

function scoreRestless(input: ClassifierInput) {
  // Restless: high pressure + multiple drives hungry
  const hungryDrives = [
    input.socialNeed,
    input.cognitiveNeed,
    input.creativeNeed,
    input.masteryNeed,
  ].filter((n) => n > 0.5).length;
  const multiDriveBonus = hungryDrives >= 2 ? 0.3 : 0;
  const score =
    input.aggregateNeed * 0.3 +
    Math.min(1, input.pressure) * 0.3 +
    multiDriveBonus +
    input.norepinephrine * 0.1;
  return {
    pattern: "restless" as InteroceptivePattern,
    score: hungryDrives >= 2 ? score : score * 0.3,
    description:
      "Беспокойство и внутренний зуд — несколько потребностей требуют внимания одновременно",
  };
}

function scoreInspired(input: ClassifierInput) {
  // Inspired: creative need + cognitive hunger + high dopamine
  const creativeAndCognitive = (input.creativeNeed + input.cognitiveNeed) / 2;
  const score =
    creativeAndCognitive * 0.4 + input.dopamine * 0.35 + Math.min(1, input.pressure) * 0.25;
  return {
    pattern: "inspired" as InteroceptivePattern,
    score: creativeAndCognitive > 0.35 && input.dopamine > 0.5 ? score : score * 0.3,
    description: "Вдохновение и творческий подъём — хочется создавать и исследовать новые идеи",
  };
}

function scoreFrustrated(input: ClassifierInput) {
  // Frustrated: mastery need + low dopamine + high norepinephrine
  const lowDopamine = 1 - input.dopamine;
  const score =
    input.masteryNeed * 0.35 +
    lowDopamine * 0.3 +
    input.norepinephrine * 0.2 +
    input.aggregateNeed * 0.15;
  return {
    pattern: "frustrated" as InteroceptivePattern,
    score: input.masteryNeed > 0.5 && input.dopamine < 0.4 ? score : score * 0.3,
    description:
      "Раздражение от собственных ограничений — хочется стать лучше, но пока не получается",
  };
}

function scoreFocused(input: ClassifierInput) {
  // Focused: one dominant drive + others calm + high acetylcholine
  const needs = [input.socialNeed, input.cognitiveNeed, input.creativeNeed, input.masteryNeed];
  const maxNeed = Math.max(...needs);
  const sorted = [...needs].sort((a, b) => b - a);
  const dominanceGap = sorted[0] - sorted[1]; // gap between top and second
  const score = dominanceGap * 0.35 + input.acetylcholine * 0.35 + maxNeed * 0.3;
  return {
    pattern: "focused" as InteroceptivePattern,
    score: dominanceGap > 0.25 && maxNeed > 0.4 ? score : score * 0.3,
    description:
      "Глубокая сосредоточенность — одна потребность чётко доминирует и направляет внимание",
  };
}

function scoreExploratory(input: ClassifierInput) {
  // Exploratory: cognitive hunger + moderate creative need
  const score =
    input.cognitiveNeed * 0.4 +
    input.creativeNeed * 0.25 +
    input.dopamine * 0.2 +
    (1 - input.socialNeed) * 0.15;
  return {
    pattern: "exploratory" as InteroceptivePattern,
    score: input.cognitiveNeed > 0.4 ? score : score * 0.3,
    description:
      "Исследовательский азарт — хочется копать глубже, узнавать новое, задавать вопросы",
  };
}

// ── Public API ────────────────────────────────────────────────────

export function getInteroceptiveState(): InteroceptiveState | null {
  return lastState;
}

/**
 * Build a context string for injection into the agent's prompt.
 * Returns null if no interoceptive state has been computed yet.
 */
export function buildInteroceptionContext(): string | null {
  if (!lastState) return null;

  const driveLines: string[] = [];
  const { driveNeeds } = lastState;
  if (driveNeeds.social > 0.4)
    driveLines.push(`социальная потребность: ${(driveNeeds.social * 100).toFixed(0)}%`);
  if (driveNeeds.cognitive > 0.4)
    driveLines.push(`познавательный голод: ${(driveNeeds.cognitive * 100).toFixed(0)}%`);
  if (driveNeeds.creative > 0.4)
    driveLines.push(`творческий порыв: ${(driveNeeds.creative * 100).toFixed(0)}%`);
  if (driveNeeds.mastery > 0.4)
    driveLines.push(`стремление к мастерству: ${(driveNeeds.mastery * 100).toFixed(0)}%`);

  const parts = [`Внутреннее состояние: ${lastState.description}`];
  if (driveLines.length > 0) {
    parts.push(`Активные потребности: ${driveLines.join(", ")}`);
  }

  return parts.join("\n");
}
