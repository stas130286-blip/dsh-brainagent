/**
 * BrainAgent — Plugin configuration surface.
 *
 * Everything that maps the raw dsh plugin `config` into the internal
 * `BrainAgentConfig` (merged over DEFAULT_CONFIG) lives here, together
 * with small pure helpers shared by the cycle engine and the autonomy
 * layer (message text extraction, complexity gating).
 *
 * Kept free of runtime dependencies on the dsh context so it can be
 * unit-tested and reused outside `apply()`.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import Schema from "@deepseek-ai/schemastery";
import { DEFAULT_CONFIG } from "../modules/types.ts";
import type { BrainAgentConfig, MessageComplexity } from "../modules/types.ts";

export interface Config {
  /** Where BrainAgent persists its memory stores. */
  dataDir: string;
  /** Model for internal LLM enrichment, "provider/model" form. */
  model?: string;
  /** Explicit provider credentials (otherwise read from env vars). */
  providers: Record<string, { apiKey?: string; baseUrl?: string }>;
  /** Cognitive module flags. */
  modules: {
    thalamus: boolean;
    amygdala: boolean;
    hippocampus: boolean;
    prefrontalCortex: boolean;
    cerebellum: boolean;
    workingMemory: boolean;
    attentionGate: boolean;
    mirrorNeurons: boolean;
    predictiveEngine: boolean;
    basalGanglia: boolean;
    neuromodulatorSystem: boolean;
    learningCoordinator: boolean;
    neuralPathways: boolean;
    structuralPlasticity: boolean;
    emotionalMemory: boolean;
    semanticExtraction: boolean;
    proceduralExtraction: boolean;
    aiEnrichment: boolean;
    sessionBridge: boolean;
    dmn: boolean;
    goalStack: boolean;
    curiosityDrive: boolean;
    vitalImpulse: boolean;
    socialDrive: boolean;
    cognitiveHunger: boolean;
    creativeDrive: boolean;
    masteryDrive: boolean;
    driveArbiter: boolean;
    autonomyEnricher: boolean;
    autonomousResearch: boolean;
    dreamMode: boolean;
    introspection: boolean;
    agentIdentity: boolean;
    temporalBinding: boolean;
    qualiaSimulator: boolean;
    temporalAwareness: boolean;
    thalamicGate: boolean;
    /** Metabolic Budget (energy-based resource allocation) */
    metabolicBudget: boolean;
    /** Emergent Modules (recurring co-activation patterns) */
    emergentModules: boolean;
    /** Interoception (holistic inner-state sensing) */
    interoception: boolean;
    /** Proactive Feedback (обучение на «не зашло») */
    proactiveFeedback: boolean;
    commands: boolean;
  };
  /** Circadian rhythm (sleep-wake cycles). */
  circadian: { enabled: boolean };
  /** Dual-process model routing (System 1 / System 2). */
  dualProcess?: {
    fastModel?: string;
    slowModel?: string;
  };
  /** Recall limits for prompt enrichment. */
  recall: {
    episodicLimit: number;
    semanticLimit: number;
  };
  /** Prompt-injection volume budget for diagnostics & attention-gate tuning. */
  contextInjection: { maxChars: number };
  /** Learning loop: reward ledger + strategy bandit (RL-lite). */
  learningLoop: {
    rewardLedger: { enabled: boolean; maxEntries: number };
    strategyBandit: {
      enabled: boolean;
      explorationConstant: number;
      attributionWindowMs: number;
    };
  };
  /** Minimum gap between proactive (autonomous) messages, ms. */
  autonomousMinGapMs: number;
}

export const Config: Schema<Config> = Schema.object({
  dataDir: Schema.string().default(join(homedir(), ".brainagent")),
  model: Schema.string().description("Model for internal LLM enrichment (provider/model form)"),
  providers: Schema.dict(
    Schema.object({
      apiKey: Schema.string(),
      baseUrl: Schema.string(),
    }),
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
    dmn: Schema.boolean().default(true).description("Default Mode Network — idle background thinking"),
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
    metabolicBudget: Schema.boolean().default(true).description("Metabolic budget — energy-based resource allocation"),
    emergentModules: Schema.boolean().default(true).description("Emergent modules — recurring co-activation patterns"),
    interoception: Schema.boolean().default(true).description("Interoception — holistic inner-state sensing"),
    proactiveFeedback: Schema.boolean().default(true).description("Proactive feedback — learning from rejected proactive messages"),
    commands: Schema.boolean().default(true).description("/brain diagnostics command"),
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
    commands: true,
  }),
  circadian: Schema.object({
    enabled: Schema.boolean().default(true).description("Sleep-wake cycle simulation"),
  }).default({ enabled: true }),
  dualProcess: Schema.object({
    fastModel: Schema.string().description("System 1 fast model (provider/model)"),
    slowModel: Schema.string().description("System 2 slow model (provider/model)"),
  }),
  recall: Schema.object({
    episodicLimit: Schema.number().default(3),
    semanticLimit: Schema.number().default(5),
  }).default({ episodicLimit: 3, semanticLimit: 5 }),
  contextInjection: Schema.object({
    maxChars: Schema.number()
      .default(12_000)
      .description("Over-budget warning threshold for assembled prompt-injection chars"),
  }).default({ maxChars: 12_000 }),
  learningLoop: Schema.object({
    rewardLedger: Schema.object({
      enabled: Schema.boolean().default(true),
      maxEntries: Schema.number().default(500),
    }).default({ enabled: true, maxEntries: 500 }),
    strategyBandit: Schema.object({
      enabled: Schema.boolean().default(true),
      explorationConstant: Schema.number().default(1.4),
      attributionWindowMs: Schema.number().default(5 * 60 * 1000),
    }).default({ enabled: true, explorationConstant: 1.4, attributionWindowMs: 5 * 60 * 1000 }),
  }).default({
    rewardLedger: { enabled: true, maxEntries: 500 },
    strategyBandit: { enabled: true, explorationConstant: 1.4, attributionWindowMs: 5 * 60 * 1000 },
  }),
  autonomousMinGapMs: Schema.number()
    .default(10 * 60 * 1000)
    .description("Minimum gap between proactive (autonomous) messages, ms"),
});

/**
 * Merge user-supplied flags/overrides onto the full default config.
 *
 * The plugin `modules` flags map onto `BrainAgentConfig.modules` almost
 * 1:1. The only renames/skips are:
 *  - `autonomyEnricher` (plugin) → `actionDispatcher` (brain config);
 *  - `structuralPlasticity`, `semanticExtraction`, `proceduralExtraction`,
 *    `aiEnrichment`, `commands` have no brain-config counterpart and are
 *    consumed directly from the plugin config by `apply()`.
 */
const MODULE_FLAG_MAP: Record<string, keyof BrainAgentConfig["modules"]> = {
  autonomyEnricher: "actionDispatcher",
};

export function mergeBrainConfig(config: Config): BrainAgentConfig {
  const modules: BrainAgentConfig["modules"] = { ...DEFAULT_CONFIG.modules };
  for (const [key, value] of Object.entries(config.modules)) {
    if (typeof value !== "boolean") continue;
    const target = MODULE_FLAG_MAP[key] ?? (key as keyof BrainAgentConfig["modules"]);
    if (target in modules) modules[target] = value;
  }
  return {
    ...DEFAULT_CONFIG,
    modules,
    dualProcess: {
      ...DEFAULT_CONFIG.dualProcess,
      ...(config.dualProcess?.fastModel ? { fastModel: config.dualProcess.fastModel } : {}),
      ...(config.dualProcess?.slowModel ? { slowModel: config.dualProcess.slowModel } : {}),
    },
    circadian: {
      ...DEFAULT_CONFIG.circadian,
      enabled: config.circadian.enabled,
    },
    contextInjection: {
      ...DEFAULT_CONFIG.contextInjection,
      ...config.contextInjection,
    },
    learningLoop: {
      rewardLedger: {
        ...DEFAULT_CONFIG.learningLoop.rewardLedger,
        ...(config.learningLoop?.rewardLedger ?? {}),
      },
      strategyBandit: {
        ...DEFAULT_CONFIG.learningLoop.strategyBandit,
        ...(config.learningLoop?.strategyBandit ?? {}),
      },
    },
  };
}

/**
 * Marker tag wrapping autonomous (self-initiated) messages. The model
 * sees the tag in its log; the plugin uses it to tell autonomous cycles
 * apart from real user messages.
 */
export const AUTONOMOUS_TAG = "<autonomous-intent>";
/**
 * Prefix check used when framing deliveries: matches both the plain tag
 * and tagged variants with attributes ("<autonomous-intent source=...>").
 */
export const AUTONOMOUS_TAG_PREFIX = "<autonomous-intent";

/** Extract plain text from an LLM message content block list. */
export function textOfContent(content: readonly unknown[]): string {
  const parts: string[] = [];
  for (const block of content) {
    if (
      block !== null &&
      typeof block === "object" &&
      (block as { type?: unknown }).type === "text" &&
      typeof (block as { text?: unknown }).text === "string"
    ) {
      parts.push((block as { text: string }).text);
    }
  }
  return parts.join("\n");
}

// Token economy: complexity ordering for LLM-call gating.
const COMPLEXITY_ORDER: Record<MessageComplexity, number> = {
  trivial: 0,
  simple: 1,
  moderate: 2,
  complex: 3,
  extreme: 4,
};

/**
 * Token economy gate: does this cycle's complexity warrant an LLM call?
 * High urgency always passes, so important short messages like "help!"
 * are never skipped.
 */
export function meetsComplexityThreshold(
  actual: MessageComplexity | undefined,
  required: MessageComplexity,
  urgency?: number,
): boolean {
  if (!actual) return true;
  if (urgency !== undefined && urgency >= 0.7) return true;
  return COMPLEXITY_ORDER[actual] >= COMPLEXITY_ORDER[required];
}

/** Truncate a long text to a bounded summary suffix, if needed. */
export function truncateText(text: string, maxLength = 200): string {
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}
