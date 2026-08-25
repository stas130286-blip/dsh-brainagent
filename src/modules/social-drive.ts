/**
 * Социальный Драйв — Модуль биологического социального гомеостаза.
 *
 * Моделирует потребность мозга в социальной связи через механизм
 * насыщения/затухания. Общая механика (затухание, уровни потребности,
 * сигналы, награды, персистентность) реализована в DriveEngine;
 * этот файл — конфигурация социального драйва и его уникальный
 * контекстный слушатель (эмпатийный дренаж от амигдалы).
 *
 * Пути влияния:
 *  1. social-drive:need-rising → давление Витального Импульса (+0.35)
 *  2. желание "connection" → эскалация → autonomy:desire-escalated (+0.35)
 *  3. социальные мысли DMN → dmn:thought-generated (+0.25)
 *
 * Насыщение восстанавливается, когда dopamine:reward срабатывает
 * в социальном домене (casual/emotional), замыкая гомеостатический цикл.
 *
 * v0.6.1 (волна 1 миграции на per-instance состояние):
 *  - фабрика `createSocialDrive()` создаёт инстанс, всё состояние
 *    (движок, логгер) инкапсулировано внутри него;
 *  - module-level `let` остался один — слот активного инстанса для
 *    обратной совместимости init/stop; уйдёт с переходом на Cordis.
 */

import { bus } from "./event-bus.ts";
import { DriveEngine, type DriveEngineConfig } from "./drive-engine.ts";
import type { BrainAgentConfig, Desire, SemanticMemory, SocialDriveStats } from "./types.ts";

// ── Типы ──────────────────────────────────────────────────────────

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

export type SocialDriveInstance = {
  /** Тихая остановка без лога (для повторной инициализации). */
  dispose(): void;
  /** Остановка с логом (для stop API). */
  stop(): void;
  getStats(): SocialDriveStats;
  getSatiation(): number;
  boostSatiation(amount: number, reason: string): void;
};

// ── Фабрика ───────────────────────────────────────────────────────

export function createSocialDrive(
  workspaceDir: string,
  cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
  injectedDeps: SocialDriveDeps,
): SocialDriveInstance {
  const c = cfg.socialDrive;
  const driveConfig: DriveEngineConfig = {
    rewardDomains: c.socialDomains,
    rewardMultiplier: c.socialRewardMultiplier,
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

  const engine = new DriveEngine(
    {
      id: "social-drive",
      logName: "SocialDrive",
      desireType: "connection",
      desireDescription: "Feeling the urge to connect with someone or check in on social circles",
      factsCategory: "relationship",
      fallbackTopic: "social connections and interactions with others",
      firedBaseBoost: 0.3,
      urgeTimeField: "timeSinceLastSocial",
      legacyKeys: {
        lastInteraction: "lastSocialInteractionTime",
        totalRewards: "totalSocialRewards",
        history: "socialInteractionHistory",
      },
    },
    driveConfig,
    workspaceDir,
    cfg.circadian?.enabled ?? false,
    {
      addDesire: injectedDeps.addDesire,
      getDesires: injectedDeps.getDesires,
      getFactsByCategory: injectedDeps.getFactsByCategory,
      generateThought: injectedDeps.generateSocialThought,
    },
    log,
  );

  // ── Contextual modulation (body grounding) ──────────────────────
  // Emotional encounters with empathy needed → micro-drain social satiation.
  // Like a person who feels drained after an intense emotional conversation.
  engine.addExtraListener(
    bus.on("amygdala:assessed", (data) => {
      if (data.empathyNeeded && data.emotionIntensity > 0.6) {
        engine.evaluateDecay();
        engine.applySatiationDelta(-(data.emotionIntensity * 0.04), { persist: true });
      }
    }),
  );

  function dispose(): void {
    engine.stop();
  }

  function stop(): void {
    engine.stop();
    log.info("BrainAgent SocialDrive: stopped.");
  }

  function getStats(): SocialDriveStats {
    const s = engine.getStats();
    return {
      satiation: s.satiation,
      needLevel: s.needLevel,
      need: s.need,
      lastSocialInteractionTime: s.lastInteractionTime,
      timeSinceLastSocial: s.timeSinceLastInteraction,
      totalSocialRewards: s.totalRewards,
      totalNeedSignals: s.totalNeedSignals,
      recentInteractionCount: s.recentInteractionCount,
    };
  }

  function getSatiation(): number {
    return engine.getSatiation();
  }

  function boostSatiation(amount: number, reason: string): void {
    engine.boostSatiation(amount, reason);
  }

  return { dispose, stop, getStats, getSatiation, boostSatiation };
}

// ── Слот активного инстанса (обратная совместимость init/stop) ───

let active: SocialDriveInstance | undefined;

// ── Инициализация ─────────────────────────────────────────────────

export function initSocialDrive(
  workspaceDir: string,
  cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
  injectedDeps: SocialDriveDeps,
): void {
  active?.dispose();
  active = createSocialDrive(workspaceDir, cfg, log, injectedDeps);
}

export function stopSocialDrive(): void {
  active?.stop();
  active = undefined;
}

// ── Публичный API ─────────────────────────────────────────────────

export function getSocialDriveStats(): SocialDriveStats {
  return (
    active?.getStats() ?? {
      satiation: 0,
      needLevel: "none",
      need: 0,
      lastSocialInteractionTime: 0,
      timeSinceLastSocial: -1,
      totalSocialRewards: 0,
      totalNeedSignals: 0,
      recentInteractionCount: 0,
    }
  );
}

export function getSatiation(): number {
  return active?.getSatiation() ?? 0;
}

export function boostSatiation(amount: number, reason: string): void {
  active?.boostSatiation(amount, reason);
}
