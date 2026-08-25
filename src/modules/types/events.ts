import type {
  ThalamusClassification,
  AmygdalaAssessment,
  UserModel,
  EmotionLabel,
  MemoryLayer,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
} from "./core.ts";
import type {
  DopamineSignal,
  NeuromodulatorState,
  LearningCycleReport,
  LearningInsight,
  PathwayName,
  ModuleName,
  CircadianPhase,
} from "./neuro.ts";
import type { SessionSummary, ProcessingTrace } from "./rest.ts";

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
