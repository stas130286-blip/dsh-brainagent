/**
 * Креативный Драйв — Модуль биологического творческого гомеостаза.
 *
 * Моделирует потребность мозга в творческом выражении через механизм
 * насыщения/затухания. Общая механика (затухание, уровни потребности,
 * сигналы, награды, персистентность) реализована в DriveEngine;
 * этот файл — конфигурация креативного драйва и его уникальные
 * контекстные слушатели (инсайты DMN, квалиа, генерация вопросов).
 *
 * Пути влияния:
 *  1. creative-drive:need-rising → давление Витального Импульса (+0.20)
 *  2. желание "exploration" → эскалация → autonomy:desire-escalated (+0.35)
 *  3. креативные мысли DMN → dmn:thought-generated (+0.25)
 *
 * Насыщение восстанавливается, когда dopamine:reward срабатывает
 * в креативном домене (creative), замыкая гомеостатический цикл.
 */

import { bus } from "./event-bus.ts";
import { DriveEngine, type DriveEngineConfig } from "./drive-engine.ts";
import type { BrainAgentConfig, CreativeDriveStats, Desire, SemanticMemory } from "./types.ts";

// ── Типы ──────────────────────────────────────────────────────────

type CreativeDriveDeps = {
  addDesire: (
    type: Desire["type"],
    description: string,
    strength: number,
    source: string,
  ) => Desire;
  getDesires: () => Desire[];
  getFactsByCategory: (category: string, limit?: number) => SemanticMemory[];
  generateCreativeThought: (topics: Array<{ topic: string }>) => void;
};

// ── Состояние модуля ──────────────────────────────────────────────

let engine: DriveEngine | undefined;
let logger: { info: (msg: string) => void } | undefined;

// ── Инициализация ─────────────────────────────────────────────────

export function initCreativeDrive(
  workspaceDir: string,
  cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
  injectedDeps: CreativeDriveDeps,
): void {
  engine?.stop();
  logger = log;

  const c = cfg.creativeDrive;
  const driveConfig: DriveEngineConfig = {
    rewardDomains: c.creativeDomains,
    rewardMultiplier: c.creativeRewardMultiplier,
    initialSatiation: c.initialSatiation,
    baseDecayRate: c.baseDecayRate,
    decayIntervalMs: c.decayIntervalMs,
    sleepDecayModifier: c.sleepDecayModifier,
    maxSatiationBoost: c.maxSatiationBoost,
    maxHistoryEntries: c.maxHistoryEntries,
    needThresholds: c.needThresholds,
    dmnBiasIntervalMs: c.dmnBiasIntervalMs,
    desireUpdateIntervalMs: c.desireUpdateIntervalMs,
  };

  engine = new DriveEngine(
    {
      id: "creative-drive",
      logName: "CreativeDrive",
      desireType: "exploration",
      desireDescription: "Feeling the urge to create something, explore novel ideas or express imagination",
      factsCategory: "creative",
      fallbackTopic: "creative expression, imagination and novel ideas",
      firedBaseBoost: 0.25,
      urgeTimeField: "timeSinceLastCreation",
      legacyKeys: {
        lastInteraction: "lastCreativeInteractionTime",
        totalRewards: "totalCreativeRewards",
        history: "creativeInteractionHistory",
      },
    },
    driveConfig,
    workspaceDir,
    cfg.circadian?.enabled ?? false,
    {
      addDesire: injectedDeps.addDesire,
      getDesires: injectedDeps.getDesires,
      getFactsByCategory: injectedDeps.getFactsByCategory,
      generateThought: injectedDeps.generateCreativeThought,
    },
    log,
  );

  // ── Драйв-специфичные контекстные слушатели ─────────────────────

  // Инсайт DMN — буст насыщения (творческий прорыв удовлетворяет драйв)
  engine.addExtraListener(
    bus.on("dmn:insight-generated", () => {
      engine?.evaluateDecay();
      engine?.applySatiationDelta(0.1, { persist: true });
    }),
  );

  // Любая мысль DMN — микро-буст (сам процесс воображения питает драйв)
  engine.addExtraListener(
    bus.on("dmn:thought-generated", () => {
      engine?.applySatiationDelta(0.05, { persist: true });
    }),
  );

  // Новое переживание (квалиа) — буст насыщенности творческого опыта
  engine.addExtraListener(
    bus.on("qualia:experience-generated", () => {
      engine?.evaluateDecay();
      engine?.applySatiationDelta(0.07, { persist: true });
    }),
  );

  // Сгенерирован вопрос любопытства — лёгкий дренаж (вопрос = незакрытый гештальт)
  engine.addExtraListener(
    bus.on("curiosity:question-generated", () => {
      engine?.applySatiationDelta(-0.02);
    }),
  );
}

export function stopCreativeDrive(): void {
  engine?.stop();
  engine = undefined;
  logger?.info("BrainAgent CreativeDrive: stopped.");
}

// ── Публичный API ─────────────────────────────────────────────────

export function getCreativeDriveStats(): CreativeDriveStats {
  const s = engine?.getStats();
  return {
    satiation: s?.satiation ?? 0,
    needLevel: s?.needLevel ?? "none",
    need: s?.need ?? 0,
    lastCreativeInteractionTime: s?.lastInteractionTime ?? 0,
    timeSinceLastCreation: s?.timeSinceLastInteraction ?? -1,
    totalCreativeRewards: s?.totalRewards ?? 0,
    totalNeedSignals: s?.totalNeedSignals ?? 0,
    recentInteractionCount: s?.recentInteractionCount ?? 0,
  };
}

export function getCreativeDriveSatiation(): number {
  return engine?.getSatiation() ?? 0;
}

export function boostCreativeDriveSatiation(amount: number, reason: string): void {
  engine?.boostSatiation(amount, reason);
}
