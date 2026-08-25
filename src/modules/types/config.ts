import type { MessageComplexity, ContextTier } from "./core.ts";
import type { ActionDispatcherConfig } from "./rest.ts";

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
