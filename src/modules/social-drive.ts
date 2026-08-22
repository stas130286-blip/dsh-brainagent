/**
 * Социальный Драйв — Модуль биологического социального гомеостаза.
 *
 * Моделирует потребность мозга в социальной связи через механизм
 * насыщения/затухания. Социальное насыщение (0–1) экспоненциально
 * затухает со временем, модулируясь циркадной фазой и уровнем
 * серотонина. По мере падения насыщения растущая «потребность»
 * излучает сигналы через несколько путей:
 *
 *  1. social-drive:need-rising → давление Витального Импульса (+0.35)
 *  2. желание "connection" → эскалация → autonomy:desire-escalated (+0.35)
 *  3. социальные мысли DMN → dmn:thought-generated (+0.25)
 *
 * Эти сигналы сходятся в Витальном Импульсе, естественно пересекая
 * порог срабатывания и порождая автономное социальное взаимодействие —
 * без фиксированного таймера «зайди в Moltbook в 14:30».
 *
 * Насыщение восстанавливается, когда dopamine:reward срабатывает
 * в социальном домене, замыкая гомеостатический цикл.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isInSleepPhase } from "./circadian-rhythm.ts";
import { getNeuromodulatorState } from "./dopamine-system.ts";
import { bus } from "./event-bus.ts";
import type {
  BrainAgentConfig,
  Desire,
  DopamineSignal,
  SemanticMemory,
  SocialDriveStats,
} from "./types.ts";

// ── Типы ──────────────────────────────────────────────────────────

type NeedLevel = "none" | "mild" | "moderate" | "strong" | "urgent";

type SocialInteractionRecord = {
  timestamp: number;
  reward: number;
  context: string;
};

type PersistedState = {
  satiation: number;
  lastSocialInteractionTime: number;
  lastDecayEvaluationTime: number;
  adaptiveDecayModifier: number;
  totalSocialRewards: number;
  totalNeedSignals: number;
  socialInteractionHistory: SocialInteractionRecord[];
};

type SocialDriveDeps = {
  addDesire: (
    type: Desire["type"],
    description: string,
    strength: number,
    source: string,
  ) => Desire;
  getDesires: () => Desire[];
  getFactsByCategory: (category: string, limit?: number) => SemanticMemory[];
  generateSocialThought: (topics: Array<{ topic: string }>) => void;
};

// ── Состояние модуля ──────────────────────────────────────────────

let storageDir = "";
let config: BrainAgentConfig["socialDrive"] | undefined;
let circadianEnabled = false;
let logger: { info: (msg: string) => void } | undefined;
let deps: SocialDriveDeps | undefined;

let satiation = 0.5;
let lastSocialInteractionTime = 0;
let lastDecayEvaluationTime = 0;
let totalSocialRewards = 0;
let totalNeedSignals = 0;
let currentNeedLevel: NeedLevel = "none";
let socialInteractionHistory: SocialInteractionRecord[] = [];

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

export function initSocialDrive(
  workspaceDir: string,
  cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
  injectedDeps: SocialDriveDeps,
): void {
  storageDir = join(workspaceDir, ".brainagent", "social-drive");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  config = cfg.socialDrive;
  circadianEnabled = cfg.circadian?.enabled ?? false;
  logger = log;
  deps = injectedDeps;

  // Сброс состояния в памяти
  satiation = config.initialSatiation;
  lastDecayEvaluationTime = Date.now();
  currentNeedLevel = "none";
  socialInteractionHistory = [];
  unsubscribers.length = 0;
  lastDesireUpdateTime = 0;
  lastDMNBiasTime = 0;
  lastNeedEmitTime = 0;
  adaptiveDecayModifier = 1.0;

  loadState();

  // No periodic decay timer. Instead, decay is evaluated on-demand:
  // whenever the brain is active (thalamus classifies a message) or
  // when any module queries drive state. Elapsed time since last
  // evaluation is computed and exponential decay applied — like
  // biological hunger that you only notice when you think about food.

  // Подключение слушателей шины событий
  wireEventListeners();

  logger.info(
    `BrainAgent SocialDrive: initialized (satiation=${satiation.toFixed(2)}, ` +
      `decay=${config.baseDecayRate}/${config.decayIntervalMs}ms, ` +
      `domains=${config.socialDomains.join(",")})`,
  );
}

export function stopSocialDrive(): void {
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers.length = 0;
  persistState();
  logger?.info("BrainAgent SocialDrive: stopped.");
}

// ── Подключение событий ───────────────────────────────────────────

function wireEventListeners(): void {
  // Слушаем дофаминовые награды для обнаружения социальных взаимодействий
  const unsubReward = bus.on("dopamine:reward", (signal: DopamineSignal) => {
    onSocialReward(signal);
  });
  unsubscribers.push(unsubReward);

  // On each brain activity (message classified by thalamus), evaluate
  // accumulated decay. This is the biological equivalent of "noticing
  // your hunger when your brain is busy with something else."
  const unsubActivity = bus.on("thalamus:classified", () => {
    evaluateDecay();
  });
  unsubscribers.push(unsubActivity);

  // Слушаем срабатывания Витального Импульса — безусловный буст насыщения,
  // нарастающий с каждым подряд срабатыванием без ответа пользователя.
  // Как человек, который перестаёт писать, если ему не отвечают.
  const unsubFired = bus.on("vital-impulse:fired", (data) => {
    evaluateDecay();
    const consecutive = data.consecutiveFires ?? 0;
    const baseBoost = 0.3;
    const escalation = Math.min(baseBoost * consecutive * 0.5, 0.5);
    const totalBoost = Math.min(baseBoost + escalation, 0.8);
    satiation = Math.min(1, satiation + totalBoost);
    persistState();
  });
  unsubscribers.push(unsubFired);

  // ── Contextual modulation (body grounding) ──────────────────────
  // Emotional encounters with empathy needed → micro-drain social satiation.
  // Like a person who feels drained after an intense emotional conversation.
  const unsubAmygdala = bus.on("amygdala:assessed", (data) => {
    if (!config) return;
    if (data.empathyNeeded && data.emotionIntensity > 0.6) {
      const drain = data.emotionIntensity * 0.04;
      satiation = Math.max(0, satiation - drain);
      currentNeedLevel = computeNeedLevel();
    }
  });
  unsubscribers.push(unsubAmygdala);
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
    bus.emitSync("social-drive:need-rising", {
      needLevel: currentNeedLevel,
      satiation,
      need,
    });
    logger?.info(
      `BrainAgent SocialDrive: need rising → ${currentNeedLevel} (satiation=${satiation.toFixed(2)})`,
    );
  }

  // Moderate+: создание/усиление желания "connection"
  if (
    needLevelRank(currentNeedLevel) >= needLevelRank("moderate") &&
    now - lastDesireUpdateTime > config.desireUpdateIntervalMs
  ) {
    lastDesireUpdateTime = now;
    updateConnectionDesire();
  }

  // Strong+: смещение DMN в сторону социальных воспоминаний
  if (
    needLevelRank(currentNeedLevel) >= needLevelRank("strong") &&
    now - lastDMNBiasTime > config.dmnBiasIntervalMs
  ) {
    lastDMNBiasTime = now;
    biasDMNToSocialThoughts();
  }

  // Urgent: излучение дополнительного сильного сигнала позыва
  if (currentNeedLevel === "urgent") {
    bus.emitSync("social-drive:urge", {
      satiation,
      timeSinceLastSocial: lastSocialInteractionTime > 0 ? now - lastSocialInteractionTime : now,
    });
    logger?.info("BrainAgent SocialDrive: URGENT social urge emitted!");
  }

  persistState();
}

function updateConnectionDesire(): void {
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

  // Проверка существующего желания connection от social-drive
  const existing = deps
    .getDesires()
    .find((d) => d.type === "connection" && d.source === "social-drive");

  if (existing) {
    // Обновляем только если наша цель выше (не перезаписываем внешние бусты)
    if (existing.strength < targetStrength) {
      existing.strength = targetStrength;
    }
  } else {
    deps.addDesire(
      "connection",
      "Feeling the urge to connect with someone or check in on social circles",
      targetStrength,
      "social-drive",
    );
  }

  logger?.info(
    `BrainAgent SocialDrive: connection desire updated (strength=${targetStrength.toFixed(2)})`,
  );
}

function biasDMNToSocialThoughts(): void {
  if (!deps) return;

  // Запрос фактов о взаимоотношениях из гиппокампа
  const socialFacts = deps.getFactsByCategory("relationship", 3);
  const topics: Array<{ topic: string }> = [];

  if (socialFacts.length > 0) {
    for (const fact of socialFacts) {
      topics.push({ topic: fact.content.slice(0, 100) });
    }
  } else {
    // Запасной вариант: генерация общей социальной темы-затравки
    topics.push({ topic: "social connections and interactions with others" });
  }

  deps.generateSocialThought(topics);
  logger?.info(`BrainAgent SocialDrive: biased DMN toward ${topics.length} social topic(s)`);
}

function onSocialReward(signal: DopamineSignal): void {
  if (!config) return;
  evaluateDecay();

  const domain = signal.context.domain.toLowerCase();
  if (!config.socialDomains.includes(domain)) return;

  if (signal.reward > 0) {
    // Позитивное социальное взаимодействие — буст насыщения
    const boost = Math.min(
      config.maxSatiationBoost,
      Math.max(0, signal.reward * config.socialRewardMultiplier),
    );
    satiation = Math.min(1.0, satiation + boost);

    // Adaptive decay: positive social reward → drive sensitizes (decays faster
    // next time → hunger returns sooner → agent seeks more social interaction)
    adaptiveDecayModifier = Math.min(2.0, adaptiveDecayModifier + 0.005 * signal.reward);

    // Запись взаимодействия
    recordSocialInteraction(signal.reward, domain);

    // Снижение силы существующего желания connection на 50% (удовлетворено)
    if (deps) {
      const existing = deps
        .getDesires()
        .find((d) => d.type === "connection" && d.source === "social-drive");
      if (existing) {
        existing.strength *= 0.5;
      }
    }

    bus.emitSync("social-drive:satiated", {
      satiation,
      boostAmount: boost,
      source: domain,
    });

    logger?.info(
      `BrainAgent SocialDrive: satiated by ${domain} reward (boost=${boost.toFixed(2)}, ` +
        `satiation=${satiation.toFixed(2)})`,
    );
  } else if (signal.reward < 0) {
    // Негативное социальное взаимодействие — слегка снижаем насыщение
    // (плохой социальный опыт заставляет хотеть *лучшего* общения, а не меньше)
    const penalty = Math.abs(signal.reward) * 0.1;
    satiation = Math.max(0, satiation - penalty);

    // Adaptive decay: negative reward → drive desensitizes (decays slower
    // next time → hunger returns later → agent avoids social for a while)
    adaptiveDecayModifier = Math.max(0.5, adaptiveDecayModifier - 0.003 * Math.abs(signal.reward));

    logger?.info(
      `BrainAgent SocialDrive: negative social experience (penalty=${penalty.toFixed(2)}, ` +
        `satiation=${satiation.toFixed(2)})`,
    );
  }

  // Пересчёт уровня потребности после изменения насыщения
  currentNeedLevel = computeNeedLevel();
  persistState();
}

function recordSocialInteraction(reward: number, context: string): void {
  if (!config) return;

  totalSocialRewards++;
  lastSocialInteractionTime = Date.now();

  socialInteractionHistory.push({
    timestamp: Date.now(),
    reward,
    context,
  });

  // Ограничение кольцевого буфера
  if (socialInteractionHistory.length > config.maxHistoryEntries) {
    socialInteractionHistory.shift();
  }
}

// ── Публичный API ─────────────────────────────────────────────────

export function getSocialDriveStats(): SocialDriveStats {
  evaluateDecay();
  const now = Date.now();
  return {
    satiation,
    needLevel: currentNeedLevel,
    need: 1 - satiation,
    lastSocialInteractionTime,
    timeSinceLastSocial: lastSocialInteractionTime > 0 ? now - lastSocialInteractionTime : -1,
    totalSocialRewards,
    totalNeedSignals,
    recentInteractionCount: socialInteractionHistory.length,
  };
}

export function getSatiation(): number {
  return satiation;
}

export function boostSatiation(amount: number, reason: string): void {
  const boost = Math.max(0, Math.min(1 - satiation, amount));
  satiation = Math.min(1, satiation + boost);
  currentNeedLevel = computeNeedLevel();

  bus.emitSync("social-drive:satiated", {
    satiation,
    boostAmount: boost,
    source: reason,
  });

  persistState();
  logger?.info(
    `BrainAgent SocialDrive: manual boost (amount=${boost.toFixed(2)}, reason=${reason})`,
  );
}

// ── Персистентность ───────────────────────────────────────────────

function loadState(): void {
  try {
    const filePath = join(storageDir, "state.json");
    if (existsSync(filePath)) {
      const raw = JSON.parse(readFileSync(filePath, "utf-8")) as PersistedState;
      satiation = raw.satiation ?? config?.initialSatiation ?? 0.5;
      lastSocialInteractionTime = raw.lastSocialInteractionTime ?? 0;
      // Restore decay timestamp so we account for time passed while offline
      lastDecayEvaluationTime = raw.lastDecayEvaluationTime ?? Date.now();
      adaptiveDecayModifier = raw.adaptiveDecayModifier ?? 1.0;
      totalSocialRewards = raw.totalSocialRewards ?? 0;
      totalNeedSignals = raw.totalNeedSignals ?? 0;
      socialInteractionHistory = raw.socialInteractionHistory ?? [];
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
      lastSocialInteractionTime,
      lastDecayEvaluationTime,
      adaptiveDecayModifier,
      totalSocialRewards,
      totalNeedSignals,
      socialInteractionHistory,
    };
    writeFileSync(filePath, JSON.stringify(state, null, 2));
  } catch {
    // Некритичная ошибка
  }
}
