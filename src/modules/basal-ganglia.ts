/**
 * Basal Ganglia — Habit formation, routine automation, and reinforcement learning.
 *
 * In the brain, the basal ganglia are responsible for:
 * - Learning habits through repetition
 * - Automating motor programs so you don't think about walking
 * - The reward system (dopamine): "that worked well → do it again"
 * - Switching between automatic and controlled behavior
 *
 * This module implements the habit loop: CUE → ROUTINE → REWARD
 *
 * When the agent sees a request it has handled successfully before,
 * instead of engaging the full Prefrontal Cortex (expensive LLM call),
 * the Basal Ganglia kick in and provide an automated response path.
 *
 * Over time, the system learns:
 * - Which request patterns are routine (and can be fast-tracked)
 * - Which tool sequences work well for specific request types
 * - Which response strategies get positive feedback
 *
 * This is the brain's energy-saving mechanism. You don't solve
 * differential equations to tie your shoes — the basal ganglia do it.
 *
 * v0.6.3 (волна 1 миграции на per-instance состояние, пакет B2):
 *  - фабрика `createBasalGanglia()` создаёт инстанс со своими привычками,
 *    векторным индексом и персистентностью;
 *  - module-level `let` остался один — слот активного инстанса;
 *    обёртки до инициализации лениво используют detached-инстанс
 *    (без персистентности), как раньше работали на состоянии по умолчанию;
 *  - чистые функции без состояния (detectReinforcement, buildHabitContext,
 *    detectReinforcementWithAI) остались свободными.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HostConfig as NeuroClawConfig } from "./host-config.ts";
import { callLLM } from "./llm-client.ts";
import { VectorIndex } from "./vector-engine.ts";
import { classifyFeedback } from "./i18n-heuristics.ts";

// ── Types ───────────────────────────────────────────────────────────

export type Habit = {
  id: string;
  /** The cue: normalized pattern of the triggering request */
  cue: string;
  /** The routine: sequence of actions/tools used */
  routine: string[];
  /** What domain this habit serves */
  domain: string;
  /** Reward signal: success rate from reinforcement (0-1) */
  rewardSignal: number;
  /** How many times this habit has been activated */
  activationCount: number;
  /** How many times the user gave positive feedback */
  positiveReinforcements: number;
  /** How many times the user corrected/rejected the result */
  negativeReinforcements: number;
  /** When the habit was last activated */
  lastActivated: number;
  /** When the habit was created */
  createdAt: number;
  /** Example responses that worked well (last 3) */
  exampleResponses: string[];
};

export type HabitMatch = {
  habit: Habit;
  /** How well the current input matches this habit (0-1) */
  matchScore: number;
  /** Whether this habit is strong enough to use automatically */
  autoExecute: boolean;
};

export type ReinforcementSignal = "positive" | "negative" | "neutral";

export type BasalStats = {
  totalHabits: number;
  automatedHabits: number;
  averageReward: number;
  totalActivations: number;
};

export type BasalGangliaInstance = {
  findHabit(input: string, domain: string): HabitMatch | undefined;
  recordPattern(cue: string, routine: string[], domain: string, exampleResponse?: string): Habit;
  reinforce(habitId: string, signal: ReinforcementSignal): void;
  getStats(): BasalStats;
};

// ── Константы (без состояния) ───────────────────────────────────────

/** Minimum activations before a habit can auto-execute */
const MIN_ACTIVATIONS_FOR_AUTO = 3;
/** Minimum reward signal for auto-execution */
const MIN_REWARD_FOR_AUTO = 0.6;
/** Maximum habits to store */
const MAX_HABITS = 200;

// ── Фабрика ─────────────────────────────────────────────────────────

export function createBasalGanglia(workspaceDir: string): BasalGangliaInstance {
  const storageDir = workspaceDir ? join(workspaceDir, ".brainagent", "habits") : "";

  let habits: Habit[] = [];
  let habitIndex = new VectorIndex();
  let idCounter = 0;

  function nextHabitId(): string {
    return `hab-${Date.now()}-${++idCounter}`;
  }

  if (storageDir && !existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  function loadHabits(): void {
    if (!storageDir) return;
    try {
      const path = join(storageDir, "habits.json");
      if (existsSync(path)) {
        habits = JSON.parse(readFileSync(path, "utf-8")) as Habit[];
      }
    } catch {
      habits = [];
    }
  }

  function persistHabits(): void {
    if (!storageDir) return;
    try {
      writeFileSync(join(storageDir, "habits.json"), JSON.stringify(habits, null, 2), "utf-8");
    } catch {
      /* non-critical */
    }
  }

  function rebuildIndex(): void {
    for (const habit of habits) {
      habitIndex.add(habit.id, `${habit.cue} ${habit.domain} ${habit.routine.join(" ")}`);
    }
  }

  loadHabits();
  rebuildIndex();

  // ── Habit matching ────────────────────────────────────────────────

  function findHabit(input: string, domain: string): HabitMatch | undefined {
    if (habits.length === 0) return undefined;

    // Search vector index for similar habits
    const results = habitIndex.search(`${input} ${domain}`, 5, 0.2);
    if (results.length === 0) return undefined;

    let bestMatch: HabitMatch | undefined;
    let bestScore = 0;

    for (const result of results) {
      const habit = habits.find((h) => h.id === result.id);
      if (!habit) continue;

      // Combine vector similarity with reward signal
      const matchScore =
        result.score * 0.5 + habit.rewardSignal * 0.3 + (habit.domain === domain ? 0.2 : 0);

      if (matchScore > bestScore) {
        bestScore = matchScore;

        // Auto-execute only if the habit is well-established
        const autoExecute =
          habit.activationCount >= MIN_ACTIVATIONS_FOR_AUTO &&
          habit.rewardSignal >= MIN_REWARD_FOR_AUTO &&
          result.score > 0.5; // High confidence match

        bestMatch = { habit, matchScore, autoExecute };
      }
    }

    return bestMatch;
  }

  // ── Habit formation ───────────────────────────────────────────────

  function recordPattern(
    cue: string,
    routine: string[],
    domain: string,
    exampleResponse?: string,
  ): Habit {
    // Check if this matches an existing habit
    const existing = habitIndex.search(`${cue} ${domain}`, 1, 0.6);
    if (existing.length > 0) {
      const habit = habits.find((h) => h.id === existing[0].id);
      if (habit) {
        // Strengthen existing habit
        habit.activationCount++;
        habit.lastActivated = Date.now();

        // Update routine if it evolved
        if (routine.length > 0 && JSON.stringify(routine) !== JSON.stringify(habit.routine)) {
          // Blend: keep the longer/more detailed routine
          if (routine.length >= habit.routine.length) {
            habit.routine = routine;
          }
        }

        // Store example response
        if (exampleResponse) {
          habit.exampleResponses.push(exampleResponse.slice(0, 500));
          if (habit.exampleResponses.length > 3) {
            habit.exampleResponses = habit.exampleResponses.slice(-3);
          }
        }

        // Re-index
        habitIndex.add(habit.id, `${habit.cue} ${habit.domain} ${habit.routine.join(" ")}`);
        persistHabits();
        return habit;
      }
    }

    // Create new habit
    const habit: Habit = {
      id: nextHabitId(),
      cue,
      routine,
      domain,
      rewardSignal: 0.5, // Neutral start
      activationCount: 1,
      positiveReinforcements: 0,
      negativeReinforcements: 0,
      lastActivated: Date.now(),
      createdAt: Date.now(),
      exampleResponses: exampleResponse ? [exampleResponse.slice(0, 500)] : [],
    };

    habits.push(habit);
    habitIndex.add(habit.id, `${cue} ${domain} ${routine.join(" ")}`);

    // Prune if over limit
    if (habits.length > MAX_HABITS) {
      pruneWeakHabits();
    }

    persistHabits();
    return habit;
  }

  // ── Reinforcement learning ────────────────────────────────────────

  function reinforce(habitId: string, signal: ReinforcementSignal): void {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;

    const alpha = 0.2; // Learning rate

    switch (signal) {
      case "positive":
        habit.positiveReinforcements++;
        habit.rewardSignal = habit.rewardSignal * (1 - alpha) + 1.0 * alpha;
        break;
      case "negative":
        habit.negativeReinforcements++;
        habit.rewardSignal = habit.rewardSignal * (1 - alpha) + 0.0 * alpha;
        break;
      case "neutral":
        // No change to reward, but count as activation
        habit.rewardSignal = habit.rewardSignal * (1 - alpha * 0.5) + 0.5 * (alpha * 0.5);
        break;
    }

    // Clamp to [0, 1]
    habit.rewardSignal = Math.max(0, Math.min(1, habit.rewardSignal));

    persistHabits();
  }

  // ── Habit pruning ─────────────────────────────────────────────────

  function pruneWeakHabits(): void {
    // Score each habit
    const scored = habits.map((h) => ({
      habit: h,
      score:
        h.rewardSignal * 0.4 +
        Math.min(h.activationCount / 10, 1) * 0.4 +
        (1 / (1 + (Date.now() - h.lastActivated) / (7 * 24 * 60 * 60 * 1000))) * 0.2,
    }));

    scored.sort((a, b) => b.score - a.score);

    // Keep top MAX_HABITS, remove the rest
    const toKeep = scored.slice(0, MAX_HABITS).map((s) => s.habit);
    const toRemove = scored.slice(MAX_HABITS).map((s) => s.habit);

    for (const h of toRemove) {
      habitIndex.remove(h.id);
    }

    habits = toKeep;
  }

  // ── Stats ─────────────────────────────────────────────────────────

  function getStats(): BasalStats {
    const automated = habits.filter(
      (h) => h.activationCount >= MIN_ACTIVATIONS_FOR_AUTO && h.rewardSignal >= MIN_REWARD_FOR_AUTO,
    ).length;
    const avgReward =
      habits.length > 0 ? habits.reduce((sum, h) => sum + h.rewardSignal, 0) / habits.length : 0;
    const totalAct = habits.reduce((sum, h) => sum + h.activationCount, 0);

    return {
      totalHabits: habits.length,
      automatedHabits: automated,
      averageReward: avgReward,
      totalActivations: totalAct,
    };
  }

  return { findHabit, recordPattern, reinforce, getStats };
}

// ── Reinforcement detection (чистые функции, без состояния) ─────────

/**
 * Detect reinforcement signal from user message.
 * Работает на общем банке RU/EN эвристик (i18n-heuristics, v0.2.0):
 * отвержение («не надо», «хватит») считается негативным сигналом.
 */
export function detectReinforcement(text: string): ReinforcementSignal {
  const signal = classifyFeedback(text).signal;
  if (signal === "positive") return "positive";
  if (signal === "negative" || signal === "rejection") return "negative";
  return "neutral";
}

// ── LLM-enhanced reinforcement detection ────────────────────────────

const REINFORCEMENT_PROMPT = `You are a reinforcement signal detector for a conversational AI system.

Your task: analyze the user's message and determine if it contains feedback about the AI's previous response.

Classification:
- "positive": user is satisfied, pleased, grateful, approving (even implicitly)
- "negative": user is correcting, dissatisfied, re-asking, or the previous answer was wrong
- "neutral": no feedback about previous interaction quality

IMPORTANT:
- Detect IMPLICIT feedback, not just keywords. "Well, the first version was better" = negative.
- "Can you also..." after accepting = positive (they liked it, want more).
- Sarcasm like "great, now nothing works" = negative.
- Simple follow-up questions with no sentiment = neutral.
- "ok" / "ладно" alone = neutral (acknowledgment, not praise).

Respond with ONLY a JSON object:
{"signal": "positive"|"negative"|"neutral", "confidence": 0.0-1.0}`;

/**
 * Detect reinforcement signal using LLM for nuanced understanding.
 * Falls back to pattern-based detection if LLM is unavailable or fails.
 */
export async function detectReinforcementWithAI(
  text: string,
  config: NeuroClawConfig,
  logger?: { info: (msg: string) => void },
): Promise<ReinforcementSignal> {
  const content = await callLLM(REINFORCEMENT_PROMPT, text, config, logger, 100);
  if (!content) return detectReinforcement(text);

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return detectReinforcement(text);

    const parsed = JSON.parse(jsonMatch[0]) as { signal?: string; confidence?: number };
    const signal = parsed.signal;
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;

    if (signal === "positive" && confidence >= 0.5) return "positive";
    if (signal === "negative" && confidence >= 0.5) return "negative";
    if (signal === "neutral") return "neutral";

    // Low-confidence AI result — fall back to patterns
    return detectReinforcement(text);
  } catch {
    return detectReinforcement(text);
  }
}

// ── Build context hint for the prompt (чистая функция) ──────────────

/**
 * Build a context hint about matching habits for the prefrontal cortex.
 * If a habit matches, tell the LLM about the learned pattern so it
 * can leverage it.
 */
export function buildHabitContext(match: HabitMatch): string {
  const h = match.habit;
  const lines: string[] = [
    "## Learned Habit Available (Basal Ganglia)",
    `Pattern: "${h.cue}"`,
    `Domain: ${h.domain}`,
    `Success rate: ${(h.rewardSignal * 100).toFixed(0)}% (${h.activationCount} activations)`,
  ];

  if (h.routine.length > 0) {
    lines.push(`Known routine: ${h.routine.join(" → ")}`);
  }

  if (h.exampleResponses.length > 0) {
    lines.push("Previous successful response approach:");
    lines.push(`  "${h.exampleResponses[h.exampleResponses.length - 1]}"`);
  }

  if (match.autoExecute) {
    lines.push("This is a well-established habit. Follow the learned pattern for efficiency.");
  } else {
    lines.push("This pattern is still being learned. Use as a reference but apply judgment.");
  }

  return lines.join("\n");
}

// ── Слот активного инстанса (обратная совместимость) ────────────────

let active: BasalGangliaInstance | undefined;

/** Инстанс без персистентности — для вызовов до инициализации. */
function current(): BasalGangliaInstance {
  return active ?? (active = createBasalGanglia(""));
}

// ── Initialization ──────────────────────────────────────────────────

export function initBasalStorage(workspaceDir: string): void {
  active = createBasalGanglia(workspaceDir);
}

// ── Core API (обёртки над активным инстансом) ───────────────────────

/**
 * Try to find a matching habit for the given input.
 * Returns the best match with auto-execute flag.
 */
export function findHabit(input: string, domain: string): HabitMatch | undefined {
  return current().findHabit(input, domain);
}

/**
 * Record a new interaction pattern.
 * If similar enough to an existing habit, strengthens it.
 * If novel, creates a new habit.
 */
export function recordPattern(
  cue: string,
  routine: string[],
  domain: string,
  exampleResponse?: string,
): Habit {
  return current().recordPattern(cue, routine, domain, exampleResponse);
}

/**
 * Apply reinforcement signal to a habit.
 */
export function reinforce(habitId: string, signal: ReinforcementSignal): void {
  current().reinforce(habitId, signal);
}

export function getBasalStats(): BasalStats {
  return current().getStats();
}
