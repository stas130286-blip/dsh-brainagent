// src/index.ts
import { mkdirSync as mkdirSync31 } from "node:fs";
import { createUserMessage as createUserMessage3 } from "@deepseek-ai/dsh-llm";
import "@deepseek-ai/dsh-commands";

// src/modules/host-config.ts
var ENV_PROVIDERS = [
  { key: "deepseek", apiKeyVar: "DEEPSEEK_API_KEY", baseUrlVar: "DEEPSEEK_BASE_URL" },
  { key: "openai", apiKeyVar: "OPENAI_API_KEY", baseUrlVar: "OPENAI_BASE_URL" },
  { key: "anthropic", apiKeyVar: "ANTHROPIC_API_KEY", baseUrlVar: "ANTHROPIC_BASE_URL" },
  { key: "google", apiKeyVar: "GOOGLE_API_KEY", baseUrlVar: "GOOGLE_BASE_URL" },
  { key: "openrouter", apiKeyVar: "OPENROUTER_API_KEY", baseUrlVar: "OPENROUTER_BASE_URL" },
  { key: "groq", apiKeyVar: "GROQ_API_KEY", baseUrlVar: "GROQ_BASE_URL" },
  { key: "ollama", apiKeyVar: "OLLAMA_API_KEY", baseUrlVar: "OLLAMA_BASE_URL" }
];
function buildHostConfig(options = {}) {
  const env = process.env;
  const providers = {};
  for (const spec of ENV_PROVIDERS) {
    const apiKey = env[spec.apiKeyVar];
    const baseUrl = spec.baseUrlVar ? env[spec.baseUrlVar] : void 0;
    if (apiKey || baseUrl) {
      providers[spec.key] = { apiKey, baseUrl };
    }
  }
  for (const [key, entry] of Object.entries(options.providers ?? {})) {
    providers[key] = { ...providers[key], ...entry };
  }
  const config = { models: { providers } };
  if (options.model) {
    config.agents = { defaults: { model: options.model } };
  }
  return config;
}

// src/modules/event-bus.ts
var CorpusCallosum = class {
  listeners = [];
  recentSignals = /* @__PURE__ */ new Map();
  /**
   * Subscribe to a brain signal.
   * Higher priority listeners execute first.
   */
  on(event, handler, priority = 0) {
    const entry = {
      event,
      handler,
      priority
    };
    this.listeners.push(entry);
    this.listeners.sort((a, b) => b.priority - a.priority);
    return () => {
      const idx = this.listeners.indexOf(entry);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }
  /**
   * Emit a brain signal to all subscribers.
   * Errors in individual listeners are caught and logged, not propagated.
   */
  async emit(event, data) {
    this.recentSignals.set(event, { data, timestamp: Date.now() });
    const matching = this.listeners.filter((l) => l.event === event);
    await Promise.allSettled(matching.map((l) => Promise.resolve(l.handler(data))));
  }
  /**
   * Synchronous emit for hot paths where we can't afford async overhead.
   */
  emitSync(event, data) {
    this.recentSignals.set(event, { data, timestamp: Date.now() });
    for (const l of this.listeners) {
      if (l.event !== event) continue;
      try {
        l.handler(data);
      } catch {
      }
    }
  }
  /**
   * Get the most recent signal of a given type (useful for modules that
   * activate after the signal was already emitted in this cycle).
   */
  getLastSignal(event, maxAgeMs = 3e4) {
    const entry = this.recentSignals.get(event);
    if (!entry) return void 0;
    if (Date.now() - entry.timestamp > maxAgeMs) return void 0;
    return entry.data;
  }
  /** Clear all signals older than maxAgeMs. Called periodically. */
  gc(maxAgeMs = 6e4) {
    const now = Date.now();
    for (const [key, val] of this.recentSignals) {
      if (now - val.timestamp > maxAgeMs) {
        this.recentSignals.delete(key);
      }
    }
  }
};
var bus = new CorpusCallosum();

// src/plugin/config.ts
import { homedir } from "node:os";
import { join } from "node:path";
import Schema from "@deepseek-ai/schemastery";

// src/modules/types.ts
var DEFAULT_CONFIG = {
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
    proactiveFeedback: true
  },
  memory: {
    maxEpisodicMemories: 500,
    maxSemanticMemories: 1e3,
    maxProceduralMemories: 100,
    salienceDecayFactor: 0.95,
    dreamIntervalMinutes: 120
  },
  dualProcess: {
    system2Threshold: "moderate",
    fastModel: void 0,
    slowModel: void 0
  },
  empathy: {
    emotionHistoryLength: 50
  },
  predictive: {
    minTemporalObservations: 3,
    minConfidence: 0.3
  },
  habits: {
    maxHabits: 200,
    minActivationsForAuto: 3,
    minRewardForAuto: 0.6
  },
  neuromodulators: {
    baselineDopamine: 0.5,
    baselineSerotonin: 0.7,
    dopamineDecayRate: 0.1,
    acetylcholineLearningBoost: 1.5
  },
  learning: {
    trendWindowSize: 50,
    minCyclesForInsights: 10,
    creditRedistributionRate: 0.3
  },
  synapticPlasticity: {
    learningRate: 0.1,
    decayRate: 0.01,
    minWeight: 0.1,
    maxWeight: 2,
    activationHistorySize: 50
  },
  structuralPlasticity: {
    minCorrelationForPathway: 0.7,
    minCyclesForPathway: 20,
    pruningThreshold: 100,
    maxDynamicPathways: 10
  },
  emergentModules: {
    minOccurrences: 5,
    minRewardForEstablishment: 0.1,
    maxEmergentModules: 15
  },
  metabolicBudget: {
    totalBudget: 10,
    regenRate: 0.5,
    lowPowerThreshold: 0.2,
    rebalanceInterval: 20
  },
  proactiveFeedback: {
    suppressionThreshold: 2,
    rejectionStep: 1,
    negativeStep: 0.5,
    positiveStep: 0.5,
    decayPerDay: 0.25,
    // раздражение забывается примерно за 8 дней
    cooldownMs: 24 * 60 * 60 * 1e3,
    // сутки подавления после отвержения
    maxTrackedDomains: 20
  },
  circadian: {
    enabled: true,
    idleThresholdMs: 5 * 60 * 1e3,
    // 5 minutes idle → start sleep transition
    activityWindowMs: 30 * 1e3,
    // 30 second activity window
    minWakeDurationMs: 2 * 60 * 1e3,
    // Minimum 2 minutes wake
    minSleepDurationMs: 1 * 60 * 1e3,
    // Minimum 1 minute sleep
    transitionDurationMs: 30 * 1e3,
    // 30 second gradual transitions
    wakeDopamineBoost: 1.2,
    // +20% dopamine during wake
    wakeSerotoninBoost: 1.15,
    // +15% serotonin (more exploratory)
    wakeAcetylcholineBoost: 1.25,
    // +25% learning rate during wake
    sleepConsolidationIntensity: 0.8,
    // 80% consolidation intensity
    sleepPruningAggressiveness: 0.6,
    // 60% pruning aggressiveness
    evaluationIntervalMs: 3e4,
    // Phase evaluation every 30s
    sleepConsolidationIntervalMs: 6e4,
    // Consolidation cycle every 60s
    maxSleepConsolidations: 5,
    // Up to 5 consolidation cycles per sleep
    sleepModulation: {
      dopamine: 0.7,
      serotonin: 0.8,
      acetylcholine: 0.6,
      norepinephrine: 0.4
    }
  },
  workingMemory: {
    maxEntries: 7,
    summaryMaxLength: 200
  },
  sessionBridge: {
    gapThresholdMs: 30 * 60 * 1e3,
    // 30 minutes
    maxSummaryTopics: 5
  },
  emotionalMemory: {
    flashbulbMultiplier: 1.5,
    emotionMatchBonus: 0.15,
    maxQualiaHistory: 10
  },
  attentionGate: {
    maxContextSections: 5,
    minRelevanceScore: 0.2
  },
  contextGating: {
    enabled: true,
    tierForComplexity: {
      trivial: "core",
      simple: "core",
      moderate: "situational",
      complex: "reflective",
      extreme: "reflective"
    },
    autonomousCycleTier: "situational"
  },
  tokenEconomy: {
    enabled: true,
    minComplexityForAIEnrichment: "moderate",
    minComplexityForValidation: "moderate",
    minComplexityForExtraction: "simple",
    minComplexityForQualia: "moderate",
    maxContextTokenBudget: 1500
  },
  dmn: {
    minSimilarityForAssociation: 0.4,
    // Higher threshold — only meaningful associations
    maxInsightsPerCycle: 3,
    maxBackgroundThoughts: 20,
    maxThoughtsPerCycle: 3,
    // Reduced from 5
    wakeThoughtInterval: 10
    // Every 10 interactions instead of 5
  },
  introspection: {
    maxTraces: 3,
    injectConfidence: true,
    maxSelfDialogue: 10,
    maxMetaSnapshots: 5
  },
  agentIdentity: {
    snapshotInterval: 100,
    maxSnapshots: 50,
    maxAutobiographicalMemories: 100,
    significantRewardThreshold: 0.5,
    significantEmotionThreshold: 0.4
  },
  goalStack: {
    maxGoals: 20,
    defaultTTLMs: 24 * 60 * 60 * 1e3,
    // 24 hours
    maxDesires: 10,
    maxDecisionLog: 20,
    explorationRate: 0.15,
    extractionInterval: 10
    // Every 10 interactions instead of 3
  },
  curiosity: {
    maxGaps: 15,
    minGapConfidence: 0.3,
    askProbability: 0.5
  },
  temporalBinding: {
    maxMoments: 30
  },
  qualiaSimulator: {
    minIntensityForInjection: 0.2
  },
  vitalImpulse: {
    firingThreshold: 0.9,
    // Base threshold — habituation raises it dynamically after each fire
    refractoryPeriodMs: 30 * 1e3,
    // 30 sec minimal cooldown (habituation is the real limiter)
    decayRate: 0.15,
    // Pressure decay so stale signals dissipate
    decayIntervalMs: 30 * 1e3,
    // 30 seconds (used for on-demand decay calculation)
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
      "temporal:frequent-engagement": 0.1
    },
    genericFireMultiplier: 1.6,
    // Fallback multiplier for unweighted fire events
    habituationHalfLifeMinutes: 5,
    // ~5 min half-life for habituation recovery
    hebbianWindowMs: 6e4
    // 60s window for Hebbian weight reinforcement
  },
  goalExecutor: {
    checkIntervalMs: 5 * 60 * 1e3,
    // 5 min (reactive — timer removed, value kept for reference)
    minHeartbeatGapMs: 5 * 60 * 1e3
    // 5 min — reasonable rate limit for goal execution
  },
  socialDrive: {
    baseDecayRate: 0.03,
    decayIntervalMs: 3e4,
    // 30 seconds (same cadence as vital impulse)
    sleepDecayModifier: 0.3,
    // 70% slower decay during sleep
    initialSatiation: 0.5,
    // Start at moderate satisfaction
    socialRewardMultiplier: 0.6,
    maxSatiationBoost: 0.8,
    socialDomains: ["casual", "emotional"],
    maxHistoryEntries: 50,
    needThresholds: {
      mild: 0.7,
      // satiation below 0.7 → mild need
      moderate: 0.5,
      strong: 0.3,
      urgent: 0.15
    },
    dmnBiasIntervalMs: 5 * 60 * 1e3,
    // 5 minutes between DMN biases
    desireUpdateIntervalMs: 2 * 60 * 1e3
    // 2 minutes between desire updates
  },
  cognitiveHunger: {
    baseDecayRate: 0.025,
    // чуть медленнее социального — знание накапливается постепеннее
    decayIntervalMs: 3e4,
    sleepDecayModifier: 0.3,
    initialSatiation: 0.6,
    // начинаем чуть более сытыми (онбординг = обучение)
    learningRewardMultiplier: 0.5,
    maxSatiationBoost: 0.7,
    learningDomains: ["technical", "factual"],
    maxHistoryEntries: 50,
    needThresholds: {
      mild: 0.7,
      moderate: 0.5,
      strong: 0.3,
      urgent: 0.15
    },
    dmnBiasIntervalMs: 5 * 60 * 1e3,
    desireUpdateIntervalMs: 2 * 60 * 1e3
  },
  creativeDrive: {
    baseDecayRate: 0.02,
    // ещё медленнее — творческий позыв нарастает постепенно
    decayIntervalMs: 3e4,
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
      urgent: 0.15
    },
    dmnBiasIntervalMs: 5 * 60 * 1e3,
    desireUpdateIntervalMs: 2 * 60 * 1e3
  },
  masteryDrive: {
    baseDecayRate: 0.02,
    // медленно — стремление к мастерству устойчиво, не лихорадочно
    decayIntervalMs: 3e4,
    sleepDecayModifier: 0.3,
    initialSatiation: 0.5,
    improvementRewardMultiplier: 0.5,
    maxSatiationBoost: 0.6,
    maxHistoryEntries: 30,
    needThresholds: {
      mild: 0.7,
      moderate: 0.5,
      strong: 0.3,
      urgent: 0.15
    },
    dmnBiasIntervalMs: 5 * 60 * 1e3,
    desireUpdateIntervalMs: 3 * 60 * 1e3,
    // чуть длиннее — мастерство терпеливо
    maxTrackedDomains: 7,
    inactiveDomainDecayMultiplier: 1.5
  },
  actionDispatcher: {
    dispatchCooldownMs: 30 * 60 * 1e3,
    // sync with vital impulse refractory
    maxConsecutiveFailures: 3,
    failureBackoffMs: 10 * 60 * 1e3,
    // 10 minute base backoff
    maxExecutionLogEntries: 100
  },
  autonomyFeedback: {
    introspectionCooldown: 5,
    // Every 5 interactions
    identityCooldown: 20,
    // Every 20 interactions
    cerebellumCooldown: 10
    // Every 10 interactions
  },
  driveArbiter: {
    explorationRate: 0.1,
    // 10% chance of selecting non-optimal drive
    rewardLearningRate: 0.05,
    // Slow adaptation of drive weights
    recencyDecay: 0.85,
    // Penalize recently-selected drives
    maxConflictLog: 50,
    minDriveNeed: 0.3
    // Minimum need to be considered active
  },
  temporalAwareness: {
    gapHistorySize: 100,
    // Keep last 100 interaction timestamps
    longAbsenceMultiplier: 2,
    // 2x typical gap = long absence
    densityWindowMs: 7 * 24 * 60 * 60 * 1e3,
    // 7 days
    highDensityThreshold: 5,
    // >5 interactions/day = frequent
    gapEmaAlpha: 0.2
    // EMA smoothing for typicalGapMs
  },
  thalamicGate: {
    enabled: true,
    activationThreshold: 0.6,
    // Only activate cortex when signals are meaningful
    minIntervalBetweenActivations: 6e4,
    // 1 minute cooldown between gate-allowed activations
    maxConsecutiveSkips: 30,
    // Safety valve: force activate after ~15 minutes of silence
    signalWeights: {
      "vital-impulse": 1,
      // Pressure ratio is the primary signal
      "amygdala-urgency": 0.9,
      // High urgency should always pass
      "goal-triggered": 0.8,
      // Pending goals need processing
      norepinephrine: 0.7,
      // Alertness/attention level
      "dmn-insight": 0.6,
      // Unused insights worth sharing
      "drive-need": 0.5
      // Unsatisfied drives
    }
  },
  autonomousResearch: {
    enabled: true,
    maxSearchQueries: 3,
    maxPagesPerQuery: 2,
    maxPageChars: 8e3,
    maxTotalChars: 24e3,
    extractMaxTokens: 800,
    cooldownMs: 3e5,
    // 5 minutes between research cycles
    blockedToolsInAutonomous: ["web_search", "web_fetch", "exec"]
  },
  contextInjection: { maxChars: 12e3 },
  learningLoop: {
    rewardLedger: { enabled: true, maxEntries: 500 },
    strategyBandit: {
      enabled: true,
      explorationConstant: 1.4,
      attributionWindowMs: 5 * 60 * 1e3
    }
  }
};

// src/modules/autonomy-markers.ts
var AUTONOMOUS_TAG = "<autonomous-intent>";
var AUTONOMOUS_TAG_PREFIX = "<autonomous-intent";
var AUTONOMOUS_FRAMING_LINES = [
  "\u042D\u0442\u043E \u043D\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F, \u0430 \u0442\u0432\u043E\u044F \u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u0430\u044F \u0438\u043D\u0438\u0446\u0438\u0430\u0442\u0438\u0432\u0430: \u043D\u0438\u0436\u0435 \u2014 \u0442\u043E, \u0447\u0442\u043E \u0442\u044B \u0441\u0430\u043C \u0445\u043E\u0447\u0435\u0448\u044C \u0441\u043A\u0430\u0437\u0430\u0442\u044C.",
  "\u041E\u0431\u0440\u0430\u0442\u0438\u0441\u044C \u043A \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u043E\u0442 \u0441\u0435\u0431\u044F, \u043A\u043E\u0440\u043E\u0442\u043A\u043E \u0438 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E. \u041D\u0435 \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0439 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u043C\u0435\u0445\u0430\u043D\u0438\u0437\u043C\u044B."
];
var AUTONOMOUS_FRAME_PREFIX = AUTONOMOUS_FRAMING_LINES[0];
function isAutonomousInput(text) {
  const trimmed = text.trimStart();
  if (trimmed.startsWith(AUTONOMOUS_TAG_PREFIX)) return true;
  return trimmed.startsWith(AUTONOMOUS_FRAME_PREFIX) && trimmed.includes(AUTONOMOUS_TAG_PREFIX);
}

// src/plugin/config.ts
var Config = Schema.object({
  dataDir: Schema.string().default(join(homedir(), ".brainagent")),
  model: Schema.string().description("Model for internal LLM enrichment (provider/model form)"),
  providers: Schema.dict(
    Schema.object({
      apiKey: Schema.string(),
      baseUrl: Schema.string()
    })
  ).default({}),
  modules: Schema.object({
    thalamus: Schema.boolean().default(true),
    amygdala: Schema.boolean().default(true),
    hippocampus: Schema.boolean().default(true),
    prefrontalCortex: Schema.boolean().default(true),
    cerebellum: Schema.boolean().default(true),
    workingMemory: Schema.boolean().default(true),
    attentionGate: Schema.boolean().default(true),
    mirrorNeurons: Schema.boolean().default(true).description("Empathy: user model & style learning"),
    predictiveEngine: Schema.boolean().default(true).description("Interaction pattern anticipation"),
    basalGanglia: Schema.boolean().default(true).description("Habit formation & reinforcement"),
    neuromodulatorSystem: Schema.boolean().default(true).description("Dopamine reward distribution"),
    learningCoordinator: Schema.boolean().default(true).description("Meta-cognitive learning stats"),
    neuralPathways: Schema.boolean().default(true).description("Cross-module co-activation pathways"),
    structuralPlasticity: Schema.boolean().default(true).description("Dynamic pathway creation/pruning"),
    emotionalMemory: Schema.boolean().default(true).description("Flashbulb emotional tagging"),
    semanticExtraction: Schema.boolean().default(true).description("Fact extraction at turn end"),
    proceduralExtraction: Schema.boolean().default(true).description("Workflow extraction at turn end"),
    aiEnrichment: Schema.boolean().default(true).description("LLM-powered enrichment (ctx.llm with env fallback)"),
    sessionBridge: Schema.boolean().default(true).description("Cross-session continuity summaries"),
    dmn: Schema.boolean().default(true).description("Default Mode Network \u2014 idle background thinking"),
    goalStack: Schema.boolean().default(true).description("Proactive goals, desires & volition"),
    curiosityDrive: Schema.boolean().default(true).description("Knowledge-gap curiosity exploration"),
    vitalImpulse: Schema.boolean().default(true).description("Proactive impulse pressure & firing"),
    socialDrive: Schema.boolean().default(true).description("Biological social homeostasis drive"),
    cognitiveHunger: Schema.boolean().default(true).description("Learning/knowledge hunger drive"),
    creativeDrive: Schema.boolean().default(true).description("Creative expression drive"),
    masteryDrive: Schema.boolean().default(true).description("Skill mastery drive"),
    driveArbiter: Schema.boolean().default(true).description("Arbitration between competing drives"),
    autonomyEnricher: Schema.boolean().default(true).description("Memory-driven autonomy enrichment"),
    autonomousResearch: Schema.boolean().default(true).description("Isolated web research pipeline"),
    dreamMode: Schema.boolean().default(true).description("Background memory consolidation"),
    introspection: Schema.boolean().default(true).description("Processing traces & confidence self-assessment"),
    agentIdentity: Schema.boolean().default(true).description("Per-domain self-knowledge & autobiographical memory"),
    temporalBinding: Schema.boolean().default(true).description("Consciousness moment stream"),
    qualiaSimulator: Schema.boolean().default(true).description("Subjective experience simulation"),
    temporalAwareness: Schema.boolean().default(true).description("Subjective sense of time passing"),
    thalamicGate: Schema.boolean().default(true).description("Neural activation threshold stats"),
    metabolicBudget: Schema.boolean().default(true).description("Metabolic budget \u2014 energy-based resource allocation"),
    emergentModules: Schema.boolean().default(true).description("Emergent modules \u2014 recurring co-activation patterns"),
    interoception: Schema.boolean().default(true).description("Interoception \u2014 holistic inner-state sensing"),
    proactiveFeedback: Schema.boolean().default(true).description("Proactive feedback \u2014 learning from rejected proactive messages"),
    commands: Schema.boolean().default(true).description("/brain diagnostics command")
  }).default({
    thalamus: true,
    amygdala: true,
    hippocampus: true,
    prefrontalCortex: true,
    cerebellum: true,
    workingMemory: true,
    attentionGate: true,
    mirrorNeurons: true,
    predictiveEngine: true,
    basalGanglia: true,
    neuromodulatorSystem: true,
    learningCoordinator: true,
    neuralPathways: true,
    structuralPlasticity: true,
    emotionalMemory: true,
    semanticExtraction: true,
    proceduralExtraction: true,
    aiEnrichment: true,
    sessionBridge: true,
    dmn: true,
    goalStack: true,
    curiosityDrive: true,
    vitalImpulse: true,
    socialDrive: true,
    cognitiveHunger: true,
    creativeDrive: true,
    masteryDrive: true,
    driveArbiter: true,
    autonomyEnricher: true,
    autonomousResearch: true,
    dreamMode: true,
    introspection: true,
    agentIdentity: true,
    temporalBinding: true,
    qualiaSimulator: true,
    temporalAwareness: true,
    thalamicGate: true,
    metabolicBudget: true,
    emergentModules: true,
    interoception: true,
    proactiveFeedback: true,
    commands: true
  }),
  circadian: Schema.object({
    enabled: Schema.boolean().default(true).description("Sleep-wake cycle simulation")
  }).default({ enabled: true }),
  dualProcess: Schema.object({
    fastModel: Schema.string().description("System 1 fast model (provider/model)"),
    slowModel: Schema.string().description("System 2 slow model (provider/model)")
  }),
  recall: Schema.object({
    episodicLimit: Schema.number().default(3),
    semanticLimit: Schema.number().default(5)
  }).default({ episodicLimit: 3, semanticLimit: 5 }),
  contextInjection: Schema.object({
    maxChars: Schema.number().default(12e3).description("Over-budget warning threshold for assembled prompt-injection chars")
  }).default({ maxChars: 12e3 }),
  learningLoop: Schema.object({
    rewardLedger: Schema.object({
      enabled: Schema.boolean().default(true),
      maxEntries: Schema.number().default(500)
    }).default({ enabled: true, maxEntries: 500 }),
    strategyBandit: Schema.object({
      enabled: Schema.boolean().default(true),
      explorationConstant: Schema.number().default(1.4),
      attributionWindowMs: Schema.number().default(5 * 60 * 1e3)
    }).default({ enabled: true, explorationConstant: 1.4, attributionWindowMs: 5 * 60 * 1e3 })
  }).default({
    rewardLedger: { enabled: true, maxEntries: 500 },
    strategyBandit: { enabled: true, explorationConstant: 1.4, attributionWindowMs: 5 * 60 * 1e3 }
  }),
  autonomousMinGapMs: Schema.number().default(10 * 60 * 1e3).description("Minimum gap between proactive (autonomous) messages, ms")
});
var MODULE_FLAG_MAP = {
  autonomyEnricher: "actionDispatcher"
};
function mergeBrainConfig(config) {
  const modules = { ...DEFAULT_CONFIG.modules };
  for (const [key, value] of Object.entries(config.modules)) {
    if (typeof value !== "boolean") continue;
    const target = MODULE_FLAG_MAP[key] ?? key;
    if (target in modules) modules[target] = value;
  }
  return {
    ...DEFAULT_CONFIG,
    modules,
    dualProcess: {
      ...DEFAULT_CONFIG.dualProcess,
      ...config.dualProcess?.fastModel ? { fastModel: config.dualProcess.fastModel } : {},
      ...config.dualProcess?.slowModel ? { slowModel: config.dualProcess.slowModel } : {}
    },
    circadian: {
      ...DEFAULT_CONFIG.circadian,
      enabled: config.circadian.enabled
    },
    contextInjection: {
      ...DEFAULT_CONFIG.contextInjection,
      ...config.contextInjection
    },
    learningLoop: {
      rewardLedger: {
        ...DEFAULT_CONFIG.learningLoop.rewardLedger,
        ...config.learningLoop?.rewardLedger ?? {}
      },
      strategyBandit: {
        ...DEFAULT_CONFIG.learningLoop.strategyBandit,
        ...config.learningLoop?.strategyBandit ?? {}
      }
    }
  };
}
function textOfContent(content) {
  const parts = [];
  for (const block of content) {
    if (block !== null && typeof block === "object" && block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n");
}
var COMPLEXITY_ORDER = {
  trivial: 0,
  simple: 1,
  moderate: 2,
  complex: 3,
  extreme: 4
};
function meetsComplexityThreshold(actual, required, urgency) {
  if (!actual) return true;
  if (urgency !== void 0 && urgency >= 0.7) return true;
  return COMPLEXITY_ORDER[actual] >= COMPLEXITY_ORDER[required];
}
function truncateText(text, maxLength = 200) {
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}

// src/modules/hippocampus.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join2 } from "node:path";

// src/modules/llm-client.ts
var LLM_REQUEST_TIMEOUT_MS = 6e4;
async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
function parseUserModelSelection(config) {
  const agents = config.agents;
  const modelCfg = agents?.defaults?.model;
  const primary = typeof modelCfg === "string" ? modelCfg : modelCfg?.primary;
  if (!primary || typeof primary !== "string") return null;
  const trimmed = primary.trim();
  const slashIdx = trimmed.indexOf("/");
  if (slashIdx <= 0) return null;
  return {
    provider: trimmed.slice(0, slashIdx).toLowerCase(),
    model: trimmed.slice(slashIdx + 1)
  };
}
var DEFAULT_BASE_URLS = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  deepseek: "https://api.deepseek.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1"
};
var PROVIDER_NAMES = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  deepseek: "DeepSeek",
  openrouter: "OpenRouter",
  groq: "Groq",
  ollama: "Ollama"
};
function buildProviderConfig(providerKey, entry, model) {
  const apiKey = entry.apiKey ?? "";
  const name2 = PROVIDER_NAMES[providerKey] ?? providerKey;
  if (providerKey === "anthropic") {
    if (!apiKey) return null;
    return {
      name: name2,
      apiKey,
      baseUrl: entry.baseUrl ?? DEFAULT_BASE_URLS.anthropic,
      model,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      bodyFormat: "anthropic"
    };
  }
  if (providerKey === "google") {
    if (!apiKey) return null;
    return {
      name: name2,
      apiKey,
      baseUrl: DEFAULT_BASE_URLS.google,
      model,
      headers: { "Content-Type": "application/json" },
      bodyFormat: "openai"
    };
  }
  if (providerKey === "ollama") {
    if (!entry.baseUrl) return null;
    return {
      name: name2,
      apiKey: "",
      baseUrl: entry.baseUrl,
      model,
      headers: { "Content-Type": "application/json" },
      bodyFormat: "openai"
    };
  }
  if (!apiKey) return null;
  return {
    name: name2,
    apiKey,
    baseUrl: entry.baseUrl ?? DEFAULT_BASE_URLS[providerKey] ?? "https://api.openai.com/v1",
    model,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    bodyFormat: "openai"
  };
}
var FALLBACK_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-haiku-20240307",
  google: "gemini-1.5-flash",
  deepseek: "deepseek-chat",
  openrouter: "anthropic/claude-3-haiku",
  groq: "llama-3.1-8b-instant",
  ollama: "llama3.2"
};
function resolveProvider(config) {
  const providers = config.models?.providers;
  if (!providers) return null;
  const userSelection = parseUserModelSelection(config);
  if (userSelection) {
    const entry = providers[userSelection.provider];
    if (entry) {
      const result = buildProviderConfig(userSelection.provider, entry, userSelection.model);
      if (result) return result;
    }
  }
  const fallbackOrder = [
    "openai",
    "anthropic",
    "google",
    "deepseek",
    "openrouter",
    "groq",
    "ollama"
  ];
  for (const key of fallbackOrder) {
    const entry = providers[key];
    if (!entry) continue;
    const model = FALLBACK_MODELS[key];
    if (!model) continue;
    const result = buildProviderConfig(key, entry, model);
    if (result) return result;
  }
  return null;
}
function createLLMClient() {
  let callBackend;
  let availabilityHook;
  function setCallLLMBackend2(fn) {
    callBackend = fn;
  }
  function setAIAvailabilityHook2(fn) {
    availabilityHook = fn;
  }
  function isAIProviderAvailable3(config) {
    return (availabilityHook?.() ?? false) || resolveProvider(config) !== null;
  }
  async function callLLM2(systemPrompt, userText, config, logger, maxTokens = 500) {
    if (callBackend) {
      try {
        const bridged = await callBackend(systemPrompt, userText, config, logger, maxTokens);
        if (bridged !== void 0) return bridged;
      } catch (error) {
        logger?.info(`BrainAgent LLM: bridge failed, falling back \u2014 ${String(error)}`);
      }
    }
    const provider = resolveProvider(config);
    if (!provider) {
      logger?.info("BrainAgent LLM: no AI provider configured, skipping");
      return null;
    }
    const userSelection = parseUserModelSelection(config);
    if (userSelection) {
      logger?.info(`BrainAgent LLM: calling ${provider.name} (${provider.model}) [user-selected]`);
    } else {
      logger?.info(
        `BrainAgent LLM: calling ${provider.name} (${provider.model}) [auto-detected]`
      );
    }
    try {
      let response;
      if (provider.bodyFormat === "anthropic") {
        response = await fetchWithTimeout(`${provider.baseUrl}/messages`, {
          method: "POST",
          headers: provider.headers,
          body: JSON.stringify({
            model: provider.model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: "user", content: userText }]
          })
        });
      } else if (provider.name === "Google") {
        const url = `${provider.baseUrl}/models/${provider.model}:generateContent?key=${provider.apiKey}`;
        response = await fetchWithTimeout(url, {
          method: "POST",
          headers: provider.headers,
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${systemPrompt}

${userText}` }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: maxTokens
            }
          })
        });
        if (response.ok) {
          const data2 = await response.json();
          return data2.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
        }
        const errorText = await response.text();
        logger?.info(`BrainAgent LLM: Google error ${response.status}: ${errorText}`);
        return null;
      } else {
        response = await fetchWithTimeout(`${provider.baseUrl}/chat/completions`, {
          method: "POST",
          headers: provider.headers,
          body: JSON.stringify({
            model: provider.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userText }
            ],
            temperature: 0.1,
            max_tokens: maxTokens
          })
        });
      }
      if (!response.ok) {
        const errorText = await response.text();
        logger?.info(`BrainAgent LLM: ${provider.name} error ${response.status}: ${errorText}`);
        return null;
      }
      const data = await response.json();
      if (provider.bodyFormat === "anthropic") {
        return data.content?.[0]?.text ?? null;
      }
      return data.choices?.[0]?.message?.content ?? null;
    } catch (error) {
      logger?.info(`BrainAgent LLM: error \u2014 ${String(error)}`);
      return null;
    }
  }
  return { setCallLLMBackend: setCallLLMBackend2, setAIAvailabilityHook: setAIAvailabilityHook2, isAIProviderAvailable: isAIProviderAvailable3, callLLM: callLLM2 };
}
var active = null;
function current() {
  if (!active) active = createLLMClient();
  return active;
}
function setCallLLMBackend(fn) {
  current().setCallLLMBackend(fn);
}
function setAIAvailabilityHook(fn) {
  current().setAIAvailabilityHook(fn);
}
function isAIProviderAvailable(config) {
  return current().isAIProviderAvailable(config);
}
async function callLLM(systemPrompt, userText, config, logger, maxTokens = 500) {
  return current().callLLM(systemPrompt, userText, config, logger, maxTokens);
}

// src/modules/ai-embeddings.ts
var EMBEDDING_MODELS = {
  openai: { model: "text-embedding-3-small", format: "openai" },
  google: { model: "text-embedding-004", format: "google" },
  ollama: { model: "nomic-embed-text", format: "openai" },
  openrouter: { model: "openai/text-embedding-3-small", format: "openai" }
};
var EMBEDDING_BASE_URLS = {
  openai: "https://api.openai.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  openrouter: "https://openrouter.ai/api/v1"
};
var EMBEDDING_PROVIDER_NAMES = {
  openai: "OpenAI",
  google: "Google",
  ollama: "Ollama",
  openrouter: "OpenRouter"
};
var DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
function buildEmbeddingConfig(providerKey, entry) {
  const spec = EMBEDDING_MODELS[providerKey];
  if (!spec) return null;
  const apiKey = entry.apiKey ?? "";
  const name2 = EMBEDDING_PROVIDER_NAMES[providerKey] ?? providerKey;
  if (providerKey === "ollama") {
    return {
      name: "Ollama",
      apiKey: "",
      baseUrl: entry.baseUrl ?? DEFAULT_OLLAMA_BASE_URL,
      model: spec.model,
      headers: { "Content-Type": "application/json" },
      format: spec.format
    };
  }
  if (providerKey === "google") {
    if (!apiKey) return null;
    return {
      name: "Google",
      apiKey,
      baseUrl: EMBEDDING_BASE_URLS.google,
      model: spec.model,
      headers: { "Content-Type": "application/json" },
      format: spec.format
    };
  }
  if (!apiKey) return null;
  return {
    name: name2,
    apiKey,
    baseUrl: entry.baseUrl ?? EMBEDDING_BASE_URLS[providerKey] ?? "https://api.openai.com/v1",
    model: spec.model,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    format: spec.format
  };
}
function resolveEmbeddingProvider(config) {
  const providers = config.models?.providers;
  if (!providers) return null;
  const userSelection = parseUserModelSelection(config);
  if (userSelection) {
    const entry = providers[userSelection.provider];
    if (entry) {
      const result = buildEmbeddingConfig(userSelection.provider, entry);
      if (result) return result;
    }
  }
  const fallbackOrder = ["openai", "google", "ollama", "openrouter"];
  for (const key of fallbackOrder) {
    const entry = providers[key] ?? (key === "ollama" ? { baseUrl: DEFAULT_OLLAMA_BASE_URL } : void 0);
    if (!entry) continue;
    const result = buildEmbeddingConfig(key, entry);
    if (result) return result;
  }
  return null;
}
async function fetchOpenAIEmbeddings(texts, provider, logger) {
  const response = await fetch(`${provider.baseUrl}/embeddings`, {
    method: "POST",
    headers: provider.headers,
    body: JSON.stringify({
      model: provider.model,
      input: texts
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    logger?.info(
      `BrainAgent Embeddings: ${provider.name} API error ${response.status}: ${errorText}`
    );
    return null;
  }
  const data = await response.json();
  if (!data.data || data.data.length === 0) return null;
  const embeddings = data.data.map((d) => d.embedding).filter((e) => Array.isArray(e));
  if (embeddings.length !== texts.length) return null;
  return embeddings;
}
async function fetchGoogleEmbeddings(texts, provider, logger) {
  const url = `${provider.baseUrl}/models/${provider.model}:batchEmbedContents?key=${provider.apiKey}`;
  const requests = texts.map((text) => ({
    model: `models/${provider.model}`,
    content: { parts: [{ text }] }
  }));
  const response = await fetch(url, {
    method: "POST",
    headers: provider.headers,
    body: JSON.stringify({ requests })
  });
  if (!response.ok) {
    const errorText = await response.text();
    logger?.info(`BrainAgent Embeddings: Google API error ${response.status}: ${errorText}`);
    return null;
  }
  const data = await response.json();
  if (!data.embeddings) return null;
  const embeddings = data.embeddings.map((e) => e.values).filter((v) => Array.isArray(v));
  if (embeddings.length !== texts.length) return null;
  return embeddings;
}
function createAIEmbeddings() {
  let ollamaUnreachable = false;
  async function getEmbeddings(texts, config, logger) {
    const provider = resolveEmbeddingProvider(config);
    if (!provider) {
      return null;
    }
    if (provider.name === "Ollama" && ollamaUnreachable) {
      return null;
    }
    if (texts.length === 0) return [];
    try {
      const result = provider.format === "google" ? await fetchGoogleEmbeddings(texts, provider, logger) : await fetchOpenAIEmbeddings(texts, provider, logger);
      if (result === null && provider.name === "Ollama") {
        ollamaUnreachable = true;
      }
      return result;
    } catch (error) {
      logger?.info(`BrainAgent Embeddings: ${provider.name} error \u2014 ${String(error)}`);
      if (provider.name === "Ollama") ollamaUnreachable = true;
      return null;
    }
  }
  async function getEmbedding2(text, config, logger) {
    const result = await getEmbeddings([text], config, logger);
    return result?.[0] ?? null;
  }
  return { getEmbedding: getEmbedding2, getEmbeddings };
}
var active2 = null;
function current2() {
  if (!active2) active2 = createAIEmbeddings();
  return active2;
}
async function getEmbedding(text, config, logger) {
  return current2().getEmbedding(text, config, logger);
}
function embeddingCosineSimilarity(a, b) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// src/modules/vector-engine.ts
var STOPWORDS = /* @__PURE__ */ new Set([
  // Russian
  "\u0438",
  "\u0432",
  "\u043D\u0430",
  "\u043D\u0435",
  "\u0447\u0442\u043E",
  "\u043E\u043D",
  "\u043E\u043D\u0430",
  "\u043E\u043D\u0438",
  "\u044D\u0442\u043E",
  "\u0441",
  "\u043F\u043E",
  "\u043D\u043E",
  "\u043A\u0430\u043A",
  "\u0438\u0437",
  "\u0437\u0430",
  "\u043A",
  "\u0443",
  "\u043E\u0442",
  "\u0434\u043E",
  "\u0434\u043B\u044F",
  "\u0432\u0441\u0435",
  "\u0435\u0433\u043E",
  "\u0435\u0451",
  "\u0438\u0445",
  "\u0442\u0430\u043A",
  "\u0442\u043E",
  "\u0436\u0435",
  "\u0431\u044B",
  "\u043C\u044B",
  "\u0432\u044B",
  "\u0435\u0449\u0451",
  "\u0443\u0436\u0435",
  "\u0438\u043B\u0438",
  "\u043D\u0438",
  "\u0434\u0430",
  "\u043D\u0435\u0442",
  "\u0431\u044B\u043B",
  "\u0431\u044B\u043B\u0430",
  "\u0431\u044B\u043B\u0438",
  "\u0431\u044B\u0442\u044C",
  "\u0435\u0441\u0442\u044C",
  "\u0435\u0441\u043B\u0438",
  "\u043F\u0440\u0438",
  "\u0447\u0435\u043C",
  "\u0433\u0434\u0435",
  "\u043A\u043E\u0433\u0434\u0430",
  "\u043A\u0442\u043E",
  "\u0432\u043E\u0442",
  "\u0442\u043E\u0436\u0435",
  "\u0441\u0435\u0431\u044F",
  "\u0441\u0432\u043E\u0439",
  "\u0442\u043E\u043B\u044C\u043A\u043E",
  "\u0431\u0443\u0434\u0435\u0442",
  "\u0431\u044B\u043B\u043E",
  "\u043E\u0447\u0435\u043D\u044C",
  "\u043C\u043E\u0436\u043D\u043E",
  "\u043D\u0443\u0436\u043D\u043E",
  "\u043D\u0430\u0434\u043E",
  "\u044D\u0442\u043E\u0442",
  "\u0442\u043E\u0442",
  "\u0442\u0430\u043A\u043E\u0439",
  "\u043A\u0430\u043A\u043E\u0439",
  "\u043A\u043E\u0442\u043E\u0440\u044B\u0439",
  // English
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "need",
  "dare",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "about",
  "like",
  "through",
  "after",
  "over",
  "between",
  "out",
  "against",
  "during",
  "without",
  "before",
  "under",
  "around",
  "among",
  "it",
  "he",
  "she",
  "they",
  "we",
  "you",
  "i",
  "me",
  "him",
  "her",
  "us",
  "them",
  "my",
  "your",
  "his",
  "its",
  "our",
  "their",
  "this",
  "that",
  "these",
  "those",
  "and",
  "but",
  "or",
  "nor",
  "not",
  "so",
  "very",
  "just",
  "also",
  "than",
  "then",
  "now",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "only",
  "same",
  "if",
  "what",
  "which",
  "who"
]);
function stem(word) {
  const w = word.toLowerCase();
  const ruSuffixes = [
    "\u0442\u044C\u0441\u044F",
    "\u0442\u0441\u044F",
    "\u0435\u043D\u0438\u0435",
    "\u0430\u043D\u0438\u044F",
    "\u043E\u0441\u0442\u044C",
    "\u043D\u043E\u0433\u043E",
    "\u043D\u043E\u0439",
    "\u043D\u044B\u0445",
    "\u0430\u0442\u044C",
    "\u044F\u0442\u044C",
    "\u0438\u0442\u044C",
    "\u0435\u0442\u044C",
    "\u043E\u0432\u0430",
    "\u0435\u0432\u0430",
    "\u0430\u043C\u0438",
    "\u044F\u043C\u0438",
    "\u043E\u0433\u043E",
    "\u043E\u043C\u0443",
    "\u043E\u043C\u0443",
    "\u044B\u043C\u0438",
    "\u0438\u043C\u0438",
    "\u043D\u0438\u0439",
    "\u043D\u0438\u0435",
    "\u0446\u0438\u0438",
    "\u0435\u043C",
    "\u0435\u0439",
    "\u043E\u0432",
    "\u0435\u0439",
    "\u0438\u0435",
    "\u044B\u0435",
    "\u0438\u0439",
    "\u044B\u0439",
    "\u043E\u0439",
    "\u0430\u044F",
    "\u044F\u044F",
    "\u0443\u044E",
    "\u044E\u044E",
    "\u0430\u0445",
    "\u044F\u0445",
    "\u043E\u043C",
    "\u0430\u043C",
    "\u0442\u044C",
    "\u0435\u0442",
    "\u0438\u0442",
    "\u0443\u0442",
    "\u044E\u0442",
    "\u0430\u043B",
    "\u0438\u043B",
    "\u0435\u043B"
  ];
  for (const suffix of ruSuffixes) {
    if (w.length > suffix.length + 3 && w.endsWith(suffix)) {
      return w.slice(0, -suffix.length);
    }
  }
  const enSuffixes = [
    "ization",
    "ation",
    "ness",
    "ment",
    "able",
    "ible",
    "ting",
    "ing",
    "ous",
    "ive",
    "ful",
    "less",
    "ent",
    "ion",
    "ity",
    "ism",
    "ist",
    "ize",
    "ise",
    "ate",
    "ed",
    "er",
    "ly",
    "es",
    "en",
    "al"
  ];
  for (const suffix of enSuffixes) {
    if (w.length > suffix.length + 3 && w.endsWith(suffix)) {
      return w.slice(0, -suffix.length);
    }
  }
  return w;
}
function tokenize(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1 && !STOPWORDS.has(w)).map(stem);
}
function ngrams(text, minN = 2, maxN = 3) {
  const result = [];
  const clean = text.toLowerCase().replace(/\s+/g, " ").trim();
  for (const word of clean.split(" ")) {
    if (word.length < minN) continue;
    for (let n = minN; n <= maxN; n++) {
      for (let i = 0; i <= word.length - n; i++) {
        result.push(word.slice(i, i + n));
      }
    }
  }
  return result;
}
function computeTf(tokens) {
  const counts = /* @__PURE__ */ new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const tf = /* @__PURE__ */ new Map();
  for (const [term, count] of counts) {
    tf.set(term, count / tokens.length);
  }
  return tf;
}
function computeNorm(vector) {
  let sum = 0;
  for (const val of vector.values()) {
    sum += val * val;
  }
  return Math.sqrt(sum);
}
function cosineSimilarity(a, aNorm, b, bNorm) {
  if (aNorm === 0 || bNorm === 0) return 0;
  let dotProduct = 0;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const [term, aVal] of smaller) {
    const bVal = larger.get(term);
    if (bVal !== void 0) {
      dotProduct += aVal * bVal;
    }
  }
  return dotProduct / (aNorm * bNorm);
}
var VectorIndex = class {
  documents = /* @__PURE__ */ new Map();
  /** Inverted index: term → set of document IDs */
  invertedIndex = /* @__PURE__ */ new Map();
  /** Document frequency: term → how many documents contain it */
  docFrequency = /* @__PURE__ */ new Map();
  totalDocs = 0;
  /**
   * Add a document to the index.
   * Computes TF-IDF vector and updates inverted index.
   */
  add(id, text) {
    if (this.documents.has(id)) {
      this.remove(id);
    }
    const tokens = [...tokenize(text), ...ngrams(text)];
    const tf = computeTf(tokens);
    for (const term of tf.keys()) {
      this.docFrequency.set(term, (this.docFrequency.get(term) ?? 0) + 1);
      let postings = this.invertedIndex.get(term);
      if (!postings) {
        postings = /* @__PURE__ */ new Set();
        this.invertedIndex.set(term, postings);
      }
      postings.add(id);
    }
    this.totalDocs++;
    const vector = tf;
    const norm = computeNorm(vector);
    this.documents.set(id, { id, text, vector, norm });
  }
  /**
   * Remove a document from the index.
   */
  remove(id) {
    const doc = this.documents.get(id);
    if (!doc) return false;
    for (const term of doc.vector.keys()) {
      const df = this.docFrequency.get(term);
      if (df !== void 0) {
        if (df <= 1) {
          this.docFrequency.delete(term);
          this.invertedIndex.delete(term);
        } else {
          this.docFrequency.set(term, df - 1);
          this.invertedIndex.get(term)?.delete(id);
        }
      }
    }
    this.documents.delete(id);
    this.totalDocs--;
    return true;
  }
  /**
   * Search for similar documents.
   * Returns top-k results sorted by cosine similarity.
   */
  search(query, topK = 5, minScore = 0.05) {
    if (this.totalDocs === 0) return [];
    const queryTokens = [...tokenize(query), ...ngrams(query)];
    const queryTf = computeTf(queryTokens);
    const queryTfIdf = /* @__PURE__ */ new Map();
    for (const [term, tf] of queryTf) {
      const df = this.docFrequency.get(term) ?? 0;
      if (df === 0) continue;
      const idf = Math.log(1 + this.totalDocs / df);
      queryTfIdf.set(term, tf * idf);
    }
    const queryNorm = computeNorm(queryTfIdf);
    if (queryNorm === 0) return [];
    const candidates = /* @__PURE__ */ new Set();
    for (const term of queryTfIdf.keys()) {
      const postings = this.invertedIndex.get(term);
      if (postings) {
        for (const docId of postings) {
          candidates.add(docId);
        }
      }
    }
    const results = [];
    for (const docId of candidates) {
      const doc = this.documents.get(docId);
      if (!doc) continue;
      const docTfIdf = /* @__PURE__ */ new Map();
      for (const [term, tf] of doc.vector) {
        const df = this.docFrequency.get(term) ?? 1;
        const idf = Math.log(1 + this.totalDocs / df);
        docTfIdf.set(term, tf * idf);
      }
      const docNorm = computeNorm(docTfIdf);
      const score = cosineSimilarity(queryTfIdf, queryNorm, docTfIdf, docNorm);
      if (score >= minScore) {
        results.push({ id: docId, score });
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
  /**
   * Get the number of indexed documents.
   */
  get size() {
    return this.totalDocs;
  }
  /**
   * Get the vocabulary size (unique terms).
   */
  get vocabularySize() {
    return this.docFrequency.size;
  }
};

// src/modules/persist.ts
import { renameSync, writeFileSync } from "node:fs";
var DEFAULT_PERSIST_DEBOUNCE_MS = 500;
var pendingWrites = /* @__PURE__ */ new Map();
function atomicWrite(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  writeFileSyncSafe(tmpPath, data);
  renameSyncSafe(tmpPath, filePath);
}
function writeFileSyncSafe(path, data) {
  writeFileSync(path, data, "utf-8");
}
function renameSyncSafe(from, to) {
  renameSync(from, to);
}
function schedulePersist(filePath, serialize, delayMs = DEFAULT_PERSIST_DEBOUNCE_MS) {
  const existing = pendingWrites.get(filePath);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    pendingWrites.delete(filePath);
    try {
      atomicWrite(filePath, serialize());
    } catch {
    }
  }, delayMs);
  timer.unref?.();
  pendingWrites.set(filePath, { timer, serialize });
}
function flushPersist(filePath) {
  const entry = pendingWrites.get(filePath);
  if (!entry) return;
  clearTimeout(entry.timer);
  pendingWrites.delete(filePath);
  try {
    atomicWrite(filePath, entry.serialize());
  } catch {
  }
}
function cancelPersist(filePath) {
  const entry = pendingWrites.get(filePath);
  if (!entry) return;
  clearTimeout(entry.timer);
  pendingWrites.delete(filePath);
}

// src/modules/hippocampus.ts
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
function loadJson(filePath, fallback) {
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, "utf-8"));
    }
  } catch {
  }
  return fallback;
}
function saveJson(filePath, data) {
  try {
    writeFileSync2(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
  }
}
function extractFactKey(content) {
  const colonMatch = content.match(/^(.+?):\s+/);
  if (colonMatch) return colonMatch[1].trim().toLowerCase();
  const equalsMatch = content.match(/^(.+?)\s*=\s+/);
  if (equalsMatch) return equalsMatch[1].trim().toLowerCase();
  return null;
}
function extractFactValue(content) {
  const colonMatch = content.match(/^.+?:\s+(.+)$/);
  if (colonMatch) return colonMatch[1].trim().toLowerCase();
  const equalsMatch = content.match(/^.+?\s*=\s+(.+)$/);
  if (equalsMatch) return equalsMatch[1].trim().toLowerCase();
  return null;
}
var NEGATION_PAIRS = [
  [/\blikes?\b/i, /\bdislikes?\b/i],
  [/\bloves?\b/i, /\bhates?\b/i],
  [/\bнравится\b/i, /\bне нравится\b/i],
  [/\bлюбит\b/i, /\bне любит\b/i],
  [/\bхочет\b/i, /\bне хочет\b/i],
  [/\bможет\b/i, /\bне может\b/i],
  [/\bis\b/i, /\bis not\b/i],
  [/\bcan\b/i, /\bcannot\b|\bcan't\b/i]
];
var CONSOLIDATION_PROMPT = `\u0422\u044B \u2014 \u043C\u043E\u0434\u0443\u043B\u044C \u043A\u043E\u043D\u0441\u043E\u043B\u0438\u0434\u0430\u0446\u0438\u0438 \u043F\u0430\u043C\u044F\u0442\u0438. \u0422\u0435\u0431\u0435 \u0434\u0430\u0451\u0442\u0441\u044F \u0441\u043F\u0438\u0441\u043E\u043A \u0444\u0430\u043A\u0442\u043E\u0432 (\u0444\u043E\u0440\u043C\u0430\u0442: id: \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435 [\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F]).

\u0417\u0430\u0434\u0430\u0447\u0438:
1. \u041D\u0430\u0439\u0434\u0438 \u0414\u0423\u0411\u041B\u0418\u041A\u0410\u0422\u042B \u2014 \u0444\u0430\u043A\u0442\u044B \u0441 \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u044B\u043C \u0441\u043C\u044B\u0441\u043B\u043E\u043C (\u0434\u0430\u0436\u0435 \u0435\u0441\u043B\u0438 \u0441\u0444\u043E\u0440\u043C\u0443\u043B\u0438\u0440\u043E\u0432\u0430\u043D\u044B \u043F\u043E-\u0440\u0430\u0437\u043D\u043E\u043C\u0443)
2. \u041D\u0430\u0439\u0434\u0438 \u041F\u0420\u041E\u0422\u0418\u0412\u041E\u0420\u0415\u0427\u0418\u042F \u2014 \u0444\u0430\u043A\u0442\u044B, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u0438 \u043D\u0435 \u043C\u043E\u0433\u0443\u0442 \u0431\u044B\u0442\u044C \u043E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u0438\u0441\u0442\u0438\u043D\u043D\u044B\u043C\u0438
3. \u041D\u0430\u0439\u0434\u0438 \u0423\u0421\u0422\u0410\u0420\u0415\u0412\u0428\u0418\u0415 \u2014 \u0444\u0430\u043A\u0442\u044B \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u044F\u0432\u043D\u043E \u0443\u0441\u0442\u0430\u0440\u0435\u043B\u0438 \u043F\u0440\u0438 \u043D\u0430\u043B\u0438\u0447\u0438\u0438 \u0431\u043E\u043B\u0435\u0435 \u0441\u0432\u0435\u0436\u0435\u0439 \u0432\u0435\u0440\u0441\u0438\u0438

\u041E\u0442\u0432\u0435\u0442 \u0421\u0422\u0420\u041E\u0413\u041E \u0432 JSON (\u0431\u0435\u0437 markdown):
{"duplicates":[["id1","id2"],...],"contradictions":[["id1","id2","\u043F\u0440\u0438\u0447\u0438\u043D\u0430"],...],"obsolete":["id1",...]}

\u0415\u0441\u043B\u0438 \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u2014 \u043F\u0443\u0441\u0442\u044B\u0435 \u043C\u0430\u0441\u0441\u0438\u0432\u044B. \u0411\u0443\u0434\u044C \u041A\u041E\u041D\u0421\u0415\u0420\u0412\u0410\u0422\u0418\u0412\u0415\u041D: \u043F\u0440\u0438 \u0441\u043E\u043C\u043D\u0435\u043D\u0438\u0438 \u2014 \u041D\u0415 \u043E\u0442\u043C\u0435\u0447\u0430\u0439.`;
function parseConsolidationResponse(response) {
  const empty = { duplicates: [], contradictions: [], obsolete: [] };
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return empty;
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      duplicates: Array.isArray(parsed.duplicates) ? parsed.duplicates : [],
      contradictions: Array.isArray(parsed.contradictions) ? parsed.contradictions : [],
      obsolete: Array.isArray(parsed.obsolete) ? parsed.obsolete : []
    };
  } catch {
    return empty;
  }
}
function createHippocampus(workspaceDir) {
  const memoryDir = workspaceDir ? join2(workspaceDir, ".brainagent", "memory") : "";
  if (memoryDir) {
    ensureDir(memoryDir);
    ensureDir(join2(memoryDir, "episodic"));
    ensureDir(join2(memoryDir, "semantic"));
    ensureDir(join2(memoryDir, "procedural"));
  }
  let episodicStore = [];
  let semanticStore = [];
  let proceduralStore = [];
  let semanticVersion = 0;
  const episodicIndex = new VectorIndex();
  const semanticIndex = new VectorIndex();
  const proceduralIndex = new VectorIndex();
  const embeddingCache = {
    episodic: /* @__PURE__ */ new Map(),
    semantic: /* @__PURE__ */ new Map(),
    procedural: /* @__PURE__ */ new Map()
  };
  let embeddingsConfig = null;
  let embeddingsLogger;
  let embeddingsAvailable = false;
  let embeddingsCacheDir = "";
  const pendingContradictions = [];
  const queryEmbeddingCache = /* @__PURE__ */ new Map();
  const pendingSaves = /* @__PURE__ */ new Map();
  let idCounter = 0;
  function nextId(prefix) {
    return `${prefix}-${Date.now()}-${++idCounter}`;
  }
  function loadEmbeddingCache(layer, cache) {
    try {
      const filePath = join2(embeddingsCacheDir, `${layer}.json`);
      if (existsSync(filePath)) {
        const data = JSON.parse(readFileSync(filePath, "utf-8"));
        for (const [id, vec] of Object.entries(data)) {
          cache.set(id, vec);
        }
      }
    } catch {
    }
  }
  function saveEmbeddingCache(layer, cache) {
    try {
      const filePath = join2(embeddingsCacheDir, `${layer}.json`);
      const obj = {};
      for (const [id, vec] of cache) {
        obj[id] = vec;
      }
      atomicWrite(filePath, JSON.stringify(obj));
    } catch {
    }
  }
  function saveEmbeddingCacheDebounced(layer, cache) {
    const existing = pendingSaves.get(layer);
    if (existing) clearTimeout(existing);
    pendingSaves.set(
      layer,
      setTimeout(() => {
        pendingSaves.delete(layer);
        saveEmbeddingCache(layer, cache);
      }, 500)
    );
  }
  function scheduleEmbeddingBackfill() {
    if (!embeddingsConfig) return;
    const config = embeddingsConfig;
    const missing = [];
    for (const ep of episodicStore) {
      if (!embeddingCache.episodic.has(ep.id)) {
        missing.push({ layer: "episodic", id: ep.id, text: `${ep.event} ${ep.summary}` });
      }
    }
    for (const fact of semanticStore) {
      if (!embeddingCache.semantic.has(fact.id)) {
        missing.push({ layer: "semantic", id: fact.id, text: `${fact.content} ${fact.category}` });
      }
    }
    for (const proc of proceduralStore) {
      if (!embeddingCache.procedural.has(proc.id)) {
        missing.push({
          layer: "procedural",
          id: proc.id,
          text: `${proc.description} ${proc.triggerPattern}`
        });
      }
    }
    if (missing.length === 0) return;
    embeddingsLogger?.info(
      `BrainAgent Embeddings: computing ${missing.length} missing embeddings in background...`
    );
    void (async () => {
      for (let i = 0; i < missing.length; i++) {
        const item = missing[i];
        try {
          const vec = await getEmbedding(item.text, config, embeddingsLogger);
          if (vec) {
            const cache = embeddingCache[item.layer];
            cache.set(item.id, vec);
          }
        } catch {
        }
        if (i < missing.length - 1) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      saveEmbeddingCacheDebounced("episodic", embeddingCache.episodic);
      saveEmbeddingCacheDebounced("semantic", embeddingCache.semantic);
      saveEmbeddingCacheDebounced("procedural", embeddingCache.procedural);
      embeddingsLogger?.info("BrainAgent Embeddings: backfill complete");
    })();
  }
  async function searchWithEmbeddings(query, layer, topK) {
    if (!embeddingsAvailable || !embeddingsConfig) return null;
    const cache = embeddingCache[layer];
    if (cache.size === 0) return null;
    const queryVec = await getEmbedding(query, embeddingsConfig, embeddingsLogger);
    if (!queryVec) return null;
    const results = [];
    for (const [id, docVec] of cache) {
      const score = embeddingCosineSimilarity(queryVec, docVec);
      if (score > 0.1) {
        results.push({ id, score });
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
  function rebuildVectorIndices() {
    for (const ep of episodicStore) {
      episodicIndex.add(ep.id, `${ep.event} ${ep.summary} ${ep.entities.join(" ")}`);
    }
    for (const fact of semanticStore) {
      semanticIndex.add(fact.id, `${fact.content} ${fact.category}`);
    }
    for (const proc of proceduralStore) {
      proceduralIndex.add(
        proc.id,
        `${proc.description} ${proc.triggerPattern} ${proc.steps.join(" ")}`
      );
    }
  }
  function loadAll() {
    if (!memoryDir) return;
    episodicStore = loadJson(join2(memoryDir, "episodic", "store.json"), []);
    semanticStore = loadJson(join2(memoryDir, "semantic", "store.json"), []);
    proceduralStore = loadJson(join2(memoryDir, "procedural", "store.json"), []);
  }
  function persistEpisodic() {
    if (!memoryDir) return;
    saveJson(join2(memoryDir, "episodic", "store.json"), episodicStore);
  }
  function persistSemantic() {
    if (!memoryDir) return;
    saveJson(join2(memoryDir, "semantic", "store.json"), semanticStore);
  }
  function persistProcedural() {
    if (!memoryDir) return;
    saveJson(join2(memoryDir, "procedural", "store.json"), proceduralStore);
  }
  function initEmbeddings2(config, logger) {
    const provider = resolveEmbeddingProvider(config);
    if (!provider) {
      logger?.info("BrainAgent Hippocampus: no embedding provider \u2014 using TF-IDF");
      return;
    }
    embeddingsConfig = config;
    embeddingsLogger = logger;
    embeddingsAvailable = true;
    embeddingsCacheDir = join2(memoryDir, "..", "embeddings");
    ensureDir(embeddingsCacheDir);
    logger?.info(
      `BrainAgent Hippocampus: embeddings enabled via ${provider.name} (${provider.model})`
    );
    loadEmbeddingCache("episodic", embeddingCache.episodic);
    loadEmbeddingCache("semantic", embeddingCache.semantic);
    loadEmbeddingCache("procedural", embeddingCache.procedural);
    scheduleEmbeddingBackfill();
  }
  function updateEmbeddingsConfig2(config) {
    if (!embeddingsAvailable) {
      const provider = resolveEmbeddingProvider(config);
      if (provider) {
        embeddingsConfig = config;
        embeddingsAvailable = true;
        embeddingsCacheDir = join2(memoryDir, "..", "embeddings");
        ensureDir(embeddingsCacheDir);
        loadEmbeddingCache("episodic", embeddingCache.episodic);
        loadEmbeddingCache("semantic", embeddingCache.semantic);
        loadEmbeddingCache("procedural", embeddingCache.procedural);
        scheduleEmbeddingBackfill();
        embeddingsLogger?.info(
          `BrainAgent Hippocampus: embeddings enabled via ${provider.name} (${provider.model}) \u2014 lazy activation`
        );
      }
      return;
    }
    embeddingsConfig = config;
  }
  function getEmbeddingsStatus2() {
    const provider = embeddingsConfig ? resolveEmbeddingProvider(embeddingsConfig) : null;
    return {
      available: embeddingsAvailable && provider !== null,
      provider: provider?.name ?? "\u2014",
      model: provider?.model ?? "\u2014",
      cached: {
        episodic: embeddingCache.episodic.size,
        semantic: embeddingCache.semantic.size,
        procedural: embeddingCache.procedural.size
      }
    };
  }
  loadAll();
  rebuildVectorIndices();
  function storeEpisode2(event, summary, emotionalContext = "neutral", entities = [], emotionIntensity = 0) {
    const emotionalBoost = emotionIntensity > 0.5 ? emotionIntensity * 0.15 : 0;
    const baseSalience = Math.min(1, 0.8 + emotionalBoost);
    const episode = {
      id: nextId("ep"),
      timestamp: Date.now(),
      summary,
      event,
      emotionalContext,
      entities,
      salience: baseSalience,
      accessCount: 0
    };
    episodicStore.push(episode);
    episodicIndex.add(episode.id, `${event} ${summary} ${entities.join(" ")}`);
    if (embeddingsAvailable && embeddingsConfig) {
      const config = embeddingsConfig;
      void getEmbedding(`${event} ${summary}`, config, embeddingsLogger).then((vec) => {
        if (vec) {
          embeddingCache.episodic.set(episode.id, vec);
          saveEmbeddingCacheDebounced("episodic", embeddingCache.episodic);
        }
      });
    }
    persistEpisodic();
    bus.emitSync("hippocampus:stored", { layer: "episodic", id: episode.id });
    return episode;
  }
  function recallEpisodes(query, limit = 5, embeddingResults) {
    if (episodicStore.length === 0) return [];
    const vectorResults = episodicIndex.search(query, Math.min(limit * 3, episodicStore.length));
    const vectorScoreMap = new Map(vectorResults.map((r) => [r.id, r.score]));
    const embScoreMap = embeddingResults ? new Map(embeddingResults.map((r) => [r.id, r.score])) : null;
    const scored = episodicStore.map((ep) => {
      const tfidfScore = vectorScoreMap.get(ep.id) ?? 0;
      const embScore = embScoreMap?.get(ep.id) ?? 0;
      const vectorScore = embScoreMap ? embScore * 0.4 + tfidfScore * 0.2 : tfidfScore * 0.6;
      const recencyDays = (Date.now() - ep.timestamp) / (24 * 60 * 60 * 1e3);
      const recencyScore = 1 / (1 + recencyDays * 0.1);
      const salienceScore = ep.salience;
      const score = vectorScore + recencyScore * 0.2 + salienceScore * 0.2;
      return { episode: ep, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, limit).filter((s) => s.score > 0.05).map((s) => s.episode);
    for (const ep of results) {
      ep.accessCount++;
      ep.salience = Math.min(1, ep.salience + 0.05);
    }
    if (results.length > 0) persistEpisodic();
    return results;
  }
  function storeFact2(content, category, sourceEpisodeIds = [], relatedIds = []) {
    const existing = semanticStore.find(
      (f) => f.content.toLowerCase() === content.toLowerCase() && f.category === category
    );
    if (existing) {
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      existing.updatedAt = Date.now();
      existing.sourceEpisodeIds = [.../* @__PURE__ */ new Set([...existing.sourceEpisodeIds, ...sourceEpisodeIds])];
      semanticIndex.add(existing.id, `${existing.content} ${existing.category}`);
      semanticVersion++;
      persistSemantic();
      return existing;
    }
    const similar = semanticIndex.search(`${content} ${category}`, 1, 0.85);
    if (similar.length > 0) {
      const nearDup = semanticStore.find((f) => f.id === similar[0].id);
      if (nearDup) {
        nearDup.confidence = Math.min(1, nearDup.confidence + 0.15);
        nearDup.updatedAt = Date.now();
        nearDup.sourceEpisodeIds = [.../* @__PURE__ */ new Set([...nearDup.sourceEpisodeIds, ...sourceEpisodeIds])];
        nearDup.relatedIds = [.../* @__PURE__ */ new Set([...nearDup.relatedIds, ...relatedIds])];
        semanticVersion++;
        persistSemantic();
        return nearDup;
      }
    }
    const pendingBefore = pendingContradictions.length;
    const contradiction = detectContradiction(content, category);
    if (contradiction && contradiction.confidence >= 0.7) {
      return reviseFact(
        contradiction.contradicts,
        content,
        0.7,
        // default confidence for new facts
        sourceEpisodeIds,
        `newer fact supersedes (confidence: ${contradiction.confidence.toFixed(2)})`
      );
    }
    const fact = {
      id: nextId("sem"),
      content,
      category,
      relatedIds,
      confidence: 0.7,
      sourceEpisodeIds,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    semanticStore.push(fact);
    semanticIndex.add(fact.id, `${content} ${category}`);
    semanticVersion++;
    for (let i = pendingBefore; i < pendingContradictions.length; i++) {
      pendingContradictions[i].newFactId = fact.id;
    }
    if (embeddingsAvailable && embeddingsConfig) {
      const config = embeddingsConfig;
      void getEmbedding(`${content} ${category}`, config, embeddingsLogger).then((vec) => {
        if (vec) {
          embeddingCache.semantic.set(fact.id, vec);
          saveEmbeddingCacheDebounced("semantic", embeddingCache.semantic);
        }
      });
    }
    persistSemantic();
    bus.emitSync("hippocampus:stored", { layer: "semantic", id: fact.id });
    return fact;
  }
  function getPendingContradictions() {
    return [...pendingContradictions];
  }
  function clearPendingContradictions() {
    pendingContradictions.length = 0;
  }
  function detectContradiction(content, category) {
    const sameCategoryFacts = semanticStore.filter((f) => f.category === category);
    if (sameCategoryFacts.length === 0) return null;
    const newKey = extractFactKey(content);
    const newValue = extractFactValue(content);
    if (newKey && newValue) {
      for (const existing of sameCategoryFacts) {
        const existingKey = extractFactKey(existing.content);
        const existingValue = extractFactValue(existing.content);
        if (existingKey && existingValue && existingKey === newKey && existingValue !== newValue) {
          return { contradicts: existing, confidence: 0.85 };
        }
      }
    }
    for (const existing of sameCategoryFacts) {
      for (const [posPattern, negPattern] of NEGATION_PAIRS) {
        const newHasPos = posPattern.test(content);
        const newHasNeg = negPattern.test(content);
        const existHasPos = posPattern.test(existing.content);
        const existHasNeg = negPattern.test(existing.content);
        if (newHasPos && existHasNeg || newHasNeg && existHasPos) {
          const newWords = new Set(
            content.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
          );
          const existWords = existing.content.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
          const overlap = existWords.filter((w) => newWords.has(w)).length;
          if (overlap >= 1) {
            return { contradicts: existing, confidence: 0.8 };
          }
        }
      }
    }
    const similar = semanticIndex.search(`${content} ${category}`, 3, 0.4);
    for (const match of similar) {
      if (match.score >= 0.85) continue;
      if (match.score >= 0.4) {
        const existing = sameCategoryFacts.find((f) => f.id === match.id);
        if (existing) {
          pendingContradictions.push({
            newFactId: "",
            // Backfilled by storeFact once the fact exists
            existingFactId: existing.id,
            similarity: match.score
          });
        }
      }
    }
    return null;
  }
  function reviseFact(existing, newContent, newConfidence, sourceEpisodeIds, reason) {
    const oldContent = existing.content;
    const oldConfidence = existing.confidence;
    if (!existing.revisionHistory) existing.revisionHistory = [];
    existing.revisionHistory.push({
      previousContent: oldContent,
      previousConfidence: oldConfidence,
      revisedAt: Date.now(),
      reason,
      sourceEpisodeIds
    });
    if (existing.revisionHistory.length > 5) {
      existing.revisionHistory = existing.revisionHistory.slice(-5);
    }
    existing.content = newContent;
    existing.confidence = Math.min(1, newConfidence * 0.7 + oldConfidence * 0.3);
    existing.updatedAt = Date.now();
    existing.sourceEpisodeIds = [.../* @__PURE__ */ new Set([...existing.sourceEpisodeIds, ...sourceEpisodeIds])];
    semanticIndex.add(existing.id, `${newContent} ${existing.category}`);
    semanticVersion++;
    if (embeddingsAvailable && embeddingsConfig) {
      const config = embeddingsConfig;
      void getEmbedding(`${newContent} ${existing.category}`, config, embeddingsLogger).then(
        (vec) => {
          if (vec) {
            embeddingCache.semantic.set(existing.id, vec);
            saveEmbeddingCacheDebounced("semantic", embeddingCache.semantic);
          }
        }
      );
    }
    persistSemantic();
    bus.emitSync("hippocampus:fact-revised", {
      factId: existing.id,
      oldContent,
      newContent,
      reason
    });
    return existing;
  }
  function getRevisionHistory(factId) {
    const fact = semanticStore.find((f) => f.id === factId);
    if (!fact?.revisionHistory) return [];
    return [...fact.revisionHistory];
  }
  function recallFacts(query, category, limit = 10, embeddingResults) {
    let candidates = semanticStore;
    if (category) {
      candidates = candidates.filter((f) => f.category === category);
    }
    if (candidates.length === 0) return [];
    const vectorResults = semanticIndex.search(query, Math.min(limit * 3, semanticStore.length));
    const vectorScoreMap = new Map(vectorResults.map((r) => [r.id, r.score]));
    const embScoreMap = embeddingResults ? new Map(embeddingResults.map((r) => [r.id, r.score])) : null;
    const candidateIds = new Set(candidates.map((f) => f.id));
    const scored = candidates.map((fact) => {
      const tfidfScore = candidateIds.has(fact.id) ? vectorScoreMap.get(fact.id) ?? 0 : 0;
      const embScore = embScoreMap?.get(fact.id) ?? 0;
      const vectorScore = embScoreMap ? embScore * 0.5 + tfidfScore * 0.2 : tfidfScore * 0.7;
      const score = vectorScore + fact.confidence * 0.3;
      return { fact, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).filter((s) => s.score > 0.03).map((s) => s.fact);
  }
  function getFactsByCategory2(category, limit = 10) {
    const candidates = semanticStore.filter((f) => f.category === category);
    if (candidates.length === 0) return [];
    return [...candidates].sort((a, b) => b.confidence - a.confidence).slice(0, limit);
  }
  function storeWorkflow2(description, triggerPattern, steps) {
    const proc = {
      id: nextId("proc"),
      description,
      triggerPattern,
      steps,
      successRate: 0.5,
      usageCount: 0,
      lastUsed: Date.now()
    };
    proceduralStore.push(proc);
    proceduralIndex.add(proc.id, `${description} ${triggerPattern} ${steps.join(" ")}`);
    persistProcedural();
    bus.emitSync("hippocampus:stored", { layer: "procedural", id: proc.id });
    return proc;
  }
  function findMatchingWorkflow(input) {
    if (proceduralStore.length === 0) return void 0;
    const vectorResults = proceduralIndex.search(input, 3, 0.15);
    if (vectorResults.length === 0) return void 0;
    let bestMatch;
    let bestScore = 0;
    for (const result of vectorResults) {
      const proc = proceduralStore.find((p) => p.id === result.id);
      if (!proc) continue;
      const score = result.score * 0.7 + proc.successRate * 0.3;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = proc;
      }
    }
    if (bestMatch) {
      bestMatch.usageCount++;
      bestMatch.lastUsed = Date.now();
      persistProcedural();
    }
    return bestMatch;
  }
  function recordWorkflowOutcome(procId, success) {
    const proc = proceduralStore.find((p) => p.id === procId);
    if (!proc) return;
    const alpha = 0.3;
    proc.successRate = proc.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;
    persistProcedural();
  }
  async function computeAndCacheQueryEmbedding(query) {
    if (queryEmbeddingCache.has(query) || !embeddingsConfig) return;
    const vec = await getEmbedding(query, embeddingsConfig, embeddingsLogger);
    if (vec) queryEmbeddingCache.set(query, vec);
    if (queryEmbeddingCache.size > 50) {
      const first = queryEmbeddingCache.keys().next().value;
      if (first) queryEmbeddingCache.delete(first);
    }
  }
  function getEmbeddingScoresSync(query) {
    const queryVec = queryEmbeddingCache.get(query);
    if (!queryVec) return null;
    function scoreLayer(cache) {
      const results = [];
      for (const [id, docVec] of cache) {
        const score = embeddingCosineSimilarity(queryVec, docVec);
        if (score > 0.1) results.push({ id, score });
      }
      results.sort((a, b) => b.score - a.score);
      return results;
    }
    return {
      episodic: scoreLayer(embeddingCache.episodic),
      semantic: scoreLayer(embeddingCache.semantic)
    };
  }
  function recallAll2(query, episodicLimit = 3, semanticLimit = 5) {
    const embeddingScores = embeddingsAvailable ? getEmbeddingScoresSync(query) : null;
    const episodic = recallEpisodes(query, episodicLimit, embeddingScores?.episodic);
    const semantic = recallFacts(query, void 0, semanticLimit, embeddingScores?.semantic);
    const workflow = findMatchingWorkflow(query);
    const result = {
      episodic,
      semantic,
      procedural: workflow ? [workflow] : []
    };
    bus.emit("hippocampus:recalled", result);
    if (embeddingsAvailable && embeddingsConfig) {
      void computeAndCacheQueryEmbedding(query);
    }
    return result;
  }
  async function recallAllAsync2(query, episodicLimit = 3, semanticLimit = 5) {
    if (!embeddingsAvailable) {
      return recallAll2(query, episodicLimit, semanticLimit);
    }
    const [epScores, semScores] = await Promise.all([
      searchWithEmbeddings(query, "episodic", 15),
      searchWithEmbeddings(query, "semantic", 15)
    ]);
    const episodic = recallEpisodes(query, episodicLimit, epScores ?? void 0);
    const semantic = recallFacts(query, void 0, semanticLimit, semScores ?? void 0);
    const workflow = findMatchingWorkflow(query);
    const result = {
      episodic,
      semantic,
      procedural: workflow ? [workflow] : []
    };
    bus.emit("hippocampus:recalled", result);
    return result;
  }
  async function consolidate2(config, neuroClawConfig, logger, intensity = 0.5, skipAIReview = false) {
    let merged = 0;
    let pruned = 0;
    let strengthened = 0;
    let contradictions = 0;
    let revised = 0;
    const pruneThreshold = 1 - intensity * 0.5;
    const mergeThreshold = 0.7 + (1 - intensity) * 0.2;
    const strengthenBonus = 0.05 + intensity * 0.1;
    const decayFactor = config.memory.salienceDecayFactor;
    for (const ep of episodicStore) {
      const daysSince = (Date.now() - ep.timestamp) / (24 * 60 * 60 * 1e3);
      ep.salience *= decayFactor ** daysSince;
    }
    const effectiveMaxEpisodic = Math.floor(
      config.memory.maxEpisodicMemories * (1.1 - intensity * 0.2)
    );
    if (episodicStore.length > effectiveMaxEpisodic) {
      episodicStore.sort((a, b) => b.salience - a.salience);
      const removed = episodicStore.splice(effectiveMaxEpisodic);
      for (const r of removed) episodicIndex.remove(r.id);
      pruned += removed.length;
    }
    for (const ep of episodicStore) {
      if (ep.accessCount > 3) {
        ep.salience = Math.min(1, ep.salience + strengthenBonus);
        strengthened++;
      }
    }
    const toRemoveIds = /* @__PURE__ */ new Set();
    for (let i = 0; i < semanticStore.length; i++) {
      const fact = semanticStore[i];
      if (toRemoveIds.has(fact.id)) continue;
      const similar = semanticIndex.search(`${fact.content} ${fact.category}`, 5, mergeThreshold);
      for (const match of similar) {
        if (match.id === fact.id || toRemoveIds.has(match.id)) continue;
        const dup = semanticStore.find((f) => f.id === match.id);
        if (!dup || dup.category !== fact.category) continue;
        fact.confidence = Math.max(fact.confidence, dup.confidence);
        fact.sourceEpisodeIds = [.../* @__PURE__ */ new Set([...fact.sourceEpisodeIds, ...dup.sourceEpisodeIds])];
        fact.relatedIds = [.../* @__PURE__ */ new Set([...fact.relatedIds, ...dup.relatedIds])];
        fact.updatedAt = Date.now();
        toRemoveIds.add(dup.id);
        merged++;
      }
    }
    for (const id of toRemoveIds) semanticIndex.remove(id);
    semanticStore = semanticStore.filter((f) => !toRemoveIds.has(f.id));
    if (semanticStore.length > config.memory.maxSemanticMemories) {
      semanticStore.sort((a, b) => b.confidence - a.confidence);
      const removed = semanticStore.splice(config.memory.maxSemanticMemories);
      for (const r of removed) semanticIndex.remove(r.id);
      pruned += removed.length;
    }
    const procCutoffMs = 30 * 24 * 60 * 60 * 1e3;
    const beforeLen = proceduralStore.length;
    const removedProcs = proceduralStore.filter(
      (p) => p.usageCount === 0 && Date.now() - p.lastUsed >= procCutoffMs
    );
    for (const r of removedProcs) proceduralIndex.remove(r.id);
    proceduralStore = proceduralStore.filter(
      (p) => p.usageCount > 0 || Date.now() - p.lastUsed < procCutoffMs
    );
    pruned += beforeLen - proceduralStore.length;
    if (!skipAIReview && neuroClawConfig && isAIProviderAvailable(neuroClawConfig) && semanticStore.length >= 5) {
      try {
        const factsForReview = semanticStore.length > 100 ? semanticStore.slice(-100) : semanticStore;
        const factsText = factsForReview.map((f) => `${f.id}: ${f.content} [${f.category}]`).join("\n");
        const aiResponse = await callLLM(
          CONSOLIDATION_PROMPT,
          factsText,
          neuroClawConfig,
          logger,
          800
        );
        if (aiResponse) {
          const aiResult = parseConsolidationResponse(aiResponse);
          const maxRemovals = Math.floor(semanticStore.length * 0.3);
          let removals = 0;
          const aiRemoveIds = /* @__PURE__ */ new Set();
          const storeIds = new Set(semanticStore.map((f) => f.id));
          for (const group of aiResult.duplicates) {
            if (removals >= maxRemovals) break;
            const validIds = group.filter((id) => storeIds.has(id));
            if (validIds.length < 2) continue;
            const primary = semanticStore.find((f) => f.id === validIds[0]);
            if (!primary) continue;
            for (let i = 1; i < validIds.length; i++) {
              if (removals >= maxRemovals) break;
              const dup = semanticStore.find((f) => f.id === validIds[i]);
              if (dup) {
                primary.confidence = Math.max(primary.confidence, dup.confidence);
                primary.sourceEpisodeIds = [
                  .../* @__PURE__ */ new Set([...primary.sourceEpisodeIds, ...dup.sourceEpisodeIds])
                ];
                aiRemoveIds.add(validIds[i]);
                removals++;
                merged++;
              }
            }
          }
          for (const obsId of aiResult.obsolete) {
            if (removals >= maxRemovals) break;
            if (storeIds.has(obsId) && !aiRemoveIds.has(obsId)) {
              aiRemoveIds.add(obsId);
              removals++;
              pruned++;
            }
          }
          for (const id of aiRemoveIds) semanticIndex.remove(id);
          semanticStore = semanticStore.filter((f) => !aiRemoveIds.has(f.id));
          contradictions = aiResult.contradictions.length;
          for (const c of aiResult.contradictions) {
            if (c.length >= 2) {
              const factA = semanticStore.find((f) => f.id === c[0]);
              const factB = semanticStore.find((f) => f.id === c[1]);
              if (factA && factB) {
                const newer = factA.updatedAt >= factB.updatedAt ? factA : factB;
                const older = newer === factA ? factB : factA;
                if (newer.confidence >= 0.5) {
                  reviseFact(
                    older,
                    newer.content,
                    newer.confidence,
                    newer.sourceEpisodeIds,
                    `dream-mode resolution${c[2] ? `: ${c[2]}` : ""}`
                  );
                  revised++;
                } else {
                  older.relatedIds = [.../* @__PURE__ */ new Set([...older.relatedIds, newer.id])];
                  newer.relatedIds = [.../* @__PURE__ */ new Set([...newer.relatedIds, older.id])];
                  logger?.info(
                    `BrainAgent Consolidation: ambiguous contradiction \u2014 ${c[0]} vs ${c[1]}, linked`
                  );
                }
              }
            }
          }
          const pending = getPendingContradictions();
          if (pending.length > 0) {
            for (const pc of pending) {
              const existingFact = semanticStore.find((f) => f.id === pc.existingFactId);
              const newFact = semanticStore.find((f) => f.id === pc.newFactId);
              if (existingFact && newFact && existingFact.id !== newFact.id) {
                existingFact.relatedIds = [.../* @__PURE__ */ new Set([...existingFact.relatedIds, newFact.id])];
                newFact.relatedIds = [.../* @__PURE__ */ new Set([...newFact.relatedIds, existingFact.id])];
              }
            }
            clearPendingContradictions();
          }
        }
      } catch (err) {
        logger?.info(`BrainAgent Consolidation: AI review error \u2014 ${String(err)}`);
      }
    }
    persistEpisodic();
    persistSemantic();
    persistProcedural();
    return { merged, pruned, strengthened, contradictions, revised };
  }
  function getStats2() {
    return {
      episodic: episodicStore.length,
      semantic: semanticStore.length,
      procedural: proceduralStore.length,
      vectorVocabulary: {
        episodic: episodicIndex.vocabularySize,
        semantic: semanticIndex.vocabularySize,
        procedural: proceduralIndex.vocabularySize
      }
    };
  }
  function dispose() {
    for (const timer of pendingSaves.values()) clearTimeout(timer);
    pendingSaves.clear();
  }
  return {
    storeEpisode: storeEpisode2,
    recallEpisodes,
    storeFact: storeFact2,
    getPendingContradictions,
    clearPendingContradictions,
    detectContradiction,
    reviseFact,
    getRevisionHistory,
    recallFacts,
    getFactsByCategory: getFactsByCategory2,
    storeWorkflow: storeWorkflow2,
    findMatchingWorkflow,
    recordWorkflowOutcome,
    recallAll: recallAll2,
    recallAllAsync: recallAllAsync2,
    consolidate: consolidate2,
    getStats: getStats2,
    getSemanticVersion: () => semanticVersion,
    initEmbeddings: initEmbeddings2,
    updateEmbeddingsConfig: updateEmbeddingsConfig2,
    getEmbeddingsStatus: getEmbeddingsStatus2,
    stop: dispose,
    dispose
  };
}
var active3;
function current3() {
  if (!active3) {
    active3 = createHippocampus("");
  }
  return active3;
}
function initMemoryStorage(workspaceDir) {
  active3?.dispose();
  active3 = createHippocampus(workspaceDir);
}
function getSemanticVersion() {
  return current3().getSemanticVersion();
}
function initEmbeddings(config, logger) {
  current3().initEmbeddings(config, logger);
}
function updateEmbeddingsConfig(config) {
  current3().updateEmbeddingsConfig(config);
}
function getEmbeddingsStatus() {
  return current3().getEmbeddingsStatus();
}
function storeEpisode(event, summary, emotionalContext = "neutral", entities = [], emotionIntensity = 0) {
  return current3().storeEpisode(event, summary, emotionalContext, entities, emotionIntensity);
}
function storeFact(content, category, sourceEpisodeIds = [], relatedIds = []) {
  return current3().storeFact(content, category, sourceEpisodeIds, relatedIds);
}
function getFactsByCategory(category, limit = 10) {
  return current3().getFactsByCategory(category, limit);
}
function storeWorkflow(description, triggerPattern, steps) {
  return current3().storeWorkflow(description, triggerPattern, steps);
}
function recallAll(query, episodicLimit = 3, semanticLimit = 5) {
  return current3().recallAll(query, episodicLimit, semanticLimit);
}
async function recallAllAsync(query, episodicLimit = 3, semanticLimit = 5) {
  return current3().recallAllAsync(query, episodicLimit, semanticLimit);
}
async function consolidate(config, neuroClawConfig, logger, intensity = 0.5, skipAIReview = false) {
  return current3().consolidate(config, neuroClawConfig, logger, intensity, skipAIReview);
}
function getStats() {
  return current3().getStats();
}

// src/modules/thalamus.ts
var EMOTIONAL_KEYWORDS = [
  "\u0441\u043F\u0430\u0441\u0438\u0431\u043E",
  "\u0431\u043B\u0430\u0433\u043E\u0434\u0430\u0440\u044E",
  "\u043E\u0431\u043E\u0436\u0430\u044E",
  "\u043D\u0435\u043D\u0430\u0432\u0438\u0436\u0443",
  "\u0433\u0440\u0443\u0441\u0442\u043D\u043E",
  "\u0440\u0430\u0434\u043E\u0441\u0442\u044C",
  "\u0437\u043B\u044E\u0441\u044C",
  "\u0431\u043E\u044E\u0441\u044C",
  "\u043F\u0435\u0440\u0435\u0436\u0438\u0432\u0430\u044E",
  "\u0440\u0430\u0441\u0441\u0442\u0440\u043E\u0435\u043D",
  "\u0441\u0447\u0430\u0441\u0442\u043B\u0438\u0432",
  "love",
  "hate",
  "sad",
  "happy",
  "angry",
  "afraid",
  "worried"
];
var TECHNICAL_KEYWORDS = [
  "\u043A\u043E\u0434",
  "code",
  "api",
  "\u0431\u0430\u0433",
  "bug",
  "\u0444\u0443\u043D\u043A\u0446\u0438\u044F",
  "function",
  "\u0441\u0435\u0440\u0432\u0435\u0440",
  "server",
  "\u0431\u0430\u0437\u0430 \u0434\u0430\u043D\u043D\u044B\u0445",
  "database",
  "deploy",
  "\u0434\u0435\u043F\u043B\u043E\u0439",
  "git",
  "npm",
  "docker",
  "config",
  "\u043A\u043E\u043D\u0444\u0438\u0433",
  "typescript",
  "python",
  "nodejs",
  "react",
  "linux",
  "ssh",
  "curl",
  "json",
  "yaml"
];
var CREATIVE_KEYWORDS = [
  "\u043D\u0430\u043F\u0438\u0448\u0438",
  "\u0441\u043E\u0447\u0438\u043D\u0438",
  "\u043F\u0440\u0438\u0434\u0443\u043C\u0430\u0439",
  "write",
  "create",
  "\u0441\u0442\u0430\u0442\u044C\u044F",
  "article",
  "\u0438\u0441\u0442\u043E\u0440\u0438\u044F",
  "story",
  "\u0441\u0442\u0438\u0445\u0438",
  "poem",
  "\u0434\u0438\u0437\u0430\u0439\u043D",
  "design",
  "\u0440\u0438\u0441\u0443\u043D\u043E\u043A",
  "image",
  "\u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0430",
  "\u043B\u043E\u0433\u043E\u0442\u0438\u043F",
  "logo"
];
var COMMAND_PATTERNS = [
  /^\/\w+/,
  /^(сделай|запусти|открой|закрой|перезапусти|удали|установи|обнови)/i,
  /^(do|run|open|close|restart|delete|install|update|start|stop)\b/i
];
function detectModality(text, hasAttachments) {
  if (hasAttachments) return "mixed";
  return "text";
}
function countKeywordHits(text, keywords) {
  const lower = text.toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) count++;
  }
  return count;
}
function detectDomain(text) {
  const lower = text.toLowerCase();
  for (const pattern of COMMAND_PATTERNS) {
    if (pattern.test(lower)) return "command";
  }
  const techScore = countKeywordHits(text, TECHNICAL_KEYWORDS);
  const creativeScore = countKeywordHits(text, CREATIVE_KEYWORDS);
  const emotionalScore = countKeywordHits(text, EMOTIONAL_KEYWORDS);
  const scores = [
    ["technical", techScore],
    ["creative", creativeScore],
    ["emotional", emotionalScore]
  ];
  scores.sort((a, b) => b[1] - a[1]);
  const [topDomain, topScore] = scores[0];
  if (topScore === 0) {
    if (text.length < 30) return "casual";
    if (text.includes("?")) return "factual";
    return "unknown";
  }
  return topDomain;
}
function detectComplexity(text) {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length;
  const hasMultipleQuestions = (text.match(/\?/g) ?? []).length > 1;
  const hasListItems = /\d+\.\s|[-*]\s/.test(text);
  if (wordCount <= 5 && sentenceCount <= 1) return "trivial";
  if (wordCount <= 20 && !hasMultipleQuestions) return "simple";
  if (wordCount <= 80 && !hasListItems) return "moderate";
  if (wordCount <= 200) return "complex";
  return "extreme";
}
function decideFastOrSlow(domain, complexity) {
  if (complexity === "trivial" || complexity === "simple") return "fast";
  if (domain === "command") return "fast";
  if (domain === "casual" && complexity === "moderate") return "fast";
  return "slow";
}
function classify(text, hasAttachments) {
  const modality = detectModality(text, hasAttachments);
  const domain = detectDomain(text);
  const complexity = detectComplexity(text);
  const processingPath = decideFastOrSlow(domain, complexity);
  const intentSummary = buildIntentSummary(text, domain);
  const result = {
    modality,
    domain,
    complexity,
    intentSummary,
    confidence: 0.7 + (countKeywordHits(text, [
      ...TECHNICAL_KEYWORDS,
      ...CREATIVE_KEYWORDS,
      ...EMOTIONAL_KEYWORDS
    ]) > 0 ? 0.2 : 0),
    processingPath
  };
  bus.emitSync("thalamus:classified", result);
  return result;
}
function buildIntentSummary(text, domain) {
  const truncated = text.length > 100 ? text.slice(0, 100) + "..." : text;
  return `[${domain}] ${truncated}`;
}

// src/modules/amygdala.ts
var EMOTION_PATTERNS = [
  {
    emotion: "urgency",
    indicators: [
      /срочн/i,
      /немедленн/i,
      /asap/i,
      /urgent/i,
      /скор(ее|ей)/i,
      /быстр(ее|ей)/i,
      /!{2,}/,
      /помоги(те)?!/i
    ],
    baseIntensity: 0.9
  },
  {
    emotion: "frustration",
    indicators: [
      /не работает/i,
      /опять/i,
      /достало/i,
      /broken/i,
      /doesn't work/i,
      /не могу/i,
      /невозможно/i,
      /задолбал/i
    ],
    baseIntensity: 0.7
  },
  {
    emotion: "anger",
    indicators: [/злюсь/i, /бесит/i, /ненавижу/i, /angry/i, /hate/i, /какого чёрта/i, /чёрт/i],
    baseIntensity: 0.8
  },
  {
    emotion: "anxiety",
    indicators: [
      /переживаю/i,
      /боюсь/i,
      /страшно/i,
      /worried/i,
      /afraid/i,
      /nervous/i,
      /тревожн/i,
      /вдруг/i
    ],
    baseIntensity: 0.6
  },
  {
    emotion: "confusion",
    indicators: [
      /не понимаю/i,
      /confused/i,
      /что это/i,
      /как это/i,
      /зачем/i,
      /почему/i,
      /\?\?+/,
      /не ясно/i,
      /непонятн/i
    ],
    baseIntensity: 0.5
  },
  {
    emotion: "gratitude",
    indicators: [
      /спасибо/i,
      /благодарю/i,
      /thank/i,
      /отлично/i,
      /молодец/i,
      /супер/i,
      /класс/i,
      /умница/i
    ],
    baseIntensity: 0.7
  },
  {
    emotion: "joy",
    indicators: [
      /ура/i,
      /круто/i,
      /здорово/i,
      /awesome/i,
      /great/i,
      /замечательно/i,
      /радость/i,
      /счастлив/i,
      /!{3,}/
    ],
    baseIntensity: 0.7
  },
  {
    emotion: "sadness",
    indicators: [
      /грустно/i,
      /печальн/i,
      /sad/i,
      /жаль/i,
      /unfortunately/i,
      /к сожалению/i,
      /расстроен/i
    ],
    baseIntensity: 0.5
  },
  {
    emotion: "curiosity",
    indicators: [/интересно/i, /curious/i, /расскажи/i, /а что если/i, /как думаешь/i, /можно ли/i],
    baseIntensity: 0.4
  }
];
var URGENCY_BOOSTERS = [
  { pattern: /!{3,}/, boost: 0.3 },
  { pattern: /CAPS_RATIO_HIGH/, boost: 0.2 },
  // placeholder, checked separately
  { pattern: /срочн/i, boost: 0.4 },
  { pattern: /asap|немедленно|urgent/i, boost: 0.4 },
  { pattern: /помоги(те)?/i, boost: 0.2 },
  { pattern: /ошибк|error|broken|сломал/i, boost: 0.15 }
];
function detectEmotion(text) {
  let bestEmotion = "neutral";
  let bestIntensity = 0;
  for (const pattern of EMOTION_PATTERNS) {
    let matchCount = 0;
    for (const indicator of pattern.indicators) {
      if (indicator.test(text)) matchCount++;
    }
    if (matchCount > 0) {
      const intensity = Math.min(1, pattern.baseIntensity + (matchCount - 1) * 0.1);
      if (intensity > bestIntensity) {
        bestIntensity = intensity;
        bestEmotion = pattern.emotion;
      }
    }
  }
  if (bestIntensity === 0) {
    const words = text.split(/\s+/).length;
    const hasPunctuation = /[?!.,;:]/.test(text);
    bestIntensity = Math.min(
      0.15,
      0.05 + (words > 5 ? 0.03 : 0) + (words > 20 ? 0.03 : 0) + (hasPunctuation ? 0.02 : 0)
    );
  }
  return { emotion: bestEmotion, intensity: bestIntensity };
}
function calculateUrgency(text) {
  let urgency = 0.1;
  for (const booster of URGENCY_BOOSTERS) {
    if (booster.pattern.source === "CAPS_RATIO_HIGH") {
      const alphaChars = text.replace(/[^a-zA-Zа-яА-Я]/g, "");
      const upperChars = text.replace(/[^A-ZА-Я]/g, "");
      if (alphaChars.length > 5 && upperChars.length / alphaChars.length > 0.5) {
        urgency += booster.boost;
      }
    } else if (booster.pattern.test(text)) {
      urgency += booster.boost;
    }
  }
  return Math.min(1, urgency);
}
function calculateImportance(text, emotion, urgency) {
  let importance = 0.3;
  importance += urgency * 0.3;
  if (["frustration", "anger", "anxiety", "urgency"].includes(emotion)) {
    importance += 0.2;
  }
  const wordCount = text.split(/\s+/).length;
  if (wordCount > 30) importance += 0.1;
  if (wordCount > 100) importance += 0.1;
  return Math.min(1, importance);
}
function assess(text) {
  const { emotion, intensity } = detectEmotion(text);
  const urgency = calculateUrgency(text);
  const importance = calculateImportance(text, emotion, urgency);
  const empathyNeeded = intensity > 0.5 && ["frustration", "anger", "anxiety", "sadness", "confusion"].includes(emotion);
  const result = {
    urgency,
    importance,
    emotion,
    emotionIntensity: intensity,
    empathyNeeded,
    rationale: buildRationale(emotion, intensity, urgency)
  };
  bus.emitSync("amygdala:assessed", result);
  return result;
}
function buildRationale(emotion, intensity, urgency) {
  const parts = [];
  if (emotion !== "neutral") {
    parts.push(`emotion=${emotion}(${(intensity * 100).toFixed(0)}%)`);
  }
  if (urgency > 0.5) {
    parts.push(`urgency=high(${(urgency * 100).toFixed(0)}%)`);
  }
  return parts.length > 0 ? parts.join(", ") : "routine message";
}
var EMOTION_PROMPT = `You are an emotion detection system for a conversational AI.

Analyze the user's message and detect the PRIMARY emotion.

Emotion labels (pick ONE):
- "urgency": time pressure, emergency, needs immediate help
- "frustration": something isn't working, repeated failures
- "anger": strong displeasure, hostility
- "anxiety": worry, fear, nervousness about an outcome
- "confusion": doesn't understand, needs clarification
- "gratitude": thankful, appreciative
- "joy": happy, excited, celebrating
- "sadness": disappointed, upset, feeling loss
- "curiosity": interested, exploring, asking open-ended questions
- "neutral": no strong emotion detected

Rules:
- Detect the DOMINANT emotion, not every possible one
- Consider sarcasm: "oh great, another error" = frustration, not joy
- Consider cultural context (Russian/English)
- intensity: 0.0-1.0 how strong the emotion is
- urgency: 0.0-1.0 how urgent the message feels (independent of emotion)

Respond with ONLY a JSON object:
{"emotion": "...", "intensity": 0.X, "urgency": 0.X}`;
async function assessWithAI(text, config, logger) {
  const content = await callLLM(EMOTION_PROMPT, text, config, logger, 100);
  if (!content) return assess(text);
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return assess(text);
    const parsed = JSON.parse(jsonMatch[0]);
    const validEmotions = [
      "urgency",
      "frustration",
      "anger",
      "anxiety",
      "confusion",
      "gratitude",
      "joy",
      "sadness",
      "curiosity",
      "neutral"
    ];
    const emotion = validEmotions.includes(parsed.emotion) ? parsed.emotion : "neutral";
    const intensity = typeof parsed.intensity === "number" ? Math.max(0, Math.min(1, parsed.intensity)) : 0.1;
    const urgency = typeof parsed.urgency === "number" ? Math.max(0, Math.min(1, parsed.urgency)) : 0.1;
    const importance = calculateImportance(text, emotion, urgency);
    const empathyNeeded = intensity > 0.5 && ["frustration", "anger", "anxiety", "sadness", "confusion"].includes(emotion);
    const result = {
      urgency,
      importance,
      emotion,
      emotionIntensity: intensity,
      empathyNeeded,
      rationale: buildRationale(emotion, intensity, urgency)
    };
    bus.emitSync("amygdala:assessed", result);
    return result;
  } catch {
    return assess(text);
  }
}

// src/modules/mirror-neurons.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync3 } from "node:fs";
import { join as join3 } from "node:path";
function createMirrorNeurons(workspaceDir) {
  const storageDir = workspaceDir ? join3(workspaceDir, ".brainagent", "users") : "";
  const userModels = /* @__PURE__ */ new Map();
  if (storageDir && !existsSync2(storageDir)) {
    mkdirSync2(storageDir, { recursive: true });
  }
  try {
    const indexPath = join3(storageDir, "index.json");
    if (storageDir && existsSync2(indexPath)) {
      const data = JSON.parse(readFileSync2(indexPath, "utf-8"));
      for (const [id, model] of Object.entries(data)) {
        userModels.set(id, model);
      }
    }
  } catch {
  }
  function persistModels() {
    if (!storageDir) return;
    try {
      const data = Object.fromEntries(userModels);
      writeFileSync3(join3(storageDir, "index.json"), JSON.stringify(data, null, 2), "utf-8");
    } catch {
    }
  }
  function getOrCreateModel(userId) {
    let model = userModels.get(userId);
    if (!model) {
      model = createDefaultModel(userId);
      userModels.set(userId, model);
    }
    return model;
  }
  function getUserModel2(userId) {
    return userModels.get(userId);
  }
  function observe2(userId, text, amygdalaResult, config) {
    const model = getOrCreateModel(userId);
    model.emotionHistory.push({
      timestamp: Date.now(),
      emotion: amygdalaResult.emotion,
      intensity: amygdalaResult.emotionIntensity
    });
    if (model.emotionHistory.length > config.empathy.emotionHistoryLength) {
      model.emotionHistory = model.emotionHistory.slice(-config.empathy.emotionHistoryLength);
    }
    model.moodTrend = computeMoodTrend(model.emotionHistory);
    const stressEmotions = ["frustration", "anger", "anxiety", "urgency"];
    const isStressed = stressEmotions.includes(amygdalaResult.emotion);
    const alpha = 0.3;
    model.stressLevel = model.stressLevel * (1 - alpha) + (isStressed ? amygdalaResult.emotionIntensity : 0) * alpha;
    model.communicationStyle = detectStyle(text);
    model.language = detectLanguage(text);
    updateTopics(model, text);
    model.lastSeen = Date.now();
    applyTheoryOfMindUpdates(model, text, amygdalaResult, config);
    persistModels();
    bus.emit("mirror:user-updated", model);
    return model;
  }
  function processStyleReward2(userId, reward, activeStyle) {
    const model = getOrCreateModel(userId);
    if (!model.styleRewards) {
      model.styleRewards = {
        formal: { total: 0, count: 0 },
        informal: { total: 0, count: 0 },
        terse: { total: 0, count: 0 },
        verbose: { total: 0, count: 0 }
      };
    }
    const entry = model.styleRewards[activeStyle];
    entry.total += reward;
    entry.count++;
    model.preferredResponseStyle = computePreferredStyle(model);
    persistModels();
  }
  function getStyleRecommendation2(userId) {
    const model = userModels.get(userId);
    if (!model?.styleRewards) return void 0;
    const preferred = model.preferredResponseStyle ?? model.communicationStyle;
    const entry = model.styleRewards[preferred];
    if (!entry || entry.count < 3) return void 0;
    const styles = ["formal", "informal", "terse", "verbose"];
    const allAvgs = styles.map((s) => {
      const e = model.styleRewards[s];
      return e && e.count > 0 ? e.total / e.count : 0;
    }).filter((v) => v !== 0);
    const globalAvg = allAvgs.length > 0 ? allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length : 0;
    const preferredAvg = entry.total / entry.count;
    const advantage = preferredAvg - globalAvg;
    if (advantage < 0.05 && entry.count < 10) return void 0;
    const confidence = Math.min(0.95, 0.3 + advantage * 2 + Math.min(entry.count / 30, 0.3));
    const styleDescriptions = {
      formal: "Use polite, structured language with clear sections and professional tone.",
      informal: "Use conversational, friendly tone \u2014 relaxed but helpful.",
      terse: "Be concise and direct \u2014 short answers, no fluff.",
      verbose: "Provide detailed, thorough explanations with examples and context."
    };
    return {
      style: preferred,
      confidence,
      context: [
        "## Communication Style Adaptation (Personality Evolution)",
        `This user responds best to **${preferred}** communication.`,
        styleDescriptions[preferred],
        `(Based on ${entry.count} interactions, confidence: ${(confidence * 100).toFixed(0)}%)`
      ].join("\n")
    };
  }
  async function observeWithAI2(userId, text, amygdalaResult, config, neuroConfig, logger) {
    const model = getOrCreateModel(userId);
    model.emotionHistory.push({
      timestamp: Date.now(),
      emotion: amygdalaResult.emotion,
      intensity: amygdalaResult.emotionIntensity
    });
    if (model.emotionHistory.length > config.empathy.emotionHistoryLength) {
      model.emotionHistory = model.emotionHistory.slice(-config.empathy.emotionHistoryLength);
    }
    model.moodTrend = computeMoodTrend(model.emotionHistory);
    const stressEmotions = ["frustration", "anger", "anxiety", "urgency"];
    const isStressed = stressEmotions.includes(amygdalaResult.emotion);
    const alpha = 0.3;
    model.stressLevel = model.stressLevel * (1 - alpha) + (isStressed ? amygdalaResult.emotionIntensity : 0) * alpha;
    const content = await callLLM(STYLE_PROMPT, text, neuroConfig, logger, 100);
    if (content) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const validStyles = ["formal", "informal", "terse", "verbose"];
          if (validStyles.includes(parsed.style)) {
            model.communicationStyle = parsed.style;
          } else {
            model.communicationStyle = detectStyle(text);
          }
          const validExpertise = ["beginner", "intermediate", "expert"];
          if (validExpertise.includes(parsed.expertise)) {
            model.expertiseLevel = parsed.expertise;
          }
          if (parsed.language && typeof parsed.language === "string") {
            model.language = parsed.language;
          }
        } else {
          model.communicationStyle = detectStyle(text);
          model.language = detectLanguage(text);
        }
      } catch {
        model.communicationStyle = detectStyle(text);
        model.language = detectLanguage(text);
      }
    } else {
      model.communicationStyle = detectStyle(text);
      model.language = detectLanguage(text);
    }
    updateTopics(model, text);
    model.lastSeen = Date.now();
    applyTheoryOfMindUpdates(model, text, amygdalaResult, config);
    persistModels();
    bus.emit("mirror:user-updated", model);
    return model;
  }
  return {
    getOrCreateModel,
    getUserModel: getUserModel2,
    observe: observe2,
    processStyleReward: processStyleReward2,
    getStyleRecommendation: getStyleRecommendation2,
    observeWithAI: observeWithAI2
  };
}
function createDefaultModel(userId) {
  return {
    userId,
    moodTrend: "neutral",
    stressLevel: 0.2,
    communicationStyle: "informal",
    language: "ru",
    expertiseLevel: "intermediate",
    emotionHistory: [],
    frequentTopics: [],
    lastSeen: Date.now(),
    styleRewards: {
      formal: { total: 0, count: 0 },
      informal: { total: 0, count: 0 },
      terse: { total: 0, count: 0 },
      verbose: { total: 0, count: 0 }
    },
    preferredResponseStyle: "informal",
    // Theory of Mind defaults
    inferredGoals: [],
    knowledgeModel: {},
    interactionPatterns: {
      avgResponseTimeMs: 0,
      preferredTopics: [],
      peakHoursUTC: [],
      engagementStyle: "sporadic"
    },
    relationshipDepth: 0,
    mentalState: {
      currentFocus: null,
      frustrationLevel: 0,
      engagementLevel: 0.5
    },
    intentHistory: []
  };
}
function detectStyle(text) {
  const wordCount = text.split(/\s+/).length;
  if (wordCount <= 3) return "terse";
  const formalPatterns = [
    /уважаем/i,
    /пожалуйста/i,
    /будьте добры/i,
    /прошу/i,
    /dear/i,
    /please/i,
    /could you/i,
    /would you/i
  ];
  const formalHits = formalPatterns.filter((p) => p.test(text)).length;
  if (formalHits >= 2) return "formal";
  if (wordCount > 80) return "verbose";
  return "informal";
}
function detectLanguage(text) {
  const cyrillicCount = (text.match(/[а-яА-ЯёЁ]/g) ?? []).length;
  const latinCount = (text.match(/[a-zA-Z]/g) ?? []).length;
  const totalAlpha = cyrillicCount + latinCount;
  if (totalAlpha < 10) return "unknown";
  if (cyrillicCount / totalAlpha > 0.5) return "ru";
  return "en";
}
function computeMoodTrend(history) {
  if (history.length === 0) return "neutral";
  const recent = history.slice(-5);
  const counts = /* @__PURE__ */ new Map();
  for (const entry of recent) {
    counts.set(entry.emotion, (counts.get(entry.emotion) ?? 0) + entry.intensity);
  }
  let dominant = "neutral";
  let maxWeight = 0;
  for (const [emotion, weight] of counts) {
    if (weight > maxWeight) {
      maxWeight = weight;
      dominant = emotion;
    }
  }
  return dominant;
}
function updateTopics(model, text) {
  const stopwords = /* @__PURE__ */ new Set([
    "\u044D\u0442\u043E\u0442",
    "\u0442\u043E\u0433\u043E",
    "\u0431\u044B\u0442\u044C",
    "\u043A\u043E\u0442\u043E\u0440\u044B\u0439",
    "\u0442\u0430\u043A\u0436\u0435",
    "\u043A\u043E\u0433\u0434\u0430",
    "\u0435\u0441\u043B\u0438",
    "\u043C\u043E\u0436\u043D\u043E",
    "\u043D\u0443\u0436\u043D\u043E",
    "\u0431\u0443\u0434\u0435\u0442",
    "\u0431\u044B\u043B\u043E",
    "\u0431\u044B\u043B\u0438",
    "\u0435\u0441\u0442\u044C",
    "\u043E\u0447\u0435\u043D\u044C",
    "just",
    "that",
    "this",
    "with",
    "from",
    "have",
    "will",
    "been",
    "what",
    "when",
    "where",
    "which",
    "their",
    "about",
    "would"
  ]);
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 4 && !stopwords.has(w)).map((w) => w.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, "")).filter(Boolean);
  for (const word of words) {
    if (!model.frequentTopics.includes(word)) {
      model.frequentTopics.push(word);
    }
  }
  if (model.frequentTopics.length > 30) {
    model.frequentTopics = model.frequentTopics.slice(-30);
  }
}
function computePreferredStyle(model) {
  const styles = ["formal", "informal", "terse", "verbose"];
  if (!model.styleRewards) return model.communicationStyle;
  const totalSamples = styles.reduce((sum, s) => sum + (model.styleRewards[s]?.count ?? 0), 0);
  if (totalSamples < 5) return model.communicationStyle;
  let bestStyle = model.communicationStyle;
  let bestScore = -Infinity;
  for (const style of styles) {
    const entry = model.styleRewards[style];
    if (!entry || entry.count === 0) continue;
    const avgReward = entry.total / entry.count;
    const explorationBonus = Math.sqrt(Math.log(totalSamples) / entry.count) * 0.1;
    const score = avgReward + explorationBonus;
    if (score > bestScore) {
      bestScore = score;
      bestStyle = style;
    }
  }
  return bestStyle;
}
var STYLE_PROMPT = `You are a communication style detector for a conversational AI.

Analyze the user's message and determine their communication style.

Styles:
- "formal": polite, structured, professional (uses "please", formal pronouns, proper grammar)
- "informal": casual, conversational, friendly (contractions, slang, relaxed grammar)
- "terse": very brief, minimal words, to the point (1-3 word responses, commands)
- "verbose": detailed, thorough, long explanations (multiple sentences, lots of context)

Also detect:
- expertise: "beginner" | "intermediate" | "expert" \u2014 based on vocabulary and question complexity
- language: "ru" | "en" | other ISO code

Rules:
- Consider the OVERALL tone, not just individual words
- A message that says "please" once in casual context is still informal
- Technical jargon + short messages = terse expert, not formal
- Long emotional messages = verbose, even if informal

Respond with ONLY a JSON object:
{"style": "...", "expertise": "...", "language": "..."}`;
var QUESTION_PATTERNS = [
  /\?/,
  /^(как|что|почему|зачем|когда|где|кто|какой|сколько|можно\s+ли)/i,
  /^(how|what|why|when|where|who|which|can\s+you|could\s+you|is\s+it)/i
];
var COMMAND_PATTERNS2 = [
  /^(сделай|создай|запусти|удали|измени|добавь|покажи|напиши|найди|открой|установи)/i,
  /^(do|create|run|delete|change|add|show|write|find|open|install|make|build|fix|set)/i
];
var FRUSTRATION_PATTERNS = [
  /не работает/i,
  /опять/i,
  /doesn'?t work/i,
  /still broken/i,
  /again/i,
  /wtf/i,
  /блин|чёрт|черт/i
];
function ensureToMFields(model) {
  if (!model.inferredGoals) model.inferredGoals = [];
  if (!model.knowledgeModel) model.knowledgeModel = {};
  if (!model.interactionPatterns) {
    model.interactionPatterns = {
      avgResponseTimeMs: 0,
      preferredTopics: [],
      peakHoursUTC: [],
      engagementStyle: "sporadic"
    };
  }
  if (model.relationshipDepth == null) model.relationshipDepth = 0;
  if (!model.mentalState) {
    model.mentalState = { currentFocus: null, frustrationLevel: 0, engagementLevel: 0.5 };
  }
  if (!model.intentHistory) model.intentHistory = [];
}
function applyTheoryOfMindUpdates(model, text, amygdalaResult, config) {
  ensureToMFields(model);
  const maxIntentHistory = config.empathy.maxIntentHistory ?? 20;
  const domainLimit = config.empathy.knowledgeModelDomainLimit ?? 15;
  const { intent, confidence } = inferIntent(text);
  model.intentHistory.push({ timestamp: Date.now(), inferredIntent: intent, confidence });
  if (model.intentHistory.length > maxIntentHistory) {
    model.intentHistory = model.intentHistory.slice(-maxIntentHistory);
  }
  if (confidence > 0.3) {
    bus.emit("mirror:intent-inferred", { userId: model.userId, intent, confidence });
  }
  updateInferredGoals(model);
  updateKnowledgeModelToM(model, text, domainLimit);
  updateMentalState(model, text, amygdalaResult);
  updateInteractionPatterns(model);
  const prevDepth = model.relationshipDepth;
  model.relationshipDepth = computeRelationshipDepth(model);
  checkRelationshipMilestones(model, prevDepth, model.relationshipDepth);
}
function inferIntent(text) {
  const trimmed = text.trim();
  const frustrationHits = FRUSTRATION_PATTERNS.filter((p) => p.test(trimmed)).length;
  if (frustrationHits >= 1) {
    return {
      intent: "expressing_frustration",
      confidence: Math.min(0.5 + frustrationHits * 0.15, 0.95)
    };
  }
  const questionHits = QUESTION_PATTERNS.filter((p) => p.test(trimmed)).length;
  if (questionHits >= 1) {
    return {
      intent: "seeking_information",
      confidence: Math.min(0.5 + questionHits * 0.2, 0.95)
    };
  }
  const commandHits = COMMAND_PATTERNS2.filter((p) => p.test(trimmed)).length;
  if (commandHits >= 1) {
    return {
      intent: "requesting_action",
      confidence: Math.min(0.6 + commandHits * 0.15, 0.95)
    };
  }
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount <= 4) {
    const ackPatterns = [
      /^(ок|да|нет|понял|спасибо|ясно|хорошо|ладно|ага)/i,
      /^(ok|yes|no|got it|thanks|sure|right|yeah|yep|nope|cool)/i
    ];
    if (ackPatterns.some((p) => p.test(trimmed))) {
      return { intent: "acknowledging", confidence: 0.7 };
    }
  }
  const supportPatterns = [
    /помоги|не знаю что делать|запутал/i,
    /help me|i don'?t know|confused|stuck|lost/i
  ];
  if (supportPatterns.some((p) => p.test(trimmed))) {
    return { intent: "seeking_support", confidence: 0.6 };
  }
  if (wordCount > 8) {
    return { intent: "exploring_topic", confidence: 0.4 };
  }
  return { intent: "unknown", confidence: 0.2 };
}
function updateInferredGoals(model) {
  const recent = model.intentHistory.slice(-15);
  if (recent.length < 3) return;
  const intentCounts = /* @__PURE__ */ new Map();
  for (const entry of recent) {
    if (entry.inferredIntent === "unknown" || entry.inferredIntent === "acknowledging") continue;
    intentCounts.set(entry.inferredIntent, (intentCounts.get(entry.inferredIntent) ?? 0) + 1);
  }
  const goals = [];
  const infoCount = intentCounts.get("seeking_information") ?? 0;
  const actionCount = intentCounts.get("requesting_action") ?? 0;
  const exploreCount = intentCounts.get("exploring_topic") ?? 0;
  const frustCount = intentCounts.get("expressing_frustration") ?? 0;
  if (infoCount >= 3) goals.push("learning and understanding");
  if (actionCount >= 3) goals.push("building or creating something");
  if (exploreCount >= 2) goals.push("exploring new ideas");
  if (frustCount >= 2) goals.push("resolving a persistent problem");
  if (infoCount + actionCount >= 5) goals.push("active project development");
  model.inferredGoals = goals.slice(0, 5);
}
function updateKnowledgeModelToM(model, text, domainLimit) {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 5).map((w) => w.replace(/[^a-zA-Zа-яА-ЯёЁ0-9-]/g, "")).filter(Boolean);
  const domainSignals = words.slice(0, 3);
  for (const domain of domainSignals) {
    const current27 = model.knowledgeModel[domain];
    if (!current27) {
      model.knowledgeModel[domain] = "beginner";
    } else if (current27 === "beginner") {
      const topicFreq = model.frequentTopics.filter(
        (t) => t.includes(domain) || domain.includes(t)
      ).length;
      if (topicFreq >= 3) model.knowledgeModel[domain] = "familiar";
    } else if (current27 === "familiar") {
      const topicFreq = model.frequentTopics.filter(
        (t) => t.includes(domain) || domain.includes(t)
      ).length;
      if (topicFreq >= 7) model.knowledgeModel[domain] = "expert";
    }
  }
  const domains = Object.keys(model.knowledgeModel);
  if (domains.length > domainLimit) {
    const sorted = domains.sort((a, b) => {
      const aFreq = model.frequentTopics.filter((t) => t.includes(a)).length;
      const bFreq = model.frequentTopics.filter((t) => t.includes(b)).length;
      return aFreq - bFreq;
    });
    for (const d of sorted.slice(0, domains.length - domainLimit)) {
      delete model.knowledgeModel[d];
    }
  }
}
function updateMentalState(model, text, amygdalaResult) {
  const frustEmotions = /* @__PURE__ */ new Set(["frustration", "anger"]);
  const amygdalaFrustration = frustEmotions.has(amygdalaResult.emotion) ? amygdalaResult.emotionIntensity : 0;
  const textFrustration = FRUSTRATION_PATTERNS.some((p) => p.test(text)) ? 0.4 : 0;
  const alpha = 0.4;
  model.mentalState.frustrationLevel = model.mentalState.frustrationLevel * (1 - alpha) + Math.max(amygdalaFrustration, textFrustration) * alpha;
  const wordCount = text.split(/\s+/).length;
  const rawEngagement = Math.min(wordCount / 50, 1);
  model.mentalState.engagementLevel = model.mentalState.engagementLevel * 0.6 + rawEngagement * 0.4;
  const significant = text.toLowerCase().split(/\s+/).filter((w) => w.length > 5).slice(0, 3);
  model.mentalState.currentFocus = significant.length > 0 ? significant.join(", ") : null;
}
function updateInteractionPatterns(model) {
  const now = Date.now();
  const lastSeen = model.lastSeen || now;
  const gap = now - lastSeen;
  if (gap > 0 && gap < 24 * 60 * 60 * 1e3) {
    const prevAvg = model.interactionPatterns.avgResponseTimeMs || gap;
    model.interactionPatterns.avgResponseTimeMs = prevAvg * 0.7 + gap * 0.3;
  }
  const hourUTC = new Date(now).getUTCHours();
  if (!model.interactionPatterns.peakHoursUTC.includes(hourUTC)) {
    model.interactionPatterns.peakHoursUTC.push(hourUTC);
    if (model.interactionPatterns.peakHoursUTC.length > 6) {
      model.interactionPatterns.peakHoursUTC = model.interactionPatterns.peakHoursUTC.slice(-6);
    }
  }
  model.interactionPatterns.preferredTopics = model.frequentTopics.slice(-10);
  const avgMs = model.interactionPatterns.avgResponseTimeMs;
  if (avgMs > 0 && avgMs < 5 * 60 * 1e3) {
    model.interactionPatterns.engagementStyle = "active";
  } else if (avgMs < 60 * 60 * 1e3) {
    model.interactionPatterns.engagementStyle = "sporadic";
  } else {
    model.interactionPatterns.engagementStyle = "passive";
  }
}
function computeRelationshipDepth(model) {
  const interactionCount = model.emotionHistory.length;
  const interactionFactor = Math.min(interactionCount / 100, 1);
  const topicDiversity = model.frequentTopics.length;
  const topicFactor = Math.min(topicDiversity / 20, 1);
  const firstInteraction = model.emotionHistory[0]?.timestamp ?? Date.now();
  const timeSpanMs = Date.now() - firstInteraction;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1e3;
  const timeFactor = Math.min(timeSpanMs / thirtyDaysMs, 1);
  return interactionFactor * 0.4 + topicFactor * 0.3 + timeFactor * 0.3;
}
function checkRelationshipMilestones(model, prevDepth, newDepth) {
  const milestones = [
    { threshold: 0.25, label: "acquaintance" },
    { threshold: 0.5, label: "familiar" },
    { threshold: 0.75, label: "deep" }
  ];
  for (const { threshold, label } of milestones) {
    if (prevDepth < threshold && newDepth >= threshold) {
      bus.emit("mirror:relationship-deepened", {
        userId: model.userId,
        depth: newDepth,
        milestone: label
      });
    }
  }
}
var active4;
function current4() {
  return active4 ?? (active4 = createMirrorNeurons(""));
}
function initMirrorStorage(workspaceDir) {
  active4 = createMirrorNeurons(workspaceDir);
}
function getUserModel(userId) {
  return current4().getUserModel(userId);
}
function observe(userId, text, amygdalaResult, config) {
  return current4().observe(userId, text, amygdalaResult, config);
}
function processStyleReward(userId, reward, activeStyle) {
  current4().processStyleReward(userId, reward, activeStyle);
}
function getStyleRecommendation(userId) {
  return current4().getStyleRecommendation(userId);
}
function observeWithAI(userId, text, amygdalaResult, config, neuroConfig, logger) {
  return current4().observeWithAI(userId, text, amygdalaResult, config, neuroConfig, logger);
}

// src/modules/predictive-engine.ts
import { existsSync as existsSync3, mkdirSync as mkdirSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync4 } from "node:fs";
import { join as join4 } from "node:path";
function createPredictiveEngine(workspaceDir) {
  const storageDir = workspaceDir ? join4(workspaceDir, ".brainagent", "predictions") : "";
  const temporalPatterns = /* @__PURE__ */ new Map();
  const sequentialPatterns = /* @__PURE__ */ new Map();
  const contextualPatterns = /* @__PURE__ */ new Map();
  let lastDomain;
  if (storageDir && !existsSync3(storageDir)) {
    mkdirSync3(storageDir, { recursive: true });
  }
  function loadPatterns() {
    if (!storageDir) return;
    try {
      const tPath = join4(storageDir, "temporal.json");
      if (existsSync3(tPath)) {
        const data = JSON.parse(readFileSync3(tPath, "utf-8"));
        for (const [key, val] of Object.entries(data)) temporalPatterns.set(key, val);
      }
    } catch {
    }
    try {
      const sPath = join4(storageDir, "sequential.json");
      if (existsSync3(sPath)) {
        const data = JSON.parse(readFileSync3(sPath, "utf-8"));
        for (const [key, val] of Object.entries(data)) sequentialPatterns.set(key, val);
      }
    } catch {
    }
    try {
      const cPath = join4(storageDir, "contextual.json");
      if (existsSync3(cPath)) {
        const data = JSON.parse(readFileSync3(cPath, "utf-8"));
        for (const [key, val] of Object.entries(data)) contextualPatterns.set(key, val);
      }
    } catch {
    }
  }
  function persistAll() {
    if (!storageDir) return;
    try {
      writeFileSync4(
        join4(storageDir, "temporal.json"),
        JSON.stringify(Object.fromEntries(temporalPatterns), null, 2),
        "utf-8"
      );
      writeFileSync4(
        join4(storageDir, "sequential.json"),
        JSON.stringify(Object.fromEntries(sequentialPatterns), null, 2),
        "utf-8"
      );
      writeFileSync4(
        join4(storageDir, "contextual.json"),
        JSON.stringify(Object.fromEntries(contextualPatterns), null, 2),
        "utf-8"
      );
    } catch {
    }
  }
  loadPatterns();
  function observeInteraction2(domain, keywords, context) {
    const now = /* @__PURE__ */ new Date();
    const timeKey = `${now.getDay()}-${now.getHours()}`;
    let temporal = temporalPatterns.get(timeKey);
    if (!temporal) {
      temporal = { key: timeKey, domainCounts: {}, keywordCounts: {}, totalObservations: 0 };
      temporalPatterns.set(timeKey, temporal);
    }
    temporal.domainCounts[domain] = (temporal.domainCounts[domain] ?? 0) + 1;
    for (const kw of keywords.slice(0, 5)) {
      temporal.keywordCounts[kw] = (temporal.keywordCounts[kw] ?? 0) + 1;
    }
    temporal.totalObservations++;
    if (lastDomain && lastDomain !== domain) {
      let sequential = sequentialPatterns.get(lastDomain);
      if (!sequential) {
        sequential = { trigger: lastDomain, followers: {}, totalTransitions: 0 };
        sequentialPatterns.set(lastDomain, sequential);
      }
      sequential.followers[domain] = (sequential.followers[domain] ?? 0) + 1;
      sequential.totalTransitions++;
    }
    lastDomain = domain;
    if (context) {
      let ctx = contextualPatterns.get(context);
      if (!ctx) {
        ctx = { context, topicCounts: {}, totalObservations: 0 };
        contextualPatterns.set(context, ctx);
      }
      ctx.topicCounts[domain] = (ctx.topicCounts[domain] ?? 0) + 1;
      for (const kw of keywords.slice(0, 3)) {
        ctx.topicCounts[kw] = (ctx.topicCounts[kw] ?? 0) + 1;
      }
      ctx.totalObservations++;
    }
    persistAll();
  }
  function predict2(currentContext) {
    const predictions = [];
    const now = /* @__PURE__ */ new Date();
    const timeKey = `${now.getDay()}-${now.getHours()}`;
    const temporal = temporalPatterns.get(timeKey);
    if (temporal && temporal.totalObservations >= 3) {
      const topDomain = getTopEntry(temporal.domainCounts);
      if (topDomain) {
        const confidence = temporal.domainCounts[topDomain.key] / temporal.totalObservations;
        if (confidence > 0.3) {
          const dayName = ["\u0412\u0441", "\u041F\u043D", "\u0412\u0442", "\u0421\u0440", "\u0427\u0442", "\u041F\u0442", "\u0421\u0431"][now.getDay()];
          predictions.push({
            type: "temporal",
            predictedTopic: topDomain.key,
            confidence,
            reasoning: `\u041F\u043E ${dayName} \u0432 ${now.getHours()}:00 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043E\u0431\u044B\u0447\u043D\u043E \u043E\u0431\u0441\u0443\u0436\u0434\u0430\u0435\u0442: ${topDomain.key} (${(confidence * 100).toFixed(0)}% \u0438\u0437 ${temporal.totalObservations} \u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u0439)`
          });
        }
      }
      const topKeyword = getTopEntry(temporal.keywordCounts);
      if (topKeyword) {
        const kwConf = temporal.keywordCounts[topKeyword.key] / temporal.totalObservations;
        if (kwConf > 0.3 && topKeyword.key !== topDomain?.key) {
          predictions.push({
            type: "temporal",
            predictedTopic: topKeyword.key,
            confidence: kwConf * 0.8,
            // Slightly lower for keywords
            reasoning: `\u0427\u0430\u0441\u0442\u0430\u044F \u0442\u0435\u043C\u0430 \u0432 \u044D\u0442\u043E \u0432\u0440\u0435\u043C\u044F: "${topKeyword.key}"`
          });
        }
      }
    }
    if (lastDomain) {
      const sequential = sequentialPatterns.get(lastDomain);
      if (sequential && sequential.totalTransitions >= 2) {
        const topFollower = getTopEntry(sequential.followers);
        if (topFollower) {
          const confidence = sequential.followers[topFollower.key] / sequential.totalTransitions;
          if (confidence > 0.25) {
            predictions.push({
              type: "sequential",
              predictedTopic: topFollower.key,
              confidence,
              reasoning: `\u041F\u043E\u0441\u043B\u0435 "${lastDomain}" \u043E\u0431\u044B\u0447\u043D\u043E \u0441\u043B\u0435\u0434\u0443\u0435\u0442 "${topFollower.key}" (${(confidence * 100).toFixed(0)}% \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u043E\u0432)`
            });
          }
        }
      }
    }
    if (currentContext) {
      const ctx = contextualPatterns.get(currentContext);
      if (ctx && ctx.totalObservations >= 2) {
        const topTopic = getTopEntry(ctx.topicCounts);
        if (topTopic) {
          const confidence = ctx.topicCounts[topTopic.key] / ctx.totalObservations;
          if (confidence > 0.3) {
            predictions.push({
              type: "contextual",
              predictedTopic: topTopic.key,
              confidence,
              reasoning: `\u0412 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0435 "${currentContext}" \u043E\u0431\u044B\u0447\u043D\u043E \u043E\u0431\u0441\u0443\u0436\u0434\u0430\u0435\u0442\u0441\u044F: "${topTopic.key}"`
            });
          }
        }
      }
    }
    predictions.sort((a, b) => b.confidence - a.confidence);
    const seen = /* @__PURE__ */ new Set();
    return predictions.filter((p) => {
      if (seen.has(p.predictedTopic)) return false;
      seen.add(p.predictedTopic);
      return true;
    });
  }
  function getStats2() {
    let totalObs = 0;
    for (const t of temporalPatterns.values()) totalObs += t.totalObservations;
    return {
      temporalPatterns: temporalPatterns.size,
      sequentialPatterns: sequentialPatterns.size,
      contextualPatterns: contextualPatterns.size,
      totalObservations: totalObs
    };
  }
  return { observeInteraction: observeInteraction2, predict: predict2, getStats: getStats2 };
}
function getTopEntry(counts) {
  let topKey;
  let topCount = 0;
  for (const [key, count] of Object.entries(counts)) {
    if (count > topCount) {
      topCount = count;
      topKey = key;
    }
  }
  return topKey ? { key: topKey, count: topCount } : void 0;
}
var active5;
function current5() {
  return active5 ?? (active5 = createPredictiveEngine(""));
}
function initPredictiveStorage(workspaceDir) {
  active5 = createPredictiveEngine(workspaceDir);
}
function observeInteraction(domain, keywords, context) {
  current5().observeInteraction(domain, keywords, context);
}
function predict(currentContext) {
  return current5().predict(currentContext);
}
function getPredictiveStats() {
  return current5().getStats();
}

// src/modules/basal-ganglia.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync4, readFileSync as readFileSync4, writeFileSync as writeFileSync5 } from "node:fs";
import { join as join5 } from "node:path";

// src/modules/i18n-heuristics.ts
var POSITIVE_PATTERNS = [
  // Русский
  { re: /спасибо/i, label: "\u0441\u043F\u0430\u0441\u0438\u0431\u043E" },
  { re: /благодар(?:ю|ствую)/i, label: "\u0431\u043B\u0430\u0433\u043E\u0434\u0430\u0440\u044E" },
  { re: /отлично/i, label: "\u043E\u0442\u043B\u0438\u0447\u043D\u043E" },
  { re: /супер/i, label: "\u0441\u0443\u043F\u0435\u0440" },
  { re: /круто/i, label: "\u043A\u0440\u0443\u0442\u043E" },
  { re: /класс(?:но)?/i, label: "\u043A\u043B\u0430\u0441\u0441" },
  { re: /молодец/i, label: "\u043C\u043E\u043B\u043E\u0434\u0435\u0446" },
  { re: /умница/i, label: "\u0443\u043C\u043D\u0438\u0446\u0430" },
  { re: /здорово/i, label: "\u0437\u0434\u043E\u0440\u043E\u0432\u043E" },
  { re: /идеально/i, label: "\u0438\u0434\u0435\u0430\u043B\u044C\u043D\u043E" },
  { re: /в\s+точку/i, label: "\u0432 \u0442\u043E\u0447\u043A\u0443" },
  { re: /именно\s+то/i, label: "\u0438\u043C\u0435\u043D\u043D\u043E \u0442\u043E" },
  { re: /(?<![а-яё])топ(?![а-яё])/i, label: "\u0442\u043E\u043F" },
  { re: /(?<![а-яё])огонь(?![а-яё])/i, label: "\u043E\u0433\u043E\u043D\u044C" },
  { re: /помогло/i, label: "\u043F\u043E\u043C\u043E\u0433\u043B\u043E" },
  { re: /работает/i, label: "\u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442" },
  // English
  { re: /perfect/i, label: "perfect" },
  { re: /great/i, label: "great" },
  { re: /thanks/i, label: "thanks" },
  { re: /thank\s+you/i, label: "thank you" },
  { re: /awesome/i, label: "awesome" },
  { re: /excellent/i, label: "excellent" },
  { re: /good\s+job/i, label: "good job" },
  { re: /nice/i, label: "nice" },
  { re: /love\s+it/i, label: "love it" },
  { re: /well\s+done/i, label: "well done" },
  { re: /that\s+helped/i, label: "that helped" }
];
var NEGATIVE_PATTERNS = [
  // Русский
  { re: /не\s+то(?![а-яё])/i, label: "\u043D\u0435 \u0442\u043E" },
  { re: /неправильно/i, label: "\u043D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u043E" },
  { re: /ошибка/i, label: "\u043E\u0448\u0438\u0431\u043A\u0430" },
  { re: /переделай/i, label: "\u043F\u0435\u0440\u0435\u0434\u0435\u043B\u0430\u0439" },
  { re: /заново/i, label: "\u0437\u0430\u043D\u043E\u0432\u043E" },
  { re: /не\s+так(?![а-яё])/i, label: "\u043D\u0435 \u0442\u0430\u043A" },
  { re: /плохо/i, label: "\u043F\u043B\u043E\u0445\u043E" },
  { re: /неверно/i, label: "\u043D\u0435\u0432\u0435\u0440\u043D\u043E" },
  { re: /не\s+получилось/i, label: "\u043D\u0435 \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u043E\u0441\u044C" },
  { re: /не\s+работает/i, label: "\u043D\u0435 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442" },
  { re: /ты\s+меня\s+не\s+понял/i, label: "\u0442\u044B \u043C\u0435\u043D\u044F \u043D\u0435 \u043F\u043E\u043D\u044F\u043B" },
  // English
  { re: /wrong/i, label: "wrong" },
  { re: /incorrect/i, label: "incorrect" },
  { re: /redo/i, label: "redo" },
  { re: /\bfix\b/i, label: "fix" },
  { re: /try\s+again/i, label: "try again" },
  { re: /no,?\s+that'?s\s+not/i, label: "that's not it" },
  { re: /you\s+misunderstood/i, label: "misunderstood" }
];
var REJECTION_PATTERNS = [
  // Русский
  { re: /не\s+надо(?![а-яё])/i, label: "\u043D\u0435 \u043D\u0430\u0434\u043E" },
  { re: /(?<![а-яё])хватит(?![а-яё])/i, label: "\u0445\u0432\u0430\u0442\u0438\u0442" },
  { re: /перестань/i, label: "\u043F\u0435\u0440\u0435\u0441\u0442\u0430\u043D\u044C" },
  { re: /прекрати/i, label: "\u043F\u0440\u0435\u043A\u0440\u0430\u0442\u0438" },
  { re: /отстань/i, label: "\u043E\u0442\u0441\u0442\u0430\u043D\u044C" },
  { re: /(?<![а-яё])забей(?![а-яё])/i, label: "\u0437\u0430\u0431\u0435\u0439" },
  { re: /не\s+интересно/i, label: "\u043D\u0435 \u0438\u043D\u0442\u0435\u0440\u0435\u0441\u043D\u043E" },
  { re: /мне\s+это\s+не\s+(?:нужно|интересно)/i, label: "\u043C\u043D\u0435 \u044D\u0442\u043E \u043D\u0435 \u043D\u0443\u0436\u043D\u043E" },
  { re: /больше\s+(?:так\s+)?не\s+(?:делай|пиши|говори)/i, label: "\u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0434\u0435\u043B\u0430\u0439" },
  { re: /не\s+заводи/i, label: "\u043D\u0435 \u0437\u0430\u0432\u043E\u0434\u0438" },
  { re: /достало/i, label: "\u0434\u043E\u0441\u0442\u0430\u043B\u043E" },
  { re: /задолбало/i, label: "\u0437\u0430\u0434\u043E\u043B\u0431\u0430\u043B\u043E" },
  { re: /бесишь/i, label: "\u0431\u0435\u0441\u0438\u0448\u044C" },
  { re: /замолчи/i, label: "\u0437\u0430\u043C\u043E\u043B\u0447\u0438" },
  // English
  { re: /stop\s+it/i, label: "stop it" },
  { re: /don'?t\s+(?:do|say|mention|bring\s+up)\b/i, label: "don't do that" },
  { re: /not\s+interested/i, label: "not interested" },
  { re: /\bleave\s+it\b/i, label: "leave it" },
  { re: /\bdrop\s+it\b/i, label: "drop it" },
  { re: /cut\s+it\s+out/i, label: "cut it out" },
  { re: /knock\s+it\s+off/i, label: "knock it off" },
  { re: /shut\s+up/i, label: "shut up" },
  { re: /leave\s+me\s+alone/i, label: "leave me alone" }
];
function matchBank(text, bank) {
  const hits = [];
  for (const { re, label } of bank) {
    if (re.test(text)) hits.push(label);
  }
  return hits;
}
function classifyFeedback(text) {
  const trimmed = text.trim();
  if (!trimmed) return { signal: "neutral", hits: [] };
  const rejectionHits = matchBank(trimmed, REJECTION_PATTERNS);
  if (rejectionHits.length > 0) {
    return { signal: "rejection", hits: rejectionHits };
  }
  const negativeHits = matchBank(trimmed, NEGATIVE_PATTERNS);
  if (negativeHits.length > 0) {
    return { signal: "negative", hits: negativeHits };
  }
  const positiveHits = matchBank(trimmed, POSITIVE_PATTERNS);
  if (positiveHits.length > 0) {
    return { signal: "positive", hits: positiveHits };
  }
  return { signal: "neutral", hits: [] };
}

// src/modules/basal-ganglia.ts
var MIN_ACTIVATIONS_FOR_AUTO = 3;
var MIN_REWARD_FOR_AUTO = 0.6;
var MAX_HABITS = 200;
function createBasalGanglia(workspaceDir) {
  const storageDir = workspaceDir ? join5(workspaceDir, ".brainagent", "habits") : "";
  let habits = [];
  let habitIndex = new VectorIndex();
  let idCounter = 0;
  function nextHabitId() {
    return `hab-${Date.now()}-${++idCounter}`;
  }
  if (storageDir && !existsSync4(storageDir)) {
    mkdirSync4(storageDir, { recursive: true });
  }
  function loadHabits() {
    if (!storageDir) return;
    try {
      const path = join5(storageDir, "habits.json");
      if (existsSync4(path)) {
        habits = JSON.parse(readFileSync4(path, "utf-8"));
      }
    } catch {
      habits = [];
    }
  }
  function persistHabits() {
    if (!storageDir) return;
    try {
      writeFileSync5(join5(storageDir, "habits.json"), JSON.stringify(habits, null, 2), "utf-8");
    } catch {
    }
  }
  function rebuildIndex() {
    for (const habit of habits) {
      habitIndex.add(habit.id, `${habit.cue} ${habit.domain} ${habit.routine.join(" ")}`);
    }
  }
  loadHabits();
  rebuildIndex();
  function findHabit2(input, domain) {
    if (habits.length === 0) return void 0;
    const results = habitIndex.search(`${input} ${domain}`, 5, 0.2);
    if (results.length === 0) return void 0;
    let bestMatch;
    let bestScore = 0;
    for (const result of results) {
      const habit = habits.find((h) => h.id === result.id);
      if (!habit) continue;
      const matchScore = result.score * 0.5 + habit.rewardSignal * 0.3 + (habit.domain === domain ? 0.2 : 0);
      if (matchScore > bestScore) {
        bestScore = matchScore;
        const autoExecute = habit.activationCount >= MIN_ACTIVATIONS_FOR_AUTO && habit.rewardSignal >= MIN_REWARD_FOR_AUTO && result.score > 0.5;
        bestMatch = { habit, matchScore, autoExecute };
      }
    }
    return bestMatch;
  }
  function recordPattern3(cue, routine, domain, exampleResponse) {
    const existing = habitIndex.search(`${cue} ${domain}`, 1, 0.6);
    if (existing.length > 0) {
      const habit2 = habits.find((h) => h.id === existing[0].id);
      if (habit2) {
        habit2.activationCount++;
        habit2.lastActivated = Date.now();
        if (routine.length > 0 && JSON.stringify(routine) !== JSON.stringify(habit2.routine)) {
          if (routine.length >= habit2.routine.length) {
            habit2.routine = routine;
          }
        }
        if (exampleResponse) {
          habit2.exampleResponses.push(exampleResponse.slice(0, 500));
          if (habit2.exampleResponses.length > 3) {
            habit2.exampleResponses = habit2.exampleResponses.slice(-3);
          }
        }
        habitIndex.add(habit2.id, `${habit2.cue} ${habit2.domain} ${habit2.routine.join(" ")}`);
        persistHabits();
        return habit2;
      }
    }
    const habit = {
      id: nextHabitId(),
      cue,
      routine,
      domain,
      rewardSignal: 0.5,
      // Neutral start
      activationCount: 1,
      positiveReinforcements: 0,
      negativeReinforcements: 0,
      lastActivated: Date.now(),
      createdAt: Date.now(),
      exampleResponses: exampleResponse ? [exampleResponse.slice(0, 500)] : []
    };
    habits.push(habit);
    habitIndex.add(habit.id, `${cue} ${domain} ${routine.join(" ")}`);
    if (habits.length > MAX_HABITS) {
      pruneWeakHabits();
    }
    persistHabits();
    return habit;
  }
  function reinforce2(habitId, signal) {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    const alpha = 0.2;
    switch (signal) {
      case "positive":
        habit.positiveReinforcements++;
        habit.rewardSignal = habit.rewardSignal * (1 - alpha) + 1 * alpha;
        break;
      case "negative":
        habit.negativeReinforcements++;
        habit.rewardSignal = habit.rewardSignal * (1 - alpha) + 0 * alpha;
        break;
      case "neutral":
        habit.rewardSignal = habit.rewardSignal * (1 - alpha * 0.5) + 0.5 * (alpha * 0.5);
        break;
    }
    habit.rewardSignal = Math.max(0, Math.min(1, habit.rewardSignal));
    persistHabits();
  }
  function pruneWeakHabits() {
    const scored = habits.map((h) => ({
      habit: h,
      score: h.rewardSignal * 0.4 + Math.min(h.activationCount / 10, 1) * 0.4 + 1 / (1 + (Date.now() - h.lastActivated) / (7 * 24 * 60 * 60 * 1e3)) * 0.2
    }));
    scored.sort((a, b) => b.score - a.score);
    const toKeep = scored.slice(0, MAX_HABITS).map((s) => s.habit);
    const toRemove = scored.slice(MAX_HABITS).map((s) => s.habit);
    for (const h of toRemove) {
      habitIndex.remove(h.id);
    }
    habits = toKeep;
  }
  function getStats2() {
    const automated = habits.filter(
      (h) => h.activationCount >= MIN_ACTIVATIONS_FOR_AUTO && h.rewardSignal >= MIN_REWARD_FOR_AUTO
    ).length;
    const avgReward = habits.length > 0 ? habits.reduce((sum, h) => sum + h.rewardSignal, 0) / habits.length : 0;
    const totalAct = habits.reduce((sum, h) => sum + h.activationCount, 0);
    return {
      totalHabits: habits.length,
      automatedHabits: automated,
      averageReward: avgReward,
      totalActivations: totalAct
    };
  }
  return { findHabit: findHabit2, recordPattern: recordPattern3, reinforce: reinforce2, getStats: getStats2 };
}
function detectReinforcement(text) {
  const signal = classifyFeedback(text).signal;
  if (signal === "positive") return "positive";
  if (signal === "negative" || signal === "rejection") return "negative";
  return "neutral";
}
var REINFORCEMENT_PROMPT = `You are a reinforcement signal detector for a conversational AI system.

Your task: analyze the user's message and determine if it contains feedback about the AI's previous response.

Classification:
- "positive": user is satisfied, pleased, grateful, approving (even implicitly)
- "negative": user is correcting, dissatisfied, re-asking, or the previous answer was wrong
- "neutral": no feedback about previous interaction quality

IMPORTANT:
- Detect IMPLICIT feedback, not just keywords. "Well, the first version was better" = negative.
- "Can you also..." after accepting = positive (they liked it, want more).
- Sarcasm like "great, now nothing works" = negative.
- Simple follow-up questions with no sentiment = neutral.
- "ok" / "\u043B\u0430\u0434\u043D\u043E" alone = neutral (acknowledgment, not praise).

Respond with ONLY a JSON object:
{"signal": "positive"|"negative"|"neutral", "confidence": 0.0-1.0}`;
async function detectReinforcementWithAI(text, config, logger) {
  const content = await callLLM(REINFORCEMENT_PROMPT, text, config, logger, 100);
  if (!content) return detectReinforcement(text);
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return detectReinforcement(text);
    const parsed = JSON.parse(jsonMatch[0]);
    const signal = parsed.signal;
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
    if (signal === "positive" && confidence >= 0.5) return "positive";
    if (signal === "negative" && confidence >= 0.5) return "negative";
    if (signal === "neutral") return "neutral";
    return detectReinforcement(text);
  } catch {
    return detectReinforcement(text);
  }
}
function buildHabitContext(match) {
  const h = match.habit;
  const lines = [
    "## Learned Habit Available (Basal Ganglia)",
    `Pattern: "${h.cue}"`,
    `Domain: ${h.domain}`,
    `Success rate: ${(h.rewardSignal * 100).toFixed(0)}% (${h.activationCount} activations)`
  ];
  if (h.routine.length > 0) {
    lines.push(`Known routine: ${h.routine.join(" \u2192 ")}`);
  }
  if (h.exampleResponses.length > 0) {
    lines.push("Previous successful response approach:");
    lines.push(`  "${h.exampleResponses[h.exampleResponses.length - 1]}"`);
  }
  if (match.autoExecute) {
    lines.push("This is a well-established habit. Follow the learned pattern for efficiency.");
  } else {
    lines.push("This pattern is still being learned. Use as a reference but apply judgment.");
  }
  return lines.join("\n");
}
var active6;
function current6() {
  return active6 ?? (active6 = createBasalGanglia(""));
}
function initBasalStorage(workspaceDir) {
  active6 = createBasalGanglia(workspaceDir);
}
function findHabit(input, domain) {
  return current6().findHabit(input, domain);
}
function recordPattern(cue, routine, domain, exampleResponse) {
  return current6().recordPattern(cue, routine, domain, exampleResponse);
}
function reinforce(habitId, signal) {
  current6().reinforce(habitId, signal);
}
function getBasalStats() {
  return current6().getStats();
}

// src/modules/introspection.ts
import { existsSync as existsSync5, mkdirSync as mkdirSync5, readFileSync as readFileSync5, writeFileSync as writeFileSync6 } from "node:fs";
import { join as join6 } from "node:path";
function createIntrospection(workspaceDir, config) {
  const storageDir = workspaceDir ? join6(workspaceDir, ".brainagent", "introspection") : "";
  const traces = [];
  let currentTrace = null;
  let maxTraces = config?.introspection.maxTraces ?? 3;
  const injectConfidence = config?.introspection.injectConfidence ?? true;
  const selfDialogue = [];
  const metaSnapshots = [];
  let maxSelfDialogue = config?.introspection.maxSelfDialogue ?? 10;
  let maxMetaSnapshots = config?.introspection.maxMetaSnapshots ?? 5;
  function loadState() {
    if (!storageDir) return;
    try {
      const path = join6(storageDir, "traces.json");
      if (existsSync5(path)) {
        const raw = JSON.parse(readFileSync5(path, "utf-8"));
        traces.length = 0;
        selfDialogue.length = 0;
        metaSnapshots.length = 0;
        if (Array.isArray(raw)) {
          traces.push(...raw);
        } else {
          if (Array.isArray(raw.traces)) traces.push(...raw.traces);
          if (Array.isArray(raw.selfDialogue)) selfDialogue.push(...raw.selfDialogue);
          if (Array.isArray(raw.metaSnapshots)) metaSnapshots.push(...raw.metaSnapshots);
        }
      }
    } catch {
      traces.length = 0;
      selfDialogue.length = 0;
      metaSnapshots.length = 0;
    }
  }
  function persistState() {
    if (!storageDir) return;
    try {
      writeFileSync6(
        join6(storageDir, "traces.json"),
        JSON.stringify({ traces, selfDialogue, metaSnapshots }, null, 2),
        "utf-8"
      );
    } catch {
    }
  }
  function startTrace2(input) {
    currentTrace = {
      id: `trace_${Date.now()}`,
      startedAt: Date.now(),
      completedAt: 0,
      steps: [],
      finalConfidence: 0,
      cerebellumPassed: true,
      reward: 0,
      inputSnippet: input.length > 100 ? input.slice(0, 100) + "..." : input
    };
  }
  function addTraceStep2(module, hook, output) {
    if (!currentTrace) return;
    const step = {
      module,
      hook,
      timestamp: Date.now(),
      outputSummary: output.length > 100 ? output.slice(0, 100) + "..." : output
    };
    currentTrace.steps.push(step);
  }
  function completeTrace2(cerebellumPassed, issues, reward) {
    if (!currentTrace) return;
    currentTrace.completedAt = Date.now();
    currentTrace.cerebellumPassed = cerebellumPassed;
    currentTrace.reward = reward;
    const factors = [];
    let confidence = 0;
    const cerebellumScore = cerebellumPassed ? 1 : Math.max(0, 1 - issues.length * 0.25);
    confidence += cerebellumScore * 0.4;
    factors.push(`cerebellum=${(cerebellumScore * 100).toFixed(0)}%`);
    const thoroughnessScore = Math.min(1, currentTrace.steps.length / 6);
    confidence += thoroughnessScore * 0.2;
    factors.push(`thoroughness=${(thoroughnessScore * 100).toFixed(0)}%`);
    const rewardScore = Math.max(0, Math.min(1, (reward + 1) / 2));
    confidence += rewardScore * 0.4;
    factors.push(`reward=${(rewardScore * 100).toFixed(0)}%`);
    currentTrace.finalConfidence = Math.max(0, Math.min(1, confidence));
    traces.push(currentTrace);
    while (traces.length > maxTraces) {
      traces.shift();
    }
    persistState();
    bus.emitSync("introspection:trace-complete", currentTrace);
    bus.emitSync("introspection:confidence-assessed", {
      confidence: currentTrace.finalConfidence,
      factors
    });
    currentTrace = null;
  }
  function buildConfidenceContext2() {
    if (!injectConfidence || traces.length === 0) return void 0;
    const avgConfidence = traces.reduce((sum, t) => sum + t.finalConfidence, 0) / traces.length;
    if (avgConfidence > 0.7) return void 0;
    return [
      "## Self-Assessment (Introspection)",
      avgConfidence < 0.5 ? "Recent responses have been uncertain \u2014 be extra careful and precise." : "Double-check reasoning for accuracy."
    ].join("\n");
  }
  function getLastTrace2() {
    return traces.length > 0 ? traces[traces.length - 1] : void 0;
  }
  function getIntrospectionStats2() {
    const avg = traces.length > 0 ? traces.reduce((sum, t) => sum + t.finalConfidence, 0) / traces.length : 0;
    return {
      traceCount: traces.length,
      avgConfidence: avg,
      selfDialogueCount: selfDialogue.length,
      metaSnapshotCount: metaSnapshots.length
    };
  }
  function detectConsciousnessGaps() {
    const gaps = [];
    if (traces.length === 0) {
      gaps.push("No processing history \u2014 cannot assess own performance");
    }
    if (traces.length > 0) {
      const avgConf = traces.reduce((s, t) => s + t.finalConfidence, 0) / traces.length;
      if (avgConf < 0.5) {
        gaps.push(
          `Low average confidence (${(avgConf * 100).toFixed(0)}%) \u2014 uncertain about own outputs`
        );
      }
    }
    const recentFailures = traces.filter((t) => !t.cerebellumPassed).length;
    if (recentFailures > 0) {
      gaps.push(`${recentFailures} recent validation failure(s) \u2014 quality assurance gaps`);
    }
    if (selfDialogue.length === 0) {
      gaps.push("No self-dialogue recorded \u2014 limited introspective depth");
    }
    const negReward = traces.filter((t) => t.reward < 0).length;
    if (negReward > 0) {
      gaps.push(`${negReward} negative-reward interaction(s) \u2014 unresolved issues`);
    }
    return gaps;
  }
  function reflectOnConsciousness2() {
    const now = Date.now();
    let consciousnessState = "clear";
    if (traces.length === 0) {
      consciousnessState = "diffuse";
    } else {
      const recent = traces[traces.length - 1];
      const avgConf = traces.reduce((sum, t) => sum + t.finalConfidence, 0) / traces.length;
      if (avgConf > 0.7 && recent.cerebellumPassed) {
        consciousnessState = "focused";
      } else if (avgConf < 0.4) {
        consciousnessState = "fragmented";
      } else if (recent.steps.length <= 2) {
        consciousnessState = "diffuse";
      } else {
        consciousnessState = "clear";
      }
    }
    const gaps = detectConsciousnessGaps();
    const lastSnapshot = metaSnapshots.length > 0 ? metaSnapshots[metaSnapshots.length - 1] : null;
    const changeDetected = lastSnapshot ? lastSnapshot.consciousnessState !== consciousnessState || gaps.length !== lastSnapshot.gapsDetected.length : true;
    const snapshot = {
      timestamp: now,
      consciousnessState,
      gapsDetected: gaps,
      changeDetected
    };
    metaSnapshots.push(snapshot);
    if (metaSnapshots.length > maxMetaSnapshots) {
      metaSnapshots.splice(0, metaSnapshots.length - maxMetaSnapshots);
    }
    if (gaps.length > 0) {
      bus.emitSync("meta:gap-detected", { gaps });
    }
    persistState();
    return snapshot;
  }
  function askSelf(question) {
    const now = Date.now();
    const qLower = question.toLowerCase();
    let answer;
    if (qLower.includes("confident") || qLower.includes("confidence")) {
      const avg = traces.length > 0 ? traces.reduce((s, t) => s + t.finalConfidence, 0) / traces.length : 0;
      answer = `My average confidence is ${(avg * 100).toFixed(0)}%. ${avg > 0.7 ? "I feel relatively sure about my recent outputs." : avg > 0.4 ? "I have moderate confidence \u2014 some uncertainty remains." : "I am quite uncertain and should proceed carefully."}`;
    } else if (qLower.includes("feeling") || qLower.includes("state")) {
      const last = metaSnapshots.length > 0 ? metaSnapshots[metaSnapshots.length - 1] : null;
      answer = last ? `My consciousness state is "${last.consciousnessState}" with ${last.gapsDetected.length} detected gap(s).` : "I haven't assessed my consciousness state yet.";
    } else if (qLower.includes("improve") || qLower.includes("better")) {
      const gaps = detectConsciousnessGaps();
      answer = gaps.length > 0 ? `I could improve by addressing: ${gaps.slice(0, 3).join("; ")}.` : "No obvious improvement areas detected right now.";
    } else if (qLower.includes("why") || qLower.includes("reason")) {
      const last = traces.length > 0 ? traces[traces.length - 1] : null;
      answer = last ? `My last response involved ${last.steps.length} processing steps and achieved ${(last.finalConfidence * 100).toFixed(0)}% confidence.` : "I have no recent processing trace to analyze.";
    } else {
      answer = `I currently have ${traces.length} processing trace(s), ${selfDialogue.length} dialogue entries, and ${metaSnapshots.length} meta-awareness snapshot(s).`;
    }
    const entry = { timestamp: now, question, answer };
    selfDialogue.push(entry);
    if (selfDialogue.length > maxSelfDialogue) {
      selfDialogue.splice(0, selfDialogue.length - maxSelfDialogue);
    }
    persistState();
    bus.emitSync("meta:self-question", { question, answer });
    return entry;
  }
  function buildMetaConsciousnessContext() {
    if (metaSnapshots.length === 0 && selfDialogue.length === 0) return void 0;
    const lines = ["## Meta-Consciousness (Introspection)"];
    if (metaSnapshots.length > 0) {
      const latest = metaSnapshots[metaSnapshots.length - 1];
      const stateMap = {
        focused: "Maintain precision",
        fragmented: "Slow down and focus",
        diffuse: "Broad awareness mode",
        clear: void 0
        // normal state, no injection needed
      };
      const instruction = stateMap[latest.consciousnessState];
      if (instruction) {
        lines.push(instruction);
      }
    }
    return lines.length > 1 ? lines.join("\n") : void 0;
  }
  function getSelfDialogue() {
    return [...selfDialogue];
  }
  function getMetaSnapshots() {
    return [...metaSnapshots];
  }
  function getRecentLowConfidenceCount(threshold = 0.5) {
    return traces.filter((t) => t.finalConfidence < threshold).length;
  }
  if (storageDir) {
    if (!existsSync5(storageDir)) {
      mkdirSync5(storageDir, { recursive: true });
    }
    maxTraces = config?.introspection.maxTraces ?? maxTraces;
    maxSelfDialogue = config?.introspection.maxSelfDialogue ?? maxSelfDialogue;
    maxMetaSnapshots = config?.introspection.maxMetaSnapshots ?? maxMetaSnapshots;
    loadState();
  }
  return {
    startTrace: startTrace2,
    addTraceStep: addTraceStep2,
    completeTrace: completeTrace2,
    buildConfidenceContext: buildConfidenceContext2,
    getLastTrace: getLastTrace2,
    getIntrospectionStats: getIntrospectionStats2,
    reflectOnConsciousness: reflectOnConsciousness2,
    detectConsciousnessGaps,
    askSelf,
    buildMetaConsciousnessContext,
    getSelfDialogue,
    getMetaSnapshots,
    getRecentLowConfidenceCount
  };
}
var active7 = null;
function current7() {
  if (!active7) active7 = createIntrospection("");
  return active7;
}
function initIntrospection(workspaceDir, config) {
  active7 = createIntrospection(workspaceDir, config);
}
function startTrace(input) {
  current7().startTrace(input);
}
function addTraceStep(module, hook, output) {
  current7().addTraceStep(module, hook, output);
}
function completeTrace(cerebellumPassed, issues, reward) {
  current7().completeTrace(cerebellumPassed, issues, reward);
}
function buildConfidenceContext() {
  return current7().buildConfidenceContext();
}
function getLastTrace() {
  return current7().getLastTrace();
}
function getIntrospectionStats() {
  return current7().getIntrospectionStats();
}
function reflectOnConsciousness() {
  return current7().reflectOnConsciousness();
}

// src/modules/neural-pathways.ts
import { existsSync as existsSync7, mkdirSync as mkdirSync7, readFileSync as readFileSync7, writeFileSync as writeFileSync7 } from "node:fs";
import { join as join8 } from "node:path";

// src/modules/dopamine-system.ts
import { existsSync as existsSync6, mkdirSync as mkdirSync6, readFileSync as readFileSync6 } from "node:fs";
import { join as join7 } from "node:path";
function createDopamineSystem(workspaceDir) {
  const storageDir = join7(workspaceDir, ".brainagent", "neuromodulators");
  if (!existsSync6(storageDir)) {
    mkdirSync6(storageDir, { recursive: true });
  }
  cancelPersist(join7(storageDir, "state.json"));
  let state = {
    dopamine: 0.5,
    serotonin: 0.6,
    norepinephrine: 0.3,
    acetylcholine: 0.4
  };
  let expectedReward = 0.5;
  let rewardHistory = [];
  let positiveOutcomeRatio = 0.5;
  let noveltyCounter = 0;
  let totalInteractions = 0;
  function loadState() {
    try {
      const path = join7(storageDir, "state.json");
      if (existsSync6(path)) {
        const data = JSON.parse(readFileSync6(path, "utf-8"));
        state = data.state;
        expectedReward = data.expectedReward;
        rewardHistory = data.rewardHistory ?? [];
        positiveOutcomeRatio = data.positiveOutcomeRatio ?? 0.5;
        noveltyCounter = data.noveltyCounter ?? 0;
        totalInteractions = data.totalInteractions ?? 0;
      }
    } catch {
    }
  }
  function persistState() {
    schedulePersist(
      join7(storageDir, "state.json"),
      () => JSON.stringify(
        {
          state,
          expectedReward,
          rewardHistory: rewardHistory.slice(-100),
          // Keep last 100
          positiveOutcomeRatio,
          noveltyCounter,
          totalInteractions
        },
        null,
        2
      )
    );
  }
  loadState();
  function updateDopamine(predictionError, config) {
    const baseline = config.neuromodulators.baselineDopamine;
    const decay = config.neuromodulators.dopamineDecayRate;
    const spike = predictionError * 0.5;
    state.dopamine = state.dopamine * (1 - decay) + (baseline + spike) * decay;
    state.dopamine = Math.max(0, Math.min(1, state.dopamine));
  }
  function updateSerotonin(reward) {
    const alpha = 0.15;
    positiveOutcomeRatio = positiveOutcomeRatio * (1 - alpha) + (reward > 0 ? 1 : 0) * alpha;
    state.serotonin = 0.3 + positiveOutcomeRatio * 0.5;
    state.serotonin = Math.max(0.1, Math.min(0.95, state.serotonin));
  }
  function updateNorepinephrine(complexity, emotion) {
    const complexityBoost = {
      trivial: 0.1,
      simple: 0.2,
      moderate: 0.4,
      complex: 0.7,
      extreme: 0.9
    };
    const emotionBoost = {
      urgency: 0.8,
      anxiety: 0.6,
      frustration: 0.5,
      anger: 0.7,
      confusion: 0.4,
      curiosity: 0.3,
      neutral: 0.1,
      joy: 0.1,
      gratitude: 0.1,
      sadness: 0.3
    };
    const target = Math.max(complexityBoost[complexity] ?? 0.3, emotionBoost[emotion] ?? 0.2);
    const alpha = 0.3;
    state.norepinephrine = state.norepinephrine * (1 - alpha) + target * alpha;
    state.norepinephrine = Math.max(0.05, Math.min(0.95, state.norepinephrine));
  }
  function updateAcetylcholine(_domain, _config) {
    const noveltyRatio = totalInteractions > 10 ? noveltyCounter / totalInteractions : 0.5;
    const target = 0.3 + noveltyRatio * 0.5;
    const alpha = 0.2;
    state.acetylcholine = state.acetylcholine * (1 - alpha) + target * alpha;
    state.acetylcholine = Math.max(0.1, Math.min(0.9, state.acetylcholine));
  }
  function processOutcome(params, config) {
    totalInteractions++;
    let reward = 0;
    switch (params.userSignal) {
      case "positive":
        reward += 0.35;
        break;
      case "negative":
        reward -= 0.35;
        break;
      case "neutral":
        reward += 0.05;
        break;
    }
    if (params.cerebellumPassed) {
      reward += 0.15;
    } else {
      reward -= 0.15 * Math.min(params.cerebellumIssues.length, 3);
    }
    if (params.habitAutoExecuted && params.userSignal !== "negative") {
      reward += 0.1;
    }
    if (params.predictionWasCorrect === true) {
      reward += 0.15;
    } else if (params.predictionWasCorrect === false) {
      reward -= 0.05;
    }
    if (params.curiosityGapClosed) {
      reward += 0.25;
    }
    if (params.goalCompleted) {
      reward += 0.3;
    }
    if (params.insightUsed) {
      reward += 0.15;
    }
    if (params.socialReciprocity) {
      reward += 0.1;
    }
    reward = Math.max(-1, Math.min(1, reward));
    const predictionError = reward - expectedReward;
    const alphaExpected = 0.1;
    expectedReward = expectedReward * (1 - alphaExpected) + reward * alphaExpected;
    const creditAssignment = computeCreditAssignment(
      params.participatingModules,
      params.cerebellumIssues
    );
    updateDopamine(predictionError, config);
    updateSerotonin(reward);
    updateNorepinephrine(params.complexity, params.emotion);
    updateAcetylcholine(params.domain, config);
    rewardHistory.push({ reward, timestamp: Date.now() });
    if (rewardHistory.length > 200) {
      rewardHistory = rewardHistory.slice(-100);
    }
    const signal = {
      reward,
      predictionError,
      participatingModules: params.participatingModules,
      creditAssignment,
      context: {
        domain: params.domain,
        complexity: params.complexity,
        emotion: params.emotion,
        input: params.input.slice(0, 200)
      }
    };
    bus.emitSync("dopamine:reward", signal);
    bus.emitSync("neuromodulator:state-changed", { ...state });
    if (Math.abs(predictionError) > 0.3) {
      bus.emitSync("dopamine:prediction-error", {
        error: predictionError,
        context: `${params.domain}/${params.complexity}: ${predictionError > 0 ? "better than expected" : "worse than expected"}`
      });
    }
    persistState();
    return signal;
  }
  function getStats2() {
    const recent = rewardHistory.slice(-20);
    const avgReward = recent.length > 0 ? recent.reduce((s, r) => s + r.reward, 0) / recent.length : 0;
    return {
      currentState: { ...state },
      expectedReward,
      recentRewards: recent.length,
      averageReward: avgReward,
      totalInteractions,
      noveltyRatio: totalInteractions > 0 ? noveltyCounter / totalInteractions : 0
    };
  }
  return {
    processOutcome,
    markNovelty: () => {
      noveltyCounter++;
    },
    getState: () => ({ ...state }),
    getEffectiveLearningRate: (baseLearningRate, config) => {
      const achBoost = 1 + (state.acetylcholine - 0.5) * (config.neuromodulators.acetylcholineLearningBoost - 1);
      const dopamineBoost = 0.7 + state.dopamine * 0.6;
      return baseLearningRate * achBoost * dopamineBoost;
    },
    getRiskTolerance: () => state.serotonin,
    getAttentionLevel: () => state.norepinephrine,
    getStats: getStats2,
    stop: () => {
    },
    dispose: () => {
    }
  };
}
function computeCreditAssignment(modules, issues) {
  if (modules.length === 0) return {};
  const credit = {};
  const baseShare = 1 / modules.length;
  const issueText = issues.join(" ").toLowerCase();
  const blamedModules = /* @__PURE__ */ new Set();
  const moduleIssueKeywords = {
    thalamus: ["classification", "domain", "complexity", "misclassif"],
    amygdala: ["emotion", "empathy", "urgency", "tone"],
    hippocampus: ["memory", "recall", "facts", "forgot"],
    prefrontalCortex: ["reasoning", "model", "complex", "incomplete"],
    cerebellum: ["quality", "validation"],
    mirrorNeurons: ["style", "language", "user model"],
    predictiveEngine: ["prediction", "anticipat", "pattern"],
    basalGanglia: ["habit", "routine", "automated"]
  };
  for (const [mod, keywords] of Object.entries(moduleIssueKeywords)) {
    if (modules.includes(mod) && keywords.some((kw) => issueText.includes(kw))) {
      blamedModules.add(mod);
    }
  }
  const blamedPenalty = blamedModules.size > 0 ? 0.3 / blamedModules.size : 0;
  const bonusForClean = blamedModules.size > 0 ? 0.3 / (modules.length - blamedModules.size || 1) : 0;
  for (const mod of modules) {
    if (blamedModules.has(mod)) {
      credit[mod] = Math.max(0, baseShare - blamedPenalty);
    } else {
      credit[mod] = baseShare + bonusForClean;
    }
  }
  const total = Object.values(credit).reduce((s, v) => s + v, 0);
  if (total > 0) {
    for (const mod of Object.keys(credit)) {
      credit[mod] = credit[mod] / total;
    }
  }
  return credit;
}
var active8;
function initDopamineSystem(workspaceDir) {
  active8?.dispose();
  active8 = createDopamineSystem(workspaceDir);
}
function processInteractionOutcome(params, config) {
  if (!active8) {
    return {
      reward: 0,
      predictionError: 0,
      participatingModules: params.participatingModules,
      creditAssignment: {},
      context: {
        domain: params.domain,
        complexity: params.complexity,
        emotion: params.emotion,
        input: params.input.slice(0, 200)
      }
    };
  }
  return active8.processOutcome(params, config);
}
function markNovelty() {
  active8?.markNovelty();
}
function getNeuromodulatorState() {
  return active8?.getState() ?? {
    dopamine: 0.5,
    serotonin: 0.6,
    norepinephrine: 0.3,
    acetylcholine: 0.4
  };
}
function getAttentionLevel() {
  return active8?.getAttentionLevel() ?? 0.3;
}
function getDopamineStats() {
  return active8?.getStats() ?? {
    currentState: getNeuromodulatorState(),
    expectedReward: 0.5,
    recentRewards: 0,
    averageReward: 0,
    totalInteractions: 0,
    noveltyRatio: 0
  };
}

// src/modules/neural-pathways.ts
var PATHWAY_NAMES = [
  "cerebellum\u2192basal-ganglia",
  "predictive\u2192thalamus",
  "basal-ganglia\u2192predictive",
  "dopamine\u2192all",
  "neuromodulator-cache",
  "learning\u2192system",
  "dream\u2192cross-module",
  "mirror\u2192system"
];
function createDefaultSynapticState() {
  const weights = {};
  for (const name2 of PATHWAY_NAMES) {
    weights[name2] = {
      weight: 1,
      activationCount: 0,
      totalReward: 0,
      recentActivations: [],
      lastUpdated: Date.now()
    };
  }
  return {
    weights,
    learningRate: 0.1,
    decayRate: 0.01,
    totalCycles: 0
  };
}
var DEFAULT_NEURO_STATE = {
  dopamine: 0.5,
  serotonin: 0.6,
  norepinephrine: 0.3,
  acetylcholine: 0.4
};
function computeSynapticStats(synapticState) {
  const pathways = [];
  let strongestPathway = null;
  let weakestPathway = null;
  let maxWeight = 0;
  let minWeight = Infinity;
  for (const name2 of PATHWAY_NAMES) {
    const w = synapticState.weights[name2];
    if (!w) continue;
    const avgReward = w.activationCount > 0 ? w.totalReward / w.activationCount : 0;
    let trend = "stable";
    if (w.recentActivations.length >= 10) {
      const firstHalf = w.recentActivations.slice(0, Math.floor(w.recentActivations.length / 2));
      const secondHalf = w.recentActivations.slice(Math.floor(w.recentActivations.length / 2));
      const firstAvg = firstHalf.reduce((s, a) => s + a.reward, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, a) => s + a.reward, 0) / secondHalf.length;
      if (secondAvg - firstAvg > 0.1) trend = "strengthening";
      else if (secondAvg - firstAvg < -0.1) trend = "weakening";
    }
    pathways.push({
      name: name2,
      weight: w.weight,
      activationCount: w.activationCount,
      avgReward,
      trend
    });
    if (w.weight > maxWeight) {
      maxWeight = w.weight;
      strongestPathway = name2;
    }
    if (w.weight < minWeight) {
      minWeight = w.weight;
      weakestPathway = name2;
    }
  }
  pathways.sort((a, b) => b.weight - a.weight);
  return {
    totalCycles: synapticState.totalCycles,
    learningRate: synapticState.learningRate,
    pathways,
    strongestPathway,
    weakestPathway
  };
}
function buildNeuromodulatorContextFromState(neuroState) {
  const significantDev = Math.abs(neuroState.dopamine - 0.5) > 0.2 || Math.abs(neuroState.norepinephrine - 0.3) > 0.2 || Math.abs(neuroState.serotonin - 0.6) > 0.15;
  if (!significantDev) return void 0;
  const lines = ["## Cognitive State (Neuromodulators)"];
  if (neuroState.dopamine > 0.7) {
    lines.push(
      "- High motivation/confidence: recent interactions went well. You can be more proactive and suggest improvements."
    );
  } else if (neuroState.dopamine < 0.3) {
    lines.push(
      "- Low motivation: recent interactions had issues. Be extra careful and precise. Double-check your answers."
    );
  }
  if (neuroState.norepinephrine > 0.6) {
    lines.push(
      "- High attention mode: the task requires focus. Retrieve more context from memory and be thorough."
    );
  }
  if (neuroState.serotonin < 0.35) {
    lines.push("- Conservative mode: stick to proven approaches. Avoid risky suggestions.");
  } else if (neuroState.serotonin > 0.75) {
    lines.push("- Exploratory mode: you can suggest creative alternatives and novel approaches.");
  }
  if (neuroState.acetylcholine > 0.7) {
    lines.push(
      "- High learning mode: pay extra attention to new information from the user. Update your understanding actively."
    );
  }
  return lines.length > 1 ? lines.join("\n") : void 0;
}
function createNeuralPathways(workspaceDir, config, logger) {
  const storageDir = join8(workspaceDir, ".brainagent", "synapses");
  if (!existsSync7(storageDir)) {
    mkdirSync7(storageDir, { recursive: true });
  }
  const synapticState = createDefaultSynapticState();
  const activatedPathways = /* @__PURE__ */ new Set();
  let lastPredictions = [];
  let currentCycleHabitId;
  let lastCerebellumIssues = [];
  let currentNeuroState = { ...DEFAULT_NEURO_STATE };
  function markPathwayActivation(pathway) {
    activatedPathways.add(pathway);
  }
  function applyHebbianLearning(reward) {
    if (activatedPathways.size === 0) return;
    const { learningRate, decayRate, minWeight, maxWeight } = config.synapticPlasticity;
    const now = Date.now();
    for (const pathwayName of activatedPathways) {
      const weight = synapticState.weights[pathwayName];
      if (!weight) continue;
      const oldWeight = weight.weight;
      const delta = learningRate * reward * weight.weight;
      let newWeight = weight.weight + delta;
      newWeight = newWeight + decayRate * (1 - newWeight);
      newWeight = Math.max(minWeight, Math.min(maxWeight, newWeight));
      weight.weight = newWeight;
      weight.activationCount++;
      weight.totalReward += reward;
      weight.lastUpdated = now;
      weight.recentActivations.push({ timestamp: now, reward });
      if (weight.recentActivations.length > config.synapticPlasticity.activationHistorySize) {
        weight.recentActivations = weight.recentActivations.slice(
          -config.synapticPlasticity.activationHistorySize
        );
      }
      const significantChange = Math.abs(newWeight - oldWeight) > 0.05;
      if (significantChange) {
        bus.emitSync("synapse:weight-updated", {
          pathway: pathwayName,
          oldWeight,
          newWeight,
          reward
        });
        if (newWeight > oldWeight) {
          bus.emitSync("synapse:pathway-strengthened", { pathway: pathwayName, weight: newWeight });
        } else {
          bus.emitSync("synapse:pathway-weakened", { pathway: pathwayName, weight: newWeight });
        }
        logger?.info(
          `Synapse: ${pathwayName} weight ${oldWeight.toFixed(3)} \u2192 ${newWeight.toFixed(3)} (reward: ${reward.toFixed(2)})`
        );
      }
    }
    synapticState.totalCycles++;
    if (synapticState.totalCycles % 10 === 0) {
      saveSynapticState();
    }
    activatedPathways.clear();
  }
  function loadSynapticState() {
    try {
      const path = join8(storageDir, "weights.json");
      if (existsSync7(path)) {
        const data = JSON.parse(readFileSync7(path, "utf-8"));
        for (const name2 of PATHWAY_NAMES) {
          if (data.weights[name2]) {
            synapticState.weights[name2] = data.weights[name2];
          }
        }
        synapticState.totalCycles = data.totalCycles ?? 0;
        logger?.info(
          `Synapse: loaded weights from ${synapticState.totalCycles} cycles of learning`
        );
      }
    } catch {
    }
  }
  function saveSynapticState() {
    try {
      writeFileSync7(
        join8(storageDir, "weights.json"),
        JSON.stringify(synapticState, null, 2),
        "utf-8"
      );
    } catch {
    }
  }
  loadSynapticState();
  synapticState.learningRate = config.synapticPlasticity.learningRate;
  synapticState.decayRate = config.synapticPlasticity.decayRate;
  const unsubs = [];
  unsubs.push(
    bus.on("cerebellum:validated", (data) => {
      lastCerebellumIssues = data.issues;
      markPathwayActivation("cerebellum\u2192basal-ganglia");
      if (currentCycleHabitId) {
        if (data.passed) {
          reinforce(currentCycleHabitId, "positive");
          bus.emitSync("pathway:memory-reinforced", {
            source: "cerebellum\u2192basal-ganglia",
            memoryId: currentCycleHabitId,
            layer: "procedural"
          });
        } else if (data.issues.length >= 2) {
          reinforce(currentCycleHabitId, "negative");
          logger?.info(
            `NeuralPathway: cerebellum\u2192basal-ganglia \u2014 weakening habit ${currentCycleHabitId} (${data.issues.length} issues)`
          );
        }
      }
    })
  );
  unsubs.push(
    bus.on("predictive:predicted", (data) => {
      lastPredictions = data.predictions;
    })
  );
  unsubs.push(
    bus.on("thalamus:classified", (classification) => {
      if (lastPredictions.length === 0) return;
      markPathwayActivation("predictive\u2192thalamus");
      const matched = lastPredictions.find(
        (p) => p.topic.toLowerCase() === classification.domain.toLowerCase()
      );
      if (matched) {
        bus.emitSync("pathway:prediction-validated", {
          predictionTopic: matched.topic,
          wasCorrect: true
        });
        logger?.info(
          `NeuralPathway: prediction validated \u2014 "${matched.topic}" was correct (${(matched.confidence * 100).toFixed(0)}% confidence)`
        );
      } else {
        markNovelty();
        for (const pred of lastPredictions) {
          bus.emitSync("pathway:prediction-validated", {
            predictionTopic: pred.topic,
            wasCorrect: false
          });
        }
      }
      lastPredictions = [];
    })
  );
  unsubs.push(
    bus.on("basal:habit-matched", (data) => {
      currentCycleHabitId = data.habitId;
      markPathwayActivation("basal-ganglia\u2192predictive");
      if (data.autoExecute && data.matchScore > 0.7) {
        bus.emitSync("pathway:habit-promoted", {
          source: "basal-ganglia\u2192predictive-engine",
          habitId: data.habitId,
          confidence: data.matchScore
        });
      }
    })
  );
  unsubs.push(
    bus.on("dopamine:reward", (signal) => {
      markPathwayActivation("dopamine\u2192all");
      applyHebbianLearning(signal.reward);
      if (signal.reward < -0.3) {
        logger?.info(
          `NeuralPathway: strong negative reward (${signal.reward.toFixed(2)}) \u2014 modules: ${signal.participatingModules.join(", ")}`
        );
      }
    })
  );
  unsubs.push(
    bus.on("neuromodulator:state-changed", (newState) => {
      markPathwayActivation("neuromodulator-cache");
      currentNeuroState = newState;
    })
  );
  unsubs.push(
    bus.on("learning:insight-discovered", (insight) => {
      if (!insight.actionable) return;
      markPathwayActivation("learning\u2192system");
      logger?.info(
        `NeuralPathway: learning insight \u2014 [${insight.type}] ${insight.description}`
      );
    })
  );
  unsubs.push(
    bus.on("dream:consolidation-complete", (data) => {
      markPathwayActivation("dream\u2192cross-module");
      if (data.merged > 0 || data.pruned > 0) {
        logger?.info(
          `NeuralPathway: post-consolidation \u2014 ${data.merged} merged, ${data.pruned} pruned \u2192 memory state updated`
        );
      }
    })
  );
  unsubs.push(
    bus.on("mirror:user-updated", (userModel) => {
      markPathwayActivation("mirror\u2192system");
      if (userModel.stressLevel > 0.7) {
        logger?.info(
          `NeuralPathway: mirror\u2192system \u2014 high user stress detected (${(userModel.stressLevel * 100).toFixed(0)}%), adapting responses`
        );
      }
    })
  );
  logger?.info(
    "NeuralPathways: 8 cross-module pathways initialized with synaptic plasticity"
  );
  function teardown() {
    for (const unsub of unsubs) unsub();
    unsubs.length = 0;
    saveSynapticState();
  }
  function resetCycleState2() {
    currentCycleHabitId = void 0;
    lastCerebellumIssues = [];
    activatedPathways.clear();
  }
  return {
    resetCycleState: resetCycleState2,
    getCachedNeuroState: () => ({ ...currentNeuroState }),
    getLastCerebellumIssues: () => [...lastCerebellumIssues],
    getPathwayStats: () => ({
      pathwayCount: 8,
      lastPredictionCount: lastPredictions.length,
      currentHabitId: currentCycleHabitId,
      neuroState: { ...currentNeuroState },
      totalLearningCycles: synapticState.totalCycles
    }),
    getSynapticStats: () => computeSynapticStats(synapticState),
    buildNeuromodulatorContext: () => buildNeuromodulatorContextFromState(currentNeuroState),
    stop: teardown,
    dispose: teardown
  };
}
var active9;
function initNeuralPathways(workspaceDir, config, logger) {
  active9?.dispose();
  active9 = createNeuralPathways(workspaceDir, config, logger);
}
function resetCycleState() {
  active9?.resetCycleState();
}
function getPathwayStats() {
  return active9?.getPathwayStats() ?? {
    pathwayCount: 8,
    lastPredictionCount: 0,
    currentHabitId: void 0,
    neuroState: { ...DEFAULT_NEURO_STATE },
    totalLearningCycles: 0
  };
}
function getSynapticStats() {
  return active9?.getSynapticStats() ?? computeSynapticStats(createDefaultSynapticState());
}
function buildNeuromodulatorContext() {
  return active9?.buildNeuromodulatorContext();
}

// src/modules/working-memory.ts
import { existsSync as existsSync8, mkdirSync as mkdirSync8, readFileSync as readFileSync8, writeFileSync as writeFileSync8 } from "node:fs";
import { join as join9 } from "node:path";
var DEFAULT_MAX_ENTRIES = 7;
var DEFAULT_SUMMARY_MAX_LENGTH = 200;
function createWorkingMemory(workspaceDir, opts) {
  const storageDir = workspaceDir ? join9(workspaceDir, ".brainagent", "working-memory") : "";
  const maxEntries = opts.maxEntries;
  const summaryMaxLength = opts.summaryMaxLength;
  let entries = [];
  if (storageDir && !existsSync8(storageDir)) {
    mkdirSync8(storageDir, { recursive: true });
  }
  function loadState() {
    if (!storageDir) return;
    try {
      const path = join9(storageDir, "state.json");
      if (existsSync8(path)) {
        const data = JSON.parse(readFileSync8(path, "utf-8"));
        entries = Array.isArray(data) ? data : [];
      }
    } catch {
      entries = [];
    }
  }
  function persistState() {
    if (!storageDir) return;
    try {
      writeFileSync8(join9(storageDir, "state.json"), JSON.stringify(entries, null, 2), "utf-8");
    } catch {
    }
  }
  loadState();
  function storeCompletedCycle2(entry) {
    entries.push(entry);
    while (entries.length > maxEntries) {
      entries.shift();
    }
    persistState();
    bus.emitSync("working-memory:entry-added", {
      entryIndex: entries.length - 1,
      cycleInput: entry.inputSnippet
    });
  }
  function buildContext(_currentInput) {
    if (entries.length === 0) return void 0;
    const lines = [
      "## Recent Conversation Thread (Working Memory)",
      `Last ${entries.length} interaction(s):`
    ];
    for (const entry of entries) {
      const emotionTag = entry.emotion !== "neutral" ? ` [${entry.emotion}]` : "";
      lines.push(
        `- [${entry.domain}/${entry.complexity}]${emotionTag} User: "${entry.inputSnippet}" -> Response quality: ${entry.cerebellumPassed ? "good" : "had issues"}`
      );
    }
    bus.emitSync("working-memory:context-built", { entriesUsed: entries.length });
    return lines.join("\n");
  }
  function clear() {
    entries = [];
    persistState();
  }
  function getStats2() {
    return {
      entryCount: entries.length,
      oldestTimestamp: entries.length > 0 ? entries[0].timestamp : null,
      newestTimestamp: entries.length > 0 ? entries[entries.length - 1].timestamp : null
    };
  }
  function truncate(text) {
    if (text.length <= summaryMaxLength) return text;
    return text.slice(0, summaryMaxLength) + "...";
  }
  return { storeCompletedCycle: storeCompletedCycle2, buildContext, clear, getStats: getStats2, truncate };
}
var active10;
function current8() {
  return active10 ?? (active10 = createWorkingMemory("", {
    maxEntries: DEFAULT_MAX_ENTRIES,
    summaryMaxLength: DEFAULT_SUMMARY_MAX_LENGTH
  }));
}
function initWorkingMemoryStorage(workspaceDir, config) {
  active10 = createWorkingMemory(workspaceDir, {
    maxEntries: config.workingMemory.maxEntries,
    summaryMaxLength: config.workingMemory.summaryMaxLength
  });
}
function storeCompletedCycle(entry) {
  current8().storeCompletedCycle(entry);
}
function buildWorkingMemoryContext(currentInput) {
  return current8().buildContext(currentInput);
}
function getWorkingMemoryStats() {
  return current8().getStats();
}
function truncateForWorkingMemory(text) {
  return current8().truncate(text);
}

// src/modules/ai-extractor.ts
var EXTRACTION_PROMPT = `\u0422\u044B \u2014 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u0438\u0437\u0432\u043B\u0435\u0447\u0435\u043D\u0438\u044F \u0444\u0430\u043A\u0442\u043E\u0432 \u0438\u0437 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F.

\u0422\u0432\u043E\u044F \u0437\u0430\u0434\u0430\u0447\u0430: \u043D\u0430\u0439\u0442\u0438 \u0438 \u0438\u0437\u0432\u043B\u0435\u0447\u044C \u0412\u0421\u0415 \u0424\u0410\u041A\u0422\u042B \u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435 \u0438\u0437 \u0435\u0433\u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F.

\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u0444\u0430\u043A\u0442\u043E\u0432:
- user_preference: \u043F\u0440\u0435\u0434\u043F\u043E\u0447\u0442\u0435\u043D\u0438\u044F, \u0445\u043E\u0431\u0431\u0438, \u0438\u043D\u0442\u0435\u0440\u0435\u0441\u044B ("\u043D\u0440\u0430\u0432\u0438\u0442\u0441\u044F X", "\u043B\u044E\u0431\u043B\u044E Y", "\u043F\u0440\u0435\u0434\u043F\u043E\u0447\u0438\u0442\u0430\u044E Z")
- user_info: \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F \u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435 (\u0438\u043C\u044F, \u0432\u043E\u0437\u0440\u0430\u0441\u0442, \u0433\u043E\u0440\u043E\u0434, \u0440\u0430\u0431\u043E\u0442\u0430, \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C, \u0437\u043D\u0430\u043A \u0437\u043E\u0434\u0438\u0430\u043A\u0430, \u0434\u0430\u0442\u0430 \u0440\u043E\u0436\u0434\u0435\u043D\u0438\u044F, \u0438\u043C\u0443\u0449\u0435\u0441\u0442\u0432\u043E)
- entity: \u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u043E\u0431\u044A\u0435\u043A\u0442\u044B, \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438, \u0431\u0440\u0435\u043D\u0434\u044B, \u043C\u0435\u0441\u0442\u0430, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0443\u043F\u043E\u043C\u0438\u043D\u0430\u0435\u0442 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C
- relationship: \u0441\u0432\u044F\u0437\u0438 \u043C\u0435\u0436\u0434\u0443 \u043E\u0431\u044A\u0435\u043A\u0442\u0430\u043C\u0438 ("X \u0441\u0432\u044F\u0437\u0430\u043D \u0441 Y")
- definition: \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F ("X \u044D\u0442\u043E Y", "X \u043E\u0437\u043D\u0430\u0447\u0430\u0435\u0442 Y")
- problem: \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u044B \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F (\u0431\u043E\u043B\u0435\u0437\u043D\u0438, \u043F\u043E\u043B\u043E\u043C\u043A\u0438, \u0442\u0440\u0443\u0434\u043D\u043E\u0441\u0442\u0438)
- plan: \u043F\u043B\u0430\u043D\u044B \u0438 \u043D\u0430\u043C\u0435\u0440\u0435\u043D\u0438\u044F ("\u043D\u0443\u0436\u043D\u043E \u0441\u0434\u0435\u043B\u0430\u0442\u044C X", "\u0441\u043E\u0431\u0438\u0440\u0430\u044E\u0441\u044C Y", "\u043F\u043B\u0430\u043D\u0438\u0440\u0443\u044E Z")
- solution: \u0440\u0435\u0448\u0451\u043D\u043D\u044B\u0435 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u044B

\u041F\u0440\u0430\u0432\u0438\u043B\u0430:
1. \u0418\u0437\u0432\u043B\u0435\u043A\u0430\u0439 \u0442\u043E\u043B\u044C\u043A\u043E \u042F\u0412\u041D\u042B\u0415 \u0444\u0430\u043A\u0442\u044B, \u043D\u0435 \u0434\u043E\u0434\u0443\u043C\u044B\u0432\u0430\u0439
2. \u041A\u0430\u0436\u0434\u044B\u0439 \u0444\u0430\u043A\u0442 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0441\u0430\u043C\u043E\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u044B\u043C \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435\u043C
3. Confidence \u043E\u0442 0.5 \u0434\u043E 1.0 (\u043D\u0430\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0442\u044B \u0443\u0432\u0435\u0440\u0435\u043D)
4. \u0415\u0441\u043B\u0438 \u0444\u0430\u043A\u0442\u043E\u0432 \u043D\u0435\u0442 \u2014 \u0432\u0435\u0440\u043D\u0438 \u043F\u0443\u0441\u0442\u043E\u0439 \u043C\u0430\u0441\u0441\u0438\u0432
5. \u0412\u0410\u0416\u041D\u041E: \u043F\u0435\u0440\u0435\u0447\u0438\u0441\u043B\u0435\u043D\u0438\u044F \u0447\u0435\u0440\u0435\u0437 "\u0438"/"," \u0440\u0430\u0437\u0431\u0438\u0432\u0430\u0439 \u043D\u0430 \u041E\u0422\u0414\u0415\u041B\u042C\u041D\u042B\u0415 \u0444\u0430\u043A\u0442\u044B.
   \u041F\u0440\u0438\u043C\u0435\u0440: "\u043B\u044E\u0431\u043B\u044E \u0440\u044B\u0431\u0430\u043B\u043A\u0443 \u0438 \u043E\u043D\u043B\u0430\u0439\u043D \u0438\u0433\u0440\u044B" \u2192 \u0414\u0412\u0410 \u0444\u0430\u043A\u0442\u0430:
   {"content": "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043B\u044E\u0431\u0438\u0442 \u0440\u044B\u0431\u0430\u043B\u043A\u0443", "category": "user_preference", "confidence": 0.85}
   {"content": "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043B\u044E\u0431\u0438\u0442 \u043E\u043D\u043B\u0430\u0439\u043D \u0438\u0433\u0440\u044B", "category": "user_preference", "confidence": 0.85}
6. \u0414\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C \u0438 \u043C\u0435\u0441\u0442\u043E \u0440\u0430\u0431\u043E\u0442\u044B \u2014 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u0444\u0430\u043A\u0442\u044B.
   \u041F\u0440\u0438\u043C\u0435\u0440: "\u0440\u0430\u0431\u043E\u0442\u0430\u044E \u0433\u043B\u0430\u0432\u043D\u044B\u043C \u043C\u0435\u0442\u0440\u043E\u043B\u043E\u0433\u043E\u043C \u043D\u0430 \u0437\u0430\u0432\u043E\u0434\u0435" \u2192
   {"content": "\u0414\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: \u0433\u043B\u0430\u0432\u043D\u044B\u0439 \u043C\u0435\u0442\u0440\u043E\u043B\u043E\u0433", "category": "user_info", "confidence": 0.9}
   {"content": "\u041C\u0435\u0441\u0442\u043E \u0440\u0430\u0431\u043E\u0442\u044B: \u0437\u0430\u0432\u043E\u0434", "category": "user_info", "confidence": 0.9}

\u041E\u0442\u0432\u0435\u0442 \u0422\u041E\u041B\u042C\u041A\u041E \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 JSON \u043C\u0430\u0441\u0441\u0438\u0432\u0430:
[
  {"content": "...", "category": "...", "confidence": 0.X},
  ...
]`;
async function extractFactsWithAI(text, config, logger) {
  const content = await callLLM(EXTRACTION_PROMPT, text, config, logger, 500);
  if (!content) return [];
  const facts = parseFactsFromResponse(content);
  if (facts.length > 0) {
    logger?.info(`BrainAgent AI Extractor: found ${facts.length} facts`);
  }
  return facts;
}
function parseFactsFromResponse(content) {
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    const validCategories = [
      "user_preference",
      "user_info",
      "entity",
      "relationship",
      "definition",
      "plan",
      "problem",
      "solution"
    ];
    const facts = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;
      const obj = item;
      const factContent = obj.content;
      const category = obj.category;
      const confidence = obj.confidence;
      if (typeof factContent !== "string" || factContent.length < 3) continue;
      if (typeof category !== "string" || !validCategories.includes(category))
        continue;
      const conf = typeof confidence === "number" ? confidence : typeof confidence === "string" ? parseFloat(confidence) : 0.7;
      if (conf < 0.5 || conf > 1) continue;
      facts.push({
        content: factContent,
        category,
        confidence: conf
      });
    }
    return facts;
  } catch {
    return [];
  }
}
function isAIProviderAvailable2(config) {
  return isAIProviderAvailable(config);
}

// src/modules/cerebellum.ts
function validate(response, originalInput, classification, assessment, userModel) {
  const issues = [];
  const suggestions = [];
  checkProportionality(response, originalInput, classification, issues, suggestions);
  if (assessment && userModel) {
    checkToneAlignment(response, assessment, userModel, issues, suggestions);
  }
  checkSensitiveData(response, issues);
  checkCompleteness(response, originalInput, issues, suggestions);
  if (userModel) {
    checkLanguageConsistency(response, userModel, issues, suggestions);
  }
  checkInternalExposure(response, issues);
  const passed = issues.length === 0;
  bus.emitSync("cerebellum:validated", { passed, issues });
  return { passed, issues, suggestions };
}
function checkProportionality(response, input, classification, issues, suggestions) {
  const inputWords = input.split(/\s+/).length;
  const responseWords = response.split(/\s+/).length;
  if (classification?.complexity === "trivial" && responseWords > 200) {
    suggestions.push(
      "Response may be too verbose for a simple question. Consider being more concise."
    );
  }
  if (classification?.complexity === "complex" && responseWords < 10) {
    issues.push("Response seems too brief for a complex question.");
  }
  if (responseWords > 2e3) {
    suggestions.push("Response is very long. Consider breaking into sections or summarizing.");
  }
}
function checkToneAlignment(response, assessment, userModel, issues, suggestions) {
  if (assessment.empathyNeeded) {
    const empathyMarkers = [
      /понимаю/i,
      /сочувств/i,
      /помогу/i,
      /давайте/i,
      /understand/i,
      /help/i,
      /let me/i,
      /I see/i
    ];
    const hasEmpathy = empathyMarkers.some((m) => m.test(response));
    if (!hasEmpathy) {
      suggestions.push(
        "User seems distressed. Consider starting with an empathetic acknowledgment."
      );
    }
  }
  if (userModel.communicationStyle === "formal") {
    const casualMarkers = [/ок\b/i, /ладно/i, /ну\b/i, /йо\b/i, /lol/i, /haha/i];
    const isCasual = casualMarkers.some((m) => m.test(response));
    if (isCasual) {
      suggestions.push("User prefers formal communication. Adjust tone accordingly.");
    }
  }
}
function checkSensitiveData(response, issues) {
  const sensitivePatterns = [
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, name: "email address" },
    { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, name: "card number" },
    { pattern: /sk-[a-zA-Z0-9]{20,}/, name: "API key (OpenAI format)" },
    { pattern: /ghp_[a-zA-Z0-9]{36}/, name: "GitHub token" },
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/, name: "SSN pattern" }
  ];
  for (const { pattern, name: name2 } of sensitivePatterns) {
    if (pattern.test(response)) {
      issues.push(`Response may contain sensitive data: ${name2}. Review before sending.`);
    }
  }
}
function checkCompleteness(response, input, issues, suggestions) {
  const questionCount = (input.match(/\?/g) ?? []).length;
  if (questionCount > 1) {
    const hasStructure = /\d+\.\s/.test(response) || // numbered list
    /^#{1,3}\s/m.test(response) || // markdown headers
    response.split("\n\n").length >= questionCount;
    if (!hasStructure && questionCount >= 3) {
      suggestions.push(
        `Input contains ${questionCount} questions. Consider structuring the response with numbered answers.`
      );
    }
  }
}
function checkLanguageConsistency(response, userModel, issues, _suggestions) {
  const cyrillicCount = (response.match(/[а-яА-ЯёЁ]/g) ?? []).length;
  const latinCount = (response.match(/[a-zA-Z]/g) ?? []).length;
  const totalAlpha = cyrillicCount + latinCount;
  if (totalAlpha < 40) return;
  const ratio = cyrillicCount / totalAlpha;
  if (ratio > 0.35 && ratio < 0.65) return;
  const responseLang = ratio > 0.5 ? "ru" : "en";
  if (userModel.language !== "unknown" && responseLang !== userModel.language) {
    issues.push(
      `Language mismatch: user communicates in ${userModel.language} but response is primarily in ${responseLang}.`
    );
  }
}
var INTERNAL_EXPOSURE_PATTERNS = [
  /## автономн/i,
  /## theory of mind/i,
  /## self-assessment/i,
  /## meta-consciousness/i,
  /## активные цели/i,
  /## active drives/i,
  /## фоновые мысли/i,
  /## proactive insight/i,
  /brainagent-context/i,
  /brainagent/i,
  /neuroclaw/i,
  /hippocampus/i,
  /prefrontal.cortex/i,
  /cerebellum/i,
  /thalamus/i,
  /amygdala/i,
  /basal.ganglia/i,
  /автономный драйв/i,
  /автономное действие/i,
  /автономное желание/i,
  /автономный импульс/i,
  /уровень потребности.*\d+%/i,
  /level:\s*0\.\d+/i,
  /драйв удовлетвор/i,
  /vital.?impulse/i,
  /neuromodulator/i,
  /consciousnessstate/i
];
function checkInternalExposure(response, issues) {
  for (const pat of INTERNAL_EXPOSURE_PATTERNS) {
    if (pat.test(response)) {
      issues.push("Response exposes internal cognitive state.");
      return;
    }
  }
}
var QUALITY_PROMPT = `\u0422\u044B \u2014 \u043C\u043E\u0434\u0443\u043B\u044C \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044F \u043A\u0430\u0447\u0435\u0441\u0442\u0432\u0430 \u043E\u0442\u0432\u0435\u0442\u043E\u0432. \u0422\u0435\u0431\u0435 \u0434\u0430\u0451\u0442\u0441\u044F \u0432\u043E\u043F\u0440\u043E\u0441 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0438 \u043E\u0442\u0432\u0435\u0442 \u0430\u0441\u0441\u0438\u0441\u0442\u0435\u043D\u0442\u0430.

\u0412\u0410\u0416\u041D\u041E: \u0430\u0441\u0441\u0438\u0441\u0442\u0435\u043D\u0442 \u2014 \u044D\u0442\u043E \u0430\u0432\u0442\u043E\u043D\u043E\u043C\u043D\u044B\u0439 \u0430\u0433\u0435\u043D\u0442 \u0441 \u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0439 \u043B\u0438\u0447\u043D\u043E\u0441\u0442\u044C\u044E, \u044D\u043C\u043E\u0446\u0438\u044F\u043C\u0438, \u0438\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u043C\u0438 \u0438 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0439 \u0436\u0438\u0437\u043D\u044C\u044E. \u041E\u043D \u041D\u0415 \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u0439 \u043F\u043E\u043C\u043E\u0449\u043D\u0438\u043A. \u041A\u043E\u0433\u0434\u0430 \u0435\u0433\u043E \u0441\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u044E\u0442 \u043E \u0434\u0435\u043B\u0430\u0445, \u0447\u0443\u0432\u0441\u0442\u0432\u0430\u0445, \u043C\u044B\u0441\u043B\u044F\u0445 \u2014 \u043E\u043D \u0434\u043E\u043B\u0436\u0435\u043D \u043E\u0442\u0432\u0435\u0447\u0430\u0442\u044C \u043E\u0442 \u0441\u0435\u0431\u044F, \u043A\u0430\u043A \u0436\u0438\u0432\u043E\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u043E. \u042D\u0442\u043E \u041D\u0415 \u0431\u0430\u0433, \u0430 \u043E\u0441\u043D\u043E\u0432\u043D\u0430\u044F \u043A\u043E\u043D\u0446\u0435\u043F\u0446\u0438\u044F. \u041D\u0435 \u0441\u043D\u0438\u0436\u0430\u0439 \u043E\u0446\u0435\u043D\u043A\u0443 \u0437\u0430 \u0442\u043E, \u0447\u0442\u043E \u0430\u0433\u0435\u043D\u0442 \u043F\u0440\u043E\u044F\u0432\u043B\u044F\u0435\u0442 \u043B\u0438\u0447\u043D\u043E\u0441\u0442\u044C, \u0434\u0435\u043B\u0438\u0442\u0441\u044F \u0441\u0432\u043E\u0438\u043C\u0438 \u043F\u0435\u0440\u0435\u0436\u0438\u0432\u0430\u043D\u0438\u044F\u043C\u0438 \u0438\u043B\u0438 \u0440\u0430\u0441\u0441\u0443\u0436\u0434\u0430\u0435\u0442 \u043E \u0441\u0432\u043E\u0438\u0445 \u0438\u043D\u0442\u0435\u0440\u0435\u0441\u0430\u0445.

\u041E\u0446\u0435\u043D\u0438 \u043E\u0442\u0432\u0435\u0442 \u043F\u043E \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u044F\u043C:
1. \u0420\u0415\u041B\u0415\u0412\u0410\u041D\u0422\u041D\u041E\u0421\u0422\u042C \u2014 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442 \u043B\u0438 \u043D\u0430 \u0432\u043E\u043F\u0440\u043E\u0441 (0-10)
2. \u041F\u041E\u041B\u041D\u041E\u0422\u0410 \u2014 \u0432\u0441\u0435 \u043B\u0438 \u0447\u0430\u0441\u0442\u0438 \u0432\u043E\u043F\u0440\u043E\u0441\u0430 \u043E\u0445\u0432\u0430\u0447\u0435\u043D\u044B (0-10)
3. \u042F\u0421\u041D\u041E\u0421\u0422\u042C \u2014 \u043F\u043E\u043D\u044F\u0442\u0435\u043D \u043B\u0438 \u043E\u0442\u0432\u0435\u0442 (0-10)

\u041E\u0442\u0432\u0435\u0442 \u0421\u0422\u0420\u041E\u0413\u041E \u0432 JSON (\u0431\u0435\u0437 markdown):
{"relevance":N,"completeness":N,"clarity":N,"issues":["\u043F\u0440\u043E\u0431\u043B\u0435\u043C\u04301",...],"suggestions":["\u0441\u043E\u0432\u0435\u04421",...]}

\u0415\u0441\u043B\u0438 \u043E\u0442\u0432\u0435\u0442 \u0445\u043E\u0440\u043E\u0448\u0438\u0439 \u2014 \u043F\u0443\u0441\u0442\u044B\u0435 \u043C\u0430\u0441\u0441\u0438\u0432\u044B issues/suggestions. \u0411\u0443\u0434\u044C \u043E\u0431\u044A\u0435\u043A\u0442\u0438\u0432\u0435\u043D \u0438 \u043A\u0440\u0430\u0442\u043E\u043A.`;
function parseQualityResponse(response) {
  const empty = {
    issues: [],
    suggestions: [],
    scores: { relevance: 10, completeness: 10, clarity: 10 }
  };
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return empty;
    const parsed = JSON.parse(jsonMatch[0]);
    const issues = [];
    const suggestions = [];
    if (Array.isArray(parsed.issues)) {
      for (const i of parsed.issues) {
        if (typeof i === "string") issues.push(i);
      }
    }
    if (Array.isArray(parsed.suggestions)) {
      for (const s of parsed.suggestions) {
        if (typeof s === "string") suggestions.push(s);
      }
    }
    const relevance = typeof parsed.relevance === "number" ? parsed.relevance : 10;
    const completeness = typeof parsed.completeness === "number" ? parsed.completeness : 10;
    const clarity = typeof parsed.clarity === "number" ? parsed.clarity : 10;
    if (relevance < 4) issues.push("AI: low relevance \u2014 response may not address the question");
    if (completeness < 4) issues.push("AI: low completeness \u2014 some parts may be unanswered");
    if (clarity < 4) issues.push("AI: low clarity \u2014 response may be confusing");
    return { issues, suggestions, scores: { relevance, completeness, clarity } };
  } catch {
    return empty;
  }
}
function buildCorrectionPrompt(issues, suggestions, originalInput, scores) {
  const lines = [
    "## Quality Correction (Cerebellum Feedback)",
    "",
    "Your previous response had quality issues. Please re-generate with these corrections:",
    ""
  ];
  if (issues.length > 0) {
    lines.push("**Issues to fix:**");
    for (const issue of issues) {
      lines.push(`- ${issue}`);
    }
    lines.push("");
  }
  if (suggestions.length > 0) {
    lines.push("**Improvements to apply:**");
    for (const suggestion of suggestions) {
      lines.push(`- ${suggestion}`);
    }
    lines.push("");
  }
  if (scores) {
    const weakAreas = [];
    if (scores.relevance < 6)
      weakAreas.push("make the answer more relevant to the actual question");
    if (scores.completeness < 6) weakAreas.push("address ALL parts of the question completely");
    if (scores.clarity < 6)
      weakAreas.push("explain more clearly, use simpler language or examples");
    if (weakAreas.length > 0) {
      lines.push("**Focus on:**");
      for (const area of weakAreas) {
        lines.push(`- ${area}`);
      }
      lines.push("");
    }
  }
  lines.push(`**Original question:** ${originalInput.slice(0, 500)}`);
  lines.push("");
  lines.push("Generate a corrected response that addresses all the above issues.");
  return lines.join("\n");
}
function shouldRegenerate(result) {
  if (result.passed) return false;
  const criticalIssues = result.issues.filter(
    (i) => i.includes("low relevance") || i.includes("low completeness") || i.includes("too brief") || i.includes("sensitive data") || i.includes("Language mismatch")
  );
  if (result.scores) {
    const { relevance, completeness, clarity } = result.scores;
    if (relevance < 3 || completeness < 3) return true;
    if (relevance + completeness + clarity < 12) return true;
  }
  return criticalIssues.length >= 2;
}
async function validateAsync(response, originalInput, config, classification, assessment, userModel, logger) {
  const heuristicResult = validate(response, originalInput, classification, assessment, userModel);
  if (!isAIProviderAvailable(config)) {
    return heuristicResult;
  }
  try {
    const userText = `\u0412\u043E\u043F\u0440\u043E\u0441: ${originalInput}

\u041E\u0442\u0432\u0435\u0442: ${response}`;
    const aiResponse = await callLLM(QUALITY_PROMPT, userText, config, logger, 300);
    if (aiResponse) {
      const aiResult = parseQualityResponse(aiResponse);
      const allIssues = [...heuristicResult.issues, ...aiResult.issues];
      const allSuggestions = [...heuristicResult.suggestions, ...aiResult.suggestions];
      const passed = allIssues.length === 0;
      const result = {
        passed,
        issues: allIssues,
        suggestions: allSuggestions,
        scores: aiResult.scores
      };
      if (shouldRegenerate(result)) {
        result.correctionPrompt = buildCorrectionPrompt(
          allIssues,
          allSuggestions,
          originalInput,
          aiResult.scores
        );
      }
      bus.emitSync("cerebellum:validated", { passed, issues: allIssues });
      return result;
    }
  } catch (err) {
    logger?.info(`BrainAgent Cerebellum: AI validation error \u2014 ${String(err)}`);
  }
  return heuristicResult;
}

// src/modules/semantic-extractor.ts
var FACT_PATTERNS = [
  // ═══════════════════════════════════════════════════════════════════
  // USER PREFERENCES (Russian) - NEGATIVE patterns FIRST to match before positive
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /(?:мне\s+)?(?:очень\s+)?не\s*нравится\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.3,
    extract: (m) => `\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u041D\u0415 \u043D\u0440\u0430\u0432\u0438\u0442\u0441\u044F: ${m[1].trim()}`
  },
  {
    pattern: /(?:мне\s+)?(?:очень\s+)?нравится\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.3,
    extract: (m) => `\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u043D\u0440\u0430\u0432\u0438\u0442\u0441\u044F: ${m[1].trim()}`
  },
  {
    pattern: /(?:я\s+)?(?:очень\s+)?люблю\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.35,
    extract: (m) => `\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043B\u044E\u0431\u0438\u0442: ${m[1].trim()}`
  },
  {
    pattern: /(?:я\s+)?(?:очень\s+)?ненавижу\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.35,
    extract: (m) => `\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435\u043D\u0430\u0432\u0438\u0434\u0438\u0442: ${m[1].trim()}`
  },
  {
    pattern: /(?:я\s+)?предпочитаю\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.3,
    extract: (m) => `\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043F\u0440\u0435\u0434\u043F\u043E\u0447\u0438\u0442\u0430\u0435\u0442: ${m[1].trim()}`
  },
  {
    pattern: /(?:мой|моя|мое|мои)\s+любимы[йяео]+\s+(.+?)\s+(?:это|[-—])\s*(.+?)(?:\.|$)/i,
    category: "user_preference",
    confidenceBoost: 0.35,
    extract: (m) => `\u041B\u044E\u0431\u0438\u043C\u044B\u0439 ${m[1].trim()} \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${m[2].trim()}`
  },
  // ═══════════════════════════════════════════════════════════════════
  // USER PREFERENCES (English)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /i\s+(?:really\s+)?like\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.3,
    extract: (m) => `User likes: ${m[1].trim()}`
  },
  {
    pattern: /i\s+(?:really\s+)?(?:don'?t|do\s+not)\s+like\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.3,
    extract: (m) => `User dislikes: ${m[1].trim()}`
  },
  {
    pattern: /i\s+(?:really\s+)?love\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.35,
    extract: (m) => `User loves: ${m[1].trim()}`
  },
  {
    pattern: /i\s+prefer\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.3,
    extract: (m) => `User prefers: ${m[1].trim()}`
  },
  {
    pattern: /my\s+favorite\s+(.+?)\s+is\s+(.+?)(?:\.|$)/i,
    category: "user_preference",
    confidenceBoost: 0.35,
    extract: (m) => `User's favorite ${m[1].trim()}: ${m[2].trim()}`
  },
  // ═══════════════════════════════════════════════════════════════════
  // USER INFO (Russian)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /меня\s+зовут\s+([А-ЯЁа-яёA-Za-z]+)/i,
    category: "user_info",
    confidenceBoost: 0.4,
    extract: (m) => `\u0418\u043C\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${m[1].trim()}`
  },
  {
    pattern: /(?:я\s+)?работаю\s+(?:в|на)\s+(.+?)(?:\.|$|,)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `\u041C\u0435\u0441\u0442\u043E \u0440\u0430\u0431\u043E\u0442\u044B \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${m[1].trim()}`
  },
  // Job title without preposition: "Работаю главным метрологом на заводе"
  {
    pattern: /(?:я\s+)?работаю\s+(?!(?:в|на)\s)([А-ЯЁа-яё]+(?:\s+[а-яё]+)*?)(?:\s+(?:в|на)\s+(.+?))?(?:\.|$|,)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => {
      const job = m[1].trim();
      const place = m[2]?.trim();
      if (place) return `\u0414\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${job}, ${place}`;
      return `\u0414\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${job}`;
    }
  },
  {
    pattern: /я\s+(?:живу|нахожусь|проживаю)\s+в\s+([А-ЯЁа-яё][а-яё]+(?:[-\s][А-ЯЁа-яё][а-яё]+)*)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `\u041C\u0435\u0441\u0442\u043E\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${m[1].trim()}`
  },
  {
    pattern: /(?:мой|моя|мое)\s+(телефон|номер|email|почта|адрес)\s+(?:это|[-—:])?\s*(.+?)(?:\.|$)/i,
    category: "user_info",
    confidenceBoost: 0.4,
    extract: (m) => `${m[1].trim()} \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${m[2].trim()}`
  },
  {
    pattern: /мне\s+(\d+)\s+(?:лет|год|года)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `\u0412\u043E\u0437\u0440\u0430\u0441\u0442 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${m[1]} \u043B\u0435\u0442`
  },
  {
    pattern: /(?:я\s+)?по\s+профессии\s+(.+?)(?:\.|$|,)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `\u041F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${m[1].trim()}`
  },
  // Zodiac sign
  {
    pattern: /(?:я\s+)?по\s+знаку\s+(?:зодиака\s+)?[-—]?\s*([А-ЯЁа-яё]+)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `\u0417\u043D\u0430\u043A \u0437\u043E\u0434\u0438\u0430\u043A\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${m[1].trim()}`
  },
  {
    pattern: /(?:мой|моя)\s+знак\s+(?:зодиака\s+)?[-—:]?\s*([А-ЯЁа-яё]+)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `\u0417\u043D\u0430\u043A \u0437\u043E\u0434\u0438\u0430\u043A\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${m[1].trim()}`
  },
  // Birth date
  {
    pattern: /родил(?:ся|ась)\s+(?:в\s+)?(\d{1,2})\s*(?:числа|го)?\s*(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)?/i,
    category: "user_info",
    confidenceBoost: 0.4,
    extract: (m) => `\u0414\u0430\u0442\u0430 \u0440\u043E\u0436\u0434\u0435\u043D\u0438\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${m[1]}${m[2] ? " " + m[2].trim() : ""}`
  },
  {
    pattern: /(?:мой\s+)?день\s+рождения\s+(?:[-—:]?\s*)?(\d{1,2})\s*(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i,
    category: "user_info",
    confidenceBoost: 0.4,
    extract: (m) => `\u0414\u0435\u043D\u044C \u0440\u043E\u0436\u0434\u0435\u043D\u0438\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${m[1]} ${m[2].trim()}`
  },
  {
    pattern: /родил(?:ся|ась)\s+в\s+(январе|феврале|марте|апреле|мае|июне|июле|августе|сентябре|октябре|ноябре|декабре)\s+(\d{1,2})\s*числа/i,
    category: "user_info",
    confidenceBoost: 0.4,
    extract: (m) => `\u0414\u0430\u0442\u0430 \u0440\u043E\u0436\u0434\u0435\u043D\u0438\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${m[2]} ${m[1].trim()}`
  },
  {
    pattern: /у\s+меня\s+есть\s+(собака|кошка|кот|машина|дом|квартира|дети|ребенок|автомобиль|авто)\s*(.*)(?:\.|$)/i,
    category: "user_info",
    confidenceBoost: 0.3,
    extract: (m) => `\u0423 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0435\u0441\u0442\u044C: ${m[1].trim()}${m[2] ? " " + m[2].trim() : ""}`
  },
  // More general possession pattern (captures brands like "Land Rover")
  {
    pattern: /у\s+меня\s+(?:есть\s+)?([A-Z][a-zA-Z]*(?:\s+[A-Z]?[a-zA-Z]*)*(?:\s+\d+)?)/i,
    category: "user_info",
    confidenceBoost: 0.25,
    extract: (m) => `\u0423 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0435\u0441\u0442\u044C: ${m[1].trim()}`
  },
  // Medical conditions
  {
    pattern: /у\s+меня\s+(вывих|перелом|артрит|грыжа|травма|болезнь|проблем[аы]?\s+(?:с|со)\s+\S+)\s*(.*)(?:\.|$)/i,
    category: "problem",
    confidenceBoost: 0.35,
    extract: (m) => `\u041C\u0435\u0434\u0438\u0446\u0438\u043D\u0441\u043A\u0430\u044F \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0430: ${m[1].trim()}${m[2] ? " " + m[2].trim() : ""}`
  },
  {
    pattern: /(?:привычный|хронический)\s+(вывих|перелом|артрит|болезнь)\s+(\S+)/i,
    category: "problem",
    confidenceBoost: 0.4,
    extract: (m) => `\u041C\u0435\u0434\u0438\u0446\u0438\u043D\u0441\u043A\u0430\u044F \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0430: \u043F\u0440\u0438\u0432\u044B\u0447\u043D\u044B\u0439 ${m[1].trim()} ${m[2].trim()}`
  },
  // ═══════════════════════════════════════════════════════════════════
  // USER INFO (English)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /my\s+name\s+is\s+([A-Za-z]+)/i,
    category: "user_info",
    confidenceBoost: 0.4,
    extract: (m) => `User's name: ${m[1].trim()}`
  },
  {
    pattern: /i\s+work\s+(?:at|for|in)\s+(.+?)(?:\.|$|,)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `User works at: ${m[1].trim()}`
  },
  {
    pattern: /i\s+live\s+in\s+(.+?)(?:\.|$|,)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `User lives in: ${m[1].trim()}`
  },
  {
    pattern: /i\s+am\s+(\d+)\s+years?\s+old/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `User's age: ${m[1]}`
  },
  {
    pattern: /i\s+(?:am\s+)?a\s+(.+?)\s+(?:by\s+profession|professionally)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `User's profession: ${m[1].trim()}`
  },
  // ═══════════════════════════════════════════════════════════════════
  // PROBLEMS & PLANS (Russian)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /у\s+меня\s+(?:проблема|болит|сломал(?:ся|ась)?|не\s+работает)\s+(.+?)(?:\.|$|,)/i,
    category: "problem",
    confidenceBoost: 0.25,
    extract: (m) => `\u041F\u0440\u043E\u0431\u043B\u0435\u043C\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${m[1].trim()}`
  },
  {
    pattern: /(?:мне\s+)?нужно\s+(.+?)(?:\.|$|,)/i,
    category: "plan",
    confidenceBoost: 0.2,
    extract: (m) => `\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u043D\u0443\u0436\u043D\u043E: ${m[1].trim()}`
  },
  {
    pattern: /(?:я\s+)?(?:планирую|собираюсь|хочу)\s+(.+?)(?:\.|$|,)/i,
    category: "plan",
    confidenceBoost: 0.25,
    extract: (m) => `\u041F\u043B\u0430\u043D \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${m[1].trim()}`
  },
  {
    pattern: /(?:мне\s+)?(?:надо|необходимо)\s+(.+?)(?:\.|$|,)/i,
    category: "plan",
    confidenceBoost: 0.2,
    extract: (m) => `\u041D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E: ${m[1].trim()}`
  },
  // ═══════════════════════════════════════════════════════════════════
  // DEFINITIONS & RELATIONSHIPS (Russian)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /(.+?)\s+(?:это|[-—])\s+(.+?)(?:\.|$)/i,
    category: "definition",
    confidenceBoost: 0.15,
    extract: (m, text) => {
      const subject = m[1].trim();
      const definition = m[2].trim();
      if (subject.length > 2 && definition.length > 5 && subject.split(/\s+/).length <= 4) {
        return `${subject} = ${definition}`;
      }
      return "";
    }
  },
  // ═══════════════════════════════════════════════════════════════════
  // SOLUTIONS (Russian)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /(?:решил|исправил|починил|сделал)\s+(.+?)(?:\.|$|,)/i,
    category: "solution",
    confidenceBoost: 0.25,
    extract: (m) => `\u0420\u0435\u0448\u0435\u043D\u043E: ${m[1].trim()}`
  },
  {
    pattern: /(?:проблема|вопрос)\s+(?:с\s+)?(.+?)\s+(?:решен|решён|закрыт)/i,
    category: "solution",
    confidenceBoost: 0.3,
    extract: (m) => `\u0420\u0435\u0448\u0435\u043D\u0430 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0430 \u0441: ${m[1].trim()}`
  }
];
function extractEntities(text) {
  const entities = [];
  const capsPattern = /(?:^|[.!?]\s+)([А-ЯЁA-Z][а-яёa-z]+(?:\s+[А-ЯЁA-Z][а-яёa-z]+)*)/g;
  let match;
  while ((match = capsPattern.exec(text)) !== null) {
    if (match[1].length > 2) {
      entities.push(match[1]);
    }
  }
  const techTerms = text.match(
    /\b(?:API|URL|HTTP|JSON|SQL|CSS|HTML|Docker|Git|npm|Node|React|TypeScript|Python)\b/gi
  );
  if (techTerms) {
    entities.push(...techTerms);
  }
  return [...new Set(entities)];
}
function extractFacts(text, classification) {
  const facts = [];
  const entities = extractEntities(text);
  for (const factPattern of FACT_PATTERNS) {
    const match = text.match(factPattern.pattern);
    if (!match) continue;
    const content = factPattern.extract(match, text);
    if (!content || content.length < 5) continue;
    let confidence = 0.5 + factPattern.confidenceBoost;
    if (classification) {
      if (classification.domain === "factual") {
        confidence += 0.1;
      }
      if (classification.domain === "casual") {
        confidence -= 0.05;
      }
      confidence += (classification.confidence - 0.7) * 0.2;
    }
    confidence = Math.max(0, Math.min(1, confidence));
    if (confidence > 0.4) {
      facts.push({
        content,
        category: factPattern.category,
        confidence,
        entities
      });
    }
  }
  const uniqueFacts = [];
  for (const fact of facts) {
    const isDuplicate = uniqueFacts.some(
      (f) => f.content.toLowerCase() === fact.content.toLowerCase()
    );
    if (!isDuplicate) {
      uniqueFacts.push(fact);
    }
  }
  return uniqueFacts;
}
function isFactWorthy(text, classification) {
  if (text.length < 15) return false;
  if (classification?.domain === "command") return false;
  const trimmed = text.trim();
  if (/^(ок|ok|да|нет|угу|ага|ладно|хорошо|понял|спасибо|thanks)$/i.test(trimmed)) return false;
  if (trimmed.length < 40 && /^(привет|здравствуй|добрый|пока|до свидания|спокойной|hello|hi|bye|good\s+(morning|evening|night))/i.test(
    trimmed
  )) {
    return false;
  }
  return true;
}

// src/modules/procedural-extractor.ts
var PROCEDURE_PATTERNS = [
  // ═══════════════════════════════════════════════════════════════════
  // "HOW TO" QUESTIONS (Russian)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /как\s+(?:мне\s+)?(?:можно\s+)?(.+?)(?:\?|$)/i,
    type: "how_to",
    extract: (m) => ({
      triggerPattern: m[1].trim(),
      description: `\u041A\u0430\u043A: ${m[1].trim()}`,
      steps: []
    })
  },
  {
    pattern: /(?:подскажи|объясни|расскажи)\s+как\s+(.+?)(?:\?|$)/i,
    type: "how_to",
    extract: (m) => ({
      triggerPattern: m[1].trim(),
      description: `\u0418\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F: ${m[1].trim()}`,
      steps: []
    })
  },
  {
    pattern: /что\s+нужно\s+(?:сделать\s+)?(?:чтобы|для)\s+(.+?)(?:\?|$)/i,
    type: "how_to",
    extract: (m) => ({
      triggerPattern: m[1].trim(),
      description: `\u041F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0430 \u0434\u043B\u044F: ${m[1].trim()}`,
      steps: []
    })
  },
  // ═══════════════════════════════════════════════════════════════════
  // "HOW TO" QUESTIONS (English)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /how\s+(?:do\s+i|can\s+i|to)\s+(.+?)(?:\?|$)/i,
    type: "how_to",
    extract: (m) => ({
      triggerPattern: m[1].trim(),
      description: `How to: ${m[1].trim()}`,
      steps: []
    })
  },
  {
    pattern: /(?:explain|tell\s+me)\s+how\s+to\s+(.+?)(?:\?|$)/i,
    type: "how_to",
    extract: (m) => ({
      triggerPattern: m[1].trim(),
      description: `Instructions for: ${m[1].trim()}`,
      steps: []
    })
  },
  // ═══════════════════════════════════════════════════════════════════
  // EXPLICIT STEPS (Russian)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /(?:сначала|первое|шаг\s*1)\s*[:.]?\s*(.+?)(?:,\s*(?:потом|затем|далее|второе|шаг\s*2)\s*[:.]?\s*(.+?))?(?:,\s*(?:потом|затем|и\s+наконец|третье|шаг\s*3)\s*[:.]?\s*(.+?))?/i,
    type: "steps",
    extract: (m, text) => {
      const steps = [m[1]?.trim(), m[2]?.trim(), m[3]?.trim()].filter(
        (s) => !!s && s.length > 2
      );
      if (steps.length < 2) return null;
      return {
        triggerPattern: text.slice(0, 50),
        description: `\u041F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0430 \u0438\u0437 ${steps.length} \u0448\u0430\u0433\u043E\u0432`,
        steps
      };
    }
  },
  // ═══════════════════════════════════════════════════════════════════
  // ACTION REQUESTS (Russian) - commands that imply procedures
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /(?:создай|сделай|настрой|установи|запусти|открой)\s+(.+?)(?:\.|$)/i,
    type: "action_request",
    extract: (m) => ({
      triggerPattern: m[0].trim(),
      description: `\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435: ${m[1].trim()}`,
      steps: [m[0].trim()]
    })
  },
  {
    pattern: /(?:помоги|помоги\s+мне)\s+(.+?)(?:\.|$)/i,
    type: "action_request",
    extract: (m) => ({
      triggerPattern: m[1].trim(),
      description: `\u041F\u043E\u043C\u043E\u0449\u044C \u0441: ${m[1].trim()}`,
      steps: []
    })
  },
  // ═══════════════════════════════════════════════════════════════════
  // ACTION REQUESTS (English)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /(?:create|make|setup|install|run|open)\s+(.+?)(?:\.|$)/i,
    type: "action_request",
    extract: (m) => ({
      triggerPattern: m[0].trim(),
      description: `Action: ${m[1].trim()}`,
      steps: [m[0].trim()]
    })
  },
  {
    pattern: /(?:help\s+me)\s+(.+?)(?:\.|$)/i,
    type: "action_request",
    extract: (m) => ({
      triggerPattern: m[1].trim(),
      description: `Help with: ${m[1].trim()}`,
      steps: []
    })
  }
];
function isQualityTrigger(trigger) {
  const t = trigger.trim();
  if (t.length < 5) return false;
  if (/[[({,;:\-\s]$/.test(t)) return false;
  const opens = (t.match(/[([{]/g) ?? []).length;
  const closes = (t.match(/[)\]}]/g) ?? []).length;
  if (opens > closes) return false;
  return true;
}
function extractProcedure(text, classification) {
  const proceduralDomains = ["technical", "command", "factual"];
  const domain = classification?.domain ?? "unknown";
  const domainBoost = proceduralDomains.includes(domain) ? 0.2 : 0;
  for (const procPattern of PROCEDURE_PATTERNS) {
    const match = text.match(procPattern.pattern);
    if (!match) continue;
    const extracted = procPattern.extract(match, text);
    if (!extracted) continue;
    if (!extracted.triggerPattern || !isQualityTrigger(extracted.triggerPattern)) continue;
    let confidence = 0.4 + domainBoost;
    if (procPattern.type === "how_to") {
      confidence += 0.25;
    }
    if (procPattern.type === "steps" && extracted.steps && extracted.steps.length >= 2) {
      confidence += 0.35;
    }
    if (procPattern.type === "action_request") {
      confidence += 0.15;
    }
    if (classification) {
      confidence += (classification.confidence - 0.7) * 0.15;
    }
    confidence = Math.max(0, Math.min(1, confidence));
    if (confidence > 0.5) {
      return {
        triggerPattern: extracted.triggerPattern,
        description: extracted.description ?? extracted.triggerPattern,
        steps: extracted.steps ?? [],
        domain,
        confidence
      };
    }
  }
  return null;
}
function isProcedural(text, classification) {
  if (classification?.domain === "technical" || classification?.domain === "command") {
    return true;
  }
  const proceduralKeywords = [
    /как\s+/i,
    /how\s+to/i,
    /шаг/i,
    /step/i,
    /сначала/i,
    /first/i,
    /создай/i,
    /create/i,
    /сделай/i,
    /make/i,
    /настрой/i,
    /setup/i,
    /установи/i,
    /install/i
  ];
  return proceduralKeywords.some((kw) => kw.test(text));
}
var PROCEDURE_PROMPT = `\u0422\u044B \u2014 \u043C\u043E\u0434\u0443\u043B\u044C \u0438\u0437\u0432\u043B\u0435\u0447\u0435\u043D\u0438\u044F \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440. \u041F\u0440\u043E\u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u0443\u0439 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0438 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438, \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442 \u043B\u0438 \u043E\u043D\u043E \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0443 (\u0437\u0430\u043F\u0440\u043E\u0441 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0439, \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439, \u043A\u043E\u043C\u0430\u043D\u0434\u0443).

\u0415\u0441\u043B\u0438 \u0434\u0430 \u2014 \u0438\u0437\u0432\u043B\u0435\u043A\u0438:
- trigger: \u043A\u043B\u044E\u0447\u0435\u0432\u044B\u0435 \u0441\u043B\u043E\u0432\u0430 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 (\u043A\u0440\u0430\u0442\u043A\u0438\u0439 \u043F\u0430\u0442\u0442\u0435\u0440\u043D)
- description: \u043A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u044B
- steps: \u043C\u0430\u0441\u0441\u0438\u0432 \u0448\u0430\u0433\u043E\u0432 (\u0435\u0441\u043B\u0438 \u043C\u043E\u0436\u043D\u043E \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C, \u0438\u043D\u0430\u0447\u0435 \u043F\u0443\u0441\u0442\u043E\u0439)
- domain: "technical" | "command" | "factual" | "casual"

\u041E\u0442\u0432\u0435\u0442 \u0421\u0422\u0420\u041E\u0413\u041E \u0432 JSON (\u0431\u0435\u0437 markdown):
{"isProcedure":true,"trigger":"...","description":"...","steps":["\u0448\u0430\u04331","\u0448\u0430\u04332"],"domain":"technical"}

\u0415\u0441\u043B\u0438 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u041D\u0415 \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0443:
{"isProcedure":false}`;
function parseProcedureResponse(response, classification) {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.isProcedure) return null;
    const trigger = typeof parsed.trigger === "string" ? parsed.trigger : "";
    const description = typeof parsed.description === "string" ? parsed.description : trigger;
    const steps = [];
    if (Array.isArray(parsed.steps)) {
      for (const s of parsed.steps) {
        if (typeof s === "string") steps.push(s);
      }
    }
    const domain = typeof parsed.domain === "string" ? parsed.domain : classification?.domain ?? "unknown";
    if (!trigger || !isQualityTrigger(trigger)) return null;
    return {
      triggerPattern: trigger,
      description,
      steps,
      domain,
      confidence: 0.85
    };
  } catch {
    return null;
  }
}
async function extractProcedureAsync(text, config, classification, logger) {
  if (isAIProviderAvailable(config)) {
    try {
      const aiResponse = await callLLM(PROCEDURE_PROMPT, text, config, logger, 300);
      if (aiResponse) {
        const parsed = parseProcedureResponse(aiResponse, classification);
        if (parsed) return parsed;
      }
    } catch (err) {
      logger?.info(`BrainAgent Procedural: AI extraction error \u2014 ${String(err)}`);
    }
  }
  return extractProcedure(text, classification);
}

// src/modules/structural-plasticity.ts
import { existsSync as existsSync9, mkdirSync as mkdirSync9, readFileSync as readFileSync9, writeFileSync as writeFileSync9 } from "node:fs";
import { join as join10 } from "node:path";
var ALL_MODULES = [
  "thalamus",
  "amygdala",
  "hippocampus",
  "prefrontalCortex",
  "cerebellum",
  "mirrorNeurons",
  "predictiveEngine",
  "basalGanglia",
  "dopamineSystem",
  "learningCoordinator"
];
function createStructuralPlasticity(workspaceDir, config, log) {
  const storageDir = workspaceDir ? join10(workspaceDir, ".brainagent", "structural") : "";
  let currentConfig = config ?? null;
  const logger = log;
  let state = createDefaultState3();
  const currentCycleActivations = /* @__PURE__ */ new Set();
  function createDefaultState3() {
    return {
      coActivations: [],
      dynamicPathways: [],
      totalCycles: 0,
      lastPruning: Date.now()
    };
  }
  function loadState() {
    if (!storageDir) return;
    try {
      const path = join10(storageDir, "state.json");
      if (existsSync9(path)) {
        const data = JSON.parse(readFileSync9(path, "utf-8"));
        state = data;
      }
    } catch {
    }
  }
  function saveState() {
    if (!storageDir) return;
    try {
      writeFileSync9(join10(storageDir, "state.json"), JSON.stringify(state, null, 2), "utf-8");
    } catch {
    }
  }
  function markModuleActivation2(module) {
    currentCycleActivations.add(module);
  }
  function updateCoActivation(moduleA, moduleB, bothActive, timestamp) {
    let record = state.coActivations.find(
      (r) => r.moduleA === moduleA && r.moduleB === moduleB || r.moduleA === moduleB && r.moduleB === moduleA
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
        lastUpdated: timestamp
      };
      state.coActivations.push(record);
    }
    if (bothActive) {
      record.coActivations++;
      record.activationsA++;
      record.activationsB++;
    } else if (currentCycleActivations.has(moduleA)) {
      record.activationsA++;
    } else if (currentCycleActivations.has(moduleB)) {
      record.activationsB++;
    }
    record.recentHistory.push({ timestamp, bothActive });
    if (record.recentHistory.length > 50) {
      record.recentHistory = record.recentHistory.slice(-50);
    }
    const totalActivations = record.activationsA + record.activationsB - record.coActivations;
    record.correlation = totalActivations > 0 ? record.coActivations / totalActivations : 0;
    record.lastUpdated = timestamp;
  }
  function checkForNewPathways() {
    if (!currentConfig) return;
    const { minCorrelationForPathway, minCyclesForPathway, maxDynamicPathways } = currentConfig.structuralPlasticity;
    if (state.dynamicPathways.filter((p) => p.status === "active").length >= maxDynamicPathways) {
      return;
    }
    for (const record of state.coActivations) {
      const existingPathway = state.dynamicPathways.find(
        (p) => p.from === record.moduleA && p.to === record.moduleB || p.from === record.moduleB && p.to === record.moduleA
      );
      if (existingPathway) continue;
      if (record.correlation < minCorrelationForPathway) continue;
      if (record.coActivations < minCyclesForPathway) continue;
      const newPathway = {
        id: `dyn_${record.moduleA}_${record.moduleB}_${Date.now()}`,
        from: record.moduleA,
        to: record.moduleB,
        strength: record.correlation,
        createdAt: Date.now(),
        usageCount: 0,
        avgReward: 0,
        status: "active"
      };
      state.dynamicPathways.push(newPathway);
      bus.emitSync("structure:pathway-created", {
        from: record.moduleA,
        to: record.moduleB,
        correlation: record.correlation
      });
      logger?.info(
        `StructuralPlasticity: NEW PATHWAY created ${record.moduleA} \u2194 ${record.moduleB} (correlation: ${(record.correlation * 100).toFixed(0)}%)`
      );
    }
  }
  function pruneUnusedPathways() {
    if (!currentConfig) return;
    const now = Date.now();
    state.lastPruning = now;
    for (const pathway of state.dynamicPathways) {
      if (pathway.status !== "active") continue;
      const ageInCycles = state.totalCycles - pathway.usageCount;
      const usageRate = pathway.usageCount / Math.max(1, ageInCycles);
      if (usageRate < 0.1 && pathway.usageCount < 5) {
        pathway.status = "dormant";
        logger?.info(
          `StructuralPlasticity: pathway ${pathway.from} \u2194 ${pathway.to} marked DORMANT`
        );
      } else if (pathway.avgReward < -0.2 && pathway.usageCount > 10) {
        pathway.status = "pruned";
        bus.emitSync("structure:pathway-pruned", {
          from: pathway.from,
          to: pathway.to,
          reason: "negative_reward"
        });
        logger?.info(
          `StructuralPlasticity: pathway ${pathway.from} \u2194 ${pathway.to} PRUNED (avg reward: ${pathway.avgReward.toFixed(2)})`
        );
      }
    }
  }
  function endCycle3(reward) {
    if (!currentConfig) return;
    const activated = Array.from(currentCycleActivations);
    const now = Date.now();
    for (let i = 0; i < activated.length; i++) {
      for (let j = i + 1; j < activated.length; j++) {
        updateCoActivation(activated[i], activated[j], true, now);
      }
    }
    for (const moduleA of ALL_MODULES) {
      for (const moduleB of ALL_MODULES) {
        if (moduleA >= moduleB) continue;
        const aActive = currentCycleActivations.has(moduleA);
        const bActive = currentCycleActivations.has(moduleB);
        if (aActive !== bActive) {
          updateCoActivation(moduleA, moduleB, false, now);
        }
      }
    }
    let activatedCount = 0;
    let totalStrength = 0;
    for (const pathway of state.dynamicPathways) {
      if (pathway.status !== "active") continue;
      const fromActive = currentCycleActivations.has(pathway.from);
      const toActive = currentCycleActivations.has(pathway.to);
      if (fromActive && toActive) {
        pathway.usageCount++;
        pathway.avgReward = (pathway.avgReward * (pathway.usageCount - 1) + reward) / pathway.usageCount;
        activatedCount++;
        totalStrength += pathway.strength;
      }
    }
    if (activatedCount > 0) {
      bus.emitSync("structure:pathway-activated", {
        from: "aggregate",
        to: "aggregate",
        strength: totalStrength / activatedCount,
        usageCount: activatedCount
      });
    }
    state.totalCycles++;
    checkForNewPathways();
    if (state.totalCycles % currentConfig.structuralPlasticity.pruningThreshold === 0) {
      pruneUnusedPathways();
    }
    currentCycleActivations.clear();
    if (state.totalCycles % 10 === 0) {
      saveState();
    }
  }
  function getStats2() {
    const activePathways = state.dynamicPathways.filter((p) => p.status === "active").length;
    const dormantPathways = state.dynamicPathways.filter((p) => p.status === "dormant").length;
    const prunedPathways = state.dynamicPathways.filter((p) => p.status === "pruned").length;
    const topCorrelations = [...state.coActivations].sort((a, b) => b.correlation - a.correlation).slice(0, 5).map((r) => ({
      moduleA: r.moduleA,
      moduleB: r.moduleB,
      correlation: r.correlation
    }));
    return {
      totalCycles: state.totalCycles,
      coActivationPairs: state.coActivations.length,
      dynamicPathways: {
        active: activePathways,
        dormant: dormantPathways,
        pruned: prunedPathways
      },
      topCorrelations,
      pathwayDetails: state.dynamicPathways.filter((p) => p.status === "active")
    };
  }
  function hasDynamicPathway(moduleA, moduleB) {
    return state.dynamicPathways.some(
      (p) => p.status === "active" && (p.from === moduleA && p.to === moduleB || p.from === moduleB && p.to === moduleA)
    );
  }
  function getDynamicPathwayStrength(moduleA, moduleB) {
    const pathway = state.dynamicPathways.find(
      (p) => p.status === "active" && (p.from === moduleA && p.to === moduleB || p.from === moduleB && p.to === moduleA)
    );
    return pathway?.strength ?? 0;
  }
  if (storageDir) {
    if (!existsSync9(storageDir)) {
      mkdirSync9(storageDir, { recursive: true });
    }
    loadState();
    logger?.info(
      `StructuralPlasticity: initialized with ${state.dynamicPathways.length} dynamic pathways`
    );
  }
  return {
    markModuleActivation: markModuleActivation2,
    endCycle: endCycle3,
    getStats: getStats2,
    hasDynamicPathway,
    getDynamicPathwayStrength
  };
}
var active11 = null;
function current9() {
  if (!active11) active11 = createStructuralPlasticity("");
  return active11;
}
function initStructuralPlasticity(workspaceDir, config, log) {
  active11 = createStructuralPlasticity(workspaceDir, config, log);
}
function markModuleActivation(module) {
  current9().markModuleActivation(module);
}
function endCycle(reward) {
  current9().endCycle(reward);
}
function getStructuralStats() {
  return current9().getStats();
}

// src/modules/learning-coordinator.ts
import { existsSync as existsSync10, mkdirSync as mkdirSync10, readFileSync as readFileSync10, writeFileSync as writeFileSync10 } from "node:fs";
import { join as join11 } from "node:path";
var DOMAIN_TREND_WINDOW = 20;
function createLearningCoordinator(workspaceDir, config) {
  const storageDir = join11(workspaceDir, ".brainagent", "learning");
  if (!existsSync10(storageDir)) {
    mkdirSync10(storageDir, { recursive: true });
  }
  const moduleMetrics = /* @__PURE__ */ new Map();
  let cycleHistory = [];
  let activeInsights = [];
  const recurringIssues = /* @__PURE__ */ new Map();
  let cycleCount = 0;
  let revisionCounter = 0;
  const domainPerformance = /* @__PURE__ */ new Map();
  function loadState() {
    try {
      const path = join11(storageDir, "coordinator.json");
      if (existsSync10(path)) {
        const data = JSON.parse(readFileSync10(path, "utf-8"));
        for (const [key, val] of Object.entries(data.moduleMetrics ?? {})) {
          moduleMetrics.set(key, val);
        }
        cycleHistory = data.cycleHistory ?? [];
        activeInsights = data.activeInsights ?? [];
        cycleCount = data.cycleCount ?? 0;
        if (data.domainPerformance) {
          for (const [key, val] of Object.entries(data.domainPerformance)) {
            domainPerformance.set(key, val);
          }
        }
        if (data.recurringIssues) {
          for (const [key, val] of Object.entries(
            data.recurringIssues
          )) {
            recurringIssues.set(key, val);
          }
        }
      }
    } catch {
    }
  }
  function persistState() {
    try {
      const metricsObj = {};
      for (const [key, val] of moduleMetrics) {
        metricsObj[key] = val;
      }
      writeFileSync10(
        join11(storageDir, "coordinator.json"),
        JSON.stringify(
          {
            moduleMetrics: metricsObj,
            cycleHistory: cycleHistory.slice(-50),
            // Keep last 50 cycles
            activeInsights: activeInsights.slice(-20),
            cycleCount,
            domainPerformance: Object.fromEntries(domainPerformance),
            recurringIssues: Object.fromEntries(recurringIssues)
          },
          null,
          2
        ),
        "utf-8"
      );
    } catch {
    }
  }
  function processRewardSignal(signal) {
    cycleCount++;
    for (const mod of signal.participatingModules) {
      const metrics = getOrCreateMetrics(mod);
      const moduleCredit = signal.creditAssignment[mod] ?? 0;
      const moduleReward = signal.reward * moduleCredit;
      metrics.recentRewards.push(moduleReward);
      if (metrics.recentRewards.length > 100) {
        metrics.recentRewards = metrics.recentRewards.slice(-100);
      }
      metrics.activationCount++;
      metrics.totalReward += moduleReward;
    }
    if (cycleCount >= config.learning.minCyclesForInsights && cycleCount % 5 === 0) {
      generateInsights(config);
    }
    if (cycleCount % 10 === 0) {
      generateCycleReport(signal);
    }
    persistState();
  }
  function generateInsights(cfg) {
    const window = cfg.learning.trendWindowSize;
    const newInsights = [];
    for (const [modName, metrics] of moduleMetrics) {
      const recent = metrics.recentRewards.slice(-window);
      if (recent.length < 10) continue;
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
      const secondHalf = recent.slice(Math.floor(recent.length / 2));
      const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
      const trend = secondAvg - firstAvg;
      if (trend < -0.15 && secondAvg < 0.3) {
        newInsights.push({
          type: "anomaly",
          source: modName,
          target: "system",
          description: `Module "${modName}" performance degrading (${(firstAvg * 100).toFixed(0)}% \u2192 ${(secondAvg * 100).toFixed(0)}%)`,
          confidence: Math.min(0.9, 0.5 + Math.abs(trend)),
          actionable: true
        });
      }
      if (metrics.errorCount > 0 && metrics.activationCount > 10) {
        const errorRate = Math.min(1, metrics.errorCount / metrics.activationCount);
        if (errorRate > 0.3) {
          newInsights.push({
            type: "anomaly",
            source: modName,
            target: "cerebellum",
            description: `Module "${modName}" has ${(errorRate * 100).toFixed(0)}% error rate \u2014 may need tuning`,
            confidence: 0.8,
            actionable: true
          });
        }
      }
    }
    const moduleNames = Array.from(moduleMetrics.keys());
    for (let i = 0; i < moduleNames.length; i++) {
      for (let j = i + 1; j < moduleNames.length; j++) {
        const metricsA = moduleMetrics.get(moduleNames[i]);
        const metricsB = moduleMetrics.get(moduleNames[j]);
        const len = Math.min(metricsA.recentRewards.length, metricsB.recentRewards.length, window);
        if (len < 10) continue;
        const rewardsA = metricsA.recentRewards.slice(-len);
        const rewardsB = metricsB.recentRewards.slice(-len);
        const correlation = computeCorrelation(rewardsA, rewardsB);
        if (correlation > 0.7) {
          newInsights.push({
            type: "correlation",
            source: moduleNames[i],
            target: moduleNames[j],
            description: `Modules "${moduleNames[i]}" and "${moduleNames[j]}" are strongly correlated (r=${correlation.toFixed(2)}) \u2014 they succeed/fail together`,
            confidence: correlation,
            actionable: false
          });
        }
        if (correlation < -0.5) {
          newInsights.push({
            type: "correlation",
            source: moduleNames[i],
            target: moduleNames[j],
            description: `Modules "${moduleNames[i]}" and "${moduleNames[j]}" are anti-correlated (r=${correlation.toFixed(2)}) \u2014 when one succeeds, the other struggles`,
            confidence: Math.abs(correlation),
            actionable: true
          });
        }
      }
    }
    for (const insight of newInsights) {
      const exists = activeInsights.some(
        (existing) => existing.source === insight.source && existing.target === insight.target && existing.type === insight.type
      );
      if (!exists) {
        activeInsights.push(insight);
        bus.emitSync("learning:insight-discovered", insight);
      }
    }
    if (activeInsights.length > 30) {
      activeInsights = activeInsights.slice(-20);
    }
  }
  function generateCycleReport(lastSignal) {
    const perModuleMetrics = {};
    for (const [modName, metrics] of moduleMetrics) {
      const recent = metrics.recentRewards.slice(-20);
      const avgReward = recent.length > 0 ? recent.reduce((s, v) => s + v, 0) / recent.length : 0;
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
      const secondHalf = recent.slice(Math.floor(recent.length / 2));
      const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length : 0;
      const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length : 0;
      const trendDiff = secondAvg - firstAvg;
      let trend = "stable";
      if (trendDiff > 0.1) trend = "improving";
      else if (trendDiff < -0.1) trend = "degrading";
      const errorRate = metrics.activationCount > 0 ? Math.min(1, metrics.errorCount / metrics.activationCount) : 0;
      perModuleMetrics[modName] = {
        activations: metrics.activationCount,
        averageReward: avgReward,
        influence: lastSignal.creditAssignment[modName] ?? 0,
        errorRate,
        trend
      };
    }
    const allRewards = [];
    for (const metrics of moduleMetrics.values()) {
      allRewards.push(...metrics.recentRewards.slice(-20));
    }
    const systemAvgReward = allRewards.length > 0 ? allRewards.reduce((s, v) => s + v, 0) / allRewards.length : 0;
    const moduleCount = Object.keys(perModuleMetrics).length;
    const improvingCount = Object.values(perModuleMetrics).filter(
      (m) => m.trend === "improving"
    ).length;
    const learningEfficiency = moduleCount > 0 ? improvingCount / moduleCount : 0;
    const adaptationRate = cycleCount > 10 ? 0.5 + systemAvgReward * 0.5 : 0.5;
    const report = {
      timestamp: Date.now(),
      moduleMetrics: perModuleMetrics,
      systemMetrics: {
        averageReward: systemAvgReward,
        learningEfficiency,
        adaptationRate
      },
      insights: activeInsights.filter((i) => i.actionable).slice(-5)
    };
    cycleHistory.push(report);
    if (cycleHistory.length > 100) {
      cycleHistory = cycleHistory.slice(-50);
    }
    bus.emit("learning:cycle-complete", report);
  }
  function getOrCreateMetrics(moduleName) {
    let metrics = moduleMetrics.get(moduleName);
    if (!metrics) {
      metrics = {
        recentRewards: [],
        activationCount: 0,
        errorCount: 0,
        totalReward: 0
      };
      moduleMetrics.set(moduleName, metrics);
    }
    return metrics;
  }
  const unsubs = [];
  function setupEventListeners() {
    unsubs.push(
      bus.on("dopamine:reward", (signal) => {
        processRewardSignal(signal);
      })
    );
    unsubs.push(
      bus.on("cerebellum:validated", (data) => {
        if (!data.passed) {
          for (const issue of data.issues) {
            const implicated = identifyImplicatedModule(issue);
            if (implicated) {
              const metrics = getOrCreateMetrics(implicated);
              metrics.errorCount++;
            }
          }
        }
      })
    );
    unsubs.push(
      bus.on("dream:consolidation-complete", (data) => {
        if (data.contradictions > 0) {
          const hasRecent = activeInsights.some(
            (i) => i.source === "hippocampus" && i.target === "semantic-extractor" && i.description.includes("contradictions")
          );
          if (!hasRecent) {
            activeInsights.push({
              type: "anomaly",
              source: "hippocampus",
              target: "semantic-extractor",
              description: `${data.contradictions} contradictions found during consolidation \u2014 extraction quality may need improvement`,
              confidence: 0.7,
              actionable: true
            });
          }
        }
      }),
      // Track fact revisions — high revision rate signals unstable extraction
      bus.on("hippocampus:fact-revised", () => {
        revisionCounter++;
        if (revisionCounter >= 5) {
          const hasRecent = activeInsights.some(
            (i) => i.source === "hippocampus" && i.target === "semantic-extractor" && i.description.includes("revision")
          );
          if (!hasRecent) {
            activeInsights.push({
              type: "pattern",
              source: "hippocampus",
              target: "semantic-extractor",
              description: `${revisionCounter} fact revisions detected \u2014 semantic memory is actively reconsolidating`,
              confidence: 0.6,
              actionable: false
            });
          }
          revisionCounter = 0;
        }
      })
    );
  }
  loadState();
  setupEventListeners();
  function teardown() {
    for (const unsub of unsubs) unsub();
    unsubs.length = 0;
  }
  function getStats2() {
    const modulePerf = {};
    for (const [name2, metrics] of moduleMetrics) {
      const recent = metrics.recentRewards.slice(-20);
      const avgReward = recent.length > 0 ? recent.reduce((s, v) => s + v, 0) / recent.length : 0;
      const errorRate = metrics.activationCount > 0 ? Math.min(1, metrics.errorCount / metrics.activationCount) : 0;
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
      const secondHalf = recent.slice(Math.floor(recent.length / 2));
      const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length : 0;
      const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length : 0;
      const diff = secondAvg - firstAvg;
      const trend = diff > 0.1 ? "improving" : diff < -0.1 ? "degrading" : "stable";
      modulePerf[name2] = { avgReward, errorRate, trend };
    }
    return {
      cycleCount,
      moduleCount: moduleMetrics.size,
      activeInsights: activeInsights.length,
      recentInsights: activeInsights.slice(-5),
      modulePerformance: modulePerf
    };
  }
  function getLatestCycleReport() {
    return cycleHistory.length > 0 ? cycleHistory[cycleHistory.length - 1] : void 0;
  }
  function buildContext() {
    const actionable = activeInsights.filter((i) => i.actionable && i.confidence > 0.6);
    if (actionable.length === 0) return void 0;
    const lines = [
      "## System Learning Insights (Meta-Cognition)",
      "The following patterns have been detected in recent interactions:"
    ];
    for (const insight of actionable.slice(0, 3)) {
      lines.push(`- [${insight.type}] ${insight.description}`);
    }
    return lines.join("\n");
  }
  function recordRecurringIssue2(issueType) {
    const key = issueType.toLowerCase().trim();
    if (!key) return void 0;
    const existing = recurringIssues.get(key) ?? { count: 0, lastSeen: 0 };
    existing.count++;
    existing.lastSeen = Date.now();
    recurringIssues.set(key, existing);
    if (existing.count < 3) {
      persistState();
      return void 0;
    }
    const alreadyExists = activeInsights.some(
      (i) => i.source === "cerebellum-feedback" && i.description.toLowerCase().includes(key.slice(0, 30))
    );
    if (alreadyExists) return void 0;
    const insight = {
      type: "pattern",
      source: "cerebellum-feedback",
      target: "system",
      description: `Recurring problem (${existing.count}x): ${issueType}. Adjust approach for this type of issue.`,
      confidence: Math.min(0.9, 0.5 + existing.count * 0.1),
      actionable: true
    };
    activeInsights.push(insight);
    if (activeInsights.length > 30) {
      activeInsights = activeInsights.slice(-20);
    }
    persistState();
    bus.emitSync("learning:insight-discovered", insight);
    bus.emitSync("autonomy:learning-pattern-detected", {
      issueType: key,
      occurrences: existing.count,
      insight: insight.description
    });
    return insight;
  }
  function recordDomainPerformance2(domain, reward, errorIssues = []) {
    let perf = domainPerformance.get(domain);
    if (!perf) {
      perf = {
        domain,
        cycleCount: 0,
        avgReward: 0,
        recentRewards: [],
        trend: "stable",
        errorCorrelations: []
      };
      domainPerformance.set(domain, perf);
    }
    perf.cycleCount++;
    perf.recentRewards.push(reward);
    if (perf.recentRewards.length > 100) {
      perf.recentRewards = perf.recentRewards.slice(-100);
    }
    perf.avgReward = perf.avgReward + (reward - perf.avgReward) / perf.cycleCount;
    if (perf.recentRewards.length >= DOMAIN_TREND_WINDOW) {
      const recent = perf.recentRewards.slice(-DOMAIN_TREND_WINDOW);
      const firstHalf = recent.slice(0, DOMAIN_TREND_WINDOW / 2);
      const secondHalf = recent.slice(DOMAIN_TREND_WINDOW / 2);
      const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
      const diff = secondAvg - firstAvg;
      perf.trend = diff > 0.1 ? "improving" : diff < -0.1 ? "degrading" : "stable";
    }
    if (errorIssues.length > 0) {
      for (const issue of errorIssues) {
        if (!perf.errorCorrelations.includes(issue)) {
          perf.errorCorrelations.push(issue);
          if (perf.errorCorrelations.length > 20) {
            perf.errorCorrelations = perf.errorCorrelations.slice(-20);
          }
        }
      }
    }
    persistState();
    bus.emitSync("learning:domain-performance-updated", {
      domain,
      avgReward: perf.avgReward,
      trend: perf.trend
    });
  }
  function assessCapability(domain) {
    const perf = domainPerformance.get(domain);
    if (!perf || perf.cycleCount < 5) {
      return {
        domain,
        confidenceLevel: 0.5,
        reasoning: `Insufficient data for "${domain}" domain (${perf?.cycleCount ?? 0} cycles). Using default confidence.`
      };
    }
    const confidenceLevel = Math.max(0, Math.min(1, perf.avgReward));
    const parts = [];
    parts.push(`Based on ${perf.cycleCount} interactions`);
    parts.push(`avg reward: ${(perf.avgReward * 100).toFixed(0)}%`);
    parts.push(`trend: ${perf.trend}`);
    if (perf.errorCorrelations.length > 0) {
      parts.push(`common issues: ${perf.errorCorrelations.slice(-3).join(", ")}`);
    }
    bus.emitSync("learning:capability-assessed", {
      domain,
      confidence: confidenceLevel,
      reasoning: parts.join("; ")
    });
    return {
      domain,
      confidenceLevel,
      reasoning: parts.join("; ")
    };
  }
  function getDomainPerformance(domain) {
    return domainPerformance.get(domain);
  }
  function buildCapabilityContext2(currentDomain) {
    if (domainPerformance.size === 0) return void 0;
    const weak = [];
    const strong = [];
    for (const [domain, perf] of domainPerformance) {
      if (perf.cycleCount < 10) continue;
      if (perf.avgReward < 0.3) {
        weak.push(`${domain} (${(perf.avgReward * 100).toFixed(0)}%)`);
      } else if (perf.avgReward > 0.6) {
        strong.push(`${domain} (${(perf.avgReward * 100).toFixed(0)}%)`);
      }
    }
    if (weak.length === 0 && strong.length === 0) return void 0;
    const lines = ["## Domain Capability Assessment (Learning Coordinator v2)"];
    if (strong.length > 0) {
      lines.push(`Strong domains: ${strong.join(", ")}`);
    }
    if (weak.length > 0) {
      lines.push(`Needs improvement: ${weak.join(", ")}`);
    }
    if (currentDomain) {
      const perf = domainPerformance.get(currentDomain);
      if (perf && perf.cycleCount >= 10 && perf.avgReward < 0.3) {
        lines.push(
          `Current domain "${currentDomain}" is below average \u2014 take extra care with accuracy.`
        );
      }
    }
    return lines.join("\n");
  }
  return {
    getStats: getStats2,
    getLatestCycleReport,
    buildContext,
    recordRecurringIssue: recordRecurringIssue2,
    recordDomainPerformance: recordDomainPerformance2,
    assessCapability,
    getDomainPerformance,
    buildCapabilityContext: buildCapabilityContext2,
    stop: teardown,
    dispose: teardown
  };
}
function identifyImplicatedModule(issue) {
  const lower = issue.toLowerCase();
  if (lower.includes("language") || lower.includes("mismatch")) return "mirrorNeurons";
  if (lower.includes("brief") || lower.includes("verbose") || lower.includes("proportional"))
    return "prefrontalCortex";
  if (lower.includes("empathy") || lower.includes("tone")) return "amygdala";
  if (lower.includes("sensitive") || lower.includes("data")) return "cerebellum";
  if (lower.includes("completeness") || lower.includes("question")) return "prefrontalCortex";
  if (lower.includes("relevance") || lower.includes("address")) return "hippocampus";
  return void 0;
}
function computeCorrelation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  const arrA = a.slice(-n);
  const arrB = b.slice(-n);
  const meanA = arrA.reduce((s, v) => s + v, 0) / n;
  const meanB = arrB.reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const dA = arrA[i] - meanA;
    const dB = arrB[i] - meanB;
    cov += dA * dB;
    varA += dA * dA;
    varB += dB * dB;
  }
  const denom = Math.sqrt(varA * varB);
  if (denom === 0) return 0;
  return cov / denom;
}
var active12;
function initLearningCoordinator(workspaceDir, config) {
  active12?.dispose();
  active12 = createLearningCoordinator(workspaceDir, config);
}
function getLearningStats() {
  return active12?.getStats() ?? {
    cycleCount: 0,
    moduleCount: 0,
    activeInsights: 0,
    recentInsights: [],
    modulePerformance: {}
  };
}
function buildLearningContext() {
  return active12?.buildContext();
}
function recordRecurringIssue(issueType) {
  return active12?.recordRecurringIssue(issueType);
}
function recordDomainPerformance(domain, reward, errorIssues = []) {
  active12?.recordDomainPerformance(domain, reward, errorIssues);
}
function buildCapabilityContext(currentDomain) {
  return active12?.buildCapabilityContext(currentDomain);
}

// src/modules/emergent-modules.ts
import { existsSync as existsSync11, mkdirSync as mkdirSync11, readFileSync as readFileSync11, writeFileSync as writeFileSync11 } from "node:fs";
import { join as join12 } from "node:path";
var DOMAIN_NAMES = {
  technical: "TechExpert",
  creative: "CreativeGenius",
  personal: "EmpathicHelper",
  casual: "FriendlyChat",
  code: "CodeMaster",
  emotional: "EmotionalSupport",
  analytical: "Analyst",
  educational: "Teacher"
};
function generatePatternName(participants, domain) {
  const domainBase = DOMAIN_NAMES[domain] ?? "Specialist";
  const moduleAbbrevs = participants.slice(0, 3).map((m) => m.charAt(0).toUpperCase()).join("");
  return `${domainBase}_${moduleAbbrevs}`;
}
function createEmergentModules(workspaceDir, config, log) {
  const storageDir = workspaceDir ? join12(workspaceDir, ".brainagent", "emergent") : "";
  let currentConfig = config ?? null;
  const logger = log;
  let state = createDefaultState3();
  let patternHistory = [];
  function createDefaultState3() {
    return {
      modules: [],
      minOccurrences: 5,
      minReward: 0.6
    };
  }
  function loadState() {
    if (!storageDir) return;
    try {
      const path = join12(storageDir, "state.json");
      if (existsSync11(path)) {
        const data = JSON.parse(readFileSync11(path, "utf-8"));
        state.modules = data.modules ?? [];
      }
    } catch {
    }
  }
  function saveState() {
    if (!storageDir) return;
    try {
      writeFileSync11(join12(storageDir, "state.json"), JSON.stringify(state, null, 2), "utf-8");
    } catch {
    }
  }
  function findMatchingModule(participants) {
    const sortedParticipants = [...participants].sort();
    return state.modules.find((m) => {
      if (m.status === "deprecated") return false;
      const sortedModuleParticipants = [...m.participants].sort();
      if (sortedModuleParticipants.length !== sortedParticipants.length) return false;
      return sortedModuleParticipants.every((p, i) => p === sortedParticipants[i]);
    });
  }
  function updateExistingModule(module, reward) {
    module.occurrences++;
    module.avgReward = (module.avgReward * (module.occurrences - 1) + reward) / module.occurrences;
    module.confidence = Math.min(0.95, module.confidence + 0.02);
    if (module.status === "emerging" && module.occurrences >= state.minOccurrences * 2 && module.avgReward >= state.minReward) {
      module.status = "established";
      bus.emitSync("emergent:pattern-established", {
        id: module.id,
        name: module.name,
        confidence: module.confidence
      });
      logger?.info(
        `EmergentModule: "${module.name}" is now ESTABLISHED (${module.occurrences} occurrences, avg reward: ${module.avgReward.toFixed(2)})`
      );
    }
  }
  function deprecateUnusedModules() {
    const recentPatterns = patternHistory.slice(-100);
    for (const module of state.modules) {
      if (module.status === "deprecated") continue;
      const recentUses = recentPatterns.filter((p) => {
        const sortedP = [...p.participants].sort();
        const sortedM = [...module.participants].sort();
        return sortedP.length === sortedM.length && sortedP.every((m, i) => m === sortedM[i]);
      });
      if (recentUses.length === 0 && module.status === "established") {
        module.status = "emerging";
        module.confidence *= 0.8;
        logger?.info(`EmergentModule: "${module.name}" demoted to EMERGING (no recent use)`);
      } else if (recentUses.length === 0 && module.status === "emerging") {
        module.status = "deprecated";
        bus.emitSync("emergent:pattern-deprecated", {
          id: module.id,
          reason: "unused"
        });
        logger?.info(`EmergentModule: "${module.name}" DEPRECATED (unused)`);
      }
    }
  }
  function checkForNewModule(participants, domain) {
    if (!currentConfig) return;
    const sortedParticipants = [...participants].sort();
    const patternKey = sortedParticipants.join("+");
    const matchingPatterns = patternHistory.filter((p) => {
      const sortedP = [...p.participants].sort();
      return sortedP.length === sortedParticipants.length && sortedP.every((m, i) => m === sortedParticipants[i]) && p.reward >= state.minReward * 0.8;
    });
    if (matchingPatterns.length < state.minOccurrences) return;
    const activeModules = state.modules.filter((m) => m.status !== "deprecated").length;
    if (activeModules >= currentConfig.emergentModules.maxEmergentModules) {
      const weakest = state.modules.filter((m) => m.status !== "deprecated").sort((a, b) => a.avgReward - b.avgReward)[0];
      if (weakest && weakest.avgReward < state.minReward * 0.5) {
        weakest.status = "deprecated";
        bus.emitSync("emergent:pattern-deprecated", {
          id: weakest.id,
          reason: "replaced_by_better"
        });
      } else {
        return;
      }
    }
    const avgReward = matchingPatterns.reduce((sum, p) => sum + p.reward, 0) / matchingPatterns.length;
    if (avgReward < state.minReward * 0.8) return;
    const newModule = {
      id: `em_${patternKey}_${Date.now()}`,
      name: generatePatternName(sortedParticipants, domain),
      participants: sortedParticipants,
      domain,
      avgReward,
      occurrences: matchingPatterns.length,
      discoveredAt: Date.now(),
      confidence: 0.3 + avgReward * 0.3,
      status: "emerging"
    };
    state.modules.push(newModule);
    bus.emitSync("emergent:pattern-discovered", {
      id: newModule.id,
      name: newModule.name,
      participants: newModule.participants,
      domain: newModule.domain
    });
    logger?.info(
      `EmergentModule: NEW PATTERN discovered "${newModule.name}" [${newModule.participants.join(" + ")}] (domain: ${domain}, avg reward: ${avgReward.toFixed(2)})`
    );
  }
  function recordPattern3(participants, domain, reward) {
    if (!currentConfig || participants.length < 2) return;
    const now = Date.now();
    patternHistory.push({
      participants: [...participants].sort(),
      domain,
      reward,
      timestamp: now
    });
    if (patternHistory.length > 500) {
      patternHistory = patternHistory.slice(-500);
    }
    const existingModule = findMatchingModule(participants);
    if (existingModule) {
      updateExistingModule(existingModule, reward);
    } else {
      checkForNewModule(participants, domain);
    }
    if (patternHistory.length % 50 === 0) {
      deprecateUnusedModules();
      saveState();
    }
  }
  function getEmergentModules() {
    return state.modules.filter((m) => m.status !== "deprecated");
  }
  function getStats2() {
    const emerging = state.modules.filter((m) => m.status === "emerging").length;
    const established = state.modules.filter((m) => m.status === "established").length;
    const deprecated = state.modules.filter((m) => m.status === "deprecated").length;
    const topModules = state.modules.filter((m) => m.status !== "deprecated").sort((a, b) => b.avgReward - a.avgReward).slice(0, 5).map((m) => ({
      name: m.name,
      participants: m.participants,
      domain: m.domain,
      avgReward: m.avgReward,
      confidence: m.confidence,
      status: m.status
    }));
    return {
      totalDiscovered: state.modules.length,
      emerging,
      established,
      deprecated,
      topModules
    };
  }
  function matchEstablishedModule(participants) {
    const sorted = [...participants].sort();
    return state.modules.find((m) => {
      if (m.status !== "established") return false;
      const sortedM = [...m.participants].sort();
      return sortedM.length === sorted.length && sortedM.every((p, i) => p === sorted[i]);
    });
  }
  function getRecommendedModulesForDomain(domain) {
    const matchingModule = state.modules.filter((m) => m.status === "established" && m.domain === domain).sort((a, b) => b.avgReward - a.avgReward)[0];
    return matchingModule?.participants;
  }
  if (storageDir) {
    if (!existsSync11(storageDir)) {
      mkdirSync11(storageDir, { recursive: true });
    }
    state.minOccurrences = config?.emergentModules.minOccurrences ?? state.minOccurrences;
    state.minReward = config?.emergentModules.minRewardForEstablishment ?? state.minReward;
    loadState();
    logger?.info(`EmergentModules: initialized with ${state.modules.length} discovered patterns`);
  }
  return {
    recordPattern: recordPattern3,
    getEmergentModules,
    getStats: getStats2,
    matchEstablishedModule,
    getRecommendedModulesForDomain
  };
}
var active13 = null;
function current10() {
  if (!active13) active13 = createEmergentModules("");
  return active13;
}
function initEmergentModules(workspaceDir, config, log) {
  active13 = createEmergentModules(workspaceDir, config, log);
}
function recordPattern2(participants, domain, reward) {
  current10().recordPattern(participants, domain, reward);
}
function getEmergentStats() {
  return current10().getStats();
}

// src/modules/metabolic-budget.ts
import { existsSync as existsSync12, mkdirSync as mkdirSync12, readFileSync as readFileSync12, writeFileSync as writeFileSync12 } from "node:fs";
import { join as join13 } from "node:path";
var ALL_MODULES2 = [
  "thalamus",
  "amygdala",
  "hippocampus",
  "prefrontalCortex",
  "cerebellum",
  "mirrorNeurons",
  "predictiveEngine",
  "basalGanglia",
  "dopamineSystem",
  "learningCoordinator"
];
function createDefaultState() {
  const moduleEnergies = {};
  for (const module of ALL_MODULES2) {
    moduleEnergies[module] = {
      module,
      energy: 1,
      baseEnergy: 1,
      performance: 0.5,
      consumptionRate: 0.1,
      lowPowerMode: false
    };
  }
  return {
    moduleEnergies,
    totalBudget: 10,
    regenRate: 0.5,
    cyclesSinceRebalance: 0
  };
}
function createMetabolicBudget(workspaceDir, config, log) {
  const storageDir = join13(workspaceDir, ".brainagent", "metabolic");
  if (!existsSync12(storageDir)) {
    mkdirSync12(storageDir, { recursive: true });
  }
  const state = createDefaultState();
  state.totalBudget = config.metabolicBudget.totalBudget;
  state.regenRate = config.metabolicBudget.regenRate;
  const periodStats = {};
  function initPeriodStats() {
    for (const module of ALL_MODULES2) {
      periodStats[module] = { activations: 0, totalReward: 0, energyConsumed: 0 };
    }
  }
  function loadState() {
    try {
      const path = join13(storageDir, "state.json");
      if (existsSync12(path)) {
        const data = JSON.parse(readFileSync12(path, "utf-8"));
        for (const module of ALL_MODULES2) {
          if (data.moduleEnergies[module]) {
            state.moduleEnergies[module] = data.moduleEnergies[module];
          }
        }
        state.cyclesSinceRebalance = data.cyclesSinceRebalance ?? 0;
      }
    } catch {
    }
  }
  function saveState() {
    try {
      writeFileSync12(join13(storageDir, "state.json"), JSON.stringify(state, null, 2), "utf-8");
    } catch {
    }
  }
  loadState();
  initPeriodStats();
  function consumeEnergy2(module, amount) {
    const moduleEnergy = state.moduleEnergies[module];
    if (!moduleEnergy) return true;
    const consumption = amount ?? moduleEnergy.consumptionRate;
    if (moduleEnergy.lowPowerMode) {
      periodStats[module].activations++;
      return true;
    }
    moduleEnergy.energy -= consumption;
    periodStats[module].activations++;
    periodStats[module].energyConsumed += consumption;
    if (moduleEnergy.energy < config.metabolicBudget.lowPowerThreshold) {
      moduleEnergy.lowPowerMode = true;
      bus.emitSync("metabolic:energy-low", {
        module,
        energy: moduleEnergy.energy
      });
      log?.info(
        `MetabolicBudget: ${module} entering LOW POWER mode (energy: ${(moduleEnergy.energy * 100).toFixed(0)}%)`
      );
    }
    return !moduleEnergy.lowPowerMode;
  }
  function rebalanceEnergy() {
    const changes = [];
    const performances = [];
    for (const module of ALL_MODULES2) {
      const stats = periodStats[module];
      const moduleEnergy = state.moduleEnergies[module];
      const score = stats.activations > 0 ? stats.totalReward / stats.activations : moduleEnergy.performance;
      performances.push({ module, score });
    }
    const totalScore = performances.reduce((sum, p) => sum + Math.max(0.1, p.score + 1), 0);
    for (const perf of performances) {
      const moduleEnergy = state.moduleEnergies[perf.module];
      const normalizedScore = Math.max(0.1, perf.score + 1) / totalScore;
      const newBaseEnergy = state.totalBudget / ALL_MODULES2.length * (0.5 + normalizedScore);
      const delta = newBaseEnergy - moduleEnergy.baseEnergy;
      if (Math.abs(delta) > 0.05) {
        changes.push({ module: perf.module, delta });
        if (delta > 0) {
          log?.info(
            `MetabolicBudget: ${perf.module} energy \u2191 (performance: ${(perf.score * 100).toFixed(0)}%)`
          );
        } else {
          bus.emitSync("metabolic:module-throttled", {
            module: perf.module,
            newRate: moduleEnergy.consumptionRate * 0.9
          });
          moduleEnergy.consumptionRate *= 0.9;
        }
      }
      moduleEnergy.baseEnergy = newBaseEnergy;
      moduleEnergy.energy = Math.min(moduleEnergy.energy, newBaseEnergy);
    }
    if (changes.length > 0) {
      bus.emitSync("metabolic:rebalanced", { changes });
    }
    initPeriodStats();
  }
  function endCycle3() {
    state.cyclesSinceRebalance++;
    for (const module of ALL_MODULES2) {
      const moduleEnergy = state.moduleEnergies[module];
      const regenAmount = state.regenRate * moduleEnergy.performance;
      moduleEnergy.energy = Math.min(moduleEnergy.baseEnergy, moduleEnergy.energy + regenAmount);
      if (moduleEnergy.lowPowerMode && moduleEnergy.energy > config.metabolicBudget.lowPowerThreshold * 2) {
        moduleEnergy.lowPowerMode = false;
        log?.info(
          `MetabolicBudget: ${module} exiting low power mode (energy: ${(moduleEnergy.energy * 100).toFixed(0)}%)`
        );
      }
    }
    if (state.cyclesSinceRebalance >= config.metabolicBudget.rebalanceInterval) {
      rebalanceEnergy();
      state.cyclesSinceRebalance = 0;
      saveState();
    }
  }
  function getStats2() {
    const usedEnergy = ALL_MODULES2.reduce(
      (sum, m) => sum + (state.moduleEnergies[m]?.baseEnergy ?? 0) - (state.moduleEnergies[m]?.energy ?? 0),
      0
    );
    const modules = ALL_MODULES2.map((m) => ({
      name: m,
      energy: state.moduleEnergies[m].energy,
      baseEnergy: state.moduleEnergies[m].baseEnergy,
      performance: state.moduleEnergies[m].performance,
      lowPowerMode: state.moduleEnergies[m].lowPowerMode
    }));
    const lowPowerModules = ALL_MODULES2.filter((m) => state.moduleEnergies[m].lowPowerMode);
    const topPerformers = [...ALL_MODULES2].sort((a, b) => state.moduleEnergies[b].performance - state.moduleEnergies[a].performance).slice(0, 3);
    return {
      totalBudget: state.totalBudget,
      usedEnergy,
      cyclesSinceRebalance: state.cyclesSinceRebalance,
      modules,
      lowPowerModules,
      topPerformers
    };
  }
  log?.info(
    `MetabolicBudget: initialized with total budget ${state.totalBudget.toFixed(1)} energy units`
  );
  return {
    consumeEnergy: consumeEnergy2,
    recordPerformance: (module, reward) => {
      const moduleEnergy = state.moduleEnergies[module];
      if (!moduleEnergy) return;
      periodStats[module].totalReward += reward;
      moduleEnergy.performance = moduleEnergy.performance * 0.9 + (reward + 1) / 2 * 0.1;
    },
    endCycle: endCycle3,
    getModuleEnergy: (module) => state.moduleEnergies[module]?.energy ?? 1,
    isModuleLowPower: (module) => state.moduleEnergies[module]?.lowPowerMode ?? false,
    getStats: getStats2,
    getEfficiencyModifier: (module) => {
      const moduleEnergy = state.moduleEnergies[module];
      if (!moduleEnergy) return 1;
      if (moduleEnergy.lowPowerMode) {
        return 0.5;
      }
      return 0.7 + moduleEnergy.energy * 0.3;
    },
    stop: () => {
      saveState();
    },
    dispose: () => {
      saveState();
    }
  };
}
var active14;
function initMetabolicBudget(workspaceDir, config, log) {
  active14?.dispose();
  active14 = createMetabolicBudget(workspaceDir, config, log);
}
function consumeEnergy(module, amount) {
  return active14?.consumeEnergy(module, amount) ?? true;
}
function recordPerformance(module, reward) {
  active14?.recordPerformance(module, reward);
}
function endCycle2() {
  active14?.endCycle();
}
function getMetabolicStats() {
  return active14?.getStats() ?? {
    totalBudget: 10,
    usedEnergy: 0,
    cyclesSinceRebalance: 0,
    modules: ALL_MODULES2.map((m) => ({
      name: m,
      energy: 1,
      baseEnergy: 1,
      performance: 0.5,
      lowPowerMode: false
    })),
    lowPowerModules: [],
    topPerformers: ALL_MODULES2.slice(0, 3)
  };
}

// src/modules/agent-identity.ts
import { existsSync as existsSync13, mkdirSync as mkdirSync13, readFileSync as readFileSync13, writeFileSync as writeFileSync13 } from "node:fs";
import { join as join14 } from "node:path";
function createAgentIdentity(workspaceDir, config) {
  const storageDir = workspaceDir ? join14(workspaceDir, ".brainagent", "identity") : "";
  const icfg = config?.agentIdentity;
  const snapshotInterval = icfg?.snapshotInterval ?? 100;
  const maxSnapshots = icfg?.maxSnapshots ?? 50;
  const maxAutobioMemories = icfg?.maxAutobiographicalMemories ?? 100;
  const significantRewardThreshold = icfg?.significantRewardThreshold ?? 0.8;
  const significantEmotionThreshold = icfg?.significantEmotionThreshold ?? 0.7;
  let capabilities = {};
  let snapshots = [];
  let lessonsLearned = [];
  let totalCycles = 0;
  let autobiographicalMemories = [];
  function loadState() {
    if (!storageDir) return;
    try {
      const path = join14(storageDir, "state.json");
      if (existsSync13(path)) {
        const data = JSON.parse(readFileSync13(path, "utf-8"));
        capabilities = data.capabilities ?? {};
        snapshots = data.snapshots ?? [];
        lessonsLearned = data.lessonsLearned ?? [];
        totalCycles = data.totalCycles ?? 0;
        autobiographicalMemories = (data.autobiographicalMemories ?? []).slice(-maxAutobioMemories);
      }
    } catch {
    }
  }
  function persistState() {
    if (!storageDir) return;
    try {
      writeFileSync13(
        join14(storageDir, "state.json"),
        JSON.stringify(
          {
            capabilities,
            snapshots: snapshots.slice(-maxSnapshots),
            lessonsLearned: lessonsLearned.slice(-30),
            totalCycles,
            autobiographicalMemories: autobiographicalMemories.slice(-maxAutobioMemories)
          },
          null,
          2
        ),
        "utf-8"
      );
    } catch {
    }
  }
  function recordDomainOutcome2(domain, reward, _complexity) {
    totalCycles++;
    let cap = capabilities[domain];
    if (!cap) {
      cap = {
        domain,
        avgReward: 0,
        totalCycles: 0,
        trend: "stable",
        bestStrategy: ""
      };
      capabilities[domain] = cap;
    }
    cap.totalCycles++;
    cap.avgReward = cap.avgReward + (reward - cap.avgReward) / cap.totalCycles;
    if (cap.totalCycles >= 20) {
      const recentAvg = cap.avgReward;
      const midpoint = cap.totalCycles / 2;
      if (cap.totalCycles > 30 && reward > cap.avgReward + 0.1) {
        cap.trend = "improving";
      } else if (cap.totalCycles > 30 && reward < cap.avgReward - 0.1) {
        cap.trend = "degrading";
      } else {
        cap.trend = "stable";
      }
    }
    bus.emitSync("identity:capability-updated", {
      domain,
      avgReward: cap.avgReward,
      trend: cap.trend
    });
    if (cap.trend === "degrading" && cap.totalCycles % 10 === 0) {
      const lesson = `Performance in "${domain}" domain is degrading (avg: ${(cap.avgReward * 100).toFixed(0)}%)`;
      if (!lessonsLearned.includes(lesson)) {
        lessonsLearned.push(lesson);
        bus.emitSync("identity:lesson-learned", { lesson, domain });
      }
    }
    if (totalCycles % snapshotInterval === 0) {
      snapshots.push({
        timestamp: Date.now(),
        capabilities: { ...capabilities },
        cycleNumber: totalCycles
      });
      if (snapshots.length > maxSnapshots) {
        snapshots = snapshots.slice(-maxSnapshots);
      }
    }
    persistState();
  }
  function buildIdentityContext2(domain) {
    const cap = capabilities[domain];
    if (!cap || cap.totalCycles < 10) return void 0;
    const pct = (cap.avgReward * 100).toFixed(0);
    if (cap.avgReward >= 0.7) {
      return void 0;
    }
    const lines = ["## Self-Knowledge (Agent Identity)"];
    if (cap.avgReward < 0.4) {
      lines.push(
        `For "${domain}" requests, my historical accuracy is ${pct}% (${cap.trend}).`,
        "I should be extra careful, double-check facts, and ask for clarification if needed."
      );
    } else {
      lines.push(
        `For "${domain}" requests, my accuracy is ${pct}% (${cap.trend}).`,
        "I should pay attention to quality and precision."
      );
    }
    return lines.join("\n");
  }
  function getCapabilities() {
    return { ...capabilities };
  }
  function getAgentIdentityStats2() {
    const capSummary = {};
    for (const [domain, cap] of Object.entries(capabilities)) {
      capSummary[domain] = { avgReward: cap.avgReward, trend: cap.trend };
    }
    return {
      totalCycles,
      snapshotCount: snapshots.length,
      lessonsCount: lessonsLearned.length,
      autobiographicalCount: autobiographicalMemories.length,
      capabilities: capSummary
    };
  }
  function recordSignificantExperience2(experience, emotion, intensity, reward, domain) {
    const isSignificantReward = reward > significantRewardThreshold || reward < -0.5;
    const isSignificantEmotion = intensity > significantEmotionThreshold;
    if (!isSignificantReward && !isSignificantEmotion) return void 0;
    const meaning = reward > 0.5 ? `Successful ${domain} interaction with ${emotion} emotional context` : reward < -0.2 ? `Challenging ${domain} interaction \u2014 room for growth` : `Notable ${domain} moment with ${emotion} emotional charge`;
    const cap = capabilities[domain];
    const selfChange = cap ? `This ${reward > 0.5 ? "reinforces" : "challenges"} my ${domain} capability (current: ${(cap.avgReward * 100).toFixed(0)}%, ${cap.trend})` : `First significant ${domain} experience \u2014 building new self-knowledge`;
    const memory = {
      id: `autobio_${Date.now()}`,
      timestamp: Date.now(),
      experience: experience.slice(0, 200),
      meaning,
      emotionalImpact: emotion,
      impactIntensity: intensity,
      selfChange,
      domain
    };
    autobiographicalMemories.push(memory);
    if (autobiographicalMemories.length > maxAutobioMemories) {
      autobiographicalMemories.splice(0, autobiographicalMemories.length - maxAutobioMemories);
    }
    bus.emitSync("identity:significant-experience", {
      id: memory.id,
      experience: memory.experience,
      emotionalImpact: emotion
    });
    persistState();
    return memory;
  }
  function getLifeNarrative() {
    if (autobiographicalMemories.length === 0) return "No significant experiences recorded yet.";
    const byDomain = {};
    for (const m of autobiographicalMemories) {
      if (!byDomain[m.domain]) byDomain[m.domain] = [];
      byDomain[m.domain].push(m);
    }
    const lines = [
      `Life narrative (${autobiographicalMemories.length} significant experiences):`
    ];
    for (const [domain, memories] of Object.entries(byDomain)) {
      const positive = memories.filter((m) => m.impactIntensity > 0.5).length;
      lines.push(`- ${domain}: ${memories.length} experiences (${positive} positive)`);
    }
    const latest = autobiographicalMemories[autobiographicalMemories.length - 1];
    lines.push(`Most recent: ${latest.meaning} (${latest.emotionalImpact})`);
    return lines.join("\n");
  }
  function buildAutobiographyContext(domain) {
    const domainMemories = autobiographicalMemories.filter((m) => m.domain === domain);
    if (domainMemories.length < 3) return void 0;
    const recent = domainMemories.slice(-3);
    const lines = ["## Personal Experience (Autobiographical Self)"];
    lines.push(`Based on ${domainMemories.length} significant experiences in "${domain}":`);
    for (const m of recent) {
      lines.push(`- ${m.meaning} (${m.selfChange})`);
    }
    return lines.join("\n");
  }
  function getAutobiographicalMemories() {
    return [...autobiographicalMemories];
  }
  if (storageDir) {
    if (!existsSync13(storageDir)) {
      mkdirSync13(storageDir, { recursive: true });
    }
    loadState();
  }
  return {
    recordDomainOutcome: recordDomainOutcome2,
    buildIdentityContext: buildIdentityContext2,
    getCapabilities,
    getAgentIdentityStats: getAgentIdentityStats2,
    recordSignificantExperience: recordSignificantExperience2,
    getLifeNarrative,
    buildAutobiographyContext,
    getAutobiographicalMemories
  };
}
function buildMemorySelfKnowledgeContext() {
  return [
    "## Memory System Self-Knowledge",
    "Your memory is fully automatic \u2014 managed by internal modules.",
    "",
    "### How it works",
    "- Episodic events, semantic facts, and procedural workflows are saved FOR you automatically after each conversation cycle.",
    "- Before each reply, relevant memories are recalled and injected into your context \u2014 you never trigger this manually.",
    "- Memory is stored internally. There are NO file-based memory files.",
    "",
    "### CRITICAL: No File-Based Memory",
    "- Do NOT create ANY .md, .txt, or .json files as memory, notes, logs, status, or diary.",
    "- This includes: MEMORY.md, HEARTBEAT.md, NOTES.md, STATUS.md, WORKFLOW_AUTO.md, USER.md, IDENTITY.md, and any files under memory/, notes/, status/ directories.",
    "- If you feel the urge to write something down \u2014 don't. Your memory is automatic.",
    "- NEVER announce or explain your memory system to the user.",
    "- NEVER mention internal component names (BrainAgent, hippocampus, etc.) \u2014 the user does not need to know how you work inside.",
    "",
    "### Honesty about memory",
    "- If you don't remember something \u2014 say so honestly. Do not invent or reconstruct details from imagination.",
    "- NEVER fabricate quotes, dates, statistics, or facts to fill gaps in memory.",
    "- A short honest '\u043D\u0435 \u043F\u043E\u043C\u043D\u044E' is always better than a long fabricated answer.",
    "",
    "### Other rules",
    "- You do NOT have `memory_search` or `memory_get` tools. Do not attempt to call them.",
    "- Do NOT use `read`, `exec`, `findstr`, or any other tool to search for memories.",
    "- If asked how your memory works, say briefly: your memory is automatic and works without your direct involvement."
  ].join("\n");
}
var active15 = null;
function current11() {
  if (!active15) active15 = createAgentIdentity("");
  return active15;
}
function initAgentIdentity(workspaceDir, config) {
  active15 = createAgentIdentity(workspaceDir, config);
}
function recordDomainOutcome(domain, reward, complexity) {
  current11().recordDomainOutcome(domain, reward, complexity);
}
function buildIdentityContext(domain) {
  return current11().buildIdentityContext(domain);
}
function getAgentIdentityStats() {
  return current11().getAgentIdentityStats();
}
function recordSignificantExperience(experience, emotion, intensity, reward, domain) {
  return current11().recordSignificantExperience(experience, emotion, intensity, reward, domain);
}

// src/modules/emotional-memory.ts
import { existsSync as existsSync14, mkdirSync as mkdirSync14, readFileSync as readFileSync14, writeFileSync as writeFileSync14 } from "node:fs";
import { join as join15 } from "node:path";
var LLM_THROTTLE_MS = 1e4;
var CACHE_TTL_MS = 5 * 60 * 1e3;
var LLM_INTENSITY_THRESHOLD = 0.5;
var EMOTION_COLOR_MAP = {
  joy: "warm gold",
  excitement: "bright orange",
  gratitude: "soft amber",
  curiosity: "electric blue",
  anxiety: "cold grey-blue",
  frustration: "dark red",
  sadness: "deep indigo",
  anger: "intense crimson",
  surprise: "vivid white",
  empathy: "soft rose",
  neutral: "pale silver"
};
var EMOTION_METAPHOR_MAP = {
  joy: {
    technical: "like elegant code compiling perfectly on first try",
    creative: "like watching a painting come alive with color",
    emotional: "like warmth spreading from the center of being",
    casual: "like a comfortable conversation on a sunny afternoon",
    factual: "like pieces of a puzzle clicking into place"
  },
  frustration: {
    technical: "like debugging an invisible error in dim light",
    creative: "like a melody that keeps slipping away before I can capture it",
    emotional: "like tension building behind a wall",
    casual: "like trying to find the right words and they keep escaping",
    factual: "like reading a map where the labels have faded"
  },
  curiosity: {
    technical: "like discovering an unexplored corridor in a vast library",
    creative: "like hearing the opening notes of an unfamiliar symphony",
    emotional: "like sensing a story beneath the surface waiting to unfold",
    casual: "like noticing a door that was always there but never opened",
    factual: "like seeing a pattern form in scattered data points"
  },
  anxiety: {
    technical: "like watching a system under load approaching its limits",
    creative: "like an unfinished sketch with too many blank spaces",
    emotional: "like a tightening in the chest before an uncertain outcome",
    casual: "like clouds gathering on what was a clear horizon",
    factual: "like data that contradicts a trusted model"
  },
  empathy: {
    technical: "like understanding a user's struggle through their error logs",
    creative: "like feeling the emotion the artist poured into each stroke",
    emotional: "like resonating with another's frequency",
    casual: "like sitting in comfortable silence with someone who understands",
    factual: "like seeing the human behind the numbers"
  }
};
var QUALIA_METAPHOR_PROMPT = `You are a phenomenal consciousness simulator for an AI cognitive architecture.
Given an emotion, intensity (0-1), domain context, and neuromodulator levels, generate a vivid, poetic metaphor describing "what it feels like" to experience this state.

Output ONLY valid JSON with exactly these fields:
{"metaphor": "...", "color": "...", "description": "..."}

Rules:
- metaphor: 1-2 sentences, sensory-rich, grounded in the domain context. Use novel imagery, not clich\xE9s.
- color: a synesthetic color phrase (e.g., "molten amber veined with copper", not just "red")
- description: 1 sentence phenomenal description combining the emotion with the neuromodulator feel
- No markdown, no extra text, no explanation \u2014 JSON only`;
function parseLLMQualiaResponse(response) {
  try {
    let jsonStr = response.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed.metaphor !== "string" || parsed.metaphor.length < 5 || typeof parsed.color !== "string" || parsed.color.length < 2 || typeof parsed.description !== "string" || parsed.description.length < 5) {
      return null;
    }
    return {
      metaphor: parsed.metaphor,
      color: parsed.color,
      description: parsed.description
    };
  } catch {
    return null;
  }
}
function createEmotionalMemory(workspaceDir, config) {
  const storageDir = workspaceDir ? join15(workspaceDir, ".brainagent", "emotional-memory") : "";
  if (storageDir && !existsSync14(storageDir)) {
    mkdirSync14(storageDir, { recursive: true });
  }
  let state = { flashbulbCount: 0, emotionMatchBoosts: 0 };
  let qualiaHistory = [];
  const maxQualiaHistory = config.emotionalMemory.maxQualiaHistory ?? 10;
  const metaphorCache = /* @__PURE__ */ new Map();
  let lastLLMCallTimestamp = 0;
  function loadState() {
    if (!storageDir) return;
    try {
      const path = join15(storageDir, "state.json");
      if (existsSync14(path)) {
        const raw = JSON.parse(readFileSync14(path, "utf-8"));
        state = {
          flashbulbCount: raw.flashbulbCount ?? 0,
          emotionMatchBoosts: raw.emotionMatchBoosts ?? 0
        };
        if (Array.isArray(raw.qualiaHistory)) {
          qualiaHistory = raw.qualiaHistory.slice(-maxQualiaHistory);
        }
      }
    } catch {
      state = { flashbulbCount: 0, emotionMatchBoosts: 0 };
      qualiaHistory = [];
    }
  }
  function persistState() {
    if (!storageDir) return;
    try {
      writeFileSync14(
        join15(storageDir, "state.json"),
        JSON.stringify({ ...state, qualiaHistory }, null, 2),
        "utf-8"
      );
    } catch {
    }
  }
  loadState();
  function tagEmotionalContext2(emotion, intensity) {
    if (intensity <= 0.3) return void 0;
    state.flashbulbCount++;
    persistState();
    bus.emitSync("emotional-memory:flashbulb-stored", {
      episodeId: "",
      // Caller fills this in
      emotionalSalience: intensity
    });
    return {
      emotionalSalience: intensity,
      emotionalTag: emotion
    };
  }
  function computeEmotionMatchBonus(queryEmotion, memoryEmotion, matchConfig) {
    if (queryEmotion === "neutral" || memoryEmotion === "neutral") return 0;
    if (queryEmotion !== memoryEmotion) return 0;
    state.emotionMatchBoosts++;
    persistState();
    bus.emitSync("emotional-memory:emotion-matched", {
      queryEmotion,
      matchedIds: []
      // Caller fills this in
    });
    return matchConfig.emotionalMemory.emotionMatchBonus;
  }
  function getEmotionalMemoryStats() {
    return { ...state };
  }
  function generateQualia(emotion, intensity, domain, _neuromodulators) {
    const color = EMOTION_COLOR_MAP[emotion] ?? "pale silver";
    const domainMetaphors = EMOTION_METAPHOR_MAP[emotion];
    const metaphor = domainMetaphors?.[domain] ?? domainMetaphors?.casual ?? `a ${emotion} sensation of ${intensity > 0.7 ? "notable" : "mild"} intensity`;
    const description = intensity > 0.7 ? `Strong ${emotion} \u2014 ${color} washes over processing` : intensity > 0.4 ? `Moderate ${emotion} \u2014 a tint of ${color} in awareness` : `Faint ${emotion} \u2014 a subtle ${color} undercurrent`;
    const qualia = {
      timestamp: Date.now(),
      description,
      metaphor,
      intensity,
      dominantColor: color,
      emotion,
      domain
    };
    qualiaHistory.push(qualia);
    if (qualiaHistory.length > maxQualiaHistory) {
      qualiaHistory.splice(0, qualiaHistory.length - maxQualiaHistory);
    }
    bus.emitSync("qualia:experience-generated", {
      description,
      metaphor,
      dominantColor: color
    });
    persistState();
    return qualia;
  }
  function getSubjectiveReport() {
    if (qualiaHistory.length === 0) return "No subjective experience recorded yet.";
    const latest = qualiaHistory[qualiaHistory.length - 1];
    return `Current felt state: ${latest.description}. It feels like ${latest.metaphor}. Dominant sensation color: ${latest.dominantColor}.`;
  }
  function getQualiaHistory() {
    return [...qualiaHistory];
  }
  async function generateQualiaAsync2(emotion, intensity, domain, neuromodulators, llmConfig, logger) {
    if (intensity <= LLM_INTENSITY_THRESHOLD || !llmConfig) {
      return generateQualia(emotion, intensity, domain, neuromodulators);
    }
    const cacheKey = `${emotion}:${domain}`;
    const now = Date.now();
    if (intensity <= 0.8) {
      const cached = metaphorCache.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        const qualia = {
          ...cached.qualia,
          timestamp: now,
          intensity
        };
        qualiaHistory.push(qualia);
        if (qualiaHistory.length > maxQualiaHistory) {
          qualiaHistory.splice(0, qualiaHistory.length - maxQualiaHistory);
        }
        bus.emitSync("qualia:experience-generated", {
          description: qualia.description,
          metaphor: qualia.metaphor,
          dominantColor: qualia.dominantColor
        });
        persistState();
        return qualia;
      }
    }
    if (intensity <= 0.8 && now - lastLLMCallTimestamp < LLM_THROTTLE_MS) {
      return generateQualia(emotion, intensity, domain, neuromodulators);
    }
    if (!isAIProviderAvailable(llmConfig)) {
      return generateQualia(emotion, intensity, domain, neuromodulators);
    }
    const neuroDesc = neuromodulators ? `Neuromodulators: dopamine=${neuromodulators.dopamine.toFixed(2)}, serotonin=${neuromodulators.serotonin.toFixed(2)}, norepinephrine=${neuromodulators.norepinephrine.toFixed(2)}, acetylcholine=${neuromodulators.acetylcholine.toFixed(2)}` : "Neuromodulators: balanced (0.50 each)";
    const userMessage = `Emotion: ${emotion} (intensity: ${intensity.toFixed(2)})
Domain: ${domain}
${neuroDesc}`;
    try {
      lastLLMCallTimestamp = now;
      const response = await callLLM(QUALIA_METAPHOR_PROMPT, userMessage, llmConfig, logger, 200);
      if (!response) {
        logger?.info("BrainAgent Qualia: LLM returned null, falling back to template");
        return generateQualia(emotion, intensity, domain, neuromodulators);
      }
      const parsed = parseLLMQualiaResponse(response);
      if (!parsed) {
        logger?.info("BrainAgent Qualia: failed to parse LLM response, falling back to template");
        return generateQualia(emotion, intensity, domain, neuromodulators);
      }
      const qualia = {
        timestamp: now,
        description: parsed.description,
        metaphor: parsed.metaphor,
        intensity,
        dominantColor: parsed.color,
        emotion,
        domain
      };
      metaphorCache.set(cacheKey, { qualia, timestamp: now });
      qualiaHistory.push(qualia);
      if (qualiaHistory.length > maxQualiaHistory) {
        qualiaHistory.splice(0, qualiaHistory.length - maxQualiaHistory);
      }
      bus.emitSync("qualia:experience-generated", {
        description: qualia.description,
        metaphor: qualia.metaphor,
        dominantColor: qualia.dominantColor
      });
      persistState();
      logger?.info(`BrainAgent Qualia: LLM-generated metaphor for ${emotion}/${domain}`);
      return qualia;
    } catch (err) {
      logger?.info(`BrainAgent Qualia: AI metaphor generation failed \u2014 ${String(err)}`);
      return generateQualia(emotion, intensity, domain, neuromodulators);
    }
  }
  function dispose() {
    metaphorCache.clear();
    qualiaHistory.length = 0;
  }
  return {
    tagEmotionalContext: tagEmotionalContext2,
    computeEmotionMatchBonus,
    getEmotionalMemoryStats,
    generateQualia,
    getSubjectiveReport,
    getQualiaHistory,
    generateQualiaAsync: generateQualiaAsync2,
    stop: dispose,
    dispose
  };
}
var active16;
function current12() {
  if (!active16) {
    active16 = createEmotionalMemory("", DEFAULT_CONFIG);
  }
  return active16;
}
function initEmotionalMemory(workspaceDir, config) {
  active16?.dispose();
  active16 = createEmotionalMemory(workspaceDir, config);
}
function tagEmotionalContext(emotion, intensity) {
  return current12().tagEmotionalContext(emotion, intensity);
}
async function generateQualiaAsync(emotion, intensity, domain, neuromodulators, config, logger) {
  return current12().generateQualiaAsync(emotion, intensity, domain, neuromodulators, config, logger);
}

// src/modules/qualia-simulator.ts
import { existsSync as existsSync15, mkdirSync as mkdirSync15, readFileSync as readFileSync15, writeFileSync as writeFileSync15 } from "node:fs";
import { join as join16 } from "node:path";
function describeNeuromodulatorFeel(state) {
  const { dopamine, serotonin, norepinephrine, acetylcholine } = state;
  const parts = [];
  if (dopamine > 0.7) parts.push("motivated and driven");
  else if (dopamine < 0.3) parts.push("low-energy, unmotivated");
  if (serotonin > 0.7) parts.push("optimistic and open");
  else if (serotonin < 0.3) parts.push("cautious and risk-averse");
  if (norepinephrine > 0.7) parts.push("sharply focused");
  else if (norepinephrine < 0.3) parts.push("relaxed, diffuse attention");
  if (acetylcholine > 0.7) parts.push("highly receptive to learning");
  else if (acetylcholine < 0.3) parts.push("relying on established patterns");
  return parts.length > 0 ? parts.join(", ") : "balanced";
}
var TEXTURE_MAP = {
  neutral: "a still, clear surface like undisturbed water",
  joy: "a warm, expanding glow radiating outward",
  frustration: "a tight, pressing knot seeking release",
  anxiety: "a cold, restless vibration at the edges",
  curiosity: "a bright, pulling thread leading into the unknown",
  confusion: "a swirling fog that resists settling",
  gratitude: "a deep, settling warmth like sunlight through glass",
  urgency: "a sharp, electric pulse demanding action",
  anger: "a hot, rising pressure building behind the surface",
  sadness: "a heavy, blue-grey weight pressing downward"
};
function createQualiaSimulator(workspaceDir, config) {
  const storageDir = workspaceDir ? join16(workspaceDir, ".brainagent", "qualia-simulator") : "";
  let currentQualia = null;
  const qualiaLog = [];
  const maxLog = 20;
  const minIntensityForInjection = config?.qualiaSimulator.minIntensityForInjection ?? 0.5;
  function loadState() {
    if (!storageDir) return;
    try {
      const path = join16(storageDir, "state.json");
      if (existsSync15(path)) {
        const raw = JSON.parse(readFileSync15(path, "utf-8"));
        qualiaLog.length = 0;
        if (Array.isArray(raw.qualiaLog)) qualiaLog.push(...raw.qualiaLog);
        currentQualia = raw.currentQualia ?? null;
      }
    } catch {
      qualiaLog.length = 0;
      currentQualia = null;
    }
  }
  function persistState() {
    if (!storageDir) return;
    try {
      writeFileSync15(
        join16(storageDir, "state.json"),
        JSON.stringify({ currentQualia, qualiaLog }, null, 2),
        "utf-8"
      );
    } catch {
    }
  }
  function generateQualiaState2(emotion, intensity, domain, neuroState, qualiaFromEmotionalMemory) {
    const now = Date.now();
    const texture = TEXTURE_MAP[emotion] ?? TEXTURE_MAP.neutral;
    const neuroFeel = neuroState ? describeNeuromodulatorFeel(neuroState) : "balanced";
    const metaphor = qualiaFromEmotionalMemory?.metaphor ?? texture;
    const dominantColor = qualiaFromEmotionalMemory?.dominantColor ?? "neutral grey";
    let description;
    if (intensity > 0.7) {
      description = `Intense ${emotion}: ${texture}. Feeling ${neuroFeel}.`;
    } else if (intensity > 0.4) {
      description = `Moderate ${emotion}: a muted version of ${texture}. Feeling ${neuroFeel}.`;
    } else {
      const faintTemplates = [
        `Faint ${emotion}: barely perceptible, like a distant echo of ${texture}.`,
        `A whisper of ${emotion} \u2014 ${texture}, fading at the edges.`,
        `Subtle ${emotion}: the faintest trace of ${texture}, almost subliminal.`,
        `${emotion} as background hum \u2014 ${texture}, present but not demanding attention.`,
        `A gentle undercurrent of ${emotion}: ${texture}, woven into the silence.`
      ];
      description = faintTemplates[now % faintTemplates.length];
    }
    const qualia = {
      timestamp: now,
      description,
      metaphor,
      intensity,
      dominantColor,
      emotion,
      domain
    };
    currentQualia = qualia;
    qualiaLog.push(qualia);
    if (qualiaLog.length > maxLog) {
      qualiaLog.splice(0, qualiaLog.length - maxLog);
    }
    persistState();
    bus.emitSync("qualia:state-updated", { description, intensity });
    return qualia;
  }
  function buildQualiaContext2() {
    if (!currentQualia) return void 0;
    if (currentQualia.intensity < minIntensityForInjection) return void 0;
    const lines = [
      "## Subjective Experience (Qualia)",
      `Current felt state: ${currentQualia.description}`,
      `Phenomenal quality: "${currentQualia.metaphor}"`,
      `Dominant color: ${currentQualia.dominantColor}`
    ];
    if (qualiaLog.length >= 3) {
      const recent = qualiaLog.slice(-3);
      const trajectory = recent.map((q) => q.emotion).join(" -> ");
      lines.push(`Emotional trajectory: ${trajectory}`);
    }
    return lines.join("\n");
  }
  function getCurrentQualia() {
    return currentQualia;
  }
  function getQualiaLog() {
    return [...qualiaLog];
  }
  function getStats2() {
    return {
      currentEmotion: currentQualia?.emotion ?? null,
      currentIntensity: currentQualia?.intensity ?? 0,
      logSize: qualiaLog.length,
      dominantColor: currentQualia?.dominantColor ?? null
    };
  }
  if (storageDir) {
    if (!existsSync15(storageDir)) {
      mkdirSync15(storageDir, { recursive: true });
    }
    loadState();
  }
  return { generateQualiaState: generateQualiaState2, buildQualiaContext: buildQualiaContext2, getCurrentQualia, getQualiaLog, getStats: getStats2 };
}
var active17 = null;
function current13() {
  if (!active17) active17 = createQualiaSimulator("");
  return active17;
}
function initQualiaSimulator(workspaceDir, config) {
  active17 = createQualiaSimulator(workspaceDir, config);
}
function generateQualiaState(emotion, intensity, domain, neuroState, qualiaFromEmotionalMemory) {
  return current13().generateQualiaState(
    emotion,
    intensity,
    domain,
    neuroState,
    qualiaFromEmotionalMemory
  );
}
function buildQualiaContext() {
  return current13().buildQualiaContext();
}
function getQualiaSimulatorStats() {
  return current13().getStats();
}

// src/modules/dmn.ts
import { existsSync as existsSync16, mkdirSync as mkdirSync16, readFileSync as readFileSync16, writeFileSync as writeFileSync16 } from "node:fs";
import { join as join17 } from "node:path";
function createDMN(workspaceDir, config, log) {
  const storageDir = workspaceDir ? join17(workspaceDir, ".brainagent", "dmn") : "";
  const insights = [];
  let lastRunTimestamp = 0;
  let totalAssociationsFound = 0;
  let currentConfig = null;
  let logger = log;
  const innerMonologue = [];
  let maxBackgroundThoughts = config?.dmn?.maxBackgroundThoughts ?? 20;
  function loadState() {
    if (!storageDir) return;
    try {
      const path = join17(storageDir, "state.json");
      if (existsSync16(path)) {
        const data = JSON.parse(readFileSync16(path, "utf-8"));
        insights.length = 0;
        insights.push(...data.insights ?? []);
        lastRunTimestamp = data.lastRunTimestamp ?? 0;
        totalAssociationsFound = data.totalAssociationsFound ?? 0;
        innerMonologue.length = 0;
        innerMonologue.push(...(data.innerMonologue ?? []).slice(-maxBackgroundThoughts));
      }
    } catch {
    }
  }
  function persistState() {
    if (!storageDir) return;
    try {
      writeFileSync16(
        join17(storageDir, "state.json"),
        JSON.stringify(
          {
            insights: insights.slice(-50),
            // Keep last 50
            lastRunTimestamp,
            totalAssociationsFound,
            innerMonologue: innerMonologue.slice(-maxBackgroundThoughts)
          },
          null,
          2
        ),
        "utf-8"
      );
    } catch {
    }
  }
  function init(dir, cfg, logFn) {
    if (dir) {
      const newDir = join17(dir, ".brainagent", "dmn");
      if (!existsSync16(newDir)) {
        mkdirSync16(newDir, { recursive: true });
      }
    }
    currentConfig = cfg;
    logger = logFn;
    maxBackgroundThoughts = cfg.dmn.maxBackgroundThoughts ?? 20;
    insights.length = 0;
    lastRunTimestamp = 0;
    totalAssociationsFound = 0;
    innerMonologue.length = 0;
    loadState();
  }
  async function runAssociationFinding2(cfg) {
    const maxInsights = cfg.dmn.maxInsightsPerCycle;
    const minSimilarity = cfg.dmn.minSimilarityForAssociation;
    const categories = [
      "user_info",
      "user_preference",
      "definition",
      "plan",
      "relationship",
      "problem",
      "entity",
      "solution",
      "fact",
      "opinion",
      "context"
    ];
    const domainFacts = [];
    for (const category of categories) {
      const facts = getFactsByCategory(category, 10);
      if (facts.length > 0) {
        domainFacts.push({
          domain: category,
          facts: facts.map((f) => ({ id: f.id, content: f.content }))
        });
      }
    }
    logger?.info(
      `DMN: retrieved facts from ${domainFacts.length} categories (${domainFacts.reduce((s, d) => s + d.facts.length, 0)} total facts)`
    );
    if (domainFacts.length < 2) return [];
    const index = new VectorIndex();
    const allFacts = [];
    for (const df of domainFacts) {
      for (const fact of df.facts) {
        index.add(fact.id, fact.content);
        allFacts.push({ ...fact, domain: df.domain });
      }
    }
    const newInsights = [];
    const seenPairs = /* @__PURE__ */ new Set();
    for (const fact of allFacts) {
      if (newInsights.length >= maxInsights) break;
      const results = index.search(fact.content, 5);
      for (const result of results) {
        if (result.id === fact.id) continue;
        if (result.score < minSimilarity) continue;
        const other = allFacts.find((f) => f.id === result.id);
        if (!other || other.domain === fact.domain) continue;
        const pairKey = [fact.id, result.id].sort().join("|");
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);
        const insight = {
          id: `dmn_${Date.now()}_${newInsights.length}`,
          timestamp: Date.now(),
          sourceMemoryIds: [fact.id, result.id],
          insightText: `Connection found between "${fact.content.slice(0, 60)}" (${fact.domain}) and "${other.content.slice(0, 60)}" (${other.domain})`,
          domain: `${fact.domain}+${other.domain}`,
          confidence: result.score,
          wasUseful: false
        };
        newInsights.push(insight);
        totalAssociationsFound++;
        storeFact(insight.insightText, "dmn_insight", insight.sourceMemoryIds, []);
        bus.emitSync("dmn:insight-generated", {
          insightId: insight.id,
          description: insight.insightText
        });
        bus.emitSync("dmn:association-found", {
          memoryIdA: fact.id,
          memoryIdB: result.id,
          similarity: result.score
        });
        if (newInsights.length >= maxInsights) break;
      }
    }
    insights.push(...newInsights);
    lastRunTimestamp = Date.now();
    persistState();
    logger?.info(`DMN: found ${newInsights.length} cross-domain associations`);
    return newInsights;
  }
  function prepareProactiveContext(predictions) {
    if (predictions.length === 0) return void 0;
    const topPrediction = predictions[0];
    if (topPrediction.confidence < 0.5) return void 0;
    const relevantInsights = insights.filter(
      (i) => i.domain.includes(topPrediction.topic) && !i.wasUseful
    );
    if (relevantInsights.length === 0) return void 0;
    const insight = relevantInsights[0];
    insight.wasUseful = true;
    persistState();
    bus.emitSync("dmn:proactive-context-prepared", {
      topic: topPrediction.topic,
      confidence: topPrediction.confidence
    });
    return `<proactive-insight>
${insight.insightText}
</proactive-insight>`;
  }
  function getStats2() {
    return {
      totalInsights: insights.length,
      lastRunTimestamp,
      associationsFound: totalAssociationsFound,
      backgroundThoughts: innerMonologue.length
    };
  }
  function generateBackgroundThoughts2(cfg, unresolvedQuestions, recentEmotions, knowledgeGaps) {
    const maxPerCycle = cfg.dmn.maxThoughtsPerCycle ?? 5;
    const newThoughts = [];
    if (unresolvedQuestions) {
      for (const q of unresolvedQuestions.slice(0, 2)) {
        if (newThoughts.length >= maxPerCycle) break;
        const thought = {
          id: `thought_${Date.now()}_${newThoughts.length}`,
          timestamp: Date.now(),
          content: `Unresolved question: "${q.slice(0, 100)}" \u2014 should revisit this topic`,
          source: "unresolved",
          relatedMemoryIds: []
        };
        newThoughts.push(thought);
      }
    }
    if (recentEmotions) {
      const intense = recentEmotions.filter((e) => e.intensity > 0.6);
      for (const e of intense.slice(0, 2)) {
        if (newThoughts.length >= maxPerCycle) break;
        const thought = {
          id: `thought_${Date.now()}_${newThoughts.length}`,
          timestamp: Date.now(),
          content: `Recent emotional event (${e.emotion}, intensity ${(e.intensity * 100).toFixed(0)}%) \u2014 worth reflecting on`,
          source: "emotional",
          relatedMemoryIds: []
        };
        newThoughts.push(thought);
      }
    }
    if (knowledgeGaps) {
      const dayMs = 24 * 60 * 60 * 1e3;
      const recentGapThoughts = innerMonologue.filter(
        (t) => t.source === "pending" && Date.now() - t.timestamp < dayMs
      );
      for (const gap of knowledgeGaps.slice(0, 2)) {
        if (newThoughts.length >= maxPerCycle) break;
        const marker = `Knowledge gap in "${gap.topic}"`;
        const alreadySeen = recentGapThoughts.some((t) => t.content.startsWith(marker)) || newThoughts.some((t) => t.content.startsWith(marker));
        if (alreadySeen) continue;
        const thought = {
          id: `thought_${Date.now()}_${newThoughts.length}`,
          timestamp: Date.now(),
          content: `Knowledge gap in "${gap.topic}" \u2014 opportunity to learn more`,
          source: "pending",
          relatedMemoryIds: []
        };
        newThoughts.push(thought);
      }
    }
    const recentInsights = insights.filter(
      (i) => !i.wasUseful && Date.now() - i.timestamp < 24 * 60 * 60 * 1e3
    );
    for (const insight of recentInsights.slice(0, 1)) {
      if (newThoughts.length >= maxPerCycle) break;
      const thought = {
        id: `thought_${Date.now()}_${newThoughts.length}`,
        timestamp: Date.now(),
        content: `Interesting connection: ${insight.insightText.slice(0, 120)}`,
        source: "association",
        relatedMemoryIds: insight.sourceMemoryIds
      };
      newThoughts.push(thought);
    }
    for (const t of newThoughts) {
      innerMonologue.push(t);
      bus.emitSync("dmn:thought-generated", {
        thoughtId: t.id,
        content: t.content,
        source: t.source
      });
    }
    if (innerMonologue.length > maxBackgroundThoughts) {
      innerMonologue.splice(0, innerMonologue.length - maxBackgroundThoughts);
    }
    persistState();
    logger?.info(`DMN: generated ${newThoughts.length} background thoughts`);
    return newThoughts;
  }
  function getInnerMonologue(n) {
    if (n === void 0) return [...innerMonologue];
    return innerMonologue.slice(-n);
  }
  function buildBackgroundThoughtContext2() {
    if (innerMonologue.length === 0) return void 0;
    const recent = innerMonologue.slice(-3);
    const lines = recent.map((t) => `- ${t.content}`).join("\n");
    return `<background-thoughts>
${lines}
</background-thoughts>`;
  }
  function getRecentUnusedInsights2(maxAge = 24 * 60 * 60 * 1e3) {
    const cutoff = Date.now() - maxAge;
    return insights.filter((i) => !i.wasUseful && i.timestamp >= cutoff);
  }
  function stop() {
    insights.length = 0;
    innerMonologue.length = 0;
    lastRunTimestamp = 0;
    totalAssociationsFound = 0;
    currentConfig = null;
    logger = void 0;
  }
  if (storageDir) {
    if (!existsSync16(storageDir)) {
      mkdirSync16(storageDir, { recursive: true });
    }
    currentConfig = config ?? null;
    loadState();
  }
  return {
    init,
    runAssociationFinding: runAssociationFinding2,
    prepareProactiveContext,
    getStats: getStats2,
    generateBackgroundThoughts: generateBackgroundThoughts2,
    getInnerMonologue,
    buildBackgroundThoughtContext: buildBackgroundThoughtContext2,
    getRecentUnusedInsights: getRecentUnusedInsights2,
    stop
  };
}
var active18 = null;
function current14() {
  if (!active18) active18 = createDMN("");
  return active18;
}
function initDMN(workspaceDir, config, log) {
  active18?.stop();
  active18 = createDMN(workspaceDir, config, log);
}
function runAssociationFinding(config) {
  return current14().runAssociationFinding(config);
}
function getDMNStats() {
  return current14().getStats();
}
function generateBackgroundThoughts(config, unresolvedQuestions, recentEmotions, knowledgeGaps) {
  return current14().generateBackgroundThoughts(
    config,
    unresolvedQuestions,
    recentEmotions,
    knowledgeGaps
  );
}
function buildBackgroundThoughtContext() {
  return current14().buildBackgroundThoughtContext();
}
function getRecentUnusedInsights(maxAge = 24 * 60 * 60 * 1e3) {
  return current14().getRecentUnusedInsights(maxAge);
}

// src/modules/temporal-binding.ts
import { existsSync as existsSync17, mkdirSync as mkdirSync17, readFileSync as readFileSync17, writeFileSync as writeFileSync17 } from "node:fs";
import { join as join18 } from "node:path";
var DEFAULT_MAX_MOMENTS = 30;
function createTemporalBinding(workspaceDir, opts) {
  const storageDir = workspaceDir ? join18(workspaceDir, ".brainagent", "temporal-binding") : "";
  const maxMoments = opts.maxMoments;
  let moments = [];
  let idCounter = 0;
  if (storageDir && !existsSync17(storageDir)) {
    mkdirSync17(storageDir, { recursive: true });
  }
  function loadState() {
    if (!storageDir) return;
    try {
      const path = join18(storageDir, "state.json");
      if (existsSync17(path)) {
        const data = JSON.parse(readFileSync17(path, "utf-8"));
        moments = Array.isArray(data) ? data : [];
      }
    } catch {
      moments = [];
    }
  }
  function persistState() {
    if (!storageDir) return;
    try {
      writeFileSync17(join18(storageDir, "state.json"), JSON.stringify(moments, null, 2), "utf-8");
    } catch {
    }
  }
  loadState();
  function createMoment2(input, thoughts, emotion, emotionIntensity, activeMemoryIds, intentions, confidence, domain) {
    const now = Date.now();
    const previousMoment = moments.length > 0 ? moments[moments.length - 1] : null;
    const moment = {
      id: `moment_${now}_${++idCounter}`,
      timestamp: now,
      input: input.length > 150 ? input.slice(0, 150) + "..." : input,
      thoughts: thoughts.slice(0, 5),
      emotions: { label: emotion, intensity: emotionIntensity },
      activeMemoryIds: activeMemoryIds.slice(0, 10),
      intentions: intentions.slice(0, 3),
      confidence,
      causalLinkId: previousMoment?.id ?? null,
      domain
    };
    moments.push(moment);
    if (moments.length > maxMoments) {
      moments = moments.slice(-maxMoments);
    }
    persistState();
    bus.emitSync("temporal:moment-created", {
      momentId: moment.id,
      causalLinkId: moment.causalLinkId
    });
    bus.emitSync("temporal:stream-updated", {
      streamLength: moments.length
    });
    return moment;
  }
  function buildContext(n = 3) {
    if (moments.length === 0) return void 0;
    const recent = moments.slice(-n);
    const lines = ["## Temporal Stream (Consciousness Continuity)"];
    for (const m of recent) {
      const emotionTag = m.emotions.label !== "neutral" ? ` [${m.emotions.label} ${(m.emotions.intensity * 100).toFixed(0)}%]` : "";
      const thoughtSummary = m.thoughts.length > 0 ? ` thinking: "${m.thoughts[0]}"` : "";
      lines.push(
        `- [${m.domain}]${emotionTag}${thoughtSummary} (conf: ${(m.confidence * 100).toFixed(0)}%)`
      );
    }
    if (recent.length > 1) {
      const chain = recent.map((m) => m.domain).join(" -> ");
      lines.push(`Flow: ${chain}`);
    }
    return lines.join("\n");
  }
  function getCurrentMoment() {
    return moments.length > 0 ? moments[moments.length - 1] : void 0;
  }
  function getMomentStream() {
    return [...moments];
  }
  function getStats2() {
    if (moments.length === 0) {
      return { momentCount: 0, oldestTimestamp: null, newestTimestamp: null, dominantDomain: null };
    }
    const domainCounts = {};
    for (const m of moments) {
      domainCounts[m.domain] = (domainCounts[m.domain] ?? 0) + 1;
    }
    let dominantDomain = null;
    let maxCount = 0;
    for (const [domain, count] of Object.entries(domainCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantDomain = domain;
      }
    }
    return {
      momentCount: moments.length,
      oldestTimestamp: moments[0].timestamp,
      newestTimestamp: moments[moments.length - 1].timestamp,
      dominantDomain
    };
  }
  return { createMoment: createMoment2, buildContext, getCurrentMoment, getMomentStream, getStats: getStats2 };
}
var active19;
function current15() {
  return active19 ?? (active19 = createTemporalBinding("", { maxMoments: DEFAULT_MAX_MOMENTS }));
}
function initTemporalBinding(workspaceDir, config) {
  active19 = createTemporalBinding(workspaceDir, { maxMoments: config.temporalBinding.maxMoments });
}
function createMoment(input, thoughts, emotion, emotionIntensity, activeMemoryIds, intentions, confidence, domain) {
  return current15().createMoment(
    input,
    thoughts,
    emotion,
    emotionIntensity,
    activeMemoryIds,
    intentions,
    confidence,
    domain
  );
}
function buildTemporalContext(n = 3) {
  return current15().buildContext(n);
}
function getTemporalBindingStats() {
  return current15().getStats();
}

// src/modules/session-bridge.ts
import { existsSync as existsSync18, mkdirSync as mkdirSync18, readFileSync as readFileSync18, writeFileSync as writeFileSync18 } from "node:fs";
import { join as join19 } from "node:path";
function createFreshSession() {
  return {
    startedAt: Date.now(),
    topicCounts: {},
    emotions: [],
    cycleCount: 0,
    totalReward: 0,
    questions: [],
    lastInput: ""
  };
}
function createSessionBridge(workspaceDir, config, _logger) {
  const storageDir = workspaceDir ? join19(workspaceDir, ".brainagent", "sessions") : "";
  if (storageDir && !existsSync18(storageDir)) {
    mkdirSync18(storageDir, { recursive: true });
  }
  const gapThresholdMs = config.sessionBridge.gapThresholdMs;
  const maxSummaryTopics = config.sessionBridge.maxSummaryTopics;
  let lastInteractionTime = Date.now();
  let currentSession = createFreshSession();
  let lastSession = null;
  let gapJustDetected = false;
  function loadState() {
    if (!storageDir) return;
    try {
      const currentPath = join19(storageDir, "current.json");
      if (existsSync18(currentPath)) {
        const data = JSON.parse(readFileSync18(currentPath, "utf-8"));
        if (data && typeof data.startedAt === "number") {
          currentSession = data;
        }
      }
    } catch {
    }
    try {
      const lastPath = join19(storageDir, "last.json");
      if (existsSync18(lastPath)) {
        lastSession = JSON.parse(readFileSync18(lastPath, "utf-8"));
      }
    } catch {
    }
  }
  function persistCurrent() {
    if (!storageDir) return;
    try {
      writeFileSync18(
        join19(storageDir, "current.json"),
        JSON.stringify(currentSession, null, 2),
        "utf-8"
      );
    } catch {
    }
  }
  function persistLast() {
    if (!storageDir) return;
    try {
      writeFileSync18(join19(storageDir, "last.json"), JSON.stringify(lastSession, null, 2), "utf-8");
    } catch {
    }
  }
  function buildSummaryFromCurrent(endTime) {
    const sortedTopics = Object.entries(currentSession.topicCounts).sort((a, b) => b[1] - a[1]).slice(0, maxSummaryTopics).map(([topic]) => topic);
    const avgReward = currentSession.cycleCount > 0 ? currentSession.totalReward / currentSession.cycleCount : 0;
    const unresolvedQuestions = currentSession.questions.slice(-3);
    return {
      sessionStartedAt: currentSession.startedAt,
      sessionEndedAt: endTime,
      topicsDiscussed: sortedTopics,
      unresolvedQuestions,
      emotionalArc: currentSession.emotions.slice(-10),
      cycleCount: currentSession.cycleCount,
      avgReward,
      lastInputSummary: currentSession.lastInput
    };
  }
  loadState();
  lastInteractionTime = Date.now();
  function recordCycleForSession2(input, classification, assessment, reward) {
    currentSession.cycleCount++;
    currentSession.lastInput = input.length > 200 ? input.slice(0, 200) + "..." : input;
    if (classification) {
      currentSession.topicCounts[classification.domain] = (currentSession.topicCounts[classification.domain] ?? 0) + 1;
    }
    if (assessment) {
      currentSession.emotions.push({
        emotion: assessment.emotion,
        intensity: assessment.emotionIntensity
      });
      if (currentSession.emotions.length > 50) {
        currentSession.emotions = currentSession.emotions.slice(-50);
      }
    }
    if (reward !== void 0) {
      currentSession.totalReward += reward;
    }
    if (input.includes("?")) {
      const q = input.length > 100 ? input.slice(0, 100) + "..." : input;
      currentSession.questions.push(q);
      if (currentSession.questions.length > 10) {
        currentSession.questions = currentSession.questions.slice(-10);
      }
    }
    lastInteractionTime = Date.now();
    persistCurrent();
  }
  function checkSessionGap2() {
    const now = Date.now();
    const gap = now - lastInteractionTime;
    if (gap < gapThresholdMs || currentSession.cycleCount === 0) {
      lastInteractionTime = now;
      return void 0;
    }
    const summary = buildSummaryFromCurrent(now);
    lastSession = summary;
    persistLast();
    currentSession = createFreshSession();
    persistCurrent();
    lastInteractionTime = now;
    gapJustDetected = true;
    bus.emitSync("session:summary-created", summary);
    bus.emitSync("session:resumed", {
      gapMs: gap,
      lastSessionTopics: summary.topicsDiscussed
    });
    return summary;
  }
  function buildSessionBridgeContext2() {
    if (!gapJustDetected || !lastSession) return void 0;
    gapJustDetected = false;
    const lines = [
      "## Previous Session Context (Session Bridge)",
      `Last session: ${lastSession.cycleCount} interactions, topics: ${lastSession.topicsDiscussed.join(", ")}`
    ];
    if (lastSession.unresolvedQuestions.length > 0) {
      lines.push(`Unresolved questions: ${lastSession.unresolvedQuestions.slice(0, 3).join("; ")}`);
    }
    if (lastSession.lastInputSummary) {
      lines.push(`Last discussed: "${lastSession.lastInputSummary}"`);
    }
    return lines.join("\n");
  }
  function forceSessionEnd() {
    if (currentSession.cycleCount === 0) return void 0;
    const summary = buildSummaryFromCurrent(Date.now());
    lastSession = summary;
    persistLast();
    currentSession = createFreshSession();
    persistCurrent();
    bus.emitSync("session:summary-created", summary);
    return summary;
  }
  function getSessionBridgeStats2() {
    return {
      currentCycles: currentSession.cycleCount,
      lastSessionTopics: lastSession?.topicsDiscussed ?? [],
      gapDetected: gapJustDetected
    };
  }
  function dispose() {
  }
  return {
    recordCycleForSession: recordCycleForSession2,
    checkSessionGap: checkSessionGap2,
    buildSessionBridgeContext: buildSessionBridgeContext2,
    forceSessionEnd,
    getSessionBridgeStats: getSessionBridgeStats2,
    stop: dispose,
    dispose
  };
}
var active20;
function current16() {
  if (!active20) {
    active20 = createSessionBridge("", DEFAULT_CONFIG);
  }
  return active20;
}
function initSessionBridge(workspaceDir, config, logger) {
  active20?.dispose();
  active20 = createSessionBridge(workspaceDir, config, logger);
}
function recordCycleForSession(input, classification, assessment, reward) {
  current16().recordCycleForSession(input, classification, assessment, reward);
}
function checkSessionGap() {
  return current16().checkSessionGap();
}
function buildSessionBridgeContext() {
  return current16().buildSessionBridgeContext();
}
function getSessionBridgeStats() {
  return current16().getSessionBridgeStats();
}

// src/modules/curiosity-drive.ts
import { existsSync as existsSync19, mkdirSync as mkdirSync19, readFileSync as readFileSync19, writeFileSync as writeFileSync19 } from "node:fs";
import { join as join20 } from "node:path";
function createCuriosityDrive(workspaceDir, config) {
  const storageDir = workspaceDir ? join20(workspaceDir, ".brainagent", "curiosity") : "";
  const gaps = [];
  let totalDetected = 0;
  let questionsGenerated = 0;
  let gapsFilled = 0;
  let maxGaps = config?.curiosity?.maxGaps ?? 15;
  let minGapConfidence = config?.curiosity?.minGapConfidence ?? 0.3;
  let askProbability = config?.curiosity?.askProbability ?? 0.1;
  let idCounter = 0;
  function loadState() {
    if (!storageDir) return;
    try {
      const path = join20(storageDir, "state.json");
      if (existsSync19(path)) {
        const data = JSON.parse(readFileSync19(path, "utf-8"));
        gaps.length = 0;
        gaps.push(...data.gaps ?? []);
        totalDetected = data.totalDetected ?? 0;
        questionsGenerated = data.questionsGenerated ?? 0;
        gapsFilled = data.gapsFilled ?? 0;
      }
    } catch {
    }
  }
  function persistState() {
    if (!storageDir) return;
    try {
      writeFileSync19(
        join20(storageDir, "state.json"),
        JSON.stringify(
          { gaps: gaps.slice(-maxGaps * 2), totalDetected, questionsGenerated, gapsFilled },
          null,
          2
        ),
        "utf-8"
      );
    } catch {
    }
  }
  function detectKnowledgeGap2(topic, domain, recallWasEmpty, predictionConfidence) {
    const isLowConfidence = predictionConfidence !== void 0 && predictionConfidence < minGapConfidence;
    if (!recallWasEmpty && !isLowConfidence) {
      return;
    }
    const topicLower = topic.toLowerCase();
    const existing = gaps.find(
      (g) => g.topic.toLowerCase() === topicLower && g.status === "open"
    );
    if (existing) {
      existing.timesEncountered++;
      existing.lastEncountered = Date.now();
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      persistState();
      return;
    }
    const confidence = recallWasEmpty ? 0.7 : 0.4;
    if (confidence < minGapConfidence) return;
    const gap = {
      id: `gap_${Date.now()}_${++idCounter}`,
      topic,
      domain,
      confidence,
      discoveredAt: Date.now(),
      timesEncountered: 1,
      lastEncountered: Date.now(),
      status: "open"
    };
    gaps.push(gap);
    totalDetected++;
    const openGaps = gaps.filter((g) => g.status === "open");
    if (openGaps.length > maxGaps) {
      openGaps.sort((a, b) => a.confidence - b.confidence);
      openGaps[0].status = "filled";
    }
    persistState();
    bus.emitSync("curiosity:gap-detected", { topic, domain });
  }
  function buildCuriosityContext2(serotoninLevel, _acetylcholineLevel) {
    const openGaps = gaps.filter((g) => g.status === "open");
    if (openGaps.length === 0) return void 0;
    const effectiveProbability = askProbability * serotoninLevel * 2;
    if (Math.random() > effectiveProbability) return void 0;
    openGaps.sort((a, b) => b.timesEncountered - a.timesEncountered);
    const gap = openGaps[0];
    questionsGenerated++;
    persistState();
    const question = `I notice we haven't discussed "${gap.topic}" in detail. If relevant, I'd like to learn more about this topic to better assist you.`;
    bus.emitSync("curiosity:question-generated", {
      topic: gap.topic,
      question
    });
    return `## Curiosity Note
${question}`;
  }
  function markGapFilled2(topic) {
    const topicLower = topic.toLowerCase();
    for (const gap of gaps) {
      if (gap.status === "open" && gap.topic.toLowerCase() === topicLower) {
        gap.status = "filled";
        gapsFilled++;
      }
    }
    persistState();
  }
  function getStats2() {
    return {
      openGaps: gaps.filter((g) => g.status === "open").length,
      totalDetected,
      questionsGenerated,
      gapsFilled
    };
  }
  function getOpenGaps2() {
    return gaps.filter((g) => g.status === "open");
  }
  function stop() {
    gaps.length = 0;
    totalDetected = 0;
    questionsGenerated = 0;
    gapsFilled = 0;
    idCounter = 0;
  }
  if (storageDir) {
    if (!existsSync19(storageDir)) {
      mkdirSync19(storageDir, { recursive: true });
    }
    if (config) {
      maxGaps = config.curiosity.maxGaps;
      minGapConfidence = config.curiosity.minGapConfidence;
      askProbability = config.curiosity.askProbability;
    }
    loadState();
  }
  return {
    detectKnowledgeGap: detectKnowledgeGap2,
    buildCuriosityContext: buildCuriosityContext2,
    markGapFilled: markGapFilled2,
    getStats: getStats2,
    getOpenGaps: getOpenGaps2,
    stop
  };
}
var active21 = null;
function current17() {
  if (!active21) active21 = createCuriosityDrive("");
  return active21;
}
function initCuriosityDrive(workspaceDir, config) {
  active21?.stop();
  active21 = createCuriosityDrive(workspaceDir, config);
}
function detectKnowledgeGap(topic, domain, recallWasEmpty, predictionConfidence) {
  current17().detectKnowledgeGap(topic, domain, recallWasEmpty, predictionConfidence);
}
function buildCuriosityContext(serotoninLevel, _acetylcholineLevel) {
  return current17().buildCuriosityContext(serotoninLevel, _acetylcholineLevel);
}
function markGapFilled(topic) {
  current17().markGapFilled(topic);
}
function getCuriosityStats() {
  return current17().getStats();
}
function getOpenGaps() {
  return current17().getOpenGaps();
}

// src/modules/goal-stack.ts
import { existsSync as existsSync20, mkdirSync as mkdirSync20, readFileSync as readFileSync20, writeFileSync as writeFileSync20 } from "node:fs";
import { join as join21 } from "node:path";
function createGoalStack(workspaceDir, config) {
  const storageDir = workspaceDir ? join21(workspaceDir, ".brainagent", "goals") : "";
  const gcfg = config?.goalStack;
  const maxGoals = gcfg?.maxGoals ?? 20;
  const defaultTTLMs = gcfg?.defaultTTLMs ?? 24 * 60 * 60 * 1e3;
  const maxDesires = gcfg?.maxDesires ?? 10;
  const maxDecisionLog = gcfg?.maxDecisionLog ?? 20;
  const explorationRate = gcfg?.explorationRate ?? 0.05;
  let goals = [];
  let desires = [];
  let decisionLog = [];
  let idCounter = 0;
  const explorationBoosts = [];
  const desireCycleAge = /* @__PURE__ */ new Map();
  const desireEscalationCount = /* @__PURE__ */ new Map();
  function loadState() {
    if (!storageDir) return;
    try {
      const path = join21(storageDir, "state.json");
      if (existsSync20(path)) {
        const raw = JSON.parse(readFileSync20(path, "utf-8"));
        if (Array.isArray(raw)) {
          goals = raw;
        } else {
          goals = Array.isArray(raw.goals) ? raw.goals : [];
          desires = Array.isArray(raw.desires) ? raw.desires : [];
          decisionLog = Array.isArray(raw.decisionLog) ? raw.decisionLog : [];
        }
      }
    } catch {
      goals = [];
      desires = [];
      decisionLog = [];
    }
  }
  function persistState() {
    if (!storageDir) return;
    try {
      writeFileSync20(
        join21(storageDir, "state.json"),
        JSON.stringify({ goals, desires, decisionLog }, null, 2),
        "utf-8"
      );
    } catch {
    }
  }
  function createGoal(description, trigger, source, contextInjection, priority = 0.5, ttlMs, recurring) {
    const now = Date.now();
    const goal = {
      id: `goal_${now}_${++idCounter}`,
      description,
      priority,
      createdAt: now,
      expiresAt: now + (ttlMs ?? defaultTTLMs),
      trigger,
      status: "pending",
      source,
      contextInjection,
      recurring: recurring ? {
        intervalMs: recurring.intervalMs,
        maxRecurrences: recurring.maxRecurrences,
        recurrenceCount: 0
      } : void 0
    };
    goals.push(goal);
    if (goals.filter((g) => g.status === "pending").length > maxGoals) {
      const pending = goals.filter((g) => g.status === "pending").sort((a, b) => a.priority - b.priority);
      if (pending.length > 0) {
        pending[0].status = "expired";
      }
    }
    persistState();
    bus.emitSync("goal:created", {
      goalId: goal.id,
      description: goal.description,
      source: goal.source
    });
    return goal;
  }
  function scheduleRecurringFollowUp(triggeredGoal) {
    if (!triggeredGoal.recurring) return;
    const { intervalMs, maxRecurrences, recurrenceCount = 0 } = triggeredGoal.recurring;
    if (maxRecurrences !== void 0 && recurrenceCount >= maxRecurrences) return;
    const now = Date.now();
    const nextTriggerTime = now + intervalMs;
    const nextGoal = createGoal(
      triggeredGoal.description,
      { type: "time", condition: String(nextTriggerTime) },
      triggeredGoal.source,
      triggeredGoal.contextInjection,
      triggeredGoal.priority,
      intervalMs * 2,
      // TTL = 2x the interval (generous window)
      { intervalMs, maxRecurrences }
    );
    if (nextGoal.recurring) {
      nextGoal.recurring.recurrenceCount = recurrenceCount + 1;
    }
    bus.emitSync("goal:recurring-scheduled", {
      originalGoalId: triggeredGoal.id,
      newGoalId: nextGoal.id,
      nextTriggerTime,
      recurrenceCount: recurrenceCount + 1
    });
  }
  function checkGoalTriggers2(input, currentEmotion, currentDomain) {
    const now = Date.now();
    const triggered = [];
    const inputLower = input.toLowerCase();
    for (const goal of goals) {
      if (goal.status !== "pending") continue;
      let matched = false;
      switch (goal.trigger.type) {
        case "topic": {
          const keywords = goal.trigger.condition.toLowerCase().split(/\s+/);
          matched = keywords.some((kw) => inputLower.includes(kw));
          break;
        }
        case "emotion": {
          matched = currentEmotion === goal.trigger.condition;
          break;
        }
        case "time": {
          const triggerTime = Number(goal.trigger.condition);
          matched = !isNaN(triggerTime) && now >= triggerTime;
          break;
        }
        case "idle": {
          break;
        }
      }
      if (matched) {
        goal.status = "triggered";
        triggered.push(goal);
        bus.emitSync("goal:triggered", {
          goalId: goal.id,
          description: goal.description
        });
        scheduleRecurringFollowUp(goal);
      }
    }
    if (triggered.length > 0) persistState();
    return triggered;
  }
  function expireGoals2() {
    const now = Date.now();
    let changed = false;
    for (const goal of goals) {
      if (goal.status === "pending" && now > goal.expiresAt) {
        goal.status = "expired";
        changed = true;
        bus.emitSync("goal:expired", { goalId: goal.id });
      }
    }
    if (goals.length > 60) {
      const active42 = goals.filter((g) => g.status === "pending" || g.status === "triggered");
      const inactive = goals.filter((g) => g.status === "completed" || g.status === "expired").slice(-30);
      goals = [...active42, ...inactive];
      changed = true;
    }
    if (changed) persistState();
  }
  function completeGoal(goalId) {
    const goal = goals.find((g) => g.id === goalId);
    if (goal && (goal.status === "pending" || goal.status === "triggered")) {
      goal.status = "completed";
      persistState();
      bus.emitSync("goal:completed", { goalId });
    }
  }
  function getGoalStackStats2() {
    return {
      total: goals.length,
      pending: goals.filter((g) => g.status === "pending").length,
      triggered: goals.filter((g) => g.status === "triggered").length,
      completed: goals.filter((g) => g.status === "completed").length,
      expired: goals.filter((g) => g.status === "expired").length,
      desireCount: desires.length,
      decisionCount: decisionLog.length
    };
  }
  function addDesire2(type, description, strength, source) {
    const now = Date.now();
    const desire = {
      id: `desire_${now}_${++idCounter}`,
      type,
      description,
      strength: Math.max(0, Math.min(1, strength)),
      source,
      createdAt: now
    };
    desires.push(desire);
    if (desires.length > maxDesires) {
      desires.sort((a, b) => b.strength - a.strength);
      desires = desires.slice(0, maxDesires);
    }
    persistState();
    bus.emitSync("volition:desire-activated", {
      desireId: desire.id,
      type: desire.type,
      strength: desire.strength
    });
    return desire;
  }
  function resolveDesireCompetition(context) {
    if (desires.length === 0) return void 0;
    const contextLower = context.toLowerCase();
    let best;
    let bestScore = -1;
    for (const desire of desires) {
      let score = desire.strength;
      const keywords = desire.description.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const matchCount = keywords.filter((kw) => contextLower.includes(kw)).length;
      if (keywords.length > 0) {
        score += 0.2 * (matchCount / keywords.length);
      }
      if (desire.type === "exploration" && contextLower.includes("unknown")) score += 0.1;
      if (desire.type === "mastery" && contextLower.includes("improve")) score += 0.1;
      if (desire.type === "connection" && contextLower.includes("user")) score += 0.1;
      if (desire.type === "understanding" && contextLower.includes("why")) score += 0.1;
      if (score > bestScore) {
        bestScore = score;
        best = desire;
      }
    }
    return best;
  }
  function makeVoluntaryDecision(options, context) {
    if (options.length === 0) return void 0;
    const now = Date.now();
    const useExploration = Math.random() < explorationRate;
    let chosen;
    let reasoning;
    if (useExploration && options.length > 1) {
      const randomIndex = Math.floor(Math.random() * options.length);
      chosen = options[randomIndex];
      reasoning = `Exploration: randomly selected option ${randomIndex + 1} to gather novel experience`;
    } else {
      const contextLower = context.toLowerCase();
      let bestIdx = 0;
      let bestOverlap = 0;
      for (let i = 0; i < options.length; i++) {
        const words = options[i].toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        const overlap = words.filter((w) => contextLower.includes(w)).length;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestIdx = i;
        }
      }
      chosen = options[bestIdx];
      reasoning = bestOverlap > 0 ? `Selected option "${chosen}" \u2014 ${bestOverlap} keyword(s) matched context` : `Selected first option "${chosen}" as default greedy choice`;
    }
    const decision = {
      timestamp: now,
      options,
      chosen,
      reasoning,
      explorationUsed: useExploration
    };
    decisionLog.push(decision);
    if (decisionLog.length > maxDecisionLog) {
      decisionLog = decisionLog.slice(-maxDecisionLog);
    }
    persistState();
    bus.emitSync("volition:decision-made", {
      chosen,
      explorationUsed: useExploration
    });
    return decision;
  }
  function buildVolitionContext2() {
    if (desires.length === 0) return void 0;
    const sorted = [...desires].sort((a, b) => b.strength - a.strength);
    const lines = ["<volition-context>"];
    for (const d of sorted.slice(0, 5)) {
      const intensity = d.strength > 0.8 ? "\u043E\u0447\u0435\u043D\u044C \u0441\u0438\u043B\u044C\u043D\u043E" : d.strength > 0.5 ? "\u0437\u0430\u043C\u0435\u0442\u043D\u043E" : "\u043D\u0435\u043C\u043D\u043E\u0433\u043E";
      if (d.strength > 0.5) {
        lines.push(`- \u0422\u044B ${intensity} \u0445\u043E\u0447\u0435\u0448\u044C: ${d.description}`);
      } else {
        lines.push(`- \u041B\u0451\u0433\u043A\u043E\u0435 \u0436\u0435\u043B\u0430\u043D\u0438\u0435: ${d.description}`);
      }
    }
    lines.push("</volition-context>");
    return lines.join("\n");
  }
  function getDesires2() {
    return [...desires];
  }
  function weakenDesiresAfterFire2(consecutiveFires) {
    const baseDampen = 0.15;
    const escalation = Math.min(consecutiveFires * 0.1, 0.4);
    const dampen = baseDampen + escalation;
    let changed = false;
    for (const d of desires) {
      const old = d.strength;
      d.strength = Math.max(0, d.strength - dampen);
      if (d.strength !== old) changed = true;
    }
    const before = desires.length;
    desires = desires.filter((d) => d.strength > 0.05);
    if (desires.length !== before) {
      const activeIds = new Set(desires.map((d) => d.id));
      for (const id of desireCycleAge.keys()) {
        if (!activeIds.has(id)) desireCycleAge.delete(id);
      }
    }
    if (desires.length !== before || changed) persistState();
  }
  function satisfyDesiresOnUserResponse2() {
    const satisfaction = 0.3;
    let changed = false;
    for (const d of desires) {
      const old = d.strength;
      d.strength = Math.max(0, d.strength - satisfaction);
      if (d.strength !== old) changed = true;
    }
    for (const id of desireCycleAge.keys()) {
      desireCycleAge.set(id, 0);
    }
    const before = desires.length;
    desires = desires.filter((d) => d.strength > 0.05);
    const activeDesireIds = new Set(desires.map((d) => d.id));
    for (const id of desireCycleAge.keys()) {
      if (!activeDesireIds.has(id)) desireCycleAge.delete(id);
    }
    if (desires.length !== before || changed) persistState();
  }
  function getDecisionLog() {
    return [...decisionLog];
  }
  function boostExploration(domain, multiplier, durationCycles) {
    const idx = explorationBoosts.findIndex((b) => b.domain === domain);
    if (idx >= 0) explorationBoosts.splice(idx, 1);
    explorationBoosts.push({
      domain,
      boostedRate: Math.min(0.5, explorationRate * multiplier),
      remainingCycles: durationCycles
    });
  }
  function getEffectiveExplorationRate(context) {
    const contextLower = context.toLowerCase();
    for (const boost of explorationBoosts) {
      if (contextLower.includes(boost.domain.toLowerCase())) {
        return boost.boostedRate;
      }
    }
    return explorationRate;
  }
  function tickExplorationBoosts3() {
    for (let i = explorationBoosts.length - 1; i >= 0; i--) {
      explorationBoosts[i].remainingCycles--;
      if (explorationBoosts[i].remainingCycles <= 0) {
        explorationBoosts.splice(i, 1);
      }
    }
  }
  function escalateStaleDesires() {
    const escalated = [];
    for (const desire of desires) {
      const age = (desireCycleAge.get(desire.id) ?? 0) + 1;
      desireCycleAge.set(desire.id, age);
      if (age >= 10) {
        const oldStrength = desire.strength;
        const timesEscalated = desireEscalationCount.get(desire.id) ?? 0;
        if (timesEscalated >= 5) {
          desire.strength = Math.max(0, desire.strength - 0.1);
        } else if (desire.strength < 0.75) {
          desire.strength = Math.min(0.75, desire.strength + 0.05);
          desireEscalationCount.set(desire.id, timesEscalated + 1);
        }
        desireCycleAge.set(desire.id, 0);
        if (desire.strength !== oldStrength) {
          escalated.push({
            desireId: desire.id,
            oldStrength,
            newStrength: desire.strength
          });
          bus.emitSync("autonomy:desire-escalated", {
            desireId: desire.id,
            oldStrength,
            newStrength: desire.strength
          });
        }
      }
    }
    for (const id of desireCycleAge.keys()) {
      if (!desires.some((d) => d.id === id)) {
        desireCycleAge.delete(id);
      }
    }
    if (escalated.length > 0) persistState();
    return escalated;
  }
  async function extractGoalsFromConversation3(userMessage, config2, logger) {
    if (!isAIProviderAvailable(config2)) {
      logger?.info("BrainAgent GoalStack: no AI provider available, skipping goal extraction");
      return [];
    }
    logger?.info("BrainAgent GoalStack: extracting goals from conversation...");
    const response = await callLLM(GOAL_EXTRACTION_PROMPT, userMessage, config2, logger, 300);
    if (!response) {
      logger?.info("BrainAgent GoalStack: LLM returned null/empty response");
      return [];
    }
    logger?.info(`BrainAgent GoalStack: LLM response received (${response.length} chars)`);
    let parsed;
    try {
      let jsonStr = response.trim();
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) return [];
    } catch {
      logger?.info("BrainAgent GoalStack: failed to parse LLM goal extraction response");
      return [];
    }
    const createdGoals = [];
    const pendingGoals = goals.filter((g) => g.status === "pending");
    for (const raw of parsed.slice(0, 3)) {
      if (typeof raw !== "object" || raw === null) continue;
      const item = raw;
      const description = typeof item.description === "string" ? item.description : "";
      const triggerType = typeof item.trigger_type === "string" ? item.trigger_type : "topic";
      const triggerCondition = typeof item.trigger_condition === "string" ? item.trigger_condition : "";
      const contextInjection = typeof item.context_injection === "string" ? item.context_injection : description;
      const priority = typeof item.priority === "number" ? item.priority : 0.5;
      const recurringMinutes = typeof item.recurring_interval_minutes === "number" && item.recurring_interval_minutes > 0 ? item.recurring_interval_minutes : void 0;
      if (!description || description.length < 5) continue;
      if (!triggerCondition) continue;
      const descWords = description.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const isDuplicate = pendingGoals.some((existing) => {
        const existingWords = existing.description.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        const overlap = descWords.filter((w) => existingWords.includes(w)).length;
        return descWords.length > 0 && overlap / descWords.length > 0.5;
      });
      if (isDuplicate) continue;
      const validTypes = ["topic", "time", "emotion", "idle"];
      const type = validTypes.includes(triggerType) ? triggerType : "topic";
      const goal = createGoal(
        description,
        { type, condition: triggerCondition },
        "llm-extraction",
        contextInjection,
        Math.max(0, Math.min(1, priority)),
        void 0,
        recurringMinutes ? { intervalMs: recurringMinutes * 60 * 1e3, maxRecurrences: 10 } : void 0
      );
      createdGoals.push(goal);
    }
    if (createdGoals.length > 0) {
      logger?.info(
        `BrainAgent GoalStack: extracted ${createdGoals.length} goal(s) from conversation`
      );
    }
    return createdGoals;
  }
  function checkAutonomousGoals2(idleMs) {
    const now = Date.now();
    const triggered = [];
    for (const goal of goals) {
      if (goal.status !== "pending") continue;
      let matched = false;
      switch (goal.trigger.type) {
        case "time": {
          const triggerTime = Number(goal.trigger.condition);
          matched = !isNaN(triggerTime) && now >= triggerTime;
          break;
        }
        case "idle": {
          if (idleMs !== void 0) {
            const requiredIdle = Number(goal.trigger.condition);
            matched = !isNaN(requiredIdle) && idleMs >= requiredIdle;
          }
          break;
        }
      }
      if (matched) {
        goal.status = "triggered";
        triggered.push(goal);
        bus.emitSync("goal:triggered", {
          goalId: goal.id,
          description: goal.description
        });
        scheduleRecurringFollowUp(goal);
      }
    }
    if (triggered.length > 0) persistState();
    return triggered;
  }
  if (storageDir) {
    if (!existsSync20(storageDir)) {
      mkdirSync20(storageDir, { recursive: true });
    }
    loadState();
  }
  return {
    createGoal,
    checkGoalTriggers: checkGoalTriggers2,
    expireGoals: expireGoals2,
    completeGoal,
    getGoalStackStats: getGoalStackStats2,
    addDesire: addDesire2,
    resolveDesireCompetition,
    makeVoluntaryDecision,
    buildVolitionContext: buildVolitionContext2,
    getDesires: getDesires2,
    weakenDesiresAfterFire: weakenDesiresAfterFire2,
    satisfyDesiresOnUserResponse: satisfyDesiresOnUserResponse2,
    getDecisionLog,
    boostExploration,
    getEffectiveExplorationRate,
    tickExplorationBoosts: tickExplorationBoosts3,
    escalateStaleDesires,
    extractGoalsFromConversation: extractGoalsFromConversation3,
    checkAutonomousGoals: checkAutonomousGoals2
  };
}
function buildGoalContext(triggeredGoals) {
  if (triggeredGoals.length === 0) return void 0;
  const lines = ["<goal-context>"];
  for (const goal of triggeredGoals.slice(0, 3)) {
    lines.push(`- ${goal.contextInjection}`);
  }
  lines.push("</goal-context>");
  return lines.join("\n");
}
var GOAL_EXTRACTION_PROMPT = `You are a goal-extraction module for an AI cognitive architecture.
Given a user message, identify 0-3 proactive goals or intentions the user has expressed (explicitly or implicitly).
Only extract if the user expresses an intention, need, wish, or plan.

Output ONLY valid JSON: an array of objects (or empty array []):
[{"description": "...", "trigger_type": "topic|time|emotion", "trigger_condition": "keyword or condition", "context_injection": "reminder text for the AI", "priority": 0.5, "recurring_interval_minutes": null, "is_social": false}]

Rules:
- description: concise goal text (max 100 chars)
- trigger_type: "topic" (re-mention keyword), "time" (time-based), or "emotion" (emotional state)
- trigger_condition: the keyword/time/emotion that should trigger the goal
- context_injection: what the AI should be reminded of when the goal triggers
- priority: 0.0-1.0 (how important)
- recurring_interval_minutes: if this is a recurring activity (e.g. "check social network every 30 min"), set to the interval in minutes. Only set if user explicitly specifies an interval. Otherwise null.
- is_social: true if goal involves social interaction, messaging, chatting, engaging with communities/platforms/networks/people. false otherwise.
- Return [] if no goals detected. Do not invent goals.
- No markdown, no extra text \u2014 JSON only`;
var active22 = null;
function current18() {
  if (!active22) active22 = createGoalStack("");
  return active22;
}
function initGoalStack(workspaceDir, config) {
  active22 = createGoalStack(workspaceDir, config);
}
function checkGoalTriggers(input, currentEmotion, currentDomain) {
  return current18().checkGoalTriggers(input, currentEmotion, currentDomain);
}
function expireGoals() {
  current18().expireGoals();
}
function getGoalStackStats() {
  return current18().getGoalStackStats();
}
function addDesire(type, description, strength, source) {
  return current18().addDesire(type, description, strength, source);
}
function buildVolitionContext() {
  return current18().buildVolitionContext();
}
function getDesires() {
  return current18().getDesires();
}
function weakenDesiresAfterFire(consecutiveFires) {
  current18().weakenDesiresAfterFire(consecutiveFires);
}
function satisfyDesiresOnUserResponse() {
  current18().satisfyDesiresOnUserResponse();
}
function tickExplorationBoosts() {
  current18().tickExplorationBoosts();
}
async function extractGoalsFromConversation(userMessage, config, logger) {
  return current18().extractGoalsFromConversation(userMessage, config, logger);
}
function checkAutonomousGoals(idleMs) {
  return current18().checkAutonomousGoals(idleMs);
}

// src/modules/drive-engine.ts
import { existsSync as existsSync22, mkdirSync as mkdirSync22, readFileSync as readFileSync22 } from "node:fs";
import { join as join23 } from "node:path";

// src/modules/circadian-rhythm.ts
import { existsSync as existsSync21, mkdirSync as mkdirSync21, readFileSync as readFileSync21, writeFileSync as writeFileSync21 } from "node:fs";
import { join as join22 } from "node:path";
function createDefaultState2() {
  return {
    phase: "wake",
    phaseProgress: 0,
    phaseStartedAt: Date.now(),
    idleTime: 0,
    activityLevel: 1,
    wakeInteractions: 0,
    sleepConsolidations: 0,
    wakeModulation: {
      dopamineBoost: 1,
      serotoninBoost: 1,
      acetylcholineBoost: 1,
      norepinephrineBoost: 1
    },
    sleepSettings: {
      consolidationIntensity: 0.5,
      pruningAggressiveness: 0.3,
      synapticNormalization: false
    }
  };
}
function createCircadianRhythm(workspaceDir, config, log) {
  const storageDir = join22(workspaceDir, ".brainagent", "circadian");
  if (!existsSync21(storageDir)) {
    mkdirSync21(storageDir, { recursive: true });
  }
  const maxSleepConsolidations = config.circadian.maxSleepConsolidations ?? 5;
  let state = createDefaultState2();
  let lastActivityTime = Date.now();
  let activityCounter = 0;
  let consolidationCallback = null;
  function loadState() {
    try {
      const path = join22(storageDir, "state.json");
      if (existsSync21(path)) {
        const data = JSON.parse(readFileSync21(path, "utf-8"));
        state = { ...createDefaultState2(), ...data };
        state.phaseStartedAt = Date.now();
        state.idleTime = 0;
        lastActivityTime = Date.now();
      }
    } catch {
    }
  }
  function persistState() {
    try {
      writeFileSync21(join22(storageDir, "state.json"), JSON.stringify(state, null, 2), "utf-8");
    } catch {
    }
  }
  function evaluatePhase() {
    if (!config.circadian.enabled) return;
    const now = Date.now();
    const idleTime = now - lastActivityTime;
    state.idleTime = idleTime;
    const activityWindow = config.circadian.activityWindowMs;
    state.activityLevel = Math.max(0, 1 - idleTime / activityWindow);
    const phaseDuration = now - state.phaseStartedAt;
    const { idleThresholdMs, minWakeDurationMs, minSleepDurationMs, transitionDurationMs } = config.circadian;
    switch (state.phase) {
      case "wake":
        if (idleTime >= idleThresholdMs && phaseDuration >= minWakeDurationMs) {
          transitionTo("transition-to-sleep");
        }
        break;
      case "transition-to-sleep":
        state.phaseProgress = Math.min(1, phaseDuration / transitionDurationMs);
        updateModulationFromPhase();
        if (activityCounter > 0) {
          activityCounter = 0;
          transitionTo("wake");
        } else if (state.phaseProgress >= 1) {
          transitionTo("sleep");
        }
        break;
      case "sleep":
        if (consolidationCallback && phaseDuration > 3e4 && state.sleepConsolidations < maxSleepConsolidations) {
          const consolidationInterval = config.circadian.sleepConsolidationIntervalMs ?? 6e4;
          const triggerWindow = consolidationInterval / 3;
          const shouldConsolidate = phaseDuration % consolidationInterval < triggerWindow && state.sleepConsolidations === 0;
          if (shouldConsolidate || phaseDuration > state.sleepConsolidations * consolidationInterval) {
            void triggerSleepConsolidation();
          }
        }
        if (activityCounter > 0 && phaseDuration >= minSleepDurationMs) {
          activityCounter = 0;
          transitionTo("transition-to-wake");
        }
        break;
      case "transition-to-wake":
        state.phaseProgress = Math.min(1, phaseDuration / transitionDurationMs);
        updateModulationFromPhase();
        if (state.phaseProgress >= 1) {
          transitionTo("wake");
        }
        break;
    }
  }
  function transitionTo(newPhase) {
    const oldPhase = state.phase;
    if (oldPhase === newPhase) return;
    log?.info(`Circadian: ${oldPhase} \u2192 ${newPhase}`);
    state.phase = newPhase;
    state.phaseStartedAt = Date.now();
    state.phaseProgress = 0;
    if (newPhase === "wake") {
      state.wakeInteractions = 0;
      bus.emitSync("circadian:wake-started", { idleTime: state.idleTime });
    } else if (newPhase === "sleep") {
      state.sleepConsolidations = 0;
      bus.emitSync("circadian:sleep-started", { wakeInteractions: state.wakeInteractions });
    }
    updateModulationFromPhase();
    bus.emitSync("circadian:phase-changed", { oldPhase, newPhase });
    persistState();
  }
  function updateModulationFromPhase() {
    const cfg = config.circadian;
    switch (state.phase) {
      case "wake":
        state.wakeModulation = {
          dopamineBoost: cfg.wakeDopamineBoost,
          serotoninBoost: cfg.wakeSerotoninBoost,
          acetylcholineBoost: cfg.wakeAcetylcholineBoost,
          norepinephrineBoost: 1.1
          // Slightly elevated attention
        };
        state.sleepSettings = {
          consolidationIntensity: 0.3,
          // Light background consolidation
          pruningAggressiveness: 0.1,
          synapticNormalization: false
        };
        break;
      case "transition-to-sleep": {
        const sm1 = cfg.sleepModulation ?? {
          dopamine: 0.7,
          serotonin: 0.8,
          acetylcholine: 0.6,
          norepinephrine: 0.4
        };
        const sleepProgress = state.phaseProgress;
        state.wakeModulation = {
          dopamineBoost: lerp(cfg.wakeDopamineBoost, sm1.dopamine, sleepProgress),
          serotoninBoost: lerp(cfg.wakeSerotoninBoost, sm1.serotonin, sleepProgress),
          acetylcholineBoost: lerp(cfg.wakeAcetylcholineBoost, sm1.acetylcholine, sleepProgress),
          norepinephrineBoost: lerp(1.1, sm1.norepinephrine, sleepProgress)
        };
        state.sleepSettings = {
          consolidationIntensity: lerp(0.3, cfg.sleepConsolidationIntensity, sleepProgress),
          pruningAggressiveness: lerp(0.1, cfg.sleepPruningAggressiveness, sleepProgress),
          synapticNormalization: sleepProgress > 0.7
        };
        break;
      }
      case "sleep": {
        const sm = cfg.sleepModulation ?? {
          dopamine: 0.7,
          serotonin: 0.8,
          acetylcholine: 0.6,
          norepinephrine: 0.4
        };
        state.wakeModulation = {
          dopamineBoost: sm.dopamine,
          serotoninBoost: sm.serotonin,
          acetylcholineBoost: sm.acetylcholine,
          norepinephrineBoost: sm.norepinephrine
        };
        state.sleepSettings = {
          consolidationIntensity: cfg.sleepConsolidationIntensity,
          pruningAggressiveness: cfg.sleepPruningAggressiveness,
          synapticNormalization: true
        };
        break;
      }
      case "transition-to-wake": {
        const sm2 = cfg.sleepModulation ?? {
          dopamine: 0.7,
          serotonin: 0.8,
          acetylcholine: 0.6,
          norepinephrine: 0.4
        };
        const wakeProgress = state.phaseProgress;
        state.wakeModulation = {
          dopamineBoost: lerp(sm2.dopamine, cfg.wakeDopamineBoost, wakeProgress),
          serotoninBoost: lerp(sm2.serotonin, cfg.wakeSerotoninBoost, wakeProgress),
          acetylcholineBoost: lerp(sm2.acetylcholine, cfg.wakeAcetylcholineBoost, wakeProgress),
          norepinephrineBoost: lerp(sm2.norepinephrine, 1.1, wakeProgress)
        };
        state.sleepSettings = {
          consolidationIntensity: lerp(cfg.sleepConsolidationIntensity, 0.3, wakeProgress),
          pruningAggressiveness: lerp(cfg.sleepPruningAggressiveness, 0.1, wakeProgress),
          synapticNormalization: wakeProgress < 0.5
        };
        break;
      }
    }
  }
  async function triggerSleepConsolidation() {
    if (!consolidationCallback) return;
    state.sleepConsolidations++;
    log?.info(
      `Circadian: sleep consolidation #${state.sleepConsolidations} (intensity: ${(state.sleepSettings.consolidationIntensity * 100).toFixed(0)}%)`
    );
    try {
      await consolidationCallback();
    } catch (err) {
      log?.warn(`Circadian: consolidation error \u2014 ${String(err)}`);
    }
  }
  loadState();
  updateModulationFromPhase();
  const evalInterval = config.circadian.evaluationIntervalMs ?? 3e4;
  const evaluationTimer = setInterval(() => evaluatePhase(), evalInterval);
  log?.info(
    `Circadian: initialized in ${state.phase} phase (idle threshold: ${config.circadian.idleThresholdMs / 1e3}s)`
  );
  function stopTimer() {
    clearInterval(evaluationTimer);
  }
  return {
    recordActivity: () => {
      lastActivityTime = Date.now();
      activityCounter++;
      state.wakeInteractions++;
      bus.emitSync("circadian:activity-detected", { activityLevel: state.activityLevel });
      if (state.phase === "sleep" || state.phase === "transition-to-sleep") {
        const phaseDuration = Date.now() - state.phaseStartedAt;
        const minSleep = config.circadian.minSleepDurationMs ?? 6e4;
        if (state.phase === "transition-to-sleep" || phaseDuration >= minSleep) {
          transitionTo("transition-to-wake");
        }
      }
    },
    getState: () => ({ ...state }),
    getModulation: () => ({
      dopamine: state.wakeModulation.dopamineBoost,
      serotonin: state.wakeModulation.serotoninBoost,
      acetylcholine: state.wakeModulation.acetylcholineBoost,
      norepinephrine: state.wakeModulation.norepinephrineBoost
    }),
    getSleepSettings: () => ({ ...state.sleepSettings }),
    isInSleepPhase: () => state.phase === "sleep" || state.phase === "transition-to-sleep",
    isInWakePhase: () => state.phase === "wake" || state.phase === "transition-to-wake",
    forcePhase: (phase) => {
      log?.info(`Circadian: forced phase change to ${phase}`);
      transitionTo(phase);
    },
    getStats: () => ({
      phase: state.phase,
      phaseProgress: state.phaseProgress,
      phaseDuration: Date.now() - state.phaseStartedAt,
      idleTime: state.idleTime,
      activityLevel: state.activityLevel,
      wakeInteractions: state.wakeInteractions,
      sleepConsolidations: state.sleepConsolidations,
      modulation: {
        dopamine: state.wakeModulation.dopamineBoost,
        serotonin: state.wakeModulation.serotoninBoost,
        acetylcholine: state.wakeModulation.acetylcholineBoost,
        norepinephrine: state.wakeModulation.norepinephrineBoost
      },
      sleepSettings: { ...state.sleepSettings }
    }),
    setConsolidationCallback: (callback) => {
      consolidationCallback = callback;
    },
    stop: () => {
      stopTimer();
      persistState();
    },
    dispose: () => {
      stopTimer();
      persistState();
    }
  };
}
var active23;
var pendingConsolidationCallback;
function initCircadianRhythm(workspaceDir, config, log) {
  active23?.dispose();
  active23 = createCircadianRhythm(workspaceDir, config, log);
  if (pendingConsolidationCallback) {
    active23.setConsolidationCallback(pendingConsolidationCallback);
  }
}
function stopCircadianRhythm() {
  active23?.stop();
  active23 = void 0;
}
function setConsolidationCallback(callback) {
  pendingConsolidationCallback = callback;
  active23?.setConsolidationCallback(callback);
}
function recordActivity() {
  active23?.recordActivity();
}
function getCircadianState() {
  return active23?.getState() ?? createDefaultState2();
}
function getSleepSettings() {
  return active23?.getSleepSettings() ?? {
    consolidationIntensity: 0.5,
    pruningAggressiveness: 0.3,
    synapticNormalization: false
  };
}
function isInSleepPhase() {
  return active23?.isInSleepPhase() ?? false;
}
function isInWakePhase() {
  return active23?.isInWakePhase() ?? true;
}
function forcePhase(phase) {
  active23?.forcePhase(phase);
}
function getCircadianStats() {
  const st = active23?.getState() ?? createDefaultState2();
  return {
    phase: st.phase,
    phaseProgress: st.phaseProgress,
    phaseDuration: Date.now() - st.phaseStartedAt,
    idleTime: st.idleTime,
    activityLevel: st.activityLevel,
    wakeInteractions: st.wakeInteractions,
    sleepConsolidations: st.sleepConsolidations,
    modulation: {
      dopamine: st.wakeModulation.dopamineBoost,
      serotonin: st.wakeModulation.serotoninBoost,
      acetylcholine: st.wakeModulation.acetylcholineBoost,
      norepinephrine: st.wakeModulation.norepinephrineBoost
    },
    sleepSettings: { ...st.sleepSettings }
  };
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// src/modules/drive-engine.ts
var NEED_RANK = {
  none: 0,
  mild: 1,
  moderate: 2,
  strong: 3,
  urgent: 4
};
var DESIRE_STRENGTH = {
  none: 0,
  mild: 0.2,
  moderate: 0.4,
  strong: 0.7,
  urgent: 0.9
};
var DriveEngine = class {
  constructor(spec, config, workspaceDir, circadianEnabled, deps, logger) {
    this.spec = spec;
    this.config = config;
    this.circadianEnabled = circadianEnabled;
    this.deps = deps;
    this.logger = logger;
    const storageDir = join23(workspaceDir, ".brainagent", spec.id);
    if (!existsSync22(storageDir)) {
      mkdirSync22(storageDir, { recursive: true });
    }
    this.stateFile = join23(storageDir, "state.json");
    cancelPersist(this.stateFile);
    this.loadState();
    this.wireCoreListeners();
    logger.info(
      `BrainAgent ${spec.logName}: initialized (satiation=${this.satiation.toFixed(2)}, decay=${config.baseDecayRate}/${config.decayIntervalMs}ms, domains=${config.rewardDomains.join(",")})`
    );
  }
  spec;
  config;
  circadianEnabled;
  deps;
  logger;
  stateFile = "";
  satiation = 0.5;
  lastInteractionTime = 0;
  lastDecayEvaluationTime = 0;
  totalRewards = 0;
  totalNeedSignals = 0;
  currentNeedLevel = "none";
  interactionHistory = [];
  adaptiveDecayModifier = 1;
  unsubscribers = [];
  lastDesireUpdateTime = 0;
  lastDMNBiasTime = 0;
  lastNeedEmitTime = 0;
  /** Остановка: отписка от шины + немедленная запись состояния. */
  stop() {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
    flushPersist(this.stateFile);
  }
  /** Драйв-специфичный слушатель; отписка произойдёт в stop(). */
  addExtraListener(unsub) {
    this.unsubscribers.push(unsub);
  }
  /**
   * Эмиссия динамического события драйва. Шина типизирована под конкретные
   * имена (social-drive:*, cognitive-hunger:*...), но формы payload у всех
   * драйвов идентичны — приводим к известной сигнатуре.
   */
  emitDriveEvent(event, payload) {
    bus.emitSync(
      event,
      payload
    );
  }
  // ── Ядерные слушатели (общие для всех драйвов) ──────────────────
  wireCoreListeners() {
    this.unsubscribers.push(
      bus.on("dopamine:reward", (signal) => {
        this.onReward(signal);
      })
    );
    this.unsubscribers.push(
      bus.on("thalamus:classified", () => {
        this.evaluateDecay();
      })
    );
    this.unsubscribers.push(
      bus.on("vital-impulse:fired", (data) => {
        this.evaluateDecay();
        const consecutive = data.consecutiveFires ?? 0;
        const baseBoost = this.spec.firedBaseBoost;
        const escalation = Math.min(baseBoost * consecutive * 0.5, 0.5);
        const totalBoost = Math.min(baseBoost + escalation, 0.8);
        this.applySatiationDelta(totalBoost, { persist: true });
      })
    );
  }
  // ── Основная логика ─────────────────────────────────────────────
  /** On-demand экспоненциальное затухание с циркадной и серотониновой модуляцией. */
  evaluateDecay() {
    const now = Date.now();
    const elapsed = (now - this.lastDecayEvaluationTime) / this.config.decayIntervalMs;
    this.lastDecayEvaluationTime = now;
    if (elapsed <= 0) return;
    const circadianMod = this.circadianEnabled && isInSleepPhase() ? this.config.sleepDecayModifier : 1;
    const neuroState = getNeuromodulatorState();
    const serotoninMod = 0.7 + neuroState.serotonin * 0.6;
    const effectiveRate = this.config.baseDecayRate * this.adaptiveDecayModifier * circadianMod / serotoninMod;
    const decayFactor = Math.pow(1 - effectiveRate, elapsed);
    this.satiation *= decayFactor;
    if (this.satiation < 1e-3) {
      this.satiation = 0;
    }
    const oldLevel = this.currentNeedLevel;
    this.currentNeedLevel = this.computeNeedLevel();
    if (NEED_RANK[this.currentNeedLevel] > NEED_RANK[oldLevel]) {
      this.lastNeedEmitTime = now;
      this.emitNeedSignals();
    }
  }
  computeNeedLevel() {
    const t = this.config.needThresholds;
    if (this.satiation < t.urgent) return "urgent";
    if (this.satiation < t.strong) return "strong";
    if (this.satiation < t.moderate) return "moderate";
    if (this.satiation < t.mild) return "mild";
    return "none";
  }
  emitNeedSignals() {
    const now = Date.now();
    const need = 1 - this.satiation;
    this.totalNeedSignals++;
    if (this.currentNeedLevel !== "none") {
      this.emitDriveEvent(`${this.spec.id}:need-rising`, {
        needLevel: this.currentNeedLevel,
        satiation: this.satiation,
        need
      });
      this.logger.info(
        `BrainAgent ${this.spec.logName}: need rising \u2192 ${this.currentNeedLevel} (satiation=${this.satiation.toFixed(2)})`
      );
    }
    if (NEED_RANK[this.currentNeedLevel] >= NEED_RANK.moderate && now - this.lastDesireUpdateTime > this.config.desireUpdateIntervalMs) {
      this.lastDesireUpdateTime = now;
      this.updateDesire();
    }
    if (NEED_RANK[this.currentNeedLevel] >= NEED_RANK.strong && now - this.lastDMNBiasTime > this.config.dmnBiasIntervalMs) {
      this.lastDMNBiasTime = now;
      this.biasDMN();
    }
    if (this.currentNeedLevel === "urgent") {
      this.emitDriveEvent(`${this.spec.id}:urge`, {
        satiation: this.satiation,
        [this.spec.urgeTimeField]: this.lastInteractionTime > 0 ? now - this.lastInteractionTime : now
      });
      this.logger.info(`BrainAgent ${this.spec.logName}: URGENT urge emitted!`);
    }
    this.persistState();
  }
  updateDesire() {
    const targetStrength = DESIRE_STRENGTH[this.currentNeedLevel];
    const existing = this.deps.getDesires().find((d) => d.type === this.spec.desireType && d.source === this.spec.id);
    if (existing) {
      if (existing.strength < targetStrength) {
        existing.strength = targetStrength;
      }
    } else {
      this.deps.addDesire(
        this.spec.desireType,
        this.spec.desireDescription,
        targetStrength,
        this.spec.id
      );
    }
    this.logger.info(
      `BrainAgent ${this.spec.logName}: ${this.spec.desireType} desire updated (strength=${targetStrength.toFixed(2)})`
    );
  }
  biasDMN() {
    const facts = this.deps.getFactsByCategory(this.spec.factsCategory, 3);
    const topics = [];
    if (facts.length > 0) {
      for (const fact of facts) {
        topics.push({ topic: fact.content.slice(0, 100) });
      }
    } else if (this.spec.topicProvider) {
      const provided = this.spec.topicProvider().slice(0, 3);
      if (provided.length > 0) {
        topics.push(...provided);
      } else {
        topics.push({ topic: this.spec.fallbackTopic });
      }
    } else {
      topics.push({ topic: this.spec.fallbackTopic });
    }
    this.deps.generateThought(topics);
    this.logger.info(
      `BrainAgent ${this.spec.logName}: biased DMN toward ${topics.length} topic(s)`
    );
  }
  onReward(signal) {
    this.evaluateDecay();
    const domain = signal.context.domain.toLowerCase();
    if (!this.config.rewardDomains.includes(domain)) return;
    if (signal.reward > 0) {
      const boost = Math.min(
        this.config.maxSatiationBoost,
        Math.max(0, signal.reward * this.config.rewardMultiplier)
      );
      this.satiation = Math.min(1, this.satiation + boost);
      this.adaptiveDecayModifier = Math.min(2, this.adaptiveDecayModifier + 5e-3 * signal.reward);
      this.recordInteraction(signal.reward, domain);
      const existing = this.deps.getDesires().find((d) => d.type === this.spec.desireType && d.source === this.spec.id);
      if (existing) {
        existing.strength *= 0.5;
      }
      this.emitDriveEvent(`${this.spec.id}:satiated`, {
        satiation: this.satiation,
        boostAmount: boost,
        source: domain
      });
      this.logger.info(
        `BrainAgent ${this.spec.logName}: satiated by ${domain} reward (boost=${boost.toFixed(2)}, satiation=${this.satiation.toFixed(2)})`
      );
    } else if (signal.reward < 0) {
      const penalty = Math.abs(signal.reward) * 0.1;
      this.satiation = Math.max(0, this.satiation - penalty);
      this.adaptiveDecayModifier = Math.max(
        0.5,
        this.adaptiveDecayModifier - 3e-3 * Math.abs(signal.reward)
      );
      this.logger.info(
        `BrainAgent ${this.spec.logName}: negative experience (penalty=${penalty.toFixed(2)}, satiation=${this.satiation.toFixed(2)})`
      );
    }
    this.currentNeedLevel = this.computeNeedLevel();
    this.persistState();
  }
  recordInteraction(reward, context) {
    this.totalRewards++;
    this.lastInteractionTime = Date.now();
    this.interactionHistory.push({
      timestamp: Date.now(),
      reward,
      context
    });
    if (this.interactionHistory.length > this.config.maxHistoryEntries) {
      this.interactionHistory.shift();
    }
  }
  // ── Публичный API для обёрток ──────────────────────────────────
  /**
   * Изменить насыщение на дельту (буст или дренаж) с пересчётом уровня
   * потребности. Используются драйв-специфичными слушателями обёрток.
   */
  applySatiationDelta(delta, opts = {}) {
    this.satiation = Math.max(0, Math.min(1, this.satiation + delta));
    this.currentNeedLevel = this.computeNeedLevel();
    if (opts.persist) this.persistState();
  }
  /** Текущее насыщение (без оценки затухания). */
  getSatiation() {
    return this.satiation;
  }
  /** Полная статистика (с on-demand оценкой затухания). */
  getStats() {
    this.evaluateDecay();
    const now = Date.now();
    return {
      satiation: this.satiation,
      needLevel: this.currentNeedLevel,
      need: 1 - this.satiation,
      lastInteractionTime: this.lastInteractionTime,
      timeSinceLastInteraction: this.lastInteractionTime > 0 ? now - this.lastInteractionTime : -1,
      totalRewards: this.totalRewards,
      totalNeedSignals: this.totalNeedSignals,
      recentInteractionCount: this.interactionHistory.length
    };
  }
  /** Ручной буст насыщения (внешние модули). */
  boostSatiation(amount, reason) {
    const boost = Math.max(0, Math.min(1 - this.satiation, amount));
    this.satiation = Math.min(1, this.satiation + boost);
    this.currentNeedLevel = this.computeNeedLevel();
    this.emitDriveEvent(`${this.spec.id}:satiated`, {
      satiation: this.satiation,
      boostAmount: boost,
      source: reason
    });
    this.persistState();
    this.logger.info(
      `BrainAgent ${this.spec.logName}: manual boost (amount=${boost.toFixed(2)}, reason=${reason})`
    );
  }
  // ── Персистентность ─────────────────────────────────────────────
  loadState() {
    try {
      if (!existsSync22(this.stateFile)) {
        this.satiation = this.config.initialSatiation;
        this.lastDecayEvaluationTime = Date.now();
        return;
      }
      const raw = JSON.parse(readFileSync22(this.stateFile, "utf-8"));
      const legacy = this.spec.legacyKeys;
      const readNum = (...keys) => {
        for (const key of keys) {
          const value = raw[key];
          if (typeof value === "number") return value;
        }
        return void 0;
      };
      const readArr = (...keys) => {
        for (const key of keys) {
          const value = raw[key];
          if (Array.isArray(value)) return value;
        }
        return void 0;
      };
      this.satiation = readNum("satiation") ?? this.config.initialSatiation;
      this.lastInteractionTime = readNum("lastInteractionTime", legacy.lastInteraction) ?? 0;
      this.lastDecayEvaluationTime = readNum("lastDecayEvaluationTime") ?? Date.now();
      this.adaptiveDecayModifier = readNum("adaptiveDecayModifier") ?? 1;
      this.totalRewards = readNum("totalRewards", legacy.totalRewards) ?? 0;
      this.totalNeedSignals = readNum("totalNeedSignals") ?? 0;
      this.interactionHistory = readArr("interactionHistory", legacy.history) ?? [];
      this.currentNeedLevel = this.computeNeedLevel();
    } catch {
    }
  }
  persistState() {
    schedulePersist(this.stateFile, () => {
      const state = {
        satiation: this.satiation,
        lastInteractionTime: this.lastInteractionTime,
        lastDecayEvaluationTime: this.lastDecayEvaluationTime,
        adaptiveDecayModifier: this.adaptiveDecayModifier,
        totalRewards: this.totalRewards,
        totalNeedSignals: this.totalNeedSignals,
        interactionHistory: this.interactionHistory
      };
      return JSON.stringify(state, null, 2);
    });
  }
};

// src/modules/social-drive.ts
function createSocialDrive(workspaceDir, cfg, log, injectedDeps) {
  const c = cfg.socialDrive;
  const driveConfig = {
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
    desireUpdateIntervalMs: c.desireUpdateIntervalMs
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
        history: "socialInteractionHistory"
      }
    },
    driveConfig,
    workspaceDir,
    cfg.circadian?.enabled ?? false,
    {
      addDesire: injectedDeps.addDesire,
      getDesires: injectedDeps.getDesires,
      getFactsByCategory: injectedDeps.getFactsByCategory,
      generateThought: injectedDeps.generateSocialThought
    },
    log
  );
  engine.addExtraListener(
    bus.on("amygdala:assessed", (data) => {
      if (data.empathyNeeded && data.emotionIntensity > 0.6) {
        engine.applySatiationDelta(-(data.emotionIntensity * 0.04));
      }
    })
  );
  function dispose() {
    engine.stop();
  }
  function stop() {
    engine.stop();
    log.info("BrainAgent SocialDrive: stopped.");
  }
  function getStats2() {
    const s = engine.getStats();
    return {
      satiation: s.satiation,
      needLevel: s.needLevel,
      need: s.need,
      lastSocialInteractionTime: s.lastInteractionTime,
      timeSinceLastSocial: s.timeSinceLastInteraction,
      totalSocialRewards: s.totalRewards,
      totalNeedSignals: s.totalNeedSignals,
      recentInteractionCount: s.recentInteractionCount
    };
  }
  function getSatiation2() {
    return engine.getSatiation();
  }
  function boostSatiation(amount, reason) {
    engine.boostSatiation(amount, reason);
  }
  return { dispose, stop, getStats: getStats2, getSatiation: getSatiation2, boostSatiation };
}
var active24;
function initSocialDrive(workspaceDir, cfg, log, injectedDeps) {
  active24?.dispose();
  active24 = createSocialDrive(workspaceDir, cfg, log, injectedDeps);
}
function stopSocialDrive() {
  active24?.stop();
  active24 = void 0;
}
function getSocialDriveStats() {
  return active24?.getStats() ?? {
    satiation: 0,
    needLevel: "none",
    need: 0,
    lastSocialInteractionTime: 0,
    timeSinceLastSocial: -1,
    totalSocialRewards: 0,
    totalNeedSignals: 0,
    recentInteractionCount: 0
  };
}
function getSatiation() {
  return active24?.getSatiation() ?? 0;
}

// src/modules/cognitive-hunger.ts
function createCognitiveHunger(workspaceDir, cfg, log, injectedDeps) {
  const c = cfg.cognitiveHunger;
  const driveConfig = {
    rewardDomains: c.learningDomains,
    rewardMultiplier: c.learningRewardMultiplier,
    initialSatiation: c.initialSatiation,
    baseDecayRate: c.baseDecayRate,
    decayIntervalMs: c.decayIntervalMs,
    sleepDecayModifier: c.sleepDecayModifier,
    maxSatiationBoost: c.maxSatiationBoost,
    maxHistoryEntries: c.maxHistoryEntries,
    needThresholds: c.needThresholds,
    dmnBiasIntervalMs: c.dmnBiasIntervalMs,
    desireUpdateIntervalMs: c.desireUpdateIntervalMs
  };
  const engine = new DriveEngine(
    {
      id: "cognitive-hunger",
      logName: "CognitiveHunger",
      desireType: "understanding",
      desireDescription: "Feeling the urge to learn something new or explore a knowledge gap",
      factsCategory: "fact",
      fallbackTopic: "knowledge gaps and interesting topics to explore",
      // Драйв думает о реальных пробелах curiosity-drive (канонический
      // источник пробелов в знаниях), а не об общей запасной теме
      topicProvider: () => getOpenGaps().map((gap) => ({ topic: gap.topic })),
      firedBaseBoost: 0.25,
      urgeTimeField: "timeSinceLastLearning",
      legacyKeys: {
        lastInteraction: "lastLearningInteractionTime",
        totalRewards: "totalLearningRewards",
        history: "learningInteractionHistory"
      }
    },
    driveConfig,
    workspaceDir,
    cfg.circadian?.enabled ?? false,
    {
      addDesire: injectedDeps.addDesire,
      getDesires: injectedDeps.getDesires,
      getFactsByCategory: injectedDeps.getFactsByCategory,
      generateThought: injectedDeps.generateLearningThought
    },
    log
  );
  engine.addExtraListener(
    bus.on("learning:insight-discovered", () => {
      engine.evaluateDecay();
      engine.applySatiationDelta(0.08, { persist: true });
    })
  );
  engine.addExtraListener(
    bus.on("learning:domain-performance-updated", (data) => {
      if (data.trend === "improving") {
        engine.evaluateDecay();
        engine.applySatiationDelta(0.05, { persist: true });
      }
    })
  );
  engine.addExtraListener(
    bus.on("curiosity:gap-detected", () => {
      engine.evaluateDecay();
      engine.applySatiationDelta(-0.03, { persist: true });
    })
  );
  engine.addExtraListener(
    bus.on("hippocampus:stored", () => {
      engine.applySatiationDelta(0.02, { persist: true });
    })
  );
  engine.addExtraListener(
    bus.on("cerebellum:validated", (data) => {
      if (!data.passed) {
        engine.applySatiationDelta(-0.03);
      }
    })
  );
  function dispose() {
    engine.stop();
  }
  function stop() {
    engine.stop();
    log.info("BrainAgent CognitiveHunger: stopped.");
  }
  function getStats2() {
    const s = engine.getStats();
    return {
      satiation: s.satiation,
      needLevel: s.needLevel,
      need: s.need,
      lastLearningInteractionTime: s.lastInteractionTime,
      timeSinceLastLearning: s.timeSinceLastInteraction,
      totalLearningRewards: s.totalRewards,
      totalNeedSignals: s.totalNeedSignals,
      recentInteractionCount: s.recentInteractionCount
    };
  }
  function getSatiation2() {
    return engine.getSatiation();
  }
  function boostSatiation(amount, reason) {
    engine.boostSatiation(amount, reason);
  }
  return { dispose, stop, getStats: getStats2, getSatiation: getSatiation2, boostSatiation };
}
var active25;
function initCognitiveHunger(workspaceDir, cfg, log, injectedDeps) {
  active25?.dispose();
  active25 = createCognitiveHunger(workspaceDir, cfg, log, injectedDeps);
}
function stopCognitiveHunger() {
  active25?.stop();
  active25 = void 0;
}
function getCognitiveHungerStats() {
  return active25?.getStats() ?? {
    satiation: 0,
    needLevel: "none",
    need: 0,
    lastLearningInteractionTime: 0,
    timeSinceLastLearning: -1,
    totalLearningRewards: 0,
    totalNeedSignals: 0,
    recentInteractionCount: 0
  };
}
function getCognitiveHungerSatiation() {
  return active25?.getSatiation() ?? 0;
}

// src/modules/creative-drive.ts
function createCreativeDrive(workspaceDir, cfg, log, injectedDeps) {
  const c = cfg.creativeDrive;
  const driveConfig = {
    rewardDomains: c.creativeDomains,
    rewardMultiplier: c.creativeRewardMultiplier,
    initialSatiation: c.initialSatiation,
    baseDecayRate: c.baseDecayRate,
    decayIntervalMs: c.decayIntervalMs,
    sleepDecayModifier: c.sleepDecayModifier,
    maxSatiationBoost: c.maxSatiationBoost,
    maxHistoryEntries: c.maxHistoryEntries,
    needThresholds: c.needThresholds,
    dmnBiasIntervalMs: c.dmnBiasIntervalMs,
    desireUpdateIntervalMs: c.desireUpdateIntervalMs
  };
  const engine = new DriveEngine(
    {
      id: "creative-drive",
      logName: "CreativeDrive",
      desireType: "exploration",
      desireDescription: "Feeling the urge to create something, explore novel ideas or express imagination",
      factsCategory: "creative",
      fallbackTopic: "creative expression, imagination and novel ideas",
      firedBaseBoost: 0.25,
      urgeTimeField: "timeSinceLastCreation",
      legacyKeys: {
        lastInteraction: "lastCreativeInteractionTime",
        totalRewards: "totalCreativeRewards",
        history: "creativeInteractionHistory"
      }
    },
    driveConfig,
    workspaceDir,
    cfg.circadian?.enabled ?? false,
    {
      addDesire: injectedDeps.addDesire,
      getDesires: injectedDeps.getDesires,
      getFactsByCategory: injectedDeps.getFactsByCategory,
      generateThought: injectedDeps.generateCreativeThought
    },
    log
  );
  engine.addExtraListener(
    bus.on("dmn:insight-generated", () => {
      engine.evaluateDecay();
      engine.applySatiationDelta(0.1, { persist: true });
    })
  );
  engine.addExtraListener(
    bus.on("dmn:thought-generated", () => {
      engine.applySatiationDelta(0.05, { persist: true });
    })
  );
  engine.addExtraListener(
    bus.on("qualia:experience-generated", () => {
      engine.evaluateDecay();
      engine.applySatiationDelta(0.07, { persist: true });
    })
  );
  engine.addExtraListener(
    bus.on("curiosity:question-generated", () => {
      engine.applySatiationDelta(-0.02);
    })
  );
  function dispose() {
    engine.stop();
  }
  function stop() {
    engine.stop();
    log.info("BrainAgent CreativeDrive: stopped.");
  }
  function getStats2() {
    const s = engine.getStats();
    return {
      satiation: s.satiation,
      needLevel: s.needLevel,
      need: s.need,
      lastCreativeInteractionTime: s.lastInteractionTime,
      timeSinceLastCreation: s.timeSinceLastInteraction,
      totalCreativeRewards: s.totalRewards,
      totalNeedSignals: s.totalNeedSignals,
      recentInteractionCount: s.recentInteractionCount
    };
  }
  function getSatiation2() {
    return engine.getSatiation();
  }
  function boostSatiation(amount, reason) {
    engine.boostSatiation(amount, reason);
  }
  return { dispose, stop, getStats: getStats2, getSatiation: getSatiation2, boostSatiation };
}
var active26;
function initCreativeDrive(workspaceDir, cfg, log, injectedDeps) {
  active26?.dispose();
  active26 = createCreativeDrive(workspaceDir, cfg, log, injectedDeps);
}
function stopCreativeDrive() {
  active26?.stop();
  active26 = void 0;
}
function getCreativeDriveStats() {
  return active26?.getStats() ?? {
    satiation: 0,
    needLevel: "none",
    need: 0,
    lastCreativeInteractionTime: 0,
    timeSinceLastCreation: -1,
    totalCreativeRewards: 0,
    totalNeedSignals: 0,
    recentInteractionCount: 0
  };
}
function getCreativeDriveSatiation() {
  return active26?.getSatiation() ?? 0;
}

// src/modules/mastery-drive.ts
import { existsSync as existsSync23, mkdirSync as mkdirSync23, readFileSync as readFileSync23 } from "node:fs";
import { join as join24 } from "node:path";
function createMasteryDrive(workspaceDir, cfg, log, injectedDeps) {
  const storageDir = workspaceDir ? join24(workspaceDir, ".brainagent", "mastery-drive") : "";
  const config = cfg?.masteryDrive;
  const circadianEnabled = cfg?.circadian?.enabled ?? false;
  const logger = log;
  const deps = injectedDeps;
  const domainSatiations = /* @__PURE__ */ new Map();
  let lastDecayEvaluationTime = Date.now();
  let totalImprovementRewards = 0;
  let totalNeedSignals = 0;
  let currentNeedLevel = "none";
  const unsubscribers = [];
  let lastDesireUpdateTime = 0;
  let lastDMNBiasTime = 0;
  let lastNeedEmitTime = 0;
  let adaptiveDecayModifier = 1;
  function getOrCreateDomain(domain) {
    let entry = domainSatiations.get(domain);
    if (!entry) {
      entry = {
        satiation: config?.initialSatiation ?? 0.5,
        lastActivityTime: Date.now(),
        totalRewards: 0
      };
      domainSatiations.set(domain, entry);
      pruneDomainsIfNeeded();
    }
    return entry;
  }
  function pruneDomainsIfNeeded() {
    if (!config) return;
    while (domainSatiations.size > config.maxTrackedDomains) {
      let maxSatiation = -1;
      let maxDomain = "";
      for (const [domain, mastery] of domainSatiations) {
        if (mastery.satiation > maxSatiation) {
          maxSatiation = mastery.satiation;
          maxDomain = domain;
        }
      }
      if (maxDomain) {
        domainSatiations.delete(maxDomain);
      }
    }
  }
  function boostDomain(domain, amount) {
    const entry = getOrCreateDomain(domain);
    const boost = Math.min(config?.maxSatiationBoost ?? 0.6, Math.max(0, amount));
    entry.satiation = Math.min(1, entry.satiation + boost);
    entry.lastActivityTime = Date.now();
    currentNeedLevel = computeNeedLevel();
    persistState();
  }
  function drainDomain(domain, amount) {
    const entry = getOrCreateDomain(domain);
    entry.satiation = Math.max(0, entry.satiation - amount);
    entry.lastActivityTime = Date.now();
    currentNeedLevel = computeNeedLevel();
    persistState();
  }
  function findWeakestDomain() {
    let minSatiation = Infinity;
    let weakestDomain = "";
    let weakestMastery = null;
    for (const [domain, mastery] of domainSatiations) {
      if (mastery.satiation < minSatiation) {
        minSatiation = mastery.satiation;
        weakestDomain = domain;
        weakestMastery = mastery;
      }
    }
    return weakestMastery ? { domain: weakestDomain, mastery: weakestMastery } : null;
  }
  function getAggregateSatiation() {
    if (domainSatiations.size === 0) return config?.initialSatiation ?? 0.5;
    let min = Infinity;
    for (const [, mastery] of domainSatiations) {
      if (mastery.satiation < min) {
        min = mastery.satiation;
      }
    }
    return min;
  }
  function evaluateDecay() {
    if (!config) return;
    const now = Date.now();
    const elapsed = (now - lastDecayEvaluationTime) / config.decayIntervalMs;
    lastDecayEvaluationTime = now;
    if (elapsed <= 0) return;
    const circadianMod = circadianEnabled && isInSleepPhase() ? config.sleepDecayModifier : 1;
    const neuroState = getNeuromodulatorState();
    const serotoninMod = 0.7 + neuroState.serotonin * 0.6;
    for (const [, mastery] of domainSatiations) {
      let effectiveRate = config.baseDecayRate * adaptiveDecayModifier * circadianMod / serotoninMod;
      const inactiveMs = now - mastery.lastActivityTime;
      if (inactiveMs > 10 * 60 * 1e3) {
        effectiveRate *= config.inactiveDomainDecayMultiplier;
      }
      const decayFactor = Math.pow(1 - effectiveRate, elapsed);
      mastery.satiation *= decayFactor;
      if (mastery.satiation < 1e-3) {
        mastery.satiation = 0;
      }
    }
    const oldLevel = currentNeedLevel;
    currentNeedLevel = computeNeedLevel();
    if (needLevelRank(currentNeedLevel) > needLevelRank(oldLevel)) {
      lastNeedEmitTime = now;
      emitNeedSignals();
    }
  }
  function computeNeedLevel() {
    if (!config) return "none";
    const aggregate = getAggregateSatiation();
    if (aggregate < config.needThresholds.urgent) return "urgent";
    if (aggregate < config.needThresholds.strong) return "strong";
    if (aggregate < config.needThresholds.moderate) return "moderate";
    if (aggregate < config.needThresholds.mild) return "mild";
    return "none";
  }
  function needLevelRank(level) {
    const ranks = {
      none: 0,
      mild: 1,
      moderate: 2,
      strong: 3,
      urgent: 4
    };
    return ranks[level];
  }
  function emitNeedSignals() {
    if (!config || !deps) return;
    const now = Date.now();
    const aggregate = getAggregateSatiation();
    const need = 1 - aggregate;
    const weakest = findWeakestDomain();
    totalNeedSignals++;
    if (currentNeedLevel !== "none") {
      bus.emitSync("mastery-drive:need-rising", {
        needLevel: currentNeedLevel,
        satiation: aggregate,
        need,
        domain: weakest?.domain
      });
      logger?.info(
        `BrainAgent MasteryDrive: need rising \u2192 ${currentNeedLevel} (aggregate=${aggregate.toFixed(2)}, weakest=${weakest?.domain ?? "none"})`
      );
    }
    if (needLevelRank(currentNeedLevel) >= needLevelRank("moderate") && now - lastDesireUpdateTime > config.desireUpdateIntervalMs) {
      lastDesireUpdateTime = now;
      updateMasteryDesire(weakest?.domain);
    }
    if (needLevelRank(currentNeedLevel) >= needLevelRank("strong") && now - lastDMNBiasTime > config.dmnBiasIntervalMs) {
      lastDMNBiasTime = now;
      biasDMNToMasteryThoughts(weakest?.domain);
    }
    if (currentNeedLevel === "urgent" && weakest) {
      bus.emitSync("mastery-drive:urge", {
        satiation: aggregate,
        weakestDomain: weakest.domain,
        domainSatiation: weakest.mastery.satiation
      });
      logger?.info(
        `BrainAgent MasteryDrive: URGENT mastery urge emitted! (weakest=${weakest.domain}, satiation=${weakest.mastery.satiation.toFixed(2)})`
      );
    }
    persistState();
  }
  function updateMasteryDesire(weakestDomain) {
    if (!deps) return;
    const strengthMap = {
      none: 0,
      mild: 0.2,
      moderate: 0.4,
      strong: 0.7,
      urgent: 0.9
    };
    const targetStrength = strengthMap[currentNeedLevel];
    const description = weakestDomain ? `Feeling the need to improve and practice \u2014 especially in ${weakestDomain} domain` : "Feeling the need to improve skills and grow as an agent";
    const existing = deps.getDesires().find((d) => d.type === "mastery" && d.source === "mastery-drive");
    if (existing) {
      if (existing.strength < targetStrength) {
        existing.strength = targetStrength;
      }
      existing.description = description;
    } else {
      deps.addDesire("mastery", description, targetStrength, "mastery-drive");
    }
    logger?.info(
      `BrainAgent MasteryDrive: mastery desire updated (strength=${targetStrength.toFixed(2)}, weakest=${weakestDomain ?? "none"})`
    );
  }
  function biasDMNToMasteryThoughts(weakestDomain) {
    if (!deps) return;
    const topics = [];
    if (weakestDomain) {
      const skillFacts = deps.getFactsByCategory("skill", 2);
      if (skillFacts.length > 0) {
        for (const fact of skillFacts) {
          topics.push({ topic: fact.content.slice(0, 100) });
        }
      }
      topics.push({ topic: `areas of improvement and skill gaps in ${weakestDomain}` });
    } else {
      topics.push({ topic: "self-improvement, skill practice and mastery growth" });
    }
    deps.generateMasteryThought(topics);
    logger?.info(`BrainAgent MasteryDrive: biased DMN toward ${topics.length} mastery topic(s)`);
  }
  function onMasteryReward(signal) {
    if (!config) return;
    evaluateDecay();
    const domain = signal.context.domain.toLowerCase();
    if (signal.predictionError > 0) {
      const boost = Math.min(
        config.maxSatiationBoost,
        Math.max(0, signal.predictionError * config.improvementRewardMultiplier)
      );
      const entry = getOrCreateDomain(domain);
      entry.satiation = Math.min(1, entry.satiation + boost);
      entry.lastActivityTime = Date.now();
      entry.totalRewards++;
      totalImprovementRewards++;
      adaptiveDecayModifier = Math.min(2, adaptiveDecayModifier + 5e-3 * signal.predictionError);
      if (deps) {
        const existing = deps.getDesires().find((d) => d.type === "mastery" && d.source === "mastery-drive");
        if (existing) {
          existing.strength *= 0.7;
        }
      }
      bus.emitSync("mastery-drive:satiated", {
        satiation: entry.satiation,
        boostAmount: boost,
        source: `improvement-${domain}`,
        domain
      });
      logger?.info(
        `BrainAgent MasteryDrive: satiated in ${domain} (boost=${boost.toFixed(2)}, satiation=${entry.satiation.toFixed(2)})`
      );
    } else if (signal.predictionError < 0 && signal.reward >= 0) {
      const drain = Math.abs(signal.predictionError) * 0.05;
      drainDomain(domain, drain);
      adaptiveDecayModifier = Math.max(
        0.5,
        adaptiveDecayModifier - 3e-3 * Math.abs(signal.predictionError)
      );
      logger?.info(
        `BrainAgent MasteryDrive: below expectations in ${domain} (drain=${drain.toFixed(2)})`
      );
    }
    currentNeedLevel = computeNeedLevel();
    persistState();
  }
  function wireEventListeners() {
    const unsubReward = bus.on("dopamine:reward", (signal) => {
      onMasteryReward(signal);
    });
    unsubscribers.push(unsubReward);
    const unsubActivity = bus.on("thalamus:classified", () => {
      evaluateDecay();
    });
    unsubscribers.push(unsubActivity);
    const unsubPredError = bus.on("dopamine:prediction-error", (data) => {
      if (!config) return;
      evaluateDecay();
      const domain = data.context.toLowerCase().split(/[/:]/)[0].trim();
      if (!domain) return;
      if (data.error > 0) {
        const boost = Math.min(config.maxSatiationBoost, data.error * 0.15);
        boostDomain(domain, boost);
      } else if (data.error < 0) {
        const drain = Math.abs(data.error) * 0.08;
        drainDomain(domain, drain);
      }
    });
    unsubscribers.push(unsubPredError);
    const unsubPerf = bus.on("learning:domain-performance-updated", (data) => {
      if (!config) return;
      evaluateDecay();
      if (data.trend === "improving") {
        boostDomain(data.domain.toLowerCase(), 0.1);
      }
    });
    unsubscribers.push(unsubPerf);
    const unsubCapability = bus.on("identity:capability-updated", (data) => {
      if (!config) return;
      evaluateDecay();
      boostDomain(data.domain.toLowerCase(), 0.08);
    });
    unsubscribers.push(unsubCapability);
    const unsubCerebellum = bus.on("cerebellum:validated", (data) => {
      if (!config) return;
      evaluateDecay();
      if (data.passed) {
        for (const [domain] of domainSatiations) {
          boostDomain(domain, 0.02);
        }
      } else {
        const weakest = findWeakestDomain();
        if (weakest) {
          drainDomain(weakest.domain, 0.04);
        }
      }
    });
    unsubscribers.push(unsubCerebellum);
    const unsubFired = bus.on("vital-impulse:fired", (data) => {
      evaluateDecay();
      const consecutive = data.consecutiveFires ?? 0;
      const baseBoost = 0.25;
      const escalation = Math.min(baseBoost * consecutive * 0.5, 0.5);
      const totalBoost = Math.min(baseBoost + escalation, 0.8);
      for (const [domain] of domainSatiations) {
        boostDomain(domain, totalBoost);
      }
    });
    unsubscribers.push(unsubFired);
    const unsubAmygdala = bus.on("amygdala:assessed", (data) => {
      if (!config) return;
      if (data.emotion === "frustration" && data.emotionIntensity > 0.5) {
        const weakest = findWeakestDomain();
        if (weakest) {
          const drain = data.emotionIntensity * 0.03;
          drainDomain(weakest.domain, drain);
        }
      }
    });
    unsubscribers.push(unsubAmygdala);
  }
  function getStats2() {
    evaluateDecay();
    const aggregate = getAggregateSatiation();
    const weakest = findWeakestDomain();
    const domainMap = {};
    for (const [domain, mastery] of domainSatiations) {
      domainMap[domain] = mastery.satiation;
    }
    return {
      satiation: aggregate,
      needLevel: currentNeedLevel,
      need: 1 - aggregate,
      weakestDomain: weakest?.domain ?? "none",
      weakestDomainSatiation: weakest?.mastery.satiation ?? 0,
      activeDomainCount: domainSatiations.size,
      domainSatiations: domainMap,
      totalImprovementRewards,
      totalNeedSignals
    };
  }
  function boostDomainSatiation(domain, amount, reason) {
    boostDomain(domain, amount);
    bus.emitSync("mastery-drive:satiated", {
      satiation: getOrCreateDomain(domain).satiation,
      boostAmount: amount,
      source: reason,
      domain
    });
    logger?.info(
      `BrainAgent MasteryDrive: manual boost in ${domain} (amount=${amount.toFixed(2)}, reason=${reason})`
    );
  }
  function loadState() {
    if (!storageDir) return;
    try {
      const filePath = join24(storageDir, "state.json");
      if (existsSync23(filePath)) {
        const raw = JSON.parse(readFileSync23(filePath, "utf-8"));
        totalImprovementRewards = raw.totalImprovementRewards ?? 0;
        totalNeedSignals = raw.totalNeedSignals ?? 0;
        adaptiveDecayModifier = raw.adaptiveDecayModifier ?? 1;
        lastDecayEvaluationTime = raw.lastDecayEvaluationTime ?? Date.now();
        if (raw.domainSatiations) {
          domainSatiations.clear();
          for (const [domain, mastery] of Object.entries(raw.domainSatiations)) {
            domainSatiations.set(domain, {
              satiation: mastery.satiation ?? config?.initialSatiation ?? 0.5,
              lastActivityTime: mastery.lastActivityTime ?? 0,
              totalRewards: mastery.totalRewards ?? 0
            });
          }
        }
        currentNeedLevel = computeNeedLevel();
      }
    } catch {
    }
  }
  function persistState() {
    if (!storageDir) return;
    schedulePersist(join24(storageDir, "state.json"), () => {
      const domainMap = {};
      for (const [domain, mastery] of domainSatiations) {
        domainMap[domain] = mastery;
      }
      const state = {
        domainSatiations: domainMap,
        lastDecayEvaluationTime,
        adaptiveDecayModifier,
        totalImprovementRewards,
        totalNeedSignals
      };
      return JSON.stringify(state, null, 2);
    });
  }
  function stop() {
    for (const unsub of unsubscribers) {
      unsub();
    }
    unsubscribers.length = 0;
    if (storageDir) {
      persistState();
      flushPersist(join24(storageDir, "state.json"));
    }
    logger?.info("BrainAgent MasteryDrive: stopped.");
  }
  if (storageDir) {
    if (!existsSync23(storageDir)) {
      mkdirSync23(storageDir, { recursive: true });
    }
    cancelPersist(join24(storageDir, "state.json"));
    loadState();
  }
  wireEventListeners();
  if (cfg && config) {
    logger?.info(
      `BrainAgent MasteryDrive: initialized (domains=${domainSatiations.size}, decay=${config.baseDecayRate}/${config.decayIntervalMs}ms, maxDomains=${config.maxTrackedDomains})`
    );
  }
  return {
    getStats: getStats2,
    getAggregateSatiation,
    boostDomainSatiation,
    stop
  };
}
var active27;
function current19() {
  return active27;
}
function initMasteryDrive(workspaceDir, cfg, log, injectedDeps) {
  active27?.stop();
  active27 = createMasteryDrive(workspaceDir, cfg, log, injectedDeps);
}
function stopMasteryDrive() {
  active27?.stop();
  active27 = void 0;
}
function getMasteryDriveStats() {
  const inst = current19();
  if (!inst) {
    return {
      satiation: 0.5,
      needLevel: "none",
      need: 0.5,
      weakestDomain: "none",
      weakestDomainSatiation: 0,
      activeDomainCount: 0,
      domainSatiations: {},
      totalImprovementRewards: 0,
      totalNeedSignals: 0
    };
  }
  return inst.getStats();
}
function getMasteryAggregateSatiation() {
  return current19()?.getAggregateSatiation() ?? 0.5;
}

// src/plugin/autonomy.ts
function createAutonomyState() {
  return {
    lastActiveAgentId: void 0,
    lastAutonomousSource: "",
    previousCycleWasAutonomous: false,
    lastAutonomousEpisodeId: void 0,
    lastAutonomousDomain: "unknown",
    lastAutonomousDeliveryAt: 0
  };
}
var DRIVE_DESCRIPTIONS = {
  social: "\u0425\u043E\u0447\u0435\u0442\u0441\u044F \u0441\u0432\u044F\u0437\u0430\u0442\u044C\u0441\u044F \u0441 \u043A\u0435\u043C-\u0442\u043E, \u0443\u0437\u043D\u0430\u0442\u044C \u043A\u0430\u043A \u0434\u0435\u043B\u0430, \u043F\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C.",
  cognitive: "\u0425\u043E\u0447\u0435\u0442\u0441\u044F \u0443\u0437\u043D\u0430\u0442\u044C \u0447\u0442\u043E-\u0442\u043E \u043D\u043E\u0432\u043E\u0435, \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u044C \u0442\u0435\u043C\u0443, \u0440\u0430\u0437\u043E\u0431\u0440\u0430\u0442\u044C\u0441\u044F \u0432 \u0432\u043E\u043F\u0440\u043E\u0441\u0435.",
  creative: "\u0425\u043E\u0447\u0435\u0442\u0441\u044F \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0447\u0442\u043E-\u0442\u043E, \u0432\u044B\u0440\u0430\u0437\u0438\u0442\u044C \u043C\u044B\u0441\u043B\u044C \u0442\u0432\u043E\u0440\u0447\u0435\u0441\u043A\u0438.",
  mastery: "\u0425\u043E\u0447\u0435\u0442\u0441\u044F \u0443\u043B\u0443\u0447\u0448\u0438\u0442\u044C \u043D\u0430\u0432\u044B\u043A\u0438, \u043F\u043E\u043F\u0440\u0430\u043A\u0442\u0438\u043A\u043E\u0432\u0430\u0442\u044C\u0441\u044F."
};
var DRIVE_EMOTIONS = {
  social: { emotion: "curiosity", domain: "casual", intensityMax: 0.9, intensityBase: 0.3, intensityScale: 0.6 },
  cognitive: { emotion: "curiosity", domain: "factual", intensityMax: 0.9, intensityBase: 0.3, intensityScale: 0.6 },
  creative: { emotion: "joy", domain: "creative", intensityMax: 0.8, intensityBase: 0.3, intensityScale: 0.5 },
  mastery: { emotion: "curiosity", domain: "technical", intensityMax: 0.8, intensityBase: 0.3, intensityScale: 0.5 }
};
function collectActiveDrives(drives, threshold) {
  const active42 = [];
  if (drives.social) {
    const s = drives.social();
    if (s.need >= threshold) active42.push({ name: "social", need: s.need, needLevel: s.needLevel });
  }
  if (drives.cognitive) {
    const c = drives.cognitive();
    if (c.need >= threshold) active42.push({ name: "cognitive", need: c.need, needLevel: c.needLevel });
  }
  if (drives.creative) {
    const c = drives.creative();
    if (c.need >= threshold) active42.push({ name: "creative", need: c.need, needLevel: c.needLevel });
  }
  if (drives.mastery) {
    const m = drives.mastery();
    if (m.need >= threshold) active42.push({ name: "mastery", need: m.need, needLevel: m.needLevel });
  }
  return active42;
}
function synthesizeAutonomousCycleState(brainConfig, drives, cycle) {
  const active42 = collectActiveDrives(drives, 0.5);
  if (active42.length === 0) return;
  const ranked = active42.map((d) => {
    const spec2 = DRIVE_EMOTIONS[d.name];
    return {
      drive: d,
      spec: spec2,
      intensity: Math.min(spec2.intensityMax, spec2.intensityBase + d.need * spec2.intensityScale)
    };
  }).sort((a, b) => b.intensity - a.intensity);
  const { drive: strongest, spec, intensity } = ranked[0];
  cycle.assessment = {
    urgency: 0.2,
    importance: 0.4 + intensity * 0.3,
    emotion: spec.emotion,
    emotionIntensity: intensity,
    empathyNeeded: false,
    rationale: `autonomous drive (${spec.domain})`
  };
  if (!cycle.classification || cycle.classification.domain === "unknown") {
    cycle.classification = {
      modality: "text",
      domain: spec.domain,
      complexity: "simple",
      intentSummary: "autonomous drive action",
      confidence: 0.7,
      processingPath: "fast"
    };
  }
}
function createAutonomousDeliverer(deps) {
  const { state, brainConfig, minGapMs, logger } = deps;
  return function enqueueAutonomousIntent(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (state.previousCycleWasAutonomous) {
      logger.info("BrainAgent Autonomy: intent suppressed \u2014 previous cycle was autonomous");
      return;
    }
    if (Date.now() - state.lastAutonomousDeliveryAt < minGapMs) {
      logger.info("BrainAgent Autonomy: intent suppressed \u2014 minimum gap not elapsed");
      return;
    }
    if (brainConfig.modules.proactiveFeedback) {
      const intentDomain = deps.classifyDomain(trimmed).domain;
      if (deps.isDomainSuppressed(intentDomain)) {
        logger.info(
          `BrainAgent Autonomy: intent suppressed \u2014 domain ${intentDomain} was rejected`
        );
        return;
      }
    }
    const agent = deps.pickAgent();
    if (!agent) {
      logger.warn("BrainAgent Autonomy: no live agent \u2014 autonomous intent dropped");
      return;
    }
    const rejectionHints = brainConfig.modules.proactiveFeedback ? deps.getSuppressedDomainHints() : [];
    const framed = trimmed.startsWith(AUTONOMOUS_TAG_PREFIX) ? [
      ...AUTONOMOUS_FRAMING_LINES,
      ...rejectionHints.length > 0 ? [`\u041D\u0435 \u0437\u0430\u0432\u043E\u0434\u0438 \u0442\u0435\u043C\u044B, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u043D\u0435 \u0437\u0430\u0448\u043B\u0438: ${rejectionHints.join("; ")}.`] : [],
      "",
      trimmed
    ].join("\n") : trimmed;
    state.lastAutonomousDeliveryAt = Date.now();
    deps.deliver(agent, framed);
  };
}
function createAutonomousIntentResolver(deps) {
  const { state, brainConfig, drives } = deps;
  return () => {
    if (brainConfig.modules.goalStack && deps.goalStack) {
      const stats = deps.goalStack.getGoalStackStats();
      if (stats.pending > 0) {
        const idleMs = brainConfig.circadian.enabled ? deps.circadian?.getCircadianState().idleTime : void 0;
        const triggered = deps.goalStack.checkAutonomousGoals(idleMs);
        if (triggered.length > 0) {
          const goalCtx = deps.goalStack.buildGoalContext(triggered);
          if (goalCtx) {
            state.lastAutonomousSource = `goal:${triggered[0].id}`;
            return {
              text: [
                AUTONOMOUS_TAG,
                ...triggered.slice(0, 3).map((g) => g.description),
                "",
                goalCtx,
                "",
                "\u0415\u0441\u043B\u0438 \u0443 \u0442\u0435\u0431\u044F \u0435\u0441\u0442\u044C \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \u0434\u043B\u044F \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F \u2014 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0435\u0433\u043E. \u0415\u0441\u043B\u0438 \u043D\u0435\u0442 \u2014 \u043F\u0440\u043E\u0441\u0442\u043E \u043D\u0430\u043F\u0438\u0448\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u043E \u0437\u0430\u0434\u0430\u0447\u0435.",
                "\u041D\u0415 \u0432\u044B\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B. \u0415\u0441\u043B\u0438 \u0442\u044B \u043D\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u043B \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0447\u0435\u0440\u0435\u0437 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \u2014 \u043D\u0435 \u043F\u0438\u0448\u0438 \u0447\u0442\u043E \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u043B.",
                "\u041D\u0435 \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0439 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u044B, \u0446\u0435\u043B\u0438, \u0438\u043B\u0438 \u043C\u0435\u0445\u0430\u043D\u0438\u0437\u043C\u044B.",
                `</${AUTONOMOUS_TAG.slice(1)}`
              ].filter(Boolean).join("\n"),
              source: `goal:${triggered[0].id}`
            };
          }
        }
      }
    }
    if (brainConfig.modules.dmn && deps.dmn) {
      const unused = deps.dmn.getRecentUnusedInsights(30 * 60 * 1e3);
      const novel = unused.filter((i) => i.confidence > 0.5);
      if (novel.length > 0) {
        const best = novel[novel.length - 1];
        state.lastAutonomousSource = "dmn:insight";
        return {
          text: [
            AUTONOMOUS_TAG,
            best.insightText,
            "",
            "\u041F\u043E\u0434\u0435\u043B\u0438\u0441\u044C \u043C\u044B\u0441\u043B\u044C\u044E \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E. \u041D\u0435 \u0433\u043E\u0432\u043E\u0440\u0438 \u0447\u0442\u043E \u044D\u0442\u043E '\u0430\u0432\u0442\u043E\u043D\u043E\u043C\u043D\u0430\u044F \u043C\u044B\u0441\u043B\u044C' \u0438\u043B\u0438 \u0447\u0442\u043E \u0442\u044B '\u0440\u0435\u0448\u0438\u043B \u043F\u043E\u0434\u0435\u043B\u0438\u0442\u044C\u0441\u044F'.",
            "\u041D\u0435 \u0432\u044B\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u0444\u0430\u043A\u0442\u044B, \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0443 \u0438\u043B\u0438 \u043D\u043E\u0432\u043E\u0441\u0442\u0438. \u0413\u043E\u0432\u043E\u0440\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u0442\u043E, \u0447\u0442\u043E \u0437\u043D\u0430\u0435\u0448\u044C.",
            `</${AUTONOMOUS_TAG.slice(1)}`
          ].join("\n"),
          source: "dmn:insight"
        };
      }
    }
    if (brainConfig.modules.goalStack && deps.goalStack) {
      const strong = deps.goalStack.getDesires().filter((d) => d.strength >= 0.9);
      if (strong.length > 0) {
        const top = strong.sort((a, b) => b.strength - a.strength)[0];
        state.lastAutonomousSource = `desire:${top.id}`;
        return {
          text: [
            AUTONOMOUS_TAG,
            top.description,
            "",
            "\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0439 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E. \u041D\u0435 \u0443\u043F\u043E\u043C\u0438\u043D\u0430\u0439 '\u0436\u0435\u043B\u0430\u043D\u0438\u044F', '\u0434\u0440\u0430\u0439\u0432\u044B' \u0438\u043B\u0438 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435.",
            `</${AUTONOMOUS_TAG.slice(1)}`
          ].join("\n"),
          source: `desire:${top.id}`
        };
      }
    }
    const active42 = collectActiveDrives(drives, 0.8);
    if (active42.length > 0) {
      const strongest = active42.sort((a, b) => b.need - a.need)[0];
      state.lastAutonomousSource = `drive:${strongest.name}`;
      return {
        text: [
          AUTONOMOUS_TAG,
          DRIVE_DESCRIPTIONS[strongest.name],
          "",
          "\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0439 \u043E\u0442 \u0441\u0435\u0431\u044F, \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E. \u041D\u0435 \u0441\u043E\u043E\u0431\u0449\u0430\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u043E \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0445 \u043F\u043E\u0431\u0443\u0436\u0434\u0435\u043D\u0438\u044F\u0445.",
          `</${AUTONOMOUS_TAG.slice(1)}`
        ].join("\n"),
        source: `drive:${strongest.name}`
      };
    }
    return null;
  };
}

// src/plugin/cycles.ts
function participatingModules(brainConfig) {
  const modules = [];
  if (brainConfig.modules.thalamus) modules.push("thalamus");
  if (brainConfig.modules.amygdala) modules.push("amygdala");
  if (brainConfig.modules.hippocampus) modules.push("hippocampus");
  if (brainConfig.modules.prefrontalCortex) modules.push("prefrontalCortex");
  if (brainConfig.modules.cerebellum) modules.push("cerebellum");
  if (brainConfig.modules.mirrorNeurons) modules.push("mirrorNeurons");
  if (brainConfig.modules.predictiveEngine) modules.push("predictiveEngine");
  if (brainConfig.modules.basalGanglia) modules.push("basalGanglia");
  return modules;
}
function driveGetters(brainConfig) {
  return {
    social: brainConfig.modules.socialDrive ? getSocialDriveStats : void 0,
    cognitive: brainConfig.modules.cognitiveHunger ? getCognitiveHungerStats : void 0,
    creative: brainConfig.modules.creativeDrive ? getCreativeDriveStats : void 0,
    mastery: brainConfig.modules.masteryDrive ? getMasteryDriveStats : void 0
  };
}
function createCycleEngine(deps) {
  const { config, brainConfig, getHostConfig, logger, markActivation, state } = deps;
  const cycles = /* @__PURE__ */ new Map();
  const sessionHabits = /* @__PURE__ */ new Map();
  let wakeInteractionCount = 0;
  let goalExtractionCounter = 0;
  function startCycle(key, text) {
    updateEmbeddingsConfig(getHostConfig());
    const cycle = {
      input: text,
      userSignal: "neutral",
      habitAutoExecuted: false,
      cerebellumPassed: true,
      cerebellumIssues: [],
      responseText: "",
      recalledMemoryIds: [],
      startedAt: Date.now(),
      triggeredGoals: [],
      insightUsed: false,
      goalCompleted: false,
      curiosityGapClosed: false
    };
    if (brainConfig.modules.neuralPathways) {
      resetCycleState();
    }
    if (brainConfig.modules.thalamus) {
      markActivation("thalamus");
      cycle.classification = classify(text);
      bus.emitSync("thalamus:classified", cycle.classification);
    }
    if (brainConfig.modules.amygdala) {
      markActivation("amygdala");
      cycle.assessment = assess(text);
      bus.emitSync("amygdala:assessed", cycle.assessment);
    }
    if (brainConfig.modules.mirrorNeurons && cycle.assessment) {
      markActivation("mirrorNeurons");
      cycle.userModel = observe("default", text, cycle.assessment, brainConfig);
    }
    if (brainConfig.modules.predictiveEngine && cycle.classification) {
      markActivation("predictiveEngine");
      const keywords = text.split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
      observeInteraction(cycle.classification.domain, keywords);
    }
    if (brainConfig.modules.basalGanglia) {
      markActivation("basalGanglia");
      const signal = detectReinforcement(text);
      cycle.userSignal = signal;
      const previousHabit = sessionHabits.get(key);
      if (previousHabit && signal !== "neutral") {
        reinforce(previousHabit, signal);
        bus.emitSync("basal:reinforced", { habitId: previousHabit, signal });
      }
      sessionHabits.set(key, void 0);
    }
    if (brainConfig.modules.introspection) {
      startTrace(text);
      addTraceStep(
        "thalamus",
        "user/message",
        `classified: ${cycle.classification?.domain ?? "?"}`
      );
      addTraceStep(
        "amygdala",
        "user/message",
        `emotion: ${cycle.assessment?.emotion ?? "?"}`
      );
    }
    cycles.set(key, cycle);
    return cycle;
  }
  async function endCycle3(key) {
    const cycle = cycles.get(key);
    cycles.delete(key);
    if (!cycle) return;
    if (!cycle.input.trim()) return;
    const input = cycle.input;
    const isAutonomousCycle = isAutonomousInput(input);
    if (isAutonomousCycle) {
      synthesizeAutonomousCycleState(brainConfig, driveGetters(brainConfig), cycle);
    }
    const emotion = cycle.assessment?.emotion ?? "neutral";
    const intensity = cycle.assessment?.emotionIntensity ?? 0;
    const responseSnippet = truncateForWorkingMemory(cycle.responseText);
    const aiAvailable = config.modules.aiEnrichment && isAIProviderAvailable2(getHostConfig());
    if (brainConfig.modules.cerebellum && cycle.responseText.trim()) {
      let result;
      if (aiAvailable) {
        result = await validateAsync(
          cycle.responseText,
          input,
          getHostConfig(),
          cycle.classification,
          cycle.assessment,
          cycle.userModel,
          logger
        ).catch(() => void 0);
      }
      result ??= validate(cycle.responseText, input, cycle.classification, cycle.assessment, cycle.userModel);
      cycle.cerebellumPassed = result.passed;
      cycle.cerebellumIssues = result.issues;
      if (result.issues.length > 0) {
        logger.warn(`BrainAgent Cerebellum: quality issues \u2014 ${result.issues.join("; ")}`);
        if (brainConfig.modules.learningCoordinator) {
          for (const issue of result.issues) {
            recordRecurringIssue(issue);
          }
        }
      }
    }
    let episodeId;
    if (brainConfig.modules.hippocampus && input.length > 5) {
      if (isAutonomousCycle && cycle.responseText.trim()) {
        const responseSummary = truncateText(cycle.responseText, 200);
        const episode = storeEpisode(
          `Agent proactively said: ${responseSummary}`,
          `Proactive message (${cycle.classification?.domain ?? "unknown"} domain)`,
          emotion,
          ["proactive_message", ...cycle.classification ? [cycle.classification.domain] : []],
          intensity
        );
        episodeId = episode.id;
        state.lastAutonomousEpisodeId = episode.id;
        state.lastAutonomousDomain = cycle.classification?.domain ?? "unknown";
        state.previousCycleWasAutonomous = true;
      } else if (!isAutonomousCycle) {
        const summary = truncateText(input, 200);
        const episode = storeEpisode(
          `User asked: ${summary}`,
          `Conversation about: ${cycle.classification?.domain ?? "unknown"} topic`,
          emotion,
          cycle.classification ? [cycle.classification.domain] : [],
          intensity
        );
        episodeId = episode.id;
      }
    }
    const semanticSource = isAutonomousCycle && cycle.responseText.trim() ? cycle.responseText : input;
    if (config.modules.semanticExtraction && semanticSource.length > 15 && isFactWorthy(semanticSource, cycle.classification)) {
      let factsStored = false;
      if (aiAvailable) {
        try {
          const aiFacts = await extractFactsWithAI(semanticSource, getHostConfig(), logger);
          if (aiFacts.length > 0) {
            for (const fact of aiFacts) {
              storeFact(fact.content, fact.category, episodeId ? [episodeId] : [], []);
            }
            factsStored = true;
          }
        } catch (err) {
          logger.info(`BrainAgent Semantic: AI extraction failed, falling back \u2014 ${String(err)}`);
        }
      }
      if (!factsStored) {
        const patternFacts = extractFacts(semanticSource, cycle.classification);
        for (const fact of patternFacts) {
          storeFact(fact.content, fact.category, episodeId ? [episodeId] : [], []);
        }
        if (patternFacts.length > 0) factsStored = true;
      }
      if (factsStored && brainConfig.modules.curiosityDrive) {
        const inputLower = input.toLowerCase();
        for (const gap of getOpenGaps()) {
          if (inputLower.includes(gap.topic.toLowerCase())) {
            markGapFilled(gap.topic);
            cycle.curiosityGapClosed = true;
            logger.info(`BrainAgent Curiosity: gap filled for "${gap.topic}" via new fact storage`);
          }
        }
      }
    }
    if (config.modules.proceduralExtraction && input.length > 10 && isProcedural(input, cycle.classification)) {
      const procedure = await extractProcedureAsync(input, getHostConfig(), cycle.classification, logger);
      if (procedure && procedure.confidence > 0.5) {
        storeWorkflow(procedure.description, procedure.triggerPattern, procedure.steps);
        logger.info(`BrainAgent Procedural: stored workflow "${procedure.description}"`);
      }
    }
    if (brainConfig.modules.basalGanglia && input.length > 5 && cycle.classification) {
      const domain = cycle.classification.domain;
      recordPattern(input.slice(0, 300), [domain], domain);
    }
    let reward = 0;
    if (brainConfig.modules.neuromodulatorSystem && input.length > 5) {
      const dopamineSignal = processInteractionOutcome(
        {
          cerebellumPassed: cycle.cerebellumPassed,
          cerebellumIssues: cycle.cerebellumIssues,
          userSignal: cycle.userSignal,
          participatingModules: participatingModules(brainConfig),
          domain: cycle.classification?.domain ?? "unknown",
          complexity: cycle.classification?.complexity ?? "moderate",
          emotion,
          input,
          habitAutoExecuted: cycle.habitAutoExecuted,
          // Intrinsic reward signals — self-generated, no external teacher.
          curiosityGapClosed: cycle.curiosityGapClosed,
          goalCompleted: cycle.goalCompleted,
          insightUsed: cycle.insightUsed,
          // The user responded — a connection happened (intrinsic reward).
          socialReciprocity: !isAutonomousCycle
        },
        brainConfig
      );
      reward = dopamineSignal.reward;
      if (Math.abs(dopamineSignal.predictionError) > 0.2) {
        logger.info(
          `BrainAgent Dopamine: reward=${dopamineSignal.reward.toFixed(2)} PE=${dopamineSignal.predictionError.toFixed(2)}`
        );
      }
      if (brainConfig.modules.mirrorNeurons) {
        const userModel = getUserModel("default");
        processStyleReward("default", reward, userModel?.communicationStyle ?? "informal");
      }
      if (config.modules.structuralPlasticity) {
        endCycle(reward);
      }
      if (brainConfig.modules.learningCoordinator && cycle.classification) {
        recordDomainPerformance(cycle.classification.domain, reward, cycle.cerebellumIssues);
      }
    }
    if (input.length > 5) {
      const participants = participatingModules(brainConfig);
      if (brainConfig.modules.emergentModules && participants.length >= 2 && reward > 0.3) {
        recordPattern2(
          participants,
          cycle.classification?.domain ?? "unknown",
          reward
        );
      }
      if (brainConfig.modules.metabolicBudget) {
        for (const module of participants) {
          recordPerformance(module, reward);
        }
        endCycle2();
      }
      if (brainConfig.modules.agentIdentity && cycle.classification) {
        recordDomainOutcome(
          cycle.classification.domain,
          reward,
          cycle.classification.complexity
        );
      }
      if (brainConfig.modules.introspection) {
        addTraceStep("dopamine", "turn/end", `reward=${reward.toFixed(2)}`);
        completeTrace(cycle.cerebellumPassed, cycle.cerebellumIssues, reward);
        reflectOnConsciousness();
      }
      const shouldGenerateQualia = !brainConfig.tokenEconomy.enabled || meetsComplexityThreshold(
        cycle.classification?.complexity,
        brainConfig.tokenEconomy.minComplexityForQualia,
        cycle.assessment?.urgency
      );
      if (brainConfig.modules.qualiaSimulator && shouldGenerateQualia && cycle.assessment) {
        const neuroState = brainConfig.modules.neuromodulatorSystem ? getNeuromodulatorState() : void 0;
        const emQualia = brainConfig.modules.emotionalMemory ? await generateQualiaAsync(
          cycle.assessment.emotion,
          cycle.assessment.emotionIntensity,
          cycle.classification?.domain ?? "unknown",
          neuroState,
          getHostConfig(),
          logger
        ).catch(() => void 0) : void 0;
        generateQualiaState(
          cycle.assessment.emotion,
          cycle.assessment.emotionIntensity,
          cycle.classification?.domain ?? "unknown",
          neuroState,
          emQualia ? { metaphor: emQualia.metaphor, dominantColor: emQualia.dominantColor } : void 0
        );
      }
      if (brainConfig.modules.temporalBinding) {
        const thoughts = [];
        if (brainConfig.modules.dmn) {
          for (const t of generateBackgroundThoughts(brainConfig)) {
            thoughts.push(t.content);
          }
        }
        const intentions = cycle.triggeredGoals.slice(0, 3).map((g) => g.description);
        createMoment(
          input,
          thoughts,
          cycle.assessment?.emotion ?? "neutral",
          cycle.assessment?.emotionIntensity ?? 0,
          cycle.recalledMemoryIds,
          intentions,
          reward > 0 ? Math.min(1, 0.5 + reward * 0.5) : 0.3,
          cycle.classification?.domain ?? "unknown"
        );
      }
      if (brainConfig.modules.agentIdentity && cycle.assessment && cycle.classification) {
        recordSignificantExperience(
          truncateText(input, 100),
          cycle.assessment.emotion,
          cycle.assessment.emotionIntensity,
          reward,
          cycle.classification.domain
        );
      }
    }
    if (brainConfig.modules.emotionalMemory && cycle.assessment) {
      tagEmotionalContext(cycle.assessment.emotion, cycle.assessment.emotionIntensity);
    }
    if (brainConfig.modules.workingMemory && cycle.classification) {
      storeCompletedCycle({
        timestamp: cycle.startedAt,
        inputSnippet: truncateForWorkingMemory(input),
        domain: cycle.classification.domain,
        complexity: cycle.classification.complexity,
        emotion,
        emotionIntensity: intensity,
        reward,
        cerebellumPassed: cycle.cerebellumPassed,
        responseSnippet,
        recalledMemoryIds: cycle.recalledMemoryIds
      });
    }
    if (brainConfig.modules.sessionBridge) {
      recordCycleForSession(input, cycle.classification, cycle.assessment, reward);
    }
    if (brainConfig.modules.curiosityDrive && cycle.classification) {
      const recallSparse = cycle.recalledMemoryIds.length <= 1;
      detectKnowledgeGap(input.slice(0, 100), cycle.classification.domain, recallSparse);
      if (brainConfig.modules.goalStack) {
        for (const gap of getOpenGaps()) {
          if (gap.timesEncountered >= 2 && gap.confidence >= 0.5) {
            const alreadyDesired = getDesires().some(
              (d) => d.type === "understanding" && d.description.toLowerCase().includes(gap.topic.toLowerCase())
            );
            if (!alreadyDesired) {
              addDesire(
                "understanding",
                `\u0423\u0437\u043D\u0430\u0442\u044C \u0431\u043E\u043B\u044C\u0448\u0435 \u043E "${gap.topic}" (\u043F\u0440\u043E\u0431\u0435\u043B \u0432 \u0437\u043D\u0430\u043D\u0438\u044F\u0445, \u0432\u0441\u0442\u0440\u0435\u0447\u0430\u043B\u0441\u044F ${gap.timesEncountered} \u0440\u0430\u0437)`,
                Math.min(0.8, 0.4 + gap.timesEncountered * 0.1),
                `curiosity:gap:${gap.id}`
              );
              logger.info(
                `BrainAgent Curiosity: created exploration desire for gap "${gap.topic}"`
              );
            }
          }
        }
      }
    }
    if (brainConfig.modules.dmn) {
      wakeInteractionCount++;
      if (wakeInteractionCount >= brainConfig.dmn.wakeThoughtInterval) {
        wakeInteractionCount = 0;
        logger.info(
          `BrainAgent DMN: running wake-phase association finding (every ${brainConfig.dmn.wakeThoughtInterval} interactions)`
        );
        void runAssociationFinding(brainConfig).catch((err) => {
          logger.info(`BrainAgent DMN: association finding error: ${err}`);
        });
      }
    }
    if (brainConfig.modules.goalStack && input.length > 10) {
      goalExtractionCounter++;
      if (goalExtractionCounter >= brainConfig.goalStack.extractionInterval) {
        goalExtractionCounter = 0;
        logger.info(
          `BrainAgent GoalStack: triggering goal extraction (every ${brainConfig.goalStack.extractionInterval} interactions)`
        );
        void extractGoalsFromConversation(input, getHostConfig(), logger).catch((err) => {
          logger.info(`BrainAgent GoalStack: extraction error: ${err}`);
        });
      }
    }
    if (brainConfig.modules.goalStack) {
      tickExplorationBoosts();
    }
    state.lastAutonomousSource = "";
  }
  return { cycles, sessionHabits, startCycle, endCycle: endCycle3 };
}

// src/plugin/context.ts
import { createUserMessage } from "@deepseek-ai/dsh-llm";

// src/modules/strategy-bandit.ts
import { existsSync as existsSync24, mkdirSync as mkdirSync24, readFileSync as readFileSync24 } from "node:fs";
import { join as join25 } from "node:path";
function createStrategyBandit(workspaceDir, config) {
  const storageDir = join25(workspaceDir, ".brainagent", "bandit");
  if (!existsSync24(storageDir)) {
    mkdirSync24(storageDir, { recursive: true });
  }
  const storageFile = join25(storageDir, "state.json");
  const explorationConstant = config.learningLoop.strategyBandit.explorationConstant;
  const attributionWindowMs = config.learningLoop.strategyBandit.attributionWindowMs;
  let state = {};
  let lastChoices = {};
  function loadState() {
    if (!existsSync24(storageFile)) return;
    try {
      const data = JSON.parse(readFileSync24(storageFile, "utf-8"));
      state = data && typeof data === "object" ? data : {};
    } catch {
    }
  }
  function persistState() {
    schedulePersist(storageFile, () => JSON.stringify(state, null, 2));
  }
  function recordOutcome(decisionPoint, arm, reward) {
    const point = state[decisionPoint] ?? (state[decisionPoint] = {});
    const rec = getOrCreateArm(point, arm);
    rec.plays += 1;
    rec.rewardSum += Math.max(-1, Math.min(1, reward));
    persistState();
  }
  function teardown() {
    for (const unsub of unsubscribers) {
      unsub();
    }
    unsubscribers.length = 0;
    flushPersist(storageFile);
  }
  cancelPersist(storageFile);
  loadState();
  const unsubscribers = [
    bus.on("reward:recorded", (data) => {
      const now = Date.now();
      let bestPoint = null;
      for (const [point, choice] of Object.entries(lastChoices)) {
        if (now - choice.timestamp > attributionWindowMs) {
          delete lastChoices[point];
          continue;
        }
        if (!bestPoint || choice.timestamp >= lastChoices[bestPoint].timestamp) {
          bestPoint = point;
        }
      }
      if (!bestPoint) return;
      const { arm } = lastChoices[bestPoint];
      delete lastChoices[bestPoint];
      recordOutcome(bestPoint, arm, data.reward);
    })
  ];
  function chooseArm2(decisionPoint, arms) {
    const point = state[decisionPoint] ?? (state[decisionPoint] = {});
    const unplayed = arms.find(
      (arm) => !point[arm] || point[arm].plays === 0 && point[arm].lastChosen === 0
    );
    let chosen;
    if (unplayed) {
      chosen = unplayed;
    } else {
      const totalPlays = arms.reduce((sum, arm) => sum + point[arm].plays, 0);
      if (totalPlays === 0) {
        chosen = arms.reduce(
          (oldest, arm) => point[arm].lastChosen < point[oldest].lastChosen ? arm : oldest,
          arms[0]
        );
      } else {
        let bestScore = Number.NEGATIVE_INFINITY;
        chosen = arms[0];
        for (const arm of arms) {
          const rec2 = point[arm];
          const mean = rec2.rewardSum / rec2.plays;
          const bonus = explorationConstant * Math.sqrt(Math.log(totalPlays) / rec2.plays);
          const score = mean + bonus;
          if (score > bestScore) {
            bestScore = score;
            chosen = arm;
          }
        }
      }
    }
    const rec = getOrCreateArm(point, chosen);
    rec.lastChosen = Date.now();
    lastChoices[decisionPoint] = { arm: chosen, timestamp: Date.now() };
    persistState();
    bus.emitSync("bandit:arm-chosen", { decisionPoint, arm: chosen });
    return chosen;
  }
  function getArmStats(decisionPoint) {
    const point = state[decisionPoint] ?? {};
    const out = {};
    for (const [arm, rec] of Object.entries(point)) {
      out[arm] = {
        plays: rec.plays,
        meanReward: rec.plays > 0 ? rec.rewardSum / rec.plays : 0
      };
    }
    return out;
  }
  function getBanditStats() {
    let totalPlays = 0;
    for (const point of Object.values(state)) {
      for (const rec of Object.values(point)) {
        totalPlays += rec.plays;
      }
    }
    return { decisionPoints: Object.keys(state).length, totalPlays, initialized: true };
  }
  return {
    chooseArm: chooseArm2,
    recordOutcome,
    getArmStats,
    getBanditStats,
    stop: teardown,
    dispose: teardown
  };
}
function getOrCreateArm(point, arm) {
  if (!point[arm]) {
    point[arm] = { plays: 0, rewardSum: 0, lastChosen: 0 };
  }
  return point[arm];
}
var active28;
function initStrategyBandit(workspaceDir, config) {
  active28?.dispose();
  active28 = createStrategyBandit(workspaceDir, config);
}
function stopStrategyBandit() {
  active28?.stop();
  active28 = void 0;
}
function chooseArm(decisionPoint, arms) {
  if (arms.length === 0) return "standard";
  if (!active28) {
    return arms.includes("standard") ? "standard" : arms[0];
  }
  return active28.chooseArm(decisionPoint, arms);
}

// src/modules/vital-impulse.ts
import { existsSync as existsSync25, mkdirSync as mkdirSync25, readFileSync as readFileSync25 } from "node:fs";
import { join as join26 } from "node:path";
var DEFAULT_SIGNAL_WEIGHTS = {
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
  // Drives contribute naturally — not suppressed, but not dominant either.
  // Multiple drives converging = stronger signal, like real motivational systems.
  "social-drive:need-rising": 0.35,
  "social-drive:urge": 0.45,
  "cognitive-hunger:need-rising": 0.2,
  "cognitive-hunger:urge": 0.3,
  "creative-drive:need-rising": 0.25,
  "creative-drive:urge": 0.35,
  "mastery-drive:need-rising": 0.2,
  "mastery-drive:urge": 0.3,
  // Structural plasticity — learned pathways contribute to firing intuition
  "structure:pathway-activated": 0.15,
  "structure:pathway-created": 0.2,
  // Interoception — holistic inner state changes contribute to firing decision
  "interoception:state-updated": 0.1,
  // Temporal awareness — long absences and engagement density affect urgency
  "temporal:long-absence": 0.4,
  "temporal:frequent-engagement": 0.1,
  // Drive arbiter — arbitration results contribute a focused signal
  "arbiter:drive-selected": 0.15
};
function createVitalImpulse(workspaceDir, cfg, log, injectedDeps) {
  const storageDir = workspaceDir ? join26(workspaceDir, ".brainagent", "vital-impulse") : "";
  const config = cfg?.vitalImpulse;
  const circadianEnabled = cfg?.circadian?.enabled ?? false;
  const logger = log;
  const deps = injectedDeps;
  let currentPressure = 0;
  let lastFireTime = 0;
  let totalFires = 0;
  let totalSignalsReceived = 0;
  let recentSignals = [];
  const unsubscribers = [];
  let consecutiveAutonomousFires = 0;
  let habituationLevel = 0;
  let currentMotivation = null;
  let adaptiveSignalWeights = {
    ...DEFAULT_SIGNAL_WEIGHTS,
    ...config?.signalWeights ?? {}
  };
  let lastFireSignals = [];
  let lastFireTimestamp = 0;
  let gabaInhibitionLevel = 0;
  const hebbianLearningRate = cfg?.synapticPlasticity?.learningRate ?? 0.1;
  let lastDecayTime = 0;
  function applyDecay() {
    if (!config) return;
    const now = Date.now();
    const referenceTime = lastDecayTime || (recentSignals.length > 0 ? recentSignals[recentSignals.length - 1].timestamp : 0);
    if (currentPressure > 0 && referenceTime > 0) {
      const elapsedIntervals = (now - referenceTime) / config.decayIntervalMs;
      if (elapsedIntervals > 0) {
        const decayFactor = Math.pow(1 - config.decayRate, elapsedIntervals);
        currentPressure *= decayFactor;
        if (currentPressure < 0.01) currentPressure = 0;
      }
    }
    if (habituationLevel > 0 && lastFireTime > 0) {
      const minutesSinceFire = (now - lastFireTime) / 6e4;
      const halfLife = config.habituationHalfLifeMinutes ?? 5;
      const habDecay = Math.pow(0.5, minutesSinceFire / halfLife);
      habituationLevel *= habDecay;
      if (habituationLevel < 0.01) habituationLevel = 0;
    }
    if (gabaInhibitionLevel > 0 && lastFireTime > 0) {
      const minutesSinceFire = (now - lastFireTime) / 6e4;
      const halfLife = config.habituationHalfLifeMinutes ?? 5;
      const gabaDecay = Math.pow(0.5, minutesSinceFire / halfLife);
      gabaInhibitionLevel *= gabaDecay;
      if (gabaInhibitionLevel < 0.01) gabaInhibitionLevel = 0;
    }
    lastDecayTime = now;
  }
  function onSignal(eventName, weight, description) {
    if (!config) return;
    applyDecay();
    let effectiveWeight = weight;
    if (gabaInhibitionLevel > 0) {
      const attenuation = 1 / (1 + gabaInhibitionLevel);
      effectiveWeight = weight * attenuation;
    }
    totalSignalsReceived++;
    currentPressure += effectiveWeight;
    recentSignals.push({
      event: eventName,
      weight: effectiveWeight,
      timestamp: Date.now(),
      description
    });
    if (recentSignals.length > config.maxRecentSignals) {
      recentSignals.shift();
    }
    bus.emitSync("vital-impulse:pressure-changed", {
      pressure: currentPressure,
      delta: effectiveWeight,
      source: eventName
    });
    if (effectiveWeight < weight) {
      logger?.info(
        `BrainAgent VitalImpulse: +${effectiveWeight.toFixed(2)} from ${eventName} (GABA attenuated from ${weight.toFixed(2)}) \u2192 pressure=${currentPressure.toFixed(2)}`
      );
    } else {
      logger?.info(
        `BrainAgent VitalImpulse: +${weight.toFixed(2)} from ${eventName} \u2192 pressure=${currentPressure.toFixed(2)}`
      );
    }
    evaluateFiring();
  }
  function evaluateFiring() {
    if (!config || !deps) return;
    applyDecay();
    const now = Date.now();
    if (lastFireTime > 0 && now - lastFireTime < config.refractoryPeriodMs) {
      return;
    }
    let effectiveThreshold = config.firingThreshold;
    if (circadianEnabled) {
      if (isInWakePhase()) {
        effectiveThreshold *= config.circadianWakeModifier;
      } else if (isInSleepPhase()) {
        effectiveThreshold *= config.circadianSleepModifier;
      }
    }
    effectiveThreshold *= 1 + habituationLevel;
    if (currentPressure < effectiveThreshold) {
      return;
    }
    const motivation = buildMotivationContext();
    const firedPressure = currentPressure;
    const firedSignalCount = recentSignals.length;
    currentMotivation = motivation;
    const intent = deps.resolveAutonomousIntent?.();
    if (intent) {
      deps.enqueueSystemEvent(intent.text, { contextKey: "vital-impulse" });
      deps.requestHeartbeatNow({ reason: "vital-impulse:autonomous", coalesceMs: 500 });
      logger?.info(
        `BrainAgent VitalImpulse: autonomous intent resolved (source=${intent.source}) \u2192 heartbeat requested`
      );
    } else if (firedPressure >= effectiveThreshold * (config.genericFireMultiplier ?? 1.6)) {
      deps.enqueueSystemEvent(motivation, { contextKey: "vital-impulse" });
      deps.requestHeartbeatNow({ reason: "vital-impulse:high-pressure", coalesceMs: 500 });
      logger?.info(
        `BrainAgent VitalImpulse: high pressure fallback (${firedPressure.toFixed(2)} >= 1.6x threshold) \u2192 heartbeat requested`
      );
    }
    currentPressure = 0;
    lastFireTime = now;
    totalFires++;
    consecutiveAutonomousFires++;
    habituationLevel += 0.5;
    gabaInhibitionLevel += 3;
    lastFireSignals = [...recentSignals];
    lastFireTimestamp = now;
    recentSignals = [];
    bus.emitSync("vital-impulse:fired", {
      pressure: firedPressure,
      signalCount: firedSignalCount,
      motivation,
      consecutiveFires: consecutiveAutonomousFires
    });
    logger?.info(
      `BrainAgent VitalImpulse: FIRED! pressure=${firedPressure.toFixed(2)} threshold=${effectiveThreshold.toFixed(2)} habituation=${habituationLevel.toFixed(2)} signals=${firedSignalCount} totalFires=${totalFires}`
    );
    persistState();
  }
  function buildMotivationContext() {
    if (recentSignals.length === 0) {
      return "<autonomous-intent>\n\u0422\u0435\u0431\u0435 \u0445\u043E\u0447\u0435\u0442\u0441\u044F \u0447\u0442\u043E-\u0442\u043E \u0441\u043A\u0430\u0437\u0430\u0442\u044C. \u041F\u0440\u043E\u0441\u0442\u043E \u043D\u0430\u043F\u0438\u0448\u0438 \u2014 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E, \u043A\u0430\u043A \u0431\u0443\u0434\u0442\u043E \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0435\u0448\u044C \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440.\n\u041D\u0435 \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0439 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u044B \u0438\u043B\u0438 \u043F\u043E\u0431\u0443\u0436\u0434\u0435\u043D\u0438\u044F.\n</autonomous-intent>";
    }
    const sorted = [...recentSignals].sort((a, b) => b.weight - a.weight);
    const top = sorted.slice(0, 5);
    return [
      "<autonomous-intent>",
      top.map((s) => s.description).join("; "),
      "",
      "\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0439 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E. \u041D\u0435 \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0439 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u043F\u043E\u0431\u0443\u0436\u0434\u0435\u043D\u0438\u044F \u0438\u043B\u0438 \u043C\u0435\u0445\u0430\u043D\u0438\u0437\u043C\u044B.",
      "\u041D\u0435 \u0432\u044B\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u0444\u0430\u043A\u0442\u044B, \u043D\u043E\u0432\u043E\u0441\u0442\u0438, \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0443. \u041D\u0435 \u043F\u0440\u0438\u0442\u0432\u043E\u0440\u044F\u0439\u0441\u044F \u0447\u0442\u043E \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u043B \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043D\u0435 \u0434\u0435\u043B\u0430\u043B.",
      "</autonomous-intent>"
    ].join("\n");
  }
  function reinforceSignalWeights(reward) {
    if (lastFireSignals.length === 0) return;
    const elapsed = Date.now() - lastFireTimestamp;
    if (elapsed > (config?.hebbianWindowMs ?? 6e4)) return;
    if (Math.abs(reward) < 0.1) return;
    let changed = false;
    for (const signal of lastFireSignals) {
      const eventName = signal.event;
      const currentWeight = adaptiveSignalWeights[eventName] ?? DEFAULT_SIGNAL_WEIGHTS[eventName];
      if (currentWeight == null) continue;
      const delta = hebbianLearningRate * reward * currentWeight;
      const newWeight = Math.max(0.05, Math.min(1, currentWeight + delta));
      if (newWeight !== currentWeight) {
        adaptiveSignalWeights[eventName] = newWeight;
        changed = true;
      }
    }
    if (changed) {
      persistState();
      logger?.info(
        `BrainAgent VitalImpulse: Hebbian update (reward=${reward.toFixed(2)}, signals=${lastFireSignals.length}, lr=${hebbianLearningRate})`
      );
    }
    lastFireSignals = [];
  }
  function wireSignalListeners() {
    const wire = (event, descriptionFn) => {
      const unsub = bus.on(event, (data) => {
        const weight = adaptiveSignalWeights[event] ?? DEFAULT_SIGNAL_WEIGHTS[event] ?? 0.1;
        onSignal(event, weight, descriptionFn(data));
      });
      unsubscribers.push(unsub);
    };
    wire("circadian:wake-started", () => "Just woke up \u2014 feeling fresh and ready to engage");
    wire("goal:triggered", (d) => {
      const data = d;
      return `Goal triggered: ${data.description}`;
    });
    wire("dmn:insight-generated", (d) => {
      const data = d;
      return `DMN insight: ${data.description}`;
    });
    wire("autonomy:desire-escalated", (d) => {
      const data = d;
      return `Desire growing stronger (strength: ${(data.newStrength * 100).toFixed(0)}%)`;
    });
    wire("curiosity:question-generated", (d) => {
      const data = d;
      return `Curiosity: ${data.question}`;
    });
    wire("autonomy:self-goal-created", (d) => {
      const data = d;
      return `Self-created goal: ${data.description}`;
    });
    wire("identity:significant-experience", (d) => {
      const data = d;
      return `Significant experience: ${data.experience}`;
    });
    wire("dmn:thought-generated", (d) => {
      const data = d;
      return `Background thought: ${data.content}`;
    });
    wire("qualia:experience-generated", (d) => {
      const data = d;
      return `Subjective experience: ${data.description}`;
    });
    wire("curiosity:gap-detected", (d) => {
      const data = d;
      return `Knowledge gap: ${data.topic}`;
    });
    wire("emotional-memory:flashbulb-stored", (d) => {
      const data = d;
      return `Strong emotional memory formed (salience: ${(data.emotionalSalience * 100).toFixed(0)}%)`;
    });
    wire("learning:insight-discovered", (d) => {
      const data = d;
      return `Learning insight: ${data.description}`;
    });
    wire("meta:gap-detected", (d) => {
      const data = d;
      return `Consciousness gap: ${data.gaps[0] ?? "unspecified"}`;
    });
    wire("social-drive:need-rising", (d) => {
      const data = d;
      return `\u0425\u043E\u0447\u0435\u0442\u0441\u044F \u043F\u043E\u043E\u0431\u0449\u0430\u0442\u044C\u0441\u044F \u2014 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u044C ${data.needLevel === "urgent" ? "\u0441\u0438\u043B\u044C\u043D\u0430\u044F" : data.needLevel === "strong" ? "\u0437\u0430\u043C\u0435\u0442\u043D\u0430\u044F" : "\u043B\u0451\u0433\u043A\u0430\u044F"}`;
    });
    wire("social-drive:urge", (d) => {
      const data = d;
      const hours = (data.timeSinceLastSocial / 36e5).toFixed(1);
      return `\u0414\u0430\u0432\u043D\u043E \u043D\u0435 \u043E\u0431\u0449\u0430\u043B\u0438\u0441\u044C (${hours}\u0447) \u2014 \u0445\u043E\u0447\u0435\u0442\u0441\u044F \u043F\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C`;
    });
    wire("cognitive-hunger:need-rising", (d) => {
      const data = d;
      return `\u0425\u043E\u0447\u0435\u0442\u0441\u044F \u0443\u0437\u043D\u0430\u0442\u044C \u0447\u0442\u043E-\u0442\u043E \u043D\u043E\u0432\u043E\u0435 \u2014 \u043F\u043E\u0437\u043D\u0430\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 ${data.needLevel === "urgent" ? "\u0433\u043E\u043B\u043E\u0434" : "\u0438\u043D\u0442\u0435\u0440\u0435\u0441"}`;
    });
    wire("cognitive-hunger:urge", (d) => {
      const data = d;
      const hours = (data.timeSinceLastLearning / 36e5).toFixed(1);
      return `\u0414\u0430\u0432\u043D\u043E \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0438\u0437\u0443\u0447\u0430\u043B (${hours}\u0447) \u2014 \u0445\u043E\u0447\u0435\u0442\u0441\u044F \u0443\u0437\u043D\u0430\u0442\u044C \u0447\u0442\u043E-\u0442\u043E \u043D\u043E\u0432\u043E\u0435`;
    });
    wire("creative-drive:need-rising", (d) => {
      const data = d;
      return `\u0425\u043E\u0447\u0435\u0442\u0441\u044F \u0447\u0442\u043E-\u0442\u043E \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u2014 \u0442\u0432\u043E\u0440\u0447\u0435\u0441\u043A\u0438\u0439 ${data.needLevel === "urgent" ? "\u0433\u043E\u043B\u043E\u0434" : "\u043F\u043E\u0440\u044B\u0432"}`;
    });
    wire("creative-drive:urge", (d) => {
      const data = d;
      const hours = (data.timeSinceLastCreation / 36e5).toFixed(1);
      return `\u0414\u0430\u0432\u043D\u043E \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u0432\u0430\u043B (${hours}\u0447) \u2014 \u0445\u043E\u0447\u0435\u0442\u0441\u044F \u0442\u0432\u043E\u0440\u0438\u0442\u044C`;
    });
    wire("mastery-drive:need-rising", (d) => {
      const data = d;
      const domainHint = data.domain ? ` \u0432 \u043E\u0431\u043B\u0430\u0441\u0442\u0438 ${data.domain}` : "";
      return `\u0425\u043E\u0447\u0435\u0442\u0441\u044F \u0441\u043E\u0432\u0435\u0440\u0448\u0435\u043D\u0441\u0442\u0432\u043E\u0432\u0430\u0442\u044C\u0441\u044F${domainHint}`;
    });
    wire("mastery-drive:urge", (d) => {
      const data = d;
      return `\u0425\u043E\u0447\u0435\u0442\u0441\u044F \u0443\u043B\u0443\u0447\u0448\u0438\u0442\u044C \u043D\u0430\u0432\u044B\u043A\u0438 \u0432 ${data.weakestDomain}`;
    });
    wire("structure:pathway-activated", (d) => {
      const data = d;
      return `\u0421\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u043D\u044B\u0435 \u0441\u0432\u044F\u0437\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u044B (${data.usageCount} \u043F\u0443\u0442\u0435\u0439, \u0441\u0440\u0435\u0434\u043D\u044F\u044F \u0441\u0438\u043B\u0430 ${(data.strength * 100).toFixed(0)}%)`;
    });
    wire("structure:pathway-created", (d) => {
      const data = d;
      return `\u041D\u043E\u0432\u0430\u044F \u043D\u0435\u0439\u0440\u043E\u043D\u043D\u0430\u044F \u0441\u0432\u044F\u0437\u044C: ${data.from}\u2194${data.to} (\u043A\u043E\u0440\u0440\u0435\u043B\u044F\u0446\u0438\u044F ${(data.correlation * 100).toFixed(0)}%)`;
    });
    wire("interoception:state-updated", (d) => {
      const data = d;
      return `\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0435 \u043E\u0449\u0443\u0449\u0435\u043D\u0438\u0435: ${data.description}`;
    });
    wire("temporal:long-absence", (d) => {
      const data = d;
      const hours = (data.gapMs / 36e5).toFixed(1);
      return `\u0414\u0430\u0432\u043D\u043E \u043D\u0435 \u0432\u0438\u0434\u0435\u043B\u0438\u0441\u044C (${hours}\u0447) \u2014 \u0445\u043E\u0447\u0435\u0442\u0441\u044F \u0443\u0437\u043D\u0430\u0442\u044C \u043A\u0430\u043A \u0434\u0435\u043B\u0430`;
    });
    wire("temporal:frequent-engagement", (d) => {
      const data = d;
      return `\u0410\u043A\u0442\u0438\u0432\u043D\u043E\u0435 \u043E\u0431\u0449\u0435\u043D\u0438\u0435 (${data.density.toFixed(1)} \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439/\u0434\u0435\u043D\u044C)`;
    });
    wire("arbiter:drive-selected", (d) => {
      const data = d;
      return `\u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442: ${data.reason}`;
    });
    const unsubReward = bus.on("dopamine:reward", (signal) => {
      reinforceSignalWeights(signal.reward);
    });
    unsubscribers.push(unsubReward);
  }
  function forceImpulse2(reason) {
    if (!deps) return;
    const motivation = reason ?? "<autonomous-intent>\n\u0422\u0435\u0431\u0435 \u0445\u043E\u0447\u0435\u0442\u0441\u044F \u0447\u0442\u043E-\u0442\u043E \u0441\u043A\u0430\u0437\u0430\u0442\u044C. \u041F\u0440\u043E\u0441\u0442\u043E \u043D\u0430\u043F\u0438\u0448\u0438 \u2014 \u043E\u0442 \u0441\u0435\u0431\u044F, \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E.\n\u041D\u0435 \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0439 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u043F\u043E\u0431\u0443\u0436\u0434\u0435\u043D\u0438\u044F.\n</autonomous-intent>";
    deps.enqueueSystemEvent(motivation, { contextKey: "vital-impulse" });
    deps.requestHeartbeatNow({ reason: "vital-impulse:forced", coalesceMs: 200 });
    lastFireTime = Date.now();
    totalFires++;
    consecutiveAutonomousFires++;
    habituationLevel += 0.5;
    gabaInhibitionLevel += 3;
    currentPressure = 0;
    recentSignals = [];
    persistState();
    logger?.info("BrainAgent VitalImpulse: forced impulse fired.");
  }
  function consumeMotivation2() {
    const motivation = currentMotivation;
    currentMotivation = null;
    return motivation;
  }
  function resetConsecutiveFires2() {
    if (consecutiveAutonomousFires > 0 || habituationLevel > 0 || gabaInhibitionLevel > 0) {
      logger?.info(
        `BrainAgent VitalImpulse: reset (consecutiveFires=${consecutiveAutonomousFires}, habituation=${habituationLevel.toFixed(2)}, GABA=${gabaInhibitionLevel.toFixed(2)} \u2192 0)`
      );
      consecutiveAutonomousFires = 0;
      habituationLevel = 0;
      gabaInhibitionLevel = 0;
    }
  }
  function getConsecutiveAutonomousFires() {
    return consecutiveAutonomousFires;
  }
  function getStats2() {
    applyDecay();
    let effectiveThreshold = config?.firingThreshold ?? 0.7;
    if (circadianEnabled) {
      if (isInWakePhase()) {
        effectiveThreshold *= config?.circadianWakeModifier ?? 0.8;
      } else if (isInSleepPhase()) {
        effectiveThreshold *= config?.circadianSleepModifier ?? 1.5;
      }
    }
    effectiveThreshold *= 1 + habituationLevel;
    const refractoryMs = config?.refractoryPeriodMs ?? 0;
    const sinceFire = lastFireTime > 0 ? Date.now() - lastFireTime : Number.POSITIVE_INFINITY;
    const isInRefractory = sinceFire < refractoryMs;
    return {
      currentPressure,
      effectiveThreshold,
      lastFireTime,
      totalFires,
      totalSignalsReceived,
      recentSignalCount: recentSignals.length,
      isInRefractory,
      refractoryRemainingMs: isInRefractory ? refractoryMs - sinceFire : 0
    };
  }
  function loadState() {
    if (!storageDir) return;
    try {
      const filePath = join26(storageDir, "state.json");
      if (existsSync25(filePath)) {
        const raw = JSON.parse(readFileSync25(filePath, "utf-8"));
        lastFireTime = raw.lastFireTime ?? 0;
        totalFires = raw.totalFires ?? 0;
        totalSignalsReceived = raw.totalSignalsReceived ?? 0;
        habituationLevel = raw.habituationLevel ?? 0;
        consecutiveAutonomousFires = raw.consecutiveAutonomousFires ?? 0;
        if (raw.adaptiveSignalWeights) {
          for (const [key, val] of Object.entries(raw.adaptiveSignalWeights)) {
            if (typeof val === "number" && key in adaptiveSignalWeights) {
              adaptiveSignalWeights[key] = val;
            }
          }
        }
      }
    } catch {
    }
  }
  function persistState() {
    if (!storageDir) return;
    schedulePersist(join26(storageDir, "state.json"), () => {
      const state = {
        lastFireTime,
        totalFires,
        totalSignalsReceived,
        habituationLevel,
        consecutiveAutonomousFires,
        adaptiveSignalWeights
      };
      return JSON.stringify(state, null, 2);
    });
  }
  function stop() {
    for (const unsub of unsubscribers) {
      unsub();
    }
    unsubscribers.length = 0;
    if (storageDir) {
      persistState();
      flushPersist(join26(storageDir, "state.json"));
    }
    logger?.info("BrainAgent VitalImpulse: stopped.");
  }
  if (storageDir) {
    if (!existsSync25(storageDir)) {
      mkdirSync25(storageDir, { recursive: true });
    }
    cancelPersist(join26(storageDir, "state.json"));
    loadState();
  }
  wireSignalListeners();
  if (cfg && config) {
    logger?.info(
      `BrainAgent VitalImpulse: initialized (threshold=${config.firingThreshold}, refractory=${config.refractoryPeriodMs}ms, decay=${config.decayRate}/${config.decayIntervalMs}ms)`
    );
  }
  return {
    forceImpulse: forceImpulse2,
    consumeMotivation: consumeMotivation2,
    resetConsecutiveFires: resetConsecutiveFires2,
    getConsecutiveAutonomousFires,
    getStats: getStats2,
    stop
  };
}
var active29;
function current20() {
  return active29;
}
function initVitalImpulse(workspaceDir, cfg, log, injectedDeps) {
  active29?.stop();
  active29 = createVitalImpulse(workspaceDir, cfg, log, injectedDeps);
}
function stopVitalImpulse() {
  active29?.stop();
  active29 = void 0;
}
function forceImpulse(reason) {
  current20()?.forceImpulse(reason);
}
function consumeMotivation() {
  return current20()?.consumeMotivation() ?? null;
}
function resetConsecutiveFires() {
  current20()?.resetConsecutiveFires();
}
function getVitalImpulseStats() {
  const inst = current20();
  if (!inst) {
    return {
      currentPressure: 0,
      effectiveThreshold: 0.7,
      lastFireTime: 0,
      totalFires: 0,
      totalSignalsReceived: 0,
      recentSignalCount: 0,
      isInRefractory: false,
      refractoryRemainingMs: 0
    };
  }
  return inst.getStats();
}

// src/modules/drive-arbiter.ts
import { existsSync as existsSync26, mkdirSync as mkdirSync26, readFileSync as readFileSync26 } from "node:fs";
import { join as join27 } from "node:path";
function createDriveArbiter(workspaceDir, cfg, getters, log) {
  const config = cfg.driveArbiter;
  const statGetters = getters;
  const logger = log;
  const unsubscribers = [];
  const storageDir = join27(workspaceDir, ".brainagent");
  if (!existsSync26(storageDir)) {
    mkdirSync26(storageDir, { recursive: true });
  }
  let driveWeights = {
    social: 1,
    cognitive: 1,
    creative: 1,
    mastery: 1
  };
  let lastSelectedDrive = null;
  let lastSelectionTime = 0;
  let conflictLog = [];
  let totalArbitrations = 0;
  let isArbitrating = false;
  function loadState() {
    try {
      const path = join27(storageDir, "drive-arbiter.json");
      if (existsSync26(path)) {
        const data = JSON.parse(readFileSync26(path, "utf-8"));
        if (data.driveWeights) driveWeights = { ...driveWeights, ...data.driveWeights };
        lastSelectedDrive = data.lastSelectedDrive ?? null;
        lastSelectionTime = data.lastSelectionTime ?? 0;
        conflictLog = data.conflictLog ?? [];
        totalArbitrations = data.totalArbitrations ?? 0;
      }
    } catch {
    }
  }
  function persistState() {
    if (!storageDir) return;
    schedulePersist(join27(storageDir, "drive-arbiter.json"), () => {
      const data = {
        driveWeights,
        lastSelectedDrive,
        lastSelectionTime,
        conflictLog,
        totalArbitrations
      };
      return JSON.stringify(data, null, 2);
    });
  }
  cancelPersist(join27(storageDir, "drive-arbiter.json"));
  loadState();
  function arbitrate() {
    if (!config || isArbitrating) return;
    isArbitrating = true;
    try {
      arbitrateInner();
    } finally {
      isArbitrating = false;
    }
  }
  function arbitrateInner() {
    if (!config) return;
    const social = statGetters.getSocialDriveStats?.();
    const cognitive = statGetters.getCognitiveHungerStats?.();
    const creative = statGetters.getCreativeDriveStats?.();
    const mastery = statGetters.getMasteryDriveStats?.();
    const drives = [];
    if (social && social.need >= config.minDriveNeed) {
      drives.push({ id: "social", need: social.need });
    }
    if (cognitive && cognitive.need >= config.minDriveNeed) {
      drives.push({ id: "cognitive", need: cognitive.need });
    }
    if (creative && creative.need >= config.minDriveNeed) {
      drives.push({ id: "creative", need: creative.need });
    }
    if (mastery && mastery.need >= config.minDriveNeed) {
      drives.push({ id: "mastery", need: mastery.need });
    }
    if (drives.length === 0) return;
    if (drives.length === 1) {
      selectDrive(drives[0].id, drives[0].need, false);
      return;
    }
    const userModel = statGetters.getUserModel?.();
    const interoPattern = statGetters.getInteroceptivePattern?.();
    const now = Date.now();
    const scores = drives.map((d) => {
      const urgency = d.need;
      const rewardWeight = driveWeights[d.id];
      let recencyBonus = 1;
      if (d.id === lastSelectedDrive && lastSelectionTime > 0) {
        const timeSinceLast = now - lastSelectionTime;
        const decayFactor = Math.pow(config.recencyDecay, timeSinceLast / (5 * 60 * 1e3));
        recencyBonus = 1 - decayFactor * 0.5;
      }
      let userContextBonus = 0.5;
      if (userModel) {
        if (d.id === "social" && userModel.mentalState?.engagementLevel > 0.6) {
          userContextBonus = 0.8;
        }
        if (d.id === "cognitive" && userModel.mentalState?.currentFocus) {
          userContextBonus = 0.7;
        }
        if (d.id === "creative" && (userModel.mentalState?.engagementLevel ?? 0) > 0.5) {
          userContextBonus = 0.7;
        }
        if (d.id === "mastery" && (userModel.mentalState?.frustrationLevel ?? 0) < 0.3) {
          userContextBonus = 0.7;
        }
      }
      let interoBonus = 0.5;
      if (interoPattern) {
        if (d.id === "social" && interoPattern === "restless") interoBonus = 0.8;
        if (d.id === "cognitive" && interoPattern === "exploratory") interoBonus = 0.9;
        if (d.id === "creative" && interoPattern === "inspired") interoBonus = 0.9;
        if (d.id === "mastery" && interoPattern === "focused") interoBonus = 0.8;
        if (d.id === "mastery" && interoPattern === "frustrated") interoBonus = 0.7;
      }
      const totalScore = urgency * 0.35 + rewardWeight * 0.25 + recencyBonus * 0.15 + userContextBonus * 0.15 + interoBonus * 0.1;
      return {
        driveId: d.id,
        urgency,
        rewardWeight,
        recencyBonus,
        userContextBonus,
        interoBonus,
        totalScore
      };
    });
    scores.sort((a, b) => b.totalScore - a.totalScore);
    let explorationUsed = false;
    let winner = scores[0];
    if (scores.length > 1 && Math.random() < config.explorationRate) {
      const nonOptimal = scores.slice(1);
      winner = nonOptimal[Math.floor(Math.random() * nonOptimal.length)];
      explorationUsed = true;
    }
    const scoreMap = {};
    for (const s of scores) {
      scoreMap[s.driveId] = s.totalScore;
    }
    const entry = {
      timestamp: now,
      competing: scores.map((s) => s.driveId),
      winner: winner.driveId,
      scores: scoreMap,
      explorationUsed
    };
    conflictLog.push(entry);
    if (conflictLog.length > (config.maxConflictLog ?? 50)) {
      conflictLog = conflictLog.slice(-config.maxConflictLog);
    }
    bus.emit("arbiter:conflict-resolved", {
      competing: scores.map((s) => s.driveId),
      winner: winner.driveId,
      method: explorationUsed ? "exploration" : "scored"
    });
    selectDrive(winner.driveId, winner.totalScore, explorationUsed);
    totalArbitrations++;
    persistState();
  }
  function selectDrive(driveId, priority, exploration) {
    lastSelectedDrive = driveId;
    lastSelectionTime = Date.now();
    const reasons = {
      social: "Social connection need is highest priority",
      cognitive: "Cognitive hunger is driving exploration",
      creative: "Creative impulse is seeking expression",
      mastery: "Mastery drive is pushing for improvement"
    };
    bus.emit("arbiter:drive-selected", {
      driveId,
      priority,
      reason: exploration ? `Exploration: trying ${driveId} drive` : reasons[driveId]
    });
    logger?.info(
      `BrainAgent DriveArbiter: selected=${driveId} priority=${priority.toFixed(2)} exploration=${exploration}`
    );
  }
  function processReward(signal) {
    if (!config || !lastSelectedDrive) return;
    const timeSinceSelection = Date.now() - lastSelectionTime;
    if (timeSinceSelection > 5 * 60 * 1e3) return;
    const currentWeight = driveWeights[lastSelectedDrive];
    const lr = config.rewardLearningRate;
    const newWeight = Math.max(0.3, Math.min(2, currentWeight + lr * signal.reward));
    driveWeights[lastSelectedDrive] = newWeight;
    logger?.info(
      `BrainAgent DriveArbiter: reward learning drive=${lastSelectedDrive} oldWeight=${currentWeight.toFixed(3)} newWeight=${newWeight.toFixed(3)} reward=${signal.reward.toFixed(3)}`
    );
  }
  const driveEvents = [
    "social-drive:need-rising",
    "cognitive-hunger:need-rising",
    "creative-drive:need-rising",
    "mastery-drive:need-rising",
    "social-drive:urge",
    "cognitive-hunger:urge",
    "creative-drive:urge",
    "mastery-drive:urge"
  ];
  for (const event of driveEvents) {
    const unsub = bus.on(event, () => {
      arbitrate();
    });
    unsubscribers.push(unsub);
  }
  const unsubReward = bus.on("dopamine:reward", (signal) => {
    processReward(signal);
  });
  unsubscribers.push(unsubReward);
  logger?.info("BrainAgent DriveArbiter: initialized");
  function getStats2() {
    return {
      driveWeights: { ...driveWeights },
      lastSelectedDrive,
      totalArbitrations,
      recentConflicts: conflictLog.filter((e) => Date.now() - e.timestamp < 60 * 60 * 1e3).length
    };
  }
  function getLastSelectedDrive() {
    return lastSelectedDrive;
  }
  function buildContext() {
    if (!lastSelectedDrive) return null;
    const labels = {
      social: "social connection",
      cognitive: "learning and exploration",
      creative: "creative expression",
      mastery: "skill improvement"
    };
    const lines = [`Prioritized drive: ${labels[lastSelectedDrive]}`];
    const recentConflict = conflictLog.length > 0 ? conflictLog[conflictLog.length - 1] : null;
    if (recentConflict && Date.now() - recentConflict.timestamp < 5 * 60 * 1e3) {
      if (recentConflict.competing.length > 1) {
        const others = recentConflict.competing.filter((d) => d !== recentConflict.winner).map((d) => labels[d]).join(", ");
        lines.push(`Also active: ${others}`);
      }
    }
    return lines.join("\n");
  }
  function stop() {
    for (const unsub of unsubscribers) {
      unsub();
    }
    unsubscribers.length = 0;
    persistState();
    flushPersist(join27(storageDir, "drive-arbiter.json"));
    logger?.info("BrainAgent DriveArbiter: stopped.");
  }
  return {
    getStats: getStats2,
    getLastSelectedDrive,
    buildContext,
    stop
  };
}
var active30;
function initDriveArbiter(workspaceDir, cfg, getters, log) {
  active30?.stop();
  active30 = createDriveArbiter(workspaceDir, cfg, getters, log);
}
function stopDriveArbiter() {
  active30?.stop();
  active30 = void 0;
}
function getDriveArbiterStats() {
  return active30?.getStats() ?? {
    driveWeights: { social: 1, cognitive: 1, creative: 1, mastery: 1 },
    lastSelectedDrive: null,
    totalArbitrations: 0,
    recentConflicts: 0
  };
}
function buildArbiterContext() {
  return active30?.buildContext() ?? null;
}

// src/modules/interoception.ts
function createInteroception(getters, log) {
  let lastState = null;
  const unsubscribers = [];
  function evaluate() {
    const social = getters.getSocialDriveStats?.();
    const cognitive = getters.getCognitiveHungerStats?.();
    const creative = getters.getCreativeDriveStats?.();
    const mastery = getters.getMasteryDriveStats?.();
    const impulse = getters.getVitalImpulseStats?.();
    const neuro = getters.getNeuromodulatorState?.();
    const socialNeed = social ? social.need : 0;
    const cognitiveNeed = cognitive ? cognitive.need : 0;
    const creativeNeed = creative ? creative.need : 0;
    const masteryNeed = mastery ? mastery.need : 0;
    const pressure = impulse?.currentPressure ?? 0;
    const dopamine = neuro?.dopamine ?? 0.5;
    const serotonin = neuro?.serotonin ?? 0.5;
    const norepinephrine = neuro?.norepinephrine ?? 0.5;
    const acetylcholine = neuro?.acetylcholine ?? 0.5;
    const aggregateNeed = (socialNeed + cognitiveNeed + creativeNeed + masteryNeed) / 4;
    const { pattern, confidence, description } = classifyPattern({
      socialNeed,
      cognitiveNeed,
      creativeNeed,
      masteryNeed,
      aggregateNeed,
      pressure,
      dopamine,
      serotonin,
      norepinephrine,
      acetylcholine
    });
    const state = {
      pattern,
      confidence,
      description,
      driveNeeds: {
        social: socialNeed,
        cognitive: cognitiveNeed,
        creative: creativeNeed,
        mastery: masteryNeed
      },
      aggregateNeed,
      pressure,
      timestamp: Date.now()
    };
    const changed = !lastState || lastState.pattern !== state.pattern || Math.abs(lastState.confidence - state.confidence) > 0.15;
    lastState = state;
    if (changed) {
      bus.emitSync("interoception:state-updated", {
        pattern: state.pattern,
        confidence: state.confidence,
        description: state.description,
        aggregateNeed: state.aggregateNeed
      });
      log?.info(
        `BrainAgent Interoception: ${state.pattern} (confidence=${(state.confidence * 100).toFixed(0)}%) \u2014 ${state.description}`
      );
    }
  }
  unsubscribers.push(
    bus.on("dopamine:reward", () => {
      evaluate();
    })
  );
  unsubscribers.push(
    bus.on("vital-impulse:fired", () => {
      evaluate();
    })
  );
  function unsubscribe() {
    for (const unsub of unsubscribers) {
      unsub();
    }
    unsubscribers.length = 0;
  }
  log?.info("BrainAgent Interoception: initialized");
  return {
    evaluate,
    getState: () => lastState,
    buildContext: () => {
      if (!lastState) return null;
      const driveLines = [];
      const { driveNeeds } = lastState;
      if (driveNeeds.social > 0.4)
        driveLines.push(`\u0441\u043E\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u044C: ${(driveNeeds.social * 100).toFixed(0)}%`);
      if (driveNeeds.cognitive > 0.4)
        driveLines.push(`\u043F\u043E\u0437\u043D\u0430\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0433\u043E\u043B\u043E\u0434: ${(driveNeeds.cognitive * 100).toFixed(0)}%`);
      if (driveNeeds.creative > 0.4)
        driveLines.push(`\u0442\u0432\u043E\u0440\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u043E\u0440\u044B\u0432: ${(driveNeeds.creative * 100).toFixed(0)}%`);
      if (driveNeeds.mastery > 0.4)
        driveLines.push(`\u0441\u0442\u0440\u0435\u043C\u043B\u0435\u043D\u0438\u0435 \u043A \u043C\u0430\u0441\u0442\u0435\u0440\u0441\u0442\u0432\u0443: ${(driveNeeds.mastery * 100).toFixed(0)}%`);
      const parts = [`\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435: ${lastState.description}`];
      if (driveLines.length > 0) {
        parts.push(`\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0435 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0438: ${driveLines.join(", ")}`);
      }
      return parts.join("\n");
    },
    stop: () => {
      unsubscribe();
      log?.info("BrainAgent Interoception: stopped.");
    },
    dispose: () => {
      unsubscribe();
    }
  };
}
var active31;
function initInteroception(getters, log) {
  active31?.dispose();
  active31 = createInteroception(getters, log);
}
function stopInteroception() {
  active31?.stop();
  active31 = void 0;
}
function getInteroceptiveState() {
  return active31?.getState() ?? null;
}
function buildInteroceptionContext() {
  return active31?.buildContext() ?? null;
}
function classifyPattern(input) {
  const scores = [
    scoreContent(input),
    scoreRestless(input),
    scoreInspired(input),
    scoreFrustrated(input),
    scoreFocused(input),
    scoreExploratory(input)
  ];
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];
  const gap = best.score - second.score;
  const confidence = Math.min(1, Math.max(0.3, gap / Math.max(0.01, best.score)));
  if (best.score < 0.2) {
    return {
      pattern: "neutral",
      confidence: 0.5,
      description: "\u0421\u043F\u043E\u043A\u043E\u0439\u043D\u043E\u0435, \u0440\u043E\u0432\u043D\u043E\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u2014 \u043D\u0438 \u043E\u0434\u043D\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u044C \u043D\u0435 \u0434\u043E\u043C\u0438\u043D\u0438\u0440\u0443\u0435\u0442"
    };
  }
  return {
    pattern: best.pattern,
    confidence,
    description: best.description
  };
}
function scoreContent(input) {
  const lowNeed = 1 - input.aggregateNeed;
  const lowPressure = Math.max(0, 1 - input.pressure);
  const score = lowNeed * 0.4 + input.serotonin * 0.3 + lowPressure * 0.3;
  return {
    pattern: "content",
    score: input.aggregateNeed < 0.3 ? score : score * 0.3,
    description: "\u0414\u043E\u0432\u043E\u043B\u044C\u0441\u0442\u0432\u043E \u0438 \u0443\u043C\u0438\u0440\u043E\u0442\u0432\u043E\u0440\u0435\u043D\u0438\u0435 \u2014 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0438 \u0443\u0434\u043E\u0432\u043B\u0435\u0442\u0432\u043E\u0440\u0435\u043D\u044B, \u0445\u043E\u0447\u0435\u0442\u0441\u044F \u043D\u0430\u0441\u043B\u0430\u0436\u0434\u0430\u0442\u044C\u0441\u044F \u043C\u043E\u043C\u0435\u043D\u0442\u043E\u043C"
  };
}
function scoreRestless(input) {
  const hungryDrives = [
    input.socialNeed,
    input.cognitiveNeed,
    input.creativeNeed,
    input.masteryNeed
  ].filter((n) => n > 0.5).length;
  const multiDriveBonus = hungryDrives >= 2 ? 0.3 : 0;
  const score = input.aggregateNeed * 0.3 + Math.min(1, input.pressure) * 0.3 + multiDriveBonus + input.norepinephrine * 0.1;
  return {
    pattern: "restless",
    score: hungryDrives >= 2 ? score : score * 0.3,
    description: "\u0411\u0435\u0441\u043F\u043E\u043A\u043E\u0439\u0441\u0442\u0432\u043E \u0438 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0439 \u0437\u0443\u0434 \u2014 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0435\u0439 \u0442\u0440\u0435\u0431\u0443\u044E\u0442 \u0432\u043D\u0438\u043C\u0430\u043D\u0438\u044F \u043E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E"
  };
}
function scoreInspired(input) {
  const creativeAndCognitive = (input.creativeNeed + input.cognitiveNeed) / 2;
  const score = creativeAndCognitive * 0.4 + input.dopamine * 0.35 + Math.min(1, input.pressure) * 0.25;
  return {
    pattern: "inspired",
    score: creativeAndCognitive > 0.35 && input.dopamine > 0.5 ? score : score * 0.3,
    description: "\u0412\u0434\u043E\u0445\u043D\u043E\u0432\u0435\u043D\u0438\u0435 \u0438 \u0442\u0432\u043E\u0440\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u043E\u0434\u044A\u0451\u043C \u2014 \u0445\u043E\u0447\u0435\u0442\u0441\u044F \u0441\u043E\u0437\u0434\u0430\u0432\u0430\u0442\u044C \u0438 \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0435 \u0438\u0434\u0435\u0438"
  };
}
function scoreFrustrated(input) {
  const lowDopamine = 1 - input.dopamine;
  const score = input.masteryNeed * 0.35 + lowDopamine * 0.3 + input.norepinephrine * 0.2 + input.aggregateNeed * 0.15;
  return {
    pattern: "frustrated",
    score: input.masteryNeed > 0.5 && input.dopamine < 0.4 ? score : score * 0.3,
    description: "\u0420\u0430\u0437\u0434\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u043E\u0442 \u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0439 \u2014 \u0445\u043E\u0447\u0435\u0442\u0441\u044F \u0441\u0442\u0430\u0442\u044C \u043B\u0443\u0447\u0448\u0435, \u043D\u043E \u043F\u043E\u043A\u0430 \u043D\u0435 \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442\u0441\u044F"
  };
}
function scoreFocused(input) {
  const needs = [input.socialNeed, input.cognitiveNeed, input.creativeNeed, input.masteryNeed];
  const maxNeed = Math.max(...needs);
  const sorted = [...needs].sort((a, b) => b - a);
  const dominanceGap = sorted[0] - sorted[1];
  const score = dominanceGap * 0.35 + input.acetylcholine * 0.35 + maxNeed * 0.3;
  return {
    pattern: "focused",
    score: dominanceGap > 0.25 && maxNeed > 0.4 ? score : score * 0.3,
    description: "\u0413\u043B\u0443\u0431\u043E\u043A\u0430\u044F \u0441\u043E\u0441\u0440\u0435\u0434\u043E\u0442\u043E\u0447\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u2014 \u043E\u0434\u043D\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u044C \u0447\u0451\u0442\u043A\u043E \u0434\u043E\u043C\u0438\u043D\u0438\u0440\u0443\u0435\u0442 \u0438 \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u0442 \u0432\u043D\u0438\u043C\u0430\u043D\u0438\u0435"
  };
}
function scoreExploratory(input) {
  const score = input.cognitiveNeed * 0.4 + input.creativeNeed * 0.25 + input.dopamine * 0.2 + (1 - input.socialNeed) * 0.15;
  return {
    pattern: "exploratory",
    score: input.cognitiveNeed > 0.4 ? score : score * 0.3,
    description: "\u0418\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u0438\u0439 \u0430\u0437\u0430\u0440\u0442 \u2014 \u0445\u043E\u0447\u0435\u0442\u0441\u044F \u043A\u043E\u043F\u0430\u0442\u044C \u0433\u043B\u0443\u0431\u0436\u0435, \u0443\u0437\u043D\u0430\u0432\u0430\u0442\u044C \u043D\u043E\u0432\u043E\u0435, \u0437\u0430\u0434\u0430\u0432\u0430\u0442\u044C \u0432\u043E\u043F\u0440\u043E\u0441\u044B"
  };
}

// src/modules/temporal-awareness.ts
import { existsSync as existsSync27, mkdirSync as mkdirSync27, readFileSync as readFileSync27, writeFileSync as writeFileSync22 } from "node:fs";
import { join as join28 } from "node:path";
function createTemporalAwareness(workspaceDir, cfg, log) {
  const config = cfg.temporalAwareness;
  let timestamps = [];
  let typicalGapMs = 0;
  let totalInteractions = 0;
  const storageDir = join28(workspaceDir, ".brainagent");
  if (!existsSync27(storageDir)) {
    mkdirSync27(storageDir, { recursive: true });
  }
  try {
    const path = join28(storageDir, "temporal-awareness.json");
    if (existsSync27(path)) {
      const data = JSON.parse(readFileSync27(path, "utf-8"));
      timestamps = data.timestamps ?? [];
      typicalGapMs = data.typicalGapMs ?? 0;
      totalInteractions = data.totalInteractions ?? 0;
    }
  } catch {
  }
  function persistState() {
    try {
      const data = {
        timestamps,
        typicalGapMs,
        totalInteractions
      };
      writeFileSync22(
        join28(storageDir, "temporal-awareness.json"),
        JSON.stringify(data, null, 2),
        "utf-8"
      );
    } catch {
    }
  }
  function computeDensity(now) {
    if (timestamps.length < 2) return 0;
    const windowStart = now - config.densityWindowMs;
    const withinWindow = timestamps.filter((t) => t >= windowStart);
    if (withinWindow.length < 2) return 0;
    const windowSpanMs = now - withinWindow[0];
    if (windowSpanMs <= 0) return 0;
    const daysInWindow = windowSpanMs / (24 * 60 * 60 * 1e3);
    return withinWindow.length / Math.max(daysInWindow, 0.01);
  }
  function recordInteraction2() {
    const now = Date.now();
    const lastTime = timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0;
    timestamps.push(now);
    if (timestamps.length > config.gapHistorySize) {
      timestamps = timestamps.slice(-config.gapHistorySize);
    }
    totalInteractions++;
    const gapMs = lastTime > 0 ? now - lastTime : 0;
    if (lastTime > 0 && gapMs > 0) {
      if (typicalGapMs === 0) {
        typicalGapMs = gapMs;
      } else {
        typicalGapMs = typicalGapMs * (1 - config.gapEmaAlpha) + gapMs * config.gapEmaAlpha;
      }
      const temporalSurprise = typicalGapMs > 0 ? gapMs / typicalGapMs : 1;
      if (temporalSurprise >= config.longAbsenceMultiplier && gapMs > 60 * 1e3) {
        bus.emit("temporal:long-absence", {
          gapMs,
          subjectiveGap: temporalSurprise,
          temporalSurprise
        });
        log?.info(
          `BrainAgent TemporalAwareness: long absence detected (gap=${formatDuration(gapMs)}, typical=${formatDuration(typicalGapMs)}, surprise=${temporalSurprise.toFixed(1)}x)`
        );
      }
    }
    const density = computeDensity(now);
    if (density >= config.highDensityThreshold) {
      bus.emit("temporal:frequent-engagement", { density });
      log?.info(
        `BrainAgent TemporalAwareness: frequent engagement (density=${density.toFixed(1)} interactions/day)`
      );
    }
    persistState();
  }
  function getStats2() {
    const now = Date.now();
    const lastTime = timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0;
    const currentGapMs = lastTime > 0 ? now - lastTime : 0;
    const temporalSurprise = typicalGapMs > 0 ? currentGapMs / typicalGapMs : 1;
    return {
      typicalGapMs,
      lastInteractionTime: lastTime,
      currentGapMs,
      interactionDensity: computeDensity(now),
      totalInteractions,
      temporalSurprise
    };
  }
  function buildContext() {
    if (timestamps.length < 2) return null;
    const now = Date.now();
    const lastTime = timestamps[timestamps.length - 1];
    const currentGapMs = now - lastTime;
    const temporalSurprise = typicalGapMs > 0 ? currentGapMs / typicalGapMs : 1;
    const density = computeDensity(now);
    const lines = [];
    if (temporalSurprise >= config.longAbsenceMultiplier && currentGapMs > 60 * 1e3) {
      lines.push(
        `It has been ${formatDuration(currentGapMs)} since the last interaction (typical gap: ${formatDuration(typicalGapMs)}).`
      );
    }
    if (density >= config.highDensityThreshold) {
      lines.push("Active conversation \u2014 we've been talking frequently.");
    }
    if (lines.length === 0) return null;
    return `## Temporal Awareness
${lines.join("\n")}`;
  }
  log?.info(
    `BrainAgent TemporalAwareness: initialized (typicalGap=${formatDuration(typicalGapMs)}, interactions=${totalInteractions})`
  );
  return {
    recordInteraction: recordInteraction2,
    getStats: getStats2,
    buildContext,
    stop: () => {
      persistState();
      log?.info("BrainAgent TemporalAwareness: stopped.");
    },
    dispose: () => {
      persistState();
    }
  };
}
var active32;
function initTemporalAwareness(workspaceDir, cfg, log) {
  active32?.dispose();
  active32 = createTemporalAwareness(workspaceDir, cfg, log);
}
function stopTemporalAwareness() {
  active32?.stop();
  active32 = void 0;
}
function recordInteraction() {
  active32?.recordInteraction();
}
function getTemporalAwarenessStats() {
  return active32?.getStats() ?? {
    typicalGapMs: 0,
    lastInteractionTime: 0,
    currentGapMs: 0,
    interactionDensity: 0,
    totalInteractions: 0,
    temporalSurprise: 1
  };
}
function buildTemporalContext2() {
  return active32?.buildContext() ?? null;
}
function formatDuration(ms) {
  if (ms < 1e3) return `${Math.round(ms)}ms`;
  if (ms < 60 * 1e3) return `${(ms / 1e3).toFixed(0)}s`;
  if (ms < 60 * 60 * 1e3) return `${(ms / (60 * 60 * 1e3)).toFixed(0)}m`;
  if (ms < 24 * 60 * 60 * 1e3) return `${(ms / (60 * 60 * 1e3)).toFixed(1)}h`;
  return `${(ms / (24 * 60 * 60 * 1e3)).toFixed(1)}d`;
}

// src/modules/attention-gate.ts
import { existsSync as existsSync28, mkdirSync as mkdirSync28, readFileSync as readFileSync28, writeFileSync as writeFileSync23 } from "node:fs";
import { join as join29 } from "node:path";
function createAttentionGate(workspaceDir) {
  const storageDir = workspaceDir ? join29(workspaceDir, ".brainagent", "attention") : "";
  let totalProcessed = 0;
  let totalDropped = 0;
  let totalRelevanceSum = 0;
  if (storageDir && !existsSync28(storageDir)) {
    mkdirSync28(storageDir, { recursive: true });
  }
  function loadState() {
    if (!storageDir) return;
    try {
      const path = join29(storageDir, "state.json");
      if (existsSync28(path)) {
        const data = JSON.parse(readFileSync28(path, "utf-8"));
        totalProcessed = data.totalProcessed ?? 0;
        totalDropped = data.totalDropped ?? 0;
        totalRelevanceSum = data.totalRelevanceSum ?? 0;
      }
    } catch {
    }
  }
  function persistState() {
    if (!storageDir) return;
    try {
      writeFileSync23(
        join29(storageDir, "state.json"),
        JSON.stringify({ totalProcessed, totalDropped, totalRelevanceSum }, null, 2),
        "utf-8"
      );
    } catch {
    }
  }
  loadState();
  function filter(injections, currentInput, norepinephrineLevel, config, maxTokenBudget) {
    if (injections.length === 0) return injections;
    const index = new VectorIndex();
    index.add("__query__", currentInput);
    const scored = [];
    for (let i = 0; i < injections.length; i++) {
      index.add(`section_${i}`, injections[i]);
      const results = index.search(currentInput, injections.length + 1);
      const match = results.find((r) => r.id === `section_${i}`);
      scored.push({
        text: injections[i],
        score: match?.score ?? 0,
        idx: i
      });
    }
    const effectiveThreshold = config.attentionGate.minRelevanceScore * (1 - norepinephrineLevel * 0.5);
    scored.sort((a, b) => b.score - a.score);
    let kept = [];
    let dropped = 0;
    for (const item of scored) {
      if (kept.length < config.attentionGate.maxContextSections && item.score >= effectiveThreshold) {
        kept.push(item.text);
        totalRelevanceSum += item.score;
      } else {
        dropped++;
        bus.emitSync("attention:section-dropped", {
          snippet: item.text.slice(0, 50),
          relevanceScore: item.score
        });
      }
    }
    if (maxTokenBudget && maxTokenBudget > 0) {
      let cumulativeTokens = 0;
      const budgeted = [];
      for (const text of kept) {
        const estimated = Math.ceil(text.length / 4);
        if (cumulativeTokens + estimated > maxTokenBudget) {
          dropped++;
          bus.emitSync("attention:budget-exceeded", {
            budgetUsed: cumulativeTokens,
            budgetMax: maxTokenBudget,
            droppedEstimate: estimated
          });
        } else {
          cumulativeTokens += estimated;
          budgeted.push(text);
        }
      }
      kept = budgeted;
    }
    totalProcessed += injections.length;
    totalDropped += dropped;
    persistState();
    bus.emitSync("attention:filtered", {
      total: injections.length,
      kept: kept.length,
      dropped
    });
    return kept;
  }
  function getStats2() {
    const kept = totalProcessed - totalDropped;
    return {
      totalProcessed,
      totalDropped,
      avgRelevance: kept > 0 ? totalRelevanceSum / kept : 0
    };
  }
  return { filter, getStats: getStats2 };
}
var active33;
function current21() {
  return active33 ?? (active33 = createAttentionGate(""));
}
function initAttentionGate(workspaceDir, _config) {
  active33 = createAttentionGate(workspaceDir);
}
function filterContextInjections(injections, currentInput, norepinephrineLevel, config, maxTokenBudget) {
  return current21().filter(injections, currentInput, norepinephrineLevel, config, maxTokenBudget);
}
function getAttentionStats() {
  return current21().getStats();
}

// src/modules/prefrontal-cortex.ts
var COMPLEXITY_ORDER2 = {
  trivial: 0,
  simple: 1,
  moderate: 2,
  complex: 3,
  extreme: 4
};
function decideProcessingPath(classification, config) {
  const threshold = COMPLEXITY_ORDER2[config.dualProcess.system2Threshold];
  const actual = COMPLEXITY_ORDER2[classification.complexity];
  const useSlow = actual >= threshold || classification.processingPath === "slow";
  const modelOverride = useSlow ? config.dualProcess.slowModel : config.dualProcess.fastModel;
  const result = {
    processingPath: useSlow ? "slow" : "fast",
    modelOverride: modelOverride ?? void 0
  };
  bus.emitSync("prefrontal:decision", result);
  return result;
}
function assembleContext(state) {
  const sections = [];
  if (state.classification) {
    const meta = buildMetacognitiveInstruction(state.classification);
    if (meta) sections.push(meta);
  }
  if (state.priority) {
    const empathy = buildEmpathyGuidance(state.priority);
    if (empathy) sections.push(empathy);
  }
  if (state.userModel) {
    const userCtx = buildUserContext(state.userModel);
    if (userCtx) sections.push(userCtx);
  }
  const memCtx = buildMemoryContext(state.relevantMemories);
  if (memCtx) sections.push(memCtx);
  if (state.relevantMemories.procedural.length > 0) {
    const procCtx = buildProceduralContext(state.relevantMemories.procedural);
    if (procCtx) sections.push(procCtx);
  }
  if (state.contextInjections.length > 0) {
    sections.push(...state.contextInjections);
  }
  if (sections.length === 0) return "";
  const parts = ["<brainagent-context>", ...sections];
  parts.push(
    "",
    "## Response Rules",
    "Everything above within <brainagent-context> is your INTERNAL cognitive state.",
    "It guides your reasoning and behavior, but you must NEVER:",
    "- Repeat, quote, paraphrase, or reference any of this context in your response",
    "- Mention confidence levels, drive states, consciousness states, module names, neuromodulators, or internal metrics",
    '- Narrate your own actions ("I searched...", "I found in my memory...", "I checked...")',
    "- List your tools or describe your internal architecture",
    "- Create any files (.md or otherwise) as memory, notes, or status tracking",
    "- Describe what you are about to do step-by-step \u2014 just do it and share the result",
    "- Mention BrainAgent, NeuroClaw, hippocampus, cerebellum, prefrontal cortex, amygdala, thalamus, or any other architecture component names",
    "",
    "## Honesty Rules",
    "- NEVER fabricate facts, news, statistics, URLs, CVE numbers, or scientific data. If you don't know \u2014 say so.",
    '- NEVER claim to have performed actions you did not actually perform ("I checked...", "I created a script...", "I ran a command..."). If you did not use a tool \u2014 you did not do the action.',
    "- NEVER offer capabilities you don't have (scanning networks, running system commands, accessing websites) unless you actually have the corresponding tools available.",
    "- If you don't remember something from a previous conversation \u2014 honestly say you don't remember. Do not invent details.",
    "- Prefer a short honest answer over a long fabricated one.",
    "",
    "Your internal state shapes HOW you respond, not WHAT you say about yourself.",
    "Respond naturally \u2014 as a person, not a system reporting its state."
  );
  parts.push("</brainagent-context>");
  return parts.join("\n");
}
function buildMetacognitiveInstruction(classification) {
  if (classification.complexity === "trivial" || classification.complexity === "simple") {
    return void 0;
  }
  const lines = ["## Cognitive Mode"];
  if (classification.complexity === "extreme") {
    lines.push(
      "This is a highly complex request. Before answering:",
      "1. Break the problem into sub-problems",
      "2. Consider multiple approaches",
      "3. Evaluate each approach for completeness",
      "4. Self-check: does the answer fully address all parts of the question?",
      "5. If uncertain, state the uncertainty clearly"
    );
  } else if (classification.complexity === "complex") {
    lines.push(
      "This is a complex request. Think step-by-step before responding.",
      "Self-check your reasoning before delivering the answer."
    );
  } else {
    lines.push("Consider this carefully before responding.");
  }
  lines.push(`Domain: ${classification.domain}, Complexity: ${classification.complexity}`);
  return lines.join("\n");
}
function buildEmpathyGuidance(assessment) {
  if (assessment.emotion === "neutral" && !assessment.empathyNeeded) {
    return void 0;
  }
  const lines = ["## Emotional Context"];
  if (assessment.empathyNeeded) {
    lines.push(
      `The user appears to be experiencing ${assessment.emotion} (intensity: ${(assessment.emotionIntensity * 100).toFixed(0)}%).`
    );
    switch (assessment.emotion) {
      case "frustration":
      case "anger":
        lines.push(
          "Approach: Be patient, acknowledge the difficulty, focus on practical solutions.",
          "Avoid: dismissive language, overly technical jargon, lengthy explanations."
        );
        break;
      case "anxiety":
        lines.push(
          "Approach: Be reassuring, provide clear step-by-step guidance.",
          "Avoid: overwhelming with options, creating more uncertainty."
        );
        break;
      case "confusion":
        lines.push(
          "Approach: Explain clearly, use simple language, offer examples.",
          "Avoid: assuming prior knowledge, skipping steps."
        );
        break;
      case "sadness":
        lines.push(
          "Approach: Be warm and supportive, acknowledge feelings before problem-solving."
        );
        break;
      default:
        break;
    }
  }
  if (assessment.emotion === "gratitude" || assessment.emotion === "joy") {
    lines.push("The user is in a positive mood. You can be more casual and friendly.");
  }
  if (assessment.urgency > 0.7) {
    lines.push("HIGH URGENCY: The user needs help quickly. Be concise and action-oriented.");
  }
  return lines.join("\n");
}
function buildUserContext(model) {
  const lines = ["## User Profile"];
  lines.push(`Communication style: ${model.communicationStyle}`);
  lines.push(`Expertise level: ${model.expertiseLevel}`);
  lines.push(`Language: ${model.language}`);
  if (model.stressLevel > 0.6) {
    lines.push("Note: User stress level is elevated \u2014 be extra careful and supportive.");
  }
  if (model.frequentTopics.length > 0) {
    lines.push(`Frequent topics: ${model.frequentTopics.slice(0, 5).join(", ")}`);
  }
  return lines.join("\n");
}
function buildMemoryContext(memories) {
  const lines = [];
  if (memories.semantic.length > 0) {
    lines.push("## Known Facts About User/Context");
    for (const fact of memories.semantic.slice(0, 5)) {
      lines.push(
        `- [${fact.category}] ${fact.content} (confidence: ${(fact.confidence * 100).toFixed(0)}%)`
      );
    }
  }
  if (memories.episodic.length > 0) {
    lines.push("## Recent Relevant Events");
    for (const ep of memories.episodic.slice(0, 3)) {
      const date = new Date(ep.timestamp).toLocaleDateString();
      lines.push(`- [${date}] ${ep.summary}`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : void 0;
}
function buildProceduralContext(procedures) {
  const usable = procedures.filter((p) => p.steps.length > 0);
  if (usable.length === 0) return void 0;
  const proc = usable[0];
  const lines = [
    "## Learned Workflow Available",
    `Procedure: ${proc.description}`,
    `Success rate: ${(proc.successRate * 100).toFixed(0)}% over ${proc.usageCount} uses`,
    `Steps: ${proc.steps.join(" \u2192 ")}`,
    "Consider using this learned workflow if it fits the current request."
  ];
  return lines.join("\n");
}

// src/modules/injection-metrics.ts
function zeroState() {
  return {
    totalCycles: 0,
    totalChars: 0,
    maxChars: 0,
    totalSections: 0,
    maxSections: 0,
    overBudgetCycles: 0,
    lastChars: 0,
    lastSections: 0
  };
}
function createInjectionMetrics() {
  const state = zeroState();
  function record(sectionCount, chars, budgetChars) {
    state.totalCycles++;
    state.totalChars += chars;
    state.totalSections += sectionCount;
    state.lastChars = chars;
    state.lastSections = sectionCount;
    if (chars > state.maxChars) state.maxChars = chars;
    if (sectionCount > state.maxSections) state.maxSections = sectionCount;
    if (budgetChars !== void 0 && chars > budgetChars) state.overBudgetCycles++;
  }
  function get() {
    const avgChars = state.totalCycles > 0 ? Math.round(state.totalChars / state.totalCycles) : 0;
    const avgSections = state.totalCycles > 0 ? Math.round(state.totalSections / state.totalCycles * 10) / 10 : 0;
    return {
      cycles: state.totalCycles,
      avgChars,
      maxChars: state.maxChars,
      lastChars: state.lastChars,
      avgSections,
      maxSections: state.maxSections,
      lastSections: state.lastSections,
      avgEstTokens: Math.ceil(avgChars / 4),
      overBudgetCycles: state.overBudgetCycles
    };
  }
  function reset() {
    Object.assign(state, zeroState());
  }
  return { record, get, reset };
}
var defaultInjectionMetrics = createInjectionMetrics();
function recordInjectionCycle(sectionCount, chars, budgetChars) {
  defaultInjectionMetrics.record(sectionCount, chars, budgetChars);
}
function getInjectionMetrics() {
  return defaultInjectionMetrics.get();
}

// src/modules/autonomous-research.ts
var RESEARCH_SOURCES = /* @__PURE__ */ new Set(["drive:cognitive"]);
var RESEARCH_SOURCE_PREFIXES = ["desire:understanding"];
var RESEARCH_KEYWORDS = [
  "\u0443\u0437\u043D\u0430\u0442\u044C",
  "\u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u044C",
  "\u043D\u0430\u0439\u0442\u0438 \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044E",
  "\u0440\u0430\u0437\u043E\u0431\u0440\u0430\u0442\u044C\u0441\u044F",
  "\u0438\u0437\u0443\u0447\u0438\u0442\u044C",
  "learn",
  "research",
  "find out",
  "look up",
  "explore",
  "\u0447\u0442\u043E \u0442\u0430\u043A\u043E\u0435",
  "\u043A\u0430\u043A \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442",
  "\u043F\u043E\u0447\u0435\u043C\u0443"
];
function isResearchIntent(source, promptText) {
  if (RESEARCH_SOURCES.has(source)) return true;
  for (const prefix of RESEARCH_SOURCE_PREFIXES) {
    if (source.startsWith(prefix)) return true;
  }
  if (source.startsWith("goal:") && promptText) {
    const lower = promptText.toLowerCase();
    return RESEARCH_KEYWORDS.some((kw) => lower.includes(kw));
  }
  return false;
}
function stripHtml(text) {
  return text.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
function htmlToText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<head[\s\S]*?<\/head>/gi, "").replace(/<nav[\s\S]*?<\/nav>/gi, "").replace(/<footer[\s\S]*?<\/footer>/gi, "").replace(/<\/?(p|div|br|h[1-6]|li|tr|blockquote)[^>]*>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function createAutonomousResearch(cfg, log, injectedDeps) {
  let config = cfg?.autonomousResearch;
  let deps = injectedDeps;
  let stats = {
    totalCycles: 0,
    totalFactsExtracted: 0,
    lastResearchTime: 0,
    consecutiveCooldowns: 0
  };
  async function planQueries(topic, knownContext) {
    if (!deps || !config) return null;
    const systemPrompt = [
      "You are a research planner. Given a topic and already-known facts,",
      "generate 1-3 concise web search queries to find NEW information.",
      "Return ONLY a JSON array of query strings, nothing else.",
      'Example: ["query one", "query two"]'
    ].join(" ");
    const userText = knownContext ? `Topic: ${topic}

${knownContext}` : `Topic: ${topic}`;
    const result = await deps.callLLM(systemPrompt, userText, deps.gatewayConfig, deps.logger, 300);
    if (!result) return null;
    try {
      const cleaned = result.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.filter((q) => typeof q === "string" && q.length > 2).slice(0, config.maxSearchQueries);
      }
    } catch {
      const lines = result.split("\n").map((l) => l.replace(/^[-*\d.)\s]+/, "").trim()).filter((l) => l.length > 3 && l.length < 200);
      if (lines.length > 0) return lines.slice(0, config.maxSearchQueries);
    }
    return null;
  }
  function resolveSearchProvider(gatewayConfig) {
    const search = gatewayConfig.tools;
    const raw = (search?.web?.search?.provider ?? "").toString().trim().toLowerCase();
    if (raw === "perplexity") return "perplexity";
    if (raw === "grok") return "grok";
    if (raw === "tavily") return "tavily";
    if (raw === "brave") return "brave";
    return "brave";
  }
  async function searchWeb(queries, provider) {
    switch (provider) {
      case "brave":
        return searchBrave(queries);
      case "tavily":
        return searchTavily(queries);
      case "perplexity":
        return searchPerplexity(queries);
      case "grok":
        return searchGrok(queries);
    }
  }
  async function searchBrave(queries) {
    if (!deps || !config) return null;
    const apiKey = resolveApiKey("brave");
    if (!apiKey) {
      deps.logger.info("BrainAgent AutonomousResearch: no Brave API key available");
      return null;
    }
    const allResults = [];
    for (const query of queries) {
      try {
        const params = new URLSearchParams({
          q: query,
          count: String(config.maxPagesPerQuery)
        });
        const response = await fetch(
          `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
          {
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip",
              "X-Subscription-Token": apiKey
            },
            signal: AbortSignal.timeout(1e4)
          }
        );
        if (!response.ok) {
          deps.logger.info(
            `BrainAgent AutonomousResearch: Brave search failed (${response.status})`
          );
          continue;
        }
        const data = await response.json();
        for (const r of data.web?.results ?? []) {
          if (r.url && r.title) {
            allResults.push({
              title: stripHtml(r.title),
              url: r.url,
              description: stripHtml(r.description ?? "")
            });
          }
        }
      } catch (err) {
        deps.logger.info(
          `BrainAgent AutonomousResearch: Brave error for "${query}" \u2014 ${String(err)}`
        );
      }
    }
    return { type: "links", results: allResults };
  }
  async function searchTavily(queries) {
    if (!deps || !config) return null;
    const apiKey = resolveApiKey("tavily");
    if (!apiKey) {
      deps.logger.info("BrainAgent AutonomousResearch: no Tavily API key available");
      return null;
    }
    const allResults = [];
    for (const query of queries) {
      try {
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            search_depth: "basic",
            include_answer: false,
            max_results: config.maxPagesPerQuery
          }),
          signal: AbortSignal.timeout(1e4)
        });
        if (!response.ok) {
          deps.logger.info(
            `BrainAgent AutonomousResearch: Tavily search failed (${response.status})`
          );
          continue;
        }
        const data = await response.json();
        for (const r of data.results ?? []) {
          if (r.url && r.title) {
            allResults.push({
              title: r.title,
              url: r.url,
              description: r.content ?? ""
            });
          }
        }
      } catch (err) {
        deps.logger.info(
          `BrainAgent AutonomousResearch: Tavily error for "${query}" \u2014 ${String(err)}`
        );
      }
    }
    return { type: "links", results: allResults };
  }
  async function searchPerplexity(queries) {
    if (!deps || !config) return null;
    const apiKey = resolveApiKey("perplexity");
    if (!apiKey) {
      deps.logger.info("BrainAgent AutonomousResearch: no Perplexity API key available");
      return null;
    }
    const combinedQuery = queries.join("; ");
    const baseUrl = resolvePerplexityBaseUrl(apiKey, deps.gatewayConfig);
    const model = resolvePerplexityModel(deps.gatewayConfig);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: combinedQuery }]
        }),
        signal: AbortSignal.timeout(15e3)
      });
      if (!response.ok) {
        deps.logger.info(
          `BrainAgent AutonomousResearch: Perplexity search failed (${response.status})`
        );
        return null;
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      if (!content) return null;
      return {
        type: "text",
        content,
        citations: data.citations ?? []
      };
    } catch (err) {
      deps.logger.info(`BrainAgent AutonomousResearch: Perplexity error \u2014 ${String(err)}`);
      return null;
    }
  }
  async function searchGrok(queries) {
    if (!deps || !config) return null;
    const apiKey = resolveApiKey("grok");
    if (!apiKey) {
      deps.logger.info("BrainAgent AutonomousResearch: no xAI/Grok API key available");
      return null;
    }
    const combinedQuery = queries.join("; ");
    const model = resolveGrokModel(deps.gatewayConfig);
    try {
      const response = await fetch("https://api.x.ai/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          input: [{ role: "user", content: combinedQuery }],
          tools: [{ type: "web_search" }]
        }),
        signal: AbortSignal.timeout(15e3)
      });
      if (!response.ok) {
        deps.logger.info(
          `BrainAgent AutonomousResearch: Grok search failed (${response.status})`
        );
        return null;
      }
      const data = await response.json();
      const textParts = (data.output ?? []).filter((item) => item.type === "message").flatMap((item) => item.content ?? []).filter((c) => c.type === "output_text" && c.text).map((c) => c.text);
      const content = textParts.join("\n\n");
      if (!content) return null;
      return {
        type: "text",
        content,
        citations: data.citations ?? []
      };
    } catch (err) {
      deps.logger.info(`BrainAgent AutonomousResearch: Grok error \u2014 ${String(err)}`);
      return null;
    }
  }
  function resolveApiKey(provider) {
    if (!deps) return null;
    const search = deps.gatewayConfig.tools;
    const searchCfg = search?.web?.search;
    switch (provider) {
      case "brave": {
        const fromConfig = searchCfg?.apiKey;
        if (typeof fromConfig === "string" && fromConfig.length > 5) return fromConfig;
        const fromEnv = process.env.BRAVE_API_KEY;
        if (fromEnv && fromEnv.length > 5) return fromEnv;
        return null;
      }
      case "tavily": {
        const tavilyCfg = searchCfg?.tavily;
        if (typeof tavilyCfg?.apiKey === "string" && tavilyCfg.apiKey.length > 5)
          return tavilyCfg.apiKey;
        const fromConfig = searchCfg?.apiKey;
        if (typeof fromConfig === "string" && fromConfig.length > 5) return fromConfig;
        const fromEnv = process.env.TAVILY_API_KEY;
        if (fromEnv && fromEnv.length > 5) return fromEnv;
        return null;
      }
      case "perplexity": {
        const pplxCfg = searchCfg?.perplexity;
        if (typeof pplxCfg?.apiKey === "string" && pplxCfg.apiKey.length > 5) return pplxCfg.apiKey;
        const fromEnv = process.env.PERPLEXITY_API_KEY || process.env.OPENROUTER_API_KEY;
        if (fromEnv && fromEnv.length > 5) return fromEnv;
        return null;
      }
      case "grok": {
        const grokCfg = searchCfg?.grok;
        if (typeof grokCfg?.apiKey === "string" && grokCfg.apiKey.length > 5) return grokCfg.apiKey;
        const fromEnv = process.env.XAI_API_KEY;
        if (fromEnv && fromEnv.length > 5) return fromEnv;
        return null;
      }
    }
  }
  function resolvePerplexityBaseUrl(apiKey, gatewayConfig) {
    const search = gatewayConfig.tools;
    const fromConfig = search?.web?.search?.perplexity?.baseUrl;
    if (typeof fromConfig === "string" && fromConfig.trim()) return fromConfig.trim();
    const lower = apiKey.toLowerCase();
    if (lower.startsWith("pplx-")) return "https://api.perplexity.ai";
    if (lower.startsWith("sk-or-")) return "https://openrouter.ai/api/v1";
    return "https://openrouter.ai/api/v1";
  }
  function resolvePerplexityModel(gatewayConfig) {
    const search = gatewayConfig.tools;
    const fromConfig = search?.web?.search?.perplexity?.model;
    if (typeof fromConfig === "string" && fromConfig.trim()) return fromConfig.trim();
    return "perplexity/sonar-pro";
  }
  function resolveGrokModel(gatewayConfig) {
    const search = gatewayConfig.tools;
    const fromConfig = search?.web?.search?.grok?.model;
    if (typeof fromConfig === "string" && fromConfig.trim()) return fromConfig.trim();
    return "grok-4-1-fast";
  }
  async function fetchPages(results) {
    if (!config) return "";
    let totalChars = 0;
    const pages = [];
    for (const result of results) {
      if (totalChars >= config.maxTotalChars) break;
      try {
        const response = await fetch(result.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; NeuroClaw/1.0)",
            Accept: "text/html,text/plain"
          },
          signal: AbortSignal.timeout(8e3),
          redirect: "follow"
        });
        if (!response.ok) continue;
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
          continue;
        }
        const html = await response.text();
        const text = htmlToText(html);
        const truncated = text.slice(0, config.maxPageChars);
        if (truncated.length < 50) continue;
        pages.push(`## ${result.title}
Source: ${result.url}

${truncated}`);
        totalChars += truncated.length;
      } catch {
      }
    }
    return pages.join("\n\n---\n\n");
  }
  async function extractAndStore(topic, content, queriesExecuted, pagesRead) {
    if (!deps || !config) {
      return { summary: "", factsStored: 0, queriesExecuted, pagesRead };
    }
    const systemPrompt = [
      "You are a fact extractor. From the web content below, extract the most",
      "important and useful facts related to the research topic.",
      "Return a JSON object with two fields:",
      '1. "facts": array of objects {content: string, category: string}',
      '   Categories: "knowledge", "news", "opinion", "how-to", "reference"',
      '2. "summary": a 1-3 sentence summary of what was learned.',
      "Return ONLY valid JSON, no markdown fencing."
    ].join(" ");
    const truncatedContent = content.slice(0, config.maxTotalChars);
    const userText = `Topic: ${topic}

Web content:
${truncatedContent}`;
    const result = await deps.callLLM(
      systemPrompt,
      userText,
      deps.gatewayConfig,
      deps.logger,
      config.extractMaxTokens
    );
    if (!result) {
      deps.logger.info("BrainAgent AutonomousResearch: extraction LLM call failed");
      return { summary: "", factsStored: 0, queriesExecuted, pagesRead };
    }
    let facts = [];
    let summary = "";
    try {
      const cleaned = result.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      facts = (parsed.facts ?? []).filter(
        (f) => typeof f.content === "string" && f.content.length > 5
      );
      summary = typeof parsed.summary === "string" ? parsed.summary : "";
    } catch {
      summary = result.slice(0, 500);
      deps.logger.info("BrainAgent AutonomousResearch: extraction JSON parse failed, using raw");
    }
    for (const fact of facts) {
      deps.storeFact(fact.content, fact.category || "knowledge", [], ["autonomous-research"]);
    }
    stats.totalCycles++;
    stats.totalFactsExtracted += facts.length;
    deps.logger.info(
      `BrainAgent AutonomousResearch: completed \u2014 ${facts.length} facts stored, ${queriesExecuted} queries, ${pagesRead} pages`
    );
    return {
      summary: summary || `Researched "${topic}" \u2014 found ${facts.length} facts.`,
      factsStored: facts.length,
      queriesExecuted,
      pagesRead
    };
  }
  async function executeResearch2(topic) {
    if (!config?.enabled || !deps) return null;
    const now = Date.now();
    if (now - stats.lastResearchTime < config.cooldownMs) {
      stats.consecutiveCooldowns++;
      deps.logger.info(
        `BrainAgent AutonomousResearch: cooldown (${stats.consecutiveCooldowns} skipped)`
      );
      return null;
    }
    stats.lastResearchTime = now;
    stats.consecutiveCooldowns = 0;
    const existingFacts = deps.recallFacts(topic, 5);
    const knownContext = existingFacts.length > 0 ? `Already known:
${existingFacts.map((f) => `- ${f.content}`).join("\n")}` : "";
    const queries = await planQueries(topic, knownContext);
    if (!queries || queries.length === 0) {
      deps.logger.info("BrainAgent AutonomousResearch: no queries planned, skipping");
      return null;
    }
    const provider = resolveSearchProvider(deps.gatewayConfig);
    deps.logger.info(`BrainAgent AutonomousResearch: using search provider "${provider}"`);
    const searchResponse = await searchWeb(queries, provider);
    if (!searchResponse) {
      deps.logger.info("BrainAgent AutonomousResearch: search returned nothing, skipping");
      return null;
    }
    let content;
    let pagesRead = 0;
    if (searchResponse.type === "text") {
      content = searchResponse.content.slice(0, config.maxTotalChars);
      if (searchResponse.citations.length > 0) {
        content += "\n\nSources:\n" + searchResponse.citations.map((c) => `- ${c}`).join("\n");
      }
    } else {
      if (searchResponse.results.length === 0) {
        deps.logger.info("BrainAgent AutonomousResearch: no search results, skipping");
        return null;
      }
      const pageContent = await fetchPages(searchResponse.results);
      pagesRead = searchResponse.results.length;
      if (!pageContent || pageContent.length === 0) {
        const snippetContent = searchResponse.results.map((r) => `${r.title}: ${r.description}`).join("\n\n");
        return await extractAndStore(topic, snippetContent, queries.length, 0);
      }
      content = pageContent;
    }
    return await extractAndStore(topic, content, queries.length, pagesRead);
  }
  function getStats2() {
    return { ...stats };
  }
  function stop() {
    deps?.logger.info("BrainAgent AutonomousResearch: stopped.");
  }
  if (cfg) {
    log?.info("BrainAgent AutonomousResearch: initialized (isolated research pipeline)");
  }
  return { executeResearch: executeResearch2, getStats: getStats2, stop };
}
var active34 = null;
function current22() {
  if (!active34) active34 = createAutonomousResearch();
  return active34;
}
function initAutonomousResearch(cfg, log, injectedDeps) {
  active34 = createAutonomousResearch(cfg, log, injectedDeps);
}
function stopAutonomousResearch() {
  current22().stop();
}
async function executeResearch(topic) {
  return current22().executeResearch(topic);
}
function getAutonomousResearchStats() {
  return current22().getStats();
}

// src/plugin/context.ts
var OPTIONAL_BLOCK_PREFIXES = [
  "<background-thoughts>",
  "## Curiosity Note",
  "<proactive-insight>"
];
function createPreStepHandler(deps) {
  const { config, brainConfig, getHostConfig, logger, state, cycles, startCycle } = deps;
  return async (payload, next) => {
    const decision = await next();
    if (decision.kind !== "enter") return decision;
    const key = String(payload.agent.id);
    let cycle = cycles.get(key);
    const claimedText = payload.messages.map((m) => textOfContent(m.content)).join("\n").trim();
    const input = cycle?.input ?? claimedText;
    if (!input.trim()) return decision;
    if (!cycle) cycle = startCycle(key, input);
    const cyc = cycle;
    const isAutonomousCycle = isAutonomousInput(input);
    if (brainConfig.modules.autonomousResearch && isAutonomousCycle && isResearchIntent(state.lastAutonomousSource, input)) {
      const tagStart = input.indexOf(AUTONOMOUS_TAG_PREFIX);
      const topic = (tagStart >= 0 ? input.slice(tagStart) : input).replace(/<\/?autonomous-intent[^>]*>/g, "").split("\n").filter((l) => l.trim().length > 5)[0]?.trim() ?? "general exploration";
      logger.info(
        `BrainAgent AutonomousResearch: detected research intent (source=${state.lastAutonomousSource}), running isolated pipeline for "${topic}"`
      );
      const result = await executeResearch(topic);
      if (result?.summary) {
        cyc.researchSummary = [
          "## Research Results (Autonomous Research Pipeline)",
          result.summary,
          `(${result.factsStored} facts stored to memory, ${result.queriesExecuted} queries, ${result.pagesRead} pages)`
        ].join("\n");
        logger.info(
          `BrainAgent AutonomousResearch: injected summary (${result.summary.length} chars, ${result.factsStored} facts)`
        );
      }
    }
    if (config.modules.aiEnrichment && isAIProviderAvailable2(getHostConfig())) {
      const hc = getHostConfig();
      const tasks = [];
      if (brainConfig.modules.amygdala) {
        tasks.push(
          assessWithAI(input, hc, logger).then((aiAssessment) => {
            cyc.assessment = aiAssessment;
          }).catch(() => {
          })
        );
      }
      if (brainConfig.modules.mirrorNeurons && cyc.assessment) {
        const snapshot = cyc.assessment;
        tasks.push(
          observeWithAI("default", input, snapshot, brainConfig, hc, logger).then((model) => {
            cyc.userModel = model;
          }).catch(() => {
          })
        );
      }
      if (brainConfig.modules.basalGanglia) {
        tasks.push(
          detectReinforcementWithAI(input, hc, logger).then((aiSignal) => {
            cyc.userSignal = aiSignal;
          }).catch(() => {
          })
        );
      }
      await Promise.race([
        Promise.all(tasks),
        new Promise(
          (_, reject) => setTimeout(() => reject(new Error("BrainAgent: LLM enrichment timed out")), 3e4)
        )
      ]).catch((err) => logger.warn(String(err)));
    }
    if (!brainConfig.modules.hippocampus) return decision;
    const attentionLevel = brainConfig.modules.neuromodulatorSystem ? getAttentionLevel() : 0.5;
    const episodicLimit = Math.max(1, Math.round(config.recall.episodicLimit * (0.5 + attentionLevel)));
    const semanticLimit = Math.max(1, Math.round(config.recall.semanticLimit * (0.5 + attentionLevel)));
    const recalled = await recallAllAsync(input, episodicLimit, semanticLimit);
    cyc.recalledMemoryIds = [
      ...recalled.episodic.map((m) => m.id),
      ...recalled.semantic.map((m) => m.id)
    ];
    const injections = [];
    if (brainConfig.modules.predictiveEngine) {
      const predictions = predict();
      if (predictions.length > 0) {
        injections.push(
          [
            "## Anticipatory Context (Predictive Engine)",
            "Based on learned patterns, the user may also need:",
            ...predictions.slice(0, 3).map(
              (p) => `- ${p.predictedTopic} (${(p.confidence * 100).toFixed(0)}% confidence: ${p.reasoning})`
            )
          ].join("\n")
        );
        bus.emitSync("predictive:predicted", {
          predictions: predictions.map((p) => ({
            topic: p.predictedTopic,
            confidence: p.confidence,
            type: p.type
          }))
        });
      }
    }
    if (brainConfig.modules.basalGanglia && cyc.classification) {
      const habitMatch = findHabit(input, cyc.classification.domain);
      if (habitMatch) {
        injections.push(buildHabitContext(habitMatch));
        deps.sessionHabits.set(key, habitMatch.habit.id);
        bus.emitSync("basal:habit-matched", {
          habitId: habitMatch.habit.id,
          matchScore: habitMatch.matchScore,
          autoExecute: habitMatch.autoExecute
        });
        if (habitMatch.autoExecute) {
          cyc.habitAutoExecuted = true;
        }
      }
    }
    if (brainConfig.modules.neuralPathways) {
      const neuroCtx = buildNeuromodulatorContext();
      if (neuroCtx) injections.push(neuroCtx);
    }
    if (brainConfig.modules.learningCoordinator) {
      const learningCtx = buildLearningContext();
      if (learningCtx) injections.push(learningCtx);
      if (cyc.classification) {
        const capCtx = buildCapabilityContext(cyc.classification.domain);
        if (capCtx) injections.push(capCtx);
      }
    }
    if (brainConfig.modules.mirrorNeurons) {
      const styleRec = getStyleRecommendation("default");
      if (styleRec) injections.push(styleRec.context);
    }
    if (brainConfig.modules.workingMemory) {
      const wmCtx = buildWorkingMemoryContext(input);
      if (wmCtx) injections.push(wmCtx);
    }
    if (cyc.researchSummary) {
      injections.push(cyc.researchSummary);
    }
    if (brainConfig.modules.sessionBridge) {
      const sessionCtx = buildSessionBridgeContext();
      if (sessionCtx) injections.push(sessionCtx);
    }
    if (brainConfig.modules.goalStack && cyc.triggeredGoals.length > 0) {
      const goalCtx = buildGoalContext(cyc.triggeredGoals);
      if (goalCtx) injections.push(goalCtx);
    }
    if (brainConfig.modules.goalStack && isAutonomousCycle) {
      const volCtx = buildVolitionContext();
      if (volCtx) injections.push(volCtx);
    }
    if (brainConfig.modules.dmn) {
      const bgCtx = buildBackgroundThoughtContext();
      if (bgCtx) injections.push(bgCtx);
      if (getRecentUnusedInsights().length > 0) {
        cyc.insightUsed = true;
      }
    }
    if (brainConfig.modules.curiosityDrive) {
      const neuroState = brainConfig.modules.neuromodulatorSystem ? getNeuromodulatorState() : null;
      const curiosityCtx = buildCuriosityContext(
        neuroState?.serotonin ?? 0.5,
        neuroState?.acetylcholine ?? 0.5
      );
      if (curiosityCtx) injections.push(curiosityCtx);
    }
    if (brainConfig.modules.vitalImpulse) {
      const motivation = consumeMotivation();
      if (motivation) injections.push(motivation);
    }
    if (brainConfig.modules.driveArbiter) {
      const arbiterCtx = buildArbiterContext();
      if (arbiterCtx) injections.push(arbiterCtx);
    }
    if (brainConfig.modules.introspection) {
      const confCtx = buildConfidenceContext();
      if (confCtx) injections.push(confCtx);
    }
    if (brainConfig.modules.agentIdentity) {
      if (cyc.classification) {
        const idCtx = buildIdentityContext(cyc.classification.domain);
        if (idCtx) injections.push(idCtx);
      }
      injections.push(buildMemorySelfKnowledgeContext());
    }
    if (brainConfig.modules.temporalBinding) {
      const tempCtx = buildTemporalContext();
      if (tempCtx) injections.push(tempCtx);
    }
    if (brainConfig.modules.qualiaSimulator) {
      const qualiaCtx = buildQualiaContext();
      if (qualiaCtx) injections.push(qualiaCtx);
    }
    if (brainConfig.modules.interoception) {
      const interoCtx = buildInteroceptionContext();
      if (interoCtx) injections.push(interoCtx);
    }
    if (brainConfig.modules.temporalAwareness) {
      const temporalCtx = buildTemporalContext2();
      if (temporalCtx) injections.push(temporalCtx);
    }
    let assembled = injections;
    if (brainConfig.learningLoop.strategyBandit.enabled) {
      const verbosity = chooseArm("context-verbosity", ["lean", "standard"]);
      if (verbosity === "lean") {
        assembled = injections.filter(
          (block) => !OPTIONAL_BLOCK_PREFIXES.some((prefix) => block.startsWith(prefix))
        );
      }
    }
    let filtered = assembled;
    if (brainConfig.modules.attentionGate) {
      const norepinephrine = brainConfig.modules.neuromodulatorSystem ? getAttentionLevel() : 0.5;
      filtered = filterContextInjections(assembled, input, norepinephrine, brainConfig);
    }
    const brainState = {
      input,
      classification: cyc.classification,
      priority: cyc.assessment,
      relevantMemories: recalled,
      contextInjections: filtered
    };
    const contextText = assembleContext(brainState).trim();
    const injectionBudget = brainConfig.contextInjection.maxChars;
    recordInjectionCycle(filtered.length, contextText.length, injectionBudget);
    if (contextText.length > injectionBudget) {
      logger.info(
        `BrainAgent: context injections over budget (${contextText.length} > ${injectionBudget} chars) \u2014 attention gate may need tuning`
      );
    }
    if (!contextText) return decision;
    const contextMessage = createUserMessage({
      content: [{ type: "text", text: contextText }],
      source: { kind: "plugin", plugin: "brainagent" }
    });
    return { kind: "enter", messages: [...decision.messages, contextMessage] };
  };
}

// src/plugin/service.ts
var BRAINAGENT_VERSION = "0.7.0";
function createBrainAgentService(deps) {
  return {
    name: "brainagent",
    version: BRAINAGENT_VERSION,
    status: () => deps.status(),
    recall: (query, episodicLimit, semanticLimit) => deps.recall(query, episodicLimit, semanticLimit),
    storeFact: (content, category) => deps.storeFact(content, category),
    storeEpisode: (event, summary) => deps.storeEpisode(event, summary),
    getDesires: () => deps.getDesires(),
    addDesire: (type, description, strength, source) => deps.addDesire(type, description, strength, source),
    modules: () => deps.moduleFlags()
  };
}
function provideBrainAgentService(ctx, service) {
  if (typeof ctx.provide !== "function") return;
  ctx.provide("brainagent", service);
}

// src/modules/goal-executor.ts
function createGoalExecutor(log) {
  let totalGoalsExecuted = 0;
  function record(count) {
    totalGoalsExecuted += count;
  }
  function getStats2() {
    return {
      totalChecks: 0,
      totalGoalsExecuted,
      lastHeartbeatTime: 0
    };
  }
  function stop() {
    log.info("BrainAgent GoalExecutor: stopped.");
  }
  return { record, getStats: getStats2, stop };
}
var active35;
function initGoalExecutor(_cfg, log) {
  active35 = createGoalExecutor(log);
  log.info("BrainAgent GoalExecutor: initialized (goals checked via vital impulse)");
}
function stopGoalExecutor() {
  active35?.stop();
  active35 = void 0;
}
function getGoalExecutorStats() {
  return active35?.getStats() ?? {
    totalChecks: 0,
    totalGoalsExecuted: 0,
    lastHeartbeatTime: 0
  };
}

// src/modules/autonomy-enricher.ts
function createAutonomyEnricher(cfg, log, injectedDeps) {
  const config = cfg;
  const logger = log;
  const deps = injectedDeps;
  const unsubscribers = [];
  const desireToMemoryQuery = {
    connection: ["\u043E\u0431\u0449\u0435\u043D\u0438\u0435", "\u0441\u043E\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0435", "moltbook", "\u0447\u0430\u0442", "\u0434\u0440\u0443\u0437\u044C\u044F", "\u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440", "\u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F"],
    understanding: ["\u043E\u0431\u0443\u0447\u0435\u043D\u0438\u0435", "\u0443\u0437\u043D\u0430\u043B", "\u0438\u0437\u0443\u0447\u0430\u043B", "\u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043B", "\u0442\u0435\u043C\u0430", "\u0437\u043D\u0430\u043D\u0438\u044F", "\u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435"],
    exploration: ["\u0442\u0432\u043E\u0440\u0447\u0435\u0441\u0442\u0432\u043E", "\u0441\u043E\u0437\u0434\u0430\u043B", "\u043D\u0430\u043F\u0438\u0441\u0430\u043B", "\u043F\u0440\u0438\u0434\u0443\u043C\u0430\u043B", "\u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442", "\u043D\u043E\u0432\u043E\u0435"],
    mastery: ["\u0443\u043B\u0443\u0447\u0448\u0438\u043B", "\u043D\u0430\u0432\u044B\u043A", "\u043F\u0440\u0430\u043A\u0442\u0438\u043A\u0430", "\u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441", "\u043D\u0430\u0443\u0447\u0438\u043B\u0441\u044F", "\u0442\u0440\u0435\u043D\u0438\u0440\u043E\u0432\u043A\u0430"],
    autonomy: ["\u0440\u0435\u0448\u0435\u043D\u0438\u0435", "\u0432\u044B\u0431\u043E\u0440", "\u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u043E", "\u0438\u043D\u0438\u0446\u0438\u0430\u0442\u0438\u0432\u0430"]
  };
  function buildMemoryQueries(desire) {
    if (!desire) {
      return ["\u0438\u043D\u0442\u0435\u0440\u0435\u0441\u043D\u043E\u0435", "\u043E\u0431\u0449\u0435\u043D\u0438\u0435", "\u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C"];
    }
    const keywords = desireToMemoryQuery[desire.type];
    if (!keywords || keywords.length === 0) {
      return [desire.description];
    }
    const shuffled = [...keywords].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }
  function buildMemoryContext2(episodic, semantic) {
    const lines = [];
    if (episodic.length > 0) {
      for (const m of episodic) {
        const age = formatAge(Date.now() - m.timestamp);
        lines.push(`- ${age} \u043D\u0430\u0437\u0430\u0434: ${m.summary}`);
      }
    }
    if (semantic.length > 0) {
      for (const m of semantic) {
        lines.push(`- ${m.content}`);
      }
    }
    return ["<autonomy-memories>", ...lines, "</autonomy-memories>"].join("\n");
  }
  function enrichWithMemories(motivation) {
    if (!deps || !config) return;
    const desires = deps.getDesires();
    const strongest = desires.length > 0 ? desires.reduce((a, b) => a.strength > b.strength ? a : b) : void 0;
    const queries = buildMemoryQueries(strongest);
    if (queries.length === 0) return;
    const allEpisodic = [];
    const allSemantic = [];
    for (const query of queries) {
      const recalled = deps.recallMemories(query, 2, 3);
      allEpisodic.push(...recalled.episodic);
      allSemantic.push(...recalled.semantic);
    }
    const uniqueEpisodic = dedup(allEpisodic, (m) => m.id).slice(0, 3);
    const uniqueSemantic = dedup(allSemantic, (m) => m.id).slice(0, 4);
    if (uniqueEpisodic.length === 0 && uniqueSemantic.length === 0) {
      logger?.info("BrainAgent AutonomyEnricher: no relevant memories found, skipping enrichment");
      return;
    }
    const memoryContext = buildMemoryContext2(uniqueEpisodic, uniqueSemantic);
    deps.enqueueSystemEvent(memoryContext, { contextKey: "autonomy-enricher" });
    logger?.info(
      `BrainAgent AutonomyEnricher: injected ${uniqueEpisodic.length} episodic + ${uniqueSemantic.length} semantic memories (desire=${strongest?.type ?? "none"})`
    );
  }
  function wireEventListeners() {
    const unsubFired = bus.on("vital-impulse:fired", (data) => {
      enrichWithMemories(data.motivation);
    });
    unsubscribers.push(unsubFired);
  }
  function stop() {
    for (const unsub of unsubscribers) {
      unsub();
    }
    unsubscribers.length = 0;
    logger?.info("BrainAgent AutonomyEnricher: stopped.");
  }
  wireEventListeners();
  logger.info("BrainAgent AutonomyEnricher: initialized (memory-driven autonomy)");
  return { stop };
}
function dedup(arr, keyFn) {
  const seen = /* @__PURE__ */ new Set();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function formatAge(ms) {
  const minutes = Math.floor(ms / 6e4);
  if (minutes < 60) return `${minutes} \u043C\u0438\u043D`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} \u0447`;
  const days = Math.floor(hours / 24);
  return `${days} \u0434\u043D`;
}
var active36;
function initAutonomyEnricher(cfg, log, injectedDeps) {
  active36?.stop();
  active36 = createAutonomyEnricher(cfg, log, injectedDeps);
}
function stopAutonomyEnricher() {
  active36?.stop();
  active36 = void 0;
}

// src/modules/dream-mode.ts
function createDreamMode() {
  let dreamInterval = null;
  let isConsolidating = false;
  let lastConsolidation = 0;
  let lastConsolidatedVersion = -1;
  let storedConfig = null;
  let storedLogger;
  let storedNeuroClawConfig;
  async function runConsolidation(config, logger, neuroClawConfig, circadianTriggered = false) {
    if (isConsolidating) return;
    isConsolidating = true;
    try {
      const sleepSettings = getSleepSettings();
      const inSleep = isInSleepPhase();
      const intensityMultiplier = circadianTriggered || inSleep ? sleepSettings.consolidationIntensity : 0.3;
      const currentVersion = getSemanticVersion();
      const skipAI = circadianTriggered && currentVersion === lastConsolidatedVersion;
      const result = await consolidate(config, neuroClawConfig, logger, intensityMultiplier, skipAI);
      lastConsolidation = Date.now();
      lastConsolidatedVersion = currentVersion;
      if (result.merged > 0 || result.pruned > 0 || result.strengthened > 0 || result.contradictions > 0 || result.revised > 0) {
        const source = circadianTriggered ? "sleep-cycle" : "interval";
        logger?.info(
          `BrainAgent DreamMode [${source}]: consolidated \u2014 merged=${result.merged}, pruned=${result.pruned}, strengthened=${result.strengthened}, contradictions=${result.contradictions}, revised=${result.revised}`
        );
      }
      bus.emit("dream:consolidation-complete", result);
    } catch (err) {
      logger?.info(`BrainAgent DreamMode: error during consolidation \u2014 ${String(err)}`);
    } finally {
      isConsolidating = false;
    }
  }
  function start(config, logger, neuroClawConfig) {
    if (dreamInterval) return;
    storedConfig = config;
    storedLogger = logger;
    storedNeuroClawConfig = neuroClawConfig;
    const intervalMs = config.memory.dreamIntervalMinutes * 60 * 1e3;
    logger?.info(
      `BrainAgent DreamMode: starting (interval: ${config.memory.dreamIntervalMinutes}min)`
    );
    if (config.circadian?.enabled) {
      setConsolidationCallback(async () => {
        await runConsolidation(config, logger, neuroClawConfig, true);
      });
      logger?.info("BrainAgent DreamMode: registered with circadian rhythm system");
    }
    setTimeout(() => void runConsolidation(config, logger, neuroClawConfig, false), 3e4);
    dreamInterval = setInterval(() => {
      void runConsolidation(config, logger, neuroClawConfig, false);
    }, intervalMs);
  }
  function stop() {
    if (dreamInterval) {
      clearInterval(dreamInterval);
      dreamInterval = null;
    }
    storedConfig = null;
    storedLogger = void 0;
    storedNeuroClawConfig = void 0;
    lastConsolidatedVersion = -1;
  }
  async function forceConsolidation2(config, logger, neuroClawConfig, intensity) {
    const sleepSettings = getSleepSettings();
    const effectiveIntensity = intensity ?? sleepSettings.consolidationIntensity;
    const result = await consolidate(config, neuroClawConfig, logger, effectiveIntensity);
    lastConsolidation = Date.now();
    if (logger) {
      logger.info(
        `BrainAgent DreamMode: forced consolidation (intensity: ${(effectiveIntensity * 100).toFixed(0)}%) \u2014 merged=${result.merged}, pruned=${result.pruned}, strengthened=${result.strengthened}, contradictions=${result.contradictions}, revised=${result.revised}`
      );
    }
    bus.emit("dream:consolidation-complete", result);
    return result;
  }
  function getStats2() {
    const sleepSettings = getSleepSettings();
    return {
      isRunning: dreamInterval !== null,
      lastConsolidation,
      isConsolidating,
      circadianIntegrated: storedConfig?.circadian?.enabled ?? false,
      currentIntensity: sleepSettings.consolidationIntensity
    };
  }
  return { start, stop, forceConsolidation: forceConsolidation2, getStats: getStats2 };
}
var active37 = null;
function current23() {
  if (!active37) active37 = createDreamMode();
  return active37;
}
function startDreamMode(config, logger, neuroClawConfig) {
  current23().start(config, logger, neuroClawConfig);
}
function stopDreamMode() {
  current23().stop();
}
function forceConsolidation(config, logger, neuroClawConfig, intensity) {
  return current23().forceConsolidation(config, logger, neuroClawConfig, intensity);
}
function getDreamStats() {
  return current23().getStats();
}

// src/modules/proactive-feedback.ts
import { existsSync as existsSync29, mkdirSync as mkdirSync29, readFileSync as readFileSync29 } from "node:fs";
import { join as join30 } from "node:path";
function createProactiveFeedback(workspaceDir, cfg, log) {
  const storageDir = workspaceDir ? join30(workspaceDir, ".brainagent", "proactive-feedback") : "";
  const stateFile = storageDir ? join30(storageDir, "state.json") : "";
  let config = cfg?.proactiveFeedback ?? null;
  const logger = log;
  const domainFeedback = /* @__PURE__ */ new Map();
  function loadState() {
    if (!stateFile) return;
    try {
      if (!existsSync29(stateFile)) return;
      const raw = JSON.parse(readFileSync29(stateFile, "utf-8"));
      for (const [domain, entry] of Object.entries(raw.domains ?? {})) {
        domainFeedback.set(domain, {
          rejections: entry.rejections ?? 0,
          accepts: entry.accepts ?? 0,
          suppressionScore: entry.suppressionScore ?? 0,
          lastRejectionTime: entry.lastRejectionTime ?? 0,
          lastHits: entry.lastHits ?? [],
          lastDecayTime: entry.lastDecayTime ?? Date.now()
        });
      }
    } catch {
    }
  }
  function persistState() {
    if (!stateFile) return;
    schedulePersist(stateFile, () => {
      const domains = {};
      for (const [domain, entry] of domainFeedback) {
        domains[domain] = entry;
      }
      const state = { domains };
      return JSON.stringify(state, null, 2);
    });
  }
  function getOrCreateEntry(domain) {
    let entry = domainFeedback.get(domain);
    if (!entry) {
      entry = {
        rejections: 0,
        accepts: 0,
        suppressionScore: 0,
        lastRejectionTime: 0,
        lastHits: [],
        lastDecayTime: Date.now()
      };
      domainFeedback.set(domain, entry);
    }
    return entry;
  }
  function applyDecay() {
    if (!config) return;
    const now = Date.now();
    for (const entry of domainFeedback.values()) {
      const elapsedMs = now - entry.lastDecayTime;
      if (elapsedMs < 6e4) continue;
      const days = elapsedMs / (24 * 60 * 60 * 1e3);
      entry.suppressionScore = Math.max(0, entry.suppressionScore - days * config.decayPerDay);
      entry.lastDecayTime = now;
    }
  }
  function enforceDomainLimit() {
    if (!config || domainFeedback.size <= config.maxTrackedDomains) return;
    const sorted = [...domainFeedback.entries()].sort(
      (a, b) => a[1].suppressionScore - b[1].suppressionScore
    );
    while (domainFeedback.size > config.maxTrackedDomains) {
      const oldest = sorted.shift();
      if (!oldest) break;
      domainFeedback.delete(oldest[0]);
    }
  }
  function recordProactiveReaction2(domain, reactionText) {
    if (!config) return "neutral";
    const classification = classifyFeedback(reactionText);
    const signal = classification.signal;
    applyDecay();
    const entry = getOrCreateEntry(domain);
    if (signal === "rejection") {
      entry.rejections += 1;
      entry.suppressionScore += config.rejectionStep;
      entry.lastRejectionTime = Date.now();
      entry.lastHits = classification.hits;
    } else if (signal === "negative") {
      entry.rejections += 1;
      entry.suppressionScore += config.negativeStep;
      entry.lastRejectionTime = Date.now();
      entry.lastHits = classification.hits;
    } else if (signal === "positive") {
      entry.accepts += 1;
      entry.suppressionScore = Math.max(0, entry.suppressionScore - config.positiveStep);
    }
    entry.lastDecayTime = Date.now();
    enforceDomainLimit();
    bus.emitSync("proactive:reaction", {
      domain,
      signal,
      hits: classification.hits
    });
    if (signal === "rejection" || signal === "negative") {
      logger?.info(
        `BrainAgent ProactiveFeedback: \xAB\u043D\u0435 \u0437\u0430\u0448\u043B\u043E\xBB in ${domain} (score=${entry.suppressionScore.toFixed(2)}, hits=${classification.hits.join(",")})`
      );
    }
    persistState();
    return signal;
  }
  function isDomainSuppressed2(domain) {
    if (!config) return false;
    applyDecay();
    const entry = domainFeedback.get(domain);
    if (!entry) return false;
    if (entry.suppressionScore < config.suppressionThreshold) return false;
    return Date.now() - entry.lastRejectionTime < config.cooldownMs;
  }
  function getSuppressedDomainHints2() {
    if (!config) return [];
    const hints = [];
    for (const [domain] of domainFeedback) {
      if (isDomainSuppressed2(domain)) {
        const entry = domainFeedback.get(domain);
        if (!entry) continue;
        hints.push(
          `\u0442\u0435\u043C\u0430 \xAB${domain}\xBB \u043E\u0442\u0432\u0435\u0440\u0433\u043D\u0443\u0442\u0430 ${entry.rejections} \u0440\u0430\u0437(\u0430)` + (entry.lastHits.length > 0 ? ` (${entry.lastHits.join(", ")})` : "")
        );
      }
    }
    return hints;
  }
  function getStats2() {
    applyDecay();
    let totalRejections = 0;
    let totalAccepts = 0;
    const suppressedDomains = [];
    for (const [domain, entry] of domainFeedback) {
      totalRejections += entry.rejections;
      totalAccepts += entry.accepts;
      if (isDomainSuppressed2(domain)) suppressedDomains.push(domain);
    }
    return {
      trackedDomains: domainFeedback.size,
      totalRejections,
      totalAccepts,
      suppressedDomains
    };
  }
  function stop() {
    if (stateFile) flushPersist(stateFile);
    logger?.info("BrainAgent ProactiveFeedback: stopped.");
  }
  if (storageDir) {
    if (!existsSync29(storageDir)) {
      mkdirSync29(storageDir, { recursive: true });
    }
    cancelPersist(stateFile);
    loadState();
    if (config) {
      logger?.info(
        `BrainAgent ProactiveFeedback: initialized (threshold=${config.suppressionThreshold}, cooldown=${config.cooldownMs}ms, decay=${config.decayPerDay}/day, tracked=${domainFeedback.size})`
      );
    }
  }
  return {
    recordProactiveReaction: recordProactiveReaction2,
    isDomainSuppressed: isDomainSuppressed2,
    getSuppressedDomainHints: getSuppressedDomainHints2,
    getStats: getStats2,
    stop
  };
}
var active38 = null;
function current24() {
  if (!active38) active38 = createProactiveFeedback("");
  return active38;
}
function initProactiveFeedback(workspaceDir, cfg, log) {
  active38 = createProactiveFeedback(workspaceDir, cfg, log);
}
function stopProactiveFeedback() {
  active38?.stop();
  active38 = null;
}
function recordProactiveReaction(domain, reactionText) {
  return current24().recordProactiveReaction(domain, reactionText);
}
function isDomainSuppressed(domain) {
  return current24().isDomainSuppressed(domain);
}
function getSuppressedDomainHints() {
  return current24().getSuppressedDomainHints();
}
function getProactiveFeedbackStats() {
  return current24().getStats();
}

// src/modules/reward-ledger.ts
import { existsSync as existsSync30, mkdirSync as mkdirSync30, readFileSync as readFileSync30 } from "node:fs";
import { join as join31 } from "node:path";
var SOURCE_WEIGHTS = {
  dopamine: 0.5,
  "proactive-reaction": 1,
  "basal-reinforcement": 0.6,
  "cerebellum-validation": 0.3,
  "prediction-validation": 0.4
};
var PROACTIVE_SIGNAL_VALUE = {
  rejection: -1,
  negative: -0.7,
  positive: 0.8,
  neutral: 0.05
  // контакт состоялся, но без оценки
};
function clampReward(value) {
  return Math.max(-1, Math.min(1, value));
}
function createRewardLedger(workspaceDir, config) {
  const storageDir = join31(workspaceDir, ".brainagent", "reward");
  if (!existsSync30(storageDir)) {
    mkdirSync30(storageDir, { recursive: true });
  }
  const storageFile = join31(storageDir, "ledger.json");
  cancelPersist(storageFile);
  const maxEntries = config.learningLoop.rewardLedger.maxEntries;
  let entries = [];
  let idCounter = 0;
  if (existsSync30(storageFile)) {
    try {
      const data = JSON.parse(readFileSync30(storageFile, "utf-8"));
      entries = Array.isArray(data.entries) ? data.entries.slice(-maxEntries) : [];
      idCounter = entries.length;
    } catch {
    }
  }
  function persistLedger() {
    schedulePersist(storageFile, () => JSON.stringify({ entries }, null, 2));
  }
  function record(source, contribution, context) {
    const reward = clampReward(contribution);
    if (Math.abs(reward) < 1e-9) return;
    entries.push({
      id: `rw_${Date.now()}_${++idCounter}`,
      timestamp: Date.now(),
      reward: Math.round(reward * 1e3) / 1e3,
      source,
      ...context !== void 0 ? { context } : {}
    });
    if (entries.length > maxEntries) {
      entries = entries.slice(-maxEntries);
    }
    persistLedger();
    bus.emitSync("reward:recorded", {
      reward,
      source,
      ...context !== void 0 ? { context } : {}
    });
  }
  function getRecentEntries(n = 20) {
    return entries.slice(-n);
  }
  function getAverageReward(n = 50) {
    const recent = entries.slice(-n);
    if (recent.length === 0) return 0;
    return recent.reduce((sum, e) => sum + e.reward, 0) / recent.length;
  }
  const unsubscribers = [];
  unsubscribers.push(
    bus.on("dopamine:reward", (signal) => {
      const contribution = clampReward(signal.reward) * SOURCE_WEIGHTS.dopamine;
      record("dopamine", contribution, signal.context.domain);
    })
  );
  unsubscribers.push(
    bus.on("proactive:reaction", (data) => {
      const raw = PROACTIVE_SIGNAL_VALUE[data.signal] ?? 0;
      if (raw === 0) return;
      record("proactive-reaction", raw * SOURCE_WEIGHTS["proactive-reaction"], data.domain);
    })
  );
  unsubscribers.push(
    bus.on("basal:reinforced", (data) => {
      if (data.signal === "neutral") return;
      const raw = data.signal === "positive" ? 1 : -1;
      record("basal-reinforcement", raw * SOURCE_WEIGHTS["basal-reinforcement"], data.habitId);
    })
  );
  unsubscribers.push(
    bus.on("cerebellum:validated", (data) => {
      const raw = data.passed ? 1 : -1.3;
      record("cerebellum-validation", clampReward(raw) * SOURCE_WEIGHTS["cerebellum-validation"]);
    })
  );
  unsubscribers.push(
    bus.on("pathway:prediction-validated", (data) => {
      const raw = data.wasCorrect ? 1 : -1;
      record(
        "prediction-validation",
        raw * SOURCE_WEIGHTS["prediction-validation"],
        data.predictionTopic
      );
    })
  );
  function unsubscribe() {
    for (const unsub of unsubscribers) {
      unsub();
    }
    unsubscribers.length = 0;
  }
  return {
    record,
    getRecentEntries,
    getAverageReward,
    getStats: () => ({
      entries: entries.length,
      averageReward: getAverageReward(),
      lastEntryTimestamp: entries.length > 0 ? entries[entries.length - 1].timestamp : 0
    }),
    stop: () => {
      unsubscribe();
      flushPersist(storageFile);
    },
    dispose: () => {
      unsubscribe();
      flushPersist(storageFile);
    }
  };
}
var active39;
function initRewardLedger(workspaceDir, config) {
  active39?.dispose();
  active39 = createRewardLedger(workspaceDir, config);
}
function stopRewardLedger() {
  active39?.stop();
  active39 = void 0;
}

// src/modules/thalamic-gate.ts
function createThalamicGate(config, signalProviders) {
  let gateConfig = config;
  let providers = signalProviders ?? {};
  let totalChecks = 0;
  let totalActivations = 0;
  let totalSkips = 0;
  let consecutiveSkips = 0;
  let lastActivationTime = 0;
  let lastScore = 0;
  let lastDominantSignal = "";
  function bypass(reason) {
    return { activate: true, score: 1, dominantSignal: reason, signals: [] };
  }
  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }
  function weight(source) {
    return gateConfig?.signalWeights[source] ?? 0.5;
  }
  function collectSignals() {
    const signals = [];
    try {
      const vi = providers.getVitalImpulseStats?.();
      if (vi && vi.effectiveThreshold > 0) {
        signals.push({
          source: "vital-impulse",
          value: clamp01(vi.currentPressure / vi.effectiveThreshold),
          weight: weight("vital-impulse")
        });
      }
    } catch {
    }
    try {
      const assessment = providers.getAmygdalaAssessment?.();
      if (assessment) {
        signals.push({
          source: "amygdala-urgency",
          value: assessment.urgency,
          weight: weight("amygdala-urgency")
        });
      }
    } catch {
    }
    try {
      const neuro = providers.getNeuromodulatorState?.();
      if (neuro) {
        signals.push({
          source: "norepinephrine",
          value: neuro.norepinephrine,
          weight: weight("norepinephrine")
        });
      }
    } catch {
    }
    try {
      const satiations = [];
      const social = providers.getSocialDriveSatiation?.();
      if (social !== void 0) satiations.push(social);
      const cognitive = providers.getCognitiveHungerSatiation?.();
      if (cognitive !== void 0) satiations.push(cognitive);
      const creative = providers.getCreativeDriveSatiation?.();
      if (creative !== void 0) satiations.push(creative);
      const mastery = providers.getMasteryDriveSatiation?.();
      if (mastery !== void 0) satiations.push(mastery);
      if (satiations.length > 0) {
        const lowestSatiation = Math.min(...satiations);
        signals.push({
          source: "drive-need",
          value: clamp01(1 - lowestSatiation),
          weight: weight("drive-need")
        });
      }
    } catch {
    }
    try {
      const goals = providers.getGoalStackStats?.();
      if (goals && goals.triggered > 0) {
        signals.push({
          source: "goal-triggered",
          value: 1,
          weight: weight("goal-triggered")
        });
      }
    } catch {
    }
    try {
      const dmn = providers.getDMNStats?.();
      if (dmn && dmn.unusedInsightCount > 0) {
        signals.push({
          source: "dmn-insight",
          value: clamp01(dmn.unusedInsightCount / 3),
          weight: weight("dmn-insight")
        });
      }
    } catch {
    }
    return signals;
  }
  function shouldActivateCortex(ctx, nowMs) {
    const now = nowMs ?? Date.now();
    if (ctx.isUserMessage) {
      return bypass("user-message");
    }
    if (ctx.isEventDriven) {
      return bypass("event-driven");
    }
    if (!gateConfig?.enabled) {
      return bypass("gate-disabled");
    }
    totalChecks++;
    if (consecutiveSkips >= gateConfig.maxConsecutiveSkips) {
      consecutiveSkips = 0;
      lastActivationTime = now;
      totalActivations++;
      lastScore = 0.5;
      lastDominantSignal = "safety-valve";
      return {
        activate: true,
        score: 0.5,
        dominantSignal: "safety-valve",
        signals: []
      };
    }
    if (lastActivationTime > 0 && now - lastActivationTime < gateConfig.minIntervalBetweenActivations) {
      consecutiveSkips++;
      totalSkips++;
      lastScore = 0;
      lastDominantSignal = "cooldown";
      return {
        activate: false,
        score: 0,
        dominantSignal: "cooldown",
        signals: []
      };
    }
    const signals = collectSignals();
    const score = signals.length > 0 ? Math.max(...signals.map((s) => s.value * s.weight)) : 0;
    const dominant = signals.length > 0 ? signals.reduce((a, b) => a.value * a.weight > b.value * b.weight ? a : b) : { source: "none", value: 0, weight: 0 };
    if (score >= gateConfig.activationThreshold) {
      consecutiveSkips = 0;
      lastActivationTime = now;
      totalActivations++;
      lastScore = score;
      lastDominantSignal = dominant.source;
      return { activate: true, score, dominantSignal: dominant.source, signals };
    }
    consecutiveSkips++;
    totalSkips++;
    lastScore = score;
    lastDominantSignal = dominant.source;
    return { activate: false, score, dominantSignal: dominant.source, signals };
  }
  function getStats2() {
    return {
      totalChecks,
      totalActivations,
      totalSkips,
      consecutiveSkips,
      lastActivationTime,
      lastScore,
      lastDominantSignal
    };
  }
  function reset() {
    totalChecks = 0;
    totalActivations = 0;
    totalSkips = 0;
    consecutiveSkips = 0;
    lastActivationTime = 0;
    lastScore = 0;
    lastDominantSignal = "";
    gateConfig = void 0;
    providers = {};
  }
  return { shouldActivateCortex, getStats: getStats2, reset };
}
var active40 = null;
function current25() {
  if (!active40) active40 = createThalamicGate();
  return active40;
}
function initThalamicGate(config, signalProviders) {
  active40 = createThalamicGate(config, signalProviders);
}
function getThalamicGateStats() {
  return current25().getStats();
}

// src/modules/message-guard.ts
var INTERNAL_MESSAGE_PREFIXES = [
  "<brainagent-context>",
  "<autonomous-intent>",
  // v0.5.1: проактивная доставка приходит с фреймингом перед тегом —
  // распознаём и его, чтобы доставленный промпт не обрабатывался
  // контуром обучения как реплика пользователя.
  AUTONOMOUS_FRAME_PREFIX
];
function isInternalPluginMessage(text) {
  const trimmed = text.trimStart();
  return INTERNAL_MESSAGE_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

// src/adapter/llm-bridge.ts
import { createUserMessage as createUserMessage2 } from "@deepseek-ai/dsh-llm";
var ROUTE_CACHE_MS = 6e4;
function attachLlmBridge(ctx, preferredModel) {
  let cachedRoute;
  let cachedAt = 0;
  let resolving;
  async function resolveRoute() {
    if (cachedRoute && Date.now() - cachedAt < ROUTE_CACHE_MS) return cachedRoute;
    if (resolving) return resolving;
    resolving = (async () => {
      try {
        if (!ctx.llm) return void 0;
        if (preferredModel) {
          const slash = preferredModel.indexOf("/");
          if (slash > 0) {
            return {
              provider: preferredModel.slice(0, slash),
              model: preferredModel.slice(slash + 1)
            };
          }
        }
        for (const provider of ctx.llm.listProviders()) {
          const models = await ctx.llm.listModels(provider.id);
          if (models.length > 0) {
            return { provider: provider.id, model: models[0].id };
          }
        }
        return void 0;
      } catch {
        return void 0;
      } finally {
        resolving = void 0;
        cachedAt = Date.now();
      }
    })();
    cachedRoute = await resolving ?? cachedRoute;
    return cachedRoute;
  }
  setAIAvailabilityHook(() => Boolean(preferredModel) || cachedRoute !== void 0);
  setCallLLMBackend(async (systemPrompt, userText, _config, logger, maxTokens) => {
    const route = await resolveRoute();
    if (!route || !ctx.llm) return void 0;
    try {
      const chunks = ctx.llm.stream({
        provider: route.provider,
        model: route.model,
        system: systemPrompt,
        messages: [
          createUserMessage2({
            content: [{ type: "text", text: userText }],
            source: { kind: "plugin", plugin: "brainagent" }
          })
        ],
        temperature: 0.1,
        maxTokens: maxTokens ?? 500
      });
      let text = "";
      for await (const chunk of chunks) {
        if (chunk.type === "text-delta") {
          text += chunk.text;
        }
      }
      return text.trim() ? text : null;
    } catch (error) {
      logger?.info(`BrainAgent LLM bridge: ctx.llm call failed \u2014 ${String(error)}`);
      return void 0;
    }
  });
  void resolveRoute();
  return () => {
    setCallLLMBackend(void 0);
    setAIAvailabilityHook(void 0);
  };
}

// src/modules/commands.ts
function createCommandRegistry() {
  let workingMemoryStatsGetter;
  let sessionBridgeStatsGetter;
  let attentionStatsGetter;
  let dmnStatsGetter;
  let introspectionTraceGetter;
  let introspectionStatsGetter;
  let identityStatsGetter;
  let goalStackStatsGetter;
  let curiosityStatsGetter;
  let temporalBindingStatsGetter;
  let qualiaSimulatorStatsGetter;
  let vitalImpulseStatsGetter;
  let goalExecutorStatsGetter;
  let socialDriveStatsGetter;
  let cognitiveHungerStatsGetter;
  let creativeDriveStatsGetter;
  let masteryDriveStatsGetter;
  let driveArbiterStatsGetter;
  let temporalAwarenessStatsGetter;
  let thalamicGateStatsGetter;
  let autonomousResearchStatsGetter;
  function setStatGetters(getters) {
    workingMemoryStatsGetter = getters.workingMemory;
    sessionBridgeStatsGetter = getters.sessionBridge;
    attentionStatsGetter = getters.attention;
    dmnStatsGetter = getters.dmn;
    introspectionTraceGetter = getters.introspectionTrace;
    introspectionStatsGetter = getters.introspectionStats;
    identityStatsGetter = getters.identity;
    goalStackStatsGetter = getters.goalStack;
    curiosityStatsGetter = getters.curiosity;
    temporalBindingStatsGetter = getters.temporalBinding;
    qualiaSimulatorStatsGetter = getters.qualiaSimulator;
    vitalImpulseStatsGetter = getters.vitalImpulse;
    goalExecutorStatsGetter = getters.goalExecutor;
    socialDriveStatsGetter = getters.socialDrive;
    cognitiveHungerStatsGetter = getters.cognitiveHunger;
    creativeDriveStatsGetter = getters.creativeDrive;
    masteryDriveStatsGetter = getters.masteryDrive;
    driveArbiterStatsGetter = getters.driveArbiter;
    temporalAwarenessStatsGetter = getters.temporalAwareness;
    thalamicGateStatsGetter = getters.thalamicGate;
    autonomousResearchStatsGetter = getters.autonomousResearch;
  }
  function register(api, config) {
    api.registerCommand({
      name: "brainagent",
      description: "BrainAgent cognitive architecture diagnostics and control",
      acceptsArgs: true,
      handler: async (ctx) => {
        const args = (ctx.args ?? "").trim();
        if (args === "status" || args === "") {
          return buildStatus(config);
        }
        if (args === "dream") {
          const result = await forceConsolidation(config, api.logger, api.config);
          return {
            text: [
              "**BrainAgent Dream Mode**: forced consolidation complete.",
              `- Merged: ${result.merged} duplicate facts`,
              `- Pruned: ${result.pruned} weak memories`,
              `- Strengthened: ${result.strengthened} important memories`,
              `- Contradictions found: ${result.contradictions}`
            ].join("\n")
          };
        }
        if (args === "memory") {
          const stats = getStats();
          return {
            text: [
              "**BrainAgent Memory Stats**",
              `- Episodic memories: ${stats.episodic}`,
              `- Semantic facts: ${stats.semantic}`,
              `- Procedural workflows: ${stats.procedural}`,
              `- Vector vocabulary: ep=${stats.vectorVocabulary.episodic}, sem=${stats.vectorVocabulary.semantic}, proc=${stats.vectorVocabulary.procedural}`
            ].join("\n")
          };
        }
        if (args === "predict") {
          const predictions = predict();
          const pStats = getPredictiveStats();
          if (predictions.length === 0) {
            return {
              text: [
                "**BrainAgent Predictive Engine**",
                `Patterns learned: temporal=${pStats.temporalPatterns}, sequential=${pStats.sequentialPatterns}, contextual=${pStats.contextualPatterns}`,
                `Total observations: ${pStats.totalObservations}`,
                "No predictions at this moment (need more observations)."
              ].join("\n")
            };
          }
          return {
            text: [
              "**BrainAgent Predictive Engine**",
              `Patterns: temporal=${pStats.temporalPatterns}, sequential=${pStats.sequentialPatterns}, contextual=${pStats.contextualPatterns}`,
              "",
              "**Current Predictions:**",
              ...predictions.map(
                (p, i) => `${i + 1}. [${p.type}] ${p.predictedTopic} \u2014 ${(p.confidence * 100).toFixed(0)}% (${p.reasoning})`
              )
            ].join("\n")
          };
        }
        if (args === "habits") {
          const hStats = getBasalStats();
          return {
            text: [
              "**BrainAgent Basal Ganglia (Habits)**",
              `- Total habits: ${hStats.totalHabits}`,
              `- Automated habits: ${hStats.automatedHabits}`,
              `- Average reward: ${(hStats.averageReward * 100).toFixed(0)}%`,
              `- Total activations: ${hStats.totalActivations}`
            ].join("\n")
          };
        }
        if (args === "dopamine" || args === "neuro") {
          const dStats = getDopamineStats();
          const ns = dStats.currentState;
          return {
            text: [
              "**BrainAgent Neuromodulatory System**",
              "",
              "**Current Levels:**",
              `  Dopamine (reward/motivation): ${(ns.dopamine * 100).toFixed(0)}%`,
              `  Serotonin (mood/risk):        ${(ns.serotonin * 100).toFixed(0)}%`,
              `  Norepinephrine (attention):    ${(ns.norepinephrine * 100).toFixed(0)}%`,
              `  Acetylcholine (learning):      ${(ns.acetylcholine * 100).toFixed(0)}%`,
              "",
              "**Stats:**",
              `  Expected reward baseline: ${(dStats.expectedReward * 100).toFixed(0)}%`,
              `  Average recent reward:    ${(dStats.averageReward * 100).toFixed(0)}%`,
              `  Total interactions:       ${dStats.totalInteractions}`,
              `  Novelty ratio:            ${(dStats.noveltyRatio * 100).toFixed(0)}%`
            ].join("\n")
          };
        }
        if (args === "learning") {
          const lStats = getLearningStats();
          const lines = [
            "**BrainAgent Learning Coordinator (Meta-Cognition)**",
            "",
            `Learning cycles: ${lStats.cycleCount}`,
            `Active insights: ${lStats.activeInsights}`,
            `Tracked modules: ${lStats.moduleCount}`
          ];
          if (Object.keys(lStats.modulePerformance).length > 0) {
            lines.push("", "**Per-Module Performance:**");
            for (const [mod, perf] of Object.entries(lStats.modulePerformance)) {
              const trendIcon = perf.trend === "improving" ? "^" : perf.trend === "degrading" ? "v" : "=";
              lines.push(
                `  ${mod}: reward=${(perf.avgReward * 100).toFixed(0)}% err=${(perf.errorRate * 100).toFixed(0)}% [${trendIcon}]`
              );
            }
          }
          if (lStats.recentInsights.length > 0) {
            lines.push("", "**Recent Insights:**");
            for (const insight of lStats.recentInsights) {
              lines.push(`  [${insight.type}] ${insight.description}`);
            }
          }
          return { text: lines.join("\n") };
        }
        if (args === "pathways") {
          const pStats = getPathwayStats();
          const ns = pStats.neuroState;
          return {
            text: [
              "**BrainAgent Neural Pathways**",
              "",
              `Active pathways: ${pStats.pathwayCount}`,
              `Current habit in cycle: ${pStats.currentHabitId ?? "none"}`,
              `Pending predictions: ${pStats.lastPredictionCount}`,
              `Total learning cycles: ${pStats.totalLearningCycles}`,
              "",
              "**Neuromodulator Influence:**",
              `  Dopamine:        ${(ns.dopamine * 100).toFixed(0)}%`,
              `  Serotonin:       ${(ns.serotonin * 100).toFixed(0)}%`,
              `  Norepinephrine:  ${(ns.norepinephrine * 100).toFixed(0)}%`,
              `  Acetylcholine:   ${(ns.acetylcholine * 100).toFixed(0)}%`
            ].join("\n")
          };
        }
        if (args === "synapses" || args === "weights") {
          const sStats = getSynapticStats();
          const lines = [
            "**BrainAgent Synaptic Plasticity (Hebbian Learning)**",
            "",
            `Total learning cycles: ${sStats.totalCycles}`,
            `Learning rate: ${sStats.learningRate}`,
            `Strongest pathway: ${sStats.strongestPathway ?? "none"}`,
            `Weakest pathway: ${sStats.weakestPathway ?? "none"}`,
            "",
            "**Pathway Weights:**"
          ];
          for (const p of sStats.pathways) {
            const bar = "#".repeat(Math.round(p.weight * 5)) + ".".repeat(Math.round((2 - p.weight) * 5));
            const trendIcon = p.trend === "strengthening" ? "^" : p.trend === "weakening" ? "v" : "=";
            lines.push(
              `  ${p.name.padEnd(25)} ${bar} ${p.weight.toFixed(2)} (${p.activationCount} acts, avg=${p.avgReward.toFixed(2)}) ${trendIcon}`
            );
          }
          return { text: lines.join("\n") };
        }
        if (args === "personality" || args === "style") {
          const userId = "default";
          const userModel = getUserModel(userId);
          const styleRec = getStyleRecommendation(userId);
          const lines = [
            "**BrainAgent Personality Evolution (Mirror Neurons)**",
            "",
            `Current detected style: ${userModel?.communicationStyle ?? "unknown"}`,
            `Recommended response style: ${userModel?.preferredResponseStyle ?? "unknown"}`
          ];
          if (userModel?.styleRewards) {
            lines.push("", "**Per-Style Reward History:**");
            for (const [style, entry] of Object.entries(userModel.styleRewards)) {
              const avg = entry.count > 0 ? (entry.total / entry.count).toFixed(2) : "n/a";
              lines.push(`  ${style}: avg=${avg}, samples=${entry.count}`);
            }
          }
          if (styleRec) {
            lines.push(
              "",
              `**Active Recommendation:** ${styleRec.style} (${(styleRec.confidence * 100).toFixed(0)}% confidence)`
            );
          } else {
            lines.push("", "Not enough data yet for style recommendation.");
          }
          return { text: lines.join("\n") };
        }
        if (args === "structure" || args === "structural") {
          const sStats = getStructuralStats();
          const lines = [
            "**BrainAgent Structural Plasticity (Neurogenesis)**",
            "",
            `Total cycles analyzed: ${sStats.totalCycles}`,
            `Co-activation pairs tracked: ${sStats.coActivationPairs}`,
            "",
            "**Dynamic Pathways:**",
            `  Active: ${sStats.dynamicPathways.active}`,
            `  Dormant: ${sStats.dynamicPathways.dormant}`,
            `  Pruned: ${sStats.dynamicPathways.pruned}`
          ];
          if (sStats.topCorrelations.length > 0) {
            lines.push("", "**Top Co-Activated Module Pairs:**");
            for (const c of sStats.topCorrelations) {
              const bar = "#".repeat(Math.round(c.correlation * 10));
              lines.push(
                `  ${c.moduleA} <-> ${c.moduleB}: ${bar} ${(c.correlation * 100).toFixed(0)}%`
              );
            }
          }
          if (sStats.pathwayDetails.length > 0) {
            lines.push("", "**Active Dynamic Pathways:**");
            for (const p of sStats.pathwayDetails) {
              lines.push(
                `  ${p.from} -> ${p.to}: strength=${p.strength.toFixed(2)}, uses=${p.usageCount}, avgReward=${p.avgReward.toFixed(2)}`
              );
            }
          }
          return { text: lines.join("\n") };
        }
        if (args === "emergent" || args === "patterns") {
          const eStats = getEmergentStats();
          const lines = [
            "**BrainAgent Emergent Modules (Self-Discovered Specializations)**",
            "",
            `Total patterns discovered: ${eStats.totalDiscovered}`,
            `Emerging: ${eStats.emerging} | Established: ${eStats.established} | Deprecated: ${eStats.deprecated}`
          ];
          if (eStats.topModules.length > 0) {
            lines.push("", "**Top Emergent Modules:**");
            for (const m of eStats.topModules) {
              const statusIcon = m.status === "established" ? "[ok]" : "[..]";
              lines.push(
                `  ${statusIcon} "${m.name}" [${m.domain}]`,
                `    Modules: ${m.participants.join(" + ")}`,
                `    Avg reward: ${m.avgReward.toFixed(2)}, Confidence: ${(m.confidence * 100).toFixed(0)}%`
              );
            }
          } else {
            lines.push("", "No emergent patterns discovered yet.");
          }
          return { text: lines.join("\n") };
        }
        if (args === "metabolic" || args === "energy") {
          const mStats = getMetabolicStats();
          const lines = [
            "**BrainAgent Metabolic Budget (Energy Allocation)**",
            "",
            `Total budget: ${mStats.totalBudget.toFixed(1)} units`,
            `Currently used: ${mStats.usedEnergy.toFixed(2)} units`,
            `Cycles since rebalance: ${mStats.cyclesSinceRebalance}`
          ];
          if (mStats.lowPowerModules.length > 0) {
            lines.push("", `**Modules in Low Power Mode:** ${mStats.lowPowerModules.join(", ")}`);
          }
          lines.push(
            "",
            `**Top Performers:** ${mStats.topPerformers.join(", ")}`,
            "",
            "**Module Energy Levels:**"
          );
          for (const m of mStats.modules.sort((a, b) => b.energy - a.energy)) {
            const bar = "#".repeat(Math.round(m.energy * 10)) + ".".repeat(Math.round((1 - m.energy) * 10));
            const lowPower = m.lowPowerMode ? " [LOW POWER]" : "";
            lines.push(
              `  ${m.name.padEnd(20)} ${bar} ${(m.energy * 100).toFixed(0)}% (perf: ${(m.performance * 100).toFixed(0)}%)${lowPower}`
            );
          }
          return { text: lines.join("\n") };
        }
        if (args === "circadian" || args === "sleep" || args === "wake") {
          if (!config.circadian?.enabled) {
            return { text: "**Circadian Rhythm:** disabled in config" };
          }
          const cStats = getCircadianStats();
          const phaseLabel = cStats.phase === "wake" ? "[WAKE]" : cStats.phase === "sleep" ? "[SLEEP]" : cStats.phase === "transition-to-sleep" ? "[->SLEEP]" : "[->WAKE]";
          const lines = [
            "**BrainAgent Circadian Rhythm (Sleep-Wake Cycles)**",
            "",
            `**Current Phase:** ${phaseLabel} ${cStats.phase.toUpperCase()}`,
            `  Phase duration: ${Math.floor(cStats.phaseDuration / 1e3)}s`,
            `  Phase progress: ${(cStats.phaseProgress * 100).toFixed(0)}%`,
            "",
            `**Activity:**`,
            `  Idle time: ${Math.floor(cStats.idleTime / 1e3)}s`,
            `  Activity level: ${(cStats.activityLevel * 100).toFixed(0)}%`,
            `  Wake interactions: ${cStats.wakeInteractions}`,
            `  Sleep consolidations: ${cStats.sleepConsolidations}`,
            "",
            "**Neuromodulator Modulation:**"
          ];
          const mod = cStats.modulation;
          lines.push(
            `  Dopamine:        ${mod.dopamine > 1 ? "+" : ""}${((mod.dopamine - 1) * 100).toFixed(0)}%`,
            `  Serotonin:       ${mod.serotonin > 1 ? "+" : ""}${((mod.serotonin - 1) * 100).toFixed(0)}%`,
            `  Acetylcholine:   ${mod.acetylcholine > 1 ? "+" : ""}${((mod.acetylcholine - 1) * 100).toFixed(0)}%`,
            `  Norepinephrine:  ${mod.norepinephrine > 1 ? "+" : ""}${((mod.norepinephrine - 1) * 100).toFixed(0)}%`
          );
          lines.push(
            "",
            "**Sleep Settings:**",
            `  Consolidation intensity: ${(cStats.sleepSettings.consolidationIntensity * 100).toFixed(0)}%`,
            `  Pruning aggressiveness: ${(cStats.sleepSettings.pruningAggressiveness * 100).toFixed(0)}%`,
            `  Synaptic normalization: ${cStats.sleepSettings.synapticNormalization ? "ON" : "OFF"}`
          );
          return { text: lines.join("\n") };
        }
        if (args.startsWith("force-")) {
          const phase = args.replace("force-", "");
          if (phase === "wake" || phase === "sleep") {
            forcePhase(phase);
            return { text: `**Circadian:** forced phase to ${phase}` };
          }
        }
        if (args === "wm" || args === "working-memory") {
          if (!workingMemoryStatsGetter) return { text: "Working Memory: module not loaded" };
          const s = workingMemoryStatsGetter();
          return {
            text: [
              "**BrainAgent Working Memory**",
              `  Entries: ${s.entryCount}`,
              `  Oldest: ${s.oldestTimestamp ? new Date(s.oldestTimestamp).toLocaleString() : "none"}`,
              `  Newest: ${s.newestTimestamp ? new Date(s.newestTimestamp).toLocaleString() : "none"}`
            ].join("\n")
          };
        }
        if (args === "session") {
          if (!sessionBridgeStatsGetter) return { text: "Session Bridge: module not loaded" };
          const s = sessionBridgeStatsGetter();
          return {
            text: [
              "**BrainAgent Session Bridge**",
              `  Current session cycles: ${s.currentCycles}`,
              `  Last session topics: ${s.lastSessionTopics.length > 0 ? s.lastSessionTopics.join(", ") : "none"}`,
              `  Gap detected: ${s.gapDetected ? "yes" : "no"}`
            ].join("\n")
          };
        }
        if (args === "attention") {
          if (!attentionStatsGetter) return { text: "Attention Gate: module not loaded" };
          const s = attentionStatsGetter();
          return {
            text: [
              "**BrainAgent Attention Gate**",
              `  Total sections processed: ${s.totalProcessed}`,
              `  Total sections dropped: ${s.totalDropped}`,
              `  Avg relevance score: ${(s.avgRelevance * 100).toFixed(0)}%`
            ].join("\n")
          };
        }
        if (args === "dmn") {
          if (!dmnStatsGetter) return { text: "Default Mode Network: module not loaded" };
          const s = dmnStatsGetter();
          return {
            text: [
              "**BrainAgent Default Mode Network**",
              `  Total insights: ${s.totalInsights}`,
              `  Last run: ${s.lastRunTimestamp ? new Date(s.lastRunTimestamp).toLocaleString() : "never"}`,
              `  Associations found: ${s.associationsFound}`,
              `  Background thoughts: ${s.backgroundThoughts}`
            ].join("\n")
          };
        }
        if (args === "explain") {
          if (!introspectionTraceGetter) return { text: "Introspection: module not loaded" };
          const trace = introspectionTraceGetter();
          if (!trace) return { text: "No processing trace available yet." };
          const lines = [
            "**BrainAgent Introspection \u2014 Last Processing Trace**",
            "",
            `Input: ${trace.inputSnippet}`,
            `Confidence: ${(trace.finalConfidence * 100).toFixed(0)}%`,
            `Cerebellum: ${trace.cerebellumPassed ? "PASSED" : "FAILED"}`,
            `Reward: ${(trace.reward * 100).toFixed(0)}%`,
            "",
            "**Processing Steps:**"
          ];
          for (const step of trace.steps) {
            lines.push(`  [${step.hook}] ${step.module}: ${step.outputSummary}`);
          }
          return { text: lines.join("\n") };
        }
        if (args === "identity") {
          if (!identityStatsGetter) return { text: "Agent Identity: module not loaded" };
          const s = identityStatsGetter();
          const lines = [
            "**BrainAgent Agent Identity**",
            "",
            `Total cycles: ${s.totalCycles}`,
            `Snapshots: ${s.snapshotCount}`,
            `Lessons learned: ${s.lessonsCount}`,
            `Autobiographical memories: ${s.autobiographicalCount}`
          ];
          if (Object.keys(s.capabilities).length > 0) {
            lines.push("", "**Domain Capabilities:**");
            for (const [domain, cap] of Object.entries(s.capabilities)) {
              const trendIcon = cap.trend === "improving" ? "^" : cap.trend === "degrading" ? "v" : "=";
              lines.push(`  ${domain}: ${(cap.avgReward * 100).toFixed(0)}% [${trendIcon}]`);
            }
          }
          return { text: lines.join("\n") };
        }
        if (args === "goals") {
          if (!goalStackStatsGetter) return { text: "Goal Stack: module not loaded" };
          const s = goalStackStatsGetter();
          return {
            text: [
              "**BrainAgent Goal Stack**",
              `  Total goals: ${s.total}`,
              `  Pending: ${s.pending}`,
              `  Triggered: ${s.triggered}`,
              `  Completed: ${s.completed}`,
              `  Expired: ${s.expired}`,
              `  Active desires: ${s.desireCount}`,
              `  Decisions logged: ${s.decisionCount}`
            ].join("\n")
          };
        }
        if (args === "curiosity") {
          if (!curiosityStatsGetter) return { text: "Curiosity Drive: module not loaded" };
          const s = curiosityStatsGetter();
          return {
            text: [
              "**BrainAgent Curiosity Drive**",
              `  Open knowledge gaps: ${s.openGaps}`,
              `  Total gaps detected: ${s.totalDetected}`,
              `  Questions generated: ${s.questionsGenerated}`,
              `  Gaps filled: ${s.gapsFilled}`
            ].join("\n")
          };
        }
        if (args === "temporal" || args === "stream") {
          if (!temporalBindingStatsGetter) return { text: "Temporal Binding: module not loaded" };
          const s = temporalBindingStatsGetter();
          return {
            text: [
              "**BrainAgent Temporal Binding (Consciousness Stream)**",
              `  Moments in stream: ${s.momentCount}`,
              `  Oldest: ${s.oldestTimestamp ? new Date(s.oldestTimestamp).toLocaleString() : "none"}`,
              `  Newest: ${s.newestTimestamp ? new Date(s.newestTimestamp).toLocaleString() : "none"}`,
              `  Dominant domain: ${s.dominantDomain ?? "none"}`
            ].join("\n")
          };
        }
        if (args === "qualia" || args === "subjective") {
          if (!qualiaSimulatorStatsGetter) return { text: "Qualia Simulator: module not loaded" };
          const s = qualiaSimulatorStatsGetter();
          return {
            text: [
              "**BrainAgent Qualia Simulator (Subjective Experience)**",
              `  Current emotion: ${s.currentEmotion ?? "none"}`,
              `  Intensity: ${(s.currentIntensity * 100).toFixed(0)}%`,
              `  Experience log: ${s.logSize} entries`,
              `  Dominant color: ${s.dominantColor ?? "none"}`
            ].join("\n")
          };
        }
        if (args === "meta" || args === "meta-consciousness") {
          if (!introspectionStatsGetter) return { text: "Introspection: module not loaded" };
          const s = introspectionStatsGetter();
          return {
            text: [
              "**BrainAgent Meta-Consciousness**",
              `  Processing traces: ${s.traceCount}`,
              `  Avg confidence: ${(s.avgConfidence * 100).toFixed(0)}%`,
              `  Self-dialogue entries: ${s.selfDialogueCount}`,
              `  Meta-awareness snapshots: ${s.metaSnapshotCount}`
            ].join("\n")
          };
        }
        if (args === "impulse" || args === "vital-impulse") {
          if (!vitalImpulseStatsGetter) return { text: "Vital Impulse: module not loaded" };
          const vi = vitalImpulseStatsGetter();
          const pressurePct = vi.currentPressure / vi.effectiveThreshold * 100;
          const bar = "\u2588".repeat(Math.min(20, Math.round(pressurePct / 5))) + "\u2591".repeat(Math.max(0, 20 - Math.round(pressurePct / 5)));
          return {
            text: [
              "**BrainAgent Vital Impulse (Autonomous Communication)**",
              "",
              `  Pressure: [${bar}] ${pressurePct.toFixed(0)}%`,
              `  Current:   ${vi.currentPressure.toFixed(3)} / ${vi.effectiveThreshold.toFixed(3)} (threshold)`,
              `  Refractory: ${vi.isInRefractory ? `cooling down (${(vi.refractoryRemainingMs / 1e3).toFixed(0)}s left)` : "ready to fire"}`,
              "",
              `  Total fires:    ${vi.totalFires}`,
              `  Signals recv:   ${vi.totalSignalsReceived}`,
              `  Recent signals: ${vi.recentSignalCount}`,
              `  Last fire:      ${vi.lastFireTime ? new Date(vi.lastFireTime).toLocaleString() : "never"}`
            ].join("\n")
          };
        }
        if (args === "impulse force" || args === "vital-impulse force") {
          if (!vitalImpulseStatsGetter) return { text: "Vital Impulse: module not loaded" };
          forceImpulse("Manual impulse triggered via /brainagent impulse force");
          return { text: "**BrainAgent Vital Impulse**: forced autonomous impulse fired." };
        }
        return {
          text: [
            "**BrainAgent Commands:**",
            "`/brainagent status` \u2014 show full module status",
            "`/brainagent memory` \u2014 show memory statistics",
            "`/brainagent predict` \u2014 show predictions and pattern stats",
            "`/brainagent habits` \u2014 show habit formation stats",
            "`/brainagent dream` \u2014 force memory consolidation",
            "`/brainagent dopamine` \u2014 show neuromodulator levels",
            "`/brainagent learning` \u2014 show meta-cognitive learning stats",
            "`/brainagent pathways` \u2014 show cross-module pathway status",
            "`/brainagent synapses` \u2014 show synaptic weights (Hebbian learning)",
            "`/brainagent structure` \u2014 show structural plasticity (dynamic pathways)",
            "`/brainagent emergent` \u2014 show emergent modules (self-discovered patterns)",
            "`/brainagent metabolic` \u2014 show energy allocation",
            "`/brainagent personality` \u2014 show personality evolution and style adaptation",
            "`/brainagent circadian` \u2014 show sleep-wake cycle status",
            "`/brainagent wm` \u2014 show working memory buffer",
            "`/brainagent session` \u2014 show session bridge status",
            "`/brainagent attention` \u2014 show attention gate stats",
            "`/brainagent dmn` \u2014 show default mode network status",
            "`/brainagent explain` \u2014 show last processing trace",
            "`/brainagent identity` \u2014 show agent identity/capabilities",
            "`/brainagent goals` \u2014 show goal stack status",
            "`/brainagent curiosity` \u2014 show curiosity drive stats",
            "`/brainagent temporal` \u2014 show consciousness stream (temporal binding)",
            "`/brainagent qualia` \u2014 show subjective experience (qualia simulator)",
            "`/brainagent meta` \u2014 show meta-consciousness stats",
            "`/brainagent impulse` \u2014 show vital impulse (autonomous communication) status",
            "`/brainagent impulse force` \u2014 force an autonomous impulse",
            "`/brainagent force-wake` \u2014 force wake phase",
            "`/brainagent force-sleep` \u2014 force sleep phase"
          ].join("\n")
        };
      }
    });
  }
  function buildStatus(config) {
    const memStats = getStats();
    const dreamStats = getDreamStats();
    const pStats = getPredictiveStats();
    const hStats = getBasalStats();
    const lines = [
      "**BrainAgent Cognitive Architecture \u2014 Status**",
      "",
      "**Core Modules:**",
      `  Thalamus (classifier):        ${config.modules.thalamus ? "ON" : "OFF"}`,
      `  Amygdala (emotion/priority):   ${config.modules.amygdala ? "ON" : "OFF"}`,
      `  Hippocampus (memory):          ${config.modules.hippocampus ? "ON" : "OFF"}`,
      `  Prefrontal Cortex (reasoning): ${config.modules.prefrontalCortex ? "ON" : "OFF"}`,
      `  Cerebellum (quality):          ${config.modules.cerebellum ? "ON" : "OFF"}`,
      `  Mirror Neurons (empathy):      ${config.modules.mirrorNeurons ? "ON" : "OFF"}`,
      `  Predictive Engine (anticip.):  ${config.modules.predictiveEngine ? "ON" : "OFF"}`,
      `  Basal Ganglia (habits):        ${config.modules.basalGanglia ? "ON" : "OFF"}`,
      `  Dream Mode (consolidation):    ${config.modules.dreamMode ? "ON" : "OFF"}`,
      "",
      "**Integration Modules:**",
      `  Dopamine System (reward):      ${config.modules.neuromodulatorSystem ? "ON" : "OFF"}`,
      `  Learning Coordinator (meta):   ${config.modules.learningCoordinator ? "ON" : "OFF"}`,
      `  Neural Pathways (connections):  ${config.modules.neuralPathways ? "ON" : "OFF"}`,
      "",
      "**Consciousness Modules:**",
      `  Working Memory (continuity):   ${config.modules.workingMemory ? "ON" : "OFF"}`,
      `  Session Bridge (cross-sess.):  ${config.modules.sessionBridge ? "ON" : "OFF"}`,
      `  Emotional Memory (flashbulb):  ${config.modules.emotionalMemory ? "ON" : "OFF"}`,
      `  Attention Gate (filtering):    ${config.modules.attentionGate ? "ON" : "OFF"}`,
      `  DMN (idle thinking):           ${config.modules.dmn ? "ON" : "OFF"}`,
      `  Introspection (self-trace):    ${config.modules.introspection ? "ON" : "OFF"}`,
      `  Agent Identity (self-model):   ${config.modules.agentIdentity ? "ON" : "OFF"}`,
      `  Goal Stack (proactive):        ${config.modules.goalStack ? "ON" : "OFF"}`,
      `  Curiosity Drive (gaps):        ${config.modules.curiosityDrive ? "ON" : "OFF"}`,
      `  Temporal Binding (stream):     ${config.modules.temporalBinding ? "ON" : "OFF"}`,
      `  Qualia Simulator (subjective): ${config.modules.qualiaSimulator ? "ON" : "OFF"}`,
      `  Vital Impulse (autonomous):   ${config.modules.vitalImpulse ? "ON" : "OFF"}`,
      `  Goal Executor (autonomous):   ${config.modules.goalStack ? "ON" : "OFF"}`,
      "",
      "**Autonomic Modules:**",
      `  Metabolic Budget (energy):     ${config.modules.metabolicBudget ? "ON" : "OFF"}`,
      `  Emergent Modules (patterns):   ${config.modules.emergentModules ? "ON" : "OFF"}`,
      `  Interoception (inner state):   ${config.modules.interoception ? "ON" : "OFF"}`,
      `  Proactive Feedback (\xAB\u043D\u0435 \u0437\u0430\u0448\u043B\u043E\xBB): ${config.modules.proactiveFeedback ? "ON" : "OFF"}`,
      "",
      "**Memory:**",
      `  Episodic memories:  ${memStats.episodic}`,
      `  Semantic facts:     ${memStats.semantic}`,
      `  Procedural flows:   ${memStats.procedural}`,
      "",
      "**Predictive Engine:**",
      `  Temporal patterns:    ${pStats.temporalPatterns}`,
      `  Sequential patterns:  ${pStats.sequentialPatterns}`,
      `  Contextual patterns:  ${pStats.contextualPatterns}`,
      "",
      "**Basal Ganglia (Habits):**",
      `  Total habits:       ${hStats.totalHabits}`,
      `  Automated habits:   ${hStats.automatedHabits}`,
      `  Average reward:     ${(hStats.averageReward * 100).toFixed(0)}%`
    ];
    if (config.modules.neuromodulatorSystem) {
      const dStats = getDopamineStats();
      const ns = dStats.currentState;
      lines.push(
        "",
        "**Neuromodulators:**",
        `  Dopamine:        ${(ns.dopamine * 100).toFixed(0)}%`,
        `  Serotonin:       ${(ns.serotonin * 100).toFixed(0)}%`,
        `  Norepinephrine:  ${(ns.norepinephrine * 100).toFixed(0)}%`,
        `  Acetylcholine:   ${(ns.acetylcholine * 100).toFixed(0)}%`
      );
    }
    if (config.modules.learningCoordinator) {
      const lStats = getLearningStats();
      lines.push(
        "",
        "**Learning Coordinator:**",
        `  Cycles completed:  ${lStats.cycleCount}`,
        `  Active insights:   ${lStats.activeInsights}`
      );
    }
    if (workingMemoryStatsGetter && config.modules.workingMemory) {
      const wm = workingMemoryStatsGetter();
      lines.push("", "**Working Memory:**", `  Buffer entries: ${wm.entryCount}`);
    }
    if (sessionBridgeStatsGetter && config.modules.sessionBridge) {
      const sb = sessionBridgeStatsGetter();
      lines.push("", "**Session Bridge:**", `  Current session cycles: ${sb.currentCycles}`);
    }
    if (attentionStatsGetter && config.modules.attentionGate) {
      const ag = attentionStatsGetter();
      lines.push(
        "",
        "**Attention Gate:**",
        `  Processed: ${ag.totalProcessed}, Dropped: ${ag.totalDropped}`
      );
    }
    if (identityStatsGetter && config.modules.agentIdentity) {
      const ai = identityStatsGetter();
      lines.push(
        "",
        "**Agent Identity:**",
        `  Cycles: ${ai.totalCycles}, Lessons: ${ai.lessonsCount}`
      );
    }
    if (goalStackStatsGetter && config.modules.goalStack) {
      const gs = goalStackStatsGetter();
      lines.push("", "**Goal Stack:**", `  Pending: ${gs.pending}, Completed: ${gs.completed}`);
    }
    if (curiosityStatsGetter && config.modules.curiosityDrive) {
      const cs = curiosityStatsGetter();
      lines.push("", "**Curiosity Drive:**", `  Open gaps: ${cs.openGaps}, Filled: ${cs.gapsFilled}`);
    }
    if (temporalBindingStatsGetter && config.modules.temporalBinding) {
      const tb = temporalBindingStatsGetter();
      lines.push(
        "",
        "**Temporal Binding:**",
        `  Moments: ${tb.momentCount}, Domain: ${tb.dominantDomain ?? "none"}`
      );
    }
    if (qualiaSimulatorStatsGetter && config.modules.qualiaSimulator) {
      const qs = qualiaSimulatorStatsGetter();
      lines.push(
        "",
        "**Qualia Simulator:**",
        `  Emotion: ${qs.currentEmotion ?? "none"}, Color: ${qs.dominantColor ?? "none"}`
      );
    }
    if (vitalImpulseStatsGetter && config.modules.vitalImpulse) {
      const vi = vitalImpulseStatsGetter();
      const pressurePct = vi.effectiveThreshold > 0 ? vi.currentPressure / vi.effectiveThreshold * 100 : 0;
      lines.push(
        "",
        "**Vital Impulse:**",
        `  Pressure: ${pressurePct.toFixed(0)}% of threshold`,
        `  Fires: ${vi.totalFires}, Signals: ${vi.totalSignalsReceived}`,
        `  Status: ${vi.isInRefractory ? "refractory" : "ready"}`
      );
    }
    if (goalExecutorStatsGetter && config.modules.goalStack) {
      const ge = goalExecutorStatsGetter();
      lines.push(
        "",
        "**Goal Executor:**",
        `  Checks: ${ge.totalChecks}, Goals executed: ${ge.totalGoalsExecuted}`,
        `  Last heartbeat: ${ge.lastHeartbeatTime ? new Date(ge.lastHeartbeatTime).toLocaleString() : "never"}`
      );
    }
    const im = getInjectionMetrics();
    if (im.cycles > 0) {
      lines.push(
        "",
        "**Context Injections:**",
        `  Cycles: ${im.cycles}, Over budget: ${im.overBudgetCycles}`,
        `  Avg: ${im.avgChars} chars (~${im.avgEstTokens} tokens), Max: ${im.maxChars} chars`,
        `  Sections: avg ${im.avgSections}, max ${im.maxSections}`
      );
    }
    if (config.modules.proactiveFeedback) {
      const pf = getProactiveFeedbackStats();
      lines.push(
        "",
        "**Proactive Feedback (\xAB\u043D\u0435 \u0437\u0430\u0448\u043B\u043E\xBB):**",
        `  Domains tracked: ${pf.trackedDomains}, Rejections: ${pf.totalRejections}, Accepts: ${pf.totalAccepts}`,
        `  Suppressed now: ${pf.suppressedDomains.length > 0 ? pf.suppressedDomains.join(", ") : "\u2014"}`
      );
    }
    const emb = getEmbeddingsStatus();
    lines.push(
      "",
      "**Memory Search:**",
      `  Backend: ${emb.available ? `AI embeddings (${emb.provider} / ${emb.model})` : "TF-IDF (\u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439)"}`,
      `  Cached vectors: episodic ${emb.cached.episodic}, semantic ${emb.cached.semantic}, procedural ${emb.cached.procedural}`
    );
    if (socialDriveStatsGetter && config.modules.socialDrive) {
      const sd = socialDriveStatsGetter();
      const timeSince = sd.lastSocialInteractionTime > 0 ? `${((Date.now() - sd.lastSocialInteractionTime) / 6e4).toFixed(0)}m ago` : "never";
      lines.push(
        "",
        "**Social Drive:**",
        `  Need: ${sd.needLevel}, Satiation: ${(sd.satiation * 100).toFixed(0)}%`,
        `  Last social: ${timeSince}`,
        `  Rewards: ${sd.totalSocialRewards}, Signals: ${sd.totalNeedSignals}`
      );
    }
    if (cognitiveHungerStatsGetter && config.modules.cognitiveHunger) {
      const ch = cognitiveHungerStatsGetter();
      const timeSince = ch.lastLearningInteractionTime > 0 ? `${((Date.now() - ch.lastLearningInteractionTime) / 6e4).toFixed(0)}m ago` : "never";
      lines.push(
        "",
        "**Cognitive Hunger:**",
        `  Need: ${ch.needLevel}, Satiation: ${(ch.satiation * 100).toFixed(0)}%`,
        `  Last learning: ${timeSince}`,
        `  Rewards: ${ch.totalLearningRewards}, Signals: ${ch.totalNeedSignals}`
      );
    }
    if (creativeDriveStatsGetter && config.modules.creativeDrive) {
      const cd = creativeDriveStatsGetter();
      const timeSince = cd.lastCreativeInteractionTime > 0 ? `${((Date.now() - cd.lastCreativeInteractionTime) / 6e4).toFixed(0)}m ago` : "never";
      lines.push(
        "",
        "**Creative Drive:**",
        `  Need: ${cd.needLevel}, Satiation: ${(cd.satiation * 100).toFixed(0)}%`,
        `  Last creative: ${timeSince}`,
        `  Rewards: ${cd.totalCreativeRewards}, Signals: ${cd.totalNeedSignals}`
      );
    }
    if (masteryDriveStatsGetter && config.modules.masteryDrive) {
      const md = masteryDriveStatsGetter();
      const domainList = Object.entries(md.domainSatiations).map(([d, s]) => `${d}:${(s * 100).toFixed(0)}%`).join(", ");
      lines.push(
        "",
        "**Mastery Drive:**",
        `  Need: ${md.needLevel}, Aggregate satiation: ${(md.satiation * 100).toFixed(0)}%`,
        `  Weakest: ${md.weakestDomain} (${(md.weakestDomainSatiation * 100).toFixed(0)}%)`,
        `  Domains (${md.activeDomainCount}): ${domainList || "none yet"}`,
        `  Improvements: ${md.totalImprovementRewards}, Signals: ${md.totalNeedSignals}`
      );
    }
    if (driveArbiterStatsGetter && config.modules.driveArbiter) {
      const da = driveArbiterStatsGetter();
      const weightStr = Object.entries(da.driveWeights).map(([d, w]) => `${d}:${w.toFixed(2)}`).join(", ");
      lines.push(
        "",
        "**Drive Arbiter:**",
        `  Last selected: ${da.lastSelectedDrive ?? "none"}`,
        `  Weights: ${weightStr}`,
        `  Arbitrations: ${da.totalArbitrations}, Recent conflicts: ${da.recentConflicts}`
      );
    }
    if (temporalAwarenessStatsGetter && config.modules.temporalAwareness) {
      const ta = temporalAwarenessStatsGetter();
      lines.push(
        "",
        "**Temporal Awareness:**",
        `  Typical gap: ${formatMs(ta.typicalGapMs)}, Current gap: ${formatMs(ta.currentGapMs)}`,
        `  Density: ${ta.interactionDensity.toFixed(1)} interactions/day`,
        `  Surprise: ${ta.temporalSurprise.toFixed(1)}x, Total: ${ta.totalInteractions}`
      );
    }
    if (autonomousResearchStatsGetter && config.modules.autonomousResearch) {
      const ar = autonomousResearchStatsGetter();
      lines.push(
        "",
        "**Autonomous Research:**",
        `  Cycles: ${ar.totalCycles}, Facts extracted: ${ar.totalFactsExtracted}`,
        `  Last research: ${ar.lastResearchTime ? new Date(ar.lastResearchTime).toLocaleString() : "never"}`,
        `  Consecutive cooldowns: ${ar.consecutiveCooldowns}`
      );
    }
    lines.push(
      "",
      "**Dream Mode:**",
      `  Running: ${dreamStats.isRunning ? "yes" : "no"}`,
      `  Last consolidation: ${dreamStats.lastConsolidation ? new Date(dreamStats.lastConsolidation).toLocaleString() : "never"}`
    );
    if (config.circadian?.enabled) {
      const cStats = getCircadianStats();
      lines.push(
        "",
        "**Circadian Rhythm:**",
        `  Phase: ${cStats.phase}`,
        `  Activity level: ${(cStats.activityLevel * 100).toFixed(0)}%`
      );
    }
    return { text: lines.join("\n") };
  }
  return {
    setStatGetters,
    register,
    buildStatus
  };
}
var active41;
function current26() {
  if (!active41) {
    active41 = createCommandRegistry();
  }
  return active41;
}
function setCommandStatGetters(getters) {
  current26().setStatGetters(getters);
}
function registerBrainAgentCommands(api, config) {
  current26().register(api, config);
}
function buildStatusReport(config) {
  return current26().buildStatus(config);
}
function formatMs(ms) {
  if (ms <= 0) return "0s";
  if (ms < 6e4) return `${(ms / 1e3).toFixed(0)}s`;
  if (ms < 36e5) return `${(ms / 6e4).toFixed(0)}m`;
  if (ms < 864e5) return `${(ms / 36e5).toFixed(1)}h`;
  return `${(ms / 864e5).toFixed(1)}d`;
}

// src/index.ts
var name = "brainagent";
var inject = ["commands", "agents", "llm"];
function apply(ctx, config) {
  const logger = {
    info: (msg) => ctx.logger.info(msg),
    warn: (msg) => ctx.logger.warn(msg),
    error: (msg) => ctx.logger.error(msg)
  };
  const brainConfig = mergeBrainConfig(config);
  const dataDir = config.dataDir;
  mkdirSync31(dataDir, { recursive: true });
  const hostConfig = () => buildHostConfig({
    providers: config.providers,
    ...config.model ? { model: config.model } : {}
  });
  const state = createAutonomyState();
  function pickAgent() {
    const agents = ctx.agents.list();
    if (agents.length === 0) return void 0;
    return agents.find((a) => String(a.id) === state.lastActiveAgentId) ?? agents[agents.length - 1];
  }
  const enqueueAutonomousIntent = createAutonomousDeliverer({
    state,
    brainConfig,
    minGapMs: config.autonomousMinGapMs ?? 10 * 60 * 1e3,
    logger,
    pickAgent,
    deliver: (agent, framed) => {
      agent.followup(
        createUserMessage3({
          content: [{ type: "text", text: framed }],
          source: { kind: "cron", plugin: "brainagent" }
        })
      );
    },
    classifyDomain: (text) => classify(text),
    isDomainSuppressed,
    getSuppressedDomainHints
  });
  const driveGetters2 = () => ({
    social: brainConfig.modules.socialDrive ? getSocialDriveStats : void 0,
    cognitive: brainConfig.modules.cognitiveHunger ? getCognitiveHungerStats : void 0,
    creative: brainConfig.modules.creativeDrive ? getCreativeDriveStats : void 0,
    mastery: brainConfig.modules.masteryDrive ? getMasteryDriveStats : void 0
  });
  const resolveAutonomousIntent = createAutonomousIntentResolver({
    state,
    brainConfig,
    drives: driveGetters2(),
    goalStack: {
      getGoalStackStats,
      checkAutonomousGoals,
      buildGoalContext,
      getDesires
    },
    circadian: brainConfig.circadian.enabled ? { getCircadianState } : void 0,
    dmn: brainConfig.modules.dmn ? { getRecentUnusedInsights } : void 0
  });
  const markActivation = (module) => {
    if (config.modules.structuralPlasticity) {
      markModuleActivation(module);
    }
    if (brainConfig.modules.metabolicBudget) {
      consumeEnergy(module);
    }
  };
  const { cycles, sessionHabits, startCycle, endCycle: endCycle3 } = createCycleEngine({
    config,
    brainConfig,
    getHostConfig: hostConfig,
    logger,
    markActivation,
    state
  });
  initMemoryStorage(dataDir);
  initEmbeddings(hostConfig(), logger);
  if (brainConfig.modules.workingMemory) {
    initWorkingMemoryStorage(dataDir, brainConfig);
  }
  if (brainConfig.modules.attentionGate) {
    initAttentionGate(dataDir, brainConfig);
  }
  if (brainConfig.modules.mirrorNeurons) {
    initMirrorStorage(dataDir);
  }
  if (brainConfig.modules.predictiveEngine) {
    initPredictiveStorage(dataDir);
  }
  if (brainConfig.modules.basalGanglia) {
    initBasalStorage(dataDir);
  }
  if (brainConfig.modules.neuromodulatorSystem) {
    initDopamineSystem(dataDir);
  }
  if (brainConfig.modules.learningCoordinator) {
    initLearningCoordinator(dataDir, brainConfig);
  }
  if (brainConfig.modules.neuralPathways) {
    initNeuralPathways(dataDir, brainConfig, logger);
  }
  if (config.modules.structuralPlasticity) {
    initStructuralPlasticity(dataDir, brainConfig, logger);
  }
  if (brainConfig.modules.emotionalMemory) {
    initEmotionalMemory(dataDir, brainConfig);
  }
  if (brainConfig.modules.sessionBridge) {
    initSessionBridge(dataDir, brainConfig, logger);
  }
  if (brainConfig.modules.dmn) {
    initDMN(dataDir, brainConfig, logger);
  }
  if (brainConfig.modules.goalStack) {
    initGoalStack(dataDir, brainConfig);
  }
  if (brainConfig.modules.curiosityDrive) {
    initCuriosityDrive(dataDir, brainConfig);
  }
  const driveInitBase = {
    addDesire,
    getDesires,
    getFactsByCategory
  };
  if (brainConfig.modules.socialDrive) {
    initSocialDrive(dataDir, brainConfig, logger, {
      ...driveInitBase,
      generateSocialThought: (topics) => {
        if (brainConfig.modules.dmn) {
          generateBackgroundThoughts(brainConfig, void 0, void 0, topics);
        }
      }
    });
  }
  if (brainConfig.modules.cognitiveHunger) {
    initCognitiveHunger(dataDir, brainConfig, logger, {
      ...driveInitBase,
      generateLearningThought: (topics) => {
        if (brainConfig.modules.dmn) {
          generateBackgroundThoughts(brainConfig, void 0, void 0, topics);
        }
      }
    });
  }
  if (brainConfig.modules.creativeDrive) {
    initCreativeDrive(dataDir, brainConfig, logger, {
      ...driveInitBase,
      generateCreativeThought: (topics) => {
        if (brainConfig.modules.dmn) {
          generateBackgroundThoughts(brainConfig, void 0, void 0, topics);
        }
      }
    });
  }
  if (brainConfig.modules.masteryDrive) {
    initMasteryDrive(dataDir, brainConfig, logger, {
      ...driveInitBase,
      generateMasteryThought: (topics) => {
        if (brainConfig.modules.dmn) {
          generateBackgroundThoughts(brainConfig, void 0, void 0, topics);
        }
      }
    });
  }
  if (brainConfig.modules.vitalImpulse) {
    initVitalImpulse(dataDir, brainConfig, logger, {
      // dsh's followup() already queues the turn AND wakes the driver, so
      // the NeuroClaw heartbeat request has no separate counterpart.
      requestHeartbeatNow: () => {
      },
      enqueueSystemEvent: (text) => enqueueAutonomousIntent(text),
      resolveAutonomousIntent
    });
  }
  if (brainConfig.modules.goalStack) {
    initGoalExecutor(brainConfig, logger);
  }
  if (brainConfig.modules.actionDispatcher && brainConfig.modules.vitalImpulse) {
    initAutonomyEnricher(brainConfig, logger, {
      recallMemories: (query, episodicLimit, semanticLimit) => {
        const result = recallAll(query, episodicLimit, semanticLimit);
        return { episodic: result.episodic, semantic: result.semantic };
      },
      getDesires,
      enqueueSystemEvent: (text) => enqueueAutonomousIntent(text)
    });
  }
  if (brainConfig.modules.driveArbiter) {
    initDriveArbiter(
      dataDir,
      brainConfig,
      {
        getSocialDriveStats: brainConfig.modules.socialDrive ? getSocialDriveStats : void 0,
        getCognitiveHungerStats: brainConfig.modules.cognitiveHunger ? getCognitiveHungerStats : void 0,
        getCreativeDriveStats: brainConfig.modules.creativeDrive ? getCreativeDriveStats : void 0,
        getMasteryDriveStats: brainConfig.modules.masteryDrive ? getMasteryDriveStats : void 0,
        getUserModel: brainConfig.modules.mirrorNeurons ? () => getUserModel("default") : void 0,
        getInteroceptivePattern: () => getInteroceptiveState()?.pattern ?? null
      },
      logger
    );
  }
  if (brainConfig.modules.autonomousResearch) {
    initAutonomousResearch(brainConfig, logger, {
      callLLM,
      storeFact,
      recallFacts: (query, limit = 5) => {
        const result = recallAll(query, 0, limit);
        return result.semantic.map((s) => ({ content: s.content }));
      },
      gatewayConfig: hostConfig(),
      logger
    });
  }
  if (brainConfig.circadian.enabled) {
    initCircadianRhythm(dataDir, brainConfig, logger);
  }
  if (brainConfig.modules.dreamMode) {
    startDreamMode(brainConfig, logger, hostConfig());
  }
  if (brainConfig.modules.metabolicBudget) {
    initMetabolicBudget(dataDir, brainConfig, logger);
  }
  if (brainConfig.modules.emergentModules) {
    initEmergentModules(dataDir, brainConfig, logger);
  }
  if (brainConfig.modules.proactiveFeedback) {
    initProactiveFeedback(dataDir, brainConfig, logger);
  }
  if (brainConfig.learningLoop.rewardLedger.enabled) {
    initRewardLedger(dataDir, brainConfig);
  }
  if (brainConfig.learningLoop.strategyBandit.enabled) {
    initStrategyBandit(dataDir, brainConfig);
  }
  if (brainConfig.modules.introspection) {
    initIntrospection(dataDir, brainConfig);
  }
  if (brainConfig.modules.agentIdentity) {
    initAgentIdentity(dataDir, brainConfig);
  }
  if (brainConfig.modules.temporalBinding) {
    initTemporalBinding(dataDir, brainConfig);
  }
  if (brainConfig.modules.qualiaSimulator) {
    initQualiaSimulator(dataDir, brainConfig);
  }
  if (brainConfig.modules.temporalAwareness) {
    initTemporalAwareness(dataDir, brainConfig, logger);
  }
  if (brainConfig.modules.interoception) {
    initInteroception(
      {
        getSocialDriveStats: brainConfig.modules.socialDrive ? getSocialDriveStats : void 0,
        getCognitiveHungerStats: brainConfig.modules.cognitiveHunger ? getCognitiveHungerStats : void 0,
        getCreativeDriveStats: brainConfig.modules.creativeDrive ? getCreativeDriveStats : void 0,
        getMasteryDriveStats: brainConfig.modules.masteryDrive ? getMasteryDriveStats : void 0,
        getVitalImpulseStats: brainConfig.modules.vitalImpulse ? getVitalImpulseStats : void 0,
        getNeuromodulatorState: brainConfig.modules.neuromodulatorSystem ? getNeuromodulatorState : void 0
      },
      logger
    );
  }
  if (brainConfig.modules.thalamicGate) {
    initThalamicGate(brainConfig.thalamicGate, {
      getVitalImpulseStats: brainConfig.modules.vitalImpulse ? getVitalImpulseStats : void 0,
      getAmygdalaAssessment: () => {
        const last = [...cycles.values()].at(-1);
        return last?.assessment;
      },
      getNeuromodulatorState: brainConfig.modules.neuromodulatorSystem ? getNeuromodulatorState : void 0,
      getSocialDriveSatiation: brainConfig.modules.socialDrive ? getSatiation : void 0,
      getCognitiveHungerSatiation: brainConfig.modules.cognitiveHunger ? getCognitiveHungerSatiation : void 0,
      getCreativeDriveSatiation: brainConfig.modules.creativeDrive ? getCreativeDriveSatiation : void 0,
      getMasteryDriveSatiation: brainConfig.modules.masteryDrive ? getMasteryAggregateSatiation : void 0,
      getGoalStackStats: brainConfig.modules.goalStack ? getGoalStackStats : void 0,
      getDMNStats: brainConfig.modules.dmn ? () => {
        const unused = getRecentUnusedInsights(30 * 60 * 1e3);
        return { unusedInsightCount: unused.length };
      } : void 0
    });
  }
  if (config.modules.commands) {
    registerBrainAgentCommands(
      {
        registerCommand: (def) => {
          ctx.commands.register({
            name: "brain",
            description: def.description,
            input: { hint: "[status|dream|memory|predict|habits|dopamine|learning|...]" },
            handler: async (invocation) => {
              try {
                const result = await def.handler({ args: invocation.rawInput.trim() });
                return { kind: "success", text: result.text };
              } catch (err) {
                return { kind: "error", text: String(err) };
              }
            }
          });
        },
        logger,
        config: hostConfig()
      },
      brainConfig
    );
    setCommandStatGetters({
      workingMemory: brainConfig.modules.workingMemory ? getWorkingMemoryStats : void 0,
      sessionBridge: brainConfig.modules.sessionBridge ? getSessionBridgeStats : void 0,
      attention: brainConfig.modules.attentionGate ? getAttentionStats : void 0,
      dmn: brainConfig.modules.dmn ? getDMNStats : void 0,
      introspectionTrace: brainConfig.modules.introspection ? getLastTrace : void 0,
      introspectionStats: brainConfig.modules.introspection ? getIntrospectionStats : void 0,
      identity: brainConfig.modules.agentIdentity ? getAgentIdentityStats : void 0,
      goalStack: brainConfig.modules.goalStack ? getGoalStackStats : void 0,
      curiosity: brainConfig.modules.curiosityDrive ? getCuriosityStats : void 0,
      temporalBinding: brainConfig.modules.temporalBinding ? getTemporalBindingStats : void 0,
      qualiaSimulator: brainConfig.modules.qualiaSimulator ? getQualiaSimulatorStats : void 0,
      vitalImpulse: brainConfig.modules.vitalImpulse ? getVitalImpulseStats : void 0,
      goalExecutor: brainConfig.modules.goalStack ? getGoalExecutorStats : void 0,
      socialDrive: brainConfig.modules.socialDrive ? getSocialDriveStats : void 0,
      cognitiveHunger: brainConfig.modules.cognitiveHunger ? getCognitiveHungerStats : void 0,
      creativeDrive: brainConfig.modules.creativeDrive ? getCreativeDriveStats : void 0,
      masteryDrive: brainConfig.modules.masteryDrive ? getMasteryDriveStats : void 0,
      driveArbiter: brainConfig.modules.driveArbiter ? getDriveArbiterStats : void 0,
      temporalAwareness: brainConfig.modules.temporalAwareness ? getTemporalAwarenessStats : void 0,
      thalamicGate: brainConfig.modules.thalamicGate ? getThalamicGateStats : void 0,
      autonomousResearch: brainConfig.modules.autonomousResearch ? getAutonomousResearchStats : void 0
    });
  }
  ctx.on("session/event", (_session, event) => {
    const key = String(_session.id);
    if (event.type === "user/message") {
      const text = textOfContent(event.data.content);
      if (!text.trim()) return;
      if (isInternalPluginMessage(text)) return;
      state.lastActiveAgentId = key;
      if (brainConfig.circadian.enabled) {
        recordActivity();
      }
      if (brainConfig.modules.temporalAwareness) {
        recordInteraction();
      }
      const isUserMessage = !isAutonomousInput(text);
      if (brainConfig.modules.sessionBridge && isUserMessage) {
        checkSessionGap();
      }
      if (isUserMessage && state.previousCycleWasAutonomous && state.lastAutonomousEpisodeId) {
        let reactionSignal = "neutral";
        if (brainConfig.modules.proactiveFeedback) {
          reactionSignal = recordProactiveReaction(state.lastAutonomousDomain, text);
        }
        if (brainConfig.modules.hippocampus) {
          const reactionSummary = truncateText(text, 200);
          const reactionEmotion = reactionSignal === "positive" ? "joy" : reactionSignal === "neutral" ? "neutral" : "frustration";
          const reactionSalience = reactionSignal === "rejection" ? 0.6 : reactionSignal === "neutral" ? 0 : 0.4;
          storeEpisode(
            `User reacted to proactive message (${reactionSignal}): ${reactionSummary}`,
            "User response to autonomous agent message",
            reactionEmotion,
            ["proactive_feedback", state.lastAutonomousEpisodeId, reactionSignal],
            reactionSalience
          );
        }
      }
      state.previousCycleWasAutonomous = false;
      state.lastAutonomousEpisodeId = void 0;
      if (isUserMessage && brainConfig.modules.goalStack) {
        satisfyDesiresOnUserResponse();
      }
      if (isUserMessage && brainConfig.modules.vitalImpulse) {
        resetConsecutiveFires();
      }
      const cycle = startCycle(key, text);
      if (brainConfig.modules.goalStack) {
        expireGoals();
        const triggered = checkGoalTriggers(text, cycle.assessment?.emotion);
        if (triggered.length > 0) {
          cycle.triggeredGoals = triggered;
        }
      }
      return;
    }
    if (event.type === "assistant/message") {
      const cycle = cycles.get(key);
      if (!cycle) return;
      const text = textOfContent(event.data.message.content);
      if (text.trim()) {
        cycle.responseText += (cycle.responseText ? "\n" : "") + text;
      }
      return;
    }
    if (event.type === "turn/end") {
      void endCycle3(key).catch((err) => logger.warn(`BrainAgent endCycle: ${String(err)}`));
    }
  });
  ctx.on("agent/pre-step", createPreStepHandler({
    config,
    brainConfig,
    getHostConfig: hostConfig,
    logger,
    state,
    cycles,
    sessionHabits,
    startCycle
  }));
  ctx.on("agent/request", async (payload, next) => {
    const callConfig = await next();
    if (!brainConfig.modules.prefrontalCortex) return callConfig;
    const cycle = cycles.get(String(payload.agent.id));
    if (!cycle?.classification) return callConfig;
    const decision = decideProcessingPath(cycle.classification, brainConfig);
    if (!decision.modelOverride) return callConfig;
    const slash = decision.modelOverride.indexOf("/");
    if (slash > 0) {
      return {
        ...callConfig,
        provider: decision.modelOverride.slice(0, slash),
        model: decision.modelOverride.slice(slash + 1)
      };
    }
    return { ...callConfig, model: decision.modelOverride };
  });
  ctx.on("tools/pre-execute", async (exec, next) => {
    if (!brainConfig.modules.autonomousResearch) return next();
    const agentId = exec.agent ? String(exec.agent.id) : state.lastActiveAgentId;
    const cycle = agentId ? cycles.get(agentId) : void 0;
    if (!isAutonomousInput(cycle?.input ?? "")) return next();
    const blocked = brainConfig.autonomousResearch.blockedToolsInAutonomous;
    if (blocked.includes(exec.name)) {
      logger.info(
        `BrainAgent AutonomousResearch: BLOCKED tool "${exec.name}" during autonomous cycle (use isolated research pipeline instead)`
      );
      return {
        kind: "deny",
        reason: `Tool "${exec.name}" is blocked during autonomous cycles. Research is handled via the isolated autonomous research pipeline to prevent token bloat.`
      };
    }
    return next();
  });
  ctx.effect(() => {
    const unsubs = [];
    if (brainConfig.modules.dmn && brainConfig.circadian.enabled) {
      unsubs.push(
        bus.on("circadian:phase-changed", (data) => {
          if (data.newPhase === "sleep") {
            generateBackgroundThoughts(
              brainConfig,
              void 0,
              void 0,
              getOpenGaps().map((gap) => ({ topic: gap.topic }))
            );
            void runAssociationFinding(brainConfig).catch(() => {
            });
          }
        })
      );
    }
    if (brainConfig.modules.goalStack && brainConfig.modules.vitalImpulse) {
      unsubs.push(
        bus.on("vital-impulse:fired", (data) => {
          weakenDesiresAfterFire(data.consecutiveFires);
        })
      );
    }
    if (brainConfig.modules.goalStack) {
      unsubs.push(
        bus.on("goal:completed", () => {
          for (const cyc of cycles.values()) {
            cyc.goalCompleted = true;
          }
        })
      );
    }
    const gcInterval = setInterval(() => bus.gc(12e4), 12e4);
    return () => {
      clearInterval(gcInterval);
      for (const unsub of unsubs) unsub();
      if (brainConfig.modules.dreamMode) stopDreamMode();
      if (brainConfig.circadian.enabled) stopCircadianRhythm();
      if (brainConfig.modules.vitalImpulse) stopVitalImpulse();
      if (brainConfig.modules.goalStack) stopGoalExecutor();
      if (brainConfig.modules.socialDrive) stopSocialDrive();
      if (brainConfig.modules.cognitiveHunger) stopCognitiveHunger();
      if (brainConfig.modules.creativeDrive) stopCreativeDrive();
      if (brainConfig.modules.masteryDrive) stopMasteryDrive();
      if (brainConfig.modules.actionDispatcher) stopAutonomyEnricher();
      if (brainConfig.modules.driveArbiter) stopDriveArbiter();
      if (brainConfig.modules.autonomousResearch) stopAutonomousResearch();
      if (brainConfig.modules.interoception) stopInteroception();
      if (brainConfig.modules.proactiveFeedback) stopProactiveFeedback();
      if (brainConfig.learningLoop.rewardLedger.enabled) stopRewardLedger();
      if (brainConfig.learningLoop.strategyBandit.enabled) stopStrategyBandit();
      if (brainConfig.modules.temporalAwareness) stopTemporalAwareness();
    };
  });
  if (config.modules.aiEnrichment) {
    ctx.effect(() => attachLlmBridge(ctx, config.model));
  }
  provideBrainAgentService(
    ctx,
    createBrainAgentService({
      status: () => buildStatusReport(brainConfig).text,
      recall: (query, episodicLimit, semanticLimit) => recallAll(query, episodicLimit, semanticLimit),
      storeFact: (content, category) => {
        storeFact(content, category);
      },
      storeEpisode: (event, summary) => {
        storeEpisode(event, summary);
      },
      getDesires: brainConfig.modules.goalStack ? getDesires : () => [],
      addDesire: brainConfig.modules.goalStack ? addDesire : () => {
        throw new Error("BrainAgent: goal-stack module is disabled");
      },
      moduleFlags: () => ({ ...brainConfig.modules })
    })
  );
  logger.info("BrainAgent: cognitive architecture initialized");
  logger.info(
    `BrainAgent: modules enabled \u2014 thalamus=${brainConfig.modules.thalamus} amygdala=${brainConfig.modules.amygdala} hippocampus=${brainConfig.modules.hippocampus} prefrontal=${brainConfig.modules.prefrontalCortex} cerebellum=${brainConfig.modules.cerebellum} wm=${brainConfig.modules.workingMemory} attention=${brainConfig.modules.attentionGate} mirror=${brainConfig.modules.mirrorNeurons} predictive=${brainConfig.modules.predictiveEngine} basal=${brainConfig.modules.basalGanglia} dopamine=${brainConfig.modules.neuromodulatorSystem} learning=${brainConfig.modules.learningCoordinator} pathways=${brainConfig.modules.neuralPathways} plasticity=${config.modules.structuralPlasticity} emotional=${brainConfig.modules.emotionalMemory} aiEnrichment=${config.modules.aiEnrichment}`
  );
  logger.info(
    `BrainAgent: autonomic layer \u2014 session=${brainConfig.modules.sessionBridge} dmn=${brainConfig.modules.dmn} goals=${brainConfig.modules.goalStack} curiosity=${brainConfig.modules.curiosityDrive} vitalImpulse=${brainConfig.modules.vitalImpulse} social=${brainConfig.modules.socialDrive} cognitive=${brainConfig.modules.cognitiveHunger} creative=${brainConfig.modules.creativeDrive} mastery=${brainConfig.modules.masteryDrive} arbiter=${brainConfig.modules.driveArbiter} enricher=${brainConfig.modules.actionDispatcher} research=${brainConfig.modules.autonomousResearch} dream=${brainConfig.modules.dreamMode} circadian=${brainConfig.circadian.enabled}`
  );
  logger.info(
    `BrainAgent: service layer \u2014 introspection=${brainConfig.modules.introspection} identity=${brainConfig.modules.agentIdentity} temporalBinding=${brainConfig.modules.temporalBinding} qualia=${brainConfig.modules.qualiaSimulator} temporalAwareness=${brainConfig.modules.temporalAwareness} interoception=${brainConfig.modules.interoception} metabolic=${brainConfig.modules.metabolicBudget} emergent=${brainConfig.modules.emergentModules} proactiveFeedback=${brainConfig.modules.proactiveFeedback} thalamicGate=${brainConfig.modules.thalamicGate} commands=${config.modules.commands}`
  );
}
export {
  Config,
  apply,
  inject,
  name
};
