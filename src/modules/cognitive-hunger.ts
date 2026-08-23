/**
 * Когнитивный Голод — Модуль биологического познавательного гомеостаза.
 *
 * Моделирует потребность мозга в новых знаниях через механизм
 * насыщения/затухания. Когнитивное насыщение (0–1) экспоненциально
 * затухает со временем, модулируясь циркадной фазой и уровнем
 * серотонина. По мере падения насыщения растущая «потребность»
 * излучает сигналы через несколько путей:
 *
 *  1. cognitive-hunger:need-rising → давление Витального Импульса (+0.20)
 *  2. желание "understanding" → эскалация → autonomy:desire-escalated (+0.35)
 *  3. познавательные мысли DMN → dmn:thought-generated (+0.25)
 *
 * Эти сигналы сходятся в Витальном Импульсе, естественно пересекая
 * порог срабатывания и порождая автономное познавательное поведение —
 * без фиксированного таймера.
 *
 * Насыщение восстанавливается, когда dopamine:reward срабатывает
 * в познавательном домене, замыкая гомеостатический цикл.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isInSleepPhase } from "./circadian-rhythm.ts";
import { getNeuromodulatorState } from "./dopamine-system.ts";
import { bus } from "./event-bus.ts";
import type {
  BrainAgentConfig,
  CognitiveHungerStats,
  Desire,
  DopamineSignal,
  SemanticMemory,
} from "./types.ts";

// ── Типы ──────────────────────────────────────────────────────────

type NeedLevel = "none" | "mild" | "moderate" | "strong" | "urgent";

type LearningInteractionRecord = {
  timestamp: number;
  reward: number;
  context: string;
};

type PersistedState = {
  satiation: number;
  lastLearningInteractionTime: number;
  lastDecayEvaluationTime: number;
  adaptiveDecayModifier: number;
  totalLearningRewards: number;
  totalNeedSignals: number;
  learningInteractionHistory: LearningInteractionRecord[];
};

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

let storageDir = "";
let config: BrainAgentConfig["cognitiveHunger"] | undefined;
let circadianEnabled = false;
let logger: { info: (msg: string) => void } | undefined;
let deps: CognitiveHungerDeps | undefined;

let satiation = 0.6;
let lastLearningInteractionTime = 0;
let lastDecayEvaluationTime = 0;
let totalLearningRewards = 0;
let totalNeedSignals = 0;
let currentNeedLevel: NeedLevel = "none";
let learningInteractionHistory: LearningInteractionRecord[] = [];

const unsubscribers: Array<() => void> = [];
let lastDesireUpdateTime = 0;
let lastDMNBiasTime = 0;
let lastNeedEmitTime = 0;

/**
 * Adaptive decay modifier — evolves through dopamine reward.
 * > 1.0 = faster decay = hunger returns sooner (drive sensitized)
 * < 1.0 = slower decay = hunger returns later (drive desensitized)
 * Clamped to [0.5, 2.0]. Persisted across sessions.
 */
let adaptiveDecayModifier = 1.0;

// ── Инициализация ─────────────────────────────────────────────────

export function initCognitiveHunger(
  workspaceDir: string,
  cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
  injectedDeps: CognitiveHungerDeps,
): void {
  storageDir = join(workspaceDir, ".brainagent", "cognitive-hunger");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  config = cfg.cognitiveHunger;
  circadianEnabled = cfg.circadian?.enabled ?? false;
  logger = log;
  deps = injectedDeps;

  // Сброс состояния в памяти
  satiation = config.initialSatiation;
  lastDecayEvaluationTime = Date.now();
  currentNeedLevel = "none";
  learningInteractionHistory = [];
  lastLearningInteractionTime = 0;
  totalLearningRewards = 0;
  totalNeedSignals = 0;
  unsubscribers.length = 0;
  lastDesireUpdateTime = 0;
  lastDMNBiasTime = 0;
  lastNeedEmitTime = 0;
  adaptiveDecayModifier = 1.0;

  loadState();

  // No periodic decay timer. Decay is evaluated on-demand:
  // when the brain is active (thalamus classifies), when rewards arrive,
  // or when any module queries drive state. Biological hunger model.

  // Подключение слушателей шины событий
  wireEventListeners();

  logger.info(
    `BrainAgent CognitiveHunger: initialized (satiation=${satiation.toFixed(2)}, ` +
      `decay=${config.baseDecayRate}/${config.decayIntervalMs}ms, ` +
      `domains=${config.learningDomains.join(",")})`,
  );
}

export function stopCognitiveHunger(): void {
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers.length = 0;
  persistState();
  logger?.info("BrainAgent CognitiveHunger: stopped.");
}

// ── Подключение событий ───────────────────────────────────────────

function wireEventListeners(): void {
  // Слушаем дофаминовые награды для обнаружения познавательных взаимодействий
  const unsubReward = bus.on("dopamine:reward", (signal: DopamineSignal) => {
    onLearningReward(signal);
  });
  unsubscribers.push(unsubReward);

  // On each brain activity, evaluate accumulated decay (on-demand).
  const unsubActivity = bus.on("thalamus:classified", () => {
    evaluateDecay();
  });
  unsubscribers.push(unsubActivity);

  // Инсайт обучения — небольшой буст насыщения (узнали что-то новое)
  const unsubInsight = bus.on("learning:insight-discovered", () => {
    if (!config) return;
    evaluateDecay();
    const boost = 0.08;
    satiation = Math.min(1.0, satiation + boost);
    currentNeedLevel = computeNeedLevel();
    persistState();
  });
  unsubscribers.push(unsubInsight);

  // Улучшение показателей домена — буст если прогресс
  const unsubPerf = bus.on("learning:domain-performance-updated", (data) => {
    if (!config) return;
    evaluateDecay();
    if (data.trend === "improving") {
      const boost = 0.05;
      satiation = Math.min(1.0, satiation + boost);
      currentNeedLevel = computeNeedLevel();
      persistState();
    }
  });
  unsubscribers.push(unsubPerf);

  // Обнаружение пробела в знаниях — УСИЛИВАЕТ голод (снижает насыщение)
  const unsubGap = bus.on("curiosity:gap-detected", () => {
    if (!config) return;
    evaluateDecay();
    satiation = Math.max(0, satiation - 0.03);
    currentNeedLevel = computeNeedLevel();
    persistState();
  });
  unsubscribers.push(unsubGap);

  // Новый факт сохранён в гиппокамп — микро-буст (любое запоминание = немного обучения)
  const unsubStored = bus.on("hippocampus:stored", () => {
    if (!config) return;
    const boost = 0.02;
    satiation = Math.min(1.0, satiation + boost);
    persistState();
  });
  unsubscribers.push(unsubStored);

  // Срабатывание Витального Импульса — безусловный буст, нарастающий без ответа
  const unsubFired = bus.on("vital-impulse:fired", (data) => {
    evaluateDecay();
    const consecutive = data.consecutiveFires ?? 0;
    const baseBoost = 0.25;
    const escalation = Math.min(baseBoost * consecutive * 0.5, 0.5);
    const totalBoost = Math.min(baseBoost + escalation, 0.8);
    satiation = Math.min(1, satiation + totalBoost);
    persistState();
  });
  unsubscribers.push(unsubFired);

  // ── Contextual modulation (body grounding) ──────────────────────
  // Cerebellum validation failures → drain cognitive satiation.
  // Like a student who keeps getting answers wrong — needs to learn more.
  const unsubCerebellum = bus.on("cerebellum:validated", (data) => {
    if (!config) return;
    if (!data.passed) {
      satiation = Math.max(0, satiation - 0.03);
      currentNeedLevel = computeNeedLevel();
    }
  });
  unsubscribers.push(unsubCerebellum);
}

// ── Основная логика ───────────────────────────────────────────────

function evaluateDecay(): void {
  if (!config) return;

  const now = Date.now();
  const elapsed = (now - lastDecayEvaluationTime) / config.decayIntervalMs;
  lastDecayEvaluationTime = now;

  if (elapsed <= 0) return;

  // Циркадная модуляция: затухание на 70% медленнее во время сна
  const circadianMod = circadianEnabled && isInSleepPhase() ? config.sleepDecayModifier : 1.0;

  // Серотониновая модуляция: высокий серотонин = больше довольства = медленнее затухание
  const neuroState = getNeuromodulatorState();
  const serotoninMod = 0.7 + neuroState.serotonin * 0.6;

  // Экспоненциальное затухание
  const effectiveRate =
    (config.baseDecayRate * adaptiveDecayModifier * circadianMod) / serotoninMod;
  const decayFactor = Math.pow(1 - effectiveRate, elapsed);
  satiation *= decayFactor;

  // Обнуление при пренебрежимо малых значениях
  if (satiation < 0.001) {
    satiation = 0;
  }

  // Определение нового уровня потребности
  const oldLevel = currentNeedLevel;
  currentNeedLevel = computeNeedLevel();

  // Излучение сигналов при переходе уровня потребности вверх
  if (needLevelRank(currentNeedLevel) > needLevelRank(oldLevel)) {
    lastNeedEmitTime = now;
    emitNeedSignals();
  }
  // No periodic re-emission — signals only on level transitions.
}

function computeNeedLevel(): NeedLevel {
  if (!config) return "none";
  if (satiation < config.needThresholds.urgent) return "urgent";
  if (satiation < config.needThresholds.strong) return "strong";
  if (satiation < config.needThresholds.moderate) return "moderate";
  if (satiation < config.needThresholds.mild) return "mild";
  return "none";
}

function needLevelRank(level: NeedLevel): number {
  const ranks: Record<NeedLevel, number> = {
    none: 0,
    mild: 1,
    moderate: 2,
    strong: 3,
    urgent: 4,
  };
  return ranks[level];
}

function emitNeedSignals(): void {
  if (!config || !deps) return;

  const now = Date.now();
  const need = 1 - satiation;

  totalNeedSignals++;

  // Всегда излучаем need-rising для любого уровня кроме "none"
  if (currentNeedLevel !== "none") {
    bus.emitSync("cognitive-hunger:need-rising", {
      needLevel: currentNeedLevel,
      satiation,
      need,
    });
    logger?.info(
      `BrainAgent CognitiveHunger: need rising → ${currentNeedLevel} (satiation=${satiation.toFixed(2)})`,
    );
  }

  // Moderate+: создание/усиление желания "understanding"
  if (
    needLevelRank(currentNeedLevel) >= needLevelRank("moderate") &&
    now - lastDesireUpdateTime > config.desireUpdateIntervalMs
  ) {
    lastDesireUpdateTime = now;
    updateUnderstandingDesire();
  }

  // Strong+: смещение DMN в сторону познавательных воспоминаний
  if (
    needLevelRank(currentNeedLevel) >= needLevelRank("strong") &&
    now - lastDMNBiasTime > config.dmnBiasIntervalMs
  ) {
    lastDMNBiasTime = now;
    biasDMNToLearningThoughts();
  }

  // Urgent: излучение дополнительного сильного сигнала позыва
  if (currentNeedLevel === "urgent") {
    bus.emitSync("cognitive-hunger:urge", {
      satiation,
      timeSinceLastLearning:
        lastLearningInteractionTime > 0 ? now - lastLearningInteractionTime : now,
    });
    logger?.info("BrainAgent CognitiveHunger: URGENT cognitive urge emitted!");
  }

  persistState();
}

function updateUnderstandingDesire(): void {
  if (!deps) return;

  // Определение силы желания на основе уровня потребности
  const strengthMap: Record<NeedLevel, number> = {
    none: 0,
    mild: 0.2,
    moderate: 0.4,
    strong: 0.7,
    urgent: 0.9,
  };
  const targetStrength = strengthMap[currentNeedLevel];

  // Проверка существующего желания understanding от cognitive-hunger
  const existing = deps
    .getDesires()
    .find((d) => d.type === "understanding" && d.source === "cognitive-hunger");

  if (existing) {
    if (existing.strength < targetStrength) {
      existing.strength = targetStrength;
    }
  } else {
    deps.addDesire(
      "understanding",
      "Feeling the urge to learn something new or explore a knowledge gap",
      targetStrength,
      "cognitive-hunger",
    );
  }

  logger?.info(
    `BrainAgent CognitiveHunger: understanding desire updated (strength=${targetStrength.toFixed(2)})`,
  );
}

function biasDMNToLearningThoughts(): void {
  if (!deps) return;

  // Запрос фактов из гиппокампа
  const knowledgeFacts = deps.getFactsByCategory("fact", 3);
  const topics: Array<{ topic: string }> = [];

  if (knowledgeFacts.length > 0) {
    for (const fact of knowledgeFacts) {
      topics.push({ topic: fact.content.slice(0, 100) });
    }
  } else {
    // Запасной вариант: генерация общей познавательной темы-затравки
    topics.push({ topic: "knowledge gaps and interesting topics to explore" });
  }

  deps.generateLearningThought(topics);
  logger?.info(`BrainAgent CognitiveHunger: biased DMN toward ${topics.length} learning topic(s)`);
}

function onLearningReward(signal: DopamineSignal): void {
  if (!config) return;
  evaluateDecay();

  const domain = signal.context.domain.toLowerCase();
  if (!config.learningDomains.includes(domain)) return;

  if (signal.reward > 0) {
    // Позитивное познавательное взаимодействие — буст насыщения
    const boost = Math.min(
      config.maxSatiationBoost,
      Math.max(0, signal.reward * config.learningRewardMultiplier),
    );
    satiation = Math.min(1.0, satiation + boost);

    // Adaptive decay: positive learning reward → drive sensitizes (decays faster
    // next time → hunger returns sooner → agent seeks more learning)
    adaptiveDecayModifier = Math.min(2.0, adaptiveDecayModifier + 0.005 * signal.reward);

    // Запись взаимодействия
    recordLearningInteraction(signal.reward, domain);

    // Снижение силы существующего желания understanding на 50% (удовлетворено)
    if (deps) {
      const existing = deps
        .getDesires()
        .find((d) => d.type === "understanding" && d.source === "cognitive-hunger");
      if (existing) {
        existing.strength *= 0.5;
      }
    }

    bus.emitSync("cognitive-hunger:satiated", {
      satiation,
      boostAmount: boost,
      source: domain,
    });

    logger?.info(
      `BrainAgent CognitiveHunger: satiated by ${domain} reward (boost=${boost.toFixed(2)}, ` +
        `satiation=${satiation.toFixed(2)})`,
    );
  } else if (signal.reward < 0) {
    // Негативный познавательный опыт — слегка снижаем насыщение
    // (плохой опыт заставляет хотеть *лучшего* обучения, а не меньше)
    const penalty = Math.abs(signal.reward) * 0.1;
    satiation = Math.max(0, satiation - penalty);

    // Adaptive decay: negative reward → drive desensitizes (decays slower)
    adaptiveDecayModifier = Math.max(0.5, adaptiveDecayModifier - 0.003 * Math.abs(signal.reward));

    logger?.info(
      `BrainAgent CognitiveHunger: negative learning experience (penalty=${penalty.toFixed(2)}, ` +
        `satiation=${satiation.toFixed(2)})`,
    );
  }

  // Пересчёт уровня потребности после изменения насыщения
  currentNeedLevel = computeNeedLevel();
  persistState();
}

function recordLearningInteraction(reward: number, context: string): void {
  if (!config) return;

  totalLearningRewards++;
  lastLearningInteractionTime = Date.now();

  learningInteractionHistory.push({
    timestamp: Date.now(),
    reward,
    context,
  });

  // Ограничение кольцевого буфера
  if (learningInteractionHistory.length > config.maxHistoryEntries) {
    learningInteractionHistory.shift();
  }
}

// ── Публичный API ─────────────────────────────────────────────────

export function getCognitiveHungerStats(): CognitiveHungerStats {
  evaluateDecay();
  const now = Date.now();
  return {
    satiation,
    needLevel: currentNeedLevel,
    need: 1 - satiation,
    lastLearningInteractionTime,
    timeSinceLastLearning: lastLearningInteractionTime > 0 ? now - lastLearningInteractionTime : -1,
    totalLearningRewards,
    totalNeedSignals,
    recentInteractionCount: learningInteractionHistory.length,
  };
}

export function getCognitiveHungerSatiation(): number {
  return satiation;
}

export function boostCognitiveHungerSatiation(amount: number, reason: string): void {
  const boost = Math.max(0, Math.min(1 - satiation, amount));
  satiation = Math.min(1, satiation + boost);
  currentNeedLevel = computeNeedLevel();

  bus.emitSync("cognitive-hunger:satiated", {
    satiation,
    boostAmount: boost,
    source: reason,
  });

  persistState();
  logger?.info(
    `BrainAgent CognitiveHunger: manual boost (amount=${boost.toFixed(2)}, reason=${reason})`,
  );
}

// ── Персистентность ───────────────────────────────────────────────

function loadState(): void {
  try {
    const filePath = join(storageDir, "state.json");
    if (existsSync(filePath)) {
      const raw = JSON.parse(readFileSync(filePath, "utf-8")) as PersistedState;
      satiation = raw.satiation ?? config?.initialSatiation ?? 0.6;
      lastLearningInteractionTime = raw.lastLearningInteractionTime ?? 0;
      // Restore decay timestamp so we account for time passed while offline
      lastDecayEvaluationTime = raw.lastDecayEvaluationTime ?? Date.now();
      adaptiveDecayModifier = raw.adaptiveDecayModifier ?? 1.0;
      totalLearningRewards = raw.totalLearningRewards ?? 0;
      totalNeedSignals = raw.totalNeedSignals ?? 0;
      learningInteractionHistory = raw.learningInteractionHistory ?? [];
      currentNeedLevel = computeNeedLevel();
    }
  } catch {
    // Начинаем с чистого состояния при повреждённых данных
  }
}

function persistState(): void {
  try {
    const filePath = join(storageDir, "state.json");
    const state: PersistedState = {
      satiation,
      lastLearningInteractionTime,
      lastDecayEvaluationTime,
      adaptiveDecayModifier,
      totalLearningRewards,
      totalNeedSignals,
      learningInteractionHistory,
    };
    writeFileSync(filePath, JSON.stringify(state, null, 2));
  } catch {
    // Некритичная ошибка
  }
}
