// ── Neuromodulatory system types ──────────────────────────────────

/** Global dopamine signal distributed to all modules after each interaction */
export type DopamineSignal = {
  /** Overall reward for this interaction (-1 to 1, negative = punishment) */
  reward: number;
  /** Prediction error: actual reward - expected reward */
  predictionError: number;
  /** Which modules participated in this response cycle */
  participatingModules: string[];
  /** Per-module credit assignment (0-1 share of reward) */
  creditAssignment: Record<string, number>;
  /** Context for learning */
  context: {
    domain: string;
    complexity: string;
    emotion: string;
    input: string;
  };
};

/** State of all four neuromodulators (updated continuously) */
export type NeuromodulatorState = {
  /** Dopamine: reward/motivation signal (0-1) */
  dopamine: number;
  /** Serotonin: mood/risk tolerance (0-1, high = optimistic/risk-taking) */
  serotonin: number;
  /** Norepinephrine: attention/alertness (0-1, high = focused) */
  norepinephrine: number;
  /** Acetylcholine: learning rate modulator (0-1, high = fast learning) */
  acetylcholine: number;
};

// ── Learning coordinator types ────────────────────────────────────

/** Report generated after each learning cycle */
export type LearningCycleReport = {
  /** Timestamp of this learning cycle */
  timestamp: number;
  /** Per-module performance metrics */
  moduleMetrics: Record<string, ModulePerformanceMetrics>;
  /** System-wide metrics */
  systemMetrics: {
    averageReward: number;
    learningEfficiency: number;
    adaptationRate: number;
  };
  /** Discovered cross-module insights */
  insights: LearningInsight[];
};

/** Performance metrics for a single module */
export type ModulePerformanceMetrics = {
  /** How many times this module contributed to a cycle */
  activations: number;
  /** Average reward when this module was active */
  averageReward: number;
  /** How much this module's output influenced the final result */
  influence: number;
  /** Error rate: how often cerebellum flagged issues related to this module */
  errorRate: number;
  /** Trend: improving, stable, or degrading */
  trend: "improving" | "stable" | "degrading";
};

/** A cross-module insight discovered by the learning coordinator */
export type LearningInsight = {
  type: "pattern" | "correlation" | "anomaly" | "optimization";
  source: string;
  target: string;
  description: string;
  confidence: number;
  actionable: boolean;
};

// ── Synaptic Plasticity types ─────────────────────────────────────

/**
 * Names of the 8 neural pathways in the system.
 * Each pathway connects two brain modules and carries signals between them.
 */
export type PathwayName =
  | "cerebellum→basal-ganglia"
  | "predictive→thalamus"
  | "basal-ganglia→predictive"
  | "dopamine→all"
  | "neuromodulator-cache"
  | "learning→system"
  | "dream→cross-module"
  | "mirror→system";

/**
 * Synaptic weight for a single pathway.
 * Implements Hebbian learning: "neurons that fire together, wire together".
 */
export type SynapticWeight = {
  /** Current weight (0.1 to 2.0, default 1.0). Higher = stronger connection. */
  weight: number;
  /** Number of times this pathway has been activated */
  activationCount: number;
  /** Running sum of rewards when this pathway was active */
  totalReward: number;
  /** Recent activation history for trend analysis */
  recentActivations: Array<{ timestamp: number; reward: number }>;
  /** Timestamp of last weight update */
  lastUpdated: number;
};

/**
 * Complete synaptic weight state for all pathways.
 * Persisted to storage for learning continuity across sessions.
 */
export type SynapticState = {
  /** Per-pathway weights */
  weights: Record<PathwayName, SynapticWeight>;
  /** Global learning parameters (can be adjusted by meta-learning) */
  learningRate: number;
  /** Decay rate for weight changes (prevents runaway weights) */
  decayRate: number;
  /** Total learning cycles across all pathways */
  totalCycles: number;
};

// ── Structural Plasticity types ───────────────────────────────────

/**
 * Module names that can be tracked for co-activation.
 */
export type ModuleName =
  | "thalamus"
  | "amygdala"
  | "hippocampus"
  | "prefrontalCortex"
  | "cerebellum"
  | "mirrorNeurons"
  | "predictiveEngine"
  | "basalGanglia"
  | "dopamineSystem"
  | "learningCoordinator"
  | "workingMemory"
  | "sessionBridge"
  | "attentionGate"
  | "goalStack"
  | "agentIdentity"
  | "tokenEconomy";

/**
 * Tracks co-activation between two modules.
 */
export type CoActivationRecord = {
  moduleA: ModuleName;
  moduleB: ModuleName;
  /** Number of times both modules were active in the same cycle */
  coActivations: number;
  /** Total activations of moduleA */
  activationsA: number;
  /** Total activations of moduleB */
  activationsB: number;
  /** Computed correlation coefficient */
  correlation: number;
  /** Recent co-activation history for trend analysis */
  recentHistory: Array<{ timestamp: number; bothActive: boolean }>;
  /** Last update timestamp */
  lastUpdated: number;
};

/**
 * A dynamically created pathway between modules.
 */
export type DynamicPathway = {
  id: string;
  /** Source module */
  from: ModuleName;
  /** Target module */
  to: ModuleName;
  /** Current strength (0-1) */
  strength: number;
  /** When this pathway was created */
  createdAt: number;
  /** How many times this pathway has been used */
  usageCount: number;
  /** Average reward when this pathway is active */
  avgReward: number;
  /** Whether this pathway is active or pruned */
  status: "active" | "dormant" | "pruned";
};

/**
 * State for structural plasticity system.
 */
export type StructuralPlasticityState = {
  /** Co-activation tracking for all module pairs */
  coActivations: CoActivationRecord[];
  /** Dynamically created pathways */
  dynamicPathways: DynamicPathway[];
  /** Total cycles analyzed */
  totalCycles: number;
  /** When the last pruning occurred */
  lastPruning: number;
};

// ── Emergent Module types ─────────────────────────────────────────

/**
 * A virtual "module" that represents a successful combination of real modules.
 */
export type EmergentModule = {
  id: string;
  /** Human-readable name (auto-generated or user-assigned) */
  name: string;
  /** Which real modules participate in this emergent pattern */
  participants: ModuleName[];
  /** Typical domain where this pattern excels */
  domain: string;
  /** Average reward when this pattern is activated */
  avgReward: number;
  /** How many times this pattern has been detected */
  occurrences: number;
  /** When this pattern was first detected */
  discoveredAt: number;
  /** Confidence in this pattern (0-1) */
  confidence: number;
  /** Status */
  status: "emerging" | "established" | "deprecated";
};

/**
 * State for emergent modules system.
 */
export type EmergentModulesState = {
  /** Discovered emergent patterns */
  modules: EmergentModule[];
  /** Pattern detection threshold */
  minOccurrences: number;
  /** Minimum reward to consider a pattern successful */
  minReward: number;
};

// ── Circadian Rhythm types ─────────────────────────────────────────

/**
 * Circadian phase — the brain's current mode of operation.
 * Like the human brain, BrainAgent cycles between wake and sleep phases.
 */
export type CircadianPhase = "wake" | "transition-to-sleep" | "sleep" | "transition-to-wake";

/**
 * Detailed circadian state with all timing and modulation parameters.
 */
export type CircadianState = {
  /** Current phase */
  phase: CircadianPhase;
  /** Phase progress (0-1): how far into the current phase we are */
  phaseProgress: number;
  /** When the current phase started */
  phaseStartedAt: number;
  /** Time since last user activity (ms) */
  idleTime: number;
  /** Activity level over recent window (0-1) */
  activityLevel: number;
  /** Number of interactions in current wake cycle */
  wakeInteractions: number;
  /** Number of consolidations in current sleep cycle */
  sleepConsolidations: number;
  /** Wake phase neuromodulator multipliers */
  wakeModulation: {
    dopamineBoost: number;
    serotoninBoost: number;
    acetylcholineBoost: number;
    norepinephrineBoost: number;
  };
  /** Sleep phase settings */
  sleepSettings: {
    consolidationIntensity: number;
    pruningAggressiveness: number;
    synapticNormalization: boolean;
  };
};

/**
 * Circadian rhythm events for the event bus.
 */
export type CircadianEventMap = {
  "circadian:phase-changed": { oldPhase: CircadianPhase; newPhase: CircadianPhase };
  "circadian:wake-started": { idleTime: number };
  "circadian:sleep-started": { wakeInteractions: number };
  "circadian:activity-detected": { activityLevel: number };
};

// ── Metabolic Budget types ────────────────────────────────────────

/**
 * Energy budget for a single module.
 */
export type ModuleEnergy = {
  module: ModuleName;
  /** Current energy level (0-1) */
  energy: number;
  /** Base energy allocation */
  baseEnergy: number;
  /** Recent performance score */
  performance: number;
  /** Energy consumption rate */
  consumptionRate: number;
  /** Whether module is in low-power mode */
  lowPowerMode: boolean;
};

/**
 * State for metabolic budget system.
 */
export type MetabolicState = {
  /** Per-module energy levels */
  moduleEnergies: Record<ModuleName, ModuleEnergy>;
  /** Total system energy budget */
  totalBudget: number;
  /** Energy regeneration rate per cycle */
  regenRate: number;
  /** Cycles since last rebalancing */
  cyclesSinceRebalance: number;
};
