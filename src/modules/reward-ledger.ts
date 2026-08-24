/**
 * Reward Ledger — единая летопись наград (ступень 0 петли обучения).
 *
 * Все сигналы награды, которые плагин уже генерирует (дофаминовая
 * награда, реакции пользователя на проактивные сообщения, подкрепления
 * базальных ганглиев, валидация мозжечка, проверка предсказаний),
 * приводятся единой функцией к скалярной награде в [-1, 1] и пишутся
 * в журнал. Журнал ничего не меняет в поведении — это фундамент данных
 * для адаптации стратегий (ступень 1, strategy-bandit) и будущего
 * офлайн-обучения.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bus } from "./event-bus.ts";
import { cancelPersist, flushPersist, schedulePersist } from "./persist.ts";
import type { BrainAgentConfig } from "./types.ts";

// ── Типы ──────────────────────────────────────────────────────────

export type RewardSource =
  | "dopamine"
  | "proactive-reaction"
  | "basal-reinforcement"
  | "cerebellum-validation"
  | "prediction-validation"
  | "manual";

export type RewardEntry = {
  id: string;
  timestamp: number;
  /** Скалярная награда в диапазоне [-1, 1]. */
  reward: number;
  /** Источник сигнала. */
  source: RewardSource;
  /** Контекст события (домен, habitId и т.п.). */
  context?: string;
};

export type RewardLedgerInstance = {
  /** Записать награду в журнал (клампится к [-1, 1]; нули не пишутся). */
  record(source: RewardSource, contribution: number, context?: string): void;
  /** Последние n записей журнала (по умолчанию 20). */
  getRecentEntries(n?: number): RewardEntry[];
  /** Средняя награда по последним n записям (0 при пустом журнале). */
  getAverageReward(n?: number): number;
  /** Сводная статистика журнала. */
  getStats(): { entries: number; averageReward: number; lastEntryTimestamp: number };
  /** Отписаться от шины и сбросить отложенную персистенцию. */
  stop(): void;
  /** Тихий вариант stop (для замены инстанса). */
  dispose(): void;
};

// ── Единая функция награды ────────────────────────────────────────
// Веса источников: прямой сигнал пользователя весит больше всего,
// внутренние оценки — меньше. Вклад каждого источника уже нормирован
// к [-1, 1] до умножения на вес; итог дополнительно клампится.

const SOURCE_WEIGHTS: Record<Exclude<RewardSource, "manual">, number> = {
  dopamine: 0.5,
  "proactive-reaction": 1.0,
  "basal-reinforcement": 0.6,
  "cerebellum-validation": 0.3,
  "prediction-validation": 0.4,
};

/** Реакция пользователя на проактивное сообщение → нормированный сигнал. */
const PROACTIVE_SIGNAL_VALUE: Record<string, number> = {
  rejection: -1,
  negative: -0.7,
  positive: 0.8,
  neutral: 0.05, // контакт состоялся, но без оценки
};

function clampReward(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

// ── Фабрика ───────────────────────────────────────────────────────

export function createRewardLedger(
  workspaceDir: string,
  config: BrainAgentConfig,
): RewardLedgerInstance {
  const storageDir = join(workspaceDir, ".brainagent", "reward");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  const storageFile = join(storageDir, "ledger.json");
  cancelPersist(storageFile);
  const maxEntries = config.learningLoop.rewardLedger.maxEntries;

  let entries: RewardEntry[] = [];
  let idCounter = 0;

  // Загрузка журнала
  if (existsSync(storageFile)) {
    try {
      const data = JSON.parse(readFileSync(storageFile, "utf-8")) as {
        entries?: RewardEntry[];
      };
      entries = Array.isArray(data.entries) ? data.entries.slice(-maxEntries) : [];
      idCounter = entries.length;
    } catch {
      /* fresh start */
    }
  }

  function persistLedger(): void {
    schedulePersist(storageFile, () => JSON.stringify({ entries }, null, 2));
  }

  function record(source: RewardSource, contribution: number, context?: string): void {
    const reward = clampReward(contribution);
    if (Math.abs(reward) < 1e-9) return;

    entries.push({
      id: `rw_${Date.now()}_${++idCounter}`,
      timestamp: Date.now(),
      reward: Math.round(reward * 1000) / 1000,
      source,
      ...(context !== undefined ? { context } : {}),
    });

    if (entries.length > maxEntries) {
      entries = entries.slice(-maxEntries);
    }

    persistLedger();

    bus.emitSync("reward:recorded", {
      reward,
      source,
      ...(context !== undefined ? { context } : {}),
    });
  }

  function getRecentEntries(n = 20): RewardEntry[] {
    return entries.slice(-n);
  }

  function getAverageReward(n = 50): number {
    const recent = entries.slice(-n);
    if (recent.length === 0) return 0;
    return recent.reduce((sum, e) => sum + e.reward, 0) / recent.length;
  }

  // Подписки на шину
  const unsubscribers: Array<() => void> = [];

  // Дофаминовая награда нейромодуляторной системы
  unsubscribers.push(
    bus.on("dopamine:reward", (signal) => {
      const contribution = clampReward(signal.reward) * SOURCE_WEIGHTS.dopamine;
      record("dopamine", contribution, signal.context.domain);
    }),
  );

  // Реакция пользователя на проактивное сообщение — самый прямой сигнал
  unsubscribers.push(
    bus.on("proactive:reaction", (data) => {
      const raw = PROACTIVE_SIGNAL_VALUE[data.signal] ?? 0;
      if (raw === 0) return;
      record("proactive-reaction", raw * SOURCE_WEIGHTS["proactive-reaction"], data.domain);
    }),
  );

  // Подкрепление привычки базальными ганглиями
  unsubscribers.push(
    bus.on("basal:reinforced", (data) => {
      if (data.signal === "neutral") return;
      const raw = data.signal === "positive" ? 1 : -1;
      record("basal-reinforcement", raw * SOURCE_WEIGHTS["basal-reinforcement"], data.habitId);
    }),
  );

  // Валидация ответа мозжечком
  unsubscribers.push(
    bus.on("cerebellum:validated", (data) => {
      const raw = data.passed ? 1 : -1.3; // провал валидации весит чуть больше
      record("cerebellum-validation", clampReward(raw) * SOURCE_WEIGHTS["cerebellum-validation"]);
    }),
  );

  // Сбывшееся/несбывшееся предсказание прогнозного движка
  unsubscribers.push(
    bus.on("pathway:prediction-validated", (data) => {
      const raw = data.wasCorrect ? 1 : -1;
      record(
        "prediction-validation",
        raw * SOURCE_WEIGHTS["prediction-validation"],
        data.predictionTopic,
      );
    }),
  );

  function unsubscribe(): void {
    for (const unsub of unsubscribers) {
      unsub();
    }
    unsubscribers.length = 0;
  }

  return {
    record,
    getRecentEntries,
    getAverageReward,
    getStats: () => ({
      entries: entries.length,
      averageReward: getAverageReward(),
      lastEntryTimestamp: entries.length > 0 ? entries[entries.length - 1].timestamp : 0,
    }),
    stop: () => {
      unsubscribe();
      flushPersist(storageFile);
    },
    dispose: () => {
      unsubscribe();
      flushPersist(storageFile);
    },
  };
}

// ── Активный инстанс (слот) ───────────────────────────────────────

let active: RewardLedgerInstance | undefined;

// ── Совместимый API ───────────────────────────────────────────────

export function initRewardLedger(workspaceDir: string, config: BrainAgentConfig): void {
  active?.dispose();
  active = createRewardLedger(workspaceDir, config);
}

export function stopRewardLedger(): void {
  active?.stop();
  active = undefined;
}

/**
 * Записать награду в журнал. Вклад клампится к [-1, 1]; нулевые
 * вклады не пишутся (нет сигнала — нет записи). До инициализации — no-op.
 */
export function recordReward(source: RewardSource, contribution: number, context?: string): void {
  active?.record(source, contribution, context);
}

/** Последние n записей журнала (по умолчанию 20). */
export function getRecentEntries(n = 20): RewardEntry[] {
  return active?.getRecentEntries(n) ?? [];
}

/** Средняя награда по последним n записям (0 при пустом журнале). */
export function getAverageReward(n = 50): number {
  return active?.getAverageReward(n) ?? 0;
}

/** Сводная статистика журнала. */
export function getRewardLedgerStats(): {
  entries: number;
  averageReward: number;
  lastEntryTimestamp: number;
} {
  return (
    active?.getStats() ?? {
      entries: 0,
      averageReward: 0,
      lastEntryTimestamp: 0,
    }
  );
}

/** Журнал инициализирован (для guard-проверок в тестах/потребителях). */
export function isRewardLedgerInitialized(): boolean {
  return active !== undefined;
}
