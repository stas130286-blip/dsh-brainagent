/**
 * Neural Pathways — Cross-module communication and knowledge transfer.
 *
 * In the human brain, white matter tracts (neural pathways) connect
 * distant brain regions, enabling them to influence each other:
 *
 * - Thalamo-cortical loops: thalamus → cortex → thalamus (refine processing)
 * - Hippocampal-cortical loops: memory → reasoning → better memory
 * - Basal ganglia-cortical loops: habit → conscious evaluation → better habit
 * - Cerebellar feedback: error detection → motor correction → learning
 *
 * Without these pathways, each brain region is an island. The thalamus
 * classifies but never learns from the cerebellum's quality checks.
 * The predictive engine predicts but never validates against reality.
 * The basal ganglia form habits but never benefit from memory recall.
 *
 * This module wires the event bus with ACTIVE LISTENERS that transfer
 * knowledge between modules — the missing 30% that turns a collection
 * of modules into a true cognitive architecture.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWrite } from "./persist.ts";
import { reinforce as reinforceHabit } from "./basal-ganglia.ts";
import { markNovelty } from "./dopamine-system.ts";
import { bus } from "./event-bus.ts";
import type {
  BrainAgentConfig,
  DopamineSignal,
  LearningInsight,
  NeuromodulatorState,
  PathwayName,
  SynapticState,
  SynapticWeight,
} from "./types.ts";

// ── Pathway names (the 8 neural connections) ────────────────────────

const PATHWAY_NAMES: PathwayName[] = [
  "cerebellum→basal-ganglia",
  "predictive→thalamus",
  "basal-ganglia→predictive",
  "dopamine→all",
  "neuromodulator-cache",
  "learning→system",
  "dream→cross-module",
  "mirror→system",
];

// ── Types ───────────────────────────────────────────────────────────

type PathwayLogger = { info: (msg: string) => void; warn: (msg: string) => void };

export type NeuralPathwaysInstance = {
  /** Reset cycle state (called at the start of each new message). */
  resetCycleState(): void;
  /** Get the current neuromodulator state (cached). */
  getCachedNeuroState(): NeuromodulatorState;
  /** Get last cerebellum issues for this cycle. */
  getLastCerebellumIssues(): string[];
  getPathwayStats(): {
    pathwayCount: number;
    lastPredictionCount: number;
    currentHabitId: string | undefined;
    neuroState: NeuromodulatorState;
    totalLearningCycles: number;
  };
  getSynapticStats(): SynapticStatsResult;
  buildNeuromodulatorContext(): string | undefined;
  /** Отписка от шины + сохранение синаптических весов. */
  stop(): void;
  /** Тихая версия stop для пере-инициализации. */
  dispose(): void;
};

type SynapticStatsResult = {
  totalCycles: number;
  learningRate: number;
  pathways: Array<{
    name: PathwayName;
    weight: number;
    activationCount: number;
    avgReward: number;
    trend: "strengthening" | "stable" | "weakening";
  }>;
  strongestPathway: PathwayName | null;
  weakestPathway: PathwayName | null;
};

// ── Pure helpers (module-level) ─────────────────────────────────────

function createDefaultSynapticState(): SynapticState {
  const weights: Record<string, SynapticWeight> = {};
  for (const name of PATHWAY_NAMES) {
    weights[name] = {
      weight: 1.0,
      activationCount: 0,
      totalReward: 0,
      recentActivations: [],
      lastUpdated: Date.now(),
    };
  }
  return {
    weights: weights as Record<PathwayName, SynapticWeight>,
    learningRate: 0.1,
    decayRate: 0.01,
    totalCycles: 0,
  };
}

const DEFAULT_NEURO_STATE: NeuromodulatorState = {
  dopamine: 0.5,
  serotonin: 0.6,
  norepinephrine: 0.3,
  acetylcholine: 0.4,
};

/** Compute detailed synaptic weight statistics from a given state. */
function computeSynapticStats(synapticState: SynapticState): SynapticStatsResult {
  const pathways: Array<{
    name: PathwayName;
    weight: number;
    activationCount: number;
    avgReward: number;
    trend: "strengthening" | "stable" | "weakening";
  }> = [];

  let strongestPathway: PathwayName | null = null;
  let weakestPathway: PathwayName | null = null;
  let maxWeight = 0;
  let minWeight = Infinity;

  for (const name of PATHWAY_NAMES) {
    const w = synapticState.weights[name];
    if (!w) continue;

    const avgReward = w.activationCount > 0 ? w.totalReward / w.activationCount : 0;

    // Compute trend from recent activations
    let trend: "strengthening" | "stable" | "weakening" = "stable";
    if (w.recentActivations.length >= 10) {
      const firstHalf = w.recentActivations.slice(0, Math.floor(w.recentActivations.length / 2));
      const secondHalf = w.recentActivations.slice(Math.floor(w.recentActivations.length / 2));
      const firstAvg = firstHalf.reduce((s, a) => s + a.reward, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, a) => s + a.reward, 0) / secondHalf.length;
      if (secondAvg - firstAvg > 0.1) trend = "strengthening";
      else if (secondAvg - firstAvg < -0.1) trend = "weakening";
    }

    pathways.push({
      name,
      weight: w.weight,
      activationCount: w.activationCount,
      avgReward,
      trend,
    });

    if (w.weight > maxWeight) {
      maxWeight = w.weight;
      strongestPathway = name;
    }
    if (w.weight < minWeight) {
      minWeight = w.weight;
      weakestPathway = name;
    }
  }

  // Sort by weight descending
  pathways.sort((a, b) => b.weight - a.weight);

  return {
    totalCycles: synapticState.totalCycles,
    learningRate: synapticState.learningRate,
    pathways,
    strongestPathway,
    weakestPathway,
  };
}

/**
 * Build a context string about the neuromodulator state for the LLM.
 * This is the "chemical atmosphere" of the brain — it subtly influences
 * how the LLM responds, just as neurotransmitters influence behavior.
 */
function buildNeuromodulatorContextFromState(neuroState: NeuromodulatorState): string | undefined {
  // Only inject context when neuromodulator levels are significantly
  // different from baseline (notable mental state)
  const significantDev =
    Math.abs(neuroState.dopamine - 0.5) > 0.2 ||
    Math.abs(neuroState.norepinephrine - 0.3) > 0.2 ||
    Math.abs(neuroState.serotonin - 0.6) > 0.15;

  if (!significantDev) return undefined;

  const lines: string[] = ["## Cognitive State (Neuromodulators)"];

  if (neuroState.dopamine > 0.7) {
    lines.push(
      "- High motivation/confidence: recent interactions went well. You can be more proactive and suggest improvements.",
    );
  } else if (neuroState.dopamine < 0.3) {
    lines.push(
      "- Low motivation: recent interactions had issues. Be extra careful and precise. Double-check your answers.",
    );
  }

  if (neuroState.norepinephrine > 0.6) {
    lines.push(
      "- High attention mode: the task requires focus. Retrieve more context from memory and be thorough.",
    );
  }

  if (neuroState.serotonin < 0.35) {
    lines.push("- Conservative mode: stick to proven approaches. Avoid risky suggestions.");
  } else if (neuroState.serotonin > 0.75) {
    lines.push("- Exploratory mode: you can suggest creative alternatives and novel approaches.");
  }

  if (neuroState.acetylcholine > 0.7) {
    lines.push(
      "- High learning mode: pay extra attention to new information from the user. Update your understanding actively.",
    );
  }

  return lines.length > 1 ? lines.join("\n") : undefined;
}

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Create a neural pathways instance with its own synaptic state and
 * bus listeners. Call once during plugin registration via initNeuralPathways.
 */
export function createNeuralPathways(
  workspaceDir: string,
  config: BrainAgentConfig,
  logger?: PathwayLogger,
): NeuralPathwaysInstance {
  // Setup storage for synaptic weights
  const storageDir = join(workspaceDir, ".brainagent", "synapses");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  /** Current synaptic weights for all pathways */
  const synapticState: SynapticState = createDefaultSynapticState();

  /** Track which pathways were activated in the current cycle */
  const activatedPathways = new Set<PathwayName>();

  /** Track last prediction to validate it later */
  let lastPredictions: Array<{ topic: string; confidence: number; type: string }> = [];

  /** Track if the current cycle had a matching habit */
  let currentCycleHabitId: string | undefined;

  /** Track cerebellum results for feedback to other modules */
  let lastCerebellumIssues: string[] = [];

  /** Neuromodulator state cache (updated on every state change) */
  let currentNeuroState: NeuromodulatorState = { ...DEFAULT_NEURO_STATE };

  // ── Synaptic Plasticity (Hebbian Learning) ──────────────────────

  /**
   * Mark a pathway as activated in the current cycle.
   * Called by each pathway handler when it fires.
   */
  function markPathwayActivation(pathway: PathwayName): void {
    activatedPathways.add(pathway);
  }

  /**
   * Apply Hebbian learning to all pathways activated in the current cycle.
   * Called when dopamine:reward is received at the end of each cycle.
   *
   * Hebbian rule: Δw = learningRate × reward × currentWeight
   * - Positive reward → weights increase (strengthen pathway)
   * - Negative reward → weights decrease (weaken pathway)
   * - Weights are clamped to [minWeight, maxWeight]
   */
  function applyHebbianLearning(reward: number): void {
    if (activatedPathways.size === 0) return;

    const { learningRate, decayRate, minWeight, maxWeight } = config.synapticPlasticity;
    const now = Date.now();

    for (const pathwayName of activatedPathways) {
      const weight = synapticState.weights[pathwayName];
      if (!weight) continue;

      const oldWeight = weight.weight;

      // Hebbian update: Δw = η × reward × w
      // This ensures stronger pathways get proportionally more change
      const delta = learningRate * reward * weight.weight;
      let newWeight = weight.weight + delta;

      // Apply decay toward baseline (1.0) to prevent runaway weights
      newWeight = newWeight + decayRate * (1.0 - newWeight);

      // Clamp to bounds
      newWeight = Math.max(minWeight, Math.min(maxWeight, newWeight));

      // Update state
      weight.weight = newWeight;
      weight.activationCount++;
      weight.totalReward += reward;
      weight.lastUpdated = now;

      // Track recent activations for analysis
      weight.recentActivations.push({ timestamp: now, reward });
      if (weight.recentActivations.length > config.synapticPlasticity.activationHistorySize) {
        weight.recentActivations = weight.recentActivations.slice(
          -config.synapticPlasticity.activationHistorySize,
        );
      }

      // Emit events for significant changes
      const significantChange = Math.abs(newWeight - oldWeight) > 0.05;
      if (significantChange) {
        bus.emitSync("synapse:weight-updated", {
          pathway: pathwayName,
          oldWeight,
          newWeight,
          reward,
        });

        if (newWeight > oldWeight) {
          bus.emitSync("synapse:pathway-strengthened", { pathway: pathwayName, weight: newWeight });
        } else {
          bus.emitSync("synapse:pathway-weakened", { pathway: pathwayName, weight: newWeight });
        }

        logger?.info(
          `Synapse: ${pathwayName} weight ${oldWeight.toFixed(3)} → ${newWeight.toFixed(3)} (reward: ${reward.toFixed(2)})`,
        );
      }
    }

    synapticState.totalCycles++;

    // Persist state periodically (every 10 cycles)
    if (synapticState.totalCycles % 10 === 0) {
      saveSynapticState();
    }

    // Clear activated pathways for next cycle
    activatedPathways.clear();
  }

  // ── Persistence ─────────────────────────────────────────────────

  /**
   * Load synaptic state from disk.
   */
  function loadSynapticState(): void {
    try {
      const path = join(storageDir, "weights.json");
      if (existsSync(path)) {
        const data = JSON.parse(readFileSync(path, "utf-8")) as SynapticState;
        // Merge loaded state with defaults (in case new pathways were added)
        for (const name of PATHWAY_NAMES) {
          if (data.weights[name]) {
            synapticState.weights[name] = data.weights[name];
          }
        }
        synapticState.totalCycles = data.totalCycles ?? 0;
        logger?.info(
          `Synapse: loaded weights from ${synapticState.totalCycles} cycles of learning`,
        );
      }
    } catch {
      // Fresh start with default weights
    }
  }

  /**
   * Save synaptic state to disk.
   */
  function saveSynapticState(): void {
    try {
      atomicWrite(
        join(storageDir, "weights.json"),
        JSON.stringify(synapticState, null, 2),
      );
    } catch {
      /* non-critical */
    }
  }

  loadSynapticState();

  // Apply config to synaptic state
  synapticState.learningRate = config.synapticPlasticity.learningRate;
  synapticState.decayRate = config.synapticPlasticity.decayRate;

  // ── Pathway listeners ───────────────────────────────────────────

  const unsubs: Array<() => void> = [];

  // ═══════════════════════════════════════════════════════════════
  // PATHWAY 1: Cerebellum → Basal Ganglia
  // "Error feedback loop"
  //
  // When cerebellum detects quality issues, penalize the habit
  // that was used (if any). When quality passes, reward it.
  // This creates a direct dopamine-like signal for habits.
  // ═══════════════════════════════════════════════════════════════

  unsubs.push(
    bus.on("cerebellum:validated", (data) => {
      lastCerebellumIssues = data.issues;
      markPathwayActivation("cerebellum→basal-ganglia");

      if (currentCycleHabitId) {
        if (data.passed) {
          // Quality passed → reinforce the habit positively
          reinforceHabit(currentCycleHabitId, "positive");
          bus.emitSync("pathway:memory-reinforced", {
            source: "cerebellum→basal-ganglia",
            memoryId: currentCycleHabitId,
            layer: "procedural",
          });
        } else if (data.issues.length >= 2) {
          // Serious quality issues → weaken the habit
          reinforceHabit(currentCycleHabitId, "negative");
          logger?.info(
            `NeuralPathway: cerebellum→basal-ganglia — weakening habit ${currentCycleHabitId} (${data.issues.length} issues)`,
          );
        }
      }
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  // PATHWAY 2: Predictive Engine → Thalamus/Hippocampus
  // "Prediction validation loop"
  //
  // When predictions are made, track them. When the next message
  // arrives and thalamus classifies it, check if the prediction
  // was correct. Feed this back to the predictive engine's learning.
  // ═══════════════════════════════════════════════════════════════

  unsubs.push(
    bus.on("predictive:predicted", (data) => {
      lastPredictions = data.predictions;
    }),
  );

  unsubs.push(
    bus.on("thalamus:classified", (classification) => {
      if (lastPredictions.length === 0) return;
      markPathwayActivation("predictive→thalamus");

      // Check if any prediction matched the actual classified domain
      const matched = lastPredictions.find(
        (p) => p.topic.toLowerCase() === classification.domain.toLowerCase(),
      );

      if (matched) {
        bus.emitSync("pathway:prediction-validated", {
          predictionTopic: matched.topic,
          wasCorrect: true,
        });
        logger?.info(
          `NeuralPathway: prediction validated — "${matched.topic}" was correct (${(matched.confidence * 100).toFixed(0)}% confidence)`,
        );
      } else {
        // All predictions were wrong — mark as novel
        markNovelty();
        for (const pred of lastPredictions) {
          bus.emitSync("pathway:prediction-validated", {
            predictionTopic: pred.topic,
            wasCorrect: false,
          });
        }
      }

      // Clear predictions for next cycle
      lastPredictions = [];
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  // PATHWAY 3: Basal Ganglia → Predictive Engine
  // "Habit promotion loop"
  //
  // When a habit reaches high confidence (strong reward signal,
  // many activations), promote it as a predictive pattern.
  // This is how habits become predictions: "I expect the user
  // to ask about X because they always do."
  // ═══════════════════════════════════════════════════════════════

  unsubs.push(
    bus.on("basal:habit-matched", (data) => {
      currentCycleHabitId = data.habitId;
      markPathwayActivation("basal-ganglia→predictive");

      // If the habit is auto-executed, it's well-established
      // → promote as a strong predictive signal
      if (data.autoExecute && data.matchScore > 0.7) {
        bus.emitSync("pathway:habit-promoted", {
          source: "basal-ganglia→predictive-engine",
          habitId: data.habitId,
          confidence: data.matchScore,
        });
      }
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  // PATHWAY 4: Dopamine → All Modules
  // "Global reward distribution"
  //
  // When dopamine signal is broadcast, modulate the behavior
  // of all modules based on the neuromodulator state:
  // - High dopamine → more confident habit execution
  // - High norepinephrine → deeper memory retrieval
  // - High serotonin → more exploratory predictions
  // - High acetylcholine → faster learning rates
  // ═══════════════════════════════════════════════════════════════

  unsubs.push(
    bus.on("dopamine:reward", (signal: DopamineSignal) => {
      markPathwayActivation("dopamine→all");

      // ═══════════════════════════════════════════════════════════
      // HEBBIAN LEARNING: Update synaptic weights based on reward
      // "Neurons that fire together, wire together"
      //
      // All pathways that were activated in this cycle get their
      // weights updated based on the dopamine reward signal.
      // Positive reward → strengthen connections
      // Negative reward → weaken connections
      // ═══════════════════════════════════════════════════════════
      applyHebbianLearning(signal.reward);

      // If reward was very negative, log for diagnostics
      if (signal.reward < -0.3) {
        logger?.info(
          `NeuralPathway: strong negative reward (${signal.reward.toFixed(2)}) — ` +
            `modules: ${signal.participatingModules.join(", ")}`,
        );
      }
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  // PATHWAY 5: Neuromodulator state → cached for all modules
  // ═══════════════════════════════════════════════════════════════

  unsubs.push(
    bus.on("neuromodulator:state-changed", (newState: NeuromodulatorState) => {
      markPathwayActivation("neuromodulator-cache");
      currentNeuroState = newState;
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  // PATHWAY 6: Learning Coordinator → System Optimization
  // "Meta-learning feedback loop"
  //
  // When the learning coordinator discovers actionable insights,
  // apply them to optimize module behavior.
  // ═══════════════════════════════════════════════════════════════

  unsubs.push(
    bus.on("learning:insight-discovered", (insight: LearningInsight) => {
      if (!insight.actionable) return;
      markPathwayActivation("learning→system");

      logger?.info(
        `NeuralPathway: learning insight — [${insight.type}] ${insight.description}`,
      );

      // In the future, these insights could trigger automatic
      // parameter adjustments. For now, they're logged and available
      // for context injection into the LLM prompt.
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  // PATHWAY 7: Dream Mode → Cross-module cleanup
  // "Post-consolidation knowledge transfer"
  //
  // After memory consolidation, update the predictive engine
  // and basal ganglia with the refined memory state.
  // ═══════════════════════════════════════════════════════════════

  unsubs.push(
    bus.on("dream:consolidation-complete", (data) => {
      markPathwayActivation("dream→cross-module");
      if (data.merged > 0 || data.pruned > 0) {
        logger?.info(
          `NeuralPathway: post-consolidation — ${data.merged} merged, ${data.pruned} pruned → memory state updated`,
        );
      }
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  // PATHWAY 8: Mirror Neurons → Amygdala/Prefrontal
  // "Empathy refinement loop"
  //
  // When user model is updated (stress, mood change), the
  // updated context is immediately available for the next
  // amygdala assessment and prefrontal context assembly.
  // This creates real-time adaptation to user state changes.
  // ═══════════════════════════════════════════════════════════════

  unsubs.push(
    bus.on("mirror:user-updated", (userModel) => {
      markPathwayActivation("mirror→system");
      // Track significant user state changes
      if (userModel.stressLevel > 0.7) {
        logger?.info(
          `NeuralPathway: mirror→system — high user stress detected (${(userModel.stressLevel * 100).toFixed(0)}%), adapting responses`,
        );
      }
    }),
  );

  logger?.info(
    "NeuralPathways: 8 cross-module pathways initialized with synaptic plasticity",
  );

  // ── Teardown ────────────────────────────────────────────────────

  function teardown(): void {
    for (const unsub of unsubs) unsub();
    unsubs.length = 0;
    saveSynapticState();
  }

  // ── Public instance API ─────────────────────────────────────────

  function resetCycleState(): void {
    currentCycleHabitId = undefined;
    lastCerebellumIssues = [];
    activatedPathways.clear();
  }

  return {
    resetCycleState,
    getCachedNeuroState: () => ({ ...currentNeuroState }),
    getLastCerebellumIssues: () => [...lastCerebellumIssues],
    getPathwayStats: () => ({
      pathwayCount: 8,
      lastPredictionCount: lastPredictions.length,
      currentHabitId: currentCycleHabitId,
      neuroState: { ...currentNeuroState },
      totalLearningCycles: synapticState.totalCycles,
    }),
    getSynapticStats: () => computeSynapticStats(synapticState),
    buildNeuromodulatorContext: () => buildNeuromodulatorContextFromState(currentNeuroState),
    stop: teardown,
    dispose: teardown,
  };
}

// ── Compatibility: free functions over the active instance ──────────

let active: NeuralPathwaysInstance | undefined;

/**
 * Initialize all neural pathways. Call once during plugin registration.
 * This wires the event bus with cross-module listeners.
 */
export function initNeuralPathways(
  workspaceDir: string,
  config: BrainAgentConfig,
  logger?: { info: (msg: string) => void; warn: (msg: string) => void },
): void {
  active?.dispose();
  active = createNeuralPathways(workspaceDir, config, logger);
}

export function stopNeuralPathways(): void {
  active?.stop();
  active = undefined;
}

/** Reset cycle state (called at the start of each new message) */
export function resetCycleState(): void {
  active?.resetCycleState();
}

/** Get the current neuromodulator state (cached) */
export function getCachedNeuroState(): NeuromodulatorState {
  return active?.getCachedNeuroState() ?? { ...DEFAULT_NEURO_STATE };
}

/** Get last cerebellum issues for this cycle */
export function getLastCerebellumIssues(): string[] {
  return active?.getLastCerebellumIssues() ?? [];
}

/** Get pathway statistics for diagnostics */
export function getPathwayStats(): {
  pathwayCount: number;
  lastPredictionCount: number;
  currentHabitId: string | undefined;
  neuroState: NeuromodulatorState;
  totalLearningCycles: number;
} {
  return (
    active?.getPathwayStats() ?? {
      pathwayCount: 8,
      lastPredictionCount: 0,
      currentHabitId: undefined,
      neuroState: { ...DEFAULT_NEURO_STATE },
      totalLearningCycles: 0,
    }
  );
}

/**
 * Get detailed synaptic weight statistics for diagnostics.
 * Shows the current "wiring" of the brain — which pathways are strong/weak.
 */
export function getSynapticStats(): SynapticStatsResult {
  return active?.getSynapticStats() ?? computeSynapticStats(createDefaultSynapticState());
}

/**
 * Build a context string about the neuromodulator state for the LLM.
 * This is the "chemical atmosphere" of the brain — it subtly influences
 * how the LLM responds, just as neurotransmitters influence behavior.
 */
export function buildNeuromodulatorContext(): string | undefined {
  return active?.buildNeuromodulatorContext();
}
