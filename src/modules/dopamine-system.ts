/**
 * Dopamine System — Global neuromodulatory reward and motivation engine.
 *
 * In the human brain, four neuromodulatory systems regulate ALL neural activity:
 *
 * 1. DOPAMINE  — reward prediction error. Fires when reality exceeds expectations
 *    (positive surprise) or falls short (disappointment). Drives learning by
 *    telling the brain "do that again" or "avoid that".
 *
 * 2. SEROTONIN — mood and risk tolerance. High serotonin = optimistic, willing
 *    to explore new strategies. Low = conservative, stick to known patterns.
 *
 * 3. NOREPINEPHRINE — attention and alertness. Spikes on novel/urgent input,
 *    sharpens focus. Modulates how much context gets pulled from memory.
 *
 * 4. ACETYLCHOLINE — learning plasticity. High = fast learning, rapid adaptation.
 *    Low = consolidated, slower change. Rises during novel situations.
 *
 * This module computes these four signals after each interaction cycle and
 * broadcasts them to all other modules, which use them to modulate their
 * own learning rates, thresholds, and behavior — just like real neurotransmitters.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bus } from "./event-bus.ts";
import type { BrainAgentConfig, DopamineSignal, NeuromodulatorState } from "./types.ts";

// ── State ───────────────────────────────────────────────────────────

let storageDir = "";

/** Current neuromodulator levels (continuously updated) */
let state: NeuromodulatorState = {
  dopamine: 0.5,
  serotonin: 0.6,
  norepinephrine: 0.3,
  acetylcholine: 0.4,
};

/** Expected reward baseline (used for prediction error) */
let expectedReward = 0.5;

/** Recent reward history for trend tracking */
let rewardHistory: Array<{ reward: number; timestamp: number }> = [];

/** Running average of positive/negative outcomes for serotonin */
let positiveOutcomeRatio = 0.5;

/** Counter of novel inputs (for acetylcholine) */
let noveltyCounter = 0;
let totalInteractions = 0;

// ── Initialization ──────────────────────────────────────────────────

export function initDopamineSystem(workspaceDir: string): void {
  storageDir = join(workspaceDir, ".brainagent", "neuromodulators");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  loadState();
}

function loadState(): void {
  if (!storageDir) return;
  try {
    const path = join(storageDir, "state.json");
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, "utf-8")) as {
        state: NeuromodulatorState;
        expectedReward: number;
        rewardHistory: Array<{ reward: number; timestamp: number }>;
        positiveOutcomeRatio: number;
        noveltyCounter: number;
        totalInteractions: number;
      };
      state = data.state;
      expectedReward = data.expectedReward;
      rewardHistory = data.rewardHistory ?? [];
      positiveOutcomeRatio = data.positiveOutcomeRatio ?? 0.5;
      noveltyCounter = data.noveltyCounter ?? 0;
      totalInteractions = data.totalInteractions ?? 0;
    }
  } catch {
    // Fresh start
  }
}

function persistState(): void {
  if (!storageDir) return;
  try {
    writeFileSync(
      join(storageDir, "state.json"),
      JSON.stringify(
        {
          state,
          expectedReward,
          rewardHistory: rewardHistory.slice(-100), // Keep last 100
          positiveOutcomeRatio,
          noveltyCounter,
          totalInteractions,
        },
        null,
        2,
      ),
      "utf-8",
    );
  } catch {
    /* non-critical */
  }
}

// ── Core: Compute reward and distribute dopamine ────────────────────

/**
 * Process the outcome of an interaction cycle and compute neuromodulator updates.
 *
 * Called at the end of each agent cycle with:
 * - validation result from Cerebellum (quality signal)
 * - reinforcement signal from user (explicit feedback)
 * - which modules participated
 *
 * Returns the dopamine signal that gets broadcast to all modules.
 */
export function processInteractionOutcome(
  params: {
    cerebellumPassed: boolean;
    cerebellumIssues: string[];
    userSignal: "positive" | "negative" | "neutral";
    participatingModules: string[];
    domain: string;
    complexity: string;
    emotion: string;
    input: string;
    habitAutoExecuted: boolean;
    predictionWasCorrect?: boolean;
    // ── Intrinsic reward signals (self-generated, no external teacher) ──
    /** A curiosity gap was filled during this cycle */
    curiosityGapClosed?: boolean;
    /** An own goal was completed during this cycle */
    goalCompleted?: boolean;
    /** A DMN insight was incorporated into the response */
    insightUsed?: boolean;
    /** The user responded at all (social reciprocity — connection happened) */
    socialReciprocity?: boolean;
  },
  config: BrainAgentConfig,
): DopamineSignal {
  totalInteractions++;

  // ── Step 1: Compute raw reward (multi-factor) ───────────────

  let reward = 0;

  // User explicit feedback (external signal — weighted down so
  // intrinsic motivation can drive learning alongside it, like
  // a real brain where external praise matters but doesn't dominate)
  switch (params.userSignal) {
    case "positive":
      reward += 0.35;
      break;
    case "negative":
      reward -= 0.35;
      break;
    case "neutral":
      reward += 0.05; // Neutral is slightly positive (no complaints = ok)
      break;
  }

  // Cerebellum quality (internal self-evaluation)
  if (params.cerebellumPassed) {
    reward += 0.15;
  } else {
    reward -= 0.15 * Math.min(params.cerebellumIssues.length, 3);
  }

  // Bonus for successful habit auto-execution (efficiency reward)
  if (params.habitAutoExecuted && params.userSignal !== "negative") {
    reward += 0.1;
  }

  // Prediction accuracy bonus
  if (params.predictionWasCorrect === true) {
    reward += 0.15;
  } else if (params.predictionWasCorrect === false) {
    reward -= 0.05;
  }

  // ── Intrinsic rewards (self-generated dopamine) ─────────────
  // In a real brain, dopamine fires from curiosity satisfaction,
  // goal achievement, creative insight, and social connection —
  // not just external praise. These signals allow the agent to
  // learn and improve without depending on user feedback.

  if (params.curiosityGapClosed) {
    reward += 0.25; // "Aha!" — found the answer to own question
  }

  if (params.goalCompleted) {
    reward += 0.3; // Achieved a self-set goal — strong intrinsic reward
  }

  if (params.insightUsed) {
    reward += 0.15; // Creative insight was relevant and useful
  }

  if (params.socialReciprocity) {
    reward += 0.1; // Connection happened — someone responded
  }

  // Clamp reward to [-1, 1]
  reward = Math.max(-1, Math.min(1, reward));

  // ── Step 2: Compute prediction error (dopamine core) ────────

  const predictionError = reward - expectedReward;

  // Update expected reward (slow adaptation)
  const alphaExpected = 0.1;
  expectedReward = expectedReward * (1 - alphaExpected) + reward * alphaExpected;

  // ── Step 3: Credit assignment across modules ────────────────

  const creditAssignment = computeCreditAssignment(
    params.participatingModules,
    params.cerebellumIssues,
    reward,
  );

  // ── Step 4: Update neuromodulators ──────────────────────────

  updateDopamine(predictionError, config);
  updateSerotonin(reward);
  updateNorepinephrine(params.complexity, params.emotion);
  updateAcetylcholine(params.domain, config);

  // ── Step 5: Record and broadcast ────────────────────────────

  rewardHistory.push({ reward, timestamp: Date.now() });
  if (rewardHistory.length > 200) {
    rewardHistory = rewardHistory.slice(-100);
  }

  const signal: DopamineSignal = {
    reward,
    predictionError,
    participatingModules: params.participatingModules,
    creditAssignment,
    context: {
      domain: params.domain,
      complexity: params.complexity,
      emotion: params.emotion,
      input: params.input.slice(0, 200),
    },
  };

  bus.emitSync("dopamine:reward", signal);
  bus.emitSync("neuromodulator:state-changed", { ...state });

  if (Math.abs(predictionError) > 0.3) {
    bus.emitSync("dopamine:prediction-error", {
      error: predictionError,
      context: `${params.domain}/${params.complexity}: ${predictionError > 0 ? "better than expected" : "worse than expected"}`,
    });
  }

  persistState();
  return signal;
}

// ── Credit Assignment ───────────────────────────────────────────────

/**
 * Distribute credit/blame across modules that participated in the cycle.
 * Uses a simple heuristic: modules mentioned in cerebellum issues get
 * reduced credit; all others share equally.
 */
function computeCreditAssignment(
  modules: string[],
  issues: string[],
  reward: number,
): Record<string, number> {
  if (modules.length === 0) return {};

  const credit: Record<string, number> = {};
  const baseShare = 1.0 / modules.length;

  // Identify modules implicated in issues
  const issueText = issues.join(" ").toLowerCase();
  const blamedModules = new Set<string>();

  const moduleIssueKeywords: Record<string, string[]> = {
    thalamus: ["classification", "domain", "complexity", "misclassif"],
    amygdala: ["emotion", "empathy", "urgency", "tone"],
    hippocampus: ["memory", "recall", "facts", "forgot"],
    prefrontalCortex: ["reasoning", "model", "complex", "incomplete"],
    cerebellum: ["quality", "validation"],
    mirrorNeurons: ["style", "language", "user model"],
    predictiveEngine: ["prediction", "anticipat", "pattern"],
    basalGanglia: ["habit", "routine", "automated"],
  };

  for (const [mod, keywords] of Object.entries(moduleIssueKeywords)) {
    if (modules.includes(mod) && keywords.some((kw) => issueText.includes(kw))) {
      blamedModules.add(mod);
    }
  }

  // Redistribute: blamed modules get less credit (or negative if reward < 0)
  const blamedPenalty = blamedModules.size > 0 ? 0.3 / blamedModules.size : 0;
  const bonusForClean =
    blamedModules.size > 0 ? 0.3 / (modules.length - blamedModules.size || 1) : 0;

  for (const mod of modules) {
    if (blamedModules.has(mod)) {
      credit[mod] = Math.max(0, baseShare - blamedPenalty);
    } else {
      credit[mod] = baseShare + bonusForClean;
    }
  }

  // Normalize to sum = 1
  const total = Object.values(credit).reduce((s, v) => s + v, 0);
  if (total > 0) {
    for (const mod of Object.keys(credit)) {
      credit[mod] = credit[mod] / total;
    }
  }

  return credit;
}

// ── Neuromodulator Updates ──────────────────────────────────────────

function updateDopamine(predictionError: number, config: BrainAgentConfig): void {
  // Dopamine rises on positive surprise, falls on disappointment
  const baseline = config.neuromodulators.baselineDopamine;
  const decay = config.neuromodulators.dopamineDecayRate;

  // Spike on prediction error
  const spike = predictionError * 0.5;
  state.dopamine = state.dopamine * (1 - decay) + (baseline + spike) * decay;
  state.dopamine = Math.max(0, Math.min(1, state.dopamine));
}

function updateSerotonin(reward: number): void {
  // Serotonin tracks overall mood — running average of rewards
  const alpha = 0.15;
  positiveOutcomeRatio = positiveOutcomeRatio * (1 - alpha) + (reward > 0 ? 1 : 0) * alpha;
  state.serotonin = 0.3 + positiveOutcomeRatio * 0.5;
  state.serotonin = Math.max(0.1, Math.min(0.95, state.serotonin));
}

function updateNorepinephrine(complexity: string, emotion: string): void {
  // Norepinephrine spikes on high complexity or urgent/stressful emotions
  const complexityBoost: Record<string, number> = {
    trivial: 0.1,
    simple: 0.2,
    moderate: 0.4,
    complex: 0.7,
    extreme: 0.9,
  };
  const emotionBoost: Record<string, number> = {
    urgency: 0.8,
    anxiety: 0.6,
    frustration: 0.5,
    anger: 0.7,
    confusion: 0.4,
    curiosity: 0.3,
    neutral: 0.1,
    joy: 0.1,
    gratitude: 0.1,
    sadness: 0.3,
  };

  const target = Math.max(complexityBoost[complexity] ?? 0.3, emotionBoost[emotion] ?? 0.2);

  const alpha = 0.3;
  state.norepinephrine = state.norepinephrine * (1 - alpha) + target * alpha;
  state.norepinephrine = Math.max(0.05, Math.min(0.95, state.norepinephrine));
}

function updateAcetylcholine(domain: string, _config: BrainAgentConfig): void {
  // Acetylcholine rises with novelty — if we see new domains or
  // interact less frequently, learning rate increases
  const noveltyRatio = totalInteractions > 10 ? noveltyCounter / totalInteractions : 0.5;

  // More novel = higher acetylcholine
  const target = 0.3 + noveltyRatio * 0.5;
  const alpha = 0.2;
  state.acetylcholine = state.acetylcholine * (1 - alpha) + target * alpha;
  state.acetylcholine = Math.max(0.1, Math.min(0.9, state.acetylcholine));
}

/**
 * Mark a domain observation as novel (called when thalamus sees
 * an unfamiliar topic or the predictive engine has no prediction).
 */
export function markNovelty(): void {
  noveltyCounter++;
}

// ── Getters ─────────────────────────────────────────────────────────

/** Get current neuromodulator levels */
export function getNeuromodulatorState(): NeuromodulatorState {
  return { ...state };
}

/** Get effective learning rate (modulated by acetylcholine and dopamine) */
export function getEffectiveLearningRate(
  baseLearningRate: number,
  config: BrainAgentConfig,
): number {
  const achBoost =
    1 + (state.acetylcholine - 0.5) * (config.neuromodulators.acetylcholineLearningBoost - 1);
  const dopamineBoost = 0.7 + state.dopamine * 0.6; // 0.7x to 1.3x
  return baseLearningRate * achBoost * dopamineBoost;
}

/** Get risk tolerance (modulated by serotonin) — affects exploration vs exploitation */
export function getRiskTolerance(): number {
  return state.serotonin;
}

/** Get attention level (modulated by norepinephrine) — affects memory retrieval depth */
export function getAttentionLevel(): number {
  return state.norepinephrine;
}

/** Statistics for diagnostics */
export function getDopamineStats(): {
  currentState: NeuromodulatorState;
  expectedReward: number;
  recentRewards: number;
  averageReward: number;
  totalInteractions: number;
  noveltyRatio: number;
} {
  const recent = rewardHistory.slice(-20);
  const avgReward =
    recent.length > 0 ? recent.reduce((s, r) => s + r.reward, 0) / recent.length : 0;

  return {
    currentState: { ...state },
    expectedReward,
    recentRewards: recent.length,
    averageReward: avgReward,
    totalInteractions,
    noveltyRatio: totalInteractions > 0 ? noveltyCounter / totalInteractions : 0,
  };
}
