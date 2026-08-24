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

export type StrategyBanditInstance = {
  chooseArm(decisionPoint: string, arms: readonly string[]): string;
  recordOutcome(decisionPoint: string, arm: string, reward: number): void;
  getArmStats(decisionPoint: string): Record<string, { plays: number; meanReward: number }>;
  getBanditStats(): { decisionPoints: number; totalPlays: number; initialized: boolean };
  /** Отписка от шины + сброс накопленной персистентности на диск. */
  stop(): void;
  /** Тихая версия stop для пере-инициализации. */
  dispose(): void;
};

// ── Фабрика ───────────────────────────────────────────────────────

/** Создать бандита с собственным состоянием и подпиской на шину. */
export function createStrategyBandit(
  workspaceDir: string,
  config: BrainAgentConfig,
): StrategyBanditInstance {
  const storageDir = join(workspaceDir, ".brainagent", "bandit");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  const storageFile = join(storageDir, "state.json");
  const explorationConstant = config.learningLoop.strategyBandit.explorationConstant;
  const attributionWindowMs = config.learningLoop.strategyBandit.attributionWindowMs;

  let state: Record<string, DecisionPointState> = {};
  let lastChoices: Record<string, { arm: string; timestamp: number }> = {};

  function loadState(): void {
    if (!existsSync(storageFile)) return;
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
    schedulePersist(storageFile, () => JSON.stringify(state, null, 2));
  }

  function recordOutcome(decisionPoint: string, arm: string, reward: number): void {
    const point = state[decisionPoint] ?? (state[decisionPoint] = {});
    const rec = getOrCreateArm(point, arm);
    rec.plays += 1;
    rec.rewardSum += Math.max(-1, Math.min(1, reward));
    persistState();
  }

  function teardown(): void {
    for (const unsub of unsubscribers) {
      unsub();
    }
    unsubscribers.length = 0;
    flushPersist(storageFile);
  }

  cancelPersist(storageFile);
  loadState();

  // Награда из reward-ledger приписывается самому позднему выбору в окне
  // атрибуции; слот выбора — свой для каждой точки решения, поэтому
  // несколько точек решения не крадут награды друг у друга
  const unsubscribers: Array<() => void> = [
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
  ];

  /**
   * Выбрать руку для точки решения. Неинициализированный бандит
   * безопасно возвращает "standard", если он в списке, иначе первую руку.
   */
  function chooseArm(decisionPoint: string, arms: readonly string[]): string {
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

  function getArmStats(
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

  function getBanditStats(): {
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
    return { decisionPoints: Object.keys(state).length, totalPlays, initialized: true };
  }

  return {
    chooseArm,
    recordOutcome,
    getArmStats,
    getBanditStats,
    stop: teardown,
    dispose: teardown,
  };
}

// ── Ядро: UCB1 (общий помощник) ───────────────────────────────────

function getOrCreateArm(point: DecisionPointState, arm: string): ArmRecord {
  if (!point[arm]) {
    point[arm] = { plays: 0, rewardSum: 0, lastChosen: 0 };
  }
  return point[arm];
}

// ── Совместимость: свободные функции поверх активного инстанса ─────

let active: StrategyBanditInstance | undefined;

export function initStrategyBandit(workspaceDir: string, config: BrainAgentConfig): void {
  active?.dispose();
  active = createStrategyBandit(workspaceDir, config);
}

export function stopStrategyBandit(): void {
  active?.stop();
  active = undefined;
}

export function chooseArm(decisionPoint: string, arms: readonly string[]): string {
  if (arms.length === 0) return "standard";
  if (!active) {
    return arms.includes("standard") ? "standard" : arms[0];
  }
  return active.chooseArm(decisionPoint, arms);
}

/** Явная запись исхода (награда клампится к [-1, 1]). */
export function recordOutcome(decisionPoint: string, arm: string, reward: number): void {
  active?.recordOutcome(decisionPoint, arm, reward);
}

/** Статистика рук точки решения. */
export function getArmStats(
  decisionPoint: string,
): Record<string, { plays: number; meanReward: number }> {
  return active?.getArmStats(decisionPoint) ?? {};
}

/** Сводная статистика бандита. */
export function getBanditStats(): {
  decisionPoints: number;
  totalPlays: number;
  initialized: boolean;
} {
  return active?.getBanditStats() ?? { decisionPoints: 0, totalPlays: 0, initialized: false };
}
