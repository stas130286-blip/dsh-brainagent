/**
 * Когнитивный Голод — Модуль биологического познавательного гомеостаза.
 *
 * Моделирует потребность мозга в новых знаниях через механизм
 * насыщения/затухания. Общая механика (затухание, уровни потребности,
 * сигналы, награды, персистентность) реализована в DriveEngine;
 * этот файл — конфигурация когнитивного голода и его уникальные
 * контекстные слушатели (инсайты обучения, пробелы, мозжечок и т.п.).
 *
 * Пути влияния:
 *  1. cognitive-hunger:need-rising → давление Витального Импульса (+0.20)
 *  2. желание "understanding" → эскалация → autonomy:desire-escalated (+0.35)
 *  3. познавательные мысли DMN → dmn:thought-generated (+0.25)
 *
 * Насыщение восстанавливается, когда dopamine:reward срабатывает
 * в познавательном домене (technical/factual), замыкая гомеостатический цикл.
 */

import { bus } from "./event-bus.ts";
import { DriveEngine, type DriveEngineConfig } from "./drive-engine.ts";
import { getOpenGaps } from "./curiosity-drive.ts";
import type { BrainAgentConfig, CognitiveHungerStats, Desire, SemanticMemory } from "./types.ts";

// ── Типы ──────────────────────────────────────────────────────────

type CognitiveHungerDeps = {
  addDesire: (
    type: Desire["type"],
    description: string,
    strength: number,
    source: string,
  ) => Desire;
  getDesires: () => Desire[];
  getFactsByCategory: (category: string, limit?: number) => SemanticMemory[];
  generateLearningThought: (topics: Array<{ topic: string }>) => void;
};

// ── Состояние модуля ──────────────────────────────────────────────

let engine: DriveEngine | undefined;
let logger: { info: (msg: string) => void } | undefined;

// ── Инициализация ─────────────────────────────────────────────────

export function initCognitiveHunger(
  workspaceDir: string,
  cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
  injectedDeps: CognitiveHungerDeps,
): void {
  engine?.stop();
  logger = log;

  const c = cfg.cognitiveHunger;
  const driveConfig: DriveEngineConfig = {
    rewardDomains: c.learningDomains,
    rewardMultiplier: c.learningRewardMultiplier,
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
      id: "cognitive-hunger",
      logName: "CognitiveHunger",
      desireType: "understanding",
      desireDescription: "Feeling the urge to learn something new or explore a knowledge gap",
      factsCategory: "fact",
      fallbackTopic: "knowledge gaps and interesting topics to explore",
      // Драйв думает о реальных пробелах curiosity-drive (канонический
      // источник пробелов в знаниях), а не об общей запасной теме
      topicProvider: () => getOpenGaps().map((gap) => ({ topic: gap.topic })),
      firedBaseBoost: 0.25,
      urgeTimeField: "timeSinceLastLearning",
      legacyKeys: {
        lastInteraction: "lastLearningInteractionTime",
        totalRewards: "totalLearningRewards",
        history: "learningInteractionHistory",
      },
    },
    driveConfig,
    workspaceDir,
    cfg.circadian?.enabled ?? false,
    {
      addDesire: injectedDeps.addDesire,
      getDesires: injectedDeps.getDesires,
      getFactsByCategory: injectedDeps.getFactsByCategory,
      generateThought: injectedDeps.generateLearningThought,
    },
    log,
  );

  // ── Драйв-специфичные контекстные слушатели ─────────────────────

  // Инсайт обучения — небольшой буст насыщения (узнали что-то новое)
  engine.addExtraListener(
    bus.on("learning:insight-discovered", () => {
      engine?.evaluateDecay();
      engine?.applySatiationDelta(0.08, { persist: true });
    }),
  );

  // Улучшение показателей домена — буст если прогресс
  engine.addExtraListener(
    bus.on("learning:domain-performance-updated", (data) => {
      if (data.trend === "improving") {
        engine?.evaluateDecay();
        engine?.applySatiationDelta(0.05, { persist: true });
      }
    }),
  );

  // Обнаружение пробела в знаниях — УСИЛИВАЕТ голод (снижает насыщение)
  engine.addExtraListener(
    bus.on("curiosity:gap-detected", () => {
      engine?.evaluateDecay();
      engine?.applySatiationDelta(-0.03, { persist: true });
    }),
  );

  // Новый факт сохранён в гиппокамп — микро-буст (любое запоминание = немного обучения)
  engine.addExtraListener(
    bus.on("hippocampus:stored", () => {
      engine?.applySatiationDelta(0.02, { persist: true });
    }),
  );

  // ── Contextual modulation (body grounding) ──────────────────────
  // Cerebellum validation failures → drain cognitive satiation.
  // Like a student who keeps getting answers wrong — needs to learn more.
  engine.addExtraListener(
    bus.on("cerebellum:validated", (data) => {
      if (!data.passed) {
        engine?.applySatiationDelta(-0.03);
      }
    }),
  );
}

export function stopCognitiveHunger(): void {
  engine?.stop();
  engine = undefined;
  logger?.info("BrainAgent CognitiveHunger: stopped.");
}

// ── Публичный API ─────────────────────────────────────────────────

export function getCognitiveHungerStats(): CognitiveHungerStats {
  const s = engine?.getStats();
  return {
    satiation: s?.satiation ?? 0,
    needLevel: s?.needLevel ?? "none",
    need: s?.need ?? 0,
    lastLearningInteractionTime: s?.lastInteractionTime ?? 0,
    timeSinceLastLearning: s?.timeSinceLastInteraction ?? -1,
    totalLearningRewards: s?.totalRewards ?? 0,
    totalNeedSignals: s?.totalNeedSignals ?? 0,
    recentInteractionCount: s?.recentInteractionCount ?? 0,
  };
}

export function getCognitiveHungerSatiation(): number {
  return engine?.getSatiation() ?? 0;
}

export function boostCognitiveHungerSatiation(amount: number, reason: string): void {
  engine?.boostSatiation(amount, reason);
}
