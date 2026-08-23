/**
 * Drive Arbiter — Intelligent arbitration between competing biological drives.
 *
 * In the human brain, competing motivational signals (hunger, curiosity,
 * social bonding, creative urge) don't just fight for attention randomly —
 * the basal ganglia and prefrontal cortex perform sophisticated arbitration
 * based on urgency, recent reward history, recency, and the current context.
 *
 * This module does the same for BrainAgent: when multiple drives are active
 * simultaneously, the arbiter scores each one using a multi-factor formula
 * and selects a winner. Over time, it learns from dopamine reward signals
 * which drives lead to the best outcomes, adapting its weights accordingly.
 *
 * Scoring formula:
 *   score = urgency * 0.35 + rewardWeight * 0.25 + recencyBonus * 0.15
 *         + userContextBonus * 0.15 + interoBonus * 0.10
 *
 * Key properties:
 *  - No fixed timers — arbitration is triggered by bus events (drive need-rising, urge).
 *  - Exploration: configurable probability of selecting a non-optimal drive
 *    to prevent getting stuck in local optima.
 *  - Reward learning: dopamine signals update per-drive weights so the system
 *    learns which drives produce better outcomes in which contexts.
 *  - Recency penalty: recently-selected drives are discounted to prevent
 *    one drive from monopolizing all autonomous actions.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cancelPersist, flushPersist, schedulePersist } from "./persist.ts";
import { bus } from "./event-bus.ts";
import type {
  BrainAgentConfig,
  CognitiveHungerStats,
  CreativeDriveStats,
  DopamineSignal,
  MasteryDriveStats,
  SocialDriveStats,
  UserModel,
} from "./types.ts";

// ── Types ─────────────────────────────────────────────────────────

type DriveId = "social" | "cognitive" | "creative" | "mastery";

type DriveScore = {
  driveId: DriveId;
  urgency: number;
  rewardWeight: number;
  recencyBonus: number;
  userContextBonus: number;
  interoBonus: number;
  totalScore: number;
};

type ConflictLogEntry = {
  timestamp: number;
  competing: DriveId[];
  winner: DriveId;
  scores: Record<DriveId, number>;
  explorationUsed: boolean;
};

type PersistedState = {
  driveWeights: Record<DriveId, number>;
  lastSelectedDrive: DriveId | null;
  lastSelectionTime: number;
  conflictLog: ConflictLogEntry[];
  totalArbitrations: number;
};

type DriveStatGetters = {
  getSocialDriveStats?: () => SocialDriveStats;
  getCognitiveHungerStats?: () => CognitiveHungerStats;
  getCreativeDriveStats?: () => CreativeDriveStats;
  getMasteryDriveStats?: () => MasteryDriveStats;
  getUserModel?: () => UserModel | undefined;
  getInteroceptivePattern?: () => string | null;
};

export type DriveArbiterStats = {
  driveWeights: Record<DriveId, number>;
  lastSelectedDrive: DriveId | null;
  totalArbitrations: number;
  recentConflicts: number;
};

// ── Module state ──────────────────────────────────────────────────

let storageDir = "";
let config: BrainAgentConfig["driveArbiter"] | undefined;
let logger: { info: (msg: string) => void } | undefined;
let statGetters: DriveStatGetters = {};
const unsubscribers: Array<() => void> = [];

// Learned per-drive weights (start at 1.0, updated by reward signals)
let driveWeights: Record<DriveId, number> = {
  social: 1.0,
  cognitive: 1.0,
  creative: 1.0,
  mastery: 1.0,
};

let lastSelectedDrive: DriveId | null = null;
let lastSelectionTime = 0;
let conflictLog: ConflictLogEntry[] = [];
let totalArbitrations = 0;

// Реентрантность-гард арбитража (сбрасывается в init и в finally)
let isArbitrating = false;

// ── Initialization ────────────────────────────────────────────────

export function initDriveArbiter(
  workspaceDir: string,
  cfg: BrainAgentConfig,
  getters: DriveStatGetters,
  log?: { info: (msg: string) => void },
): void {
  config = cfg.driveArbiter;
  statGetters = getters;
  logger = log;

  // Reset in-memory state before loading persisted data
  driveWeights = { social: 1.0, cognitive: 1.0, creative: 1.0, mastery: 1.0 };
  lastSelectedDrive = null;
  lastSelectionTime = 0;
  conflictLog = [];
  totalArbitrations = 0;
  isArbitrating = false;
  unsubscribers.length = 0;

  storageDir = join(workspaceDir, ".brainagent");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  // Отложенная запись прежнего экземпляра (пере-инициализация) больше не актуальна
  cancelPersist(join(storageDir, "drive-arbiter.json"));
  loadState();

  // Listen to drive need-rising and urge events to trigger arbitration
  const driveEvents = [
    "social-drive:need-rising",
    "cognitive-hunger:need-rising",
    "creative-drive:need-rising",
    "mastery-drive:need-rising",
    "social-drive:urge",
    "cognitive-hunger:urge",
    "creative-drive:urge",
    "mastery-drive:urge",
  ] as const;

  for (const event of driveEvents) {
    const unsub = bus.on(event, () => {
      arbitrate();
    });
    unsubscribers.push(unsub);
  }

  // Learn from dopamine reward signals
  const unsubReward = bus.on("dopamine:reward", (signal) => {
    processReward(signal);
  });
  unsubscribers.push(unsubReward);

  logger?.info("BrainAgent DriveArbiter: initialized");
}

export function stopDriveArbiter(): void {
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers.length = 0;
  persistState();
  flushPersist(join(storageDir, "drive-arbiter.json"));
  logger?.info("BrainAgent DriveArbiter: stopped.");
}

// ── Core arbitration ──────────────────────────────────────────────

/**
 * Score all active drives and select a winner.
 * Emits arbiter:drive-selected and optionally arbiter:conflict-resolved.
 */
function arbitrate(): void {
  // Реентрантность-гард: bus.emit исполняет обработчики синхронно до
  // первого await, поэтому слушатель arbiter:drive-selected может
  // повторно запустить arbitrate() прямо внутри текущего арбитража.
  if (!config || isArbitrating) return;
  isArbitrating = true;
  try {
    arbitrateInner();
  } finally {
    isArbitrating = false;
  }
}

function arbitrateInner(): void {
  if (!config) return;
  const cfg = config;

  const social = statGetters.getSocialDriveStats?.();
  const cognitive = statGetters.getCognitiveHungerStats?.();
  const creative = statGetters.getCreativeDriveStats?.();
  const mastery = statGetters.getMasteryDriveStats?.();

  // Gather active drives (need above minimum threshold)
  const drives: Array<{ id: DriveId; need: number }> = [];

  if (social && social.need >= cfg.minDriveNeed) {
    drives.push({ id: "social", need: social.need });
  }
  if (cognitive && cognitive.need >= cfg.minDriveNeed) {
    drives.push({ id: "cognitive", need: cognitive.need });
  }
  if (creative && creative.need >= cfg.minDriveNeed) {
    drives.push({ id: "creative", need: creative.need });
  }
  if (mastery && mastery.need >= cfg.minDriveNeed) {
    drives.push({ id: "mastery", need: mastery.need });
  }

  // No active drives — nothing to arbitrate
  if (drives.length === 0) return;

  // Single drive — no conflict, just select it
  if (drives.length === 1) {
    selectDrive(drives[0].id, drives[0].need, false);
    return;
  }

  // Multiple drives active — score and arbitrate
  const userModel = statGetters.getUserModel?.();
  const interoPattern = statGetters.getInteroceptivePattern?.();
  const now = Date.now();

  const scores: DriveScore[] = drives.map((d) => {
    // 1. Urgency (directly from drive need level, 0-1)
    const urgency = d.need;

    // 2. Learned reward weight (from dopamine history)
    const rewardWeight = driveWeights[d.id];

    // 3. Recency penalty (recently-selected drives score lower)
    let recencyBonus = 1.0;
    if (d.id === lastSelectedDrive && lastSelectionTime > 0) {
      const timeSinceLast = now - lastSelectionTime;
      // Decay the penalty over time — after ~5 minutes, penalty is ~50% gone
      const decayFactor = Math.pow(cfg.recencyDecay, timeSinceLast / (5 * 60 * 1000));
      recencyBonus = 1.0 - decayFactor * 0.5; // 0.5-1.0 range
    }

    // 4. User context bonus (does the user's current state align with this drive?)
    let userContextBonus = 0.5; // neutral
    if (userModel) {
      if (d.id === "social" && userModel.mentalState?.engagementLevel > 0.6) {
        userContextBonus = 0.8;
      }
      if (d.id === "cognitive" && userModel.mentalState?.currentFocus) {
        userContextBonus = 0.7;
      }
      if (d.id === "creative" && (userModel.mentalState?.engagementLevel ?? 0) > 0.5) {
        userContextBonus = 0.7;
      }
      if (d.id === "mastery" && (userModel.mentalState?.frustrationLevel ?? 0) < 0.3) {
        // Mastery works best when not frustrated
        userContextBonus = 0.7;
      }
    }

    // 5. Interoceptive pattern bonus (does inner state align with this drive?)
    let interoBonus = 0.5;
    if (interoPattern) {
      if (d.id === "social" && interoPattern === "restless") interoBonus = 0.8;
      if (d.id === "cognitive" && interoPattern === "exploratory") interoBonus = 0.9;
      if (d.id === "creative" && interoPattern === "inspired") interoBonus = 0.9;
      if (d.id === "mastery" && interoPattern === "focused") interoBonus = 0.8;
      if (d.id === "mastery" && interoPattern === "frustrated") interoBonus = 0.7;
    }

    const totalScore =
      urgency * 0.35 +
      rewardWeight * 0.25 +
      recencyBonus * 0.15 +
      userContextBonus * 0.15 +
      interoBonus * 0.1;

    return {
      driveId: d.id,
      urgency,
      rewardWeight,
      recencyBonus,
      userContextBonus,
      interoBonus,
      totalScore,
    };
  });

  // Sort by score (highest first)
  scores.sort((a, b) => b.totalScore - a.totalScore);

  // Exploration: with configurable probability, pick a random non-optimal drive
  let explorationUsed = false;
  let winner = scores[0];
  if (scores.length > 1 && Math.random() < cfg.explorationRate) {
    const nonOptimal = scores.slice(1);
    winner = nonOptimal[Math.floor(Math.random() * nonOptimal.length)];
    explorationUsed = true;
  }

  // Log conflict
  const scoreMap = {} as Record<DriveId, number>;
  for (const s of scores) {
    scoreMap[s.driveId] = s.totalScore;
  }

  const entry: ConflictLogEntry = {
    timestamp: now,
    competing: scores.map((s) => s.driveId),
    winner: winner.driveId,
    scores: scoreMap,
    explorationUsed,
  };
  conflictLog.push(entry);
  if (conflictLog.length > (cfg.maxConflictLog ?? 50)) {
    conflictLog = conflictLog.slice(-cfg.maxConflictLog);
  }

  // Emit conflict resolution event
  bus.emit("arbiter:conflict-resolved", {
    competing: scores.map((s) => s.driveId),
    winner: winner.driveId,
    method: explorationUsed ? "exploration" : "scored",
  });

  selectDrive(winner.driveId, winner.totalScore, explorationUsed);
  totalArbitrations++;
  persistState();
}

/**
 * Record the selected drive and emit event.
 */
function selectDrive(driveId: DriveId, priority: number, exploration: boolean): void {
  lastSelectedDrive = driveId;
  lastSelectionTime = Date.now();

  const reasons: Record<DriveId, string> = {
    social: "Social connection need is highest priority",
    cognitive: "Cognitive hunger is driving exploration",
    creative: "Creative impulse is seeking expression",
    mastery: "Mastery drive is pushing for improvement",
  };

  bus.emit("arbiter:drive-selected", {
    driveId,
    priority,
    reason: exploration ? `Exploration: trying ${driveId} drive` : reasons[driveId],
  });

  logger?.info(
    `BrainAgent DriveArbiter: selected=${driveId} priority=${priority.toFixed(2)} ` +
      `exploration=${exploration}`,
  );
}

// ── Reward learning ───────────────────────────────────────────────

/**
 * Process dopamine reward signal to update drive weights.
 * If the last-selected drive was active during this reward cycle,
 * adjust its weight toward the reward signal.
 */
function processReward(signal: DopamineSignal): void {
  if (!config || !lastSelectedDrive) return;

  // Only learn if a drive was recently selected (within last 5 minutes)
  const timeSinceSelection = Date.now() - lastSelectionTime;
  if (timeSinceSelection > 5 * 60 * 1000) return;

  const currentWeight = driveWeights[lastSelectedDrive];
  const lr = config.rewardLearningRate;

  // Move weight toward reward (positive reward = increase, negative = decrease)
  // Clamp between 0.3 and 2.0 to prevent extreme values
  const newWeight = Math.max(0.3, Math.min(2.0, currentWeight + lr * signal.reward));
  driveWeights[lastSelectedDrive] = newWeight;

  logger?.info(
    `BrainAgent DriveArbiter: reward learning drive=${lastSelectedDrive} ` +
      `oldWeight=${currentWeight.toFixed(3)} newWeight=${newWeight.toFixed(3)} ` +
      `reward=${signal.reward.toFixed(3)}`,
  );
}

// ── Persistence ───────────────────────────────────────────────────

function loadState(): void {
  try {
    const path = join(storageDir, "drive-arbiter.json");
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, "utf-8")) as PersistedState;
      if (data.driveWeights) driveWeights = { ...driveWeights, ...data.driveWeights };
      lastSelectedDrive = data.lastSelectedDrive ?? null;
      lastSelectionTime = data.lastSelectionTime ?? 0;
      conflictLog = data.conflictLog ?? [];
      totalArbitrations = data.totalArbitrations ?? 0;
    }
  } catch {
    // Fresh start
  }
}

function persistState(): void {
  if (!storageDir) return;
  // Debounce + ленивый сериализатор: на диск уходит самое свежее состояние
  schedulePersist(join(storageDir, "drive-arbiter.json"), () => {
    const data: PersistedState = {
      driveWeights,
      lastSelectedDrive,
      lastSelectionTime,
      conflictLog,
      totalArbitrations,
    };
    return JSON.stringify(data, null, 2);
  });
}

// ── Public API ────────────────────────────────────────────────────

export function getDriveArbiterStats(): DriveArbiterStats {
  return {
    driveWeights: { ...driveWeights },
    lastSelectedDrive,
    totalArbitrations,
    recentConflicts: conflictLog.filter((e) => Date.now() - e.timestamp < 60 * 60 * 1000).length,
  };
}

export function getLastSelectedDrive(): DriveId | null {
  return lastSelectedDrive;
}

/**
 * Build a context string for injection into the agent's prompt.
 * Describes the currently prioritized drive and any recent conflicts.
 */
export function buildArbiterContext(): string | null {
  if (!lastSelectedDrive) return null;

  const labels: Record<DriveId, string> = {
    social: "social connection",
    cognitive: "learning and exploration",
    creative: "creative expression",
    mastery: "skill improvement",
  };

  const lines = [`Prioritized drive: ${labels[lastSelectedDrive]}`];

  // Add recent conflict info if relevant
  const recentConflict = conflictLog.length > 0 ? conflictLog[conflictLog.length - 1] : null;
  if (recentConflict && Date.now() - recentConflict.timestamp < 5 * 60 * 1000) {
    if (recentConflict.competing.length > 1) {
      const others = recentConflict.competing
        .filter((d) => d !== recentConflict.winner)
        .map((d) => labels[d])
        .join(", ");
      lines.push(`Also active: ${others}`);
    }
  }

  return lines.join("\n");
}
