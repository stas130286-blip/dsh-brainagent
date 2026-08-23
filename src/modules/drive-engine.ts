/**
 * Drive Engine — универсальный механизм биологического драйва.
 *
 * До 0.1.2 социальный драйв, когнитивный голод и креативный драйв
 * были почти дословными копиями одного кода (~1500 строк на троих):
 * одинаковые evaluateDecay, computeNeedLevel, emitNeedSignals,
 * обработчики наград и персистентность. Любая правка требовала
 * синхронизации в трёх файлах.
 *
 * Теперь вся общая механика живёт здесь, в одном классе DriveEngine,
 * а конкретные драйвы — тонкие обёртки с конфигурацией:
 *  - имя/префикс событий и каталог хранения
 *  - домены наград (фильтр dopamine:reward — драйв насыщается
 *    только «своей» наградой)
 *  - тип желания, категория фактов для DMN, тексты
 *  - драйв-специфичные слушатели (эмпатия, инсайты, пробелы и т.п.)
 *
 * Механика (без изменений перенесена из оригинальных модулей):
 * насыщение (0–1) экспоненциально затухает on-demand, модулируясь
 * циркадной фазой и серотонином; переходы уровня потребности вверх
 * излучают need-rising → желание (moderate+) → смещение DMN (strong+)
 * → urge (urgent). Награды своего домена восстанавливают насыщение;
 * адаптивный модификатор затухания обучается на наградах.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isInSleepPhase } from "./circadian-rhythm.ts";
import { getNeuromodulatorState } from "./dopamine-system.ts";
import { bus } from "./event-bus.ts";
import { cancelPersist, flushPersist, schedulePersist } from "./persist.ts";
import type { BrainEventMap, Desire, DopamineSignal, SemanticMemory } from "./types.ts";

// ── Типы ──────────────────────────────────────────────────────────

export type DriveNeedLevel = "none" | "mild" | "moderate" | "strong" | "urgent";

type InteractionRecord = {
  timestamp: number;
  reward: number;
  context: string;
};

type PersistedState = {
  satiation: number;
  lastInteractionTime: number;
  lastDecayEvaluationTime: number;
  adaptiveDecayModifier: number;
  totalRewards: number;
  totalNeedSignals: number;
  interactionHistory: InteractionRecord[];
};

export type DriveEngineConfig = {
  /** Домены наград, которые насыщают этот драйв (фильтр dopamine:reward) */
  rewardDomains: string[];
  /** Множитель награда → буст насыщения */
  rewardMultiplier: number;
  /** Стартовое насыщение */
  initialSatiation: number;
  /** Базовая скорость затухания за тик */
  baseDecayRate: number;
  /** Длительность тика затухания, мс */
  decayIntervalMs: number;
  /** Множитель затухания во сне (< 1 = медленнее) */
  sleepDecayModifier: number;
  /** Максимальный буст насыщения за одно взаимодействие */
  maxSatiationBoost: number;
  /** Размер кольцевого буфера истории */
  maxHistoryEntries: number;
  /** Пороги насыщения для уровней потребности */
  needThresholds: { mild: number; moderate: number; strong: number; urgent: number };
  /** Мин. интервал между смещениями DMN, мс */
  dmnBiasIntervalMs: number;
  /** Мин. интервал между обновлениями желания, мс */
  desireUpdateIntervalMs: number;
};

export type DriveEngineDeps = {
  addDesire: (
    type: Desire["type"],
    description: string,
    strength: number,
    source: string,
  ) => Desire;
  getDesires: () => Desire[];
  getFactsByCategory: (category: string, limit?: number) => SemanticMemory[];
  generateThought: (topics: Array<{ topic: string }>) => void;
};

export type DriveEngineSpec = {
  /** Каталог хранения, префикс событий шины и source желаний */
  id: string;
  /** Имя для лог-сообщений (например "SocialDrive") */
  logName: string;
  /** Тип создаваемого желания */
  desireType: Desire["type"];
  /** Описание создаваемого желания */
  desireDescription: string;
  /** Категория фактов гиппокампа для смещения DMN */
  factsCategory: string;
  /** Запасная тема DMN, если фактов нет */
  fallbackTopic: string;
  /** Базовый буст насыщения при vital-impulse:fired */
  firedBaseBoost: number;
  /** Имя поля времени в payload urge-события (совместимость слушателей) */
  urgeTimeField: string;
  /** Имена полей state-файла 0.1.1 (прозрачная миграция при загрузке) */
  legacyKeys: { lastInteraction: string; totalRewards: string; history: string };
};

export type DriveCoreStats = {
  satiation: number;
  needLevel: DriveNeedLevel;
  need: number;
  lastInteractionTime: number;
  timeSinceLastInteraction: number;
  totalRewards: number;
  totalNeedSignals: number;
  recentInteractionCount: number;
};

const NEED_RANK: Record<DriveNeedLevel, number> = {
  none: 0,
  mild: 1,
  moderate: 2,
  strong: 3,
  urgent: 4,
};

const DESIRE_STRENGTH: Record<DriveNeedLevel, number> = {
  none: 0,
  mild: 0.2,
  moderate: 0.4,
  strong: 0.7,
  urgent: 0.9,
};

// ── Движок ────────────────────────────────────────────────────────

export class DriveEngine {
  private stateFile = "";

  private satiation = 0.5;
  private lastInteractionTime = 0;
  private lastDecayEvaluationTime = 0;
  private totalRewards = 0;
  private totalNeedSignals = 0;
  private currentNeedLevel: DriveNeedLevel = "none";
  private interactionHistory: InteractionRecord[] = [];
  private adaptiveDecayModifier = 1.0;

  private unsubscribers: Array<() => void> = [];
  private lastDesireUpdateTime = 0;
  private lastDMNBiasTime = 0;
  private lastNeedEmitTime = 0;

  constructor(
    private spec: DriveEngineSpec,
    private config: DriveEngineConfig,
    workspaceDir: string,
    private circadianEnabled: boolean,
    private deps: DriveEngineDeps,
    private logger: { info: (msg: string) => void },
  ) {
    const storageDir = join(workspaceDir, ".brainagent", spec.id);
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }
    this.stateFile = join(storageDir, "state.json");

    // Отложенная запись прежнего экземпляра (если была) больше не актуальна
    cancelPersist(this.stateFile);

    this.loadState();
    this.wireCoreListeners();

    logger.info(
      `BrainAgent ${spec.logName}: initialized (satiation=${this.satiation.toFixed(2)}, ` +
        `decay=${config.baseDecayRate}/${config.decayIntervalMs}ms, ` +
        `domains=${config.rewardDomains.join(",")})`,
    );
  }

  /** Остановка: отписка от шины + немедленная запись состояния. */
  stop(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
    flushPersist(this.stateFile);
  }

  /** Драйв-специфичный слушатель; отписка произойдёт в stop(). */
  addExtraListener(unsub: () => void): void {
    this.unsubscribers.push(unsub);
  }

  /**
   * Эмиссия динамического события драйва. Шина типизирована под конкретные
   * имена (social-drive:*, cognitive-hunger:*...), но формы payload у всех
   * драйвов идентичны — приводим к известной сигнатуре.
   */
  private emitDriveEvent(event: string, payload: unknown): void {
    bus.emitSync(
      event as keyof BrainEventMap,
      payload as unknown as BrainEventMap[keyof BrainEventMap],
    );
  }

  // ── Ядерные слушатели (общие для всех драйвов) ──────────────────

  private wireCoreListeners(): void {
    // Дофаминовые награды — насыщение только наградами СВОИХ доменов
    this.unsubscribers.push(
      bus.on("dopamine:reward", (signal: DopamineSignal) => {
        this.onReward(signal);
      }),
    );

    // Активность мозга — on-demand оценка накопленного затухания
    this.unsubscribers.push(
      bus.on("thalamus:classified", () => {
        this.evaluateDecay();
      }),
    );

    // Срабатывание Витального Импульса — безусловный буст, нарастающий
    // с каждым подряд срабатыванием без ответа пользователя
    this.unsubscribers.push(
      bus.on("vital-impulse:fired", (data) => {
        this.evaluateDecay();
        const consecutive = data.consecutiveFires ?? 0;
        const baseBoost = this.spec.firedBaseBoost;
        const escalation = Math.min(baseBoost * consecutive * 0.5, 0.5);
        const totalBoost = Math.min(baseBoost + escalation, 0.8);
        this.applySatiationDelta(totalBoost, { persist: true });
      }),
    );
  }

  // ── Основная логика ─────────────────────────────────────────────

  /** On-demand экспоненциальное затухание с циркадной и серотониновой модуляцией. */
  evaluateDecay(): void {
    const now = Date.now();
    const elapsed = (now - this.lastDecayEvaluationTime) / this.config.decayIntervalMs;
    this.lastDecayEvaluationTime = now;

    if (elapsed <= 0) return;

    // Циркадная модуляция: затухание медленнее во время сна
    const circadianMod =
      this.circadianEnabled && isInSleepPhase() ? this.config.sleepDecayModifier : 1.0;

    // Серотониновая модуляция: высокий серотонин = больше довольства
    const neuroState = getNeuromodulatorState();
    const serotoninMod = 0.7 + neuroState.serotonin * 0.6;

    const effectiveRate =
      (this.config.baseDecayRate * this.adaptiveDecayModifier * circadianMod) / serotoninMod;
    const decayFactor = Math.pow(1 - effectiveRate, elapsed);
    this.satiation *= decayFactor;

    if (this.satiation < 0.001) {
      this.satiation = 0;
    }

    const oldLevel = this.currentNeedLevel;
    this.currentNeedLevel = this.computeNeedLevel();

    // Излучение сигналов при переходе уровня потребности вверх
    if (NEED_RANK[this.currentNeedLevel] > NEED_RANK[oldLevel]) {
      this.lastNeedEmitTime = now;
      this.emitNeedSignals();
    }
    // Периодического переизлучения нет — сигналы только на переходах.
  }

  private computeNeedLevel(): DriveNeedLevel {
    const t = this.config.needThresholds;
    if (this.satiation < t.urgent) return "urgent";
    if (this.satiation < t.strong) return "strong";
    if (this.satiation < t.moderate) return "moderate";
    if (this.satiation < t.mild) return "mild";
    return "none";
  }

  private emitNeedSignals(): void {
    const now = Date.now();
    const need = 1 - this.satiation;

    this.totalNeedSignals++;

    // Всегда излучаем need-rising для любого уровня кроме "none"
    if (this.currentNeedLevel !== "none") {
      this.emitDriveEvent(`${this.spec.id}:need-rising`, {
        needLevel: this.currentNeedLevel,
        satiation: this.satiation,
        need,
      });
      this.logger.info(
        `BrainAgent ${this.spec.logName}: need rising → ${this.currentNeedLevel} ` +
          `(satiation=${this.satiation.toFixed(2)})`,
      );
    }

    // Moderate+: создание/усиление желания
    if (
      NEED_RANK[this.currentNeedLevel] >= NEED_RANK.moderate &&
      now - this.lastDesireUpdateTime > this.config.desireUpdateIntervalMs
    ) {
      this.lastDesireUpdateTime = now;
      this.updateDesire();
    }

    // Strong+: смещение DMN в сторону воспоминаний домена
    if (
      NEED_RANK[this.currentNeedLevel] >= NEED_RANK.strong &&
      now - this.lastDMNBiasTime > this.config.dmnBiasIntervalMs
    ) {
      this.lastDMNBiasTime = now;
      this.biasDMN();
    }

    // Urgent: дополнительный сильный сигнал позыва
    if (this.currentNeedLevel === "urgent") {
      this.emitDriveEvent(`${this.spec.id}:urge`, {
        satiation: this.satiation,
        [this.spec.urgeTimeField]:
          this.lastInteractionTime > 0 ? now - this.lastInteractionTime : now,
      });
      this.logger.info(`BrainAgent ${this.spec.logName}: URGENT urge emitted!`);
    }

    this.persistState();
  }

  private updateDesire(): void {
    const targetStrength = DESIRE_STRENGTH[this.currentNeedLevel];

    const existing = this.deps
      .getDesires()
      .find((d) => d.type === this.spec.desireType && d.source === this.spec.id);

    if (existing) {
      // Обновляем только если наша цель выше (не перезаписываем внешние бусты)
      if (existing.strength < targetStrength) {
        existing.strength = targetStrength;
      }
    } else {
      this.deps.addDesire(
        this.spec.desireType,
        this.spec.desireDescription,
        targetStrength,
        this.spec.id,
      );
    }

    this.logger.info(
      `BrainAgent ${this.spec.logName}: ${this.spec.desireType} desire updated ` +
        `(strength=${targetStrength.toFixed(2)})`,
    );
  }

  private biasDMN(): void {
    const facts = this.deps.getFactsByCategory(this.spec.factsCategory, 3);
    const topics: Array<{ topic: string }> = [];

    if (facts.length > 0) {
      for (const fact of facts) {
        topics.push({ topic: fact.content.slice(0, 100) });
      }
    } else {
      // Запасной вариант: общая тема-затравка домена
      topics.push({ topic: this.spec.fallbackTopic });
    }

    this.deps.generateThought(topics);
    this.logger.info(
      `BrainAgent ${this.spec.logName}: biased DMN toward ${topics.length} topic(s)`,
    );
  }

  private onReward(signal: DopamineSignal): void {
    this.evaluateDecay();

    // Фильтр доменов: драйв насыщается только наградами своих доменов
    const domain = signal.context.domain.toLowerCase();
    if (!this.config.rewardDomains.includes(domain)) return;

    if (signal.reward > 0) {
      // Позитивное взаимодействие — буст насыщения
      const boost = Math.min(
        this.config.maxSatiationBoost,
        Math.max(0, signal.reward * this.config.rewardMultiplier),
      );
      this.satiation = Math.min(1.0, this.satiation + boost);

      // Адаптивное затухание: позитив → сенсибилизация (голод вернётся быстрее)
      this.adaptiveDecayModifier = Math.min(2.0, this.adaptiveDecayModifier + 0.005 * signal.reward);

      this.recordInteraction(signal.reward, domain);

      // Снижение силы существующего желания на 50% (удовлетворено)
      const existing = this.deps
        .getDesires()
        .find((d) => d.type === this.spec.desireType && d.source === this.spec.id);
      if (existing) {
        existing.strength *= 0.5;
      }

      this.emitDriveEvent(`${this.spec.id}:satiated`, {
        satiation: this.satiation,
        boostAmount: boost,
        source: domain,
      });

      this.logger.info(
        `BrainAgent ${this.spec.logName}: satiated by ${domain} reward ` +
          `(boost=${boost.toFixed(2)}, satiation=${this.satiation.toFixed(2)})`,
      );
    } else if (signal.reward < 0) {
      // Негативный опыт — слегка снижаем насыщение (хочется *лучшего*, а не меньше)
      const penalty = Math.abs(signal.reward) * 0.1;
      this.satiation = Math.max(0, this.satiation - penalty);

      // Адаптивное затухание: негатив → десенсибилизация (голод вернётся позже)
      this.adaptiveDecayModifier = Math.max(
        0.5,
        this.adaptiveDecayModifier - 0.003 * Math.abs(signal.reward),
      );

      this.logger.info(
        `BrainAgent ${this.spec.logName}: negative experience (penalty=${penalty.toFixed(2)}, ` +
          `satiation=${this.satiation.toFixed(2)})`,
      );
    }

    this.currentNeedLevel = this.computeNeedLevel();
    this.persistState();
  }

  private recordInteraction(reward: number, context: string): void {
    this.totalRewards++;
    this.lastInteractionTime = Date.now();

    this.interactionHistory.push({
      timestamp: Date.now(),
      reward,
      context,
    });

    // Ограничение кольцевого буфера
    if (this.interactionHistory.length > this.config.maxHistoryEntries) {
      this.interactionHistory.shift();
    }
  }

  // ── Публичный API для обёрток ──────────────────────────────────

  /**
   * Изменить насыщение на дельту (буст или дренаж) с пересчётом уровня
   * потребности. Используются драйв-специфичными слушателями обёрток.
   */
  applySatiationDelta(delta: number, opts: { persist?: boolean } = {}): void {
    this.satiation = Math.max(0, Math.min(1, this.satiation + delta));
    this.currentNeedLevel = this.computeNeedLevel();
    if (opts.persist) this.persistState();
  }

  /** Текущее насыщение (без оценки затухания). */
  getSatiation(): number {
    return this.satiation;
  }

  /** Полная статистика (с on-demand оценкой затухания). */
  getStats(): DriveCoreStats {
    this.evaluateDecay();
    const now = Date.now();
    return {
      satiation: this.satiation,
      needLevel: this.currentNeedLevel,
      need: 1 - this.satiation,
      lastInteractionTime: this.lastInteractionTime,
      timeSinceLastInteraction:
        this.lastInteractionTime > 0 ? now - this.lastInteractionTime : -1,
      totalRewards: this.totalRewards,
      totalNeedSignals: this.totalNeedSignals,
      recentInteractionCount: this.interactionHistory.length,
    };
  }

  /** Ручной буст насыщения (внешние модули). */
  boostSatiation(amount: number, reason: string): void {
    const boost = Math.max(0, Math.min(1 - this.satiation, amount));
    this.satiation = Math.min(1, this.satiation + boost);
    this.currentNeedLevel = this.computeNeedLevel();

    this.emitDriveEvent(`${this.spec.id}:satiated`, {
      satiation: this.satiation,
      boostAmount: boost,
      source: reason,
    });

    this.persistState();
    this.logger.info(
      `BrainAgent ${this.spec.logName}: manual boost (amount=${boost.toFixed(2)}, reason=${reason})`,
    );
  }

  // ── Персистентность ─────────────────────────────────────────────

  private loadState(): void {
    try {
      if (!existsSync(this.stateFile)) {
        // Чистый старт: стартовое насыщение из конфига, метка затухания =
        // сейчас (иначе первая же on-demand оценка спишет затухание с эпохи 0)
        this.satiation = this.config.initialSatiation;
        this.lastDecayEvaluationTime = Date.now();
        return;
      }
      const raw = JSON.parse(readFileSync(this.stateFile, "utf-8")) as Record<string, unknown>;
      const legacy = this.spec.legacyKeys;

      // Числовые поля: новое имя + совместимость с форматом 0.1.1
      const readNum = (...keys: string[]): number | undefined => {
        for (const key of keys) {
          const value = raw[key];
          if (typeof value === "number") return value;
        }
        return undefined;
      };
      const readArr = (...keys: string[]): InteractionRecord[] | undefined => {
        for (const key of keys) {
          const value = raw[key];
          if (Array.isArray(value)) return value as InteractionRecord[];
        }
        return undefined;
      };

      this.satiation = readNum("satiation") ?? this.config.initialSatiation;
      this.lastInteractionTime = readNum("lastInteractionTime", legacy.lastInteraction) ?? 0;
      // Восстановление метки затухания, чтобы учесть время офлайна
      this.lastDecayEvaluationTime = readNum("lastDecayEvaluationTime") ?? Date.now();
      this.adaptiveDecayModifier = readNum("adaptiveDecayModifier") ?? 1.0;
      this.totalRewards = readNum("totalRewards", legacy.totalRewards) ?? 0;
      this.totalNeedSignals = readNum("totalNeedSignals") ?? 0;
      this.interactionHistory = readArr("interactionHistory", legacy.history) ?? [];
      this.currentNeedLevel = this.computeNeedLevel();
    } catch {
      // Начинаем с чистого состояния при повреждённых данных
    }
  }

  private persistState(): void {
    schedulePersist(this.stateFile, () => {
      const state: PersistedState = {
        satiation: this.satiation,
        lastInteractionTime: this.lastInteractionTime,
        lastDecayEvaluationTime: this.lastDecayEvaluationTime,
        adaptiveDecayModifier: this.adaptiveDecayModifier,
        totalRewards: this.totalRewards,
        totalNeedSignals: this.totalNeedSignals,
        interactionHistory: this.interactionHistory,
      };
      return JSON.stringify(state, null, 2);
    });
  }
}
