/**
 * Strategy Bandit — адаптивный выбор стратегий без обучения весов
 * (ступень 1 петли обучения, «RL-lite»).
 *
 * Многорукий бандит UCB1: у каждой точки решения (decision point)
 * свой набор «рук»-стратегий; выбор балансирует эксплуатацию
 * (средняя награда руки) и разведку (UCB-бонус за малоизученность).
 * Награда приходит из reward-ledger (событие "reward:recorded") и
 * приписывается последней выбранной руке в пределах окна атрибуции —
 * так выбор стратегии оценивается реальным исходом цикла.
 *
 * Политика хранится в таблицах (plays/средняя награда), а не в весах
 * модели — формально это настоящее обучение с подкреплением, доступное
 * без GPU и локальных моделей.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bus } from "./event-bus.ts";
import { cancelPersist, flushPersist, schedulePersist } from "./persist.ts";
import type { BrainAgentConfig } from "./types.ts";

// ── Типы ──────────────────────────────────────────────────────────

type ArmRecord = {
  plays: number;
  rewardSum: number;
  lastChosen: number;
};

type DecisionPointState = Record<string, ArmRecord>;

// ── Состояние модуля ──────────────────────────────────────────────

let storageFile = "";
let state: Record<string, DecisionPointState> = {};
let explorationConstant = 1.4;
let attributionWindowMs = 5 * 60 * 1000;
let unsubscribers: Array<() => void> = [];
let initialized = false;
let lastChoices: Record<string, { arm: string; timestamp: number }> = {};

// ── Инициализация ─────────────────────────────────────────────────

export function initStrategyBandit(workspaceDir: string, config: BrainAgentConfig): void {
  stopStrategyBandit();

  const storageDir = join(workspaceDir, ".brainagent", "bandit");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  storageFile = join(storageDir, "state.json");
  cancelPersist(storageFile);
  explorationConstant = config.learningLoop.strategyBandit.explorationConstant;
  attributionWindowMs = config.learningLoop.strategyBandit.attributionWindowMs;

  state = {};
  lastChoices = {};
  loadState();

  // Награда из reward-ledger приписывается самому позднему выбору в окне
  // атрибуции; слот выбора — свой для каждой точки решения, поэтому
  // несколько точек решения не крадут награды друг у друга
  unsubscribers.push(
    bus.on("reward:recorded", (data) => {
      const now = Date.now();
      let bestPoint: string | null = null;
      for (const [point, choice] of Object.entries(lastChoices)) {
        if (now - choice.timestamp > attributionWindowMs) {
          delete lastChoices[point]; // окно атрибуции истекло
          continue;
        }
        if (!bestPoint || choice.timestamp >= lastChoices[bestPoint].timestamp) {
          bestPoint = point;
        }
      }
      if (!bestPoint) return; // награда «ничья»
      const { arm } = lastChoices[bestPoint];
      delete lastChoices[bestPoint]; // одна награда на один выбор
      recordOutcome(bestPoint, arm, data.reward);
    }),
  );

  initialized = true;
}

export function stopStrategyBandit(): void {
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers = [];
  if (storageFile) {
    flushPersist(storageFile);
  }
  storageFile = "";
  initialized = false;
  lastChoices = {};
}

// ── Ядро: UCB1 ────────────────────────────────────────────────────

function getOrCreateArm(point: DecisionPointState, arm: string): ArmRecord {
  if (!point[arm]) {
    point[arm] = { plays: 0, rewardSum: 0, lastChosen: 0 };
  }
  return point[arm];
}

/**
 * Выбрать руку для точки решения. Неинициализированный бандит
 * безопасно возвращает "standard", если он в списке, иначе первую руку.
 */
export function chooseArm(decisionPoint: string, arms: readonly string[]): string {
  if (arms.length === 0) return "standard";
  if (!initialized) {
    return arms.includes("standard") ? "standard" : arms[0];
  }

  const point = state[decisionPoint] ?? (state[decisionPoint] = {});

  // Разведка: ни разу не выбранные руки пробуем первыми
  // (выбранная, но ещё без исхода рука уже не считается «неигранной»)
  const unplayed = arms.find(
    (arm) => !point[arm] || (point[arm].plays === 0 && point[arm].lastChosen === 0),
  );

  let chosen: string;
  if (unplayed) {
    chosen = unplayed;
  } else {
    const totalPlays = arms.reduce((sum, arm) => sum + point[arm].plays, 0);
    if (totalPlays === 0) {
      // Руки уже выбирались, но исходы ещё не пришли — берём давно не выбранную
      chosen = arms.reduce(
        (oldest, arm) => (point[arm].lastChosen < point[oldest].lastChosen ? arm : oldest),
        arms[0],
      );
    } else {
      let bestScore = Number.NEGATIVE_INFINITY;
      chosen = arms[0];
      for (const arm of arms) {
        const rec = point[arm];
        const mean = rec.rewardSum / rec.plays;
        const bonus = explorationConstant * Math.sqrt(Math.log(totalPlays) / rec.plays);
        const score = mean + bonus;
        if (score > bestScore) {
          bestScore = score;
          chosen = arm;
        }
      }
    }
  }

  const rec = getOrCreateArm(point, chosen);
  rec.lastChosen = Date.now();
  lastChoices[decisionPoint] = { arm: chosen, timestamp: Date.now() };

  persistState();
  bus.emitSync("bandit:arm-chosen", { decisionPoint, arm: chosen });

  return chosen;
}

/** Явная запись исхода (награда клампится к [-1, 1]). */
export function recordOutcome(decisionPoint: string, arm: string, reward: number): void {
  if (!initialized) return;
  const point = state[decisionPoint] ?? (state[decisionPoint] = {});
  const rec = getOrCreateArm(point, arm);
  rec.plays += 1;
  rec.rewardSum += Math.max(-1, Math.min(1, reward));
  persistState();
}

/** Статистика рук точки решения. */
export function getArmStats(
  decisionPoint: string,
): Record<string, { plays: number; meanReward: number }> {
  const point = state[decisionPoint] ?? {};
  const out: Record<string, { plays: number; meanReward: number }> = {};
  for (const [arm, rec] of Object.entries(point)) {
    out[arm] = {
      plays: rec.plays,
      meanReward: rec.plays > 0 ? rec.rewardSum / rec.plays : 0,
    };
  }
  return out;
}

/** Сводная статистика бандита. */
export function getBanditStats(): {
  decisionPoints: number;
  totalPlays: number;
  initialized: boolean;
} {
  let totalPlays = 0;
  for (const point of Object.values(state)) {
    for (const rec of Object.values(point)) {
      totalPlays += rec.plays;
    }
  }
  return { decisionPoints: Object.keys(state).length, totalPlays, initialized };
}

// ── Персистентность ───────────────────────────────────────────────

function loadState(): void {
  if (!storageFile || !existsSync(storageFile)) return;
  try {
    const data = JSON.parse(readFileSync(storageFile, "utf-8")) as Record<
      string,
      DecisionPointState
    >;
    state = data && typeof data === "object" ? data : {};
  } catch {
    /* fresh start */
  }
}

function persistState(): void {
  if (!storageFile) return;
  schedulePersist(storageFile, () => JSON.stringify(state, null, 2));
}
