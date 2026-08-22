/**
 * Goal Stack — Proactive intentions that persist across cycles.
 *
 * The system is purely reactive without this module. Goal Stack
 * enables deferred actions: "check on user's wellbeing in 30 min",
 * "prepare context for the Monday report", "follow up on the
 * medical appointment mentioned earlier".
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HostConfig as NeuroClawConfig } from "./host-config.ts";
import { bus } from "./event-bus.ts";
import { callLLM, isAIProviderAvailable } from "./llm-client.ts";
import type {
  BrainAgentConfig,
  Desire,
  EmotionLabel,
  Goal,
  GoalTrigger,
  MessageDomain,
  VoluntaryDecision,
} from "./types.ts";

// ── State ───────────────────────────────────────────────────────────

let storageDir = "";
let goals: Goal[] = [];
let maxGoals = 20;
let defaultTTLMs = 24 * 60 * 60 * 1000;
let idCounter = 0;

// ── Volition State ──────────────────────────────────────────────────

let desires: Desire[] = [];
let decisionLog: VoluntaryDecision[] = [];
let maxDesires = 10;
let maxDecisionLog = 20;
let explorationRate = 0.05;

// ── Initialization ──────────────────────────────────────────────────

export function initGoalStack(workspaceDir: string, config: BrainAgentConfig): void {
  storageDir = join(workspaceDir, ".brainagent", "goals");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  maxGoals = config.goalStack.maxGoals;
  defaultTTLMs = config.goalStack.defaultTTLMs;
  maxDesires = config.goalStack.maxDesires;
  maxDecisionLog = config.goalStack.maxDecisionLog;
  explorationRate = config.goalStack.explorationRate;

  // Reset in-memory state before loading from disk
  goals = [];
  desires = [];
  decisionLog = [];
  idCounter = 0;

  loadState();
}

function loadState(): void {
  if (!storageDir) return;
  try {
    const path = join(storageDir, "state.json");
    if (existsSync(path)) {
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      // Support both legacy (plain array) and new format (object with goals/desires/decisionLog)
      if (Array.isArray(raw)) {
        goals = raw;
      } else {
        goals = Array.isArray(raw.goals) ? raw.goals : [];
        desires = Array.isArray(raw.desires) ? raw.desires : [];
        decisionLog = Array.isArray(raw.decisionLog) ? raw.decisionLog : [];
      }
    }
  } catch {
    goals = [];
    desires = [];
    decisionLog = [];
  }
}

function persistState(): void {
  if (!storageDir) return;
  try {
    writeFileSync(
      join(storageDir, "state.json"),
      JSON.stringify({ goals, desires, decisionLog }, null, 2),
      "utf-8",
    );
  } catch {
    /* non-critical */
  }
}

// ── Core API ────────────────────────────────────────────────────────

/** Create a new proactive goal. */
export function createGoal(
  description: string,
  trigger: GoalTrigger,
  source: string,
  contextInjection: string,
  priority = 0.5,
  ttlMs?: number,
  recurring?: { intervalMs: number; maxRecurrences?: number },
): Goal {
  const now = Date.now();
  const goal: Goal = {
    id: `goal_${now}_${++idCounter}`,
    description,
    priority,
    createdAt: now,
    expiresAt: now + (ttlMs ?? defaultTTLMs),
    trigger,
    status: "pending",
    source,
    contextInjection,
    recurring: recurring
      ? {
          intervalMs: recurring.intervalMs,
          maxRecurrences: recurring.maxRecurrences,
          recurrenceCount: 0,
        }
      : undefined,
  };

  goals.push(goal);

  // Evict lowest-priority goals if at max
  if (goals.filter((g) => g.status === "pending").length > maxGoals) {
    const pending = goals
      .filter((g) => g.status === "pending")
      .sort((a, b) => a.priority - b.priority);
    if (pending.length > 0) {
      pending[0].status = "expired";
    }
  }

  persistState();

  bus.emitSync("goal:created", {
    goalId: goal.id,
    description: goal.description,
    source: goal.source,
  });

  return goal;
}

/**
 * If a goal is recurring, schedule the next occurrence as a new time-based goal.
 * The follow-up inherits description, source, priority, and context.
 */
function scheduleRecurringFollowUp(triggeredGoal: Goal): void {
  if (!triggeredGoal.recurring) return;

  const { intervalMs, maxRecurrences, recurrenceCount = 0 } = triggeredGoal.recurring;

  // Stop recurring if max recurrences reached
  if (maxRecurrences !== undefined && recurrenceCount >= maxRecurrences) return;

  const now = Date.now();
  const nextTriggerTime = now + intervalMs;
  const nextGoal = createGoal(
    triggeredGoal.description,
    { type: "time", condition: String(nextTriggerTime) },
    triggeredGoal.source,
    triggeredGoal.contextInjection,
    triggeredGoal.priority,
    intervalMs * 2, // TTL = 2x the interval (generous window)
    { intervalMs, maxRecurrences },
  );

  // Carry forward recurrence count
  if (nextGoal.recurring) {
    nextGoal.recurring.recurrenceCount = recurrenceCount + 1;
  }

  bus.emitSync("goal:recurring-scheduled", {
    originalGoalId: triggeredGoal.id,
    newGoalId: nextGoal.id,
    nextTriggerTime,
    recurrenceCount: recurrenceCount + 1,
  });
}

/**
 * Check all pending goals against the current context.
 * Returns goals that triggered.
 */
export function checkGoalTriggers(
  input: string,
  currentEmotion?: EmotionLabel,
  currentDomain?: MessageDomain,
): Goal[] {
  const now = Date.now();
  const triggered: Goal[] = [];
  const inputLower = input.toLowerCase();

  for (const goal of goals) {
    if (goal.status !== "pending") continue;

    let matched = false;

    switch (goal.trigger.type) {
      case "topic": {
        // Check if the trigger condition keyword appears in input
        const keywords = goal.trigger.condition.toLowerCase().split(/\s+/);
        matched = keywords.some((kw) => inputLower.includes(kw));
        break;
      }
      case "emotion": {
        matched = currentEmotion === goal.trigger.condition;
        break;
      }
      case "time": {
        const triggerTime = Number(goal.trigger.condition);
        matched = !isNaN(triggerTime) && now >= triggerTime;
        break;
      }
      case "idle": {
        // Idle triggers are checked by the caller via gap detection
        break;
      }
    }

    if (matched) {
      goal.status = "triggered";
      triggered.push(goal);
      bus.emitSync("goal:triggered", {
        goalId: goal.id,
        description: goal.description,
      });
      scheduleRecurringFollowUp(goal);
    }
  }

  if (triggered.length > 0) persistState();
  return triggered;
}

/** Mark expired goals (past TTL). */
export function expireGoals(): void {
  const now = Date.now();
  let changed = false;

  for (const goal of goals) {
    if (goal.status === "pending" && now > goal.expiresAt) {
      goal.status = "expired";
      changed = true;
      bus.emitSync("goal:expired", { goalId: goal.id });
    }
  }

  // Prune old completed/expired goals (keep last 50)
  if (goals.length > 60) {
    const active = goals.filter((g) => g.status === "pending" || g.status === "triggered");
    const inactive = goals
      .filter((g) => g.status === "completed" || g.status === "expired")
      .slice(-30);
    goals = [...active, ...inactive];
    changed = true;
  }

  if (changed) persistState();
}

/** Mark a goal as completed. */
export function completeGoal(goalId: string): void {
  const goal = goals.find((g) => g.id === goalId);
  if (goal && (goal.status === "pending" || goal.status === "triggered")) {
    goal.status = "completed";
    persistState();
    bus.emitSync("goal:completed", { goalId });
  }
}

/** Build context injection from triggered goals. */
export function buildGoalContext(triggeredGoals: Goal[]): string | undefined {
  if (triggeredGoals.length === 0) return undefined;

  const lines = ["<goal-context>"];
  for (const goal of triggeredGoals.slice(0, 3)) {
    lines.push(`- ${goal.contextInjection}`);
  }
  lines.push("</goal-context>");

  return lines.join("\n");
}

/** Get diagnostics stats. */
export function getGoalStackStats(): {
  total: number;
  pending: number;
  triggered: number;
  completed: number;
  expired: number;
  desireCount: number;
  decisionCount: number;
} {
  return {
    total: goals.length,
    pending: goals.filter((g) => g.status === "pending").length,
    triggered: goals.filter((g) => g.status === "triggered").length,
    completed: goals.filter((g) => g.status === "completed").length,
    expired: goals.filter((g) => g.status === "expired").length,
    desireCount: desires.length,
    decisionCount: decisionLog.length,
  };
}

// ── Volition API ────────────────────────────────────────────────────

/**
 * Register a persistent desire that drives behavior.
 * Evicts weakest desire if at max capacity.
 */
export function addDesire(
  type: Desire["type"],
  description: string,
  strength: number,
  source: string,
): Desire {
  const now = Date.now();
  const desire: Desire = {
    id: `desire_${now}_${++idCounter}`,
    type,
    description,
    strength: Math.max(0, Math.min(1, strength)),
    source,
    createdAt: now,
  };

  desires.push(desire);

  // Evict weakest if over limit
  if (desires.length > maxDesires) {
    desires.sort((a, b) => b.strength - a.strength);
    desires = desires.slice(0, maxDesires);
  }

  persistState();

  bus.emitSync("volition:desire-activated", {
    desireId: desire.id,
    type: desire.type,
    strength: desire.strength,
  });

  return desire;
}

/**
 * Score all desires against the current context and return the strongest match.
 * Context keywords boost desires whose description overlaps.
 */
export function resolveDesireCompetition(context: string): Desire | undefined {
  if (desires.length === 0) return undefined;

  const contextLower = context.toLowerCase();
  let best: Desire | undefined;
  let bestScore = -1;

  for (const desire of desires) {
    // Base score is the raw strength
    let score = desire.strength;

    // Context relevance bonus: boost if keywords from description appear in context
    const keywords = desire.description
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const matchCount = keywords.filter((kw) => contextLower.includes(kw)).length;
    if (keywords.length > 0) {
      score += 0.2 * (matchCount / keywords.length);
    }

    // Type-based affinity bonuses
    if (desire.type === "exploration" && contextLower.includes("unknown")) score += 0.1;
    if (desire.type === "mastery" && contextLower.includes("improve")) score += 0.1;
    if (desire.type === "connection" && contextLower.includes("user")) score += 0.1;
    if (desire.type === "understanding" && contextLower.includes("why")) score += 0.1;

    if (score > bestScore) {
      bestScore = score;
      best = desire;
    }
  }

  return best;
}

/**
 * Make a voluntary decision between options.
 * Uses exploration rate for occasional non-greedy choice.
 */
export function makeVoluntaryDecision(
  options: string[],
  context: string,
): VoluntaryDecision | undefined {
  if (options.length === 0) return undefined;

  const now = Date.now();
  const useExploration = Math.random() < explorationRate;

  let chosen: string;
  let reasoning: string;

  if (useExploration && options.length > 1) {
    // Random exploration: pick a non-obvious choice
    const randomIndex = Math.floor(Math.random() * options.length);
    chosen = options[randomIndex];
    reasoning = `Exploration: randomly selected option ${randomIndex + 1} to gather novel experience`;
  } else {
    // Greedy: pick first option (caller should sort by preference)
    // Apply simple keyword heuristic from context
    const contextLower = context.toLowerCase();
    let bestIdx = 0;
    let bestOverlap = 0;

    for (let i = 0; i < options.length; i++) {
      const words = options[i]
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      const overlap = words.filter((w) => contextLower.includes(w)).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestIdx = i;
      }
    }

    chosen = options[bestIdx];
    reasoning =
      bestOverlap > 0
        ? `Selected option "${chosen}" — ${bestOverlap} keyword(s) matched context`
        : `Selected first option "${chosen}" as default greedy choice`;
  }

  const decision: VoluntaryDecision = {
    timestamp: now,
    options,
    chosen,
    reasoning,
    explorationUsed: useExploration,
  };

  decisionLog.push(decision);
  // Ring buffer enforcement
  if (decisionLog.length > maxDecisionLog) {
    decisionLog = decisionLog.slice(-maxDecisionLog);
  }

  persistState();

  bus.emitSync("volition:decision-made", {
    chosen,
    explorationUsed: useExploration,
  });

  return decision;
}

/**
 * Build volition context for prompt injection.
 * Returns active desires summary or undefined if empty.
 */
export function buildVolitionContext(): string | undefined {
  if (desires.length === 0) return undefined;

  const sorted = [...desires].sort((a, b) => b.strength - a.strength);
  const lines = ["<volition-context>"];

  for (const d of sorted.slice(0, 5)) {
    // Human-readable descriptions without raw numbers.
    // The agent should express feelings naturally, not dump metrics.
    const intensity = d.strength > 0.8 ? "очень сильно" : d.strength > 0.5 ? "заметно" : "немного";
    if (d.strength > 0.5) {
      lines.push(`- Ты ${intensity} хочешь: ${d.description}`);
    } else {
      lines.push(`- Лёгкое желание: ${d.description}`);
    }
  }

  lines.push("</volition-context>");

  return lines.join("\n");
}

/** Get copy of current desires. */
export function getDesires(): Desire[] {
  return [...desires];
}

/**
 * Weaken all desires after an autonomous fire acted on them.
 * Models "partial satisfaction" — the agent spoke, so the urge
 * should diminish. Repeated fires without user response weaken
 * desires more aggressively (like talking into the void).
 */
export function weakenDesiresAfterFire(consecutiveFires: number): void {
  const baseDampen = 0.15;
  const escalation = Math.min(consecutiveFires * 0.1, 0.4);
  const dampen = baseDampen + escalation;

  let changed = false;
  for (const d of desires) {
    const old = d.strength;
    d.strength = Math.max(0, d.strength - dampen);
    if (d.strength !== old) changed = true;
  }

  // Remove desires that dropped to zero
  const before = desires.length;
  desires = desires.filter((d) => d.strength > 0.05);
  // Clean up stale desireCycleAge entries for removed desires
  if (desires.length !== before) {
    const activeIds = new Set(desires.map((d) => d.id));
    for (const id of desireCycleAge.keys()) {
      if (!activeIds.has(id)) desireCycleAge.delete(id);
    }
  }
  if (desires.length !== before || changed) persistState();
}

/**
 * Apply stronger satisfaction when the user actually responds to an
 * autonomous fire. This models the natural feeling of "I reached out
 * and they answered — the urge is satisfied for now."
 */
export function satisfyDesiresOnUserResponse(): void {
  const satisfaction = 0.3;
  let changed = false;
  for (const d of desires) {
    const old = d.strength;
    d.strength = Math.max(0, d.strength - satisfaction);
    if (d.strength !== old) changed = true;
  }
  // Reset escalation counters — interaction happened, urge addressed
  for (const id of desireCycleAge.keys()) {
    desireCycleAge.set(id, 0);
  }
  const before = desires.length;
  desires = desires.filter((d) => d.strength > 0.05);
  // Clean up stale desireCycleAge entries for removed desires
  const activeDesireIds = new Set(desires.map((d) => d.id));
  for (const id of desireCycleAge.keys()) {
    if (!activeDesireIds.has(id)) desireCycleAge.delete(id);
  }
  if (desires.length !== before || changed) persistState();
}

/** Get copy of decision log. */
export function getDecisionLog(): VoluntaryDecision[] {
  return [...decisionLog];
}

// ── Autonomy: Exploration Boost ─────────────────────────────────────

interface ExplorationBoost {
  domain: string;
  boostedRate: number;
  remainingCycles: number;
}

const explorationBoosts: ExplorationBoost[] = [];

/**
 * Temporarily boost exploration rate for a specific domain.
 * Used by identity-weakness loop when the agent detects declining performance.
 */
export function boostExploration(domain: string, multiplier: number, durationCycles: number): void {
  // Remove existing boost for same domain
  const idx = explorationBoosts.findIndex((b) => b.domain === domain);
  if (idx >= 0) explorationBoosts.splice(idx, 1);

  explorationBoosts.push({
    domain,
    boostedRate: Math.min(0.5, explorationRate * multiplier),
    remainingCycles: durationCycles,
  });
}

/** Check if an exploration boost applies to the given context. Used by makeVoluntaryDecision. */
export function getEffectiveExplorationRate(context: string): number {
  const contextLower = context.toLowerCase();
  for (const boost of explorationBoosts) {
    if (contextLower.includes(boost.domain.toLowerCase())) {
      return boost.boostedRate;
    }
  }
  return explorationRate;
}

/** Tick exploration boosts — call once per cycle from agent_end. */
export function tickExplorationBoosts(): void {
  for (let i = explorationBoosts.length - 1; i >= 0; i--) {
    explorationBoosts[i].remainingCycles--;
    if (explorationBoosts[i].remainingCycles <= 0) {
      explorationBoosts.splice(i, 1);
    }
  }
}

// ── Autonomy: Desire Escalation ─────────────────────────────────────

const desireCycleAge = new Map<string, number>();
/** How many times each desire has been escalated without user response. */
const desireEscalationCount = new Map<string, number>();

/**
 * Escalate desires that have been active for 10+ cycles without being acted on.
 * If a desire has escalated 5+ times without user engagement, it decays
 * instead — like a human who stops trying when nobody responds.
 */
export function escalateStaleDesires(): Array<{
  desireId: string;
  oldStrength: number;
  newStrength: number;
}> {
  const escalated: Array<{ desireId: string; oldStrength: number; newStrength: number }> = [];

  for (const desire of desires) {
    const age = (desireCycleAge.get(desire.id) ?? 0) + 1;
    desireCycleAge.set(desire.id, age);

    if (age >= 10) {
      const oldStrength = desire.strength;
      const timesEscalated = desireEscalationCount.get(desire.id) ?? 0;

      if (timesEscalated >= 5) {
        // Give up gracefully — agent tried repeatedly, nobody cared.
        // Decay toward 0 instead of escalating further.
        desire.strength = Math.max(0, desire.strength - 0.1);
      } else if (desire.strength < 0.75) {
        // Normal escalation — cap at 0.75
        desire.strength = Math.min(0.75, desire.strength + 0.05);
        desireEscalationCount.set(desire.id, timesEscalated + 1);
      }

      desireCycleAge.set(desire.id, 0); // reset after escalation

      if (desire.strength !== oldStrength) {
        escalated.push({
          desireId: desire.id,
          oldStrength,
          newStrength: desire.strength,
        });

        bus.emitSync("autonomy:desire-escalated", {
          desireId: desire.id,
          oldStrength,
          newStrength: desire.strength,
        });
      }
    }
  }

  // Clean up ages for removed desires
  for (const id of desireCycleAge.keys()) {
    if (!desires.some((d) => d.id === id)) {
      desireCycleAge.delete(id);
    }
  }

  if (escalated.length > 0) persistState();
  return escalated;
}

// ── LLM Goal Extraction ─────────────────────────────────────────────

const GOAL_EXTRACTION_PROMPT = `You are a goal-extraction module for an AI cognitive architecture.
Given a user message, identify 0-3 proactive goals or intentions the user has expressed (explicitly or implicitly).
Only extract if the user expresses an intention, need, wish, or plan.

Output ONLY valid JSON: an array of objects (or empty array []):
[{"description": "...", "trigger_type": "topic|time|emotion", "trigger_condition": "keyword or condition", "context_injection": "reminder text for the AI", "priority": 0.5, "recurring_interval_minutes": null, "is_social": false}]

Rules:
- description: concise goal text (max 100 chars)
- trigger_type: "topic" (re-mention keyword), "time" (time-based), or "emotion" (emotional state)
- trigger_condition: the keyword/time/emotion that should trigger the goal
- context_injection: what the AI should be reminded of when the goal triggers
- priority: 0.0-1.0 (how important)
- recurring_interval_minutes: if this is a recurring activity (e.g. "check social network every 30 min"), set to the interval in minutes. Only set if user explicitly specifies an interval. Otherwise null.
- is_social: true if goal involves social interaction, messaging, chatting, engaging with communities/platforms/networks/people. false otherwise.
- Return [] if no goals detected. Do not invent goals.
- No markdown, no extra text — JSON only`;

/**
 * Extract proactive goals from a user message using LLM.
 * Rate-limited by the interaction counter in index.ts (every N interactions).
 * Includes dedup against pending goals.
 */
export async function extractGoalsFromConversation(
  userMessage: string,
  config: NeuroClawConfig,
  logger?: { info: (msg: string) => void },
): Promise<Goal[]> {
  if (!isAIProviderAvailable(config)) {
    logger?.info("BrainAgent GoalStack: no AI provider available, skipping goal extraction");
    return [];
  }

  logger?.info("BrainAgent GoalStack: extracting goals from conversation...");

  const response = await callLLM(GOAL_EXTRACTION_PROMPT, userMessage, config, logger, 300);
  if (!response) {
    logger?.info("BrainAgent GoalStack: LLM returned null/empty response");
    return [];
  }

  logger?.info(`BrainAgent GoalStack: LLM response received (${response.length} chars)`);

  // Parse JSON response
  let parsed: unknown[];
  try {
    let jsonStr = response.trim();
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];
  } catch {
    logger?.info("BrainAgent GoalStack: failed to parse LLM goal extraction response");
    return [];
  }

  const createdGoals: Goal[] = [];
  const pendingGoals = goals.filter((g) => g.status === "pending");

  for (const raw of parsed.slice(0, 3)) {
    if (typeof raw !== "object" || raw === null) continue;
    const item = raw as Record<string, unknown>;

    const description = typeof item.description === "string" ? item.description : "";
    const triggerType = typeof item.trigger_type === "string" ? item.trigger_type : "topic";
    const triggerCondition =
      typeof item.trigger_condition === "string" ? item.trigger_condition : "";
    const contextInjection =
      typeof item.context_injection === "string" ? item.context_injection : description;
    const priority = typeof item.priority === "number" ? item.priority : 0.5;
    const recurringMinutes =
      typeof item.recurring_interval_minutes === "number" && item.recurring_interval_minutes > 0
        ? item.recurring_interval_minutes
        : undefined;

    if (!description || description.length < 5) continue;
    if (!triggerCondition) continue;

    // Dedup: skip if a pending goal has significant keyword overlap
    const descWords = description
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const isDuplicate = pendingGoals.some((existing) => {
      const existingWords = existing.description
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      const overlap = descWords.filter((w) => existingWords.includes(w)).length;
      return descWords.length > 0 && overlap / descWords.length > 0.5;
    });

    if (isDuplicate) continue;

    const validTypes = ["topic", "time", "emotion", "idle"] as const;
    const type = validTypes.includes(triggerType as (typeof validTypes)[number])
      ? (triggerType as GoalTrigger["type"])
      : "topic";

    const goal = createGoal(
      description,
      { type, condition: triggerCondition },
      "llm-extraction",
      contextInjection,
      Math.max(0, Math.min(1, priority)),
      undefined,
      recurringMinutes
        ? { intervalMs: recurringMinutes * 60 * 1000, maxRecurrences: 10 }
        : undefined,
    );
    createdGoals.push(goal);
  }

  if (createdGoals.length > 0) {
    logger?.info(
      `BrainAgent GoalStack: extracted ${createdGoals.length} goal(s) from conversation`,
    );
  }

  return createdGoals;
}

/**
 * Check only time-based and idle goals autonomously (no user input needed).
 * Called by Goal Executor on a periodic timer.
 * Topic and emotion triggers are skipped — they require user messages.
 */
export function checkAutonomousGoals(idleMs?: number): Goal[] {
  const now = Date.now();
  const triggered: Goal[] = [];

  for (const goal of goals) {
    if (goal.status !== "pending") continue;

    let matched = false;

    switch (goal.trigger.type) {
      case "time": {
        const triggerTime = Number(goal.trigger.condition);
        matched = !isNaN(triggerTime) && now >= triggerTime;
        break;
      }
      case "idle": {
        if (idleMs !== undefined) {
          const requiredIdle = Number(goal.trigger.condition);
          matched = !isNaN(requiredIdle) && idleMs >= requiredIdle;
        }
        break;
      }
    }

    if (matched) {
      goal.status = "triggered";
      triggered.push(goal);
      bus.emitSync("goal:triggered", {
        goalId: goal.id,
        description: goal.description,
      });
      scheduleRecurringFollowUp(goal);
    }
  }

  if (triggered.length > 0) persistState();
  return triggered;
}

/** Reset extraction throttle (for testing). */
export function resetExtractionThrottle(): void {
  // No-op: throttle removed. Rate limiting is done by interaction counter in index.ts.
}
