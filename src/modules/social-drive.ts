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

// ── Состояние модуля ──────────────────────────────────────────────

let engine: DriveEngine | undefined;
let logger: { info: (msg: string) => void } | undefined;

// ── Инициализация ─────────────────────────────────────────────────

export function initSocialDrive(
  workspaceDir: string,
  cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
  injectedDeps: SocialDriveDeps,
): void {
  engine?.stop();
  logger = log;

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

  engine = new DriveEngine(
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
        engine?.applySatiationDelta(-(data.emotionIntensity * 0.04));
      }
    }),
  );
}

export function stopSocialDrive(): void {
  engine?.stop();
  engine = undefined;
  logger?.info("BrainAgent SocialDrive: stopped.");
}

// ── Публичный API ─────────────────────────────────────────────────

export function getSocialDriveStats(): SocialDriveStats {
  const s = engine?.getStats();
  return {
    satiation: s?.satiation ?? 0,
    needLevel: s?.needLevel ?? "none",
    need: s?.need ?? 0,
    lastSocialInteractionTime: s?.lastInteractionTime ?? 0,
    timeSinceLastSocial: s?.timeSinceLastInteraction ?? -1,
    totalSocialRewards: s?.totalRewards ?? 0,
    totalNeedSignals: s?.totalNeedSignals ?? 0,
    recentInteractionCount: s?.recentInteractionCount ?? 0,
  };
}

export function getSatiation(): number {
  return engine?.getSatiation() ?? 0;
}

export function boostSatiation(amount: number, reason: string): void {
  engine?.boostSatiation(amount, reason);
}
