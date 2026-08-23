/**
 * Драйв Мастерства — Модуль биологического стремления к совершенствованию.
 *
 * Моделирует потребность мозга в улучшении навыков через механизм
 * насыщения/затухания С ОТСЛЕЖИВАНИЕМ ПО ДОМЕНАМ. Каждый домен
 * (technical, creative, social и т.д.) имеет собственное насыщение (0–1),
 * которое экспоненциально затухает со временем.
 *
 * Агрегатное насыщение = минимум по всем активным доменам
 * (модель «слабого звена» — худший домен определяет уровень потребности).
 *
 * По мере падения агрегатного насыщения растущая «потребность»
 * излучает сигналы через несколько путей:
 *
 *  1. mastery-drive:need-rising → давление Витального Импульса (+0.20)
 *  2. желание "mastery" → эскалация → autonomy:desire-escalated (+0.35)
 *  3. мысли DMN о зонах слабости → dmn:thought-generated (+0.25)
 *
 * Насыщение домена восстанавливается, когда:
 *  - dopamine:reward приходит с положительным predictionError (улучшение)
 *  - learning:domain-performance-updated показывает прогресс
 *  - identity:capability-updated фиксирует рост уровня
 *  - cerebellum:validated проходит успешно
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cancelPersist, flushPersist, schedulePersist } from "./persist.ts";
import { isInSleepPhase } from "./circadian-rhythm.ts";
import { getNeuromodulatorState } from "./dopamine-system.ts";
import { bus } from "./event-bus.ts";
import type {
  BrainAgentConfig,
  Desire,
  DopamineSignal,
  MasteryDriveStats,
  SemanticMemory,
} from "./types.ts";

// ── Типы ──────────────────────────────────────────────────────────

type NeedLevel = "none" | "mild" | "moderate" | "strong" | "urgent";

type DomainMastery = {
  satiation: number;
  lastActivityTime: number;
  totalRewards: number;
};

type PersistedState = {
  domainSatiations: Record<string, DomainMastery>;
  lastDecayEvaluationTime: number;
  adaptiveDecayModifier: number;
  totalImprovementRewards: number;
  totalNeedSignals: number;
};

type MasteryDriveDeps = {
  addDesire: (
    type: Desire["type"],
    description: string,
    strength: number,
    source: string,
  ) => Desire;
  getDesires: () => Desire[];
  getFactsByCategory: (category: string, limit?: number) => SemanticMemory[];
  generateMasteryThought: (topics: Array<{ topic: string }>) => void;
};

// ── Состояние модуля ──────────────────────────────────────────────

let storageDir = "";
let config: BrainAgentConfig["masteryDrive"] | undefined;
let circadianEnabled = false;
let logger: { info: (msg: string) => void } | undefined;
let deps: MasteryDriveDeps | undefined;

let domainSatiations = new Map<string, DomainMastery>();
let lastDecayEvaluationTime = 0;
let totalImprovementRewards = 0;
let totalNeedSignals = 0;
let currentNeedLevel: NeedLevel = "none";

const unsubscribers: Array<() => void> = [];
let lastDesireUpdateTime = 0;
let lastDMNBiasTime = 0;
let lastNeedEmitTime = 0;

/**
 * Adaptive decay modifier — evolves through dopamine reward.
 * > 1.0 = faster decay = mastery hunger returns sooner (drive sensitized)
 * < 1.0 = slower decay = mastery hunger returns later (drive desensitized)
 * Clamped to [0.5, 2.0]. Persisted across sessions.
 */
let adaptiveDecayModifier = 1.0;

// ── Инициализация ─────────────────────────────────────────────────

export function initMasteryDrive(
  workspaceDir: string,
  cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
  injectedDeps: MasteryDriveDeps,
): void {
  storageDir = join(workspaceDir, ".brainagent", "mastery-drive");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  config = cfg.masteryDrive;
  circadianEnabled = cfg.circadian?.enabled ?? false;
  logger = log;
  deps = injectedDeps;

  // Сброс состояния в памяти
  domainSatiations = new Map();
  lastDecayEvaluationTime = Date.now();
  currentNeedLevel = "none";
  unsubscribers.length = 0;
  lastDesireUpdateTime = 0;
  lastDMNBiasTime = 0;
  lastNeedEmitTime = 0;
  totalImprovementRewards = 0;
  totalNeedSignals = 0;
  adaptiveDecayModifier = 1.0;

  // Отложенная запись прежнего экземпляра (пере-инициализация) больше не актуальна
  cancelPersist(join(storageDir, "state.json"));
  loadState();

  // No periodic decay timer. Decay is evaluated on-demand:
  // when the brain is active or when any module queries drive state.

  // Подключение слушателей шины событий
  wireEventListeners();

  logger.info(
    `BrainAgent MasteryDrive: initialized (domains=${domainSatiations.size}, ` +
      `decay=${config.baseDecayRate}/${config.decayIntervalMs}ms, ` +
      `maxDomains=${config.maxTrackedDomains})`,
  );
}

export function stopMasteryDrive(): void {
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers.length = 0;
  persistState();
  flushPersist(join(storageDir, "state.json"));
  logger?.info("BrainAgent MasteryDrive: stopped.");
}

// ── Подключение событий ───────────────────────────────────────────

function wireEventListeners(): void {
  // Дофаминовые награды — буст домена при положительной ошибке предсказания (улучшение)
  const unsubReward = bus.on("dopamine:reward", (signal: DopamineSignal) => {
    onMasteryReward(signal);
  });
  unsubscribers.push(unsubReward);

  // On each brain activity, evaluate accumulated decay (on-demand).
  const unsubActivity = bus.on("thalamus:classified", () => {
    evaluateDecay();
  });
  unsubscribers.push(unsubActivity);

  // Ошибка предсказания — прямой сигнал об улучшении/ухудшении
  const unsubPredError = bus.on("dopamine:prediction-error", (data) => {
    if (!config) return;
    evaluateDecay();
    // Извлекаем домен из context (строка, может содержать имя домена)
    const domain = data.context.toLowerCase();
    if (data.error > 0) {
      // Положительная ошибка = справились лучше ожидаемого
      const boost = Math.min(config.maxSatiationBoost, data.error * 0.15);
      boostDomain(domain, boost);
    } else if (data.error < 0) {
      // Отрицательная ошибка = справились хуже ожидаемого — усиление голода
      const drain = Math.abs(data.error) * 0.08;
      drainDomain(domain, drain);
    }
  });
  unsubscribers.push(unsubPredError);

  // Улучшение показателей домена — значительный буст
  const unsubPerf = bus.on("learning:domain-performance-updated", (data) => {
    if (!config) return;
    evaluateDecay();
    if (data.trend === "improving") {
      boostDomain(data.domain.toLowerCase(), 0.1);
    }
  });
  unsubscribers.push(unsubPerf);

  // Обновление уровня способностей — буст домена
  const unsubCapability = bus.on("identity:capability-updated", (data) => {
    if (!config) return;
    evaluateDecay();
    boostDomain(data.domain.toLowerCase(), 0.08);
  });
  unsubscribers.push(unsubCapability);

  // Валидация мозжечком — прошёл: микро-буст всем, не прошёл: дренаж слабейшего
  const unsubCerebellum = bus.on("cerebellum:validated", (data) => {
    if (!config) return;
    evaluateDecay();
    if (data.passed) {
      // Микро-буст всем активным доменам
      for (const [domain] of domainSatiations) {
        boostDomain(domain, 0.02);
      }
    } else {
      // Дренаж слабейшего домена — неудача усиливает стремление к мастерству
      const weakest = findWeakestDomain();
      if (weakest) {
        drainDomain(weakest.domain, 0.04);
      }
    }
  });
  unsubscribers.push(unsubCerebellum);

  // Срабатывание Витального Импульса — безусловный буст всех активных доменов,
  // нарастающий с каждым подряд срабатыванием без ответа пользователя
  const unsubFired = bus.on("vital-impulse:fired", (data) => {
    evaluateDecay();
    const consecutive = data.consecutiveFires ?? 0;
    const baseBoost = 0.25;
    const escalation = Math.min(baseBoost * consecutive * 0.5, 0.5);
    const totalBoost = Math.min(baseBoost + escalation, 0.8);
    for (const [domain] of domainSatiations) {
      boostDomain(domain, totalBoost);
    }
  });
  unsubscribers.push(unsubFired);

  // ── Contextual modulation (body grounding) ──────────────────────
  // Frustration emotion → drain weakest domain. Like a person who gets
  // frustrated with their own mistakes and feels a stronger urge to practice.
  const unsubAmygdala = bus.on("amygdala:assessed", (data) => {
    if (!config) return;
    if (data.emotion === "frustration" && data.emotionIntensity > 0.5) {
      const weakest = findWeakestDomain();
      if (weakest) {
        const drain = data.emotionIntensity * 0.03;
        drainDomain(weakest.domain, drain);
      }
    }
  });
  unsubscribers.push(unsubAmygdala);
}

// ── Управление доменами ───────────────────────────────────────────

function getOrCreateDomain(domain: string): DomainMastery {
  let entry = domainSatiations.get(domain);
  if (!entry) {
    entry = {
      satiation: config?.initialSatiation ?? 0.5,
      lastActivityTime: Date.now(),
      totalRewards: 0,
    };
    domainSatiations.set(domain, entry);

    // Ограничение количества отслеживаемых доменов
    pruneDomainsIfNeeded();
  }
  return entry;
}

function pruneDomainsIfNeeded(): void {
  if (!config) return;
  while (domainSatiations.size > config.maxTrackedDomains) {
    // Удаляем домен с наивысшим насыщением (наименее нуждающийся)
    let maxSatiation = -1;
    let maxDomain = "";
    for (const [domain, mastery] of domainSatiations) {
      if (mastery.satiation > maxSatiation) {
        maxSatiation = mastery.satiation;
        maxDomain = domain;
      }
    }
    if (maxDomain) {
      domainSatiations.delete(maxDomain);
    }
  }
}

function boostDomain(domain: string, amount: number): void {
  const entry = getOrCreateDomain(domain);
  const boost = Math.min(config?.maxSatiationBoost ?? 0.6, Math.max(0, amount));
  entry.satiation = Math.min(1.0, entry.satiation + boost);
  entry.lastActivityTime = Date.now();
  currentNeedLevel = computeNeedLevel();
  persistState();
}

function drainDomain(domain: string, amount: number): void {
  const entry = getOrCreateDomain(domain);
  entry.satiation = Math.max(0, entry.satiation - amount);
  entry.lastActivityTime = Date.now();
  currentNeedLevel = computeNeedLevel();
  persistState();
}

function findWeakestDomain(): { domain: string; mastery: DomainMastery } | null {
  let minSatiation = Infinity;
  let weakestDomain = "";
  let weakestMastery: DomainMastery | null = null;
  for (const [domain, mastery] of domainSatiations) {
    if (mastery.satiation < minSatiation) {
      minSatiation = mastery.satiation;
      weakestDomain = domain;
      weakestMastery = mastery;
    }
  }
  return weakestMastery ? { domain: weakestDomain, mastery: weakestMastery } : null;
}

function findMostActiveDomain(): { domain: string; mastery: DomainMastery } | null {
  let maxTime = 0;
  let activeDomain = "";
  let activeMastery: DomainMastery | null = null;
  for (const [domain, mastery] of domainSatiations) {
    if (mastery.lastActivityTime > maxTime) {
      maxTime = mastery.lastActivityTime;
      activeDomain = domain;
      activeMastery = mastery;
    }
  }
  return activeMastery ? { domain: activeDomain, mastery: activeMastery } : null;
}

/** Агрегатное насыщение = минимум по всем доменам (модель слабого звена) */
function getAggregateSatiation(): number {
  if (domainSatiations.size === 0) return config?.initialSatiation ?? 0.5;
  let min = Infinity;
  for (const [, mastery] of domainSatiations) {
    if (mastery.satiation < min) {
      min = mastery.satiation;
    }
  }
  return min;
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

  // Серотониновая модуляция
  const neuroState = getNeuromodulatorState();
  const serotoninMod = 0.7 + neuroState.serotonin * 0.6;

  // Затухание каждого домена независимо
  for (const [, mastery] of domainSatiations) {
    let effectiveRate =
      (config.baseDecayRate * adaptiveDecayModifier * circadianMod) / serotoninMod;

    // Неактивные домены затухают быстрее
    const inactiveMs = now - mastery.lastActivityTime;
    if (inactiveMs > 10 * 60 * 1000) {
      // > 10 минут неактивности
      effectiveRate *= config.inactiveDomainDecayMultiplier;
    }

    const decayFactor = Math.pow(1 - effectiveRate, elapsed);
    mastery.satiation *= decayFactor;

    if (mastery.satiation < 0.001) {
      mastery.satiation = 0;
    }
  }

  // Определение нового уровня потребности по агрегатному насыщению
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
  const aggregate = getAggregateSatiation();
  if (aggregate < config.needThresholds.urgent) return "urgent";
  if (aggregate < config.needThresholds.strong) return "strong";
  if (aggregate < config.needThresholds.moderate) return "moderate";
  if (aggregate < config.needThresholds.mild) return "mild";
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
  const aggregate = getAggregateSatiation();
  const need = 1 - aggregate;
  const weakest = findWeakestDomain();

  totalNeedSignals++;

  // Всегда излучаем need-rising для любого уровня кроме "none"
  if (currentNeedLevel !== "none") {
    bus.emitSync("mastery-drive:need-rising", {
      needLevel: currentNeedLevel,
      satiation: aggregate,
      need,
      domain: weakest?.domain,
    });
    logger?.info(
      `BrainAgent MasteryDrive: need rising → ${currentNeedLevel} ` +
        `(aggregate=${aggregate.toFixed(2)}, weakest=${weakest?.domain ?? "none"})`,
    );
  }

  // Moderate+: создание/усиление желания "mastery"
  if (
    needLevelRank(currentNeedLevel) >= needLevelRank("moderate") &&
    now - lastDesireUpdateTime > config.desireUpdateIntervalMs
  ) {
    lastDesireUpdateTime = now;
    updateMasteryDesire(weakest?.domain);
  }

  // Strong+: смещение DMN в сторону зон слабости
  if (
    needLevelRank(currentNeedLevel) >= needLevelRank("strong") &&
    now - lastDMNBiasTime > config.dmnBiasIntervalMs
  ) {
    lastDMNBiasTime = now;
    biasDMNToMasteryThoughts(weakest?.domain);
  }

  // Urgent: излучение дополнительного сильного сигнала позыва
  if (currentNeedLevel === "urgent" && weakest) {
    bus.emitSync("mastery-drive:urge", {
      satiation: aggregate,
      weakestDomain: weakest.domain,
      domainSatiation: weakest.mastery.satiation,
    });
    logger?.info(
      `BrainAgent MasteryDrive: URGENT mastery urge emitted! ` +
        `(weakest=${weakest.domain}, satiation=${weakest.mastery.satiation.toFixed(2)})`,
    );
  }

  persistState();
}

function updateMasteryDesire(weakestDomain?: string): void {
  if (!deps) return;

  const strengthMap: Record<NeedLevel, number> = {
    none: 0,
    mild: 0.2,
    moderate: 0.4,
    strong: 0.7,
    urgent: 0.9,
  };
  const targetStrength = strengthMap[currentNeedLevel];

  const description = weakestDomain
    ? `Feeling the need to improve and practice — especially in ${weakestDomain} domain`
    : "Feeling the need to improve skills and grow as an agent";

  // Проверка существующего желания mastery от mastery-drive
  const existing = deps
    .getDesires()
    .find((d) => d.type === "mastery" && d.source === "mastery-drive");

  if (existing) {
    if (existing.strength < targetStrength) {
      existing.strength = targetStrength;
    }
    // Обновляем описание с текущим слабейшим доменом
    existing.description = description;
  } else {
    deps.addDesire("mastery", description, targetStrength, "mastery-drive");
  }

  logger?.info(
    `BrainAgent MasteryDrive: mastery desire updated (strength=${targetStrength.toFixed(2)}, ` +
      `weakest=${weakestDomain ?? "none"})`,
  );
}

function biasDMNToMasteryThoughts(weakestDomain?: string): void {
  if (!deps) return;

  const topics: Array<{ topic: string }> = [];

  if (weakestDomain) {
    // Запрос фактов о навыках из гиппокампа
    const skillFacts = deps.getFactsByCategory("skill", 2);
    if (skillFacts.length > 0) {
      for (const fact of skillFacts) {
        topics.push({ topic: fact.content.slice(0, 100) });
      }
    }
    topics.push({ topic: `areas of improvement and skill gaps in ${weakestDomain}` });
  } else {
    topics.push({ topic: "self-improvement, skill practice and mastery growth" });
  }

  deps.generateMasteryThought(topics);
  logger?.info(`BrainAgent MasteryDrive: biased DMN toward ${topics.length} mastery topic(s)`);
}

function onMasteryReward(signal: DopamineSignal): void {
  if (!config) return;
  evaluateDecay();

  const domain = signal.context.domain.toLowerCase();

  // Мастерство реагирует на ПОЛОЖИТЕЛЬНУЮ ошибку предсказания (превзошли ожидания)
  if (signal.predictionError > 0) {
    const boost = Math.min(
      config.maxSatiationBoost,
      Math.max(0, signal.predictionError * config.improvementRewardMultiplier),
    );

    const entry = getOrCreateDomain(domain);
    entry.satiation = Math.min(1.0, entry.satiation + boost);
    entry.lastActivityTime = Date.now();
    entry.totalRewards++;
    totalImprovementRewards++;

    // Adaptive decay: positive improvement → drive sensitizes (decays faster
    // next time → mastery hunger returns sooner → agent seeks more practice)
    adaptiveDecayModifier = Math.min(2.0, adaptiveDecayModifier + 0.005 * signal.predictionError);

    // Снижение силы существующего желания mastery на 30% (частичное удовлетворение)
    if (deps) {
      const existing = deps
        .getDesires()
        .find((d) => d.type === "mastery" && d.source === "mastery-drive");
      if (existing) {
        existing.strength *= 0.7;
      }
    }

    bus.emitSync("mastery-drive:satiated", {
      satiation: entry.satiation,
      boostAmount: boost,
      source: `improvement-${domain}`,
      domain,
    });

    logger?.info(
      `BrainAgent MasteryDrive: satiated in ${domain} (boost=${boost.toFixed(2)}, ` +
        `satiation=${entry.satiation.toFixed(2)})`,
    );
  } else if (signal.predictionError < 0 && signal.reward >= 0) {
    // Хуже ожидаемого, но не провал — лёгкий дренаж (не выросли как хотели)
    const drain = Math.abs(signal.predictionError) * 0.05;
    drainDomain(domain, drain);

    // Adaptive decay: below expectations → drive desensitizes slightly
    adaptiveDecayModifier = Math.max(
      0.5,
      adaptiveDecayModifier - 0.003 * Math.abs(signal.predictionError),
    );

    logger?.info(
      `BrainAgent MasteryDrive: below expectations in ${domain} (drain=${drain.toFixed(2)})`,
    );
  }

  currentNeedLevel = computeNeedLevel();
  persistState();
}

// ── Публичный API ─────────────────────────────────────────────────

export function getMasteryDriveStats(): MasteryDriveStats {
  evaluateDecay();
  const aggregate = getAggregateSatiation();
  const weakest = findWeakestDomain();

  const domainMap: Record<string, number> = {};
  for (const [domain, mastery] of domainSatiations) {
    domainMap[domain] = mastery.satiation;
  }

  return {
    satiation: aggregate,
    needLevel: currentNeedLevel,
    need: 1 - aggregate,
    weakestDomain: weakest?.domain ?? "none",
    weakestDomainSatiation: weakest?.mastery.satiation ?? 0,
    activeDomainCount: domainSatiations.size,
    domainSatiations: domainMap,
    totalImprovementRewards,
    totalNeedSignals,
  };
}

export function getMasteryAggregateSatiation(): number {
  return getAggregateSatiation();
}

export function boostMasteryDomainSatiation(domain: string, amount: number, reason: string): void {
  boostDomain(domain, amount);

  bus.emitSync("mastery-drive:satiated", {
    satiation: getOrCreateDomain(domain).satiation,
    boostAmount: amount,
    source: reason,
    domain,
  });

  logger?.info(
    `BrainAgent MasteryDrive: manual boost in ${domain} (amount=${amount.toFixed(2)}, reason=${reason})`,
  );
}

// ── Персистентность ───────────────────────────────────────────────

function loadState(): void {
  try {
    const filePath = join(storageDir, "state.json");
    if (existsSync(filePath)) {
      const raw = JSON.parse(readFileSync(filePath, "utf-8")) as PersistedState;
      totalImprovementRewards = raw.totalImprovementRewards ?? 0;
      totalNeedSignals = raw.totalNeedSignals ?? 0;
      adaptiveDecayModifier = raw.adaptiveDecayModifier ?? 1.0;
      // Restore decay timestamp so we account for time passed while offline
      lastDecayEvaluationTime = raw.lastDecayEvaluationTime ?? Date.now();

      if (raw.domainSatiations) {
        domainSatiations = new Map();
        for (const [domain, mastery] of Object.entries(raw.domainSatiations)) {
          domainSatiations.set(domain, {
            satiation: mastery.satiation ?? config?.initialSatiation ?? 0.5,
            lastActivityTime: mastery.lastActivityTime ?? 0,
            totalRewards: mastery.totalRewards ?? 0,
          });
        }
      }

      currentNeedLevel = computeNeedLevel();
    }
  } catch {
    // Начинаем с чистого состояния при повреждённых данных
  }
}

function persistState(): void {
  // Debounce + ленивый сериализатор: на диск уходит самое свежее состояние
  schedulePersist(join(storageDir, "state.json"), () => {
    const domainMap: Record<string, DomainMastery> = {};
    for (const [domain, mastery] of domainSatiations) {
      domainMap[domain] = mastery;
    }
    const state: PersistedState = {
      domainSatiations: domainMap,
      lastDecayEvaluationTime,
      adaptiveDecayModifier,
      totalImprovementRewards,
      totalNeedSignals,
    };
    return JSON.stringify(state, null, 2);
  });
}
