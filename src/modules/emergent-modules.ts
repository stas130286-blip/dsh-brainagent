/**
 * Emergent Modules — Virtual module presets from successful patterns.
 *
 * In the human brain, emergent behavior arises when combinations of
 * brain regions working together produce capabilities that none of
 * them could achieve alone. Examples:
 * - Language: Broca's + Wernicke's + motor cortex = speech
 * - Face recognition: fusiform face area + amygdala = social cognition
 *
 * This module tracks which combinations of brain modules consistently
 * produce high-reward outcomes and recognizes these as "emergent modules"
 * — virtual presets that can be activated as a unit.
 *
 * The result: the system discovers its own "specializations" through
 * experience, without explicit programming.
 *
 * v0.7.0: фабрика createEmergentModules(workspaceDir, config?, log?) —
 * всё состояние в замыкании инстанса; свободные функции — обёртки над
 * активным инстансом. Пустой workspaceDir = detached-режим (состояние в
 * памяти, диск не трогается) — ровно поведение модуля до init.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWrite } from "./persist.ts";
import { bus } from "./event-bus.ts";
import type {
  BrainAgentConfig,
  EmergentModule,
  EmergentModulesState,
  ModuleName,
} from "./types.ts";

// ── Pattern naming ──────────────────────────────────────────────────

const DOMAIN_NAMES: Record<string, string> = {
  technical: "TechExpert",
  creative: "CreativeGenius",
  personal: "EmpathicHelper",
  casual: "FriendlyChat",
  code: "CodeMaster",
  emotional: "EmotionalSupport",
  analytical: "Analyst",
  educational: "Teacher",
};

function generatePatternName(participants: ModuleName[], domain: string): string {
  const domainBase = DOMAIN_NAMES[domain] ?? "Specialist";
  const moduleAbbrevs = participants
    .slice(0, 3)
    .map((m) => m.charAt(0).toUpperCase())
    .join("");
  return `${domainBase}_${moduleAbbrevs}`;
}

// ── Instance type ───────────────────────────────────────────────────

export type EmergentModulesInstance = {
  recordPattern(participants: ModuleName[], domain: string, reward: number): void;
  getEmergentModules(): EmergentModule[];
  getStats(): {
    totalDiscovered: number;
    emerging: number;
    established: number;
    deprecated: number;
    topModules: Array<{
      name: string;
      participants: ModuleName[];
      domain: string;
      avgReward: number;
      confidence: number;
      status: string;
    }>;
  };
  matchEstablishedModule(participants: ModuleName[]): EmergentModule | undefined;
  getRecommendedModulesForDomain(domain: string): ModuleName[] | undefined;
};

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Create an emergent-modules instance with isolated state.
 * Empty workspaceDir = detached instance: state lives in memory,
 * disk is never touched (identical to pre-init module behavior).
 */
export function createEmergentModules(
  workspaceDir: string,
  config?: BrainAgentConfig,
  log?: { info: (msg: string) => void; warn: (msg: string) => void },
): EmergentModulesInstance {
  // ── State (closure) ───────────────────────────────────────────────
  const storageDir = workspaceDir ? join(workspaceDir, ".brainagent", "emergent") : "";
  let currentConfig: BrainAgentConfig | null = config ?? null;
  const logger = log;

  let state: EmergentModulesState = createDefaultState();

  /** Track activation patterns and their outcomes */
  let patternHistory: Array<{
    participants: ModuleName[];
    domain: string;
    reward: number;
    timestamp: number;
  }> = [];

  function createDefaultState(): EmergentModulesState {
    return {
      modules: [],
      minOccurrences: 5,
      minReward: 0.6,
    };
  }

  // ── Persistence ───────────────────────────────────────────────────

  function loadState(): void {
    if (!storageDir) return;
    try {
      const path = join(storageDir, "state.json");
      if (existsSync(path)) {
        const data = JSON.parse(readFileSync(path, "utf-8")) as EmergentModulesState & {
          patternHistory?: Array<{
            participants: ModuleName[];
            domain: string;
            reward: number;
            timestamp: number;
          }>;
        };
        state.modules = data.modules ?? [];
        // История паттернов тоже персистится — иначе после рестарта
        // deprecateUnusedModules видит пустую историю и демотирует все
        // established-модули («забытые» открытия).
        if (Array.isArray(data.patternHistory)) {
          patternHistory = data.patternHistory.slice(-100);
        }
      }
    } catch {
      // Fresh start
    }
  }

  function saveState(): void {
    if (!storageDir) return;
    try {
      const persisted = {
        ...state,
        patternHistory: patternHistory.slice(-100),
      };
      atomicWrite(join(storageDir, "state.json"), JSON.stringify(persisted, null, 2));
    } catch {
      /* non-critical */
    }
  }

  // ── Core Functions ────────────────────────────────────────────────

  /**
   * Find an existing emergent module that matches the participants.
   */
  function findMatchingModule(participants: ModuleName[]): EmergentModule | undefined {
    const sortedParticipants = [...participants].sort();
    return state.modules.find((m) => {
      if (m.status === "deprecated") return false;
      const sortedModuleParticipants = [...m.participants].sort();
      if (sortedModuleParticipants.length !== sortedParticipants.length) return false;
      return sortedModuleParticipants.every((p, i) => p === sortedParticipants[i]);
    });
  }

  /**
   * Update an existing emergent module with new outcome.
   */
  function updateExistingModule(module: EmergentModule, reward: number): void {
    module.occurrences++;
    module.avgReward =
      (module.avgReward * (module.occurrences - 1) + reward) / module.occurrences;
    module.confidence = Math.min(0.95, module.confidence + 0.02);

    // Check for status transition
    if (
      module.status === "emerging" &&
      module.occurrences >= state.minOccurrences * 2 &&
      module.avgReward >= state.minReward
    ) {
      module.status = "established";
      bus.emitSync("emergent:pattern-established", {
        id: module.id,
        name: module.name,
        confidence: module.confidence,
      });
      logger?.info(
        `EmergentModule: "${module.name}" is now ESTABLISHED (${module.occurrences} occurrences, avg reward: ${module.avgReward.toFixed(2)})`,
      );
    }
  }

  /**
   * Deprecate modules that haven't been used recently.
   */
  function deprecateUnusedModules(): void {
    const recentPatterns = patternHistory.slice(-100);

    for (const module of state.modules) {
      if (module.status === "deprecated") continue;

      // Check if this module has been used in recent patterns
      const recentUses = recentPatterns.filter((p) => {
        const sortedP = [...p.participants].sort();
        const sortedM = [...module.participants].sort();
        return sortedP.length === sortedM.length && sortedP.every((m, i) => m === sortedM[i]);
      });

      if (recentUses.length === 0 && module.status === "established") {
        // No recent uses — demote to emerging
        module.status = "emerging";
        module.confidence *= 0.8;
        logger?.info(`EmergentModule: "${module.name}" demoted to EMERGING (no recent use)`);
      } else if (recentUses.length === 0 && module.status === "emerging") {
        // Still no uses — deprecate
        module.status = "deprecated";
        bus.emitSync("emergent:pattern-deprecated", {
          id: module.id,
          reason: "unused",
        });
        logger?.info(`EmergentModule: "${module.name}" DEPRECATED (unused)`);
      }
    }
  }

  /**
   * Check if a pattern should become a new emergent module.
   */
  function checkForNewModule(participants: ModuleName[], domain: string): void {
    if (!currentConfig) return;

    const sortedParticipants = [...participants].sort();
    const patternKey = sortedParticipants.join("+");

    // Count how many times this exact pattern has occurred with good reward
    const matchingPatterns = patternHistory.filter((p) => {
      const sortedP = [...p.participants].sort();
      return (
        sortedP.length === sortedParticipants.length &&
        sortedP.every((m, i) => m === sortedParticipants[i]) &&
        p.reward >= state.minReward * 0.8
      );
    });

    if (matchingPatterns.length < state.minOccurrences) return;

    // Check if we're at capacity
    const activeModules = state.modules.filter((m) => m.status !== "deprecated").length;
    if (activeModules >= currentConfig.emergentModules.maxEmergentModules) {
      // Try to deprecate the weakest module
      const weakest = state.modules
        .filter((m) => m.status !== "deprecated")
        .sort((a, b) => a.avgReward - b.avgReward)[0];
      if (weakest && weakest.avgReward < state.minReward * 0.5) {
        weakest.status = "deprecated";
        bus.emitSync("emergent:pattern-deprecated", {
          id: weakest.id,
          reason: "replaced_by_better",
        });
      } else {
        return; // Can't make room
      }
    }

    // Calculate average reward for this pattern
    const avgReward =
      matchingPatterns.reduce((sum, p) => sum + p.reward, 0) / matchingPatterns.length;

    if (avgReward < state.minReward * 0.8) return;

    // Create new emergent module!
    const newModule: EmergentModule = {
      id: `em_${patternKey}_${Date.now()}`,
      name: generatePatternName(sortedParticipants, domain),
      participants: sortedParticipants,
      domain,
      avgReward,
      occurrences: matchingPatterns.length,
      discoveredAt: Date.now(),
      confidence: 0.3 + avgReward * 0.3,
      status: "emerging",
    };

    state.modules.push(newModule);

    bus.emitSync("emergent:pattern-discovered", {
      id: newModule.id,
      name: newModule.name,
      participants: newModule.participants,
      domain: newModule.domain,
    });

    logger?.info(
      `EmergentModule: NEW PATTERN discovered "${newModule.name}" ` +
        `[${newModule.participants.join(" + ")}] (domain: ${domain}, avg reward: ${avgReward.toFixed(2)})`,
    );
  }

  /**
   * Record an activation pattern and its outcome.
   * Call this at the end of each cycle with the participating modules.
   */
  function recordPattern(participants: ModuleName[], domain: string, reward: number): void {
    if (!currentConfig || participants.length < 2) return;

    const now = Date.now();

    // Add to history
    patternHistory.push({
      participants: [...participants].sort(),
      domain,
      reward,
      timestamp: now,
    });

    // Keep history bounded
    if (patternHistory.length > 500) {
      patternHistory = patternHistory.slice(-500);
    }

    // Check if this pattern matches an existing emergent module
    const existingModule = findMatchingModule(participants);
    if (existingModule) {
      updateExistingModule(existingModule, reward);
    } else {
      // Check if we should create a new emergent module
      checkForNewModule(participants, domain);
    }

    // Periodic cleanup
    if (patternHistory.length % 50 === 0) {
      deprecateUnusedModules();
      saveState();
    }
  }

  // ── Public API ────────────────────────────────────────────────────

  function getEmergentModules(): EmergentModule[] {
    return state.modules.filter((m) => m.status !== "deprecated");
  }

  function getStats() {
    const emerging = state.modules.filter((m) => m.status === "emerging").length;
    const established = state.modules.filter((m) => m.status === "established").length;
    const deprecated = state.modules.filter((m) => m.status === "deprecated").length;

    const topModules = state.modules
      .filter((m) => m.status !== "deprecated")
      .sort((a, b) => b.avgReward - a.avgReward)
      .slice(0, 5)
      .map((m) => ({
        name: m.name,
        participants: m.participants,
        domain: m.domain,
        avgReward: m.avgReward,
        confidence: m.confidence,
        status: m.status,
      }));

    return {
      totalDiscovered: state.modules.length,
      emerging,
      established,
      deprecated,
      topModules,
    };
  }

  function matchEstablishedModule(participants: ModuleName[]): EmergentModule | undefined {
    const sorted = [...participants].sort();
    return state.modules.find((m) => {
      if (m.status !== "established") return false;
      const sortedM = [...m.participants].sort();
      return sortedM.length === sorted.length && sortedM.every((p, i) => p === sorted[i]);
    });
  }

  function getRecommendedModulesForDomain(domain: string): ModuleName[] | undefined {
    const matchingModule = state.modules
      .filter((m) => m.status === "established" && m.domain === domain)
      .sort((a, b) => b.avgReward - a.avgReward)[0];

    return matchingModule?.participants;
  }

  // ── Init (disk) ───────────────────────────────────────────────────

  if (storageDir) {
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }
    state.minOccurrences = config?.emergentModules.minOccurrences ?? state.minOccurrences;
    state.minReward =
      config?.emergentModules.minRewardForEstablishment ?? state.minReward;
    loadState();
    logger?.info(`EmergentModules: initialized with ${state.modules.length} discovered patterns`);
  }

  return {
    recordPattern,
    getEmergentModules,
    getStats,
    matchEstablishedModule,
    getRecommendedModulesForDomain,
  };
}

// ── Active-instance wrappers (backward-compatible API) ──────────────

let active: EmergentModulesInstance | null = null;

function current(): EmergentModulesInstance {
  if (!active) active = createEmergentModules("");
  return active;
}

export function initEmergentModules(
  workspaceDir: string,
  config: BrainAgentConfig,
  log?: { info: (msg: string) => void; warn: (msg: string) => void },
): void {
  active = createEmergentModules(workspaceDir, config, log);
}

/** Symmetric teardown — drops the active instance (no timers/subscriptions). */
export function stopEmergentModules(): void {
  active = null;
}

export function recordPattern(participants: ModuleName[], domain: string, reward: number): void {
  current().recordPattern(participants, domain, reward);
}

export function getEmergentModules(): EmergentModule[] {
  return current().getEmergentModules();
}

export function getEmergentStats(): {
  totalDiscovered: number;
  emerging: number;
  established: number;
  deprecated: number;
  topModules: Array<{
    name: string;
    participants: ModuleName[];
    domain: string;
    avgReward: number;
    confidence: number;
    status: string;
  }>;
} {
  return current().getStats();
}

export function matchEstablishedModule(participants: ModuleName[]): EmergentModule | undefined {
  return current().matchEstablishedModule(participants);
}

export function getRecommendedModulesForDomain(domain: string): ModuleName[] | undefined {
  return current().getRecommendedModulesForDomain(domain);
}

// ── v0.9.20: инъекция проверенных связок в контекст ────────────────

/** Дедупликация: не чаще раза в 30 минут на домен. */
const lastDomainRecommendationAt = new Map<string, number>();
const DOMAIN_RECOMMENDATION_DEDUP_MS = 30 * 60 * 1000;

/** Сброс дедупликации (для тестов). */
export function resetDomainRecommendationDedup(): void {
  lastDomainRecommendationAt.clear();
}

/**
 * Контекст «проверенной связки» для инъекции в agent/pre-step: если для
 * домена найден устоявшийся эмерджентный паттерн, подсказываем модели
 * комбинацию модулей. Возвращает undefined, если связки нет или она
 * уже подсказывалась недавно (дедупликация по домену).
 */
export function buildDomainRecommendationContext(
  domain: string,
  nowMs = Date.now(),
): string | undefined {
  const participants = getRecommendedModulesForDomain(domain);
  if (!participants || participants.length === 0) return undefined;
  const last = lastDomainRecommendationAt.get(domain) ?? 0;
  if (nowMs - last < DOMAIN_RECOMMENDATION_DEDUP_MS) return undefined;
  lastDomainRecommendationAt.set(domain, nowMs);
  return [
    "## Проверенная связка модулей (эмерджентные паттерны)",
    `Для домена «${domain}» стабильно хороший результат давала комбинация: ${participants.join(", ")}. Опирайся на неё в первую очередь.`,
  ].join("\n");
}
