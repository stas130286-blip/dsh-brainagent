/**
 * Metabolic Budget — Energy-based resource allocation.
 *
 * In the human brain, glial cells (especially astrocytes) manage the
 * distribution of glucose and oxygen to neurons. Brain regions that
 * are more active receive more metabolic resources, while inactive
 * regions receive less. This creates an efficient allocation of the
 * brain's limited energy budget (~20% of total body energy).
 *
 * This module implements a similar system:
 * - Each module has an "energy" budget
 * - Active, successful modules receive more energy
 * - Inactive or failing modules receive less (and may enter low-power mode)
 * - Total system energy is conserved and periodically rebalanced
 *
 * The result: the system becomes more efficient by allocating resources
 * to the modules that provide the most value.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWrite } from "./persist.ts";
import { bus } from "./event-bus.ts";
import type { BrainAgentConfig, MetabolicState, ModuleEnergy, ModuleName } from "./types.ts";

// ── Module names ────────────────────────────────────────────────────

const ALL_MODULES: ModuleName[] = [
  "thalamus",
  "amygdala",
  "hippocampus",
  "prefrontalCortex",
  "cerebellum",
  "mirrorNeurons",
  "predictiveEngine",
  "basalGanglia",
  "dopamineSystem",
  "learningCoordinator",
];

// ── Types ───────────────────────────────────────────────────────────

export type MetabolicBudgetInstance = {
  /** Списать энергию модуля; false = модуль ушёл в low-power. */
  consumeEnergy(module: ModuleName, amount?: number): boolean;
  /** Записать результат модуля (EMA-перформанс). */
  recordPerformance(module: ModuleName, reward: number): void;
  /** Конец цикла: регенерация энергии и периодический ребаланс. */
  endCycle(): void;
  /** Текущая энергия модуля. */
  getModuleEnergy(module: ModuleName): number;
  /** Модуль в режиме энергосбережения? */
  isModuleLowPower(module: ModuleName): boolean;
  /** Сводная статистика. */
  getStats(): {
    totalBudget: number;
    usedEnergy: number;
    cyclesSinceRebalance: number;
    modules: Array<{
      name: ModuleName;
      energy: number;
      baseEnergy: number;
      performance: number;
      lowPowerMode: boolean;
    }>;
    lowPowerModules: ModuleName[];
    topPerformers: ModuleName[];
  };
  /** Модификатор эффективности модуля (0.5 в low-power). */
  getEfficiencyModifier(module: ModuleName): number;
  /** Сохранить состояние. */
  stop(): void;
  /** Тихий вариант stop (для замены инстанса). */
  dispose(): void;
};

// ── Фабрика ─────────────────────────────────────────────────────────

function createDefaultState(): MetabolicState {
  const moduleEnergies: Record<string, ModuleEnergy> = {};
  for (const module of ALL_MODULES) {
    moduleEnergies[module] = {
      module,
      energy: 1.0,
      baseEnergy: 1.0,
      performance: 0.5,
      consumptionRate: 0.1,
      lowPowerMode: false,
    };
  }
  return {
    moduleEnergies: moduleEnergies as Record<ModuleName, ModuleEnergy>,
    totalBudget: 10.0,
    regenRate: 0.5,
    cyclesSinceRebalance: 0,
  };
}

export function createMetabolicBudget(
  workspaceDir: string,
  config: BrainAgentConfig,
  log?: { info: (msg: string) => void; warn: (msg: string) => void },
): MetabolicBudgetInstance {
  const storageDir = join(workspaceDir, ".brainagent", "metabolic");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  const state: MetabolicState = createDefaultState();
  state.totalBudget = config.metabolicBudget.totalBudget;
  state.regenRate = config.metabolicBudget.regenRate;

  /** Track module activations and rewards in the current period */
  const periodStats: Record<
    ModuleName,
    { activations: number; totalReward: number; energyConsumed: number }
  > = {} as Record<ModuleName, { activations: number; totalReward: number; energyConsumed: number }>;

  function initPeriodStats(): void {
    for (const module of ALL_MODULES) {
      periodStats[module] = { activations: 0, totalReward: 0, energyConsumed: 0 };
    }
  }

  // ── Persistence ───────────────────────────────────────────────────

  function loadState(): void {
    try {
      const path = join(storageDir, "state.json");
      if (existsSync(path)) {
        const data = JSON.parse(readFileSync(path, "utf-8")) as MetabolicState;
        // Merge with defaults to handle new modules
        for (const module of ALL_MODULES) {
          if (data.moduleEnergies[module]) {
            state.moduleEnergies[module] = data.moduleEnergies[module];
          }
        }
        state.cyclesSinceRebalance = data.cyclesSinceRebalance ?? 0;
      }
    } catch {
      // Fresh start
    }
  }

  function saveState(): void {
    try {
      atomicWrite(join(storageDir, "state.json"), JSON.stringify(state, null, 2));
    } catch {
      /* non-critical */
    }
  }

  loadState();
  initPeriodStats();

  // ── Core Functions ────────────────────────────────────────────────

  function consumeEnergy(module: ModuleName, amount?: number): boolean {
    const moduleEnergy = state.moduleEnergies[module];
    if (!moduleEnergy) return true; // Unknown module, allow anyway

    const consumption = amount ?? moduleEnergy.consumptionRate;

    // Check if module is in low-power mode
    if (moduleEnergy.lowPowerMode) {
      // Still allow activation but at reduced capacity
      periodStats[module].activations++;
      return true;
    }

    // Consume energy
    moduleEnergy.energy -= consumption;
    periodStats[module].activations++;
    periodStats[module].energyConsumed += consumption;

    // Check for low energy
    if (moduleEnergy.energy < config.metabolicBudget.lowPowerThreshold) {
      moduleEnergy.lowPowerMode = true;
      bus.emitSync("metabolic:energy-low", {
        module,
        energy: moduleEnergy.energy,
      });
      log?.info(
        `MetabolicBudget: ${module} entering LOW POWER mode (energy: ${(moduleEnergy.energy * 100).toFixed(0)}%)`,
      );
    }

    return !moduleEnergy.lowPowerMode;
  }

  /**
   * Rebalance energy allocation based on module performance.
   * High-performing modules get more base energy, low-performing get less.
   */
  function rebalanceEnergy(): void {
    const changes: Array<{ module: ModuleName; delta: number }> = [];

    // Calculate performance scores
    const performances: Array<{ module: ModuleName; score: number }> = [];
    for (const module of ALL_MODULES) {
      const stats = periodStats[module];
      const moduleEnergy = state.moduleEnergies[module];

      // Score = average reward per activation (if any activations)
      const score =
        stats.activations > 0 ? stats.totalReward / stats.activations : moduleEnergy.performance;
      performances.push({ module, score });
    }

    // Normalize scores
    const totalScore = performances.reduce((sum, p) => sum + Math.max(0.1, p.score + 1), 0);

    // Redistribute energy budget
    for (const perf of performances) {
      const moduleEnergy = state.moduleEnergies[perf.module];
      const normalizedScore = Math.max(0.1, perf.score + 1) / totalScore;

      // New base energy proportional to performance
      const newBaseEnergy = (state.totalBudget / ALL_MODULES.length) * (0.5 + normalizedScore);
      const delta = newBaseEnergy - moduleEnergy.baseEnergy;

      if (Math.abs(delta) > 0.05) {
        changes.push({ module: perf.module, delta });

        if (delta > 0) {
          log?.info(
            `MetabolicBudget: ${perf.module} energy ↑ (performance: ${(perf.score * 100).toFixed(0)}%)`,
          );
        } else {
          bus.emitSync("metabolic:module-throttled", {
            module: perf.module,
            newRate: moduleEnergy.consumptionRate * 0.9,
          });
          moduleEnergy.consumptionRate *= 0.9; // Reduce consumption for low performers
        }
      }

      moduleEnergy.baseEnergy = newBaseEnergy;
      moduleEnergy.energy = Math.min(moduleEnergy.energy, newBaseEnergy);
    }

    if (changes.length > 0) {
      bus.emitSync("metabolic:rebalanced", { changes });
    }

    // Reset period stats
    initPeriodStats();
  }

  function endCycle(): void {
    state.cyclesSinceRebalance++;

    // Regenerate energy for all modules
    for (const module of ALL_MODULES) {
      const moduleEnergy = state.moduleEnergies[module];
      const regenAmount = state.regenRate * moduleEnergy.performance;
      moduleEnergy.energy = Math.min(moduleEnergy.baseEnergy, moduleEnergy.energy + regenAmount);

      // Exit low-power mode if energy is recovered
      if (
        moduleEnergy.lowPowerMode &&
        moduleEnergy.energy > config.metabolicBudget.lowPowerThreshold * 2
      ) {
        moduleEnergy.lowPowerMode = false;
        log?.info(
          `MetabolicBudget: ${module} exiting low power mode (energy: ${(moduleEnergy.energy * 100).toFixed(0)}%)`,
        );
      }
    }

    // Periodic rebalancing
    if (state.cyclesSinceRebalance >= config.metabolicBudget.rebalanceInterval) {
      rebalanceEnergy();
      state.cyclesSinceRebalance = 0;
      saveState();
    }
  }

  function getStats() {
    const usedEnergy = ALL_MODULES.reduce(
      (sum, m) =>
        sum + (state.moduleEnergies[m]?.baseEnergy ?? 0) - (state.moduleEnergies[m]?.energy ?? 0),
      0,
    );

    const modules = ALL_MODULES.map((m) => ({
      name: m,
      energy: state.moduleEnergies[m].energy,
      baseEnergy: state.moduleEnergies[m].baseEnergy,
      performance: state.moduleEnergies[m].performance,
      lowPowerMode: state.moduleEnergies[m].lowPowerMode,
    }));

    const lowPowerModules = ALL_MODULES.filter((m) => state.moduleEnergies[m].lowPowerMode);

    const topPerformers = [...ALL_MODULES]
      .sort((a, b) => state.moduleEnergies[b].performance - state.moduleEnergies[a].performance)
      .slice(0, 3);

    return {
      totalBudget: state.totalBudget,
      usedEnergy,
      cyclesSinceRebalance: state.cyclesSinceRebalance,
      modules,
      lowPowerModules,
      topPerformers,
    };
  }

  log?.info(
    `MetabolicBudget: initialized with total budget ${state.totalBudget.toFixed(1)} energy units`,
  );

  return {
    consumeEnergy,
    recordPerformance: (module, reward) => {
      const moduleEnergy = state.moduleEnergies[module];
      if (!moduleEnergy) return;

      periodStats[module].totalReward += reward;

      // Update rolling performance score (exponential moving average)
      moduleEnergy.performance = moduleEnergy.performance * 0.9 + ((reward + 1) / 2) * 0.1;
    },
    endCycle,
    getModuleEnergy: (module) => state.moduleEnergies[module]?.energy ?? 1.0,
    isModuleLowPower: (module) => state.moduleEnergies[module]?.lowPowerMode ?? false,
    getStats,
    getEfficiencyModifier: (module) => {
      const moduleEnergy = state.moduleEnergies[module];
      if (!moduleEnergy) return 1.0;

      if (moduleEnergy.lowPowerMode) {
        return 0.5; // 50% efficiency in low-power mode
      }

      // Scale efficiency based on remaining energy
      return 0.7 + moduleEnergy.energy * 0.3;
    },
    stop: () => {
      saveState();
    },
    dispose: () => {
      saveState();
    },
  };
}

// ── Активный инстанс (слот) ─────────────────────────────────────────

let active: MetabolicBudgetInstance | undefined;

// ── Совместимый API ─────────────────────────────────────────────────

/**
 * Initialize the metabolic budget system.
 */
export function initMetabolicBudget(
  workspaceDir: string,
  config: BrainAgentConfig,
  log?: { info: (msg: string) => void; warn: (msg: string) => void },
): void {
  active?.dispose();
  active = createMetabolicBudget(workspaceDir, config, log);
}

/** Остановить и сохранить состояние (для симметрии жизненного цикла). */
export function stopMetabolicBudget(): void {
  active?.stop();
  active = undefined;
}

/**
 * Record module activation and consume energy.
 * Call this when a module is activated during processing.
 * До инициализации — разрешает активацию (прежний fallback для неизвестных модулей).
 */
export function consumeEnergy(module: ModuleName, amount?: number): boolean {
  return active?.consumeEnergy(module, amount) ?? true;
}

/**
 * Record module performance (from reward signal).
 * Call this at the end of each cycle with participating modules.
 * До инициализации — no-op.
 */
export function recordPerformance(module: ModuleName, reward: number): void {
  active?.recordPerformance(module, reward);
}

/**
 * End the current cycle and regenerate energy.
 * Call this at the end of each interaction cycle.
 * До инициализации — no-op.
 */
export function endCycle(): void {
  active?.endCycle();
}

/**
 * Get current energy level for a module.
 */
export function getModuleEnergy(module: ModuleName): number {
  return active?.getModuleEnergy(module) ?? 1.0;
}

/**
 * Check if a module is in low-power mode.
 */
export function isModuleLowPower(module: ModuleName): boolean {
  return active?.isModuleLowPower(module) ?? false;
}

/**
 * Get metabolic statistics.
 */
export function getMetabolicStats(): {
  totalBudget: number;
  usedEnergy: number;
  cyclesSinceRebalance: number;
  modules: Array<{
    name: ModuleName;
    energy: number;
    baseEnergy: number;
    performance: number;
    lowPowerMode: boolean;
  }>;
  lowPowerModules: ModuleName[];
  topPerformers: ModuleName[];
} {
  return (
    active?.getStats() ?? {
      totalBudget: 10.0,
      usedEnergy: 0,
      cyclesSinceRebalance: 0,
      modules: ALL_MODULES.map((m) => ({
        name: m,
        energy: 1.0,
        baseEnergy: 1.0,
        performance: 0.5,
        lowPowerMode: false,
      })),
      lowPowerModules: [],
      topPerformers: ALL_MODULES.slice(0, 3),
    }
  );
}

/**
 * Get energy efficiency modifier for a module.
 * High-energy modules can work at full capacity; low-energy modules are throttled.
 */
export function getEfficiencyModifier(module: ModuleName): number {
  return active?.getEfficiencyModifier(module) ?? 1.0;
}
