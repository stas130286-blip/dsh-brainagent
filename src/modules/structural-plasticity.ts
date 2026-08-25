/**
 * Structural Plasticity — Dynamic pathway creation and pruning.
 *
 * In the human brain, structural plasticity refers to the brain's ability
 * to physically change its structure through:
 * - Neurogenesis: creation of new neurons and connections
 * - Synaptic pruning: removal of unused connections
 * - Dendritic growth: strengthening of frequently used pathways
 *
 * This module tracks which brain modules are frequently co-activated
 * and proposes new direct pathways between them. Pathways that are
 * rarely used gradually degrade and are eventually pruned.
 *
 * The result: the brain's topology evolves based on usage patterns,
 * creating "shortcuts" between frequently cooperating modules.
 *
 * v0.7.0: фабрика createStructuralPlasticity(workspaceDir, config?, log?) —
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
  DynamicPathway,
  ModuleName,
  StructuralPlasticityState,
} from "./types.ts";

// ── Module names for tracking ───────────────────────────────────────

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

// ── Instance type ───────────────────────────────────────────────────

export type StructuralPlasticityInstance = {
  markModuleActivation(module: ModuleName): void;
  endCycle(reward: number): void;
  getStats(): {
    totalCycles: number;
    coActivationPairs: number;
    dynamicPathways: { active: number; dormant: number; pruned: number };
    topCorrelations: Array<{ moduleA: ModuleName; moduleB: ModuleName; correlation: number }>;
    pathwayDetails: DynamicPathway[];
  };
  hasDynamicPathway(moduleA: ModuleName, moduleB: ModuleName): boolean;
  getDynamicPathwayStrength(moduleA: ModuleName, moduleB: ModuleName): number;
};

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Create a structural-plasticity instance with isolated state.
 * Empty workspaceDir = detached instance: state lives in memory,
 * disk is never touched (identical to pre-init module behavior).
 */
export function createStructuralPlasticity(
  workspaceDir: string,
  config?: BrainAgentConfig,
  log?: { info: (msg: string) => void; warn: (msg: string) => void },
): StructuralPlasticityInstance {
  // ── State (closure) ───────────────────────────────────────────────
  const storageDir = workspaceDir ? join(workspaceDir, ".brainagent", "structural") : "";
  let currentConfig: BrainAgentConfig | null = config ?? null;
  const logger = log;

  let state: StructuralPlasticityState = createDefaultState();

  /** Modules activated in the current cycle */
  const currentCycleActivations: Set<ModuleName> = new Set();

  function createDefaultState(): StructuralPlasticityState {
    return {
      coActivations: [],
      dynamicPathways: [],
      totalCycles: 0,
      lastPruning: Date.now(),
    };
  }

  // ── Persistence ───────────────────────────────────────────────────

  function loadState(): void {
    if (!storageDir) return;
    try {
      const path = join(storageDir, "state.json");
      if (existsSync(path)) {
        const data = JSON.parse(readFileSync(path, "utf-8")) as StructuralPlasticityState;
        state = data;
      }
    } catch {
      // Fresh start
    }
  }

  function saveState(): void {
    if (!storageDir) return;
    try {
      atomicWrite(join(storageDir, "state.json"), JSON.stringify(state, null, 2));
    } catch {
      /* non-critical */
    }
  }

  // ── Core Functions ────────────────────────────────────────────────

  function markModuleActivation(module: ModuleName): void {
    currentCycleActivations.add(module);
  }

  /**
   * Update co-activation record for a module pair.
   */
  function updateCoActivation(
    moduleA: ModuleName,
    moduleB: ModuleName,
    bothActive: boolean,
    timestamp: number,
  ): void {
    // Find or create record
    let record = state.coActivations.find(
      (r) =>
        (r.moduleA === moduleA && r.moduleB === moduleB) ||
        (r.moduleA === moduleB && r.moduleB === moduleA),
    );

    if (!record) {
      record = {
        moduleA,
        moduleB,
        coActivations: 0,
        activationsA: 0,
        activationsB: 0,
        correlation: 0,
        recentHistory: [],
        lastUpdated: timestamp,
      };
      state.coActivations.push(record);
    }

    // Update counts
    if (bothActive) {
      record.coActivations++;
      record.activationsA++;
      record.activationsB++;
    } else if (currentCycleActivations.has(moduleA)) {
      record.activationsA++;
    } else if (currentCycleActivations.has(moduleB)) {
      record.activationsB++;
    }

    // Update history
    record.recentHistory.push({ timestamp, bothActive });
    if (record.recentHistory.length > 50) {
      record.recentHistory = record.recentHistory.slice(-50);
    }

    // Compute correlation (simplified Jaccard-like coefficient)
    const totalActivations = record.activationsA + record.activationsB - record.coActivations;
    record.correlation = totalActivations > 0 ? record.coActivations / totalActivations : 0;

    record.lastUpdated = timestamp;
  }

  /**
   * Check if any module pairs should become dynamic pathways.
   */
  function checkForNewPathways(): void {
    if (!currentConfig) return;

    const { minCorrelationForPathway, minCyclesForPathway, maxDynamicPathways } =
      currentConfig.structuralPlasticity;

    if (state.dynamicPathways.filter((p) => p.status === "active").length >= maxDynamicPathways) {
      return; // Already at capacity
    }

    for (const record of state.coActivations) {
      // Check if this pair already has a pathway
      const existingPathway = state.dynamicPathways.find(
        (p) =>
          (p.from === record.moduleA && p.to === record.moduleB) ||
          (p.from === record.moduleB && p.to === record.moduleA),
      );
      if (existingPathway) continue;

      // Check correlation threshold
      if (record.correlation < minCorrelationForPathway) continue;

      // Check minimum cycles
      if (record.coActivations < minCyclesForPathway) continue;

      // Create new pathway!
      const newPathway: DynamicPathway = {
        id: `dyn_${record.moduleA}_${record.moduleB}_${Date.now()}`,
        from: record.moduleA,
        to: record.moduleB,
        strength: record.correlation,
        createdAt: Date.now(),
        usageCount: 0,
        avgReward: 0,
        status: "active",
      };

      state.dynamicPathways.push(newPathway);

      bus.emitSync("structure:pathway-created", {
        from: record.moduleA,
        to: record.moduleB,
        correlation: record.correlation,
      });

      logger?.info(
        `StructuralPlasticity: NEW PATHWAY created ${record.moduleA} ↔ ${record.moduleB} ` +
          `(correlation: ${(record.correlation * 100).toFixed(0)}%)`,
      );
    }
  }

  /**
   * Prune pathways that haven't been used recently.
   */
  function pruneUnusedPathways(): void {
    if (!currentConfig) return;

    const now = Date.now();
    state.lastPruning = now;

    for (const pathway of state.dynamicPathways) {
      if (pathway.status !== "active") continue;

      // Check usage since creation
      const ageInCycles = state.totalCycles - pathway.usageCount;
      const usageRate = pathway.usageCount / Math.max(1, ageInCycles);

      if (usageRate < 0.1 && pathway.usageCount < 5) {
        // Very low usage — mark as dormant
        pathway.status = "dormant";
        logger?.info(
          `StructuralPlasticity: pathway ${pathway.from} ↔ ${pathway.to} marked DORMANT`,
        );
      } else if (pathway.avgReward < -0.2 && pathway.usageCount > 10) {
        // Consistently negative reward — prune
        pathway.status = "pruned";
        bus.emitSync("structure:pathway-pruned", {
          from: pathway.from,
          to: pathway.to,
          reason: "negative_reward",
        });
        logger?.info(
          `StructuralPlasticity: pathway ${pathway.from} ↔ ${pathway.to} PRUNED (avg reward: ${pathway.avgReward.toFixed(2)})`,
        );
      }
    }
  }

  /**
   * End the current cycle and update co-activation statistics.
   * Call this at the end of each interaction cycle (after dopamine:reward).
   */
  function endCycle(reward: number): void {
    if (!currentConfig) return;

    const activated = Array.from(currentCycleActivations);
    const now = Date.now();

    // Update co-activation records for all pairs of activated modules
    for (let i = 0; i < activated.length; i++) {
      for (let j = i + 1; j < activated.length; j++) {
        updateCoActivation(activated[i], activated[j], true, now);
      }
    }

    // Update records for modules that were NOT co-activated
    for (const moduleA of ALL_MODULES) {
      for (const moduleB of ALL_MODULES) {
        if (moduleA >= moduleB) continue; // Only track each pair once
        const aActive = currentCycleActivations.has(moduleA);
        const bActive = currentCycleActivations.has(moduleB);
        if (aActive !== bActive) {
          // Only one was active — not a co-activation
          updateCoActivation(moduleA, moduleB, false, now);
        }
      }
    }

    // Update dynamic pathway usage — aggregate activations into one event
    // to avoid spamming vital-impulse with N separate pressure signals
    let activatedCount = 0;
    let totalStrength = 0;

    for (const pathway of state.dynamicPathways) {
      if (pathway.status !== "active") continue;
      const fromActive = currentCycleActivations.has(pathway.from);
      const toActive = currentCycleActivations.has(pathway.to);
      if (fromActive && toActive) {
        pathway.usageCount++;
        pathway.avgReward =
          (pathway.avgReward * (pathway.usageCount - 1) + reward) / pathway.usageCount;
        activatedCount++;
        totalStrength += pathway.strength;
      }
    }

    // Emit a single aggregated event for all pathway activations in this cycle
    if (activatedCount > 0) {
      bus.emitSync("structure:pathway-activated", {
        from: "aggregate",
        to: "aggregate",
        strength: totalStrength / activatedCount,
        usageCount: activatedCount,
      });
    }

    state.totalCycles++;

    // Check for new pathway candidates
    checkForNewPathways();

    // Periodic pruning
    if (state.totalCycles % currentConfig.structuralPlasticity.pruningThreshold === 0) {
      pruneUnusedPathways();
    }

    // Clear for next cycle
    currentCycleActivations.clear();

    // Persist periodically
    if (state.totalCycles % 10 === 0) {
      saveState();
    }
  }

  // ── Public API ────────────────────────────────────────────────────

  function getStats() {
    const activePathways = state.dynamicPathways.filter((p) => p.status === "active").length;
    const dormantPathways = state.dynamicPathways.filter((p) => p.status === "dormant").length;
    const prunedPathways = state.dynamicPathways.filter((p) => p.status === "pruned").length;

    // Get top correlations
    const topCorrelations = [...state.coActivations]
      .sort((a, b) => b.correlation - a.correlation)
      .slice(0, 5)
      .map((r) => ({
        moduleA: r.moduleA,
        moduleB: r.moduleB,
        correlation: r.correlation,
      }));

    return {
      totalCycles: state.totalCycles,
      coActivationPairs: state.coActivations.length,
      dynamicPathways: {
        active: activePathways,
        dormant: dormantPathways,
        pruned: prunedPathways,
      },
      topCorrelations,
      pathwayDetails: state.dynamicPathways.filter((p) => p.status === "active"),
    };
  }

  function hasDynamicPathway(moduleA: ModuleName, moduleB: ModuleName): boolean {
    return state.dynamicPathways.some(
      (p) =>
        p.status === "active" &&
        ((p.from === moduleA && p.to === moduleB) || (p.from === moduleB && p.to === moduleA)),
    );
  }

  function getDynamicPathwayStrength(moduleA: ModuleName, moduleB: ModuleName): number {
    const pathway = state.dynamicPathways.find(
      (p) =>
        p.status === "active" &&
        ((p.from === moduleA && p.to === moduleB) || (p.from === moduleB && p.to === moduleA)),
    );
    return pathway?.strength ?? 0;
  }

  // ── Init (disk) ───────────────────────────────────────────────────

  if (storageDir) {
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }
    loadState();
    logger?.info(
      `StructuralPlasticity: initialized with ${state.dynamicPathways.length} dynamic pathways`,
    );
  }

  return {
    markModuleActivation,
    endCycle,
    getStats,
    hasDynamicPathway,
    getDynamicPathwayStrength,
  };
}

// ── Active-instance wrappers (backward-compatible API) ──────────────

let active: StructuralPlasticityInstance | null = null;

function current(): StructuralPlasticityInstance {
  if (!active) active = createStructuralPlasticity("");
  return active;
}

export function initStructuralPlasticity(
  workspaceDir: string,
  config: BrainAgentConfig,
  log?: { info: (msg: string) => void; warn: (msg: string) => void },
): void {
  active = createStructuralPlasticity(workspaceDir, config, log);
}

/** Symmetric teardown — drops the active instance (no timers/subscriptions). */
export function stopStructuralPlasticity(): void {
  active = null;
}

export function markModuleActivation(module: ModuleName): void {
  current().markModuleActivation(module);
}

export function endCycle(reward: number): void {
  current().endCycle(reward);
}

export function getStructuralStats(): {
  totalCycles: number;
  coActivationPairs: number;
  dynamicPathways: { active: number; dormant: number; pruned: number };
  topCorrelations: Array<{ moduleA: ModuleName; moduleB: ModuleName; correlation: number }>;
  pathwayDetails: DynamicPathway[];
} {
  return current().getStats();
}

export function hasDynamicPathway(moduleA: ModuleName, moduleB: ModuleName): boolean {
  return current().hasDynamicPathway(moduleA, moduleB);
}

export function getDynamicPathwayStrength(moduleA: ModuleName, moduleB: ModuleName): number {
  return current().getDynamicPathwayStrength(moduleA, moduleB);
}
