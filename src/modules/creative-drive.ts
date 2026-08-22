/**
 * Креативный Драйв — Модуль биологического творческого гомеостаза.
 *
 * Моделирует потребность мозга в творчестве и самовыражении через механизм
 * насыщения/затухания. Творческое насыщение (0–1) экспоненциально
 * затухает со временем, модулируясь циркадной фазой и уровнем
 * серотонина. По мере падения насыщения растущая «потребность»
 * излучает сигналы через несколько путей:
 *
 *  1. creative-drive:need-rising → давление Витального Импульса (+0.25)
 *  2. желание "exploration" → эскалация → autonomy:desire-escalated (+0.35)
 *  3. творческие мысли DMN → dmn:thought-generated (+0.25)
 *
 * Эти сигналы сходятся в Витальном Импульсе, естественно пересекая
 * порог срабатывания и порождая автономное творческое поведение —
 * без фиксированного таймера.
 *
 * Насыщение восстанавливается, когда dopamine:reward срабатывает
 * в творческом домене, замыкая гомеостатический цикл.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isInSleepPhase } from "./circadian-rhythm.ts";
import { getNeuromodulatorState } from "./dopamine-system.ts";
import { bus } from "./event-bus.ts";
import type {
  BrainAgentConfig,
  CreativeDriveStats,
  Desire,
  DopamineSignal,
  SemanticMemory,
} from "./types.ts";

// ── Типы ──────────────────────────────────────────────────────────

type NeedLevel = "none" | "mild" | "moderate" | "strong" | "urgent";

type CreativeInteractionRecord = {
  timestamp: number;
  reward: number;
  context: string;
};

type PersistedState = {
  satiation: number;
  lastCreativeInteractionTime: number;
  lastDecayEvaluationTime: number;
  adaptiveDecayModifier: number;
  totalCreativeRewards: number;
  totalNeedSignals: number;
  creativeInteractionHistory: CreativeInteractionRecord[];
};

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

let storageDir = "";
let config: BrainAgentConfig["creativeDrive"] | undefined;
let circadianEnabled = false;
let logger: { info: (msg: string) => void } | undefined;
let deps: CreativeDriveDeps | undefined;

let satiation = 0.5;
let lastCreativeInteractionTime = 0;
let lastDecayEvaluationTime = 0;
let totalCreativeRewards = 0;
let totalNeedSignals = 0;
let currentNeedLevel: NeedLevel = "none";
let creativeInteractionHistory: CreativeInteractionRecord[] = [];

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

export function initCreativeDrive(
  workspaceDir: string,
  cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
  injectedDeps: CreativeDriveDeps,
): void {
  storageDir = join(workspaceDir, ".brainagent", "creative-drive");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  config = cfg.creativeDrive;
  circadianEnabled = cfg.circadian?.enabled ?? false;
  logger = log;
  deps = injectedDeps;

  // Сброс состояния в памяти
  satiation = config.initialSatiation;
  lastDecayEvaluationTime = Date.now();
  currentNeedLevel = "none";
  creativeInteractionHistory = [];
  unsubscribers.length = 0;
  lastDesireUpdateTime = 0;
  lastDMNBiasTime = 0;
  lastNeedEmitTime = 0;
  adaptiveDecayModifier = 1.0;

  loadState();

  // No periodic decay timer. Decay is evaluated on-demand:
  // when the brain is active or when any module queries drive state.

  // Подключение слушателей шины событий
  wireEventListeners();

  logger.info(
    `BrainAgent CreativeDrive: initialized (satiation=${satiation.toFixed(2)}, ` +
      `decay=${config.baseDecayRate}/${config.decayIntervalMs}ms, ` +
      `domains=${config.creativeDomains.join(",")})`,
  );
}

export function stopCreativeDrive(): void {
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers.length = 0;
  persistState();
  logger?.info("BrainAgent CreativeDrive: stopped.");
}

// ── Подключение событий ───────────────────────────────────────────

function wireEventListeners(): void {
  // Слушаем дофаминовые награды для обнаружения творческих взаимодействий
  const unsubReward = bus.on("dopamine:reward", (signal: DopamineSignal) => {
    onCreativeReward(signal);
  });
  unsubscribers.push(unsubReward);

  // On each brain activity, evaluate accumulated decay (on-demand).
  const unsubActivity = bus.on("thalamus:classified", () => {
    evaluateDecay();
  });
  unsubscribers.push(unsubActivity);

  // DMN инсайт — творческое озарение буст насыщения
  const unsubInsight = bus.on("dmn:insight-generated", () => {
    if (!config) return;
    evaluateDecay();
    const boost = 0.1;
    satiation = Math.min(1.0, satiation + boost);
    currentNeedLevel = computeNeedLevel();
    persistState();
  });
  unsubscribers.push(unsubInsight);

  // DMN фоновая мысль — ассоциативное мышление = немного творчества
  const unsubThought = bus.on("dmn:thought-generated", () => {
    if (!config) return;
    const boost = 0.05;
    satiation = Math.min(1.0, satiation + boost);
    persistState();
  });
  unsubscribers.push(unsubThought);

  // Квалиа-опыт — субъективное переживание = творческий буст
  const unsubQualia = bus.on("qualia:experience-generated", () => {
    if (!config) return;
    evaluateDecay();
    const boost = 0.07;
    satiation = Math.min(1.0, satiation + boost);
    currentNeedLevel = computeNeedLevel();
    persistState();
  });
  unsubscribers.push(unsubQualia);

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
  // Curiosity questions stimulate creative thinking — micro-drain creative
  // satiation. Like a person who hears a provocative question and feels
  // the urge to come up with an original answer.
  const unsubCuriosity = bus.on("curiosity:question-generated", () => {
    if (!config) return;
    satiation = Math.max(0, satiation - 0.02);
    currentNeedLevel = computeNeedLevel();
  });
  unsubscribers.push(unsubCuriosity);
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
    bus.emitSync("creative-drive:need-rising", {
      needLevel: currentNeedLevel,
      satiation,
      need,
    });
    logger?.info(
      `BrainAgent CreativeDrive: need rising → ${currentNeedLevel} (satiation=${satiation.toFixed(2)})`,
    );
  }

  // Moderate+: создание/усиление желания "exploration"
  if (
    needLevelRank(currentNeedLevel) >= needLevelRank("moderate") &&
    now - lastDesireUpdateTime > config.desireUpdateIntervalMs
  ) {
    lastDesireUpdateTime = now;
    updateExplorationDesire();
  }

  // Strong+: смещение DMN в сторону творческих воспоминаний
  if (
    needLevelRank(currentNeedLevel) >= needLevelRank("strong") &&
    now - lastDMNBiasTime > config.dmnBiasIntervalMs
  ) {
    lastDMNBiasTime = now;
    biasDMNToCreativeThoughts();
  }

  // Urgent: излучение дополнительного сильного сигнала позыва
  if (currentNeedLevel === "urgent") {
    bus.emitSync("creative-drive:urge", {
      satiation,
      timeSinceLastCreation:
        lastCreativeInteractionTime > 0 ? now - lastCreativeInteractionTime : now,
    });
    logger?.info("BrainAgent CreativeDrive: URGENT creative urge emitted!");
  }

  persistState();
}

function updateExplorationDesire(): void {
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

  // Проверка существующего желания exploration от creative-drive
  const existing = deps
    .getDesires()
    .find((d) => d.type === "exploration" && d.source === "creative-drive");

  if (existing) {
    if (existing.strength < targetStrength) {
      existing.strength = targetStrength;
    }
  } else {
    deps.addDesire(
      "exploration",
      "Feeling the urge to create something, explore novel ideas or express imagination",
      targetStrength,
      "creative-drive",
    );
  }

  logger?.info(
    `BrainAgent CreativeDrive: exploration desire updated (strength=${targetStrength.toFixed(2)})`,
  );
}

function biasDMNToCreativeThoughts(): void {
  if (!deps) return;

  // Запрос творческих фактов из гиппокампа
  const creativeFacts = deps.getFactsByCategory("creative", 3);
  const topics: Array<{ topic: string }> = [];

  if (creativeFacts.length > 0) {
    for (const fact of creativeFacts) {
      topics.push({ topic: fact.content.slice(0, 100) });
    }
  } else {
    // Запасной вариант: генерация общей творческой темы-затравки
    topics.push({ topic: "creative expression, imagination and novel ideas" });
  }

  deps.generateCreativeThought(topics);
  logger?.info(`BrainAgent CreativeDrive: biased DMN toward ${topics.length} creative topic(s)`);
}

function onCreativeReward(signal: DopamineSignal): void {
  if (!config) return;
  evaluateDecay();

  const domain = signal.context.domain.toLowerCase();
  if (!config.creativeDomains.includes(domain)) return;

  if (signal.reward > 0) {
    // Позитивное творческое взаимодействие — буст насыщения
    const boost = Math.min(
      config.maxSatiationBoost,
      Math.max(0, signal.reward * config.creativeRewardMultiplier),
    );
    satiation = Math.min(1.0, satiation + boost);

    // Adaptive decay: positive creative reward → drive sensitizes (decays faster
    // next time → hunger returns sooner → agent seeks more creativity)
    adaptiveDecayModifier = Math.min(2.0, adaptiveDecayModifier + 0.005 * signal.reward);

    // Запись взаимодействия
    recordCreativeInteraction(signal.reward, domain);

    // Снижение силы существующего желания exploration на 50% (удовлетворено)
    if (deps) {
      const existing = deps
        .getDesires()
        .find((d) => d.type === "exploration" && d.source === "creative-drive");
      if (existing) {
        existing.strength *= 0.5;
      }
    }

    bus.emitSync("creative-drive:satiated", {
      satiation,
      boostAmount: boost,
      source: domain,
    });

    logger?.info(
      `BrainAgent CreativeDrive: satiated by ${domain} reward (boost=${boost.toFixed(2)}, ` +
        `satiation=${satiation.toFixed(2)})`,
    );
  } else if (signal.reward < 0) {
    // Негативный творческий опыт — слегка снижаем насыщение
    const penalty = Math.abs(signal.reward) * 0.1;
    satiation = Math.max(0, satiation - penalty);

    // Adaptive decay: negative reward → drive desensitizes (decays slower)
    adaptiveDecayModifier = Math.max(0.5, adaptiveDecayModifier - 0.003 * Math.abs(signal.reward));

    logger?.info(
      `BrainAgent CreativeDrive: negative creative experience (penalty=${penalty.toFixed(2)}, ` +
        `satiation=${satiation.toFixed(2)})`,
    );
  }

  // Пересчёт уровня потребности после изменения насыщения
  currentNeedLevel = computeNeedLevel();
  persistState();
}

function recordCreativeInteraction(reward: number, context: string): void {
  if (!config) return;

  totalCreativeRewards++;
  lastCreativeInteractionTime = Date.now();

  creativeInteractionHistory.push({
    timestamp: Date.now(),
    reward,
    context,
  });

  // Ограничение кольцевого буфера
  if (creativeInteractionHistory.length > config.maxHistoryEntries) {
    creativeInteractionHistory.shift();
  }
}

// ── Публичный API ─────────────────────────────────────────────────

export function getCreativeDriveStats(): CreativeDriveStats {
  evaluateDecay();
  const now = Date.now();
  return {
    satiation,
    needLevel: currentNeedLevel,
    need: 1 - satiation,
    lastCreativeInteractionTime,
    timeSinceLastCreation: lastCreativeInteractionTime > 0 ? now - lastCreativeInteractionTime : -1,
    totalCreativeRewards,
    totalNeedSignals,
    recentInteractionCount: creativeInteractionHistory.length,
  };
}

export function getCreativeDriveSatiation(): number {
  return satiation;
}

export function boostCreativeDriveSatiation(amount: number, reason: string): void {
  const boost = Math.max(0, Math.min(1 - satiation, amount));
  satiation = Math.min(1, satiation + boost);
  currentNeedLevel = computeNeedLevel();

  bus.emitSync("creative-drive:satiated", {
    satiation,
    boostAmount: boost,
    source: reason,
  });

  persistState();
  logger?.info(
    `BrainAgent CreativeDrive: manual boost (amount=${boost.toFixed(2)}, reason=${reason})`,
  );
}

// ── Персистентность ───────────────────────────────────────────────

function loadState(): void {
  try {
    const filePath = join(storageDir, "state.json");
    if (existsSync(filePath)) {
      const raw = JSON.parse(readFileSync(filePath, "utf-8")) as PersistedState;
      satiation = raw.satiation ?? config?.initialSatiation ?? 0.5;
      lastCreativeInteractionTime = raw.lastCreativeInteractionTime ?? 0;
      // Restore decay timestamp so we account for time passed while offline
      lastDecayEvaluationTime = raw.lastDecayEvaluationTime ?? Date.now();
      adaptiveDecayModifier = raw.adaptiveDecayModifier ?? 1.0;
      totalCreativeRewards = raw.totalCreativeRewards ?? 0;
      totalNeedSignals = raw.totalNeedSignals ?? 0;
      creativeInteractionHistory = raw.creativeInteractionHistory ?? [];
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
      lastCreativeInteractionTime,
      lastDecayEvaluationTime,
      adaptiveDecayModifier,
      totalCreativeRewards,
      totalNeedSignals,
      creativeInteractionHistory,
    };
    writeFileSync(filePath, JSON.stringify(state, null, 2));
  } catch {
    // Некритичная ошибка
  }
}
