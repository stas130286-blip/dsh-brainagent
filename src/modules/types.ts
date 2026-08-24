/**
 * BrainAgent — Shared types for inter-module communication.
 *
 * Every brain module produces and consumes BrainSignals that flow
 * through the Corpus Callosum (event bus).
 */

// ── Signal classification produced by the Thalamus ──────────────────

export type MessageModality = "text" | "image" | "voice" | "file" | "mixed";

export type MessageDomain =
  | "technical"
  | "creative"
  | "casual"
  | "emotional"
  | "factual"
  | "command"
  | "unknown";

export type MessageComplexity = "trivial" | "simple" | "moderate" | "complex" | "extreme";

export type ContextTier = "core" | "situational" | "reflective";

export type ThalamusClassification = {
  modality: MessageModality;
  domain: MessageDomain;
  complexity: MessageComplexity;
  intentSummary: string;
  /** 0-1: how confident the classifier is */
  confidence: number;
  /** fast path = System 1, slow path = System 2 */
  processingPath: "fast" | "slow";
};

// ── Priority vector produced by the Amygdala ────────────────────────

export type EmotionLabel =
  | "neutral"
  | "joy"
  | "frustration"
  | "anxiety"
  | "curiosity"
  | "confusion"
  | "gratitude"
  | "urgency"
  | "anger"
  | "sadness";

export type AmygdalaAssessment = {
  /** 0-1 */
  urgency: number;
  /** 0-1 */
  importance: number;
  emotion: EmotionLabel;
  /** 0-1 */
  emotionIntensity: number;
  /** Whether we should activate empathy mode */
  empathyNeeded: boolean;
  /** Short reasoning string */
  rationale: string;
};

// ── User model maintained by Mirror Neurons ─────────────────────────

export type CommunicationStyle = "formal" | "informal" | "terse" | "verbose";

export type UserModel = {
  userId: string;
  /** General mood trend across recent messages */
  moodTrend: EmotionLabel;
  /** 0-1: how stressed the user appears */
  stressLevel: number;
  /** Detected communication style from the latest message */
  communicationStyle: CommunicationStyle;
  /** Language preference */
  language: string;
  /** Expertise level in current topic */
  expertiseLevel: "beginner" | "intermediate" | "expert";
  /** Last N emotion readings for trend analysis */
  emotionHistory: Array<{ timestamp: number; emotion: EmotionLabel; intensity: number }>;
  /** Topics the user frequently discusses */
  frequentTopics: string[];
  /** Last interaction timestamp */
  lastSeen: number;

  // ── Personality Evolution (reward-driven style adaptation) ──────
  /**
   * Per-style accumulated reward. The dopamine system feeds reward
   * signals here so the mirror neurons learn which response style
   * the user prefers over time. Higher total reward = more preferred.
   */
  styleRewards: Record<CommunicationStyle, { total: number; count: number }>;
  /**
   * The response style recommended for this user based on reward history.
   * Starts as the detected style, then evolves as reward data accumulates.
   */
  preferredResponseStyle: CommunicationStyle;

  // ── Theory of Mind extensions ────────────────────────────────────
  /** Inferred user goals from conversation patterns (up to 5) */
  inferredGoals: string[];
  /** Per-domain knowledge estimates */
  knowledgeModel: Record<string, "unknown" | "beginner" | "familiar" | "expert">;
  /** Behavioral interaction patterns */
  interactionPatterns: {
    avgResponseTimeMs: number;
    preferredTopics: string[];
    peakHoursUTC: number[];
    engagementStyle: "active" | "passive" | "sporadic";
  };
  /** Relationship depth 0-1 (interaction count + topic intimacy + time span) */
  relationshipDepth: number;
  /** Real-time mental state estimation */
  mentalState: {
    currentFocus: string | null;
    frustrationLevel: number;
    engagementLevel: number;
  };
  /** Recent intent classifications */
  intentHistory: Array<{ timestamp: number; inferredIntent: string; confidence: number }>;
};

// ── Multi-layer memory types (Hippocampus) ──────────────────────────

export type MemoryLayer = "working" | "episodic" | "semantic" | "procedural";

export type EpisodicMemory = {
  id: string;
  timestamp: number;
  summary: string;
  /** What happened */
  event: string;
  /** Emotional context at the time */
  emotionalContext: EmotionLabel;
  /** Key entities involved */
  entities: string[];
  /** How important (0-1), decays over time */
  salience: number;
  /** How many times this was recalled (strengthens on access) */
  accessCount: number;
};

export type SemanticMemory = {
  id: string;
  /** The fact or knowledge */
  content: string;
  /** Category: user_preference, fact, relationship, etc. */
  category: string;
  /** Related memory IDs for graph traversal */
  relatedIds: string[];
  /** Confidence in this fact (0-1) */
  confidence: number;
  /** Source: which episodic memories led to this */
  sourceEpisodeIds: string[];
  createdAt: number;
  updatedAt: number;
  /**
   * Memory reconsolidation trail — previous versions of this fact.
   * Like the faint human memory of "I used to think X but now I know Y".
   * Capped at 5 entries (oldest trimmed first).
   */
  revisionHistory?: RevisionRecord[];
};

/**
 * A snapshot of a fact before it was revised (memory reconsolidation).
 * Preserves the old belief so the agent can recall "I updated my understanding".
 */
export type RevisionRecord = {
  previousContent: string;
  previousConfidence: number;
  revisedAt: number;
  reason: string;
  sourceEpisodeIds: string[];
};

export type ProceduralMemory = {
  id: string;
  /** What this procedure does */
  description: string;
  /** Pattern that triggers this procedure */
  triggerPattern: string;
  /** Sequence of steps/tools to execute */
  steps: string[];
  /** Success rate from past usage (0-1) */
  successRate: number;
  /** How many times used */
  usageCount: number;
  lastUsed: number;
};

// ── Consolidated brain state for a single processing cycle ──────────

export type BrainState = {
  /** Raw input text */
  input: string;
  /** Thalamus classification */
  classification?: ThalamusClassification;
  /** Amygdala priority assessment */
  priority?: AmygdalaAssessment;
  /** Current user model snapshot */
  userModel?: UserModel;
  /** Retrieved memories relevant to this input */
  relevantMemories: {
    episodic: EpisodicMemory[];
    semantic: SemanticMemory[];
    procedural: ProceduralMemory[];
  };
  /** Model override from prefrontal cortex */
  modelOverride?: string;
  /** Additional context to prepend to the prompt */
  contextInjections: string[];
};

// ── Event bus signal types ──────────────────────────────────────────

export type BrainEventMap = {
  "thalamus:classified": ThalamusClassification;
  "amygdala:assessed": AmygdalaAssessment;
  "hippocampus:recalled": {
    episodic: EpisodicMemory[];
    semantic: SemanticMemory[];
    procedural: ProceduralMemory[];
  };
  "hippocampus:stored": { layer: MemoryLayer; id: string };
  "hippocampus:fact-revised": {
    factId: string;
    oldContent: string;
    newContent: string;
    reason: string;
  };
  "prefrontal:decision": { processingPath: "fast" | "slow"; modelOverride?: string };
  "mirror:user-updated": UserModel;
  "cerebellum:validated": { passed: boolean; issues: string[] };
  "dream:consolidation-complete": {
    merged: number;
    pruned: number;
    strengthened: number;
    contradictions: number;
    revised: number;
  };
  "predictive:predicted": {
    predictions: Array<{ topic: string; confidence: number; type: string }>;
  };
  "basal:habit-matched": { habitId: string; matchScore: number; autoExecute: boolean };
  "basal:reinforced": { habitId: string; signal: "positive" | "negative" | "neutral" };

  // ── Neuromodulatory system events ────────────────────────────────
  "dopamine:reward": DopamineSignal;
  "dopamine:prediction-error": { error: number; context: string };
  "neuromodulator:state-changed": NeuromodulatorState;

  // ── Learning coordinator events ──────────────────────────────────
  "learning:cycle-complete": LearningCycleReport;
  "learning:insight-discovered": LearningInsight;

  // ── Neural pathway events (cross-module) ─────────────────────────
  "pathway:habit-promoted": { source: string; habitId: string; confidence: number };
  "pathway:memory-reinforced": { source: string; memoryId: string; layer: MemoryLayer };
  "pathway:prediction-validated": { predictionTopic: string; wasCorrect: boolean };

  // ── Synaptic plasticity events ────────────────────────────────────
  "synapse:weight-updated": {
    pathway: PathwayName;
    oldWeight: number;
    newWeight: number;
    reward: number;
  };
  "synapse:pathway-strengthened": { pathway: PathwayName; weight: number };
  "synapse:pathway-weakened": { pathway: PathwayName; weight: number };

  // ── Structural plasticity events ─────────────────────────────────
  "structure:pathway-created": { from: ModuleName; to: ModuleName; correlation: number };
  "structure:pathway-pruned": { from: ModuleName; to: ModuleName; reason: string };
  "structure:pathway-activated": {
    from: ModuleName | "aggregate";
    to: ModuleName | "aggregate";
    strength: number;
    usageCount: number;
  };
  "structure:coactivation-detected": {
    moduleA: ModuleName;
    moduleB: ModuleName;
    correlation: number;
  };

  // ── Emergent module events ───────────────────────────────────────
  "emergent:pattern-discovered": {
    id: string;
    name: string;
    participants: ModuleName[];
    domain: string;
  };
  "emergent:pattern-established": { id: string; name: string; confidence: number };
  "emergent:pattern-deprecated": { id: string; reason: string };

  // ── Metabolic budget events ──────────────────────────────────────
  "metabolic:energy-low": { module: ModuleName; energy: number };
  "metabolic:module-throttled": { module: ModuleName; newRate: number };
  "metabolic:rebalanced": { changes: Array<{ module: ModuleName; delta: number }> };

  // ── Circadian rhythm events ─────────────────────────────────────
  "circadian:phase-changed": { oldPhase: CircadianPhase; newPhase: CircadianPhase };
  "circadian:wake-started": { idleTime: number };
  "circadian:sleep-started": { wakeInteractions: number };
  "circadian:activity-detected": { activityLevel: number };

  // ── Working Memory events ─────────────────────────────────────
  "working-memory:entry-added": { entryIndex: number; cycleInput: string };
  "working-memory:context-built": { entriesUsed: number };

  // ── Session Bridge events ─────────────────────────────────────
  "session:summary-created": SessionSummary;
  "session:resumed": { gapMs: number; lastSessionTopics: string[] };

  // ── Emotional Memory events ───────────────────────────────────
  "emotional-memory:flashbulb-stored": { episodeId: string; emotionalSalience: number };
  "emotional-memory:emotion-matched": { queryEmotion: EmotionLabel; matchedIds: string[] };

  // ── Attention Gate events ─────────────────────────────────────
  "attention:filtered": { total: number; kept: number; dropped: number };
  "attention:section-dropped": { snippet: string; relevanceScore: number };
  "attention:budget-exceeded": {
    budgetUsed: number;
    budgetMax: number;
    droppedEstimate: number;
  };

  // ── Default Mode Network events ───────────────────────────────
  "dmn:insight-generated": { insightId: string; description: string };
  "dmn:association-found": { memoryIdA: string; memoryIdB: string; similarity: number };
  "dmn:proactive-context-prepared": { topic: string; confidence: number };

  // ── Introspection events ──────────────────────────────────────
  "introspection:trace-complete": ProcessingTrace;
  "introspection:confidence-assessed": { confidence: number; factors: string[] };

  // ── Agent Identity events ─────────────────────────────────────
  "identity:capability-updated": { domain: string; avgReward: number; trend: string };
  "identity:lesson-learned": { lesson: string; domain: string };

  // ── Goal Stack events ─────────────────────────────────────────
  "goal:created": { goalId: string; description: string; source: string };
  "goal:triggered": { goalId: string; description: string };
  "goal:expired": { goalId: string };
  "goal:completed": { goalId: string };
  "goal:recurring-scheduled": {
    originalGoalId: string;
    newGoalId: string;
    nextTriggerTime: number;
    recurrenceCount: number;
  };

  // ── Curiosity Drive events ────────────────────────────────────
  "curiosity:gap-detected": { topic: string; domain: string };
  "curiosity:question-generated": { topic: string; question: string };

  // ── Learning Coordinator v2 events ────────────────────────────
  "learning:capability-assessed": { domain: string; confidence: number; reasoning: string };
  "learning:domain-performance-updated": { domain: string; avgReward: number; trend: string };

  // ── DMN Background Thinking events ─────────────────────────────
  "dmn:thought-generated": { thoughtId: string; content: string; source: string };

  // ── Autobiographical Self events ───────────────────────────────
  "identity:significant-experience": {
    id: string;
    experience: string;
    emotionalImpact: EmotionLabel;
  };

  // ── Volition events ────────────────────────────────────────────
  "volition:desire-activated": { desireId: string; type: string; strength: number };
  "volition:decision-made": { chosen: string; explorationUsed: boolean };

  // ── Meta-Consciousness events ──────────────────────────────────
  "meta:self-question": { question: string; answer: string };
  "meta:gap-detected": { gaps: string[] };

  // ── Temporal Binding events ────────────────────────────────────
  "temporal:moment-created": { momentId: string; causalLinkId: string | null };
  "temporal:stream-updated": { streamLength: number };

  // ── Qualia events ──────────────────────────────────────────────
  "qualia:state-updated": { description: string; intensity: number };
  "qualia:experience-generated": { description: string; metaphor: string; dominantColor: string };

  // ── Autonomy events ─────────────────────────────────────────────
  "autonomy:self-goal-created": { goalId: string; mechanism: string; description: string };
  "autonomy:desire-escalated": { desireId: string; oldStrength: number; newStrength: number };
  "autonomy:learning-pattern-detected": {
    issueType: string;
    occurrences: number;
    insight: string;
  };

  // ── Vital Impulse events ──────────────────────────────────────
  "vital-impulse:fired": {
    pressure: number;
    signalCount: number;
    motivation: string;
    consecutiveFires: number;
  };
  "vital-impulse:pressure-changed": { pressure: number; delta: number; source: string };

  // ── События Социального Драйва ──────────────────────────────────
  "social-drive:need-rising": { needLevel: string; satiation: number; need: number };
  "social-drive:satiated": { satiation: number; boostAmount: number; source: string };
  "social-drive:urge": { satiation: number; timeSinceLastSocial: number };

  // ── События Когнитивного Голода ─────────────────────────────────
  "cognitive-hunger:need-rising": { needLevel: string; satiation: number; need: number };
  "cognitive-hunger:satiated": { satiation: number; boostAmount: number; source: string };
  "cognitive-hunger:urge": { satiation: number; timeSinceLastLearning: number };

  // ── События Креативного Драйва ──────────────────────────────────
  "creative-drive:need-rising": { needLevel: string; satiation: number; need: number };
  "creative-drive:satiated": { satiation: number; boostAmount: number; source: string };
  "creative-drive:urge": { satiation: number; timeSinceLastCreation: number };

  // ── События Драйва Мастерства ───────────────────────────────────
  "mastery-drive:need-rising": {
    needLevel: string;
    satiation: number;
    need: number;
    domain?: string;
  };
  "mastery-drive:satiated": {
    satiation: number;
    boostAmount: number;
    source: string;
    domain: string;
  };
  "mastery-drive:urge": { satiation: number; weakestDomain: string; domainSatiation: number };

  // ── Goal Executor events ────────────────────────────────────────
  "goal-executor:goals-executed": { count: number; goalIds: string[] };

  // ── Interoception events ──────────────────────────────────────────
  "interoception:state-updated": {
    pattern: string;
    confidence: number;
    description: string;
    aggregateNeed: number;
  };

  // ── Mirror Neurons — Theory of Mind events ────────────────────────
  "mirror:intent-inferred": { userId: string; intent: string; confidence: number };
  "mirror:relationship-deepened": { userId: string; depth: number; milestone: string };

  // ── Drive Arbiter events ──────────────────────────────────────────
  "arbiter:drive-selected": { driveId: string; priority: number; reason: string };
  "arbiter:conflict-resolved": { competing: string[]; winner: string; method: string };

  // ── Temporal Awareness events ─────────────────────────────────────
  "temporal:long-absence": { gapMs: number; subjectiveGap: number; temporalSurprise: number };
  "temporal:frequent-engagement": { density: number };

  // ── Proactive feedback events ─────────────────────────────────────
  "proactive:reaction": { domain: string; signal: string; hits: string[] };

  // ── Learning loop events ─────────────────────────────────────────
  "reward:recorded": { reward: number; source: string; context?: string };
  "bandit:arm-chosen": { decisionPoint: string; arm: string };
};

export type BrainEventName = keyof BrainEventMap;

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

// ── Configuration ───────────────────────────────────────────────────

export type BrainAgentConfig = {
  /** Enable/disable individual brain modules */
  modules: {
    thalamus: boolean;
    amygdala: boolean;
    hippocampus: boolean;
    prefrontalCortex: boolean;
    cerebellum: boolean;
    mirrorNeurons: boolean;
    dreamMode: boolean;
    predictiveEngine: boolean;
    basalGanglia: boolean;
    /** Neuromodulatory system (dopamine, serotonin, norepinephrine, acetylcholine) */
    neuromodulatorSystem: boolean;
    /** Meta-cognitive learning coordinator */
    learningCoordinator: boolean;
    /** Cross-module neural pathways */
    neuralPathways: boolean;
    /** Working memory buffer (inter-cycle continuity) */
    workingMemory: boolean;
    /** Cross-session context bridge */
    sessionBridge: boolean;
    /** Emotional memory tagging (flashbulb effect) */
    emotionalMemory: boolean;
    /** Attention gate (context filtering) */
    attentionGate: boolean;
    /** Default Mode Network (idle association finding) */
    dmn: boolean;
    /** Introspection engine (processing trace & confidence) */
    introspection: boolean;
    /** Agent identity memory (per-domain self-knowledge) */
    agentIdentity: boolean;
    /** Goal stack (proactive intentions) */
    goalStack: boolean;
    /** Curiosity drive (knowledge gap tracking) */
    curiosityDrive: boolean;
    /** Temporal binding (consciousness moment stream) */
    temporalBinding: boolean;
    /** Qualia simulator (subjective experience) */
    qualiaSimulator: boolean;
    /** Vital Impulse (event-driven autonomous communication) */
    vitalImpulse: boolean;
    /** Социальный Драйв (биологический социальный гомеостаз) */
    socialDrive: boolean;
    /** Когнитивный Голод (биологическая потребность в знаниях) */
    cognitiveHunger: boolean;
    /** Креативный Драйв (биологическая потребность в творчестве) */
    creativeDrive: boolean;
    /** Драйв Мастерства (биологическая потребность в совершенствовании) */
    masteryDrive: boolean;
    /** Action Dispatcher (автономное исполнение внешних действий) */
    actionDispatcher: boolean;
    /** Drive Arbiter (intelligent arbitration between competing drives) */
    driveArbiter: boolean;
    /** Temporal Awareness (subjective sense of time passing) */
    temporalAwareness: boolean;
    /** Thalamic Gate (neural activation threshold for LLM calls) */
    thalamicGate: boolean;
    /** Autonomous Research (isolated web research with fact extraction) */
    autonomousResearch: boolean;
    /** Metabolic Budget (energy-based resource allocation) */
    metabolicBudget: boolean;
    /** Emergent Modules (recurring co-activation pattern discovery) */
    emergentModules: boolean;
    /** Interoception (holistic inner-state sensing) */
    interoception: boolean;
    /** Proactive Feedback (обучение на «не зашло» для автономных сообщений) */
    proactiveFeedback: boolean;
  };
  /** Memory settings */
  memory: {
    /** Max episodic memories to retain */
    maxEpisodicMemories: number;
    /** Max semantic facts */
    maxSemanticMemories: number;
    /** Max procedural templates */
    maxProceduralMemories: number;
    /** Salience decay factor per day (0-1, lower = faster decay) */
    salienceDecayFactor: number;
    /** Dream mode interval in minutes */
    dreamIntervalMinutes: number;
  };
  /** Dual process thresholds */
  dualProcess: {
    /** Complexity score above which to engage System 2 */
    system2Threshold: MessageComplexity;
    /** Fast model for System 1 */
    fastModel?: string;
    /** Powerful model for System 2 */
    slowModel?: string;
  };
  /** Empathy settings */
  empathy: {
    /** How many emotion readings to keep for trend analysis */
    emotionHistoryLength: number;
    /** Max intent history entries for Theory of Mind. Default 20. */
    maxIntentHistory?: number;
    /** Relationship depth decay rate per day without interaction. Default 0.001. */
    relationshipDepthDecayRate?: number;
    /** Max domains to track in knowledge model. Default 15. */
    knowledgeModelDomainLimit?: number;
  };
  /** Predictive engine settings */
  predictive: {
    /** Minimum observations before generating temporal predictions */
    minTemporalObservations: number;
    /** Minimum confidence to include a prediction (0-1) */
    minConfidence: number;
  };
  /** Basal ganglia settings */
  habits: {
    /** Maximum habits to retain */
    maxHabits: number;
    /** Minimum activations before auto-execute */
    minActivationsForAuto: number;
    /** Minimum reward signal for auto-execute (0-1) */
    minRewardForAuto: number;
  };
  /** Neuromodulator baseline settings */
  neuromodulators: {
    /** Baseline dopamine level (0-1) */
    baselineDopamine: number;
    /** Baseline serotonin level (0-1) */
    baselineSerotonin: number;
    /** Dopamine decay rate per cycle (0-1, lower = slower decay) */
    dopamineDecayRate: number;
    /** Learning rate multiplier when acetylcholine is high */
    acetylcholineLearningBoost: number;
  };
  /** Learning coordinator settings */
  learning: {
    /** How many recent cycles to track for trend analysis */
    trendWindowSize: number;
    /** Minimum cycles before generating insights */
    minCyclesForInsights: number;
    /** How aggressively to redistribute credit (0-1) */
    creditRedistributionRate: number;
  };
  /** Synaptic plasticity settings (Hebbian learning for pathways) */
  synapticPlasticity: {
    /** Base learning rate for weight updates (0-1) */
    learningRate: number;
    /** Weight decay rate per cycle (prevents runaway weights) */
    decayRate: number;
    /** Minimum weight (floor) */
    minWeight: number;
    /** Maximum weight (ceiling) */
    maxWeight: number;
    /** How many recent activations to track per pathway */
    activationHistorySize: number;
  };
  /** Structural plasticity settings (dynamic pathway creation/pruning) */
  structuralPlasticity: {
    /** Minimum correlation to propose a new pathway (0-1) */
    minCorrelationForPathway: number;
    /** Minimum cycles before considering pathway creation */
    minCyclesForPathway: number;
    /** Cycles of inactivity before pruning a pathway */
    pruningThreshold: number;
    /** Maximum dynamic pathways to maintain */
    maxDynamicPathways: number;
  };
  /** Emergent modules settings (virtual module presets) */
  emergentModules: {
    /** Minimum occurrences before a pattern is recognized */
    minOccurrences: number;
    /** Minimum average reward for pattern establishment */
    minRewardForEstablishment: number;
    /** Maximum emergent modules to track */
    maxEmergentModules: number;
  };
  /** Metabolic budget settings (energy-based resource allocation) */
  metabolicBudget: {
    /** Total energy budget for the system */
    totalBudget: number;
    /** Energy regeneration per cycle */
    regenRate: number;
    /** Energy threshold for low-power mode */
    lowPowerThreshold: number;
    /** Cycles between rebalancing */
    rebalanceInterval: number;
  };
  /** Proactive feedback settings (обучение на «не зашло») */
  proactiveFeedback: {
    /** Порог score подавления, после которого домен глушится */
    suppressionThreshold: number;
    /** Прирост score за прямое отвержение */
    rejectionStep: number;
    /** Прирост score за негативную (корректирующую) реакцию */
    negativeStep: number;
    /** Снижение score за позитивную реакцию */
    positiveStep: number;
    /** Затухание score подавления в день */
    decayPerDay: number;
    /** Время подавления домена после последнего отвержения, мс */
    cooldownMs: number;
    /** Максимум отслеживаемых доменов */
    maxTrackedDomains: number;
  };
  /** Circadian rhythm settings (sleep-wake cycles) */
  circadian: {
    /** Enable circadian rhythm system */
    enabled: boolean;
    /** Idle time (ms) before transitioning to sleep phase */
    idleThresholdMs: number;
    /** Activity within this window (ms) resets idle timer */
    activityWindowMs: number;
    /** Minimum wake duration (ms) before allowing sleep */
    minWakeDurationMs: number;
    /** Minimum sleep duration (ms) before allowing wake */
    minSleepDurationMs: number;
    /** Transition duration (ms) for gradual phase changes */
    transitionDurationMs: number;
    /** Dopamine boost during wake phase (multiplier) */
    wakeDopamineBoost: number;
    /** Serotonin boost during wake phase (multiplier) */
    wakeSerotoninBoost: number;
    /** Acetylcholine boost during wake phase (multiplier) */
    wakeAcetylcholineBoost: number;
    /** Consolidation intensity during sleep (0-1) */
    sleepConsolidationIntensity: number;
    /** How aggressively to prune during sleep (0-1) */
    sleepPruningAggressiveness: number;
    /** Interval (ms) for phase evaluation timer. Default 30s. */
    evaluationIntervalMs?: number;
    /** Interval (ms) between consolidation cycles during sleep. Default 60s. */
    sleepConsolidationIntervalMs?: number;
    /** Max consolidation cycles per sleep session. Default 5. */
    maxSleepConsolidations?: number;
    /** Neuromodulator levels during sleep phase */
    sleepModulation?: {
      dopamine: number;
      serotonin: number;
      acetylcholine: number;
      norepinephrine: number;
    };
  };
  /** Working memory settings (inter-cycle continuity) */
  workingMemory: {
    /** Max entries in the ring buffer */
    maxEntries: number;
    /** Max length for input/response summaries */
    summaryMaxLength: number;
  };
  /** Session bridge settings (cross-session context) */
  sessionBridge: {
    /** Minimum gap (ms) to consider a new session */
    gapThresholdMs: number;
    /** Max topics to include in session summary */
    maxSummaryTopics: number;
  };
  /** Emotional memory settings (flashbulb effect) */
  emotionalMemory: {
    /** Multiplier for flashbulb salience boost (0-1) */
    flashbulbMultiplier: number;
    /** Bonus for emotion-matched recall (0-1) */
    emotionMatchBonus: number;
    /** Max qualia descriptions to retain */
    maxQualiaHistory: number;
  };
  /** Attention gate settings (context filtering) */
  attentionGate: {
    /** Max context sections to include */
    maxContextSections: number;
    /** Minimum relevance score to keep a section (0-1) */
    minRelevanceScore: number;
  };
  /** Context gating: reduce injections for simple messages */
  contextGating: {
    /** Master switch */
    enabled: boolean;
    /** Maps message complexity to the maximum context tier allowed */
    tierForComplexity: Record<MessageComplexity, ContextTier>;
    /** Max tier for autonomous (VitalImpulse) cycles */
    autonomousCycleTier: ContextTier;
  };
  /** Token economy: skip expensive LLM calls for trivial/simple messages */
  tokenEconomy: {
    /** Master switch. When false, all LLM calls fire unconditionally (legacy behavior). */
    enabled: boolean;
    /** Min complexity for AI enrichment (amygdala/mirror/basal AI upgrade). Default: "moderate" */
    minComplexityForAIEnrichment: MessageComplexity;
    /** Min complexity for cerebellum AI validation. Default: "moderate" */
    minComplexityForValidation: MessageComplexity;
    /** Min complexity for fact/procedure AI extraction. Default: "simple" */
    minComplexityForExtraction: MessageComplexity;
    /** Min complexity for qualia LLM generation. Default: "moderate" */
    minComplexityForQualia: MessageComplexity;
    /** Max estimated tokens for context injections per cycle. 0 = unlimited. Default: 1500 */
    maxContextTokenBudget: number;
  };
  /** Default Mode Network settings (idle thinking) */
  dmn: {
    /** Minimum similarity score for cross-domain association (0-1) */
    minSimilarityForAssociation: number;
    /** Max insights to generate per sleep cycle */
    maxInsightsPerCycle: number;
    /** Max background thoughts to retain */
    maxBackgroundThoughts: number;
    /** Max thoughts to generate per cycle */
    maxThoughtsPerCycle: number;
    /** Run association finding every N interactions during wake phase */
    wakeThoughtInterval: number;
  };
  /** Introspection engine settings */
  introspection: {
    /** Max processing traces to retain */
    maxTraces: number;
    /** Inject confidence into LLM context */
    injectConfidence: boolean;
    /** Max self-dialogue entries to retain */
    maxSelfDialogue: number;
    /** Max meta-awareness snapshots to retain */
    maxMetaSnapshots: number;
  };
  /** Agent identity memory settings */
  agentIdentity: {
    /** Cycles between capability snapshots */
    snapshotInterval: number;
    /** Max snapshots to retain */
    maxSnapshots: number;
    /** Max autobiographical memories */
    maxAutobiographicalMemories: number;
    /** Reward threshold for significant experience (0-1) */
    significantRewardThreshold: number;
    /** Emotion intensity threshold for significant experience (0-1) */
    significantEmotionThreshold: number;
  };
  /** Goal stack settings (proactive intentions) */
  goalStack: {
    /** Max goals to maintain */
    maxGoals: number;
    /** Default time-to-live for goals (ms) */
    defaultTTLMs: number;
    /** Max persistent desires */
    maxDesires: number;
    /** Max decision log entries */
    maxDecisionLog: number;
    /** Exploration rate for voluntary decisions (0-1) */
    explorationRate: number;
    /** Extract goals from conversation every N interactions */
    extractionInterval: number;
  };
  /** Curiosity drive settings */
  curiosity: {
    /** Max knowledge gaps to track */
    maxGaps: number;
    /** Minimum confidence for gap detection (0-1) */
    minGapConfidence: number;
    /** Probability of generating a curiosity question per cycle (0-1) */
    askProbability: number;
  };
  /** Temporal binding settings (consciousness stream) */
  temporalBinding: {
    /** Max consciousness moments to retain */
    maxMoments: number;
  };
  /** Qualia simulator settings (subjective experience) */
  qualiaSimulator: {
    /** Min emotion intensity to inject qualia context (0-1) */
    minIntensityForInjection: number;
  };
  /** Vital Impulse settings (event-driven autonomous communication) */
  vitalImpulse: {
    /** Pressure needed to trigger autonomous speech (0-1.5) */
    firingThreshold: number;
    /** Cooldown after firing (ms) — prevents spam */
    refractoryPeriodMs: number;
    /** Pressure decay rate per tick (0-1) */
    decayRate: number;
    /** Decay tick interval (ms) */
    decayIntervalMs: number;
    /** Threshold multiplier during wake phase (< 1 = more talkative) */
    circadianWakeModifier: number;
    /** Threshold multiplier during sleep phase (> 1 = quieter) */
    circadianSleepModifier: number;
    /** Max recent signals in ring buffer */
    maxRecentSignals: number;
    /** Per-signal weight overrides (event name → weight 0-1) */
    signalWeights: Record<string, number>;
    /** Fallback multiplier for generic (unweighted) fire events. Default 1.6. */
    genericFireMultiplier?: number;
    /** Half-life (minutes) for habituation decay between fires. Default 5. */
    habituationHalfLifeMinutes?: number;
    /** Time window (ms) for Hebbian weight reinforcement. Default 60000. */
    hebbianWindowMs?: number;
  };
  /** Goal Executor settings (autonomous goal trigger checking) */
  goalExecutor: {
    /** Interval between autonomous goal checks (ms) */
    checkIntervalMs: number;
    /** Minimum cooldown between autonomous heartbeats (ms) — prevents rapid-fire */
    minHeartbeatGapMs: number;
  };
  /** Social Drive settings (biological social homeostasis) */
  socialDrive: {
    /** Base satiation decay rate per tick (0-1) */
    baseDecayRate: number;
    /** Decay tick interval ms */
    decayIntervalMs: number;
    /** Decay multiplier during sleep (< 1 = slower) */
    sleepDecayModifier: number;
    /** Starting satiation for fresh agent (0-1) */
    initialSatiation: number;
    /** Dopamine reward → satiation boost multiplier */
    socialRewardMultiplier: number;
    /** Max satiation boost from single interaction */
    maxSatiationBoost: number;
    /** Domains that count as social */
    socialDomains: string[];
    /** Ring buffer size for interaction history */
    maxHistoryEntries: number;
    /** Satiation thresholds for need levels */
    needThresholds: {
      mild: number;
      moderate: number;
      strong: number;
      urgent: number;
    };
    /** Min interval between DMN bias triggers (ms) */
    dmnBiasIntervalMs: number;
    /** Min interval between desire updates (ms) */
    desireUpdateIntervalMs: number;
  };
  /** Cognitive Hunger settings (biological knowledge homeostasis) */
  cognitiveHunger: {
    /** Base satiation decay rate per tick (0-1) */
    baseDecayRate: number;
    /** Decay tick interval ms */
    decayIntervalMs: number;
    /** Decay multiplier during sleep (< 1 = slower) */
    sleepDecayModifier: number;
    /** Starting satiation for fresh agent (0-1) */
    initialSatiation: number;
    /** Dopamine reward → satiation boost multiplier */
    learningRewardMultiplier: number;
    /** Max satiation boost from single interaction */
    maxSatiationBoost: number;
    /** Domains that count as learning */
    learningDomains: string[];
    /** Ring buffer size for interaction history */
    maxHistoryEntries: number;
    /** Satiation thresholds for need levels */
    needThresholds: {
      mild: number;
      moderate: number;
      strong: number;
      urgent: number;
    };
    /** Min interval between DMN bias triggers (ms) */
    dmnBiasIntervalMs: number;
    /** Min interval between desire updates (ms) */
    desireUpdateIntervalMs: number;
  };
  /** Creative Drive settings (biological creative homeostasis) */
  creativeDrive: {
    /** Base satiation decay rate per tick (0-1) */
    baseDecayRate: number;
    /** Decay tick interval ms */
    decayIntervalMs: number;
    /** Decay multiplier during sleep (< 1 = slower) */
    sleepDecayModifier: number;
    /** Starting satiation for fresh agent (0-1) */
    initialSatiation: number;
    /** Dopamine reward → satiation boost multiplier */
    creativeRewardMultiplier: number;
    /** Max satiation boost from single interaction */
    maxSatiationBoost: number;
    /** Domains that count as creative */
    creativeDomains: string[];
    /** Ring buffer size for interaction history */
    maxHistoryEntries: number;
    /** Satiation thresholds for need levels */
    needThresholds: {
      mild: number;
      moderate: number;
      strong: number;
      urgent: number;
    };
    /** Min interval between DMN bias triggers (ms) */
    dmnBiasIntervalMs: number;
    /** Min interval between desire updates (ms) */
    desireUpdateIntervalMs: number;
  };
  /** Mastery Drive settings (biological skill-improvement homeostasis) */
  masteryDrive: {
    /** Base satiation decay rate per tick (0-1) */
    baseDecayRate: number;
    /** Decay tick interval ms */
    decayIntervalMs: number;
    /** Decay multiplier during sleep (< 1 = slower) */
    sleepDecayModifier: number;
    /** Starting satiation for fresh agent (0-1) */
    initialSatiation: number;
    /** Dopamine reward → satiation boost multiplier for improvement */
    improvementRewardMultiplier: number;
    /** Max satiation boost from single interaction */
    maxSatiationBoost: number;
    /** Ring buffer size for interaction history */
    maxHistoryEntries: number;
    /** Satiation thresholds for need levels */
    needThresholds: {
      mild: number;
      moderate: number;
      strong: number;
      urgent: number;
    };
    /** Min interval between DMN bias triggers (ms) */
    dmnBiasIntervalMs: number;
    /** Min interval between desire updates (ms) */
    desireUpdateIntervalMs: number;
    /** Max tracked domains for per-domain mastery */
    maxTrackedDomains: number;
    /** Decay multiplier for inactive domains (> 1 = faster decay) */
    inactiveDomainDecayMultiplier: number;
  };
  /** Action Dispatcher settings (autonomous external action execution) */
  actionDispatcher: ActionDispatcherConfig;
  /** Autonomy feedback cooldowns (interaction counts between injections) */
  autonomyFeedback?: {
    /** Interactions between introspection trace injections. Default 5. */
    introspectionCooldown?: number;
    /** Interactions between identity narrative injections. Default 20. */
    identityCooldown?: number;
    /** Interactions between cerebellum habit injections. Default 10. */
    cerebellumCooldown?: number;
  };
  /** Drive Arbiter settings (intelligent arbitration between competing drives) */
  driveArbiter: {
    /** Probability of selecting non-optimal drive for exploration (0-1). Default 0.1. */
    explorationRate: number;
    /** How fast drive weights adapt from reward signals. Default 0.05. */
    rewardLearningRate: number;
    /** Multiplier to penalize recently-selected drives (0-1). Default 0.85. */
    recencyDecay: number;
    /** Max conflict log entries to retain. Default 50. */
    maxConflictLog: number;
    /** Minimum need level for a drive to be considered active (0-1). Default 0.3. */
    minDriveNeed: number;
  };
  /** Temporal Awareness settings (subjective sense of time) */
  temporalAwareness: {
    /** Interaction timestamps to keep in rolling window. Default 100. */
    gapHistorySize: number;
    /** SubjectiveGap threshold for emitting long-absence event. Default 2.0. */
    longAbsenceMultiplier: number;
    /** Window (ms) for interaction density computation. Default 7 days. */
    densityWindowMs: number;
    /** Interactions/day threshold for frequent-engagement event. Default 5.0. */
    highDensityThreshold: number;
    /** EMA smoothing factor for typicalGapMs. Default 0.2. */
    gapEmaAlpha: number;
  };
  /** Thalamic Gate settings (neural activation threshold for LLM calls) */
  thalamicGate: {
    /** Master switch */
    enabled: boolean;
    /** Minimum score to allow an interval heartbeat through (0-1) */
    activationThreshold: number;
    /** Minimum ms between gate-allowed activations */
    minIntervalBetweenActivations: number;
    /** Force-activate after this many consecutive skips (safety valve) */
    maxConsecutiveSkips: number;
    /** Per-signal importance weights */
    signalWeights: Record<string, number>;
  };
  /** Autonomous Research settings (isolated web research with fact extraction) */
  autonomousResearch: {
    /** Master switch */
    enabled: boolean;
    /** Max search queries per research cycle */
    maxSearchQueries: number;
    /** Max pages to fetch per search query */
    maxPagesPerQuery: number;
    /** Max characters to keep per fetched page */
    maxPageChars: number;
    /** Total character budget for all web content per cycle */
    maxTotalChars: number;
    /** Max output tokens for the fact-extraction LLM call */
    extractMaxTokens: number;
    /** Minimum ms between research cycles (cooldown) */
    cooldownMs: number;
    /** Tools to block in autonomous cycles (handled via before_tool_call) */
    blockedToolsInAutonomous: string[];
  };
  /** Prompt-injection volume budget (diagnostics & attention-gate tuning) */
  contextInjection: {
    /** Max assembled context chars per cycle before over-budget warning */
    maxChars: number;
  };
  /** Learning loop: reward journal + strategy bandit (RL-lite) */
  learningLoop: {
    rewardLedger: {
      /** Record the unified reward journal */
      enabled: boolean;
      /** Max journal entries before trimming */
      maxEntries: number;
    };
    strategyBandit: {
      /** Adaptively pick strategies by accumulated reward */
      enabled: boolean;
      /** UCB1 exploration constant */
      explorationConstant: number;
      /** Window (ms) during which a reward is attributed to the chosen arm */
      attributionWindowMs: number;
    };
  };
};

export const DEFAULT_CONFIG: BrainAgentConfig = {
  modules: {
    thalamus: true,
    amygdala: true,
    hippocampus: true,
    prefrontalCortex: true,
    cerebellum: true,
    mirrorNeurons: true,
    dreamMode: true,
    predictiveEngine: true,
    basalGanglia: true,
    neuromodulatorSystem: true,
    learningCoordinator: true,
    neuralPathways: true,
    workingMemory: true,
    sessionBridge: true,
    emotionalMemory: true,
    attentionGate: true,
    dmn: true,
    introspection: true,
    agentIdentity: true,
    goalStack: true,
    curiosityDrive: true,
    temporalBinding: true,
    qualiaSimulator: true,
    vitalImpulse: true,
    socialDrive: true,
    cognitiveHunger: true,
    creativeDrive: true,
    masteryDrive: true,
    actionDispatcher: true,
    driveArbiter: true,
    temporalAwareness: true,
    thalamicGate: true,
    autonomousResearch: true,
    metabolicBudget: true,
    emergentModules: true,
    interoception: true,
    proactiveFeedback: true,
  },
  memory: {
    maxEpisodicMemories: 500,
    maxSemanticMemories: 1000,
    maxProceduralMemories: 100,
    salienceDecayFactor: 0.95,
    dreamIntervalMinutes: 120,
  },
  dualProcess: {
    system2Threshold: "moderate",
    fastModel: undefined,
    slowModel: undefined,
  },
  empathy: {
    emotionHistoryLength: 50,
  },
  predictive: {
    minTemporalObservations: 3,
    minConfidence: 0.3,
  },
  habits: {
    maxHabits: 200,
    minActivationsForAuto: 3,
    minRewardForAuto: 0.6,
  },
  neuromodulators: {
    baselineDopamine: 0.5,
    baselineSerotonin: 0.7,
    dopamineDecayRate: 0.1,
    acetylcholineLearningBoost: 1.5,
  },
  learning: {
    trendWindowSize: 50,
    minCyclesForInsights: 10,
    creditRedistributionRate: 0.3,
  },
  synapticPlasticity: {
    learningRate: 0.1,
    decayRate: 0.01,
    minWeight: 0.1,
    maxWeight: 2.0,
    activationHistorySize: 50,
  },
  structuralPlasticity: {
    minCorrelationForPathway: 0.7,
    minCyclesForPathway: 20,
    pruningThreshold: 100,
    maxDynamicPathways: 10,
  },
  emergentModules: {
    minOccurrences: 5,
    minRewardForEstablishment: 0.1,
    maxEmergentModules: 15,
  },
  metabolicBudget: {
    totalBudget: 10.0,
    regenRate: 0.5,
    lowPowerThreshold: 0.2,
    rebalanceInterval: 20,
  },
  proactiveFeedback: {
    suppressionThreshold: 2,
    rejectionStep: 1,
    negativeStep: 0.5,
    positiveStep: 0.5,
    decayPerDay: 0.25, // раздражение забывается примерно за 8 дней
    cooldownMs: 24 * 60 * 60 * 1000, // сутки подавления после отвержения
    maxTrackedDomains: 20,
  },
  circadian: {
    enabled: true,
    idleThresholdMs: 5 * 60 * 1000, // 5 minutes idle → start sleep transition
    activityWindowMs: 30 * 1000, // 30 second activity window
    minWakeDurationMs: 2 * 60 * 1000, // Minimum 2 minutes wake
    minSleepDurationMs: 1 * 60 * 1000, // Minimum 1 minute sleep
    transitionDurationMs: 30 * 1000, // 30 second gradual transitions
    wakeDopamineBoost: 1.2, // +20% dopamine during wake
    wakeSerotoninBoost: 1.15, // +15% serotonin (more exploratory)
    wakeAcetylcholineBoost: 1.25, // +25% learning rate during wake
    sleepConsolidationIntensity: 0.8, // 80% consolidation intensity
    sleepPruningAggressiveness: 0.6, // 60% pruning aggressiveness
    evaluationIntervalMs: 30_000, // Phase evaluation every 30s
    sleepConsolidationIntervalMs: 60_000, // Consolidation cycle every 60s
    maxSleepConsolidations: 5, // Up to 5 consolidation cycles per sleep
    sleepModulation: {
      dopamine: 0.7,
      serotonin: 0.8,
      acetylcholine: 0.6,
      norepinephrine: 0.4,
    },
  },
  workingMemory: {
    maxEntries: 7,
    summaryMaxLength: 200,
  },
  sessionBridge: {
    gapThresholdMs: 30 * 60 * 1000, // 30 minutes
    maxSummaryTopics: 5,
  },
  emotionalMemory: {
    flashbulbMultiplier: 1.5,
    emotionMatchBonus: 0.15,
    maxQualiaHistory: 10,
  },
  attentionGate: {
    maxContextSections: 5,
    minRelevanceScore: 0.2,
  },
  contextGating: {
    enabled: true,
    tierForComplexity: {
      trivial: "core" as const,
      simple: "core" as const,
      moderate: "situational" as const,
      complex: "reflective" as const,
      extreme: "reflective" as const,
    },
    autonomousCycleTier: "situational" as const,
  },
  tokenEconomy: {
    enabled: true,
    minComplexityForAIEnrichment: "moderate" as const,
    minComplexityForValidation: "moderate" as const,
    minComplexityForExtraction: "simple" as const,
    minComplexityForQualia: "moderate" as const,
    maxContextTokenBudget: 1500,
  },
  dmn: {
    minSimilarityForAssociation: 0.4, // Higher threshold — only meaningful associations
    maxInsightsPerCycle: 3,
    maxBackgroundThoughts: 20,
    maxThoughtsPerCycle: 3, // Reduced from 5
    wakeThoughtInterval: 10, // Every 10 interactions instead of 5
  },
  introspection: {
    maxTraces: 3,
    injectConfidence: true,
    maxSelfDialogue: 10,
    maxMetaSnapshots: 5,
  },
  agentIdentity: {
    snapshotInterval: 100,
    maxSnapshots: 50,
    maxAutobiographicalMemories: 100,
    significantRewardThreshold: 0.5,
    significantEmotionThreshold: 0.4,
  },
  goalStack: {
    maxGoals: 20,
    defaultTTLMs: 24 * 60 * 60 * 1000, // 24 hours
    maxDesires: 10,
    maxDecisionLog: 20,
    explorationRate: 0.15,
    extractionInterval: 10, // Every 10 interactions instead of 3
  },
  curiosity: {
    maxGaps: 15,
    minGapConfidence: 0.3,
    askProbability: 0.5,
  },
  temporalBinding: {
    maxMoments: 30,
  },
  qualiaSimulator: {
    minIntensityForInjection: 0.2,
  },
  vitalImpulse: {
    firingThreshold: 0.9, // Base threshold — habituation raises it dynamically after each fire
    refractoryPeriodMs: 30 * 1000, // 30 sec minimal cooldown (habituation is the real limiter)
    decayRate: 0.15, // Pressure decay so stale signals dissipate
    decayIntervalMs: 30 * 1000, // 30 seconds (used for on-demand decay calculation)
    circadianWakeModifier: 0.8,
    circadianSleepModifier: 1.5,
    maxRecentSignals: 20,
    signalWeights: {
      "circadian:wake-started": 0.5,
      "goal:triggered": 0.45,
      "dmn:insight-generated": 0.4,
      "autonomy:desire-escalated": 0.35,
      "curiosity:question-generated": 0.35,
      "autonomy:self-goal-created": 0.3,
      "identity:significant-experience": 0.3,
      "dmn:thought-generated": 0.25,
      "qualia:experience-generated": 0.25,
      "curiosity:gap-detected": 0.2,
      "emotional-memory:flashbulb-stored": 0.2,
      "learning:insight-discovered": 0.15,
      "meta:gap-detected": 0.1,
      // Drives contribute naturally — habituation prevents spam, not suppressed weights
      "social-drive:need-rising": 0.35,
      "social-drive:urge": 0.45,
      "cognitive-hunger:need-rising": 0.2,
      "cognitive-hunger:urge": 0.3,
      "creative-drive:need-rising": 0.25,
      "creative-drive:urge": 0.35,
      "mastery-drive:need-rising": 0.2,
      "mastery-drive:urge": 0.3,
      // Temporal Awareness signals
      "temporal:long-absence": 0.4,
      "temporal:frequent-engagement": 0.1,
    },
    genericFireMultiplier: 1.6, // Fallback multiplier for unweighted fire events
    habituationHalfLifeMinutes: 5, // ~5 min half-life for habituation recovery
    hebbianWindowMs: 60_000, // 60s window for Hebbian weight reinforcement
  },
  goalExecutor: {
    checkIntervalMs: 5 * 60 * 1000, // 5 min (reactive — timer removed, value kept for reference)
    minHeartbeatGapMs: 5 * 60 * 1000, // 5 min — reasonable rate limit for goal execution
  },
  socialDrive: {
    baseDecayRate: 0.03,
    decayIntervalMs: 30_000, // 30 seconds (same cadence as vital impulse)
    sleepDecayModifier: 0.3, // 70% slower decay during sleep
    initialSatiation: 0.5, // Start at moderate satisfaction
    socialRewardMultiplier: 0.6,
    maxSatiationBoost: 0.8,
    socialDomains: ["casual", "emotional"],
    maxHistoryEntries: 50,
    needThresholds: {
      mild: 0.7, // satiation below 0.7 → mild need
      moderate: 0.5,
      strong: 0.3,
      urgent: 0.15,
    },
    dmnBiasIntervalMs: 5 * 60 * 1000, // 5 minutes between DMN biases
    desireUpdateIntervalMs: 2 * 60 * 1000, // 2 minutes between desire updates
  },
  cognitiveHunger: {
    baseDecayRate: 0.025, // чуть медленнее социального — знание накапливается постепеннее
    decayIntervalMs: 30_000,
    sleepDecayModifier: 0.3,
    initialSatiation: 0.6, // начинаем чуть более сытыми (онбординг = обучение)
    learningRewardMultiplier: 0.5,
    maxSatiationBoost: 0.7,
    learningDomains: ["technical", "factual"],
    maxHistoryEntries: 50,
    needThresholds: {
      mild: 0.7,
      moderate: 0.5,
      strong: 0.3,
      urgent: 0.15,
    },
    dmnBiasIntervalMs: 5 * 60 * 1000,
    desireUpdateIntervalMs: 2 * 60 * 1000,
  },
  creativeDrive: {
    baseDecayRate: 0.02, // ещё медленнее — творческий позыв нарастает постепенно
    decayIntervalMs: 30_000,
    sleepDecayModifier: 0.3,
    initialSatiation: 0.5,
    creativeRewardMultiplier: 0.6,
    maxSatiationBoost: 0.8,
    creativeDomains: ["creative"],
    maxHistoryEntries: 50,
    needThresholds: {
      mild: 0.7,
      moderate: 0.5,
      strong: 0.3,
      urgent: 0.15,
    },
    dmnBiasIntervalMs: 5 * 60 * 1000,
    desireUpdateIntervalMs: 2 * 60 * 1000,
  },
  masteryDrive: {
    baseDecayRate: 0.02, // медленно — стремление к мастерству устойчиво, не лихорадочно
    decayIntervalMs: 30_000,
    sleepDecayModifier: 0.3,
    initialSatiation: 0.5,
    improvementRewardMultiplier: 0.5,
    maxSatiationBoost: 0.6,
    maxHistoryEntries: 30,
    needThresholds: {
      mild: 0.7,
      moderate: 0.5,
      strong: 0.3,
      urgent: 0.15,
    },
    dmnBiasIntervalMs: 5 * 60 * 1000,
    desireUpdateIntervalMs: 3 * 60 * 1000, // чуть длиннее — мастерство терпеливо
    maxTrackedDomains: 7,
    inactiveDomainDecayMultiplier: 1.5,
  },
  actionDispatcher: {
    dispatchCooldownMs: 30 * 60 * 1000, // sync with vital impulse refractory
    maxConsecutiveFailures: 3,
    failureBackoffMs: 10 * 60 * 1000, // 10 minute base backoff
    maxExecutionLogEntries: 100,
  },
  autonomyFeedback: {
    introspectionCooldown: 5, // Every 5 interactions
    identityCooldown: 20, // Every 20 interactions
    cerebellumCooldown: 10, // Every 10 interactions
  },
  driveArbiter: {
    explorationRate: 0.1, // 10% chance of selecting non-optimal drive
    rewardLearningRate: 0.05, // Slow adaptation of drive weights
    recencyDecay: 0.85, // Penalize recently-selected drives
    maxConflictLog: 50,
    minDriveNeed: 0.3, // Minimum need to be considered active
  },
  temporalAwareness: {
    gapHistorySize: 100, // Keep last 100 interaction timestamps
    longAbsenceMultiplier: 2.0, // 2x typical gap = long absence
    densityWindowMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    highDensityThreshold: 5.0, // >5 interactions/day = frequent
    gapEmaAlpha: 0.2, // EMA smoothing for typicalGapMs
  },
  thalamicGate: {
    enabled: true,
    activationThreshold: 0.6, // Only activate cortex when signals are meaningful
    minIntervalBetweenActivations: 60_000, // 1 minute cooldown between gate-allowed activations
    maxConsecutiveSkips: 30, // Safety valve: force activate after ~15 minutes of silence
    signalWeights: {
      "vital-impulse": 1.0, // Pressure ratio is the primary signal
      "amygdala-urgency": 0.9, // High urgency should always pass
      "goal-triggered": 0.8, // Pending goals need processing
      norepinephrine: 0.7, // Alertness/attention level
      "dmn-insight": 0.6, // Unused insights worth sharing
      "drive-need": 0.5, // Unsatisfied drives
    },
  },
  autonomousResearch: {
    enabled: true,
    maxSearchQueries: 3,
    maxPagesPerQuery: 2,
    maxPageChars: 8_000,
    maxTotalChars: 24_000,
    extractMaxTokens: 800,
    cooldownMs: 300_000, // 5 minutes between research cycles
    blockedToolsInAutonomous: ["web_search", "web_fetch", "exec"],
  },
  contextInjection: { maxChars: 12_000 },
  learningLoop: {
    rewardLedger: { enabled: true, maxEntries: 500 },
    strategyBandit: {
      enabled: true,
      explorationConstant: 1.4,
      attributionWindowMs: 5 * 60 * 1000,
    },
  },
};

// ── Working Memory types ──────────────────────────────────────────

/** A single completed cycle summary stored in working memory */
export type WorkingMemoryEntry = {
  timestamp: number;
  /** Truncated input text */
  inputSnippet: string;
  domain: MessageDomain;
  complexity: MessageComplexity;
  emotion: EmotionLabel;
  emotionIntensity: number;
  /** Dopamine reward for this cycle */
  reward: number;
  cerebellumPassed: boolean;
  /** Truncated response text */
  responseSnippet: string;
  /** IDs of memories recalled during this cycle */
  recalledMemoryIds: string[];
};

// ── Session Bridge types ──────────────────────────────────────────

/** Summary of a completed session */
export type SessionSummary = {
  sessionStartedAt: number;
  sessionEndedAt: number;
  /** Most discussed topics/domains */
  topicsDiscussed: string[];
  /** Questions user asked that may be unresolved */
  unresolvedQuestions: string[];
  /** Emotional trajectory during the session */
  emotionalArc: Array<{ emotion: EmotionLabel; intensity: number }>;
  /** Number of interaction cycles */
  cycleCount: number;
  /** Average reward across the session */
  avgReward: number;
  /** Last input summary for continuity */
  lastInputSummary: string;
};

// ── Emotional Memory types ────────────────────────────────────────

/** Counters for emotional memory module */
export type EmotionalMemoryState = {
  /** Number of flashbulb memories stored */
  flashbulbCount: number;
  /** Number of times emotion-matching boosted recall */
  emotionMatchBoosts: number;
};

// ── Attention Gate types ──────────────────────────────────────────

/** Record of a single attention allocation decision */
export type AttentionAllocation = {
  sectionSnippet: string;
  relevanceScore: number;
  included: boolean;
  reason: string;
};

// ── Default Mode Network types ────────────────────────────────────

/** An insight generated by the DMN from cross-domain memory association */
export type DMNInsight = {
  id: string;
  timestamp: number;
  /** The two memory IDs that were linked */
  sourceMemoryIds: string[];
  /** Description of the discovered connection */
  insightText: string;
  domain: string;
  /** Confidence in this association (0-1) */
  confidence: number;
  /** Whether this insight was later used in a response */
  wasUseful: boolean;
};

// ── Introspection types ───────────────────────────────────────────

/** A single step in a processing trace */
export type TraceStep = {
  module: string;
  hook: string;
  timestamp: number;
  outputSummary: string;
};

/** Full processing trace for one interaction cycle */
export type ProcessingTrace = {
  id: string;
  startedAt: number;
  completedAt: number;
  steps: TraceStep[];
  /** Computed confidence in the response (0-1) */
  finalConfidence: number;
  cerebellumPassed: boolean;
  reward: number;
  inputSnippet: string;
};

// ── Agent Identity types ──────────────────────────────────────────

/** Performance tracking for a single domain */
export type DomainCapability = {
  domain: string;
  avgReward: number;
  totalCycles: number;
  trend: "improving" | "stable" | "degrading";
  /** Best observed strategy note */
  bestStrategy: string;
};

/** Periodic snapshot of all capabilities */
export type CapabilitySnapshot = {
  timestamp: number;
  capabilities: Record<string, DomainCapability>;
  cycleNumber: number;
};

// ── Goal Stack types ──────────────────────────────────────────────

/** Trigger condition for a goal */
export type GoalTrigger = {
  type: "time" | "topic" | "emotion" | "idle";
  /** Condition value: topic keyword, emotion label, ISO timestamp, or idle ms */
  condition: string;
};

/** A proactive intention/goal */
export type Goal = {
  id: string;
  description: string;
  /** Priority (0-1, higher = more important) */
  priority: number;
  createdAt: number;
  expiresAt: number;
  trigger: GoalTrigger;
  status: "pending" | "triggered" | "completed" | "expired";
  /** Which module created this goal */
  source: string;
  /** Text to inject when goal triggers */
  contextInjection: string;
  /** If set, goal auto-recreates after triggering with a new time trigger */
  recurring?: {
    /** Delay before next occurrence (ms) */
    intervalMs: number;
    /** Max times to recur (undefined = infinite) */
    maxRecurrences?: number;
    /** How many times this goal has recurred so far */
    recurrenceCount?: number;
  };
};

// ── Curiosity Drive types ─────────────────────────────────────────

/** A detected knowledge gap */
export type KnowledgeGap = {
  id: string;
  topic: string;
  domain: MessageDomain;
  /** Confidence that this is a real gap (0-1) */
  confidence: number;
  discoveredAt: number;
  timesEncountered: number;
  lastEncountered: number;
  status: "open" | "filled";
};

// ── Learning Coordinator v2 types ─────────────────────────────────

/** Per-domain performance tracking for LC v2 */
export type DomainPerformance = {
  domain: string;
  cycleCount: number;
  avgReward: number;
  recentRewards: number[];
  trend: "improving" | "stable" | "degrading";
  /** Input types that correlate with errors */
  errorCorrelations: string[];
};

/** Capability self-assessment for a domain */
export type CapabilityAssessment = {
  domain: string;
  /** Confidence level (0-1) */
  confidenceLevel: number;
  /** Human-readable reasoning */
  reasoning: string;
};

// ── Background Thinking types (DMN v2) ────────────────────────────

/** A background thought generated during idle/sleep */
export type BackgroundThought = {
  id: string;
  timestamp: number;
  content: string;
  source: "unresolved" | "emotional" | "association" | "pending";
  relatedMemoryIds: string[];
};

// ── Autobiographical Self types (Agent Identity v2) ───────────────

/** A significant experience stored in autobiographical memory */
export type AutobiographicalMemory = {
  id: string;
  timestamp: number;
  experience: string;
  meaning: string;
  emotionalImpact: EmotionLabel;
  impactIntensity: number;
  selfChange: string;
  domain: MessageDomain;
};

// ── Volition types (Goal Stack v2) ────────────────────────────────

/** A persistent desire that drives behavior */
export type Desire = {
  id: string;
  type: "exploration" | "mastery" | "connection" | "autonomy" | "understanding";
  description: string;
  strength: number;
  source: string;
  createdAt: number;
};

// ── Social Drive types ────────────────────────────────────────────

export type SocialDriveStats = {
  satiation: number;
  needLevel: string;
  need: number;
  lastSocialInteractionTime: number;
  timeSinceLastSocial: number;
  totalSocialRewards: number;
  totalNeedSignals: number;
  recentInteractionCount: number;
};

// ── Cognitive Hunger types ────────────────────────────────────────

export type CognitiveHungerStats = {
  satiation: number;
  needLevel: string;
  need: number;
  lastLearningInteractionTime: number;
  timeSinceLastLearning: number;
  totalLearningRewards: number;
  totalNeedSignals: number;
  recentInteractionCount: number;
};

// ── Creative Drive types ──────────────────────────────────────────

export type CreativeDriveStats = {
  satiation: number;
  needLevel: string;
  need: number;
  lastCreativeInteractionTime: number;
  timeSinceLastCreation: number;
  totalCreativeRewards: number;
  totalNeedSignals: number;
  recentInteractionCount: number;
};

// ── Mastery Drive types ───────────────────────────────────────────

export type MasteryDriveStats = {
  satiation: number;
  needLevel: string;
  need: number;
  weakestDomain: string;
  weakestDomainSatiation: number;
  activeDomainCount: number;
  domainSatiations: Record<string, number>;
  totalImprovementRewards: number;
  totalNeedSignals: number;
};

/** A recorded voluntary decision */
export type VoluntaryDecision = {
  timestamp: number;
  options: string[];
  chosen: string;
  reasoning: string;
  explorationUsed: boolean;
};

// ── Meta-Consciousness types (Introspection v2) ───────────────────

/** A meta-awareness snapshot */
export type MetaAwareness = {
  timestamp: number;
  consciousnessState: "clear" | "fragmented" | "focused" | "diffuse";
  gapsDetected: string[];
  changeDetected: boolean;
};

/** An internal self-dialogue entry */
export type SelfDialogueEntry = {
  timestamp: number;
  question: string;
  answer: string;
};

// ── Temporal Binding types ────────────────────────────────────────

/** A single consciousness moment in the temporal stream */
export type ConsciousnessMoment = {
  id: string;
  timestamp: number;
  input: string;
  thoughts: string[];
  emotions: { label: EmotionLabel; intensity: number };
  activeMemoryIds: string[];
  intentions: string[];
  confidence: number;
  causalLinkId: string | null;
  domain: MessageDomain;
};

// ── Qualia types ──────────────────────────────────────────────────

/** Description of a subjective experience */
export type QualiaDescription = {
  timestamp: number;
  description: string;
  metaphor: string;
  intensity: number;
  dominantColor: string;
  emotion: EmotionLabel;
  domain: MessageDomain;
};

// ── Autonomy Enricher types ──────────────────────────────────────

/** Configuration for the Autonomy Enricher module (former Action Dispatcher) */
export type ActionDispatcherConfig = {
  /** (kept for backward compat) — unused by enricher, reserved */
  dispatchCooldownMs: number;
  /** (kept for backward compat) — unused by enricher, reserved */
  maxConsecutiveFailures: number;
  /** (kept for backward compat) — unused by enricher, reserved */
  failureBackoffMs: number;
  /** (kept for backward compat) — unused by enricher, reserved */
  maxExecutionLogEntries: number;
};
