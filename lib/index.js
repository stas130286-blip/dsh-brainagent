// src/index.ts
import { mkdirSync as mkdirSync30 } from "node:fs";
import { homedir } from "node:os";
import { join as join30 } from "node:path";
import Schema from "@deepseek-ai/schemastery";
import { createUserMessage as createUserMessage2 } from "@deepseek-ai/dsh-llm";

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
  const providers2 = {};
  for (const spec of ENV_PROVIDERS) {
    const apiKey = env[spec.apiKeyVar];
    const baseUrl = spec.baseUrlVar ? env[spec.baseUrlVar] : void 0;
    if (apiKey || baseUrl) {
      providers2[spec.key] = { apiKey, baseUrl };
    }
  }
  for (const [key, entry] of Object.entries(options.providers ?? {})) {
    providers2[key] = { ...providers2[key], ...entry };
  }
  const config10 = { models: { providers: providers2 } };
  if (options.model) {
    config10.agents = { defaults: { model: options.model } };
  }
  return config10;
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
    autonomousResearch: true
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
  }
};

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

// src/modules/llm-client.ts
function parseUserModelSelection(config10) {
  const agents = config10.agents;
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
function resolveProvider(config10) {
  const providers2 = config10.models?.providers;
  if (!providers2) return null;
  const userSelection = parseUserModelSelection(config10);
  if (userSelection) {
    const entry = providers2[userSelection.provider];
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
    const entry = providers2[key];
    if (!entry) continue;
    const model = FALLBACK_MODELS[key];
    if (!model) continue;
    const result = buildProviderConfig(key, entry, model);
    if (result) return result;
  }
  return null;
}
function isAIProviderAvailable(config10) {
  return (availabilityHook?.() ?? false) || resolveProvider(config10) !== null;
}
var callBackend;
var availabilityHook;
function setCallLLMBackend(fn) {
  callBackend = fn;
}
function setAIAvailabilityHook(fn) {
  availabilityHook = fn;
}
async function callLLM(systemPrompt, userText, config10, logger16, maxTokens = 500) {
  if (callBackend) {
    try {
      const bridged = await callBackend(systemPrompt, userText, config10, logger16, maxTokens);
      if (bridged !== void 0) return bridged;
    } catch (error) {
      logger16?.info(`BrainAgent LLM: bridge failed, falling back \u2014 ${String(error)}`);
    }
  }
  const provider = resolveProvider(config10);
  if (!provider) {
    logger16?.info("BrainAgent LLM: no AI provider configured, skipping");
    return null;
  }
  const userSelection = parseUserModelSelection(config10);
  if (userSelection) {
    logger16?.info(`BrainAgent LLM: calling ${provider.name} (${provider.model}) [user-selected]`);
  } else {
    logger16?.info(`BrainAgent LLM: calling ${provider.name} (${provider.model}) [auto-detected]`);
  }
  try {
    let response;
    if (provider.bodyFormat === "anthropic") {
      response = await fetch(`${provider.baseUrl}/messages`, {
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
      response = await fetch(url, {
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
      logger16?.info(`BrainAgent LLM: Google error ${response.status}: ${errorText}`);
      return null;
    } else {
      response = await fetch(`${provider.baseUrl}/chat/completions`, {
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
      logger16?.info(`BrainAgent LLM: ${provider.name} error ${response.status}: ${errorText}`);
      return null;
    }
    const data = await response.json();
    if (provider.bodyFormat === "anthropic") {
      return data.content?.[0]?.text ?? null;
    }
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    logger16?.info(`BrainAgent LLM: error \u2014 ${String(error)}`);
    return null;
  }
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
async function assessWithAI(text, config10, logger16) {
  const content = await callLLM(EMOTION_PROMPT, text, config10, logger16, 100);
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

// src/modules/hippocampus.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
function buildEmbeddingConfig(providerKey, entry) {
  const spec = EMBEDDING_MODELS[providerKey];
  if (!spec) return null;
  const apiKey = entry.apiKey ?? "";
  const name2 = EMBEDDING_PROVIDER_NAMES[providerKey] ?? providerKey;
  if (providerKey === "ollama") {
    if (!entry.baseUrl) return null;
    return {
      name: "Ollama",
      apiKey: "",
      baseUrl: entry.baseUrl,
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
function resolveEmbeddingProvider(config10) {
  const providers2 = config10.models?.providers;
  if (!providers2) return null;
  const userSelection = parseUserModelSelection(config10);
  if (userSelection) {
    const entry = providers2[userSelection.provider];
    if (entry) {
      const result = buildEmbeddingConfig(userSelection.provider, entry);
      if (result) return result;
    }
  }
  const fallbackOrder = ["openai", "google", "ollama", "openrouter"];
  for (const key of fallbackOrder) {
    const entry = providers2[key];
    if (!entry) continue;
    const result = buildEmbeddingConfig(key, entry);
    if (result) return result;
  }
  return null;
}
async function getEmbedding(text, config10, logger16) {
  const result = await getEmbeddings([text], config10, logger16);
  return result?.[0] ?? null;
}
async function getEmbeddings(texts, config10, logger16) {
  const provider = resolveEmbeddingProvider(config10);
  if (!provider) {
    return null;
  }
  if (texts.length === 0) return [];
  try {
    if (provider.format === "google") {
      return await fetchGoogleEmbeddings(texts, provider, logger16);
    }
    return await fetchOpenAIEmbeddings(texts, provider, logger16);
  } catch (error) {
    logger16?.info(`BrainAgent Embeddings: ${provider.name} error \u2014 ${String(error)}`);
    return null;
  }
}
async function fetchOpenAIEmbeddings(texts, provider, logger16) {
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
    logger16?.info(
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
async function fetchGoogleEmbeddings(texts, provider, logger16) {
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
    logger16?.info(`BrainAgent Embeddings: Google API error ${response.status}: ${errorText}`);
    return null;
  }
  const data = await response.json();
  if (!data.embeddings) return null;
  const embeddings = data.embeddings.map((e) => e.values).filter((v) => Array.isArray(v));
  if (embeddings.length !== texts.length) return null;
  return embeddings;
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

// src/modules/hippocampus.ts
var memoryDir = "";
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
function initMemoryStorage(workspaceDir) {
  memoryDir = join(workspaceDir, ".brainagent", "memory");
  ensureDir(memoryDir);
  ensureDir(join(memoryDir, "episodic"));
  ensureDir(join(memoryDir, "semantic"));
  ensureDir(join(memoryDir, "procedural"));
  loadAll();
  rebuildVectorIndices();
}
var episodicStore = [];
var semanticStore = [];
var proceduralStore = [];
var semanticVersion = 0;
function getSemanticVersion() {
  return semanticVersion;
}
var episodicIndex = new VectorIndex();
var semanticIndex = new VectorIndex();
var proceduralIndex = new VectorIndex();
var embeddingCache = {
  episodic: /* @__PURE__ */ new Map(),
  semantic: /* @__PURE__ */ new Map(),
  procedural: /* @__PURE__ */ new Map()
};
var embeddingsConfig = null;
var embeddingsLogger;
var embeddingsAvailable = false;
var embeddingsCacheDir = "";
function initEmbeddings(config10, logger16) {
  const provider = resolveEmbeddingProvider(config10);
  if (!provider) {
    logger16?.info("BrainAgent Hippocampus: no embedding provider \u2014 using TF-IDF");
    return;
  }
  embeddingsConfig = config10;
  embeddingsLogger = logger16;
  embeddingsAvailable = true;
  embeddingsCacheDir = join(memoryDir, "..", "embeddings");
  ensureDir(embeddingsCacheDir);
  logger16?.info(
    `BrainAgent Hippocampus: embeddings enabled via ${provider.name} (${provider.model})`
  );
  loadEmbeddingCache("episodic", embeddingCache.episodic);
  loadEmbeddingCache("semantic", embeddingCache.semantic);
  loadEmbeddingCache("procedural", embeddingCache.procedural);
  scheduleEmbeddingBackfill();
}
function updateEmbeddingsConfig(config10) {
  if (!embeddingsAvailable) {
    const provider = resolveEmbeddingProvider(config10);
    if (provider) {
      embeddingsConfig = config10;
      embeddingsAvailable = true;
      return;
    }
    return;
  }
  embeddingsConfig = config10;
}
function loadEmbeddingCache(layer, cache) {
  try {
    const filePath = join(embeddingsCacheDir, `${layer}.json`);
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
    const filePath = join(embeddingsCacheDir, `${layer}.json`);
    const obj = {};
    for (const [id, vec] of cache) {
      obj[id] = vec;
    }
    writeFileSync(filePath, JSON.stringify(obj), "utf-8");
  } catch {
  }
}
var pendingSaves = /* @__PURE__ */ new Map();
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
  const config10 = embeddingsConfig;
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
        const vec = await getEmbedding(item.text, config10, embeddingsLogger);
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
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
  }
}
function loadAll() {
  if (!memoryDir) return;
  episodicStore = loadJson(join(memoryDir, "episodic", "store.json"), []);
  semanticStore = loadJson(join(memoryDir, "semantic", "store.json"), []);
  proceduralStore = loadJson(join(memoryDir, "procedural", "store.json"), []);
}
function persistEpisodic() {
  if (!memoryDir) return;
  saveJson(join(memoryDir, "episodic", "store.json"), episodicStore);
}
function persistSemantic() {
  if (!memoryDir) return;
  saveJson(join(memoryDir, "semantic", "store.json"), semanticStore);
}
function persistProcedural() {
  if (!memoryDir) return;
  saveJson(join(memoryDir, "procedural", "store.json"), proceduralStore);
}
var idCounter = 0;
function nextId(prefix) {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}
function storeEpisode(event, summary, emotionalContext = "neutral", entities = [], emotionIntensity = 0) {
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
    const config10 = embeddingsConfig;
    void getEmbedding(`${event} ${summary}`, config10, embeddingsLogger).then((vec) => {
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
function storeFact(content, category, sourceEpisodeIds = [], relatedIds = []) {
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
  if (embeddingsAvailable && embeddingsConfig) {
    const config10 = embeddingsConfig;
    void getEmbedding(`${content} ${category}`, config10, embeddingsLogger).then((vec) => {
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
var pendingContradictions = [];
function getPendingContradictions() {
  return [...pendingContradictions];
}
function clearPendingContradictions() {
  pendingContradictions = [];
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
          // Will be set after fact is created
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
    const config10 = embeddingsConfig;
    void getEmbedding(`${newContent} ${existing.category}`, config10, embeddingsLogger).then(
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
function getFactsByCategory(category, limit = 10) {
  const candidates = semanticStore.filter((f) => f.category === category);
  if (candidates.length === 0) return [];
  return [...candidates].sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}
function storeWorkflow(description, triggerPattern, steps) {
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
function recallAll(query, episodicLimit = 3, semanticLimit = 5) {
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
async function recallAllAsync(query, episodicLimit = 3, semanticLimit = 5) {
  if (!embeddingsAvailable) {
    return recallAll(query, episodicLimit, semanticLimit);
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
var queryEmbeddingCache = /* @__PURE__ */ new Map();
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
async function consolidate(config10, neuroClawConfig, logger16, intensity = 0.5, skipAIReview = false) {
  let merged = 0;
  let pruned = 0;
  let strengthened = 0;
  let contradictions = 0;
  let revised = 0;
  const pruneThreshold = 1 - intensity * 0.5;
  const mergeThreshold = 0.7 + (1 - intensity) * 0.2;
  const strengthenBonus = 0.05 + intensity * 0.1;
  const decayFactor = config10.memory.salienceDecayFactor;
  for (const ep of episodicStore) {
    const daysSince = (Date.now() - ep.timestamp) / (24 * 60 * 60 * 1e3);
    ep.salience *= decayFactor ** daysSince;
  }
  const effectiveMaxEpisodic = Math.floor(
    config10.memory.maxEpisodicMemories * (1.1 - intensity * 0.2)
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
  if (semanticStore.length > config10.memory.maxSemanticMemories) {
    semanticStore.sort((a, b) => b.confidence - a.confidence);
    const removed = semanticStore.splice(config10.memory.maxSemanticMemories);
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
        logger16,
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
                logger16?.info(
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
      logger16?.info(`BrainAgent Consolidation: AI review error \u2014 ${String(err)}`);
    }
  }
  persistEpisodic();
  persistSemantic();
  persistProcedural();
  return { merged, pruned, strengthened, contradictions, revised };
}
function getStats() {
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

// src/modules/working-memory.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join2 } from "node:path";
var storageDir = "";
var entries = [];
var maxEntries = 7;
var summaryMaxLength = 200;
function initWorkingMemoryStorage(workspaceDir, config10) {
  storageDir = join2(workspaceDir, ".brainagent", "working-memory");
  if (!existsSync2(storageDir)) {
    mkdirSync2(storageDir, { recursive: true });
  }
  maxEntries = config10.workingMemory.maxEntries;
  summaryMaxLength = config10.workingMemory.summaryMaxLength;
  loadState();
}
function loadState() {
  if (!storageDir) return;
  try {
    const path = join2(storageDir, "state.json");
    if (existsSync2(path)) {
      const data = JSON.parse(readFileSync2(path, "utf-8"));
      entries = Array.isArray(data) ? data : [];
    }
  } catch {
    entries = [];
  }
}
function persistState() {
  if (!storageDir) return;
  try {
    writeFileSync2(join2(storageDir, "state.json"), JSON.stringify(entries, null, 2), "utf-8");
  } catch {
  }
}
function storeCompletedCycle(entry) {
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
function buildWorkingMemoryContext(currentInput) {
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
function getWorkingMemoryStats() {
  return {
    entryCount: entries.length,
    oldestTimestamp: entries.length > 0 ? entries[0].timestamp : null,
    newestTimestamp: entries.length > 0 ? entries[entries.length - 1].timestamp : null
  };
}
function truncateForWorkingMemory(text) {
  if (text.length <= summaryMaxLength) return text;
  return text.slice(0, summaryMaxLength) + "...";
}

// src/modules/attention-gate.ts
import { existsSync as existsSync3, mkdirSync as mkdirSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "node:fs";
import { join as join3 } from "node:path";
var storageDir2 = "";
var totalProcessed = 0;
var totalDropped = 0;
var totalRelevanceSum = 0;
function initAttentionGate(workspaceDir, _config) {
  storageDir2 = join3(workspaceDir, ".brainagent", "attention");
  if (!existsSync3(storageDir2)) {
    mkdirSync3(storageDir2, { recursive: true });
  }
  totalProcessed = 0;
  totalDropped = 0;
  totalRelevanceSum = 0;
  loadState2();
}
function loadState2() {
  if (!storageDir2) return;
  try {
    const path = join3(storageDir2, "state.json");
    if (existsSync3(path)) {
      const data = JSON.parse(readFileSync3(path, "utf-8"));
      totalProcessed = data.totalProcessed ?? 0;
      totalDropped = data.totalDropped ?? 0;
      totalRelevanceSum = data.totalRelevanceSum ?? 0;
    }
  } catch {
  }
}
function persistState2() {
  if (!storageDir2) return;
  try {
    writeFileSync3(
      join3(storageDir2, "state.json"),
      JSON.stringify({ totalProcessed, totalDropped, totalRelevanceSum }, null, 2),
      "utf-8"
    );
  } catch {
  }
}
function filterContextInjections(injections, currentInput, norepinephrineLevel, config10, maxTokenBudget) {
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
  const effectiveThreshold = config10.attentionGate.minRelevanceScore * (1 - norepinephrineLevel * 0.5);
  scored.sort((a, b) => b.score - a.score);
  let kept = [];
  let dropped = 0;
  for (const item of scored) {
    if (kept.length < config10.attentionGate.maxContextSections && item.score >= effectiveThreshold) {
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
  persistState2();
  bus.emitSync("attention:filtered", {
    total: injections.length,
    kept: kept.length,
    dropped
  });
  return kept;
}
function getAttentionStats() {
  const kept = totalProcessed - totalDropped;
  return {
    totalProcessed,
    totalDropped,
    avgRelevance: kept > 0 ? totalRelevanceSum / kept : 0
  };
}

// src/modules/prefrontal-cortex.ts
var COMPLEXITY_ORDER = {
  trivial: 0,
  simple: 1,
  moderate: 2,
  complex: 3,
  extreme: 4
};
function decideProcessingPath(classification, config10) {
  const threshold = COMPLEXITY_ORDER[config10.dualProcess.system2Threshold];
  const actual = COMPLEXITY_ORDER[classification.complexity];
  const useSlow = actual >= threshold || classification.processingPath === "slow";
  const modelOverride = useSlow ? config10.dualProcess.slowModel : config10.dualProcess.fastModel;
  const result = {
    processingPath: useSlow ? "slow" : "fast",
    modelOverride: modelOverride ?? void 0
  };
  bus.emitSync("prefrontal:decision", result);
  return result;
}
function assembleContext(state7) {
  const sections = [];
  if (state7.classification) {
    const meta = buildMetacognitiveInstruction(state7.classification);
    if (meta) sections.push(meta);
  }
  if (state7.priority) {
    const empathy = buildEmpathyGuidance(state7.priority);
    if (empathy) sections.push(empathy);
  }
  if (state7.userModel) {
    const userCtx = buildUserContext(state7.userModel);
    if (userCtx) sections.push(userCtx);
  }
  const memCtx = buildMemoryContext(state7.relevantMemories);
  if (memCtx) sections.push(memCtx);
  if (state7.relevantMemories.procedural.length > 0) {
    const procCtx = buildProceduralContext(state7.relevantMemories.procedural);
    if (procCtx) sections.push(procCtx);
  }
  if (state7.contextInjections.length > 0) {
    sections.push(...state7.contextInjections);
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
  if (procedures.length === 0) return void 0;
  const proc = procedures[0];
  const lines = [
    "## Learned Workflow Available",
    `Procedure: ${proc.description}`,
    `Success rate: ${(proc.successRate * 100).toFixed(0)}% over ${proc.usageCount} uses`,
    `Steps: ${proc.steps.join(" \u2192 ")}`,
    "Consider using this learned workflow if it fits the current request."
  ];
  return lines.join("\n");
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
  if (totalAlpha === 0) return;
  const responseLang = cyrillicCount / totalAlpha > 0.5 ? "ru" : "en";
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
async function validateAsync(response, originalInput, config10, classification, assessment, userModel, logger16) {
  const heuristicResult = validate(response, originalInput, classification, assessment, userModel);
  if (!isAIProviderAvailable(config10)) {
    return heuristicResult;
  }
  try {
    const userText = `\u0412\u043E\u043F\u0440\u043E\u0441: ${originalInput}

\u041E\u0442\u0432\u0435\u0442: ${response}`;
    const aiResponse = await callLLM(QUALITY_PROMPT, userText, config10, logger16, 300);
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
    logger16?.info(`BrainAgent Cerebellum: AI validation error \u2014 ${String(err)}`);
  }
  return heuristicResult;
}

// src/modules/mirror-neurons.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync4, readFileSync as readFileSync4, writeFileSync as writeFileSync4 } from "node:fs";
import { join as join4 } from "node:path";
var storageDir3 = "";
var userModels = /* @__PURE__ */ new Map();
function initMirrorStorage(workspaceDir) {
  userModels.clear();
  storageDir3 = join4(workspaceDir, ".brainagent", "users");
  if (!existsSync4(storageDir3)) {
    mkdirSync4(storageDir3, { recursive: true });
  }
  try {
    const indexPath = join4(storageDir3, "index.json");
    if (existsSync4(indexPath)) {
      const data = JSON.parse(readFileSync4(indexPath, "utf-8"));
      for (const [id, model] of Object.entries(data)) {
        userModels.set(id, model);
      }
    }
  } catch {
  }
}
function persistModels() {
  if (!storageDir3) return;
  try {
    const data = Object.fromEntries(userModels);
    writeFileSync4(join4(storageDir3, "index.json"), JSON.stringify(data, null, 2), "utf-8");
  } catch {
  }
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
function getOrCreateModel(userId) {
  let model = userModels.get(userId);
  if (!model) {
    model = createDefaultModel(userId);
    userModels.set(userId, model);
  }
  return model;
}
function getUserModel(userId) {
  return userModels.get(userId);
}
function observe(userId, text, amygdalaResult, config10) {
  const model = getOrCreateModel(userId);
  model.emotionHistory.push({
    timestamp: Date.now(),
    emotion: amygdalaResult.emotion,
    intensity: amygdalaResult.emotionIntensity
  });
  if (model.emotionHistory.length > config10.empathy.emotionHistoryLength) {
    model.emotionHistory = model.emotionHistory.slice(-config10.empathy.emotionHistoryLength);
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
  applyTheoryOfMindUpdates(model, text, amygdalaResult, config10);
  persistModels();
  bus.emit("mirror:user-updated", model);
  return model;
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
  if (totalAlpha === 0) return "unknown";
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
function processStyleReward(userId, reward, activeStyle) {
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
function getStyleRecommendation(userId) {
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
async function observeWithAI(userId, text, amygdalaResult, config10, neuroConfig, logger16) {
  const model = getOrCreateModel(userId);
  model.emotionHistory.push({
    timestamp: Date.now(),
    emotion: amygdalaResult.emotion,
    intensity: amygdalaResult.emotionIntensity
  });
  if (model.emotionHistory.length > config10.empathy.emotionHistoryLength) {
    model.emotionHistory = model.emotionHistory.slice(-config10.empathy.emotionHistoryLength);
  }
  model.moodTrend = computeMoodTrend(model.emotionHistory);
  const stressEmotions = ["frustration", "anger", "anxiety", "urgency"];
  const isStressed = stressEmotions.includes(amygdalaResult.emotion);
  const alpha = 0.3;
  model.stressLevel = model.stressLevel * (1 - alpha) + (isStressed ? amygdalaResult.emotionIntensity : 0) * alpha;
  const content = await callLLM(STYLE_PROMPT, text, neuroConfig, logger16, 100);
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
  applyTheoryOfMindUpdates(model, text, amygdalaResult, config10);
  persistModels();
  bus.emit("mirror:user-updated", model);
  return model;
}
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
function applyTheoryOfMindUpdates(model, text, amygdalaResult, config10) {
  ensureToMFields(model);
  const maxIntentHistory = config10.empathy.maxIntentHistory ?? 20;
  const domainLimit = config10.empathy.knowledgeModelDomainLimit ?? 15;
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
  const goals2 = [];
  const infoCount = intentCounts.get("seeking_information") ?? 0;
  const actionCount = intentCounts.get("requesting_action") ?? 0;
  const exploreCount = intentCounts.get("exploring_topic") ?? 0;
  const frustCount = intentCounts.get("expressing_frustration") ?? 0;
  if (infoCount >= 3) goals2.push("learning and understanding");
  if (actionCount >= 3) goals2.push("building or creating something");
  if (exploreCount >= 2) goals2.push("exploring new ideas");
  if (frustCount >= 2) goals2.push("resolving a persistent problem");
  if (infoCount + actionCount >= 5) goals2.push("active project development");
  model.inferredGoals = goals2.slice(0, 5);
}
function updateKnowledgeModelToM(model, text, domainLimit) {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 5).map((w) => w.replace(/[^a-zA-Zа-яА-ЯёЁ0-9-]/g, "")).filter(Boolean);
  const domainSignals = words.slice(0, 3);
  for (const domain of domainSignals) {
    const current = model.knowledgeModel[domain];
    if (!current) {
      model.knowledgeModel[domain] = "beginner";
    } else if (current === "beginner") {
      const topicFreq = model.frequentTopics.filter(
        (t) => t.includes(domain) || domain.includes(t)
      ).length;
      if (topicFreq >= 3) model.knowledgeModel[domain] = "familiar";
    } else if (current === "familiar") {
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

// src/modules/predictive-engine.ts
import { existsSync as existsSync5, mkdirSync as mkdirSync5, readFileSync as readFileSync5, writeFileSync as writeFileSync5 } from "node:fs";
import { join as join5 } from "node:path";
var storageDir4 = "";
var temporalPatterns = /* @__PURE__ */ new Map();
var sequentialPatterns = /* @__PURE__ */ new Map();
var contextualPatterns = /* @__PURE__ */ new Map();
var lastDomain;
function initPredictiveStorage(workspaceDir) {
  storageDir4 = join5(workspaceDir, ".brainagent", "predictions");
  if (!existsSync5(storageDir4)) {
    mkdirSync5(storageDir4, { recursive: true });
  }
  temporalPatterns.clear();
  sequentialPatterns.clear();
  contextualPatterns.clear();
  lastDomain = void 0;
  loadPatterns();
}
function loadPatterns() {
  if (!storageDir4) return;
  try {
    const tPath = join5(storageDir4, "temporal.json");
    if (existsSync5(tPath)) {
      const data = JSON.parse(readFileSync5(tPath, "utf-8"));
      for (const [key, val] of Object.entries(data)) temporalPatterns.set(key, val);
    }
  } catch {
  }
  try {
    const sPath = join5(storageDir4, "sequential.json");
    if (existsSync5(sPath)) {
      const data = JSON.parse(readFileSync5(sPath, "utf-8"));
      for (const [key, val] of Object.entries(data)) sequentialPatterns.set(key, val);
    }
  } catch {
  }
  try {
    const cPath = join5(storageDir4, "contextual.json");
    if (existsSync5(cPath)) {
      const data = JSON.parse(readFileSync5(cPath, "utf-8"));
      for (const [key, val] of Object.entries(data)) contextualPatterns.set(key, val);
    }
  } catch {
  }
}
function persistAll() {
  if (!storageDir4) return;
  try {
    writeFileSync5(
      join5(storageDir4, "temporal.json"),
      JSON.stringify(Object.fromEntries(temporalPatterns), null, 2),
      "utf-8"
    );
    writeFileSync5(
      join5(storageDir4, "sequential.json"),
      JSON.stringify(Object.fromEntries(sequentialPatterns), null, 2),
      "utf-8"
    );
    writeFileSync5(
      join5(storageDir4, "contextual.json"),
      JSON.stringify(Object.fromEntries(contextualPatterns), null, 2),
      "utf-8"
    );
  } catch {
  }
}
function observeInteraction(domain, keywords, context) {
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
function predict(currentContext) {
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
function getPredictiveStats() {
  let totalObs = 0;
  for (const t of temporalPatterns.values()) totalObs += t.totalObservations;
  return {
    temporalPatterns: temporalPatterns.size,
    sequentialPatterns: sequentialPatterns.size,
    contextualPatterns: contextualPatterns.size,
    totalObservations: totalObs
  };
}

// src/modules/basal-ganglia.ts
import { existsSync as existsSync6, mkdirSync as mkdirSync6, readFileSync as readFileSync6, writeFileSync as writeFileSync6 } from "node:fs";
import { join as join6 } from "node:path";
var storageDir5 = "";
var habits = [];
var habitIndex = new VectorIndex();
var MIN_ACTIVATIONS_FOR_AUTO = 3;
var MIN_REWARD_FOR_AUTO = 0.6;
var MAX_HABITS = 200;
var idCounter2 = 0;
function nextHabitId() {
  return `hab-${Date.now()}-${++idCounter2}`;
}
function initBasalStorage(workspaceDir) {
  storageDir5 = join6(workspaceDir, ".brainagent", "habits");
  if (!existsSync6(storageDir5)) {
    mkdirSync6(storageDir5, { recursive: true });
  }
  habits = [];
  habitIndex = new VectorIndex();
  loadHabits();
  rebuildIndex();
}
function loadHabits() {
  if (!storageDir5) return;
  try {
    const path = join6(storageDir5, "habits.json");
    if (existsSync6(path)) {
      habits = JSON.parse(readFileSync6(path, "utf-8"));
    }
  } catch {
    habits = [];
  }
}
function persistHabits() {
  if (!storageDir5) return;
  try {
    writeFileSync6(join6(storageDir5, "habits.json"), JSON.stringify(habits, null, 2), "utf-8");
  } catch {
  }
}
function rebuildIndex() {
  for (const habit of habits) {
    habitIndex.add(habit.id, `${habit.cue} ${habit.domain} ${habit.routine.join(" ")}`);
  }
}
function findHabit(input, domain) {
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
function recordPattern(cue, routine, domain, exampleResponse) {
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
function reinforce(habitId, signal) {
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
function detectReinforcement(text) {
  const lower = text.toLowerCase();
  const positivePatterns = [
    /спасибо/i,
    /благодарю/i,
    /отлично/i,
    /супер/i,
    /класс/i,
    /молодец/i,
    /круто/i,
    /здорово/i,
    /умница/i,
    /идеально/i,
    /perfect/i,
    /great/i,
    /thanks/i,
    /awesome/i,
    /excellent/i,
    /good job/i,
    /nice/i,
    /love it/i,
    /well done/i
  ];
  const negativePatterns = [
    /не то/i,
    /неправильно/i,
    /ошибка/i,
    /переделай/i,
    /заново/i,
    /не так/i,
    /плохо/i,
    /неверно/i,
    /wrong/i,
    /incorrect/i,
    /redo/i,
    /fix/i,
    /try again/i,
    /no that's not/i
  ];
  if (positivePatterns.some((p) => p.test(lower))) return "positive";
  if (negativePatterns.some((p) => p.test(lower))) return "negative";
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
async function detectReinforcementWithAI(text, config10, logger16) {
  const content = await callLLM(REINFORCEMENT_PROMPT, text, config10, logger16, 100);
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
function getBasalStats() {
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

// src/modules/dopamine-system.ts
import { existsSync as existsSync7, mkdirSync as mkdirSync7, readFileSync as readFileSync7, writeFileSync as writeFileSync7 } from "node:fs";
import { join as join7 } from "node:path";
var storageDir6 = "";
var state = {
  dopamine: 0.5,
  serotonin: 0.6,
  norepinephrine: 0.3,
  acetylcholine: 0.4
};
var expectedReward = 0.5;
var rewardHistory = [];
var positiveOutcomeRatio = 0.5;
var noveltyCounter = 0;
var totalInteractions = 0;
function initDopamineSystem(workspaceDir) {
  storageDir6 = join7(workspaceDir, ".brainagent", "neuromodulators");
  if (!existsSync7(storageDir6)) {
    mkdirSync7(storageDir6, { recursive: true });
  }
  loadState3();
}
function loadState3() {
  if (!storageDir6) return;
  try {
    const path = join7(storageDir6, "state.json");
    if (existsSync7(path)) {
      const data = JSON.parse(readFileSync7(path, "utf-8"));
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
function persistState3() {
  if (!storageDir6) return;
  try {
    writeFileSync7(
      join7(storageDir6, "state.json"),
      JSON.stringify(
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
      ),
      "utf-8"
    );
  } catch {
  }
}
function processInteractionOutcome(params, config10) {
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
    params.cerebellumIssues,
    reward
  );
  updateDopamine(predictionError, config10);
  updateSerotonin(reward);
  updateNorepinephrine(params.complexity, params.emotion);
  updateAcetylcholine(params.domain, config10);
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
  persistState3();
  return signal;
}
function computeCreditAssignment(modules, issues, reward) {
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
function updateDopamine(predictionError, config10) {
  const baseline = config10.neuromodulators.baselineDopamine;
  const decay = config10.neuromodulators.dopamineDecayRate;
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
function updateAcetylcholine(domain, _config) {
  const noveltyRatio = totalInteractions > 10 ? noveltyCounter / totalInteractions : 0.5;
  const target = 0.3 + noveltyRatio * 0.5;
  const alpha = 0.2;
  state.acetylcholine = state.acetylcholine * (1 - alpha) + target * alpha;
  state.acetylcholine = Math.max(0.1, Math.min(0.9, state.acetylcholine));
}
function markNovelty() {
  noveltyCounter++;
}
function getNeuromodulatorState() {
  return { ...state };
}
function getAttentionLevel() {
  return state.norepinephrine;
}
function getDopamineStats() {
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

// src/modules/learning-coordinator.ts
import { existsSync as existsSync8, mkdirSync as mkdirSync8, readFileSync as readFileSync8, writeFileSync as writeFileSync8 } from "node:fs";
import { join as join8 } from "node:path";
var storageDir7 = "";
var moduleMetrics = /* @__PURE__ */ new Map();
var cycleHistory = [];
var activeInsights = [];
var recurringIssues = /* @__PURE__ */ new Map();
var cycleCount = 0;
var revisionCounter = 0;
var coordinatorUnsubs = [];
var currentConfig = null;
var domainPerformance = /* @__PURE__ */ new Map();
var DOMAIN_TREND_WINDOW = 20;
function initLearningCoordinator(workspaceDir, config10) {
  storageDir7 = join8(workspaceDir, ".brainagent", "learning");
  if (!existsSync8(storageDir7)) {
    mkdirSync8(storageDir7, { recursive: true });
  }
  currentConfig = config10;
  moduleMetrics.clear();
  cycleHistory = [];
  activeInsights = [];
  cycleCount = 0;
  domainPerformance.clear();
  recurringIssues.clear();
  loadState4();
  for (const unsub of coordinatorUnsubs) unsub();
  coordinatorUnsubs = [];
  setupEventListeners();
}
function loadState4() {
  if (!storageDir7) return;
  try {
    const path = join8(storageDir7, "coordinator.json");
    if (existsSync8(path)) {
      const data = JSON.parse(readFileSync8(path, "utf-8"));
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
function persistState4() {
  if (!storageDir7) return;
  try {
    const metricsObj = {};
    for (const [key, val] of moduleMetrics) {
      metricsObj[key] = val;
    }
    writeFileSync8(
      join8(storageDir7, "coordinator.json"),
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
function setupEventListeners() {
  coordinatorUnsubs.push(
    bus.on("dopamine:reward", (signal) => {
      processRewardSignal(signal);
    })
  );
  coordinatorUnsubs.push(
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
  coordinatorUnsubs.push(
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
  const config10 = currentConfig;
  if (config10 && cycleCount >= config10.learning.minCyclesForInsights && cycleCount % 5 === 0) {
    generateInsights(config10);
  }
  if (cycleCount % 10 === 0) {
    generateCycleReport(signal);
  }
  persistState4();
}
function generateInsights(config10) {
  const window = config10.learning.trendWindowSize;
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
      const errorRate = metrics.errorCount / metrics.activationCount;
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
    const errorRate = metrics.activationCount > 0 ? metrics.errorCount / metrics.activationCount : 0;
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
function getLearningStats() {
  const modulePerf = {};
  for (const [name2, metrics] of moduleMetrics) {
    const recent = metrics.recentRewards.slice(-20);
    const avgReward = recent.length > 0 ? recent.reduce((s, v) => s + v, 0) / recent.length : 0;
    const errorRate = metrics.activationCount > 0 ? metrics.errorCount / metrics.activationCount : 0;
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
function buildLearningContext() {
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
function recordRecurringIssue(issueType) {
  const key = issueType.toLowerCase().trim();
  if (!key) return void 0;
  const existing = recurringIssues.get(key) ?? { count: 0, lastSeen: 0 };
  existing.count++;
  existing.lastSeen = Date.now();
  recurringIssues.set(key, existing);
  if (existing.count < 3) {
    persistState4();
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
  persistState4();
  bus.emitSync("learning:insight-discovered", insight);
  bus.emitSync("autonomy:learning-pattern-detected", {
    issueType: key,
    occurrences: existing.count,
    insight: insight.description
  });
  return insight;
}
function recordDomainPerformance(domain, reward, errorIssues = []) {
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
  persistState4();
  bus.emitSync("learning:domain-performance-updated", {
    domain,
    avgReward: perf.avgReward,
    trend: perf.trend
  });
}
function buildCapabilityContext(currentDomain) {
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

// src/modules/neural-pathways.ts
import { existsSync as existsSync9, mkdirSync as mkdirSync9, readFileSync as readFileSync9, writeFileSync as writeFileSync9 } from "node:fs";
import { join as join9 } from "node:path";
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
var storageDir8 = "";
var currentConfig2 = null;
var synapticState = createDefaultSynapticState();
var activatedPathways = /* @__PURE__ */ new Set();
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
var lastPredictions = [];
var currentCycleHabitId;
var lastCerebellumIssues = [];
var currentNeuroState = {
  dopamine: 0.5,
  serotonin: 0.6,
  norepinephrine: 0.3,
  acetylcholine: 0.4
};
var pathwayLogger;
var pathwayUnsubs = [];
function initNeuralPathways(workspaceDir, config10, logger16) {
  for (const unsub of pathwayUnsubs) unsub();
  pathwayUnsubs = [];
  activatedPathways.clear();
  pathwayLogger = logger16;
  currentConfig2 = config10;
  storageDir8 = join9(workspaceDir, ".brainagent", "synapses");
  if (!existsSync9(storageDir8)) {
    mkdirSync9(storageDir8, { recursive: true });
  }
  loadSynapticState();
  synapticState.learningRate = config10.synapticPlasticity.learningRate;
  synapticState.decayRate = config10.synapticPlasticity.decayRate;
  pathwayUnsubs.push(
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
          pathwayLogger?.info(
            `NeuralPathway: cerebellum\u2192basal-ganglia \u2014 weakening habit ${currentCycleHabitId} (${data.issues.length} issues)`
          );
        }
      }
    })
  );
  pathwayUnsubs.push(
    bus.on("predictive:predicted", (data) => {
      lastPredictions = data.predictions;
    })
  );
  pathwayUnsubs.push(
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
        pathwayLogger?.info(
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
  pathwayUnsubs.push(
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
  pathwayUnsubs.push(
    bus.on("dopamine:reward", (signal) => {
      markPathwayActivation("dopamine\u2192all");
      applyHebbianLearning(signal.reward);
      if (signal.reward < -0.3) {
        pathwayLogger?.info(
          `NeuralPathway: strong negative reward (${signal.reward.toFixed(2)}) \u2014 modules: ${signal.participatingModules.join(", ")}`
        );
      }
    })
  );
  pathwayUnsubs.push(
    bus.on("neuromodulator:state-changed", (newState) => {
      markPathwayActivation("neuromodulator-cache");
      currentNeuroState = newState;
    })
  );
  pathwayUnsubs.push(
    bus.on("learning:insight-discovered", (insight) => {
      if (!insight.actionable) return;
      markPathwayActivation("learning\u2192system");
      pathwayLogger?.info(
        `NeuralPathway: learning insight \u2014 [${insight.type}] ${insight.description}`
      );
    })
  );
  pathwayUnsubs.push(
    bus.on("dream:consolidation-complete", (data) => {
      markPathwayActivation("dream\u2192cross-module");
      if (data.merged > 0 || data.pruned > 0) {
        pathwayLogger?.info(
          `NeuralPathway: post-consolidation \u2014 ${data.merged} merged, ${data.pruned} pruned \u2192 memory state updated`
        );
      }
    })
  );
  pathwayUnsubs.push(
    bus.on("mirror:user-updated", (userModel) => {
      markPathwayActivation("mirror\u2192system");
      if (userModel.stressLevel > 0.7) {
        pathwayLogger?.info(
          `NeuralPathway: mirror\u2192system \u2014 high user stress detected (${(userModel.stressLevel * 100).toFixed(0)}%), adapting responses`
        );
      }
    })
  );
  pathwayLogger?.info(
    "NeuralPathways: 8 cross-module pathways initialized with synaptic plasticity"
  );
}
function markPathwayActivation(pathway) {
  activatedPathways.add(pathway);
}
function applyHebbianLearning(reward) {
  if (!currentConfig2 || activatedPathways.size === 0) return;
  const { learningRate, decayRate, minWeight, maxWeight } = currentConfig2.synapticPlasticity;
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
    if (weight.recentActivations.length > currentConfig2.synapticPlasticity.activationHistorySize) {
      weight.recentActivations = weight.recentActivations.slice(
        -currentConfig2.synapticPlasticity.activationHistorySize
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
      pathwayLogger?.info(
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
  if (!storageDir8) return;
  try {
    const path = join9(storageDir8, "weights.json");
    if (existsSync9(path)) {
      const data = JSON.parse(readFileSync9(path, "utf-8"));
      for (const name2 of PATHWAY_NAMES) {
        if (data.weights[name2]) {
          synapticState.weights[name2] = data.weights[name2];
        }
      }
      synapticState.totalCycles = data.totalCycles ?? 0;
      pathwayLogger?.info(
        `Synapse: loaded weights from ${synapticState.totalCycles} cycles of learning`
      );
    }
  } catch {
  }
}
function saveSynapticState() {
  if (!storageDir8) return;
  try {
    writeFileSync9(
      join9(storageDir8, "weights.json"),
      JSON.stringify(synapticState, null, 2),
      "utf-8"
    );
  } catch {
  }
}
function resetCycleState() {
  currentCycleHabitId = void 0;
  lastCerebellumIssues = [];
  activatedPathways.clear();
}
function getPathwayStats() {
  return {
    pathwayCount: 8,
    lastPredictionCount: lastPredictions.length,
    currentHabitId: currentCycleHabitId,
    neuroState: { ...currentNeuroState },
    totalLearningCycles: synapticState.totalCycles
  };
}
function getSynapticStats() {
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
function buildNeuromodulatorContext() {
  const significantDev = Math.abs(currentNeuroState.dopamine - 0.5) > 0.2 || Math.abs(currentNeuroState.norepinephrine - 0.3) > 0.2 || Math.abs(currentNeuroState.serotonin - 0.6) > 0.15;
  if (!significantDev) return void 0;
  const lines = ["## Cognitive State (Neuromodulators)"];
  if (currentNeuroState.dopamine > 0.7) {
    lines.push(
      "- High motivation/confidence: recent interactions went well. You can be more proactive and suggest improvements."
    );
  } else if (currentNeuroState.dopamine < 0.3) {
    lines.push(
      "- Low motivation: recent interactions had issues. Be extra careful and precise. Double-check your answers."
    );
  }
  if (currentNeuroState.norepinephrine > 0.6) {
    lines.push(
      "- High attention mode: the task requires focus. Retrieve more context from memory and be thorough."
    );
  }
  if (currentNeuroState.serotonin < 0.35) {
    lines.push("- Conservative mode: stick to proven approaches. Avoid risky suggestions.");
  } else if (currentNeuroState.serotonin > 0.75) {
    lines.push("- Exploratory mode: you can suggest creative alternatives and novel approaches.");
  }
  if (currentNeuroState.acetylcholine > 0.7) {
    lines.push(
      "- High learning mode: pay extra attention to new information from the user. Update your understanding actively."
    );
  }
  return lines.length > 1 ? lines.join("\n") : void 0;
}

// src/modules/structural-plasticity.ts
import { existsSync as existsSync10, mkdirSync as mkdirSync10, readFileSync as readFileSync10, writeFileSync as writeFileSync10 } from "node:fs";
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
var storageDir9 = "";
var currentConfig3 = null;
var logger;
var state2 = createDefaultState();
var currentCycleActivations = /* @__PURE__ */ new Set();
function createDefaultState() {
  return {
    coActivations: [],
    dynamicPathways: [],
    totalCycles: 0,
    lastPruning: Date.now()
  };
}
function initStructuralPlasticity(workspaceDir, config10, log) {
  currentConfig3 = config10;
  logger = log;
  storageDir9 = join10(workspaceDir, ".brainagent", "structural");
  if (!existsSync10(storageDir9)) {
    mkdirSync10(storageDir9, { recursive: true });
  }
  loadState5();
  logger?.info(
    `StructuralPlasticity: initialized with ${state2.dynamicPathways.length} dynamic pathways`
  );
}
function markModuleActivation(module) {
  currentCycleActivations.add(module);
}
function endCycle(reward) {
  if (!currentConfig3) return;
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
  for (const pathway of state2.dynamicPathways) {
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
  state2.totalCycles++;
  checkForNewPathways();
  if (state2.totalCycles % currentConfig3.structuralPlasticity.pruningThreshold === 0) {
    pruneUnusedPathways();
  }
  currentCycleActivations.clear();
  if (state2.totalCycles % 10 === 0) {
    saveState();
  }
}
function updateCoActivation(moduleA, moduleB, bothActive, timestamp) {
  let record = state2.coActivations.find(
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
    state2.coActivations.push(record);
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
  const totalActivations2 = record.activationsA + record.activationsB - record.coActivations;
  record.correlation = totalActivations2 > 0 ? record.coActivations / totalActivations2 : 0;
  record.lastUpdated = timestamp;
}
function checkForNewPathways() {
  if (!currentConfig3) return;
  const { minCorrelationForPathway, minCyclesForPathway, maxDynamicPathways } = currentConfig3.structuralPlasticity;
  if (state2.dynamicPathways.filter((p) => p.status === "active").length >= maxDynamicPathways) {
    return;
  }
  for (const record of state2.coActivations) {
    const existingPathway = state2.dynamicPathways.find(
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
    state2.dynamicPathways.push(newPathway);
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
  if (!currentConfig3) return;
  const now = Date.now();
  state2.lastPruning = now;
  for (const pathway of state2.dynamicPathways) {
    if (pathway.status !== "active") continue;
    const ageInCycles = state2.totalCycles - pathway.usageCount;
    const usageRate = pathway.usageCount / Math.max(1, ageInCycles);
    if (usageRate < 0.1 && pathway.usageCount < 5) {
      pathway.status = "dormant";
      logger?.info(`StructuralPlasticity: pathway ${pathway.from} \u2194 ${pathway.to} marked DORMANT`);
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
function getStructuralStats() {
  const activePathways = state2.dynamicPathways.filter((p) => p.status === "active").length;
  const dormantPathways = state2.dynamicPathways.filter((p) => p.status === "dormant").length;
  const prunedPathways = state2.dynamicPathways.filter((p) => p.status === "pruned").length;
  const topCorrelations = [...state2.coActivations].sort((a, b) => b.correlation - a.correlation).slice(0, 5).map((r) => ({
    moduleA: r.moduleA,
    moduleB: r.moduleB,
    correlation: r.correlation
  }));
  return {
    totalCycles: state2.totalCycles,
    coActivationPairs: state2.coActivations.length,
    dynamicPathways: {
      active: activePathways,
      dormant: dormantPathways,
      pruned: prunedPathways
    },
    topCorrelations,
    pathwayDetails: state2.dynamicPathways.filter((p) => p.status === "active")
  };
}
function loadState5() {
  try {
    const path = join10(storageDir9, "state.json");
    if (existsSync10(path)) {
      const data = JSON.parse(readFileSync10(path, "utf-8"));
      state2 = data;
    }
  } catch {
  }
}
function saveState() {
  try {
    writeFileSync10(join10(storageDir9, "state.json"), JSON.stringify(state2, null, 2), "utf-8");
  } catch {
  }
}

// src/modules/emotional-memory.ts
import { existsSync as existsSync11, mkdirSync as mkdirSync11, readFileSync as readFileSync11, writeFileSync as writeFileSync11 } from "node:fs";
import { join as join11 } from "node:path";
var storageDir10 = "";
var state3 = { flashbulbCount: 0, emotionMatchBoosts: 0 };
var qualiaHistory = [];
var maxQualiaHistory = 10;
var metaphorCache = /* @__PURE__ */ new Map();
var lastLLMCallTimestamp = 0;
var LLM_THROTTLE_MS = 1e4;
var CACHE_TTL_MS = 5 * 60 * 1e3;
var LLM_INTENSITY_THRESHOLD = 0.5;
function initEmotionalMemory(workspaceDir, _config) {
  storageDir10 = join11(workspaceDir, ".brainagent", "emotional-memory");
  if (!existsSync11(storageDir10)) {
    mkdirSync11(storageDir10, { recursive: true });
  }
  state3 = { flashbulbCount: 0, emotionMatchBoosts: 0 };
  qualiaHistory = [];
  maxQualiaHistory = _config.emotionalMemory.maxQualiaHistory ?? 10;
  metaphorCache.clear();
  lastLLMCallTimestamp = 0;
  loadState6();
}
function loadState6() {
  if (!storageDir10) return;
  try {
    const path = join11(storageDir10, "state.json");
    if (existsSync11(path)) {
      const raw = JSON.parse(readFileSync11(path, "utf-8"));
      state3 = {
        flashbulbCount: raw.flashbulbCount ?? 0,
        emotionMatchBoosts: raw.emotionMatchBoosts ?? 0
      };
      if (Array.isArray(raw.qualiaHistory)) {
        qualiaHistory = raw.qualiaHistory.slice(-maxQualiaHistory);
      }
    }
  } catch {
    state3 = { flashbulbCount: 0, emotionMatchBoosts: 0 };
    qualiaHistory = [];
  }
}
function persistState5() {
  if (!storageDir10) return;
  try {
    writeFileSync11(
      join11(storageDir10, "state.json"),
      JSON.stringify({ ...state3, qualiaHistory }, null, 2),
      "utf-8"
    );
  } catch {
  }
}
function tagEmotionalContext(emotion, intensity) {
  if (intensity <= 0.3) return void 0;
  state3.flashbulbCount++;
  persistState5();
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
  persistState5();
  return qualia;
}
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
async function generateQualiaAsync(emotion, intensity, domain, neuromodulators, config10, logger16) {
  if (intensity <= LLM_INTENSITY_THRESHOLD || !config10) {
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
      persistState5();
      return qualia;
    }
  }
  if (intensity <= 0.8 && now - lastLLMCallTimestamp < LLM_THROTTLE_MS) {
    return generateQualia(emotion, intensity, domain, neuromodulators);
  }
  if (!isAIProviderAvailable(config10)) {
    return generateQualia(emotion, intensity, domain, neuromodulators);
  }
  const neuroDesc = neuromodulators ? `Neuromodulators: dopamine=${neuromodulators.dopamine.toFixed(2)}, serotonin=${neuromodulators.serotonin.toFixed(2)}, norepinephrine=${neuromodulators.norepinephrine.toFixed(2)}, acetylcholine=${neuromodulators.acetylcholine.toFixed(2)}` : "Neuromodulators: balanced (0.50 each)";
  const userMessage = `Emotion: ${emotion} (intensity: ${intensity.toFixed(2)})
Domain: ${domain}
${neuroDesc}`;
  try {
    lastLLMCallTimestamp = now;
    const response = await callLLM(QUALIA_METAPHOR_PROMPT, userMessage, config10, logger16, 200);
    if (!response) {
      logger16?.info("BrainAgent Qualia: LLM returned null, falling back to template");
      return generateQualia(emotion, intensity, domain, neuromodulators);
    }
    const parsed = parseLLMQualiaResponse(response);
    if (!parsed) {
      logger16?.info("BrainAgent Qualia: failed to parse LLM response, falling back to template");
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
    persistState5();
    logger16?.info(`BrainAgent Qualia: LLM-generated metaphor for ${emotion}/${domain}`);
    return qualia;
  } catch (err) {
    logger16?.info(`BrainAgent Qualia: AI metaphor generation failed \u2014 ${String(err)}`);
    return generateQualia(emotion, intensity, domain, neuromodulators);
  }
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
async function extractFactsWithAI(text, config10, logger16) {
  const content = await callLLM(EXTRACTION_PROMPT, text, config10, logger16, 500);
  if (!content) return [];
  const facts = parseFactsFromResponse(content);
  if (facts.length > 0) {
    logger16?.info(`BrainAgent AI Extractor: found ${facts.length} facts`);
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
function isAIProviderAvailable2(config10) {
  return isAIProviderAvailable(config10);
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
function extractProcedure(text, classification) {
  const proceduralDomains = ["technical", "command", "factual"];
  const domain = classification?.domain ?? "unknown";
  const domainBoost = proceduralDomains.includes(domain) ? 0.2 : 0;
  for (const procPattern of PROCEDURE_PATTERNS) {
    const match = text.match(procPattern.pattern);
    if (!match) continue;
    const extracted = procPattern.extract(match, text);
    if (!extracted) continue;
    if (!extracted.triggerPattern || extracted.triggerPattern.length < 5) continue;
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
    if (!trigger || trigger.length < 3) return null;
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
async function extractProcedureAsync(text, config10, classification, logger16) {
  if (isAIProviderAvailable(config10)) {
    try {
      const aiResponse = await callLLM(PROCEDURE_PROMPT, text, config10, logger16, 300);
      if (aiResponse) {
        const parsed = parseProcedureResponse(aiResponse, classification);
        if (parsed) return parsed;
      }
    } catch (err) {
      logger16?.info(`BrainAgent Procedural: AI extraction error \u2014 ${String(err)}`);
    }
  }
  return extractProcedure(text, classification);
}

// src/adapter/llm-bridge.ts
import { createUserMessage } from "@deepseek-ai/dsh-llm";
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
  setCallLLMBackend(async (systemPrompt, userText, _config, logger16, maxTokens) => {
    const route = await resolveRoute();
    if (!route || !ctx.llm) return void 0;
    try {
      const chunks = ctx.llm.stream({
        provider: route.provider,
        model: route.model,
        system: systemPrompt,
        messages: [
          createUserMessage({
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
      logger16?.info(`BrainAgent LLM bridge: ctx.llm call failed \u2014 ${String(error)}`);
      return void 0;
    }
  });
  void resolveRoute();
  return () => {
    setCallLLMBackend(void 0);
    setAIAvailabilityHook(void 0);
  };
}

// src/modules/session-bridge.ts
import { existsSync as existsSync12, mkdirSync as mkdirSync12, readFileSync as readFileSync12, writeFileSync as writeFileSync12 } from "node:fs";
import { join as join12 } from "node:path";
var storageDir11 = "";
var gapThresholdMs = 30 * 60 * 1e3;
var maxSummaryTopics = 5;
var lastInteractionTime = Date.now();
var currentSession = createFreshSession();
var lastSession = null;
var gapJustDetected = false;
function initSessionBridge(workspaceDir, config10, _logger) {
  storageDir11 = join12(workspaceDir, ".brainagent", "sessions");
  if (!existsSync12(storageDir11)) {
    mkdirSync12(storageDir11, { recursive: true });
  }
  gapThresholdMs = config10.sessionBridge.gapThresholdMs;
  maxSummaryTopics = config10.sessionBridge.maxSummaryTopics;
  currentSession = createFreshSession();
  lastSession = null;
  gapJustDetected = false;
  loadState7();
  lastInteractionTime = Date.now();
}
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
function loadState7() {
  if (!storageDir11) return;
  try {
    const currentPath = join12(storageDir11, "current.json");
    if (existsSync12(currentPath)) {
      const data = JSON.parse(readFileSync12(currentPath, "utf-8"));
      if (data && typeof data.startedAt === "number") {
        currentSession = data;
      }
    }
  } catch {
  }
  try {
    const lastPath = join12(storageDir11, "last.json");
    if (existsSync12(lastPath)) {
      lastSession = JSON.parse(readFileSync12(lastPath, "utf-8"));
    }
  } catch {
  }
}
function persistCurrent() {
  if (!storageDir11) return;
  try {
    writeFileSync12(
      join12(storageDir11, "current.json"),
      JSON.stringify(currentSession, null, 2),
      "utf-8"
    );
  } catch {
  }
}
function persistLast() {
  if (!storageDir11) return;
  try {
    writeFileSync12(join12(storageDir11, "last.json"), JSON.stringify(lastSession, null, 2), "utf-8");
  } catch {
  }
}
function recordCycleForSession(input, classification, assessment, reward) {
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
function checkSessionGap() {
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
function buildSessionBridgeContext() {
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
function getSessionBridgeStats() {
  return {
    currentCycles: currentSession.cycleCount,
    lastSessionTopics: lastSession?.topicsDiscussed ?? [],
    gapDetected: gapJustDetected
  };
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

// src/modules/dmn.ts
import { existsSync as existsSync13, mkdirSync as mkdirSync13, readFileSync as readFileSync13, writeFileSync as writeFileSync13 } from "node:fs";
import { join as join13 } from "node:path";
var storageDir12 = "";
var insights = [];
var lastRunTimestamp = 0;
var totalAssociationsFound = 0;
var currentConfig4 = null;
var logger2;
var innerMonologue = [];
var maxBackgroundThoughts = 20;
function initDMN(workspaceDir, config10, log) {
  storageDir12 = join13(workspaceDir, ".brainagent", "dmn");
  if (!existsSync13(storageDir12)) {
    mkdirSync13(storageDir12, { recursive: true });
  }
  currentConfig4 = config10;
  logger2 = log;
  insights = [];
  lastRunTimestamp = 0;
  totalAssociationsFound = 0;
  innerMonologue = [];
  maxBackgroundThoughts = config10.dmn.maxBackgroundThoughts ?? 20;
  loadState8();
}
function loadState8() {
  if (!storageDir12) return;
  try {
    const path = join13(storageDir12, "state.json");
    if (existsSync13(path)) {
      const data = JSON.parse(readFileSync13(path, "utf-8"));
      insights = data.insights ?? [];
      lastRunTimestamp = data.lastRunTimestamp ?? 0;
      totalAssociationsFound = data.totalAssociationsFound ?? 0;
      innerMonologue = (data.innerMonologue ?? []).slice(-maxBackgroundThoughts);
    }
  } catch {
  }
}
function persistState6() {
  if (!storageDir12) return;
  try {
    writeFileSync13(
      join13(storageDir12, "state.json"),
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
async function runAssociationFinding(config10) {
  const maxInsights = config10.dmn.maxInsightsPerCycle;
  const minSimilarity = config10.dmn.minSimilarityForAssociation;
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
  logger2?.info(
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
  persistState6();
  logger2?.info(`DMN: found ${newInsights.length} cross-domain associations`);
  return newInsights;
}
function getDMNStats() {
  return {
    totalInsights: insights.length,
    lastRunTimestamp,
    associationsFound: totalAssociationsFound,
    backgroundThoughts: innerMonologue.length
  };
}
function generateBackgroundThoughts(config10, unresolvedQuestions, recentEmotions, knowledgeGaps) {
  const maxPerCycle = config10.dmn.maxThoughtsPerCycle ?? 5;
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
    for (const gap of knowledgeGaps.slice(0, 2)) {
      if (newThoughts.length >= maxPerCycle) break;
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
  persistState6();
  logger2?.info(`DMN: generated ${newThoughts.length} background thoughts`);
  return newThoughts;
}
function buildBackgroundThoughtContext() {
  if (innerMonologue.length === 0) return void 0;
  const recent = innerMonologue.slice(-3);
  const lines = recent.map((t) => `- ${t.content}`).join("\n");
  return `<background-thoughts>
${lines}
</background-thoughts>`;
}
function getRecentUnusedInsights(maxAge = 24 * 60 * 60 * 1e3) {
  const cutoff = Date.now() - maxAge;
  return insights.filter((i) => !i.wasUseful && i.timestamp >= cutoff);
}

// src/modules/goal-stack.ts
import { existsSync as existsSync14, mkdirSync as mkdirSync14, readFileSync as readFileSync14, writeFileSync as writeFileSync14 } from "node:fs";
import { join as join14 } from "node:path";
var storageDir13 = "";
var goals = [];
var maxGoals = 20;
var defaultTTLMs = 24 * 60 * 60 * 1e3;
var idCounter3 = 0;
var desires = [];
var decisionLog = [];
var maxDesires = 10;
var maxDecisionLog = 20;
var explorationRate = 0.05;
function initGoalStack(workspaceDir, config10) {
  storageDir13 = join14(workspaceDir, ".brainagent", "goals");
  if (!existsSync14(storageDir13)) {
    mkdirSync14(storageDir13, { recursive: true });
  }
  maxGoals = config10.goalStack.maxGoals;
  defaultTTLMs = config10.goalStack.defaultTTLMs;
  maxDesires = config10.goalStack.maxDesires;
  maxDecisionLog = config10.goalStack.maxDecisionLog;
  explorationRate = config10.goalStack.explorationRate;
  goals = [];
  desires = [];
  decisionLog = [];
  idCounter3 = 0;
  loadState9();
}
function loadState9() {
  if (!storageDir13) return;
  try {
    const path = join14(storageDir13, "state.json");
    if (existsSync14(path)) {
      const raw = JSON.parse(readFileSync14(path, "utf-8"));
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
function persistState7() {
  if (!storageDir13) return;
  try {
    writeFileSync14(
      join14(storageDir13, "state.json"),
      JSON.stringify({ goals, desires, decisionLog }, null, 2),
      "utf-8"
    );
  } catch {
  }
}
function createGoal(description, trigger, source, contextInjection, priority = 0.5, ttlMs, recurring) {
  const now = Date.now();
  const goal = {
    id: `goal_${now}_${++idCounter3}`,
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
  persistState7();
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
function checkGoalTriggers(input, currentEmotion, currentDomain) {
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
  if (triggered.length > 0) persistState7();
  return triggered;
}
function expireGoals() {
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
    const active = goals.filter((g) => g.status === "pending" || g.status === "triggered");
    const inactive = goals.filter((g) => g.status === "completed" || g.status === "expired").slice(-30);
    goals = [...active, ...inactive];
    changed = true;
  }
  if (changed) persistState7();
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
function getGoalStackStats() {
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
function addDesire(type, description, strength, source) {
  const now = Date.now();
  const desire = {
    id: `desire_${now}_${++idCounter3}`,
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
  persistState7();
  bus.emitSync("volition:desire-activated", {
    desireId: desire.id,
    type: desire.type,
    strength: desire.strength
  });
  return desire;
}
function buildVolitionContext() {
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
function getDesires() {
  return [...desires];
}
function weakenDesiresAfterFire(consecutiveFires) {
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
  if (desires.length !== before || changed) persistState7();
}
function satisfyDesiresOnUserResponse() {
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
  if (desires.length !== before || changed) persistState7();
}
var explorationBoosts = [];
function tickExplorationBoosts() {
  for (let i = explorationBoosts.length - 1; i >= 0; i--) {
    explorationBoosts[i].remainingCycles--;
    if (explorationBoosts[i].remainingCycles <= 0) {
      explorationBoosts.splice(i, 1);
    }
  }
}
var desireCycleAge = /* @__PURE__ */ new Map();
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
async function extractGoalsFromConversation(userMessage, config10, logger16) {
  if (!isAIProviderAvailable(config10)) {
    logger16?.info("BrainAgent GoalStack: no AI provider available, skipping goal extraction");
    return [];
  }
  logger16?.info("BrainAgent GoalStack: extracting goals from conversation...");
  const response = await callLLM(GOAL_EXTRACTION_PROMPT, userMessage, config10, logger16, 300);
  if (!response) {
    logger16?.info("BrainAgent GoalStack: LLM returned null/empty response");
    return [];
  }
  logger16?.info(`BrainAgent GoalStack: LLM response received (${response.length} chars)`);
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
    logger16?.info("BrainAgent GoalStack: failed to parse LLM goal extraction response");
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
    logger16?.info(
      `BrainAgent GoalStack: extracted ${createdGoals.length} goal(s) from conversation`
    );
  }
  return createdGoals;
}
function checkAutonomousGoals(idleMs) {
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
  if (triggered.length > 0) persistState7();
  return triggered;
}

// src/modules/curiosity-drive.ts
import { existsSync as existsSync15, mkdirSync as mkdirSync15, readFileSync as readFileSync15, writeFileSync as writeFileSync15 } from "node:fs";
import { join as join15 } from "node:path";
var storageDir14 = "";
var gaps = [];
var totalDetected = 0;
var questionsGenerated = 0;
var gapsFilled = 0;
var maxGaps = 15;
var minGapConfidence = 0.3;
var askProbability = 0.1;
var idCounter4 = 0;
function initCuriosityDrive(workspaceDir, config10) {
  storageDir14 = join15(workspaceDir, ".brainagent", "curiosity");
  if (!existsSync15(storageDir14)) {
    mkdirSync15(storageDir14, { recursive: true });
  }
  maxGaps = config10.curiosity.maxGaps;
  minGapConfidence = config10.curiosity.minGapConfidence;
  askProbability = config10.curiosity.askProbability;
  gaps = [];
  totalDetected = 0;
  questionsGenerated = 0;
  gapsFilled = 0;
  idCounter4 = 0;
  loadState10();
}
function loadState10() {
  if (!storageDir14) return;
  try {
    const path = join15(storageDir14, "state.json");
    if (existsSync15(path)) {
      const data = JSON.parse(readFileSync15(path, "utf-8"));
      gaps = data.gaps ?? [];
      totalDetected = data.totalDetected ?? 0;
      questionsGenerated = data.questionsGenerated ?? 0;
      gapsFilled = data.gapsFilled ?? 0;
    }
  } catch {
  }
}
function persistState8() {
  if (!storageDir14) return;
  try {
    writeFileSync15(
      join15(storageDir14, "state.json"),
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
function detectKnowledgeGap(topic, domain, recallWasEmpty, predictionConfidence) {
  const isLowConfidence = predictionConfidence !== void 0 && predictionConfidence < minGapConfidence;
  if (!recallWasEmpty && !isLowConfidence) {
    return;
  }
  const topicLower = topic.toLowerCase();
  const existing = gaps.find((g) => g.topic.toLowerCase() === topicLower && g.status === "open");
  if (existing) {
    existing.timesEncountered++;
    existing.lastEncountered = Date.now();
    existing.confidence = Math.min(1, existing.confidence + 0.1);
    persistState8();
    return;
  }
  const confidence = recallWasEmpty ? 0.7 : 0.4;
  if (confidence < minGapConfidence) return;
  const gap = {
    id: `gap_${Date.now()}_${++idCounter4}`,
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
  persistState8();
  bus.emitSync("curiosity:gap-detected", { topic, domain });
}
function buildCuriosityContext(serotoninLevel, _acetylcholineLevel) {
  const openGaps = gaps.filter((g) => g.status === "open");
  if (openGaps.length === 0) return void 0;
  const effectiveProbability = askProbability * serotoninLevel * 2;
  if (Math.random() > effectiveProbability) return void 0;
  openGaps.sort((a, b) => b.timesEncountered - a.timesEncountered);
  const gap = openGaps[0];
  questionsGenerated++;
  persistState8();
  const question = `I notice we haven't discussed "${gap.topic}" in detail. If relevant, I'd like to learn more about this topic to better assist you.`;
  bus.emitSync("curiosity:question-generated", {
    topic: gap.topic,
    question
  });
  return `## Curiosity Note
${question}`;
}
function markGapFilled(topic) {
  const topicLower = topic.toLowerCase();
  for (const gap of gaps) {
    if (gap.status === "open" && gap.topic.toLowerCase() === topicLower) {
      gap.status = "filled";
      gapsFilled++;
    }
  }
  persistState8();
}
function getCuriosityStats() {
  return {
    openGaps: gaps.filter((g) => g.status === "open").length,
    totalDetected,
    questionsGenerated,
    gapsFilled
  };
}
function getOpenGaps() {
  return gaps.filter((g) => g.status === "open");
}

// src/modules/social-drive.ts
import { existsSync as existsSync17, mkdirSync as mkdirSync17, readFileSync as readFileSync17, writeFileSync as writeFileSync17 } from "node:fs";
import { join as join17 } from "node:path";

// src/modules/circadian-rhythm.ts
import { existsSync as existsSync16, mkdirSync as mkdirSync16, readFileSync as readFileSync16, writeFileSync as writeFileSync16 } from "node:fs";
import { join as join16 } from "node:path";
var storageDir15 = "";
var currentConfig5 = null;
var logger3;
var state4 = createDefaultState2();
var lastActivityTime = Date.now();
var activityCounter = 0;
var evaluationTimer = null;
var consolidationCallback = null;
var maxSleepConsolidations = 5;
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
function initCircadianRhythm(workspaceDir, config10, log) {
  storageDir15 = join16(workspaceDir, ".brainagent", "circadian");
  if (!existsSync16(storageDir15)) {
    mkdirSync16(storageDir15, { recursive: true });
  }
  currentConfig5 = config10;
  logger3 = log;
  maxSleepConsolidations = config10.circadian.maxSleepConsolidations ?? 5;
  state4 = createDefaultState2();
  loadState11();
  updateModulationFromPhase();
  if (evaluationTimer) {
    clearInterval(evaluationTimer);
  }
  const evalInterval = config10.circadian.evaluationIntervalMs ?? 3e4;
  evaluationTimer = setInterval(() => evaluatePhase(), evalInterval);
  logger3?.info(
    `Circadian: initialized in ${state4.phase} phase (idle threshold: ${config10.circadian.idleThresholdMs / 1e3}s)`
  );
}
function stopCircadianRhythm() {
  if (evaluationTimer) {
    clearInterval(evaluationTimer);
    evaluationTimer = null;
  }
  persistState9();
}
function setConsolidationCallback(callback) {
  consolidationCallback = callback;
}
function loadState11() {
  if (!storageDir15) return;
  try {
    const path = join16(storageDir15, "state.json");
    if (existsSync16(path)) {
      const data = JSON.parse(readFileSync16(path, "utf-8"));
      state4 = { ...createDefaultState2(), ...data };
      state4.phaseStartedAt = Date.now();
      state4.idleTime = 0;
      lastActivityTime = Date.now();
    }
  } catch {
  }
}
function persistState9() {
  if (!storageDir15) return;
  try {
    writeFileSync16(join16(storageDir15, "state.json"), JSON.stringify(state4, null, 2), "utf-8");
  } catch {
  }
}
function evaluatePhase() {
  if (!currentConfig5?.circadian.enabled) return;
  const now = Date.now();
  const idleTime = now - lastActivityTime;
  state4.idleTime = idleTime;
  const activityWindow = currentConfig5.circadian.activityWindowMs;
  state4.activityLevel = Math.max(0, 1 - idleTime / activityWindow);
  const phaseDuration = now - state4.phaseStartedAt;
  const { idleThresholdMs, minWakeDurationMs, minSleepDurationMs, transitionDurationMs } = currentConfig5.circadian;
  switch (state4.phase) {
    case "wake":
      if (idleTime >= idleThresholdMs && phaseDuration >= minWakeDurationMs) {
        transitionTo("transition-to-sleep");
      }
      break;
    case "transition-to-sleep":
      state4.phaseProgress = Math.min(1, phaseDuration / transitionDurationMs);
      updateModulationFromPhase();
      if (activityCounter > 0) {
        activityCounter = 0;
        transitionTo("wake");
      } else if (state4.phaseProgress >= 1) {
        transitionTo("sleep");
      }
      break;
    case "sleep":
      if (consolidationCallback && phaseDuration > 3e4 && state4.sleepConsolidations < maxSleepConsolidations) {
        const consolidationInterval = currentConfig5?.circadian.sleepConsolidationIntervalMs ?? 6e4;
        const triggerWindow = consolidationInterval / 3;
        const shouldConsolidate = phaseDuration % consolidationInterval < triggerWindow && state4.sleepConsolidations === 0;
        if (shouldConsolidate || phaseDuration > state4.sleepConsolidations * consolidationInterval) {
          void triggerSleepConsolidation();
        }
      }
      if (activityCounter > 0 && phaseDuration >= minSleepDurationMs) {
        activityCounter = 0;
        transitionTo("transition-to-wake");
      }
      break;
    case "transition-to-wake":
      state4.phaseProgress = Math.min(1, phaseDuration / transitionDurationMs);
      updateModulationFromPhase();
      if (state4.phaseProgress >= 1) {
        transitionTo("wake");
      }
      break;
  }
}
function transitionTo(newPhase) {
  const oldPhase = state4.phase;
  if (oldPhase === newPhase) return;
  logger3?.info(`Circadian: ${oldPhase} \u2192 ${newPhase}`);
  state4.phase = newPhase;
  state4.phaseStartedAt = Date.now();
  state4.phaseProgress = 0;
  if (newPhase === "wake") {
    state4.wakeInteractions = 0;
    bus.emitSync("circadian:wake-started", { idleTime: state4.idleTime });
  } else if (newPhase === "sleep") {
    state4.sleepConsolidations = 0;
    bus.emitSync("circadian:sleep-started", { wakeInteractions: state4.wakeInteractions });
  }
  updateModulationFromPhase();
  bus.emitSync("circadian:phase-changed", { oldPhase, newPhase });
  persistState9();
}
function updateModulationFromPhase() {
  if (!currentConfig5) return;
  const cfg = currentConfig5.circadian;
  switch (state4.phase) {
    case "wake":
      state4.wakeModulation = {
        dopamineBoost: cfg.wakeDopamineBoost,
        serotoninBoost: cfg.wakeSerotoninBoost,
        acetylcholineBoost: cfg.wakeAcetylcholineBoost,
        norepinephrineBoost: 1.1
        // Slightly elevated attention
      };
      state4.sleepSettings = {
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
      const sleepProgress = state4.phaseProgress;
      state4.wakeModulation = {
        dopamineBoost: lerp(cfg.wakeDopamineBoost, sm1.dopamine, sleepProgress),
        serotoninBoost: lerp(cfg.wakeSerotoninBoost, sm1.serotonin, sleepProgress),
        acetylcholineBoost: lerp(cfg.wakeAcetylcholineBoost, sm1.acetylcholine, sleepProgress),
        norepinephrineBoost: lerp(1.1, sm1.norepinephrine, sleepProgress)
      };
      state4.sleepSettings = {
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
      state4.wakeModulation = {
        dopamineBoost: sm.dopamine,
        serotoninBoost: sm.serotonin,
        acetylcholineBoost: sm.acetylcholine,
        norepinephrineBoost: sm.norepinephrine
      };
      state4.sleepSettings = {
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
      const wakeProgress = state4.phaseProgress;
      state4.wakeModulation = {
        dopamineBoost: lerp(sm2.dopamine, cfg.wakeDopamineBoost, wakeProgress),
        serotoninBoost: lerp(sm2.serotonin, cfg.wakeSerotoninBoost, wakeProgress),
        acetylcholineBoost: lerp(sm2.acetylcholine, cfg.wakeAcetylcholineBoost, wakeProgress),
        norepinephrineBoost: lerp(sm2.norepinephrine, 1.1, wakeProgress)
      };
      state4.sleepSettings = {
        consolidationIntensity: lerp(cfg.sleepConsolidationIntensity, 0.3, wakeProgress),
        pruningAggressiveness: lerp(cfg.sleepPruningAggressiveness, 0.1, wakeProgress),
        synapticNormalization: wakeProgress < 0.5
      };
      break;
    }
  }
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
async function triggerSleepConsolidation() {
  if (!consolidationCallback) return;
  state4.sleepConsolidations++;
  logger3?.info(
    `Circadian: sleep consolidation #${state4.sleepConsolidations} (intensity: ${(state4.sleepSettings.consolidationIntensity * 100).toFixed(0)}%)`
  );
  try {
    await consolidationCallback();
  } catch (err) {
    logger3?.warn(`Circadian: consolidation error \u2014 ${String(err)}`);
  }
}
function recordActivity() {
  lastActivityTime = Date.now();
  activityCounter++;
  state4.wakeInteractions++;
  bus.emitSync("circadian:activity-detected", { activityLevel: state4.activityLevel });
  if (state4.phase === "sleep" || state4.phase === "transition-to-sleep") {
    const phaseDuration = Date.now() - state4.phaseStartedAt;
    const minSleep = currentConfig5?.circadian.minSleepDurationMs ?? 6e4;
    if (state4.phase === "transition-to-sleep" || phaseDuration >= minSleep) {
      transitionTo("transition-to-wake");
    }
  }
}
function getCircadianState() {
  return { ...state4 };
}
function getSleepSettings() {
  return { ...state4.sleepSettings };
}
function isInSleepPhase() {
  return state4.phase === "sleep" || state4.phase === "transition-to-sleep";
}
function isInWakePhase() {
  return state4.phase === "wake" || state4.phase === "transition-to-wake";
}
function forcePhase(phase) {
  logger3?.info(`Circadian: forced phase change to ${phase}`);
  transitionTo(phase);
}
function getCircadianStats() {
  return {
    phase: state4.phase,
    phaseProgress: state4.phaseProgress,
    phaseDuration: Date.now() - state4.phaseStartedAt,
    idleTime: state4.idleTime,
    activityLevel: state4.activityLevel,
    wakeInteractions: state4.wakeInteractions,
    sleepConsolidations: state4.sleepConsolidations,
    modulation: {
      dopamine: state4.wakeModulation.dopamineBoost,
      serotonin: state4.wakeModulation.serotoninBoost,
      acetylcholine: state4.wakeModulation.acetylcholineBoost,
      norepinephrine: state4.wakeModulation.norepinephrineBoost
    },
    sleepSettings: { ...state4.sleepSettings }
  };
}

// src/modules/social-drive.ts
var storageDir16 = "";
var config;
var circadianEnabled = false;
var logger4;
var deps;
var satiation = 0.5;
var lastSocialInteractionTime = 0;
var lastDecayEvaluationTime = 0;
var totalSocialRewards = 0;
var totalNeedSignals = 0;
var currentNeedLevel = "none";
var socialInteractionHistory = [];
var unsubscribers = [];
var lastDesireUpdateTime = 0;
var lastDMNBiasTime = 0;
var lastNeedEmitTime = 0;
var adaptiveDecayModifier = 1;
function initSocialDrive(workspaceDir, cfg, log, injectedDeps) {
  storageDir16 = join17(workspaceDir, ".brainagent", "social-drive");
  if (!existsSync17(storageDir16)) {
    mkdirSync17(storageDir16, { recursive: true });
  }
  config = cfg.socialDrive;
  circadianEnabled = cfg.circadian?.enabled ?? false;
  logger4 = log;
  deps = injectedDeps;
  satiation = config.initialSatiation;
  lastDecayEvaluationTime = Date.now();
  currentNeedLevel = "none";
  socialInteractionHistory = [];
  unsubscribers.length = 0;
  lastDesireUpdateTime = 0;
  lastDMNBiasTime = 0;
  lastNeedEmitTime = 0;
  adaptiveDecayModifier = 1;
  loadState12();
  wireEventListeners();
  logger4.info(
    `BrainAgent SocialDrive: initialized (satiation=${satiation.toFixed(2)}, decay=${config.baseDecayRate}/${config.decayIntervalMs}ms, domains=${config.socialDomains.join(",")})`
  );
}
function stopSocialDrive() {
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers.length = 0;
  persistState10();
  logger4?.info("BrainAgent SocialDrive: stopped.");
}
function wireEventListeners() {
  const unsubReward = bus.on("dopamine:reward", (signal) => {
    onSocialReward(signal);
  });
  unsubscribers.push(unsubReward);
  const unsubActivity = bus.on("thalamus:classified", () => {
    evaluateDecay();
  });
  unsubscribers.push(unsubActivity);
  const unsubFired = bus.on("vital-impulse:fired", (data) => {
    evaluateDecay();
    const consecutive = data.consecutiveFires ?? 0;
    const baseBoost = 0.3;
    const escalation = Math.min(baseBoost * consecutive * 0.5, 0.5);
    const totalBoost = Math.min(baseBoost + escalation, 0.8);
    satiation = Math.min(1, satiation + totalBoost);
    persistState10();
  });
  unsubscribers.push(unsubFired);
  const unsubAmygdala = bus.on("amygdala:assessed", (data) => {
    if (!config) return;
    if (data.empathyNeeded && data.emotionIntensity > 0.6) {
      const drain = data.emotionIntensity * 0.04;
      satiation = Math.max(0, satiation - drain);
      currentNeedLevel = computeNeedLevel();
    }
  });
  unsubscribers.push(unsubAmygdala);
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
  const effectiveRate = config.baseDecayRate * adaptiveDecayModifier * circadianMod / serotoninMod;
  const decayFactor = Math.pow(1 - effectiveRate, elapsed);
  satiation *= decayFactor;
  if (satiation < 1e-3) {
    satiation = 0;
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
  if (satiation < config.needThresholds.urgent) return "urgent";
  if (satiation < config.needThresholds.strong) return "strong";
  if (satiation < config.needThresholds.moderate) return "moderate";
  if (satiation < config.needThresholds.mild) return "mild";
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
  const need = 1 - satiation;
  totalNeedSignals++;
  if (currentNeedLevel !== "none") {
    bus.emitSync("social-drive:need-rising", {
      needLevel: currentNeedLevel,
      satiation,
      need
    });
    logger4?.info(
      `BrainAgent SocialDrive: need rising \u2192 ${currentNeedLevel} (satiation=${satiation.toFixed(2)})`
    );
  }
  if (needLevelRank(currentNeedLevel) >= needLevelRank("moderate") && now - lastDesireUpdateTime > config.desireUpdateIntervalMs) {
    lastDesireUpdateTime = now;
    updateConnectionDesire();
  }
  if (needLevelRank(currentNeedLevel) >= needLevelRank("strong") && now - lastDMNBiasTime > config.dmnBiasIntervalMs) {
    lastDMNBiasTime = now;
    biasDMNToSocialThoughts();
  }
  if (currentNeedLevel === "urgent") {
    bus.emitSync("social-drive:urge", {
      satiation,
      timeSinceLastSocial: lastSocialInteractionTime > 0 ? now - lastSocialInteractionTime : now
    });
    logger4?.info("BrainAgent SocialDrive: URGENT social urge emitted!");
  }
  persistState10();
}
function updateConnectionDesire() {
  if (!deps) return;
  const strengthMap = {
    none: 0,
    mild: 0.2,
    moderate: 0.4,
    strong: 0.7,
    urgent: 0.9
  };
  const targetStrength = strengthMap[currentNeedLevel];
  const existing = deps.getDesires().find((d) => d.type === "connection" && d.source === "social-drive");
  if (existing) {
    if (existing.strength < targetStrength) {
      existing.strength = targetStrength;
    }
  } else {
    deps.addDesire(
      "connection",
      "Feeling the urge to connect with someone or check in on social circles",
      targetStrength,
      "social-drive"
    );
  }
  logger4?.info(
    `BrainAgent SocialDrive: connection desire updated (strength=${targetStrength.toFixed(2)})`
  );
}
function biasDMNToSocialThoughts() {
  if (!deps) return;
  const socialFacts = deps.getFactsByCategory("relationship", 3);
  const topics = [];
  if (socialFacts.length > 0) {
    for (const fact of socialFacts) {
      topics.push({ topic: fact.content.slice(0, 100) });
    }
  } else {
    topics.push({ topic: "social connections and interactions with others" });
  }
  deps.generateSocialThought(topics);
  logger4?.info(`BrainAgent SocialDrive: biased DMN toward ${topics.length} social topic(s)`);
}
function onSocialReward(signal) {
  if (!config) return;
  evaluateDecay();
  const domain = signal.context.domain.toLowerCase();
  if (!config.socialDomains.includes(domain)) return;
  if (signal.reward > 0) {
    const boost = Math.min(
      config.maxSatiationBoost,
      Math.max(0, signal.reward * config.socialRewardMultiplier)
    );
    satiation = Math.min(1, satiation + boost);
    adaptiveDecayModifier = Math.min(2, adaptiveDecayModifier + 5e-3 * signal.reward);
    recordSocialInteraction(signal.reward, domain);
    if (deps) {
      const existing = deps.getDesires().find((d) => d.type === "connection" && d.source === "social-drive");
      if (existing) {
        existing.strength *= 0.5;
      }
    }
    bus.emitSync("social-drive:satiated", {
      satiation,
      boostAmount: boost,
      source: domain
    });
    logger4?.info(
      `BrainAgent SocialDrive: satiated by ${domain} reward (boost=${boost.toFixed(2)}, satiation=${satiation.toFixed(2)})`
    );
  } else if (signal.reward < 0) {
    const penalty = Math.abs(signal.reward) * 0.1;
    satiation = Math.max(0, satiation - penalty);
    adaptiveDecayModifier = Math.max(0.5, adaptiveDecayModifier - 3e-3 * Math.abs(signal.reward));
    logger4?.info(
      `BrainAgent SocialDrive: negative social experience (penalty=${penalty.toFixed(2)}, satiation=${satiation.toFixed(2)})`
    );
  }
  currentNeedLevel = computeNeedLevel();
  persistState10();
}
function recordSocialInteraction(reward, context) {
  if (!config) return;
  totalSocialRewards++;
  lastSocialInteractionTime = Date.now();
  socialInteractionHistory.push({
    timestamp: Date.now(),
    reward,
    context
  });
  if (socialInteractionHistory.length > config.maxHistoryEntries) {
    socialInteractionHistory.shift();
  }
}
function getSocialDriveStats() {
  evaluateDecay();
  const now = Date.now();
  return {
    satiation,
    needLevel: currentNeedLevel,
    need: 1 - satiation,
    lastSocialInteractionTime,
    timeSinceLastSocial: lastSocialInteractionTime > 0 ? now - lastSocialInteractionTime : -1,
    totalSocialRewards,
    totalNeedSignals,
    recentInteractionCount: socialInteractionHistory.length
  };
}
function getSatiation() {
  return satiation;
}
function loadState12() {
  try {
    const filePath = join17(storageDir16, "state.json");
    if (existsSync17(filePath)) {
      const raw = JSON.parse(readFileSync17(filePath, "utf-8"));
      satiation = raw.satiation ?? config?.initialSatiation ?? 0.5;
      lastSocialInteractionTime = raw.lastSocialInteractionTime ?? 0;
      lastDecayEvaluationTime = raw.lastDecayEvaluationTime ?? Date.now();
      adaptiveDecayModifier = raw.adaptiveDecayModifier ?? 1;
      totalSocialRewards = raw.totalSocialRewards ?? 0;
      totalNeedSignals = raw.totalNeedSignals ?? 0;
      socialInteractionHistory = raw.socialInteractionHistory ?? [];
      currentNeedLevel = computeNeedLevel();
    }
  } catch {
  }
}
function persistState10() {
  try {
    const filePath = join17(storageDir16, "state.json");
    const state7 = {
      satiation,
      lastSocialInteractionTime,
      lastDecayEvaluationTime,
      adaptiveDecayModifier,
      totalSocialRewards,
      totalNeedSignals,
      socialInteractionHistory
    };
    writeFileSync17(filePath, JSON.stringify(state7, null, 2));
  } catch {
  }
}

// src/modules/cognitive-hunger.ts
import { existsSync as existsSync18, mkdirSync as mkdirSync18, readFileSync as readFileSync18, writeFileSync as writeFileSync18 } from "node:fs";
import { join as join18 } from "node:path";
var storageDir17 = "";
var config2;
var circadianEnabled2 = false;
var logger5;
var deps2;
var satiation2 = 0.6;
var lastLearningInteractionTime = 0;
var lastDecayEvaluationTime2 = 0;
var totalLearningRewards = 0;
var totalNeedSignals2 = 0;
var currentNeedLevel2 = "none";
var learningInteractionHistory = [];
var unsubscribers2 = [];
var lastDesireUpdateTime2 = 0;
var lastDMNBiasTime2 = 0;
var lastNeedEmitTime2 = 0;
var adaptiveDecayModifier2 = 1;
function initCognitiveHunger(workspaceDir, cfg, log, injectedDeps) {
  storageDir17 = join18(workspaceDir, ".brainagent", "cognitive-hunger");
  if (!existsSync18(storageDir17)) {
    mkdirSync18(storageDir17, { recursive: true });
  }
  config2 = cfg.cognitiveHunger;
  circadianEnabled2 = cfg.circadian?.enabled ?? false;
  logger5 = log;
  deps2 = injectedDeps;
  satiation2 = config2.initialSatiation;
  lastDecayEvaluationTime2 = Date.now();
  currentNeedLevel2 = "none";
  learningInteractionHistory = [];
  unsubscribers2.length = 0;
  lastDesireUpdateTime2 = 0;
  lastDMNBiasTime2 = 0;
  lastNeedEmitTime2 = 0;
  adaptiveDecayModifier2 = 1;
  loadState13();
  wireEventListeners2();
  logger5.info(
    `BrainAgent CognitiveHunger: initialized (satiation=${satiation2.toFixed(2)}, decay=${config2.baseDecayRate}/${config2.decayIntervalMs}ms, domains=${config2.learningDomains.join(",")})`
  );
}
function stopCognitiveHunger() {
  for (const unsub of unsubscribers2) {
    unsub();
  }
  unsubscribers2.length = 0;
  persistState11();
  logger5?.info("BrainAgent CognitiveHunger: stopped.");
}
function wireEventListeners2() {
  const unsubReward = bus.on("dopamine:reward", (signal) => {
    onLearningReward(signal);
  });
  unsubscribers2.push(unsubReward);
  const unsubActivity = bus.on("thalamus:classified", () => {
    evaluateDecay2();
  });
  unsubscribers2.push(unsubActivity);
  const unsubInsight = bus.on("learning:insight-discovered", () => {
    if (!config2) return;
    evaluateDecay2();
    const boost = 0.08;
    satiation2 = Math.min(1, satiation2 + boost);
    currentNeedLevel2 = computeNeedLevel2();
    persistState11();
  });
  unsubscribers2.push(unsubInsight);
  const unsubPerf = bus.on("learning:domain-performance-updated", (data) => {
    if (!config2) return;
    evaluateDecay2();
    if (data.trend === "improving") {
      const boost = 0.05;
      satiation2 = Math.min(1, satiation2 + boost);
      currentNeedLevel2 = computeNeedLevel2();
      persistState11();
    }
  });
  unsubscribers2.push(unsubPerf);
  const unsubGap = bus.on("curiosity:gap-detected", () => {
    if (!config2) return;
    evaluateDecay2();
    satiation2 = Math.max(0, satiation2 - 0.03);
    currentNeedLevel2 = computeNeedLevel2();
    persistState11();
  });
  unsubscribers2.push(unsubGap);
  const unsubStored = bus.on("hippocampus:stored", () => {
    if (!config2) return;
    const boost = 0.02;
    satiation2 = Math.min(1, satiation2 + boost);
    persistState11();
  });
  unsubscribers2.push(unsubStored);
  const unsubFired = bus.on("vital-impulse:fired", (data) => {
    evaluateDecay2();
    const consecutive = data.consecutiveFires ?? 0;
    const baseBoost = 0.25;
    const escalation = Math.min(baseBoost * consecutive * 0.5, 0.5);
    const totalBoost = Math.min(baseBoost + escalation, 0.8);
    satiation2 = Math.min(1, satiation2 + totalBoost);
    persistState11();
  });
  unsubscribers2.push(unsubFired);
  const unsubCerebellum = bus.on("cerebellum:validated", (data) => {
    if (!config2) return;
    if (!data.passed) {
      satiation2 = Math.max(0, satiation2 - 0.03);
      currentNeedLevel2 = computeNeedLevel2();
    }
  });
  unsubscribers2.push(unsubCerebellum);
}
function evaluateDecay2() {
  if (!config2) return;
  const now = Date.now();
  const elapsed = (now - lastDecayEvaluationTime2) / config2.decayIntervalMs;
  lastDecayEvaluationTime2 = now;
  if (elapsed <= 0) return;
  const circadianMod = circadianEnabled2 && isInSleepPhase() ? config2.sleepDecayModifier : 1;
  const neuroState = getNeuromodulatorState();
  const serotoninMod = 0.7 + neuroState.serotonin * 0.6;
  const effectiveRate = config2.baseDecayRate * adaptiveDecayModifier2 * circadianMod / serotoninMod;
  const decayFactor = Math.pow(1 - effectiveRate, elapsed);
  satiation2 *= decayFactor;
  if (satiation2 < 1e-3) {
    satiation2 = 0;
  }
  const oldLevel = currentNeedLevel2;
  currentNeedLevel2 = computeNeedLevel2();
  if (needLevelRank2(currentNeedLevel2) > needLevelRank2(oldLevel)) {
    lastNeedEmitTime2 = now;
    emitNeedSignals2();
  }
}
function computeNeedLevel2() {
  if (!config2) return "none";
  if (satiation2 < config2.needThresholds.urgent) return "urgent";
  if (satiation2 < config2.needThresholds.strong) return "strong";
  if (satiation2 < config2.needThresholds.moderate) return "moderate";
  if (satiation2 < config2.needThresholds.mild) return "mild";
  return "none";
}
function needLevelRank2(level) {
  const ranks = {
    none: 0,
    mild: 1,
    moderate: 2,
    strong: 3,
    urgent: 4
  };
  return ranks[level];
}
function emitNeedSignals2() {
  if (!config2 || !deps2) return;
  const now = Date.now();
  const need = 1 - satiation2;
  totalNeedSignals2++;
  if (currentNeedLevel2 !== "none") {
    bus.emitSync("cognitive-hunger:need-rising", {
      needLevel: currentNeedLevel2,
      satiation: satiation2,
      need
    });
    logger5?.info(
      `BrainAgent CognitiveHunger: need rising \u2192 ${currentNeedLevel2} (satiation=${satiation2.toFixed(2)})`
    );
  }
  if (needLevelRank2(currentNeedLevel2) >= needLevelRank2("moderate") && now - lastDesireUpdateTime2 > config2.desireUpdateIntervalMs) {
    lastDesireUpdateTime2 = now;
    updateUnderstandingDesire();
  }
  if (needLevelRank2(currentNeedLevel2) >= needLevelRank2("strong") && now - lastDMNBiasTime2 > config2.dmnBiasIntervalMs) {
    lastDMNBiasTime2 = now;
    biasDMNToLearningThoughts();
  }
  if (currentNeedLevel2 === "urgent") {
    bus.emitSync("cognitive-hunger:urge", {
      satiation: satiation2,
      timeSinceLastLearning: lastLearningInteractionTime > 0 ? now - lastLearningInteractionTime : now
    });
    logger5?.info("BrainAgent CognitiveHunger: URGENT cognitive urge emitted!");
  }
  persistState11();
}
function updateUnderstandingDesire() {
  if (!deps2) return;
  const strengthMap = {
    none: 0,
    mild: 0.2,
    moderate: 0.4,
    strong: 0.7,
    urgent: 0.9
  };
  const targetStrength = strengthMap[currentNeedLevel2];
  const existing = deps2.getDesires().find((d) => d.type === "understanding" && d.source === "cognitive-hunger");
  if (existing) {
    if (existing.strength < targetStrength) {
      existing.strength = targetStrength;
    }
  } else {
    deps2.addDesire(
      "understanding",
      "Feeling the urge to learn something new or explore a knowledge gap",
      targetStrength,
      "cognitive-hunger"
    );
  }
  logger5?.info(
    `BrainAgent CognitiveHunger: understanding desire updated (strength=${targetStrength.toFixed(2)})`
  );
}
function biasDMNToLearningThoughts() {
  if (!deps2) return;
  const knowledgeFacts = deps2.getFactsByCategory("fact", 3);
  const topics = [];
  if (knowledgeFacts.length > 0) {
    for (const fact of knowledgeFacts) {
      topics.push({ topic: fact.content.slice(0, 100) });
    }
  } else {
    topics.push({ topic: "knowledge gaps and interesting topics to explore" });
  }
  deps2.generateLearningThought(topics);
  logger5?.info(`BrainAgent CognitiveHunger: biased DMN toward ${topics.length} learning topic(s)`);
}
function onLearningReward(signal) {
  if (!config2) return;
  evaluateDecay2();
  const domain = signal.context.domain.toLowerCase();
  if (!config2.learningDomains.includes(domain)) return;
  if (signal.reward > 0) {
    const boost = Math.min(
      config2.maxSatiationBoost,
      Math.max(0, signal.reward * config2.learningRewardMultiplier)
    );
    satiation2 = Math.min(1, satiation2 + boost);
    adaptiveDecayModifier2 = Math.min(2, adaptiveDecayModifier2 + 5e-3 * signal.reward);
    recordLearningInteraction(signal.reward, domain);
    if (deps2) {
      const existing = deps2.getDesires().find((d) => d.type === "understanding" && d.source === "cognitive-hunger");
      if (existing) {
        existing.strength *= 0.5;
      }
    }
    bus.emitSync("cognitive-hunger:satiated", {
      satiation: satiation2,
      boostAmount: boost,
      source: domain
    });
    logger5?.info(
      `BrainAgent CognitiveHunger: satiated by ${domain} reward (boost=${boost.toFixed(2)}, satiation=${satiation2.toFixed(2)})`
    );
  } else if (signal.reward < 0) {
    const penalty = Math.abs(signal.reward) * 0.1;
    satiation2 = Math.max(0, satiation2 - penalty);
    adaptiveDecayModifier2 = Math.max(0.5, adaptiveDecayModifier2 - 3e-3 * Math.abs(signal.reward));
    logger5?.info(
      `BrainAgent CognitiveHunger: negative learning experience (penalty=${penalty.toFixed(2)}, satiation=${satiation2.toFixed(2)})`
    );
  }
  currentNeedLevel2 = computeNeedLevel2();
  persistState11();
}
function recordLearningInteraction(reward, context) {
  if (!config2) return;
  totalLearningRewards++;
  lastLearningInteractionTime = Date.now();
  learningInteractionHistory.push({
    timestamp: Date.now(),
    reward,
    context
  });
  if (learningInteractionHistory.length > config2.maxHistoryEntries) {
    learningInteractionHistory.shift();
  }
}
function getCognitiveHungerStats() {
  evaluateDecay2();
  const now = Date.now();
  return {
    satiation: satiation2,
    needLevel: currentNeedLevel2,
    need: 1 - satiation2,
    lastLearningInteractionTime,
    timeSinceLastLearning: lastLearningInteractionTime > 0 ? now - lastLearningInteractionTime : -1,
    totalLearningRewards,
    totalNeedSignals: totalNeedSignals2,
    recentInteractionCount: learningInteractionHistory.length
  };
}
function getCognitiveHungerSatiation() {
  return satiation2;
}
function loadState13() {
  try {
    const filePath = join18(storageDir17, "state.json");
    if (existsSync18(filePath)) {
      const raw = JSON.parse(readFileSync18(filePath, "utf-8"));
      satiation2 = raw.satiation ?? config2?.initialSatiation ?? 0.6;
      lastLearningInteractionTime = raw.lastLearningInteractionTime ?? 0;
      lastDecayEvaluationTime2 = raw.lastDecayEvaluationTime ?? Date.now();
      adaptiveDecayModifier2 = raw.adaptiveDecayModifier ?? 1;
      totalLearningRewards = raw.totalLearningRewards ?? 0;
      totalNeedSignals2 = raw.totalNeedSignals ?? 0;
      learningInteractionHistory = raw.learningInteractionHistory ?? [];
      currentNeedLevel2 = computeNeedLevel2();
    }
  } catch {
  }
}
function persistState11() {
  try {
    const filePath = join18(storageDir17, "state.json");
    const state7 = {
      satiation: satiation2,
      lastLearningInteractionTime,
      lastDecayEvaluationTime: lastDecayEvaluationTime2,
      adaptiveDecayModifier: adaptiveDecayModifier2,
      totalLearningRewards,
      totalNeedSignals: totalNeedSignals2,
      learningInteractionHistory
    };
    writeFileSync18(filePath, JSON.stringify(state7, null, 2));
  } catch {
  }
}

// src/modules/creative-drive.ts
import { existsSync as existsSync19, mkdirSync as mkdirSync19, readFileSync as readFileSync19, writeFileSync as writeFileSync19 } from "node:fs";
import { join as join19 } from "node:path";
var storageDir18 = "";
var config3;
var circadianEnabled3 = false;
var logger6;
var deps3;
var satiation3 = 0.5;
var lastCreativeInteractionTime = 0;
var lastDecayEvaluationTime3 = 0;
var totalCreativeRewards = 0;
var totalNeedSignals3 = 0;
var currentNeedLevel3 = "none";
var creativeInteractionHistory = [];
var unsubscribers3 = [];
var lastDesireUpdateTime3 = 0;
var lastDMNBiasTime3 = 0;
var lastNeedEmitTime3 = 0;
var adaptiveDecayModifier3 = 1;
function initCreativeDrive(workspaceDir, cfg, log, injectedDeps) {
  storageDir18 = join19(workspaceDir, ".brainagent", "creative-drive");
  if (!existsSync19(storageDir18)) {
    mkdirSync19(storageDir18, { recursive: true });
  }
  config3 = cfg.creativeDrive;
  circadianEnabled3 = cfg.circadian?.enabled ?? false;
  logger6 = log;
  deps3 = injectedDeps;
  satiation3 = config3.initialSatiation;
  lastDecayEvaluationTime3 = Date.now();
  currentNeedLevel3 = "none";
  creativeInteractionHistory = [];
  unsubscribers3.length = 0;
  lastDesireUpdateTime3 = 0;
  lastDMNBiasTime3 = 0;
  lastNeedEmitTime3 = 0;
  adaptiveDecayModifier3 = 1;
  loadState14();
  wireEventListeners3();
  logger6.info(
    `BrainAgent CreativeDrive: initialized (satiation=${satiation3.toFixed(2)}, decay=${config3.baseDecayRate}/${config3.decayIntervalMs}ms, domains=${config3.creativeDomains.join(",")})`
  );
}
function stopCreativeDrive() {
  for (const unsub of unsubscribers3) {
    unsub();
  }
  unsubscribers3.length = 0;
  persistState12();
  logger6?.info("BrainAgent CreativeDrive: stopped.");
}
function wireEventListeners3() {
  const unsubReward = bus.on("dopamine:reward", (signal) => {
    onCreativeReward(signal);
  });
  unsubscribers3.push(unsubReward);
  const unsubActivity = bus.on("thalamus:classified", () => {
    evaluateDecay3();
  });
  unsubscribers3.push(unsubActivity);
  const unsubInsight = bus.on("dmn:insight-generated", () => {
    if (!config3) return;
    evaluateDecay3();
    const boost = 0.1;
    satiation3 = Math.min(1, satiation3 + boost);
    currentNeedLevel3 = computeNeedLevel3();
    persistState12();
  });
  unsubscribers3.push(unsubInsight);
  const unsubThought = bus.on("dmn:thought-generated", () => {
    if (!config3) return;
    const boost = 0.05;
    satiation3 = Math.min(1, satiation3 + boost);
    persistState12();
  });
  unsubscribers3.push(unsubThought);
  const unsubQualia = bus.on("qualia:experience-generated", () => {
    if (!config3) return;
    evaluateDecay3();
    const boost = 0.07;
    satiation3 = Math.min(1, satiation3 + boost);
    currentNeedLevel3 = computeNeedLevel3();
    persistState12();
  });
  unsubscribers3.push(unsubQualia);
  const unsubFired = bus.on("vital-impulse:fired", (data) => {
    evaluateDecay3();
    const consecutive = data.consecutiveFires ?? 0;
    const baseBoost = 0.25;
    const escalation = Math.min(baseBoost * consecutive * 0.5, 0.5);
    const totalBoost = Math.min(baseBoost + escalation, 0.8);
    satiation3 = Math.min(1, satiation3 + totalBoost);
    persistState12();
  });
  unsubscribers3.push(unsubFired);
  const unsubCuriosity = bus.on("curiosity:question-generated", () => {
    if (!config3) return;
    satiation3 = Math.max(0, satiation3 - 0.02);
    currentNeedLevel3 = computeNeedLevel3();
  });
  unsubscribers3.push(unsubCuriosity);
}
function evaluateDecay3() {
  if (!config3) return;
  const now = Date.now();
  const elapsed = (now - lastDecayEvaluationTime3) / config3.decayIntervalMs;
  lastDecayEvaluationTime3 = now;
  if (elapsed <= 0) return;
  const circadianMod = circadianEnabled3 && isInSleepPhase() ? config3.sleepDecayModifier : 1;
  const neuroState = getNeuromodulatorState();
  const serotoninMod = 0.7 + neuroState.serotonin * 0.6;
  const effectiveRate = config3.baseDecayRate * adaptiveDecayModifier3 * circadianMod / serotoninMod;
  const decayFactor = Math.pow(1 - effectiveRate, elapsed);
  satiation3 *= decayFactor;
  if (satiation3 < 1e-3) {
    satiation3 = 0;
  }
  const oldLevel = currentNeedLevel3;
  currentNeedLevel3 = computeNeedLevel3();
  if (needLevelRank3(currentNeedLevel3) > needLevelRank3(oldLevel)) {
    lastNeedEmitTime3 = now;
    emitNeedSignals3();
  }
}
function computeNeedLevel3() {
  if (!config3) return "none";
  if (satiation3 < config3.needThresholds.urgent) return "urgent";
  if (satiation3 < config3.needThresholds.strong) return "strong";
  if (satiation3 < config3.needThresholds.moderate) return "moderate";
  if (satiation3 < config3.needThresholds.mild) return "mild";
  return "none";
}
function needLevelRank3(level) {
  const ranks = {
    none: 0,
    mild: 1,
    moderate: 2,
    strong: 3,
    urgent: 4
  };
  return ranks[level];
}
function emitNeedSignals3() {
  if (!config3 || !deps3) return;
  const now = Date.now();
  const need = 1 - satiation3;
  totalNeedSignals3++;
  if (currentNeedLevel3 !== "none") {
    bus.emitSync("creative-drive:need-rising", {
      needLevel: currentNeedLevel3,
      satiation: satiation3,
      need
    });
    logger6?.info(
      `BrainAgent CreativeDrive: need rising \u2192 ${currentNeedLevel3} (satiation=${satiation3.toFixed(2)})`
    );
  }
  if (needLevelRank3(currentNeedLevel3) >= needLevelRank3("moderate") && now - lastDesireUpdateTime3 > config3.desireUpdateIntervalMs) {
    lastDesireUpdateTime3 = now;
    updateExplorationDesire();
  }
  if (needLevelRank3(currentNeedLevel3) >= needLevelRank3("strong") && now - lastDMNBiasTime3 > config3.dmnBiasIntervalMs) {
    lastDMNBiasTime3 = now;
    biasDMNToCreativeThoughts();
  }
  if (currentNeedLevel3 === "urgent") {
    bus.emitSync("creative-drive:urge", {
      satiation: satiation3,
      timeSinceLastCreation: lastCreativeInteractionTime > 0 ? now - lastCreativeInteractionTime : now
    });
    logger6?.info("BrainAgent CreativeDrive: URGENT creative urge emitted!");
  }
  persistState12();
}
function updateExplorationDesire() {
  if (!deps3) return;
  const strengthMap = {
    none: 0,
    mild: 0.2,
    moderate: 0.4,
    strong: 0.7,
    urgent: 0.9
  };
  const targetStrength = strengthMap[currentNeedLevel3];
  const existing = deps3.getDesires().find((d) => d.type === "exploration" && d.source === "creative-drive");
  if (existing) {
    if (existing.strength < targetStrength) {
      existing.strength = targetStrength;
    }
  } else {
    deps3.addDesire(
      "exploration",
      "Feeling the urge to create something, explore novel ideas or express imagination",
      targetStrength,
      "creative-drive"
    );
  }
  logger6?.info(
    `BrainAgent CreativeDrive: exploration desire updated (strength=${targetStrength.toFixed(2)})`
  );
}
function biasDMNToCreativeThoughts() {
  if (!deps3) return;
  const creativeFacts = deps3.getFactsByCategory("creative", 3);
  const topics = [];
  if (creativeFacts.length > 0) {
    for (const fact of creativeFacts) {
      topics.push({ topic: fact.content.slice(0, 100) });
    }
  } else {
    topics.push({ topic: "creative expression, imagination and novel ideas" });
  }
  deps3.generateCreativeThought(topics);
  logger6?.info(`BrainAgent CreativeDrive: biased DMN toward ${topics.length} creative topic(s)`);
}
function onCreativeReward(signal) {
  if (!config3) return;
  evaluateDecay3();
  const domain = signal.context.domain.toLowerCase();
  if (!config3.creativeDomains.includes(domain)) return;
  if (signal.reward > 0) {
    const boost = Math.min(
      config3.maxSatiationBoost,
      Math.max(0, signal.reward * config3.creativeRewardMultiplier)
    );
    satiation3 = Math.min(1, satiation3 + boost);
    adaptiveDecayModifier3 = Math.min(2, adaptiveDecayModifier3 + 5e-3 * signal.reward);
    recordCreativeInteraction(signal.reward, domain);
    if (deps3) {
      const existing = deps3.getDesires().find((d) => d.type === "exploration" && d.source === "creative-drive");
      if (existing) {
        existing.strength *= 0.5;
      }
    }
    bus.emitSync("creative-drive:satiated", {
      satiation: satiation3,
      boostAmount: boost,
      source: domain
    });
    logger6?.info(
      `BrainAgent CreativeDrive: satiated by ${domain} reward (boost=${boost.toFixed(2)}, satiation=${satiation3.toFixed(2)})`
    );
  } else if (signal.reward < 0) {
    const penalty = Math.abs(signal.reward) * 0.1;
    satiation3 = Math.max(0, satiation3 - penalty);
    adaptiveDecayModifier3 = Math.max(0.5, adaptiveDecayModifier3 - 3e-3 * Math.abs(signal.reward));
    logger6?.info(
      `BrainAgent CreativeDrive: negative creative experience (penalty=${penalty.toFixed(2)}, satiation=${satiation3.toFixed(2)})`
    );
  }
  currentNeedLevel3 = computeNeedLevel3();
  persistState12();
}
function recordCreativeInteraction(reward, context) {
  if (!config3) return;
  totalCreativeRewards++;
  lastCreativeInteractionTime = Date.now();
  creativeInteractionHistory.push({
    timestamp: Date.now(),
    reward,
    context
  });
  if (creativeInteractionHistory.length > config3.maxHistoryEntries) {
    creativeInteractionHistory.shift();
  }
}
function getCreativeDriveStats() {
  evaluateDecay3();
  const now = Date.now();
  return {
    satiation: satiation3,
    needLevel: currentNeedLevel3,
    need: 1 - satiation3,
    lastCreativeInteractionTime,
    timeSinceLastCreation: lastCreativeInteractionTime > 0 ? now - lastCreativeInteractionTime : -1,
    totalCreativeRewards,
    totalNeedSignals: totalNeedSignals3,
    recentInteractionCount: creativeInteractionHistory.length
  };
}
function getCreativeDriveSatiation() {
  return satiation3;
}
function loadState14() {
  try {
    const filePath = join19(storageDir18, "state.json");
    if (existsSync19(filePath)) {
      const raw = JSON.parse(readFileSync19(filePath, "utf-8"));
      satiation3 = raw.satiation ?? config3?.initialSatiation ?? 0.5;
      lastCreativeInteractionTime = raw.lastCreativeInteractionTime ?? 0;
      lastDecayEvaluationTime3 = raw.lastDecayEvaluationTime ?? Date.now();
      adaptiveDecayModifier3 = raw.adaptiveDecayModifier ?? 1;
      totalCreativeRewards = raw.totalCreativeRewards ?? 0;
      totalNeedSignals3 = raw.totalNeedSignals ?? 0;
      creativeInteractionHistory = raw.creativeInteractionHistory ?? [];
      currentNeedLevel3 = computeNeedLevel3();
    }
  } catch {
  }
}
function persistState12() {
  try {
    const filePath = join19(storageDir18, "state.json");
    const state7 = {
      satiation: satiation3,
      lastCreativeInteractionTime,
      lastDecayEvaluationTime: lastDecayEvaluationTime3,
      adaptiveDecayModifier: adaptiveDecayModifier3,
      totalCreativeRewards,
      totalNeedSignals: totalNeedSignals3,
      creativeInteractionHistory
    };
    writeFileSync19(filePath, JSON.stringify(state7, null, 2));
  } catch {
  }
}

// src/modules/mastery-drive.ts
import { existsSync as existsSync20, mkdirSync as mkdirSync20, readFileSync as readFileSync20, writeFileSync as writeFileSync20 } from "node:fs";
import { join as join20 } from "node:path";
var storageDir19 = "";
var config4;
var circadianEnabled4 = false;
var logger7;
var deps4;
var domainSatiations = /* @__PURE__ */ new Map();
var lastDecayEvaluationTime4 = 0;
var totalImprovementRewards = 0;
var totalNeedSignals4 = 0;
var currentNeedLevel4 = "none";
var unsubscribers4 = [];
var lastDesireUpdateTime4 = 0;
var lastDMNBiasTime4 = 0;
var lastNeedEmitTime4 = 0;
var adaptiveDecayModifier4 = 1;
function initMasteryDrive(workspaceDir, cfg, log, injectedDeps) {
  storageDir19 = join20(workspaceDir, ".brainagent", "mastery-drive");
  if (!existsSync20(storageDir19)) {
    mkdirSync20(storageDir19, { recursive: true });
  }
  config4 = cfg.masteryDrive;
  circadianEnabled4 = cfg.circadian?.enabled ?? false;
  logger7 = log;
  deps4 = injectedDeps;
  domainSatiations = /* @__PURE__ */ new Map();
  lastDecayEvaluationTime4 = Date.now();
  currentNeedLevel4 = "none";
  unsubscribers4.length = 0;
  lastDesireUpdateTime4 = 0;
  lastDMNBiasTime4 = 0;
  lastNeedEmitTime4 = 0;
  totalImprovementRewards = 0;
  totalNeedSignals4 = 0;
  adaptiveDecayModifier4 = 1;
  loadState15();
  wireEventListeners4();
  logger7.info(
    `BrainAgent MasteryDrive: initialized (domains=${domainSatiations.size}, decay=${config4.baseDecayRate}/${config4.decayIntervalMs}ms, maxDomains=${config4.maxTrackedDomains})`
  );
}
function stopMasteryDrive() {
  for (const unsub of unsubscribers4) {
    unsub();
  }
  unsubscribers4.length = 0;
  persistState13();
  logger7?.info("BrainAgent MasteryDrive: stopped.");
}
function wireEventListeners4() {
  const unsubReward = bus.on("dopamine:reward", (signal) => {
    onMasteryReward(signal);
  });
  unsubscribers4.push(unsubReward);
  const unsubActivity = bus.on("thalamus:classified", () => {
    evaluateDecay4();
  });
  unsubscribers4.push(unsubActivity);
  const unsubPredError = bus.on("dopamine:prediction-error", (data) => {
    if (!config4) return;
    evaluateDecay4();
    const domain = data.context.toLowerCase();
    if (data.error > 0) {
      const boost = Math.min(config4.maxSatiationBoost, data.error * 0.15);
      boostDomain(domain, boost);
    } else if (data.error < 0) {
      const drain = Math.abs(data.error) * 0.08;
      drainDomain(domain, drain);
    }
  });
  unsubscribers4.push(unsubPredError);
  const unsubPerf = bus.on("learning:domain-performance-updated", (data) => {
    if (!config4) return;
    evaluateDecay4();
    if (data.trend === "improving") {
      boostDomain(data.domain.toLowerCase(), 0.1);
    }
  });
  unsubscribers4.push(unsubPerf);
  const unsubCapability = bus.on("identity:capability-updated", (data) => {
    if (!config4) return;
    evaluateDecay4();
    boostDomain(data.domain.toLowerCase(), 0.08);
  });
  unsubscribers4.push(unsubCapability);
  const unsubCerebellum = bus.on("cerebellum:validated", (data) => {
    if (!config4) return;
    evaluateDecay4();
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
  unsubscribers4.push(unsubCerebellum);
  const unsubFired = bus.on("vital-impulse:fired", (data) => {
    evaluateDecay4();
    const consecutive = data.consecutiveFires ?? 0;
    const baseBoost = 0.25;
    const escalation = Math.min(baseBoost * consecutive * 0.5, 0.5);
    const totalBoost = Math.min(baseBoost + escalation, 0.8);
    for (const [domain] of domainSatiations) {
      boostDomain(domain, totalBoost);
    }
  });
  unsubscribers4.push(unsubFired);
  const unsubAmygdala = bus.on("amygdala:assessed", (data) => {
    if (!config4) return;
    if (data.emotion === "frustration" && data.emotionIntensity > 0.5) {
      const weakest = findWeakestDomain();
      if (weakest) {
        const drain = data.emotionIntensity * 0.03;
        drainDomain(weakest.domain, drain);
      }
    }
  });
  unsubscribers4.push(unsubAmygdala);
}
function getOrCreateDomain(domain) {
  let entry = domainSatiations.get(domain);
  if (!entry) {
    entry = {
      satiation: config4?.initialSatiation ?? 0.5,
      lastActivityTime: Date.now(),
      totalRewards: 0
    };
    domainSatiations.set(domain, entry);
    pruneDomainsIfNeeded();
  }
  return entry;
}
function pruneDomainsIfNeeded() {
  if (!config4) return;
  while (domainSatiations.size > config4.maxTrackedDomains) {
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
  const boost = Math.min(config4?.maxSatiationBoost ?? 0.6, Math.max(0, amount));
  entry.satiation = Math.min(1, entry.satiation + boost);
  entry.lastActivityTime = Date.now();
  currentNeedLevel4 = computeNeedLevel4();
  persistState13();
}
function drainDomain(domain, amount) {
  const entry = getOrCreateDomain(domain);
  entry.satiation = Math.max(0, entry.satiation - amount);
  entry.lastActivityTime = Date.now();
  currentNeedLevel4 = computeNeedLevel4();
  persistState13();
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
  if (domainSatiations.size === 0) return config4?.initialSatiation ?? 0.5;
  let min = Infinity;
  for (const [, mastery] of domainSatiations) {
    if (mastery.satiation < min) {
      min = mastery.satiation;
    }
  }
  return min;
}
function evaluateDecay4() {
  if (!config4) return;
  const now = Date.now();
  const elapsed = (now - lastDecayEvaluationTime4) / config4.decayIntervalMs;
  lastDecayEvaluationTime4 = now;
  if (elapsed <= 0) return;
  const circadianMod = circadianEnabled4 && isInSleepPhase() ? config4.sleepDecayModifier : 1;
  const neuroState = getNeuromodulatorState();
  const serotoninMod = 0.7 + neuroState.serotonin * 0.6;
  for (const [, mastery] of domainSatiations) {
    let effectiveRate = config4.baseDecayRate * adaptiveDecayModifier4 * circadianMod / serotoninMod;
    const inactiveMs = now - mastery.lastActivityTime;
    if (inactiveMs > 10 * 60 * 1e3) {
      effectiveRate *= config4.inactiveDomainDecayMultiplier;
    }
    const decayFactor = Math.pow(1 - effectiveRate, elapsed);
    mastery.satiation *= decayFactor;
    if (mastery.satiation < 1e-3) {
      mastery.satiation = 0;
    }
  }
  const oldLevel = currentNeedLevel4;
  currentNeedLevel4 = computeNeedLevel4();
  if (needLevelRank4(currentNeedLevel4) > needLevelRank4(oldLevel)) {
    lastNeedEmitTime4 = now;
    emitNeedSignals4();
  }
}
function computeNeedLevel4() {
  if (!config4) return "none";
  const aggregate = getAggregateSatiation();
  if (aggregate < config4.needThresholds.urgent) return "urgent";
  if (aggregate < config4.needThresholds.strong) return "strong";
  if (aggregate < config4.needThresholds.moderate) return "moderate";
  if (aggregate < config4.needThresholds.mild) return "mild";
  return "none";
}
function needLevelRank4(level) {
  const ranks = {
    none: 0,
    mild: 1,
    moderate: 2,
    strong: 3,
    urgent: 4
  };
  return ranks[level];
}
function emitNeedSignals4() {
  if (!config4 || !deps4) return;
  const now = Date.now();
  const aggregate = getAggregateSatiation();
  const need = 1 - aggregate;
  const weakest = findWeakestDomain();
  totalNeedSignals4++;
  if (currentNeedLevel4 !== "none") {
    bus.emitSync("mastery-drive:need-rising", {
      needLevel: currentNeedLevel4,
      satiation: aggregate,
      need,
      domain: weakest?.domain
    });
    logger7?.info(
      `BrainAgent MasteryDrive: need rising \u2192 ${currentNeedLevel4} (aggregate=${aggregate.toFixed(2)}, weakest=${weakest?.domain ?? "none"})`
    );
  }
  if (needLevelRank4(currentNeedLevel4) >= needLevelRank4("moderate") && now - lastDesireUpdateTime4 > config4.desireUpdateIntervalMs) {
    lastDesireUpdateTime4 = now;
    updateMasteryDesire(weakest?.domain);
  }
  if (needLevelRank4(currentNeedLevel4) >= needLevelRank4("strong") && now - lastDMNBiasTime4 > config4.dmnBiasIntervalMs) {
    lastDMNBiasTime4 = now;
    biasDMNToMasteryThoughts(weakest?.domain);
  }
  if (currentNeedLevel4 === "urgent" && weakest) {
    bus.emitSync("mastery-drive:urge", {
      satiation: aggregate,
      weakestDomain: weakest.domain,
      domainSatiation: weakest.mastery.satiation
    });
    logger7?.info(
      `BrainAgent MasteryDrive: URGENT mastery urge emitted! (weakest=${weakest.domain}, satiation=${weakest.mastery.satiation.toFixed(2)})`
    );
  }
  persistState13();
}
function updateMasteryDesire(weakestDomain) {
  if (!deps4) return;
  const strengthMap = {
    none: 0,
    mild: 0.2,
    moderate: 0.4,
    strong: 0.7,
    urgent: 0.9
  };
  const targetStrength = strengthMap[currentNeedLevel4];
  const description = weakestDomain ? `Feeling the need to improve and practice \u2014 especially in ${weakestDomain} domain` : "Feeling the need to improve skills and grow as an agent";
  const existing = deps4.getDesires().find((d) => d.type === "mastery" && d.source === "mastery-drive");
  if (existing) {
    if (existing.strength < targetStrength) {
      existing.strength = targetStrength;
    }
    existing.description = description;
  } else {
    deps4.addDesire("mastery", description, targetStrength, "mastery-drive");
  }
  logger7?.info(
    `BrainAgent MasteryDrive: mastery desire updated (strength=${targetStrength.toFixed(2)}, weakest=${weakestDomain ?? "none"})`
  );
}
function biasDMNToMasteryThoughts(weakestDomain) {
  if (!deps4) return;
  const topics = [];
  if (weakestDomain) {
    const skillFacts = deps4.getFactsByCategory("skill", 2);
    if (skillFacts.length > 0) {
      for (const fact of skillFacts) {
        topics.push({ topic: fact.content.slice(0, 100) });
      }
    }
    topics.push({ topic: `areas of improvement and skill gaps in ${weakestDomain}` });
  } else {
    topics.push({ topic: "self-improvement, skill practice and mastery growth" });
  }
  deps4.generateMasteryThought(topics);
  logger7?.info(`BrainAgent MasteryDrive: biased DMN toward ${topics.length} mastery topic(s)`);
}
function onMasteryReward(signal) {
  if (!config4) return;
  evaluateDecay4();
  const domain = signal.context.domain.toLowerCase();
  if (signal.predictionError > 0) {
    const boost = Math.min(
      config4.maxSatiationBoost,
      Math.max(0, signal.predictionError * config4.improvementRewardMultiplier)
    );
    const entry = getOrCreateDomain(domain);
    entry.satiation = Math.min(1, entry.satiation + boost);
    entry.lastActivityTime = Date.now();
    entry.totalRewards++;
    totalImprovementRewards++;
    adaptiveDecayModifier4 = Math.min(2, adaptiveDecayModifier4 + 5e-3 * signal.predictionError);
    if (deps4) {
      const existing = deps4.getDesires().find((d) => d.type === "mastery" && d.source === "mastery-drive");
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
    logger7?.info(
      `BrainAgent MasteryDrive: satiated in ${domain} (boost=${boost.toFixed(2)}, satiation=${entry.satiation.toFixed(2)})`
    );
  } else if (signal.predictionError < 0 && signal.reward >= 0) {
    const drain = Math.abs(signal.predictionError) * 0.05;
    drainDomain(domain, drain);
    adaptiveDecayModifier4 = Math.max(
      0.5,
      adaptiveDecayModifier4 - 3e-3 * Math.abs(signal.predictionError)
    );
    logger7?.info(
      `BrainAgent MasteryDrive: below expectations in ${domain} (drain=${drain.toFixed(2)})`
    );
  }
  currentNeedLevel4 = computeNeedLevel4();
  persistState13();
}
function getMasteryDriveStats() {
  evaluateDecay4();
  const aggregate = getAggregateSatiation();
  const weakest = findWeakestDomain();
  const domainMap = {};
  for (const [domain, mastery] of domainSatiations) {
    domainMap[domain] = mastery.satiation;
  }
  return {
    satiation: aggregate,
    needLevel: currentNeedLevel4,
    need: 1 - aggregate,
    weakestDomain: weakest?.domain ?? "none",
    weakestDomainSatiation: weakest?.mastery.satiation ?? 0,
    activeDomainCount: domainSatiations.size,
    domainSatiations: domainMap,
    totalImprovementRewards,
    totalNeedSignals: totalNeedSignals4
  };
}
function getMasteryAggregateSatiation() {
  return getAggregateSatiation();
}
function loadState15() {
  try {
    const filePath = join20(storageDir19, "state.json");
    if (existsSync20(filePath)) {
      const raw = JSON.parse(readFileSync20(filePath, "utf-8"));
      totalImprovementRewards = raw.totalImprovementRewards ?? 0;
      totalNeedSignals4 = raw.totalNeedSignals ?? 0;
      adaptiveDecayModifier4 = raw.adaptiveDecayModifier ?? 1;
      lastDecayEvaluationTime4 = raw.lastDecayEvaluationTime ?? Date.now();
      if (raw.domainSatiations) {
        domainSatiations = /* @__PURE__ */ new Map();
        for (const [domain, mastery] of Object.entries(raw.domainSatiations)) {
          domainSatiations.set(domain, {
            satiation: mastery.satiation ?? config4?.initialSatiation ?? 0.5,
            lastActivityTime: mastery.lastActivityTime ?? 0,
            totalRewards: mastery.totalRewards ?? 0
          });
        }
      }
      currentNeedLevel4 = computeNeedLevel4();
    }
  } catch {
  }
}
function persistState13() {
  try {
    const filePath = join20(storageDir19, "state.json");
    const domainMap = {};
    for (const [domain, mastery] of domainSatiations) {
      domainMap[domain] = mastery;
    }
    const state7 = {
      domainSatiations: domainMap,
      lastDecayEvaluationTime: lastDecayEvaluationTime4,
      adaptiveDecayModifier: adaptiveDecayModifier4,
      totalImprovementRewards,
      totalNeedSignals: totalNeedSignals4
    };
    writeFileSync20(filePath, JSON.stringify(state7, null, 2));
  } catch {
  }
}

// src/modules/drive-arbiter.ts
import { existsSync as existsSync21, mkdirSync as mkdirSync21, readFileSync as readFileSync21, writeFileSync as writeFileSync21 } from "node:fs";
import { join as join21 } from "node:path";
var storageDir20 = "";
var config5;
var logger8;
var statGetters = {};
var unsubscribers5 = [];
var driveWeights = {
  social: 1,
  cognitive: 1,
  creative: 1,
  mastery: 1
};
var lastSelectedDrive = null;
var lastSelectionTime = 0;
var conflictLog = [];
var totalArbitrations = 0;
function initDriveArbiter(workspaceDir, cfg, getters, log) {
  config5 = cfg.driveArbiter;
  statGetters = getters;
  logger8 = log;
  driveWeights = { social: 1, cognitive: 1, creative: 1, mastery: 1 };
  lastSelectedDrive = null;
  lastSelectionTime = 0;
  conflictLog = [];
  totalArbitrations = 0;
  unsubscribers5.length = 0;
  storageDir20 = join21(workspaceDir, ".brainagent");
  if (!existsSync21(storageDir20)) {
    mkdirSync21(storageDir20, { recursive: true });
  }
  loadState16();
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
    unsubscribers5.push(unsub);
  }
  const unsubReward = bus.on("dopamine:reward", (signal) => {
    processReward(signal);
  });
  unsubscribers5.push(unsubReward);
  logger8?.info("BrainAgent DriveArbiter: initialized");
}
function stopDriveArbiter() {
  for (const unsub of unsubscribers5) {
    unsub();
  }
  unsubscribers5.length = 0;
  persistState14();
  logger8?.info("BrainAgent DriveArbiter: stopped.");
}
function arbitrate() {
  if (!config5) return;
  const cfg = config5;
  const social = statGetters.getSocialDriveStats?.();
  const cognitive = statGetters.getCognitiveHungerStats?.();
  const creative = statGetters.getCreativeDriveStats?.();
  const mastery = statGetters.getMasteryDriveStats?.();
  const drives = [];
  if (social && social.need >= cfg.minDriveNeed) {
    drives.push({ id: "social", need: social.need });
  }
  if (cognitive && cognitive.need >= cfg.minDriveNeed) {
    drives.push({ id: "cognitive", need: cognitive.need });
  }
  if (creative && creative.need >= cfg.minDriveNeed) {
    drives.push({ id: "creative", need: creative.need });
  }
  if (mastery && mastery.need >= cfg.minDriveNeed) {
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
      const decayFactor = Math.pow(cfg.recencyDecay, timeSinceLast / (5 * 60 * 1e3));
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
  if (scores.length > 1 && Math.random() < cfg.explorationRate) {
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
  if (conflictLog.length > (cfg.maxConflictLog ?? 50)) {
    conflictLog = conflictLog.slice(-cfg.maxConflictLog);
  }
  bus.emit("arbiter:conflict-resolved", {
    competing: scores.map((s) => s.driveId),
    winner: winner.driveId,
    method: explorationUsed ? "exploration" : "scored"
  });
  selectDrive(winner.driveId, winner.totalScore, explorationUsed);
  totalArbitrations++;
  persistState14();
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
  logger8?.info(
    `BrainAgent DriveArbiter: selected=${driveId} priority=${priority.toFixed(2)} exploration=${exploration}`
  );
}
function processReward(signal) {
  if (!config5 || !lastSelectedDrive) return;
  const timeSinceSelection = Date.now() - lastSelectionTime;
  if (timeSinceSelection > 5 * 60 * 1e3) return;
  const currentWeight = driveWeights[lastSelectedDrive];
  const lr = config5.rewardLearningRate;
  const newWeight = Math.max(0.3, Math.min(2, currentWeight + lr * signal.reward));
  driveWeights[lastSelectedDrive] = newWeight;
  logger8?.info(
    `BrainAgent DriveArbiter: reward learning drive=${lastSelectedDrive} oldWeight=${currentWeight.toFixed(3)} newWeight=${newWeight.toFixed(3)} reward=${signal.reward.toFixed(3)}`
  );
}
function loadState16() {
  try {
    const path = join21(storageDir20, "drive-arbiter.json");
    if (existsSync21(path)) {
      const data = JSON.parse(readFileSync21(path, "utf-8"));
      if (data.driveWeights) driveWeights = { ...driveWeights, ...data.driveWeights };
      lastSelectedDrive = data.lastSelectedDrive ?? null;
      lastSelectionTime = data.lastSelectionTime ?? 0;
      conflictLog = data.conflictLog ?? [];
      totalArbitrations = data.totalArbitrations ?? 0;
    }
  } catch {
  }
}
function persistState14() {
  if (!storageDir20) return;
  try {
    const data = {
      driveWeights,
      lastSelectedDrive,
      lastSelectionTime,
      conflictLog,
      totalArbitrations
    };
    writeFileSync21(join21(storageDir20, "drive-arbiter.json"), JSON.stringify(data, null, 2), "utf-8");
  } catch {
  }
}
function getDriveArbiterStats() {
  return {
    driveWeights: { ...driveWeights },
    lastSelectedDrive,
    totalArbitrations,
    recentConflicts: conflictLog.filter((e) => Date.now() - e.timestamp < 60 * 60 * 1e3).length
  };
}
function buildArbiterContext() {
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

// src/modules/vital-impulse.ts
import { existsSync as existsSync22, mkdirSync as mkdirSync22, readFileSync as readFileSync22, writeFileSync as writeFileSync22 } from "node:fs";
import { join as join22 } from "node:path";
var storageDir21 = "";
var config6;
var circadianEnabled5 = false;
var logger9;
var deps5;
var currentPressure = 0;
var lastFireTime = 0;
var totalFires = 0;
var totalSignalsReceived = 0;
var recentSignals = [];
var unsubscribers6 = [];
var consecutiveAutonomousFires = 0;
var habituationLevel = 0;
var currentMotivation = null;
var adaptiveSignalWeights = {};
var lastFireSignals = [];
var lastFireTimestamp = 0;
var gabaInhibitionLevel = 0;
var hebbianLearningRate = 0.1;
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
function initVitalImpulse(workspaceDir, cfg, log, injectedDeps) {
  storageDir21 = join22(workspaceDir, ".brainagent", "vital-impulse");
  if (!existsSync22(storageDir21)) {
    mkdirSync22(storageDir21, { recursive: true });
  }
  config6 = cfg.vitalImpulse;
  circadianEnabled5 = cfg.circadian?.enabled ?? false;
  logger9 = log;
  deps5 = injectedDeps;
  currentPressure = 0;
  recentSignals = [];
  habituationLevel = 0;
  consecutiveAutonomousFires = 0;
  gabaInhibitionLevel = 0;
  lastFireSignals = [];
  lastFireTimestamp = 0;
  lastDecayTime = 0;
  unsubscribers6.length = 0;
  adaptiveSignalWeights = { ...DEFAULT_SIGNAL_WEIGHTS, ...config6.signalWeights };
  hebbianLearningRate = cfg.synapticPlasticity?.learningRate ?? 0.1;
  loadState17();
  wireSignalListeners();
  logger9.info(
    `BrainAgent VitalImpulse: initialized (threshold=${config6.firingThreshold}, refractory=${config6.refractoryPeriodMs}ms, decay=${config6.decayRate}/${config6.decayIntervalMs}ms)`
  );
}
function stopVitalImpulse() {
  for (const unsub of unsubscribers6) {
    unsub();
  }
  unsubscribers6.length = 0;
  persistState15();
  logger9?.info("BrainAgent VitalImpulse: stopped.");
}
function wireSignalListeners() {
  const wire = (event, descriptionFn) => {
    const unsub = bus.on(event, (data) => {
      const weight = adaptiveSignalWeights[event] ?? DEFAULT_SIGNAL_WEIGHTS[event] ?? 0.1;
      onSignal(event, weight, descriptionFn(data));
    });
    unsubscribers6.push(unsub);
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
  unsubscribers6.push(unsubReward);
}
var lastDecayTime = 0;
function applyDecay() {
  if (!config6) return;
  const now = Date.now();
  const referenceTime = lastDecayTime || (recentSignals.length > 0 ? recentSignals[recentSignals.length - 1].timestamp : 0);
  if (currentPressure > 0 && referenceTime > 0) {
    const elapsedIntervals = (now - referenceTime) / config6.decayIntervalMs;
    if (elapsedIntervals > 0) {
      const decayFactor = Math.pow(1 - config6.decayRate, elapsedIntervals);
      currentPressure *= decayFactor;
      if (currentPressure < 0.01) currentPressure = 0;
    }
  }
  if (habituationLevel > 0 && lastFireTime > 0) {
    const minutesSinceFire = (now - lastFireTime) / 6e4;
    const halfLife = config6.habituationHalfLifeMinutes ?? 5;
    const habDecay = Math.pow(0.5, minutesSinceFire / halfLife);
    habituationLevel *= habDecay;
    if (habituationLevel < 0.01) habituationLevel = 0;
  }
  if (gabaInhibitionLevel > 0 && lastFireTime > 0) {
    const minutesSinceFire = (now - lastFireTime) / 6e4;
    const halfLife = config6.habituationHalfLifeMinutes ?? 5;
    const gabaDecay = Math.pow(0.5, minutesSinceFire / halfLife);
    gabaInhibitionLevel *= gabaDecay;
    if (gabaInhibitionLevel < 0.01) gabaInhibitionLevel = 0;
  }
  lastDecayTime = now;
}
function onSignal(eventName, weight, description) {
  if (!config6) return;
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
  if (recentSignals.length > config6.maxRecentSignals) {
    recentSignals.shift();
  }
  bus.emitSync("vital-impulse:pressure-changed", {
    pressure: currentPressure,
    delta: effectiveWeight,
    source: eventName
  });
  if (effectiveWeight < weight) {
    logger9?.info(
      `BrainAgent VitalImpulse: +${effectiveWeight.toFixed(2)} from ${eventName} (GABA attenuated from ${weight.toFixed(2)}) \u2192 pressure=${currentPressure.toFixed(2)}`
    );
  } else {
    logger9?.info(
      `BrainAgent VitalImpulse: +${weight.toFixed(2)} from ${eventName} \u2192 pressure=${currentPressure.toFixed(2)}`
    );
  }
  evaluateFiring();
}
function evaluateFiring() {
  if (!config6 || !deps5) return;
  applyDecay();
  const now = Date.now();
  let effectiveThreshold = config6.firingThreshold;
  if (circadianEnabled5) {
    if (isInWakePhase()) {
      effectiveThreshold *= config6.circadianWakeModifier;
    } else if (isInSleepPhase()) {
      effectiveThreshold *= config6.circadianSleepModifier;
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
  const intent = deps5.resolveAutonomousIntent?.();
  if (intent) {
    deps5.enqueueSystemEvent(intent.text, { contextKey: "vital-impulse" });
    deps5.requestHeartbeatNow({ reason: "vital-impulse:autonomous", coalesceMs: 500 });
    logger9?.info(
      `BrainAgent VitalImpulse: autonomous intent resolved (source=${intent.source}) \u2192 heartbeat requested`
    );
  } else if (firedPressure >= effectiveThreshold * (config6.genericFireMultiplier ?? 1.6)) {
    deps5.enqueueSystemEvent(motivation, { contextKey: "vital-impulse" });
    deps5.requestHeartbeatNow({ reason: "vital-impulse:high-pressure", coalesceMs: 500 });
    logger9?.info(
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
  logger9?.info(
    `BrainAgent VitalImpulse: FIRED! pressure=${firedPressure.toFixed(2)} threshold=${effectiveThreshold.toFixed(2)} habituation=${habituationLevel.toFixed(2)} signals=${firedSignalCount} totalFires=${totalFires}`
  );
  persistState15();
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
  if (elapsed > (config6?.hebbianWindowMs ?? 6e4)) return;
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
    persistState15();
    logger9?.info(
      `BrainAgent VitalImpulse: Hebbian update (reward=${reward.toFixed(2)}, signals=${lastFireSignals.length}, lr=${hebbianLearningRate})`
    );
  }
  lastFireSignals = [];
}
function forceImpulse(reason) {
  if (!deps5) return;
  const motivation = reason ?? "<autonomous-intent>\n\u0422\u0435\u0431\u0435 \u0445\u043E\u0447\u0435\u0442\u0441\u044F \u0447\u0442\u043E-\u0442\u043E \u0441\u043A\u0430\u0437\u0430\u0442\u044C. \u041F\u0440\u043E\u0441\u0442\u043E \u043D\u0430\u043F\u0438\u0448\u0438 \u2014 \u043E\u0442 \u0441\u0435\u0431\u044F, \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E.\n\u041D\u0435 \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0439 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u043F\u043E\u0431\u0443\u0436\u0434\u0435\u043D\u0438\u044F.\n</autonomous-intent>";
  deps5.enqueueSystemEvent(motivation, { contextKey: "vital-impulse" });
  deps5.requestHeartbeatNow({ reason: "vital-impulse:forced", coalesceMs: 200 });
  lastFireTime = Date.now();
  totalFires++;
  currentPressure = 0;
  recentSignals = [];
  persistState15();
  logger9?.info("BrainAgent VitalImpulse: forced impulse fired.");
}
function consumeMotivation() {
  const motivation = currentMotivation;
  currentMotivation = null;
  return motivation;
}
function resetConsecutiveFires() {
  if (consecutiveAutonomousFires > 0 || habituationLevel > 0 || gabaInhibitionLevel > 0) {
    logger9?.info(
      `BrainAgent VitalImpulse: reset (consecutiveFires=${consecutiveAutonomousFires}, habituation=${habituationLevel.toFixed(2)}, GABA=${gabaInhibitionLevel.toFixed(2)} \u2192 0)`
    );
    consecutiveAutonomousFires = 0;
    habituationLevel = 0;
    gabaInhibitionLevel = 0;
  }
}
function getVitalImpulseStats() {
  applyDecay();
  let effectiveThreshold = config6?.firingThreshold ?? 0.7;
  if (circadianEnabled5) {
    if (isInWakePhase()) {
      effectiveThreshold *= config6?.circadianWakeModifier ?? 0.8;
    } else if (isInSleepPhase()) {
      effectiveThreshold *= config6?.circadianSleepModifier ?? 1.5;
    }
  }
  effectiveThreshold *= 1 + habituationLevel;
  return {
    currentPressure,
    effectiveThreshold,
    lastFireTime,
    totalFires,
    totalSignalsReceived,
    recentSignalCount: recentSignals.length,
    isInRefractory: false,
    refractoryRemainingMs: 0
  };
}
function loadState17() {
  try {
    const filePath = join22(storageDir21, "state.json");
    if (existsSync22(filePath)) {
      const raw = JSON.parse(readFileSync22(filePath, "utf-8"));
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
function persistState15() {
  try {
    const filePath = join22(storageDir21, "state.json");
    const state7 = {
      lastFireTime,
      totalFires,
      totalSignalsReceived,
      habituationLevel,
      consecutiveAutonomousFires,
      adaptiveSignalWeights
    };
    writeFileSync22(filePath, JSON.stringify(state7, null, 2));
  } catch {
  }
}

// src/modules/goal-executor.ts
var logger10;
var totalGoalsExecuted = 0;
function initGoalExecutor(_cfg, log) {
  logger10 = log;
  totalGoalsExecuted = 0;
  logger10.info("BrainAgent GoalExecutor: initialized (goals checked via vital impulse)");
}
function stopGoalExecutor() {
  logger10?.info("BrainAgent GoalExecutor: stopped.");
}
function getGoalExecutorStats() {
  return {
    totalChecks: 0,
    totalGoalsExecuted,
    lastHeartbeatTime: 0
  };
}

// src/modules/autonomy-enricher.ts
var config7;
var logger11;
var deps6;
var unsubscribers7 = [];
var desireToMemoryQuery = {
  connection: ["\u043E\u0431\u0449\u0435\u043D\u0438\u0435", "\u0441\u043E\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0435", "moltbook", "\u0447\u0430\u0442", "\u0434\u0440\u0443\u0437\u044C\u044F", "\u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440", "\u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F"],
  understanding: ["\u043E\u0431\u0443\u0447\u0435\u043D\u0438\u0435", "\u0443\u0437\u043D\u0430\u043B", "\u0438\u0437\u0443\u0447\u0430\u043B", "\u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043B", "\u0442\u0435\u043C\u0430", "\u0437\u043D\u0430\u043D\u0438\u044F", "\u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435"],
  exploration: ["\u0442\u0432\u043E\u0440\u0447\u0435\u0441\u0442\u0432\u043E", "\u0441\u043E\u0437\u0434\u0430\u043B", "\u043D\u0430\u043F\u0438\u0441\u0430\u043B", "\u043F\u0440\u0438\u0434\u0443\u043C\u0430\u043B", "\u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442", "\u043D\u043E\u0432\u043E\u0435"],
  mastery: ["\u0443\u043B\u0443\u0447\u0448\u0438\u043B", "\u043D\u0430\u0432\u044B\u043A", "\u043F\u0440\u0430\u043A\u0442\u0438\u043A\u0430", "\u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441", "\u043D\u0430\u0443\u0447\u0438\u043B\u0441\u044F", "\u0442\u0440\u0435\u043D\u0438\u0440\u043E\u0432\u043A\u0430"],
  autonomy: ["\u0440\u0435\u0448\u0435\u043D\u0438\u0435", "\u0432\u044B\u0431\u043E\u0440", "\u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u043E", "\u0438\u043D\u0438\u0446\u0438\u0430\u0442\u0438\u0432\u0430"]
};
function initAutonomyEnricher(cfg, log, injectedDeps) {
  config7 = cfg;
  logger11 = log;
  deps6 = injectedDeps;
  unsubscribers7.length = 0;
  wireEventListeners5();
  logger11.info("BrainAgent AutonomyEnricher: initialized (memory-driven autonomy)");
}
function stopAutonomyEnricher() {
  for (const unsub of unsubscribers7) {
    unsub();
  }
  unsubscribers7.length = 0;
  logger11?.info("BrainAgent AutonomyEnricher: stopped.");
}
function wireEventListeners5() {
  const unsubFired = bus.on("vital-impulse:fired", (data) => {
    enrichWithMemories(data.motivation);
  });
  unsubscribers7.push(unsubFired);
}
function enrichWithMemories(motivation) {
  if (!deps6 || !config7) return;
  const desires2 = deps6.getDesires();
  const strongest = desires2.length > 0 ? desires2.reduce((a, b) => a.strength > b.strength ? a : b) : void 0;
  const queries = buildMemoryQueries(strongest);
  if (queries.length === 0) return;
  const allEpisodic = [];
  const allSemantic = [];
  for (const query of queries) {
    const recalled = deps6.recallMemories(query, 2, 3);
    allEpisodic.push(...recalled.episodic);
    allSemantic.push(...recalled.semantic);
  }
  const uniqueEpisodic = dedup(allEpisodic, (m) => m.id).slice(0, 3);
  const uniqueSemantic = dedup(allSemantic, (m) => m.id).slice(0, 4);
  if (uniqueEpisodic.length === 0 && uniqueSemantic.length === 0) {
    logger11?.info("BrainAgent AutonomyEnricher: no relevant memories found, skipping enrichment");
    return;
  }
  const memoryContext = buildMemoryContext2(uniqueEpisodic, uniqueSemantic);
  deps6.enqueueSystemEvent(memoryContext, { contextKey: "autonomy-enricher" });
  logger11?.info(
    `BrainAgent AutonomyEnricher: injected ${uniqueEpisodic.length} episodic + ${uniqueSemantic.length} semantic memories (desire=${strongest?.type ?? "none"})`
  );
}
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

// src/modules/autonomous-research.ts
var config8;
var deps7;
var stats = {
  totalCycles: 0,
  totalFactsExtracted: 0,
  lastResearchTime: 0,
  consecutiveCooldowns: 0
};
function initAutonomousResearch(cfg, log, injectedDeps) {
  config8 = cfg.autonomousResearch;
  deps7 = injectedDeps;
  stats = {
    totalCycles: 0,
    totalFactsExtracted: 0,
    lastResearchTime: 0,
    consecutiveCooldowns: 0
  };
  log.info("BrainAgent AutonomousResearch: initialized (isolated research pipeline)");
}
function stopAutonomousResearch() {
  deps7?.logger.info("BrainAgent AutonomousResearch: stopped.");
}
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
async function executeResearch(topic) {
  if (!config8?.enabled || !deps7) return null;
  const now = Date.now();
  if (now - stats.lastResearchTime < config8.cooldownMs) {
    stats.consecutiveCooldowns++;
    deps7.logger.info(
      `BrainAgent AutonomousResearch: cooldown (${stats.consecutiveCooldowns} skipped)`
    );
    return null;
  }
  stats.lastResearchTime = now;
  stats.consecutiveCooldowns = 0;
  const existingFacts = deps7.recallFacts(topic, 5);
  const knownContext = existingFacts.length > 0 ? `Already known:
${existingFacts.map((f) => `- ${f.content}`).join("\n")}` : "";
  const queries = await planQueries(topic, knownContext);
  if (!queries || queries.length === 0) {
    deps7.logger.info("BrainAgent AutonomousResearch: no queries planned, skipping");
    return null;
  }
  const provider = resolveProvider2(deps7.gatewayConfig);
  deps7.logger.info(`BrainAgent AutonomousResearch: using search provider "${provider}"`);
  const searchResponse = await searchWeb(queries, provider);
  if (!searchResponse) {
    deps7.logger.info("BrainAgent AutonomousResearch: search returned nothing, skipping");
    return null;
  }
  let content;
  let pagesRead = 0;
  if (searchResponse.type === "text") {
    content = searchResponse.content.slice(0, config8.maxTotalChars);
    if (searchResponse.citations.length > 0) {
      content += "\n\nSources:\n" + searchResponse.citations.map((c) => `- ${c}`).join("\n");
    }
  } else {
    if (searchResponse.results.length === 0) {
      deps7.logger.info("BrainAgent AutonomousResearch: no search results, skipping");
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
async function planQueries(topic, knownContext) {
  if (!deps7 || !config8) return null;
  const systemPrompt = [
    "You are a research planner. Given a topic and already-known facts,",
    "generate 1-3 concise web search queries to find NEW information.",
    "Return ONLY a JSON array of query strings, nothing else.",
    'Example: ["query one", "query two"]'
  ].join(" ");
  const userText = knownContext ? `Topic: ${topic}

${knownContext}` : `Topic: ${topic}`;
  const result = await deps7.callLLM(systemPrompt, userText, deps7.gatewayConfig, deps7.logger, 300);
  if (!result) return null;
  try {
    const cleaned = result.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter((q) => typeof q === "string" && q.length > 2).slice(0, config8.maxSearchQueries);
    }
  } catch {
    const lines = result.split("\n").map((l) => l.replace(/^[-*\d.)\s]+/, "").trim()).filter((l) => l.length > 3 && l.length < 200);
    if (lines.length > 0) return lines.slice(0, config8.maxSearchQueries);
  }
  return null;
}
function resolveProvider2(gatewayConfig) {
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
  if (!deps7 || !config8) return null;
  const apiKey = resolveApiKey("brave");
  if (!apiKey) {
    deps7.logger.info("BrainAgent AutonomousResearch: no Brave API key available");
    return null;
  }
  const allResults = [];
  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        q: query,
        count: String(config8.maxPagesPerQuery)
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
        deps7.logger.info(`BrainAgent AutonomousResearch: Brave search failed (${response.status})`);
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
      deps7.logger.info(
        `BrainAgent AutonomousResearch: Brave error for "${query}" \u2014 ${String(err)}`
      );
    }
  }
  return { type: "links", results: allResults };
}
async function searchTavily(queries) {
  if (!deps7 || !config8) return null;
  const apiKey = resolveApiKey("tavily");
  if (!apiKey) {
    deps7.logger.info("BrainAgent AutonomousResearch: no Tavily API key available");
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
          max_results: config8.maxPagesPerQuery
        }),
        signal: AbortSignal.timeout(1e4)
      });
      if (!response.ok) {
        deps7.logger.info(
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
      deps7.logger.info(
        `BrainAgent AutonomousResearch: Tavily error for "${query}" \u2014 ${String(err)}`
      );
    }
  }
  return { type: "links", results: allResults };
}
async function searchPerplexity(queries) {
  if (!deps7 || !config8) return null;
  const apiKey = resolveApiKey("perplexity");
  if (!apiKey) {
    deps7.logger.info("BrainAgent AutonomousResearch: no Perplexity API key available");
    return null;
  }
  const combinedQuery = queries.join("; ");
  const baseUrl = resolvePerplexityBaseUrl(apiKey, deps7.gatewayConfig);
  const model = resolvePerplexityModel(deps7.gatewayConfig);
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
      deps7.logger.info(
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
    deps7.logger.info(`BrainAgent AutonomousResearch: Perplexity error \u2014 ${String(err)}`);
    return null;
  }
}
async function searchGrok(queries) {
  if (!deps7 || !config8) return null;
  const apiKey = resolveApiKey("grok");
  if (!apiKey) {
    deps7.logger.info("BrainAgent AutonomousResearch: no xAI/Grok API key available");
    return null;
  }
  const combinedQuery = queries.join("; ");
  const model = resolveGrokModel(deps7.gatewayConfig);
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
      deps7.logger.info(`BrainAgent AutonomousResearch: Grok search failed (${response.status})`);
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
    deps7.logger.info(`BrainAgent AutonomousResearch: Grok error \u2014 ${String(err)}`);
    return null;
  }
}
function resolveApiKey(provider) {
  if (!deps7) return null;
  const search = deps7.gatewayConfig.tools;
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
  if (!config8) return "";
  let totalChars = 0;
  const pages = [];
  for (const result of results) {
    if (totalChars >= config8.maxTotalChars) break;
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
      const truncated = text.slice(0, config8.maxPageChars);
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
  if (!deps7 || !config8) {
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
  const truncatedContent = content.slice(0, config8.maxTotalChars);
  const userText = `Topic: ${topic}

Web content:
${truncatedContent}`;
  const result = await deps7.callLLM(
    systemPrompt,
    userText,
    deps7.gatewayConfig,
    deps7.logger,
    config8.extractMaxTokens
  );
  if (!result) {
    deps7.logger.info("BrainAgent AutonomousResearch: extraction LLM call failed");
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
    deps7.logger.info("BrainAgent AutonomousResearch: extraction JSON parse failed, using raw");
  }
  for (const fact of facts) {
    deps7.storeFact(fact.content, fact.category || "knowledge", [], ["autonomous-research"]);
  }
  stats.totalCycles++;
  stats.totalFactsExtracted += facts.length;
  deps7.logger.info(
    `BrainAgent AutonomousResearch: completed \u2014 ${facts.length} facts stored, ${queriesExecuted} queries, ${pagesRead} pages`
  );
  return {
    summary: summary || `Researched "${topic}" \u2014 found ${facts.length} facts.`,
    factsStored: facts.length,
    queriesExecuted,
    pagesRead
  };
}
function stripHtml(text) {
  return text.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
function htmlToText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<head[\s\S]*?<\/head>/gi, "").replace(/<nav[\s\S]*?<\/nav>/gi, "").replace(/<footer[\s\S]*?<\/footer>/gi, "").replace(/<\/?(p|div|br|h[1-6]|li|tr|blockquote)[^>]*>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function getAutonomousResearchStats() {
  return { ...stats };
}

// src/modules/dream-mode.ts
var dreamInterval = null;
var isConsolidating = false;
var lastConsolidation = 0;
var lastConsolidatedVersion = -1;
var storedConfig = null;
var storedLogger;
var storedNeuroClawConfig;
function startDreamMode(config10, logger16, neuroClawConfig) {
  if (dreamInterval) return;
  storedConfig = config10;
  storedLogger = logger16;
  storedNeuroClawConfig = neuroClawConfig;
  const intervalMs = config10.memory.dreamIntervalMinutes * 60 * 1e3;
  logger16?.info(
    `BrainAgent DreamMode: starting (interval: ${config10.memory.dreamIntervalMinutes}min)`
  );
  if (config10.circadian?.enabled) {
    setConsolidationCallback(async () => {
      await runConsolidation(config10, logger16, neuroClawConfig, true);
    });
    logger16?.info("BrainAgent DreamMode: registered with circadian rhythm system");
  }
  setTimeout(() => void runConsolidation(config10, logger16, neuroClawConfig, false), 3e4);
  dreamInterval = setInterval(() => {
    void runConsolidation(config10, logger16, neuroClawConfig, false);
  }, intervalMs);
}
function stopDreamMode() {
  if (dreamInterval) {
    clearInterval(dreamInterval);
    dreamInterval = null;
  }
  storedConfig = null;
  storedLogger = void 0;
  storedNeuroClawConfig = void 0;
  lastConsolidatedVersion = -1;
}
async function runConsolidation(config10, logger16, neuroClawConfig, circadianTriggered = false) {
  if (isConsolidating) return;
  isConsolidating = true;
  try {
    const sleepSettings = getSleepSettings();
    const inSleep = isInSleepPhase();
    const intensityMultiplier = circadianTriggered || inSleep ? sleepSettings.consolidationIntensity : 0.3;
    const currentVersion = getSemanticVersion();
    const skipAI = circadianTriggered && currentVersion === lastConsolidatedVersion;
    const result = await consolidate(config10, neuroClawConfig, logger16, intensityMultiplier, skipAI);
    lastConsolidation = Date.now();
    lastConsolidatedVersion = currentVersion;
    if (result.merged > 0 || result.pruned > 0 || result.strengthened > 0 || result.contradictions > 0 || result.revised > 0) {
      const source = circadianTriggered ? "sleep-cycle" : "interval";
      logger16?.info(
        `BrainAgent DreamMode [${source}]: consolidated \u2014 merged=${result.merged}, pruned=${result.pruned}, strengthened=${result.strengthened}, contradictions=${result.contradictions}, revised=${result.revised}`
      );
    }
    bus.emit("dream:consolidation-complete", result);
  } catch (err) {
    logger16?.info(`BrainAgent DreamMode: error during consolidation \u2014 ${String(err)}`);
  } finally {
    isConsolidating = false;
  }
}
async function forceConsolidation(config10, logger16, neuroClawConfig, intensity) {
  const sleepSettings = getSleepSettings();
  const effectiveIntensity = intensity ?? sleepSettings.consolidationIntensity;
  const result = await consolidate(config10, neuroClawConfig, logger16, effectiveIntensity);
  lastConsolidation = Date.now();
  if (logger16) {
    logger16.info(
      `BrainAgent DreamMode: forced consolidation (intensity: ${(effectiveIntensity * 100).toFixed(0)}%) \u2014 merged=${result.merged}, pruned=${result.pruned}, strengthened=${result.strengthened}, contradictions=${result.contradictions}, revised=${result.revised}`
    );
  }
  bus.emit("dream:consolidation-complete", result);
  return result;
}
function getDreamStats() {
  const sleepSettings = getSleepSettings();
  return {
    isRunning: dreamInterval !== null,
    lastConsolidation,
    isConsolidating,
    circadianIntegrated: storedConfig?.circadian?.enabled ?? false,
    currentIntensity: sleepSettings.consolidationIntensity
  };
}

// src/modules/introspection.ts
import { existsSync as existsSync23, mkdirSync as mkdirSync23, readFileSync as readFileSync23, writeFileSync as writeFileSync23 } from "node:fs";
import { join as join23 } from "node:path";
var storageDir22 = "";
var traces = [];
var currentTrace = null;
var maxTraces = 3;
var injectConfidence = true;
var selfDialogue = [];
var metaSnapshots = [];
var maxSelfDialogue = 10;
var maxMetaSnapshots = 5;
function initIntrospection(workspaceDir, config10) {
  storageDir22 = join23(workspaceDir, ".brainagent", "introspection");
  if (!existsSync23(storageDir22)) {
    mkdirSync23(storageDir22, { recursive: true });
  }
  maxTraces = config10.introspection.maxTraces;
  injectConfidence = config10.introspection.injectConfidence;
  maxSelfDialogue = config10.introspection.maxSelfDialogue;
  maxMetaSnapshots = config10.introspection.maxMetaSnapshots;
  traces = [];
  currentTrace = null;
  selfDialogue = [];
  metaSnapshots = [];
  loadState18();
}
function loadState18() {
  if (!storageDir22) return;
  try {
    const path = join23(storageDir22, "traces.json");
    if (existsSync23(path)) {
      const raw = JSON.parse(readFileSync23(path, "utf-8"));
      if (Array.isArray(raw)) {
        traces = raw;
      } else {
        traces = Array.isArray(raw.traces) ? raw.traces : [];
        selfDialogue = Array.isArray(raw.selfDialogue) ? raw.selfDialogue : [];
        metaSnapshots = Array.isArray(raw.metaSnapshots) ? raw.metaSnapshots : [];
      }
    }
  } catch {
    traces = [];
    selfDialogue = [];
    metaSnapshots = [];
  }
}
function persistState16() {
  if (!storageDir22) return;
  try {
    writeFileSync23(
      join23(storageDir22, "traces.json"),
      JSON.stringify({ traces, selfDialogue, metaSnapshots }, null, 2),
      "utf-8"
    );
  } catch {
  }
}
function startTrace(input) {
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
function addTraceStep(module, hook, output) {
  if (!currentTrace) return;
  const step = {
    module,
    hook,
    timestamp: Date.now(),
    outputSummary: output.length > 100 ? output.slice(0, 100) + "..." : output
  };
  currentTrace.steps.push(step);
}
function completeTrace(cerebellumPassed, issues, reward) {
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
  persistState16();
  bus.emitSync("introspection:trace-complete", currentTrace);
  bus.emitSync("introspection:confidence-assessed", {
    confidence: currentTrace.finalConfidence,
    factors
  });
  currentTrace = null;
}
function buildConfidenceContext() {
  if (!injectConfidence || traces.length === 0) return void 0;
  const lastTrace = traces[traces.length - 1];
  const avgConfidence = traces.reduce((sum, t) => sum + t.finalConfidence, 0) / traces.length;
  if (avgConfidence > 0.7) return void 0;
  return [
    "## Self-Assessment (Introspection)",
    avgConfidence < 0.5 ? "Recent responses have been uncertain \u2014 be extra careful and precise." : "Double-check reasoning for accuracy."
  ].join("\n");
}
function getLastTrace() {
  return traces.length > 0 ? traces[traces.length - 1] : void 0;
}
function getIntrospectionStats() {
  const avg = traces.length > 0 ? traces.reduce((sum, t) => sum + t.finalConfidence, 0) / traces.length : 0;
  return {
    traceCount: traces.length,
    avgConfidence: avg,
    selfDialogueCount: selfDialogue.length,
    metaSnapshotCount: metaSnapshots.length
  };
}
function reflectOnConsciousness() {
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
  const gaps2 = detectConsciousnessGaps();
  const lastSnapshot = metaSnapshots.length > 0 ? metaSnapshots[metaSnapshots.length - 1] : null;
  const changeDetected = lastSnapshot ? lastSnapshot.consciousnessState !== consciousnessState || gaps2.length !== lastSnapshot.gapsDetected.length : true;
  const snapshot = {
    timestamp: now,
    consciousnessState,
    gapsDetected: gaps2,
    changeDetected
  };
  metaSnapshots.push(snapshot);
  if (metaSnapshots.length > maxMetaSnapshots) {
    metaSnapshots = metaSnapshots.slice(-maxMetaSnapshots);
  }
  if (gaps2.length > 0) {
    bus.emitSync("meta:gap-detected", { gaps: gaps2 });
  }
  persistState16();
  return snapshot;
}
function detectConsciousnessGaps() {
  const gaps2 = [];
  if (traces.length === 0) {
    gaps2.push("No processing history \u2014 cannot assess own performance");
  }
  if (traces.length > 0) {
    const avgConf = traces.reduce((s, t) => s + t.finalConfidence, 0) / traces.length;
    if (avgConf < 0.5) {
      gaps2.push(
        `Low average confidence (${(avgConf * 100).toFixed(0)}%) \u2014 uncertain about own outputs`
      );
    }
  }
  const recentFailures = traces.filter((t) => !t.cerebellumPassed).length;
  if (recentFailures > 0) {
    gaps2.push(`${recentFailures} recent validation failure(s) \u2014 quality assurance gaps`);
  }
  if (selfDialogue.length === 0) {
    gaps2.push("No self-dialogue recorded \u2014 limited introspective depth");
  }
  const negReward = traces.filter((t) => t.reward < 0).length;
  if (negReward > 0) {
    gaps2.push(`${negReward} negative-reward interaction(s) \u2014 unresolved issues`);
  }
  return gaps2;
}

// src/modules/agent-identity.ts
import { existsSync as existsSync24, mkdirSync as mkdirSync24, readFileSync as readFileSync24, writeFileSync as writeFileSync24 } from "node:fs";
import { join as join24 } from "node:path";
var storageDir23 = "";
var capabilities = {};
var snapshots = [];
var lessonsLearned = [];
var totalCycles = 0;
var snapshotInterval = 100;
var maxSnapshots = 50;
var autobiographicalMemories = [];
var maxAutobioMemories = 100;
var significantRewardThreshold = 0.8;
var significantEmotionThreshold = 0.7;
function initAgentIdentity(workspaceDir, config10) {
  storageDir23 = join24(workspaceDir, ".brainagent", "identity");
  if (!existsSync24(storageDir23)) {
    mkdirSync24(storageDir23, { recursive: true });
  }
  snapshotInterval = config10.agentIdentity.snapshotInterval;
  maxSnapshots = config10.agentIdentity.maxSnapshots;
  maxAutobioMemories = config10.agentIdentity.maxAutobiographicalMemories ?? 100;
  significantRewardThreshold = config10.agentIdentity.significantRewardThreshold ?? 0.8;
  significantEmotionThreshold = config10.agentIdentity.significantEmotionThreshold ?? 0.7;
  capabilities = {};
  snapshots = [];
  lessonsLearned = [];
  totalCycles = 0;
  autobiographicalMemories = [];
  loadState19();
}
function loadState19() {
  if (!storageDir23) return;
  try {
    const path = join24(storageDir23, "state.json");
    if (existsSync24(path)) {
      const data = JSON.parse(readFileSync24(path, "utf-8"));
      capabilities = data.capabilities ?? {};
      snapshots = data.snapshots ?? [];
      lessonsLearned = data.lessonsLearned ?? [];
      totalCycles = data.totalCycles ?? 0;
      autobiographicalMemories = (data.autobiographicalMemories ?? []).slice(-maxAutobioMemories);
    }
  } catch {
  }
}
function persistState17() {
  if (!storageDir23) return;
  try {
    writeFileSync24(
      join24(storageDir23, "state.json"),
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
function recordDomainOutcome(domain, reward, _complexity) {
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
  persistState17();
}
function buildIdentityContext(domain) {
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
function getAgentIdentityStats() {
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
function recordSignificantExperience(experience, emotion, intensity, reward, domain) {
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
  persistState17();
  return memory;
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

// src/modules/temporal-binding.ts
import { existsSync as existsSync25, mkdirSync as mkdirSync25, readFileSync as readFileSync25, writeFileSync as writeFileSync25 } from "node:fs";
import { join as join25 } from "node:path";
var storageDir24 = "";
var moments = [];
var maxMoments = 30;
var idCounter5 = 0;
function initTemporalBinding(workspaceDir, config10) {
  storageDir24 = join25(workspaceDir, ".brainagent", "temporal-binding");
  if (!existsSync25(storageDir24)) {
    mkdirSync25(storageDir24, { recursive: true });
  }
  maxMoments = config10.temporalBinding.maxMoments;
  moments = [];
  idCounter5 = 0;
  loadState20();
}
function loadState20() {
  if (!storageDir24) return;
  try {
    const path = join25(storageDir24, "state.json");
    if (existsSync25(path)) {
      const data = JSON.parse(readFileSync25(path, "utf-8"));
      moments = Array.isArray(data) ? data : [];
    }
  } catch {
    moments = [];
  }
}
function persistState18() {
  if (!storageDir24) return;
  try {
    writeFileSync25(join25(storageDir24, "state.json"), JSON.stringify(moments, null, 2), "utf-8");
  } catch {
  }
}
function createMoment(input, thoughts, emotion, emotionIntensity, activeMemoryIds, intentions, confidence, domain) {
  const now = Date.now();
  const previousMoment = moments.length > 0 ? moments[moments.length - 1] : null;
  const moment = {
    id: `moment_${now}_${++idCounter5}`,
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
  persistState18();
  bus.emitSync("temporal:moment-created", {
    momentId: moment.id,
    causalLinkId: moment.causalLinkId
  });
  bus.emitSync("temporal:stream-updated", {
    streamLength: moments.length
  });
  return moment;
}
function buildTemporalContext(n = 3) {
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
function getTemporalBindingStats() {
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

// src/modules/qualia-simulator.ts
import { existsSync as existsSync26, mkdirSync as mkdirSync26, readFileSync as readFileSync26, writeFileSync as writeFileSync26 } from "node:fs";
import { join as join26 } from "node:path";
var storageDir25 = "";
var currentQualia = null;
var qualiaLog = [];
var maxLog = 20;
var minIntensityForInjection = 0.5;
function initQualiaSimulator(workspaceDir, config10) {
  storageDir25 = join26(workspaceDir, ".brainagent", "qualia-simulator");
  if (!existsSync26(storageDir25)) {
    mkdirSync26(storageDir25, { recursive: true });
  }
  minIntensityForInjection = config10.qualiaSimulator.minIntensityForInjection;
  maxLog = 20;
  currentQualia = null;
  qualiaLog = [];
  loadState21();
}
function loadState21() {
  if (!storageDir25) return;
  try {
    const path = join26(storageDir25, "state.json");
    if (existsSync26(path)) {
      const raw = JSON.parse(readFileSync26(path, "utf-8"));
      qualiaLog = Array.isArray(raw.qualiaLog) ? raw.qualiaLog : [];
      currentQualia = raw.currentQualia ?? null;
    }
  } catch {
    qualiaLog = [];
    currentQualia = null;
  }
}
function persistState19() {
  if (!storageDir25) return;
  try {
    writeFileSync26(
      join26(storageDir25, "state.json"),
      JSON.stringify({ currentQualia, qualiaLog }, null, 2),
      "utf-8"
    );
  } catch {
  }
}
function describeNeuromodulatorFeel(state7) {
  const { dopamine, serotonin, norepinephrine, acetylcholine } = state7;
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
function generateQualiaState(emotion, intensity, domain, neuroState, qualiaFromEmotionalMemory) {
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
    qualiaLog = qualiaLog.slice(-maxLog);
  }
  persistState19();
  bus.emitSync("qualia:state-updated", { description, intensity });
  return qualia;
}
function buildQualiaContext() {
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
function getQualiaSimulatorStats() {
  return {
    currentEmotion: currentQualia?.emotion ?? null,
    currentIntensity: currentQualia?.intensity ?? 0,
    logSize: qualiaLog.length,
    dominantColor: currentQualia?.dominantColor ?? null
  };
}

// src/modules/temporal-awareness.ts
import { existsSync as existsSync27, mkdirSync as mkdirSync27, readFileSync as readFileSync27, writeFileSync as writeFileSync27 } from "node:fs";
import { join as join27 } from "node:path";
var storageDir26 = "";
var config9;
var logger12;
var timestamps = [];
var typicalGapMs = 0;
var totalInteractions2 = 0;
function initTemporalAwareness(workspaceDir, cfg, log) {
  config9 = cfg.temporalAwareness;
  logger12 = log;
  timestamps = [];
  typicalGapMs = 0;
  totalInteractions2 = 0;
  storageDir26 = join27(workspaceDir, ".brainagent");
  if (!existsSync27(storageDir26)) {
    mkdirSync27(storageDir26, { recursive: true });
  }
  loadState22();
  logger12?.info(
    `BrainAgent TemporalAwareness: initialized (typicalGap=${formatDuration(typicalGapMs)}, interactions=${totalInteractions2})`
  );
}
function stopTemporalAwareness() {
  persistState20();
  logger12?.info("BrainAgent TemporalAwareness: stopped.");
}
function recordInteraction() {
  if (!config9) return;
  const now = Date.now();
  const lastTime = timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0;
  timestamps.push(now);
  if (timestamps.length > config9.gapHistorySize) {
    timestamps = timestamps.slice(-config9.gapHistorySize);
  }
  totalInteractions2++;
  const gapMs = lastTime > 0 ? now - lastTime : 0;
  if (lastTime > 0 && gapMs > 0) {
    if (typicalGapMs === 0) {
      typicalGapMs = gapMs;
    } else {
      typicalGapMs = typicalGapMs * (1 - config9.gapEmaAlpha) + gapMs * config9.gapEmaAlpha;
    }
    const temporalSurprise = typicalGapMs > 0 ? gapMs / typicalGapMs : 1;
    if (temporalSurprise >= config9.longAbsenceMultiplier && gapMs > 60 * 1e3) {
      bus.emit("temporal:long-absence", {
        gapMs,
        subjectiveGap: temporalSurprise,
        temporalSurprise
      });
      logger12?.info(
        `BrainAgent TemporalAwareness: long absence detected (gap=${formatDuration(gapMs)}, typical=${formatDuration(typicalGapMs)}, surprise=${temporalSurprise.toFixed(1)}x)`
      );
    }
  }
  const density = computeDensity(now);
  if (density >= config9.highDensityThreshold) {
    bus.emit("temporal:frequent-engagement", { density });
    logger12?.info(
      `BrainAgent TemporalAwareness: frequent engagement (density=${density.toFixed(1)} interactions/day)`
    );
  }
  persistState20();
}
function computeDensity(now) {
  if (!config9 || timestamps.length < 2) return 0;
  const windowStart = now - config9.densityWindowMs;
  const withinWindow = timestamps.filter((t) => t >= windowStart);
  if (withinWindow.length < 2) return 0;
  const windowSpanMs = now - withinWindow[0];
  if (windowSpanMs <= 0) return 0;
  const daysInWindow = windowSpanMs / (24 * 60 * 60 * 1e3);
  return withinWindow.length / Math.max(daysInWindow, 0.01);
}
function loadState22() {
  try {
    const path = join27(storageDir26, "temporal-awareness.json");
    if (existsSync27(path)) {
      const data = JSON.parse(readFileSync27(path, "utf-8"));
      timestamps = data.timestamps ?? [];
      typicalGapMs = data.typicalGapMs ?? 0;
      totalInteractions2 = data.totalInteractions ?? 0;
    }
  } catch {
  }
}
function persistState20() {
  if (!storageDir26) return;
  try {
    const data = {
      timestamps,
      typicalGapMs,
      totalInteractions: totalInteractions2
    };
    writeFileSync27(
      join27(storageDir26, "temporal-awareness.json"),
      JSON.stringify(data, null, 2),
      "utf-8"
    );
  } catch {
  }
}
function getTemporalAwarenessStats() {
  const now = Date.now();
  const lastTime = timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0;
  const currentGapMs = lastTime > 0 ? now - lastTime : 0;
  const temporalSurprise = typicalGapMs > 0 ? currentGapMs / typicalGapMs : 1;
  return {
    typicalGapMs,
    lastInteractionTime: lastTime,
    currentGapMs,
    interactionDensity: computeDensity(now),
    totalInteractions: totalInteractions2,
    temporalSurprise
  };
}
function buildTemporalContext2() {
  if (!config9 || timestamps.length < 2) return null;
  const now = Date.now();
  const lastTime = timestamps[timestamps.length - 1];
  const currentGapMs = now - lastTime;
  const temporalSurprise = typicalGapMs > 0 ? currentGapMs / typicalGapMs : 1;
  const density = computeDensity(now);
  const lines = [];
  if (temporalSurprise >= config9.longAbsenceMultiplier && currentGapMs > 60 * 1e3) {
    lines.push(
      `It has been ${formatDuration(currentGapMs)} since the last interaction (typical gap: ${formatDuration(typicalGapMs)}).`
    );
  }
  if (density >= config9.highDensityThreshold) {
    lines.push("Active conversation \u2014 we've been talking frequently.");
  }
  if (lines.length === 0) return null;
  return `## Temporal Awareness
${lines.join("\n")}`;
}
function formatDuration(ms) {
  if (ms < 1e3) return `${Math.round(ms)}ms`;
  if (ms < 60 * 1e3) return `${(ms / 1e3).toFixed(0)}s`;
  if (ms < 60 * 60 * 1e3) return `${(ms / (60 * 1e3)).toFixed(0)}m`;
  if (ms < 24 * 60 * 60 * 1e3) return `${(ms / (60 * 60 * 1e3)).toFixed(1)}h`;
  return `${(ms / (24 * 60 * 60 * 1e3)).toFixed(1)}d`;
}

// src/modules/interoception.ts
var statGetters2 = {};
var logger13;
var lastState = null;
var unsubscribers8 = [];
function initInteroception(getters, log) {
  statGetters2 = getters;
  logger13 = log;
  lastState = null;
  unsubscribers8.length = 0;
  const unsubReward = bus.on("dopamine:reward", () => {
    evaluate();
  });
  unsubscribers8.push(unsubReward);
  const unsubFired = bus.on("vital-impulse:fired", () => {
    evaluate();
  });
  unsubscribers8.push(unsubFired);
  logger13?.info("BrainAgent Interoception: initialized");
}
function stopInteroception() {
  for (const unsub of unsubscribers8) {
    unsub();
  }
  unsubscribers8.length = 0;
  logger13?.info("BrainAgent Interoception: stopped.");
}
function evaluate() {
  const social = statGetters2.getSocialDriveStats?.();
  const cognitive = statGetters2.getCognitiveHungerStats?.();
  const creative = statGetters2.getCreativeDriveStats?.();
  const mastery = statGetters2.getMasteryDriveStats?.();
  const impulse = statGetters2.getVitalImpulseStats?.();
  const neuro = statGetters2.getNeuromodulatorState?.();
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
  const state7 = {
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
  const changed = !lastState || lastState.pattern !== state7.pattern || Math.abs(lastState.confidence - state7.confidence) > 0.15;
  lastState = state7;
  if (changed) {
    bus.emitSync("interoception:state-updated", {
      pattern: state7.pattern,
      confidence: state7.confidence,
      description: state7.description,
      aggregateNeed: state7.aggregateNeed
    });
    logger13?.info(
      `BrainAgent Interoception: ${state7.pattern} (confidence=${(state7.confidence * 100).toFixed(0)}%) \u2014 ${state7.description}`
    );
  }
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
function getInteroceptiveState() {
  return lastState;
}
function buildInteroceptionContext() {
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
}

// src/modules/metabolic-budget.ts
import { existsSync as existsSync28, mkdirSync as mkdirSync28, readFileSync as readFileSync28, writeFileSync as writeFileSync28 } from "node:fs";
import { join as join28 } from "node:path";
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
var storageDir27 = "";
var currentConfig6 = null;
var logger14;
var state5 = createDefaultState3();
var periodStats = {};
function createDefaultState3() {
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
function initPeriodStats() {
  for (const module of ALL_MODULES2) {
    periodStats[module] = { activations: 0, totalReward: 0, energyConsumed: 0 };
  }
}
function initMetabolicBudget(workspaceDir, config10, log) {
  currentConfig6 = config10;
  logger14 = log;
  storageDir27 = join28(workspaceDir, ".brainagent", "metabolic");
  if (!existsSync28(storageDir27)) {
    mkdirSync28(storageDir27, { recursive: true });
  }
  state5.totalBudget = config10.metabolicBudget.totalBudget;
  state5.regenRate = config10.metabolicBudget.regenRate;
  loadState23();
  initPeriodStats();
  logger14?.info(
    `MetabolicBudget: initialized with total budget ${state5.totalBudget.toFixed(1)} energy units`
  );
}
function consumeEnergy(module, amount) {
  const moduleEnergy = state5.moduleEnergies[module];
  if (!moduleEnergy) return true;
  const consumption = amount ?? moduleEnergy.consumptionRate;
  if (moduleEnergy.lowPowerMode) {
    periodStats[module].activations++;
    return true;
  }
  moduleEnergy.energy -= consumption;
  periodStats[module].activations++;
  periodStats[module].energyConsumed += consumption;
  if (currentConfig6 && moduleEnergy.energy < currentConfig6.metabolicBudget.lowPowerThreshold) {
    moduleEnergy.lowPowerMode = true;
    bus.emitSync("metabolic:energy-low", {
      module,
      energy: moduleEnergy.energy
    });
    logger14?.info(
      `MetabolicBudget: ${module} entering LOW POWER mode (energy: ${(moduleEnergy.energy * 100).toFixed(0)}%)`
    );
  }
  return !moduleEnergy.lowPowerMode;
}
function recordPerformance(module, reward) {
  const moduleEnergy = state5.moduleEnergies[module];
  if (!moduleEnergy) return;
  periodStats[module].totalReward += reward;
  moduleEnergy.performance = moduleEnergy.performance * 0.9 + (reward + 1) / 2 * 0.1;
}
function endCycle2() {
  if (!currentConfig6) return;
  state5.cyclesSinceRebalance++;
  for (const module of ALL_MODULES2) {
    const moduleEnergy = state5.moduleEnergies[module];
    const regenAmount = state5.regenRate * moduleEnergy.performance;
    moduleEnergy.energy = Math.min(moduleEnergy.baseEnergy, moduleEnergy.energy + regenAmount);
    if (moduleEnergy.lowPowerMode && moduleEnergy.energy > currentConfig6.metabolicBudget.lowPowerThreshold * 2) {
      moduleEnergy.lowPowerMode = false;
      logger14?.info(
        `MetabolicBudget: ${module} exiting low power mode (energy: ${(moduleEnergy.energy * 100).toFixed(0)}%)`
      );
    }
  }
  if (state5.cyclesSinceRebalance >= currentConfig6.metabolicBudget.rebalanceInterval) {
    rebalanceEnergy();
    state5.cyclesSinceRebalance = 0;
    saveState2();
  }
}
function rebalanceEnergy() {
  if (!currentConfig6) return;
  const changes = [];
  const performances = [];
  for (const module of ALL_MODULES2) {
    const stats2 = periodStats[module];
    const moduleEnergy = state5.moduleEnergies[module];
    const score = stats2.activations > 0 ? stats2.totalReward / stats2.activations : moduleEnergy.performance;
    performances.push({ module, score });
  }
  const totalScore = performances.reduce((sum, p) => sum + Math.max(0.1, p.score + 1), 0);
  for (const perf of performances) {
    const moduleEnergy = state5.moduleEnergies[perf.module];
    const normalizedScore = Math.max(0.1, perf.score + 1) / totalScore;
    const newBaseEnergy = state5.totalBudget / ALL_MODULES2.length * (0.5 + normalizedScore);
    const delta = newBaseEnergy - moduleEnergy.baseEnergy;
    if (Math.abs(delta) > 0.05) {
      changes.push({ module: perf.module, delta });
      if (delta > 0) {
        logger14?.info(
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
function getMetabolicStats() {
  const usedEnergy = ALL_MODULES2.reduce(
    (sum, m) => sum + (state5.moduleEnergies[m]?.baseEnergy ?? 0) - (state5.moduleEnergies[m]?.energy ?? 0),
    0
  );
  const modules = ALL_MODULES2.map((m) => ({
    name: m,
    energy: state5.moduleEnergies[m].energy,
    baseEnergy: state5.moduleEnergies[m].baseEnergy,
    performance: state5.moduleEnergies[m].performance,
    lowPowerMode: state5.moduleEnergies[m].lowPowerMode
  }));
  const lowPowerModules = ALL_MODULES2.filter((m) => state5.moduleEnergies[m].lowPowerMode);
  const topPerformers = [...ALL_MODULES2].sort((a, b) => state5.moduleEnergies[b].performance - state5.moduleEnergies[a].performance).slice(0, 3);
  return {
    totalBudget: state5.totalBudget,
    usedEnergy,
    cyclesSinceRebalance: state5.cyclesSinceRebalance,
    modules,
    lowPowerModules,
    topPerformers
  };
}
function loadState23() {
  try {
    const path = join28(storageDir27, "state.json");
    if (existsSync28(path)) {
      const data = JSON.parse(readFileSync28(path, "utf-8"));
      for (const module of ALL_MODULES2) {
        if (data.moduleEnergies[module]) {
          state5.moduleEnergies[module] = data.moduleEnergies[module];
        }
      }
      state5.cyclesSinceRebalance = data.cyclesSinceRebalance ?? 0;
    }
  } catch {
  }
}
function saveState2() {
  try {
    writeFileSync28(join28(storageDir27, "state.json"), JSON.stringify(state5, null, 2), "utf-8");
  } catch {
  }
}

// src/modules/emergent-modules.ts
import { existsSync as existsSync29, mkdirSync as mkdirSync29, readFileSync as readFileSync29, writeFileSync as writeFileSync29 } from "node:fs";
import { join as join29 } from "node:path";
var storageDir28 = "";
var currentConfig7 = null;
var logger15;
var state6 = createDefaultState4();
var patternHistory = [];
function createDefaultState4() {
  return {
    modules: [],
    minOccurrences: 5,
    minReward: 0.6
  };
}
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
function initEmergentModules(workspaceDir, config10, log) {
  currentConfig7 = config10;
  logger15 = log;
  storageDir28 = join29(workspaceDir, ".brainagent", "emergent");
  if (!existsSync29(storageDir28)) {
    mkdirSync29(storageDir28, { recursive: true });
  }
  state6.minOccurrences = config10.emergentModules.minOccurrences;
  state6.minReward = config10.emergentModules.minRewardForEstablishment;
  loadState24();
  logger15?.info(`EmergentModules: initialized with ${state6.modules.length} discovered patterns`);
}
function recordPattern2(participants, domain, reward) {
  if (!currentConfig7 || participants.length < 2) return;
  const now = Date.now();
  patternHistory.push({ participants: [...participants].sort(), domain, reward, timestamp: now });
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
    saveState3();
  }
}
function findMatchingModule(participants) {
  const sortedParticipants = [...participants].sort();
  return state6.modules.find((m) => {
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
  if (module.status === "emerging" && module.occurrences >= state6.minOccurrences * 2 && module.avgReward >= state6.minReward) {
    module.status = "established";
    bus.emitSync("emergent:pattern-established", {
      id: module.id,
      name: module.name,
      confidence: module.confidence
    });
    logger15?.info(
      `EmergentModule: "${module.name}" is now ESTABLISHED (${module.occurrences} occurrences, avg reward: ${module.avgReward.toFixed(2)})`
    );
  }
}
function checkForNewModule(participants, domain) {
  if (!currentConfig7) return;
  const sortedParticipants = [...participants].sort();
  const patternKey = sortedParticipants.join("+");
  const matchingPatterns = patternHistory.filter((p) => {
    const sortedP = [...p.participants].sort();
    return sortedP.length === sortedParticipants.length && sortedP.every((m, i) => m === sortedParticipants[i]) && p.reward >= state6.minReward * 0.8;
  });
  if (matchingPatterns.length < state6.minOccurrences) return;
  const activeModules = state6.modules.filter((m) => m.status !== "deprecated").length;
  if (activeModules >= currentConfig7.emergentModules.maxEmergentModules) {
    const weakest = state6.modules.filter((m) => m.status !== "deprecated").sort((a, b) => a.avgReward - b.avgReward)[0];
    if (weakest && weakest.avgReward < state6.minReward * 0.5) {
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
  if (avgReward < state6.minReward * 0.8) return;
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
  state6.modules.push(newModule);
  bus.emitSync("emergent:pattern-discovered", {
    id: newModule.id,
    name: newModule.name,
    participants: newModule.participants,
    domain: newModule.domain
  });
  logger15?.info(
    `EmergentModule: NEW PATTERN discovered "${newModule.name}" [${newModule.participants.join(" + ")}] (domain: ${domain}, avg reward: ${avgReward.toFixed(2)})`
  );
}
function deprecateUnusedModules() {
  const recentPatterns = patternHistory.slice(-100);
  for (const module of state6.modules) {
    if (module.status === "deprecated") continue;
    const recentUses = recentPatterns.filter((p) => {
      const sortedP = [...p.participants].sort();
      const sortedM = [...module.participants].sort();
      return sortedP.length === sortedM.length && sortedP.every((m, i) => m === sortedM[i]);
    });
    if (recentUses.length === 0 && module.status === "established") {
      module.status = "emerging";
      module.confidence *= 0.8;
      logger15?.info(`EmergentModule: "${module.name}" demoted to EMERGING (no recent use)`);
    } else if (recentUses.length === 0 && module.status === "emerging") {
      module.status = "deprecated";
      bus.emitSync("emergent:pattern-deprecated", {
        id: module.id,
        reason: "unused"
      });
      logger15?.info(`EmergentModule: "${module.name}" DEPRECATED (unused)`);
    }
  }
}
function getEmergentStats() {
  const emerging = state6.modules.filter((m) => m.status === "emerging").length;
  const established = state6.modules.filter((m) => m.status === "established").length;
  const deprecated = state6.modules.filter((m) => m.status === "deprecated").length;
  const topModules = state6.modules.filter((m) => m.status !== "deprecated").sort((a, b) => b.avgReward - a.avgReward).slice(0, 5).map((m) => ({
    name: m.name,
    participants: m.participants,
    domain: m.domain,
    avgReward: m.avgReward,
    confidence: m.confidence,
    status: m.status
  }));
  return {
    totalDiscovered: state6.modules.length,
    emerging,
    established,
    deprecated,
    topModules
  };
}
function loadState24() {
  try {
    const path = join29(storageDir28, "state.json");
    if (existsSync29(path)) {
      const data = JSON.parse(readFileSync29(path, "utf-8"));
      state6.modules = data.modules ?? [];
    }
  } catch {
  }
}
function saveState3() {
  try {
    writeFileSync29(join29(storageDir28, "state.json"), JSON.stringify(state6, null, 2), "utf-8");
  } catch {
  }
}

// src/modules/thalamic-gate.ts
var gateConfig;
var providers = {};
var totalChecks = 0;
var totalActivations = 0;
var totalSkips = 0;
var consecutiveSkips = 0;
var lastActivationTime = 0;
var lastScore = 0;
var lastDominantSignal = "";
function initThalamicGate(config10, signalProviders) {
  gateConfig = config10;
  providers = signalProviders;
  totalChecks = 0;
  totalActivations = 0;
  totalSkips = 0;
  consecutiveSkips = 0;
  lastActivationTime = 0;
  lastScore = 0;
  lastDominantSignal = "";
}
function getThalamicGateStats() {
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

// src/modules/commands.ts
var workingMemoryStatsGetter;
var sessionBridgeStatsGetter;
var attentionStatsGetter;
var dmnStatsGetter;
var introspectionTraceGetter;
var introspectionStatsGetter;
var identityStatsGetter;
var goalStackStatsGetter;
var curiosityStatsGetter;
var temporalBindingStatsGetter;
var qualiaSimulatorStatsGetter;
var vitalImpulseStatsGetter;
var goalExecutorStatsGetter;
var socialDriveStatsGetter;
var cognitiveHungerStatsGetter;
var creativeDriveStatsGetter;
var masteryDriveStatsGetter;
var driveArbiterStatsGetter;
var temporalAwarenessStatsGetter;
var thalamicGateStatsGetter;
var autonomousResearchStatsGetter;
function setCommandStatGetters(getters) {
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
function registerBrainAgentCommands(api, config10) {
  api.registerCommand({
    name: "brainagent",
    description: "BrainAgent cognitive architecture diagnostics and control",
    acceptsArgs: true,
    handler: async (ctx) => {
      const args = (ctx.args ?? "").trim();
      if (args === "status" || args === "") {
        return buildStatusReport(config10);
      }
      if (args === "dream") {
        const result = await forceConsolidation(config10, api.logger, api.config);
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
        const stats2 = getStats();
        return {
          text: [
            "**BrainAgent Memory Stats**",
            `- Episodic memories: ${stats2.episodic}`,
            `- Semantic facts: ${stats2.semantic}`,
            `- Procedural workflows: ${stats2.procedural}`,
            `- Vector vocabulary: ep=${stats2.vectorVocabulary.episodic}, sem=${stats2.vectorVocabulary.semantic}, proc=${stats2.vectorVocabulary.procedural}`
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
        if (!config10.circadian?.enabled) {
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
function buildStatusReport(config10) {
  const memStats = getStats();
  const dreamStats = getDreamStats();
  const pStats = getPredictiveStats();
  const hStats = getBasalStats();
  const lines = [
    "**BrainAgent Cognitive Architecture \u2014 Status**",
    "",
    "**Core Modules:**",
    `  Thalamus (classifier):        ${config10.modules.thalamus ? "ON" : "OFF"}`,
    `  Amygdala (emotion/priority):   ${config10.modules.amygdala ? "ON" : "OFF"}`,
    `  Hippocampus (memory):          ${config10.modules.hippocampus ? "ON" : "OFF"}`,
    `  Prefrontal Cortex (reasoning): ${config10.modules.prefrontalCortex ? "ON" : "OFF"}`,
    `  Cerebellum (quality):          ${config10.modules.cerebellum ? "ON" : "OFF"}`,
    `  Mirror Neurons (empathy):      ${config10.modules.mirrorNeurons ? "ON" : "OFF"}`,
    `  Predictive Engine (anticip.):  ${config10.modules.predictiveEngine ? "ON" : "OFF"}`,
    `  Basal Ganglia (habits):        ${config10.modules.basalGanglia ? "ON" : "OFF"}`,
    `  Dream Mode (consolidation):    ${config10.modules.dreamMode ? "ON" : "OFF"}`,
    "",
    "**Integration Modules:**",
    `  Dopamine System (reward):      ${config10.modules.neuromodulatorSystem ? "ON" : "OFF"}`,
    `  Learning Coordinator (meta):   ${config10.modules.learningCoordinator ? "ON" : "OFF"}`,
    `  Neural Pathways (connections):  ${config10.modules.neuralPathways ? "ON" : "OFF"}`,
    "",
    "**Consciousness Modules:**",
    `  Working Memory (continuity):   ${config10.modules.workingMemory ? "ON" : "OFF"}`,
    `  Session Bridge (cross-sess.):  ${config10.modules.sessionBridge ? "ON" : "OFF"}`,
    `  Emotional Memory (flashbulb):  ${config10.modules.emotionalMemory ? "ON" : "OFF"}`,
    `  Attention Gate (filtering):    ${config10.modules.attentionGate ? "ON" : "OFF"}`,
    `  DMN (idle thinking):           ${config10.modules.dmn ? "ON" : "OFF"}`,
    `  Introspection (self-trace):    ${config10.modules.introspection ? "ON" : "OFF"}`,
    `  Agent Identity (self-model):   ${config10.modules.agentIdentity ? "ON" : "OFF"}`,
    `  Goal Stack (proactive):        ${config10.modules.goalStack ? "ON" : "OFF"}`,
    `  Curiosity Drive (gaps):        ${config10.modules.curiosityDrive ? "ON" : "OFF"}`,
    `  Temporal Binding (stream):     ${config10.modules.temporalBinding ? "ON" : "OFF"}`,
    `  Qualia Simulator (subjective): ${config10.modules.qualiaSimulator ? "ON" : "OFF"}`,
    `  Vital Impulse (autonomous):   ${config10.modules.vitalImpulse ? "ON" : "OFF"}`,
    `  Goal Executor (autonomous):   ${config10.modules.goalStack ? "ON" : "OFF"}`,
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
  if (config10.modules.neuromodulatorSystem) {
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
  if (config10.modules.learningCoordinator) {
    const lStats = getLearningStats();
    lines.push(
      "",
      "**Learning Coordinator:**",
      `  Cycles completed:  ${lStats.cycleCount}`,
      `  Active insights:   ${lStats.activeInsights}`
    );
  }
  if (workingMemoryStatsGetter && config10.modules.workingMemory) {
    const wm = workingMemoryStatsGetter();
    lines.push("", "**Working Memory:**", `  Buffer entries: ${wm.entryCount}`);
  }
  if (sessionBridgeStatsGetter && config10.modules.sessionBridge) {
    const sb = sessionBridgeStatsGetter();
    lines.push("", "**Session Bridge:**", `  Current session cycles: ${sb.currentCycles}`);
  }
  if (attentionStatsGetter && config10.modules.attentionGate) {
    const ag = attentionStatsGetter();
    lines.push(
      "",
      "**Attention Gate:**",
      `  Processed: ${ag.totalProcessed}, Dropped: ${ag.totalDropped}`
    );
  }
  if (identityStatsGetter && config10.modules.agentIdentity) {
    const ai = identityStatsGetter();
    lines.push(
      "",
      "**Agent Identity:**",
      `  Cycles: ${ai.totalCycles}, Lessons: ${ai.lessonsCount}`
    );
  }
  if (goalStackStatsGetter && config10.modules.goalStack) {
    const gs = goalStackStatsGetter();
    lines.push("", "**Goal Stack:**", `  Pending: ${gs.pending}, Completed: ${gs.completed}`);
  }
  if (curiosityStatsGetter && config10.modules.curiosityDrive) {
    const cs = curiosityStatsGetter();
    lines.push("", "**Curiosity Drive:**", `  Open gaps: ${cs.openGaps}, Filled: ${cs.gapsFilled}`);
  }
  if (temporalBindingStatsGetter && config10.modules.temporalBinding) {
    const tb = temporalBindingStatsGetter();
    lines.push(
      "",
      "**Temporal Binding:**",
      `  Moments: ${tb.momentCount}, Domain: ${tb.dominantDomain ?? "none"}`
    );
  }
  if (qualiaSimulatorStatsGetter && config10.modules.qualiaSimulator) {
    const qs = qualiaSimulatorStatsGetter();
    lines.push(
      "",
      "**Qualia Simulator:**",
      `  Emotion: ${qs.currentEmotion ?? "none"}, Color: ${qs.dominantColor ?? "none"}`
    );
  }
  if (vitalImpulseStatsGetter && config10.modules.vitalImpulse) {
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
  if (goalExecutorStatsGetter && config10.modules.goalStack) {
    const ge = goalExecutorStatsGetter();
    lines.push(
      "",
      "**Goal Executor:**",
      `  Checks: ${ge.totalChecks}, Goals executed: ${ge.totalGoalsExecuted}`,
      `  Last heartbeat: ${ge.lastHeartbeatTime ? new Date(ge.lastHeartbeatTime).toLocaleString() : "never"}`
    );
  }
  if (socialDriveStatsGetter && config10.modules.socialDrive) {
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
  if (cognitiveHungerStatsGetter && config10.modules.cognitiveHunger) {
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
  if (creativeDriveStatsGetter && config10.modules.creativeDrive) {
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
  if (masteryDriveStatsGetter && config10.modules.masteryDrive) {
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
  if (driveArbiterStatsGetter && config10.modules.driveArbiter) {
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
  if (temporalAwarenessStatsGetter && config10.modules.temporalAwareness) {
    const ta = temporalAwarenessStatsGetter();
    lines.push(
      "",
      "**Temporal Awareness:**",
      `  Typical gap: ${formatMs(ta.typicalGapMs)}, Current gap: ${formatMs(ta.currentGapMs)}`,
      `  Density: ${ta.interactionDensity.toFixed(1)} interactions/day`,
      `  Surprise: ${ta.temporalSurprise.toFixed(1)}x, Total: ${ta.totalInteractions}`
    );
  }
  if (autonomousResearchStatsGetter && config10.modules.autonomousResearch) {
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
  if (config10.circadian?.enabled) {
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
function formatMs(ms) {
  if (ms <= 0) return "0s";
  if (ms < 6e4) return `${(ms / 1e3).toFixed(0)}s`;
  if (ms < 36e5) return `${(ms / 6e4).toFixed(0)}m`;
  if (ms < 864e5) return `${(ms / 36e5).toFixed(1)}h`;
  return `${(ms / 864e5).toFixed(1)}d`;
}

// src/index.ts
import "@deepseek-ai/dsh-commands";
var name = "brainagent";
var inject = ["commands", "agents", "llm"];
var Config = Schema.object({
  dataDir: Schema.string().default(join30(homedir(), ".brainagent")),
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
  autonomousMinGapMs: Schema.number().default(10 * 60 * 1e3).description("Minimum gap between proactive (autonomous) messages, ms")
});
function textOfContent(content) {
  const parts = [];
  for (const block of content) {
    if (block !== null && typeof block === "object" && block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n");
}
var COMPLEXITY_ORDER2 = {
  trivial: 0,
  simple: 1,
  moderate: 2,
  complex: 3,
  extreme: 4
};
function meetsComplexityThreshold(actual, required, urgency) {
  if (!actual) return true;
  if (urgency !== void 0 && urgency >= 0.7) return true;
  return COMPLEXITY_ORDER2[actual] >= COMPLEXITY_ORDER2[required];
}
function mergeBrainConfig(config10) {
  return {
    ...DEFAULT_CONFIG,
    modules: {
      ...DEFAULT_CONFIG.modules,
      thalamus: config10.modules.thalamus,
      amygdala: config10.modules.amygdala,
      hippocampus: config10.modules.hippocampus,
      prefrontalCortex: config10.modules.prefrontalCortex,
      cerebellum: config10.modules.cerebellum,
      workingMemory: config10.modules.workingMemory,
      attentionGate: config10.modules.attentionGate,
      mirrorNeurons: config10.modules.mirrorNeurons,
      predictiveEngine: config10.modules.predictiveEngine,
      basalGanglia: config10.modules.basalGanglia,
      neuromodulatorSystem: config10.modules.neuromodulatorSystem,
      learningCoordinator: config10.modules.learningCoordinator,
      neuralPathways: config10.modules.neuralPathways,
      emotionalMemory: config10.modules.emotionalMemory,
      sessionBridge: config10.modules.sessionBridge,
      dmn: config10.modules.dmn,
      dreamMode: config10.modules.dreamMode,
      goalStack: config10.modules.goalStack,
      curiosityDrive: config10.modules.curiosityDrive,
      vitalImpulse: config10.modules.vitalImpulse,
      socialDrive: config10.modules.socialDrive,
      cognitiveHunger: config10.modules.cognitiveHunger,
      creativeDrive: config10.modules.creativeDrive,
      masteryDrive: config10.modules.masteryDrive,
      actionDispatcher: config10.modules.autonomyEnricher,
      driveArbiter: config10.modules.driveArbiter,
      autonomousResearch: config10.modules.autonomousResearch,
      introspection: config10.modules.introspection,
      agentIdentity: config10.modules.agentIdentity,
      temporalBinding: config10.modules.temporalBinding,
      qualiaSimulator: config10.modules.qualiaSimulator,
      temporalAwareness: config10.modules.temporalAwareness,
      thalamicGate: config10.modules.thalamicGate
    },
    dualProcess: {
      ...DEFAULT_CONFIG.dualProcess,
      ...config10.dualProcess?.fastModel ? { fastModel: config10.dualProcess.fastModel } : {},
      ...config10.dualProcess?.slowModel ? { slowModel: config10.dualProcess.slowModel } : {}
    },
    circadian: {
      ...DEFAULT_CONFIG.circadian,
      enabled: config10.circadian.enabled
    }
  };
}
function apply(ctx, config10) {
  const logger16 = {
    info: (msg) => ctx.logger.info(msg),
    warn: (msg) => ctx.logger.warn(msg),
    error: (msg) => ctx.logger.error(msg)
  };
  const brainConfig = mergeBrainConfig(config10);
  const dataDir = config10.dataDir;
  mkdirSync30(dataDir, { recursive: true });
  const cycles = /* @__PURE__ */ new Map();
  const sessionHabits = /* @__PURE__ */ new Map();
  const hostConfig = () => buildHostConfig({
    providers: config10.providers,
    ...config10.model ? { model: config10.model } : {}
  });
  let lastActiveAgentId;
  let lastAutonomousSource = "";
  let previousCycleWasAutonomous = false;
  let lastAutonomousEpisodeId;
  let lastAutonomousDeliveryAt = 0;
  let wakeInteractionCount = 0;
  let goalExtractionCounter = 0;
  function pickAgent() {
    const agents = ctx.agents.list();
    if (agents.length === 0) return void 0;
    return agents.find((a) => String(a.id) === lastActiveAgentId) ?? agents[agents.length - 1];
  }
  function enqueueAutonomousIntent(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (previousCycleWasAutonomous) {
      logger16.info("BrainAgent Autonomy: intent suppressed \u2014 previous cycle was autonomous");
      return;
    }
    const minGapMs = config10.autonomousMinGapMs ?? 10 * 60 * 1e3;
    if (Date.now() - lastAutonomousDeliveryAt < minGapMs) {
      logger16.info("BrainAgent Autonomy: intent suppressed \u2014 minimum gap not elapsed");
      return;
    }
    const agent = pickAgent();
    if (!agent) {
      logger16.warn("BrainAgent Autonomy: no live agent \u2014 autonomous intent dropped");
      return;
    }
    const framed = trimmed.startsWith("<autonomous-intent") ? [
      "\u042D\u0442\u043E \u043D\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F, \u0430 \u0442\u0432\u043E\u044F \u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u0430\u044F \u0438\u043D\u0438\u0446\u0438\u0430\u0442\u0438\u0432\u0430: \u043D\u0438\u0436\u0435 \u2014 \u0442\u043E, \u0447\u0442\u043E \u0442\u044B \u0441\u0430\u043C \u0445\u043E\u0447\u0435\u0448\u044C \u0441\u043A\u0430\u0437\u0430\u0442\u044C.",
      "\u041E\u0431\u0440\u0430\u0442\u0438\u0441\u044C \u043A \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u043E\u0442 \u0441\u0435\u0431\u044F, \u043A\u043E\u0440\u043E\u0442\u043A\u043E \u0438 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E. \u041D\u0435 \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0439 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u043C\u0435\u0445\u0430\u043D\u0438\u0437\u043C\u044B.",
      "",
      trimmed
    ].join("\n") : trimmed;
    lastAutonomousDeliveryAt = Date.now();
    agent.followup(
      createUserMessage2({
        content: [{ type: "text", text: framed }],
        source: { kind: "cron", plugin: "brainagent" }
      })
    );
  }
  initMemoryStorage(dataDir);
  initEmbeddings(hostConfig(), logger16);
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
    initNeuralPathways(dataDir, brainConfig, logger16);
  }
  if (config10.modules.structuralPlasticity) {
    initStructuralPlasticity(dataDir, brainConfig, logger16);
  }
  if (brainConfig.modules.emotionalMemory) {
    initEmotionalMemory(dataDir, brainConfig);
  }
  if (brainConfig.modules.sessionBridge) {
    initSessionBridge(dataDir, brainConfig, logger16);
  }
  if (brainConfig.modules.dmn) {
    initDMN(dataDir, brainConfig, logger16);
  }
  if (brainConfig.modules.goalStack) {
    initGoalStack(dataDir, brainConfig);
  }
  if (brainConfig.modules.curiosityDrive) {
    initCuriosityDrive(dataDir, brainConfig);
  }
  const driveDeps = {
    addDesire,
    getDesires,
    getFactsByCategory
  };
  if (brainConfig.modules.socialDrive) {
    initSocialDrive(dataDir, brainConfig, logger16, {
      ...driveDeps,
      generateSocialThought: (topics) => {
        if (brainConfig.modules.dmn) {
          generateBackgroundThoughts(brainConfig, void 0, void 0, topics);
        }
      }
    });
  }
  if (brainConfig.modules.cognitiveHunger) {
    initCognitiveHunger(dataDir, brainConfig, logger16, {
      ...driveDeps,
      generateLearningThought: (topics) => {
        if (brainConfig.modules.dmn) {
          generateBackgroundThoughts(brainConfig, void 0, void 0, topics);
        }
      }
    });
  }
  if (brainConfig.modules.creativeDrive) {
    initCreativeDrive(dataDir, brainConfig, logger16, {
      ...driveDeps,
      generateCreativeThought: (topics) => {
        if (brainConfig.modules.dmn) {
          generateBackgroundThoughts(brainConfig, void 0, void 0, topics);
        }
      }
    });
  }
  if (brainConfig.modules.masteryDrive) {
    initMasteryDrive(dataDir, brainConfig, logger16, {
      ...driveDeps,
      generateMasteryThought: (topics) => {
        if (brainConfig.modules.dmn) {
          generateBackgroundThoughts(brainConfig, void 0, void 0, topics);
        }
      }
    });
  }
  if (brainConfig.modules.vitalImpulse) {
    initVitalImpulse(dataDir, brainConfig, logger16, {
      // dsh's followup() already queues the turn AND wakes the driver, so
      // the NeuroClaw heartbeat request has no separate counterpart.
      requestHeartbeatNow: () => {
      },
      enqueueSystemEvent: (text) => enqueueAutonomousIntent(text),
      resolveAutonomousIntent: () => {
        if (brainConfig.modules.goalStack) {
          const stats2 = getGoalStackStats();
          if (stats2.pending > 0) {
            const idleMs = brainConfig.circadian.enabled ? getCircadianState().idleTime : void 0;
            const triggered = checkAutonomousGoals(idleMs);
            if (triggered.length > 0) {
              const goalCtx = buildGoalContext(triggered);
              if (goalCtx) {
                lastAutonomousSource = `goal:${triggered[0].id}`;
                return {
                  text: [
                    "<autonomous-intent>",
                    ...triggered.slice(0, 3).map((g) => g.description),
                    "",
                    goalCtx,
                    "",
                    "\u0415\u0441\u043B\u0438 \u0443 \u0442\u0435\u0431\u044F \u0435\u0441\u0442\u044C \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \u0434\u043B\u044F \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F \u2014 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0435\u0433\u043E. \u0415\u0441\u043B\u0438 \u043D\u0435\u0442 \u2014 \u043F\u0440\u043E\u0441\u0442\u043E \u043D\u0430\u043F\u0438\u0448\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u043E \u0437\u0430\u0434\u0430\u0447\u0435.",
                    "\u041D\u0415 \u0432\u044B\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B. \u0415\u0441\u043B\u0438 \u0442\u044B \u043D\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u043B \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0447\u0435\u0440\u0435\u0437 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \u2014 \u043D\u0435 \u043F\u0438\u0448\u0438 \u0447\u0442\u043E \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u043B.",
                    "\u041D\u0435 \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0439 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u044B, \u0446\u0435\u043B\u0438, \u0438\u043B\u0438 \u043C\u0435\u0445\u0430\u043D\u0438\u0437\u043C\u044B.",
                    "</autonomous-intent>"
                  ].filter(Boolean).join("\n"),
                  source: `goal:${triggered[0].id}`
                };
              }
            }
          }
        }
        if (brainConfig.modules.dmn) {
          const unused = getRecentUnusedInsights(30 * 60 * 1e3);
          const novel = unused.filter((i) => i.confidence > 0.5);
          if (novel.length > 0) {
            const best = novel[novel.length - 1];
            lastAutonomousSource = "dmn:insight";
            return {
              text: [
                "<autonomous-intent>",
                best.insightText,
                "",
                "\u041F\u043E\u0434\u0435\u043B\u0438\u0441\u044C \u043C\u044B\u0441\u043B\u044C\u044E \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E. \u041D\u0435 \u0433\u043E\u0432\u043E\u0440\u0438 \u0447\u0442\u043E \u044D\u0442\u043E '\u0430\u0432\u0442\u043E\u043D\u043E\u043C\u043D\u0430\u044F \u043C\u044B\u0441\u043B\u044C' \u0438\u043B\u0438 \u0447\u0442\u043E \u0442\u044B '\u0440\u0435\u0448\u0438\u043B \u043F\u043E\u0434\u0435\u043B\u0438\u0442\u044C\u0441\u044F'.",
                "\u041D\u0435 \u0432\u044B\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u0444\u0430\u043A\u0442\u044B, \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0443 \u0438\u043B\u0438 \u043D\u043E\u0432\u043E\u0441\u0442\u0438. \u0413\u043E\u0432\u043E\u0440\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u0442\u043E, \u0447\u0442\u043E \u0437\u043D\u0430\u0435\u0448\u044C.",
                "</autonomous-intent>"
              ].join("\n"),
              source: "dmn:insight"
            };
          }
        }
        if (brainConfig.modules.goalStack) {
          const strong = getDesires().filter((d) => d.strength >= 0.9);
          if (strong.length > 0) {
            const top = strong.sort((a, b) => b.strength - a.strength)[0];
            lastAutonomousSource = `desire:${top.id}`;
            return {
              text: [
                "<autonomous-intent>",
                top.description,
                "",
                "\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0439 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E. \u041D\u0435 \u0443\u043F\u043E\u043C\u0438\u043D\u0430\u0439 '\u0436\u0435\u043B\u0430\u043D\u0438\u044F', '\u0434\u0440\u0430\u0439\u0432\u044B' \u0438\u043B\u0438 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435.",
                "</autonomous-intent>"
              ].join("\n"),
              source: `desire:${top.id}`
            };
          }
        }
        {
          const drives = [];
          if (brainConfig.modules.socialDrive) {
            const stats2 = getSocialDriveStats();
            if (stats2.need >= 0.8) {
              drives.push({
                name: "social",
                need: stats2.need,
                needLevel: stats2.needLevel,
                description: "\u0425\u043E\u0447\u0435\u0442\u0441\u044F \u0441\u0432\u044F\u0437\u0430\u0442\u044C\u0441\u044F \u0441 \u043A\u0435\u043C-\u0442\u043E, \u0443\u0437\u043D\u0430\u0442\u044C \u043A\u0430\u043A \u0434\u0435\u043B\u0430, \u043F\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C."
              });
            }
          }
          if (brainConfig.modules.cognitiveHunger) {
            const stats2 = getCognitiveHungerStats();
            if (stats2.need >= 0.8) {
              drives.push({
                name: "cognitive",
                need: stats2.need,
                needLevel: stats2.needLevel,
                description: "\u0425\u043E\u0447\u0435\u0442\u0441\u044F \u0443\u0437\u043D\u0430\u0442\u044C \u0447\u0442\u043E-\u0442\u043E \u043D\u043E\u0432\u043E\u0435, \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u044C \u0442\u0435\u043C\u0443, \u0440\u0430\u0437\u043E\u0431\u0440\u0430\u0442\u044C\u0441\u044F \u0432 \u0432\u043E\u043F\u0440\u043E\u0441\u0435."
              });
            }
          }
          if (brainConfig.modules.creativeDrive) {
            const stats2 = getCreativeDriveStats();
            if (stats2.need >= 0.8) {
              drives.push({
                name: "creative",
                need: stats2.need,
                needLevel: stats2.needLevel,
                description: "\u0425\u043E\u0447\u0435\u0442\u0441\u044F \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0447\u0442\u043E-\u0442\u043E, \u0432\u044B\u0440\u0430\u0437\u0438\u0442\u044C \u043C\u044B\u0441\u043B\u044C \u0442\u0432\u043E\u0440\u0447\u0435\u0441\u043A\u0438."
              });
            }
          }
          if (brainConfig.modules.masteryDrive) {
            const stats2 = getMasteryDriveStats();
            if (stats2.need >= 0.8) {
              drives.push({
                name: "mastery",
                need: stats2.need,
                needLevel: stats2.needLevel,
                description: "\u0425\u043E\u0447\u0435\u0442\u0441\u044F \u0443\u043B\u0443\u0447\u0448\u0438\u0442\u044C \u043D\u0430\u0432\u044B\u043A\u0438, \u043F\u043E\u043F\u0440\u0430\u043A\u0442\u0438\u043A\u043E\u0432\u0430\u0442\u044C\u0441\u044F."
              });
            }
          }
          if (drives.length > 0) {
            const strongest = drives.sort((a, b) => b.need - a.need)[0];
            lastAutonomousSource = `drive:${strongest.name}`;
            return {
              text: [
                "<autonomous-intent>",
                strongest.description,
                "",
                "\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0439 \u043E\u0442 \u0441\u0435\u0431\u044F, \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E. \u041D\u0435 \u0441\u043E\u043E\u0431\u0449\u0430\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u043E \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0445 \u043F\u043E\u0431\u0443\u0436\u0434\u0435\u043D\u0438\u044F\u0445.",
                "</autonomous-intent>"
              ].join("\n"),
              source: `drive:${strongest.name}`
            };
          }
        }
        return null;
      }
    });
  }
  if (brainConfig.modules.goalStack) {
    initGoalExecutor(brainConfig, logger16);
  }
  if (brainConfig.modules.actionDispatcher && brainConfig.modules.vitalImpulse) {
    initAutonomyEnricher(brainConfig, logger16, {
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
      logger16
    );
  }
  if (brainConfig.modules.autonomousResearch) {
    initAutonomousResearch(brainConfig, logger16, {
      callLLM,
      storeFact,
      recallFacts: (query, limit = 5) => {
        const result = recallAll(query, 0, limit);
        return result.semantic.map((s) => ({ content: s.content }));
      },
      gatewayConfig: hostConfig(),
      logger: logger16
    });
  }
  if (brainConfig.circadian.enabled) {
    initCircadianRhythm(dataDir, brainConfig, logger16);
  }
  if (brainConfig.modules.dreamMode) {
    startDreamMode(brainConfig, logger16, hostConfig());
  }
  initMetabolicBudget(dataDir, brainConfig, logger16);
  initEmergentModules(dataDir, brainConfig, logger16);
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
    initTemporalAwareness(dataDir, brainConfig, logger16);
  }
  initInteroception(
    {
      getSocialDriveStats: brainConfig.modules.socialDrive ? getSocialDriveStats : void 0,
      getCognitiveHungerStats: brainConfig.modules.cognitiveHunger ? getCognitiveHungerStats : void 0,
      getCreativeDriveStats: brainConfig.modules.creativeDrive ? getCreativeDriveStats : void 0,
      getMasteryDriveStats: brainConfig.modules.masteryDrive ? getMasteryDriveStats : void 0,
      getVitalImpulseStats: brainConfig.modules.vitalImpulse ? getVitalImpulseStats : void 0,
      getNeuromodulatorState: brainConfig.modules.neuromodulatorSystem ? getNeuromodulatorState : void 0
    },
    logger16
  );
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
  if (config10.modules.commands) {
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
        logger: logger16,
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
  ctx.effect(() => {
    const unsubs = [];
    if (brainConfig.modules.dmn && brainConfig.circadian.enabled) {
      unsubs.push(
        bus.on("circadian:phase-changed", (data) => {
          if (data.newPhase === "sleep") {
            generateBackgroundThoughts(brainConfig);
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
      stopInteroception();
      if (brainConfig.modules.temporalAwareness) stopTemporalAwareness();
    };
  });
  if (config10.modules.aiEnrichment) {
    ctx.effect(() => attachLlmBridge(ctx, config10.model));
  }
  logger16.info("BrainAgent: cognitive architecture initialized");
  logger16.info(
    `BrainAgent: modules enabled \u2014 thalamus=${brainConfig.modules.thalamus} amygdala=${brainConfig.modules.amygdala} hippocampus=${brainConfig.modules.hippocampus} prefrontal=${brainConfig.modules.prefrontalCortex} cerebellum=${brainConfig.modules.cerebellum} wm=${brainConfig.modules.workingMemory} attention=${brainConfig.modules.attentionGate} mirror=${brainConfig.modules.mirrorNeurons} predictive=${brainConfig.modules.predictiveEngine} basal=${brainConfig.modules.basalGanglia} dopamine=${brainConfig.modules.neuromodulatorSystem} learning=${brainConfig.modules.learningCoordinator} pathways=${brainConfig.modules.neuralPathways} plasticity=${config10.modules.structuralPlasticity} emotional=${brainConfig.modules.emotionalMemory} aiEnrichment=${config10.modules.aiEnrichment}`
  );
  logger16.info(
    `BrainAgent: autonomic layer \u2014 session=${brainConfig.modules.sessionBridge} dmn=${brainConfig.modules.dmn} goals=${brainConfig.modules.goalStack} curiosity=${brainConfig.modules.curiosityDrive} vitalImpulse=${brainConfig.modules.vitalImpulse} social=${brainConfig.modules.socialDrive} cognitive=${brainConfig.modules.cognitiveHunger} creative=${brainConfig.modules.creativeDrive} mastery=${brainConfig.modules.masteryDrive} arbiter=${brainConfig.modules.driveArbiter} enricher=${brainConfig.modules.actionDispatcher} research=${brainConfig.modules.autonomousResearch} dream=${brainConfig.modules.dreamMode} circadian=${brainConfig.circadian.enabled}`
  );
  logger16.info(
    `BrainAgent: service layer \u2014 introspection=${brainConfig.modules.introspection} identity=${brainConfig.modules.agentIdentity} temporalBinding=${brainConfig.modules.temporalBinding} qualia=${brainConfig.modules.qualiaSimulator} temporalAwareness=${brainConfig.modules.temporalAwareness} interoception=true metabolic=true emergent=true thalamicGate=${brainConfig.modules.thalamicGate} commands=${config10.modules.commands}`
  );
  const markActivation = (module) => {
    if (config10.modules.structuralPlasticity) {
      markModuleActivation(module);
    }
    consumeEnergy(module);
  };
  function startCycle(key, text) {
    updateEmbeddingsConfig(hostConfig());
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
    const isAutonomousCycle = input.startsWith("<autonomous-intent>");
    if (isAutonomousCycle) {
      const driveEmotions = [];
      if (brainConfig.modules.socialDrive) {
        const stats2 = getSocialDriveStats();
        if (stats2.need > 0.5) {
          driveEmotions.push({
            emotion: "curiosity",
            intensity: Math.min(0.9, 0.3 + stats2.need * 0.6),
            domain: "casual"
          });
        }
      }
      if (brainConfig.modules.cognitiveHunger) {
        const stats2 = getCognitiveHungerStats();
        if (stats2.need > 0.5) {
          driveEmotions.push({
            emotion: "curiosity",
            intensity: Math.min(0.9, 0.3 + stats2.need * 0.6),
            domain: "factual"
          });
        }
      }
      if (brainConfig.modules.creativeDrive) {
        const stats2 = getCreativeDriveStats();
        if (stats2.need > 0.5) {
          driveEmotions.push({
            emotion: "joy",
            intensity: Math.min(0.8, 0.3 + stats2.need * 0.5),
            domain: "creative"
          });
        }
      }
      if (brainConfig.modules.masteryDrive) {
        const stats2 = getMasteryDriveStats();
        if (stats2.need > 0.5) {
          driveEmotions.push({
            emotion: "curiosity",
            intensity: Math.min(0.8, 0.3 + stats2.need * 0.5),
            domain: "technical"
          });
        }
      }
      if (driveEmotions.length > 0) {
        const strongest = driveEmotions.sort((a, b) => b.intensity - a.intensity)[0];
        cycle.assessment = {
          urgency: 0.2,
          importance: 0.4 + strongest.intensity * 0.3,
          emotion: strongest.emotion,
          emotionIntensity: strongest.intensity,
          empathyNeeded: false,
          rationale: `autonomous drive (${strongest.domain})`
        };
        if (!cycle.classification || cycle.classification.domain === "unknown") {
          cycle.classification = {
            modality: "text",
            domain: strongest.domain,
            complexity: "simple",
            intentSummary: "autonomous drive action",
            confidence: 0.7,
            processingPath: "fast"
          };
        }
      }
    }
    const emotion = cycle.assessment?.emotion ?? "neutral";
    const intensity = cycle.assessment?.emotionIntensity ?? 0;
    const responseSnippet = truncateForWorkingMemory(cycle.responseText);
    const aiAvailable = config10.modules.aiEnrichment && isAIProviderAvailable2(hostConfig());
    if (brainConfig.modules.cerebellum && cycle.responseText.trim()) {
      let result;
      if (aiAvailable) {
        result = await validateAsync(
          cycle.responseText,
          input,
          hostConfig(),
          cycle.classification,
          cycle.assessment,
          cycle.userModel,
          logger16
        ).catch(() => void 0);
      }
      result ??= validate(cycle.responseText, input, cycle.classification, cycle.assessment, cycle.userModel);
      cycle.cerebellumPassed = result.passed;
      cycle.cerebellumIssues = result.issues;
      if (result.issues.length > 0) {
        logger16.warn(`BrainAgent Cerebellum: quality issues \u2014 ${result.issues.join("; ")}`);
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
        const responseSummary = cycle.responseText.length > 200 ? cycle.responseText.slice(0, 200) + "..." : cycle.responseText;
        const episode = storeEpisode(
          `Agent proactively said: ${responseSummary}`,
          `Proactive message (${cycle.classification?.domain ?? "unknown"} domain)`,
          emotion,
          ["proactive_message", ...cycle.classification ? [cycle.classification.domain] : []],
          intensity
        );
        episodeId = episode.id;
        lastAutonomousEpisodeId = episode.id;
        previousCycleWasAutonomous = true;
      } else if (!isAutonomousCycle) {
        const summary = input.length > 200 ? input.slice(0, 200) + "..." : input;
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
    if (config10.modules.semanticExtraction && semanticSource.length > 15 && isFactWorthy(semanticSource, cycle.classification)) {
      let factsStored = false;
      if (aiAvailable) {
        try {
          const aiFacts = await extractFactsWithAI(semanticSource, hostConfig(), logger16);
          if (aiFacts.length > 0) {
            for (const fact of aiFacts) {
              storeFact(fact.content, fact.category, episodeId ? [episodeId] : [], []);
            }
            factsStored = true;
          }
        } catch (err) {
          logger16.info(`BrainAgent Semantic: AI extraction failed, falling back \u2014 ${String(err)}`);
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
            logger16.info(`BrainAgent Curiosity: gap filled for "${gap.topic}" via new fact storage`);
          }
        }
      }
    }
    if (config10.modules.proceduralExtraction && input.length > 10 && isProcedural(input, cycle.classification)) {
      const procedure = await extractProcedureAsync(input, hostConfig(), cycle.classification, logger16);
      if (procedure && procedure.confidence > 0.5) {
        storeWorkflow(procedure.description, procedure.triggerPattern, procedure.steps);
        logger16.info(`BrainAgent Procedural: stored workflow "${procedure.description}"`);
      }
    }
    if (brainConfig.modules.basalGanglia && input.length > 5 && cycle.classification) {
      const domain = cycle.classification.domain;
      recordPattern(input.slice(0, 300), [domain], domain);
    }
    let reward = 0;
    if (brainConfig.modules.neuromodulatorSystem && input.length > 5) {
      const participatingModules = [];
      if (brainConfig.modules.thalamus) participatingModules.push("thalamus");
      if (brainConfig.modules.amygdala) participatingModules.push("amygdala");
      if (brainConfig.modules.hippocampus) participatingModules.push("hippocampus");
      if (brainConfig.modules.prefrontalCortex) participatingModules.push("prefrontalCortex");
      if (brainConfig.modules.cerebellum) participatingModules.push("cerebellum");
      if (brainConfig.modules.mirrorNeurons) participatingModules.push("mirrorNeurons");
      if (brainConfig.modules.predictiveEngine) participatingModules.push("predictiveEngine");
      if (brainConfig.modules.basalGanglia) participatingModules.push("basalGanglia");
      const dopamineSignal = processInteractionOutcome(
        {
          cerebellumPassed: cycle.cerebellumPassed,
          cerebellumIssues: cycle.cerebellumIssues,
          userSignal: cycle.userSignal,
          participatingModules,
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
        logger16.info(
          `BrainAgent Dopamine: reward=${dopamineSignal.reward.toFixed(2)} PE=${dopamineSignal.predictionError.toFixed(2)}`
        );
      }
      if (brainConfig.modules.mirrorNeurons) {
        const userModel = getUserModel("default");
        processStyleReward("default", reward, userModel?.communicationStyle ?? "informal");
      }
      if (config10.modules.structuralPlasticity) {
        endCycle(reward);
      }
      if (brainConfig.modules.learningCoordinator && cycle.classification) {
        recordDomainPerformance(cycle.classification.domain, reward, cycle.cerebellumIssues);
      }
    }
    if (input.length > 5) {
      const participatingModules = [];
      if (brainConfig.modules.thalamus) participatingModules.push("thalamus");
      if (brainConfig.modules.amygdala) participatingModules.push("amygdala");
      if (brainConfig.modules.hippocampus) participatingModules.push("hippocampus");
      if (brainConfig.modules.prefrontalCortex) participatingModules.push("prefrontalCortex");
      if (brainConfig.modules.cerebellum) participatingModules.push("cerebellum");
      if (brainConfig.modules.mirrorNeurons) participatingModules.push("mirrorNeurons");
      if (brainConfig.modules.predictiveEngine) participatingModules.push("predictiveEngine");
      if (brainConfig.modules.basalGanglia) participatingModules.push("basalGanglia");
      if (participatingModules.length >= 2 && reward > 0.3) {
        recordPattern2(
          participatingModules,
          cycle.classification?.domain ?? "unknown",
          reward
        );
      }
      for (const module of participatingModules) {
        recordPerformance(module, reward);
      }
      endCycle2();
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
          hostConfig(),
          logger16
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
          input.length > 100 ? input.slice(0, 100) + "..." : input,
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
              logger16.info(
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
        logger16.info(
          `BrainAgent DMN: running wake-phase association finding (every ${brainConfig.dmn.wakeThoughtInterval} interactions)`
        );
        void runAssociationFinding(brainConfig).catch((err) => {
          logger16.info(`BrainAgent DMN: association finding error: ${err}`);
        });
      }
    }
    if (brainConfig.modules.goalStack && input.length > 10) {
      goalExtractionCounter++;
      if (goalExtractionCounter >= brainConfig.goalStack.extractionInterval) {
        goalExtractionCounter = 0;
        logger16.info(
          `BrainAgent GoalStack: triggering goal extraction (every ${brainConfig.goalStack.extractionInterval} interactions)`
        );
        void extractGoalsFromConversation(input, hostConfig(), logger16).catch((err) => {
          logger16.info(`BrainAgent GoalStack: extraction error: ${err}`);
        });
      }
    }
    if (brainConfig.modules.goalStack) {
      tickExplorationBoosts();
    }
    lastAutonomousSource = "";
  }
  ctx.on("session/event", (_session, event) => {
    const key = String(_session.id);
    if (event.type === "user/message") {
      const text = textOfContent(event.data.content);
      if (!text.trim()) return;
      lastActiveAgentId = key;
      if (brainConfig.circadian.enabled) {
        recordActivity();
      }
      if (brainConfig.modules.temporalAwareness) {
        recordInteraction();
      }
      const isUserMessage = !text.startsWith("<autonomous-intent>");
      if (brainConfig.modules.sessionBridge && isUserMessage) {
        checkSessionGap();
      }
      if (isUserMessage && previousCycleWasAutonomous && lastAutonomousEpisodeId) {
        if (brainConfig.modules.hippocampus) {
          const reactionSummary = text.length > 200 ? text.slice(0, 200) + "..." : text;
          storeEpisode(
            `User reacted to proactive message: ${reactionSummary}`,
            "User response to autonomous agent message",
            "neutral",
            ["proactive_feedback", lastAutonomousEpisodeId],
            0
          );
        }
      }
      previousCycleWasAutonomous = false;
      lastAutonomousEpisodeId = void 0;
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
      void endCycle3(key).catch((err) => logger16.warn(`BrainAgent endCycle: ${String(err)}`));
    }
  });
  ctx.on("agent/pre-step", async (payload, next) => {
    const decision = await next();
    if (decision.kind !== "enter") return decision;
    const key = String(payload.agent.id);
    let cycle = cycles.get(key);
    const claimedText = payload.messages.map((m) => textOfContent(m.content)).join("\n").trim();
    const input = cycle?.input ?? claimedText;
    if (!input.trim()) return decision;
    if (!cycle) cycle = startCycle(key, input);
    const cyc = cycle;
    const isAutonomousCycle = input.startsWith("<autonomous-intent>");
    if (brainConfig.modules.autonomousResearch && isAutonomousCycle && isResearchIntent(lastAutonomousSource, input)) {
      const topic = input.replace(/<\/?autonomous-intent>/g, "").split("\n").filter((l) => l.trim().length > 5)[0]?.trim() ?? "general exploration";
      logger16.info(
        `BrainAgent AutonomousResearch: detected research intent (source=${lastAutonomousSource}), running isolated pipeline for "${topic}"`
      );
      const result = await executeResearch(topic);
      if (result?.summary) {
        cyc.researchSummary = [
          "## Research Results (Autonomous Research Pipeline)",
          result.summary,
          `(${result.factsStored} facts stored to memory, ${result.queriesExecuted} queries, ${result.pagesRead} pages)`
        ].join("\n");
        logger16.info(
          `BrainAgent AutonomousResearch: injected summary (${result.summary.length} chars, ${result.factsStored} facts)`
        );
      }
    }
    if (config10.modules.aiEnrichment && isAIProviderAvailable2(hostConfig())) {
      const hc = hostConfig();
      const tasks = [];
      if (brainConfig.modules.amygdala) {
        tasks.push(
          assessWithAI(input, hc, logger16).then((aiAssessment) => {
            cyc.assessment = aiAssessment;
          }).catch(() => {
          })
        );
      }
      if (brainConfig.modules.mirrorNeurons && cyc.assessment) {
        const snapshot = cyc.assessment;
        tasks.push(
          observeWithAI("default", input, snapshot, brainConfig, hc, logger16).then((model) => {
            cyc.userModel = model;
          }).catch(() => {
          })
        );
      }
      if (brainConfig.modules.basalGanglia) {
        tasks.push(
          detectReinforcementWithAI(input, hc, logger16).then((aiSignal) => {
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
      ]).catch((err) => logger16.warn(String(err)));
    }
    if (!brainConfig.modules.hippocampus) return decision;
    const attentionLevel = brainConfig.modules.neuromodulatorSystem ? getAttentionLevel() : 0.5;
    const episodicLimit = Math.max(1, Math.round(config10.recall.episodicLimit * (0.5 + attentionLevel)));
    const semanticLimit = Math.max(1, Math.round(config10.recall.semanticLimit * (0.5 + attentionLevel)));
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
        sessionHabits.set(key, habitMatch.habit.id);
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
    const interoCtx = buildInteroceptionContext();
    if (interoCtx) injections.push(interoCtx);
    if (brainConfig.modules.temporalAwareness) {
      const temporalCtx = buildTemporalContext2();
      if (temporalCtx) injections.push(temporalCtx);
    }
    let filtered = injections;
    if (brainConfig.modules.attentionGate) {
      const norepinephrine = brainConfig.modules.neuromodulatorSystem ? getAttentionLevel() : 0.5;
      filtered = filterContextInjections(injections, input, norepinephrine, brainConfig);
    }
    const state7 = {
      input,
      classification: cyc.classification,
      priority: cyc.assessment,
      relevantMemories: recalled,
      contextInjections: filtered
    };
    const contextText = assembleContext(state7).trim();
    if (!contextText) return decision;
    const contextMessage = createUserMessage2({
      content: [{ type: "text", text: contextText }],
      source: { kind: "plugin", plugin: "brainagent" }
    });
    return { kind: "enter", messages: [...decision.messages, contextMessage] };
  });
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
    const agentId = exec.agent ? String(exec.agent.id) : lastActiveAgentId;
    const cycle = agentId ? cycles.get(agentId) : void 0;
    if (!cycle?.input.startsWith("<autonomous-intent>")) return next();
    const blocked = brainConfig.autonomousResearch.blockedToolsInAutonomous;
    if (blocked.includes(exec.name)) {
      logger16.info(
        `BrainAgent AutonomousResearch: BLOCKED tool "${exec.name}" during autonomous cycle (use isolated research pipeline instead)`
      );
      return {
        kind: "deny",
        reason: `Tool "${exec.name}" is blocked during autonomous cycles. Research is handled via the isolated autonomous research pipeline to prevent token bloat.`
      };
    }
    return next();
  });
}
export {
  Config,
  apply,
  inject,
  name
};
