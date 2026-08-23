/**
 * BrainAgent — DeepSeek Harness plugin entry point (Cordis).
 *
 * Port of the NeuroClaw cognitive architecture. Wiring map:
 *
 * ┌────────────────────────────────────────────────────────────────────┐
 * │  session/event user/message    → cycle start:                      │
 * │                                  Thalamus classify, Amygdala       │
 * │                                  assess, Mirror user model,        │
 * │                                  Predictive observation, Basal     │
 * │                                  reinforcement detection           │
 * │  agent/pre-step (waterfall)    → LLM enrichment (via ctx.llm       │
 * │                                  bridge), Hippocampus recall,      │
 * │                                  anticipation + habit + neuro-     │
 * │                                  modulator context injections      │
 * │  agent/request (waterfall)     → Prefrontal dual-process model     │
 * │                                  switch (System 1 / System 2)      │
 * │  session/event assistant/message → response capture                │
 * │  session/event turn/end        → Cerebellum validation, episodic/  │
 * │                                  semantic/procedural storage,      │
 * │                                  dopamine reward distribution,     │
 * │                                  emotional tagging, working memory │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Concurrency: all per-cycle state lives in a Map keyed by SessionId,
 * never in module-level globals — parallel sessions cannot bleed into
 * each other.
 */

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import Schema from "@deepseek-ai/schemastery";
import type { Agent, PreStepDecision } from "@deepseek-ai/dsh-agent";
import { createUserMessage, type LlmCallConfig } from "@deepseek-ai/dsh-llm";
import type { Session, SessionEvent, UserMessage } from "@deepseek-ai/dsh-session";

import { buildHostConfig } from "./modules/host-config.ts";
import { bus } from "./modules/event-bus.ts";
import { DEFAULT_CONFIG } from "./modules/types.ts";
import type {
  AmygdalaAssessment,
  BrainAgentConfig,
  BrainState,
  EmotionLabel,
  Goal,
  MessageComplexity,
  MessageDomain,
  ModuleName,
  ThalamusClassification,
  UserModel,
} from "./modules/types.ts";
import { classify } from "./modules/thalamus.ts";
import { assess } from "./modules/amygdala.ts";
import {
  initMemoryStorage,
  initEmbeddings,
  updateEmbeddingsConfig,
  recallAll,
  recallAllAsync,
  storeEpisode,
  storeFact,
  storeWorkflow,
  getFactsByCategory,
} from "./modules/hippocampus.ts";
import {
  initWorkingMemoryStorage,
  storeCompletedCycle,
  buildWorkingMemoryContext,
  truncateForWorkingMemory,
} from "./modules/working-memory.ts";
import { initAttentionGate, filterContextInjections } from "./modules/attention-gate.ts";
import { assembleContext, decideProcessingPath } from "./modules/prefrontal-cortex.ts";
import { validate, validateAsync } from "./modules/cerebellum.ts";
import { assessWithAI } from "./modules/amygdala.ts";
import {
  initMirrorStorage,
  observe,
  observeWithAI,
  getUserModel,
  processStyleReward,
  getStyleRecommendation,
} from "./modules/mirror-neurons.ts";
import { initPredictiveStorage, observeInteraction, predict } from "./modules/predictive-engine.ts";
import {
  initBasalStorage,
  detectReinforcement,
  detectReinforcementWithAI,
  findHabit,
  reinforce,
  recordPattern,
  buildHabitContext,
} from "./modules/basal-ganglia.ts";
import {
  initDopamineSystem,
  processInteractionOutcome,
  getAttentionLevel,
  getNeuromodulatorState,
} from "./modules/dopamine-system.ts";
import {
  initLearningCoordinator,
  buildLearningContext,
  buildCapabilityContext,
  recordDomainPerformance,
  recordRecurringIssue,
} from "./modules/learning-coordinator.ts";
import {
  initNeuralPathways,
  resetCycleState,
  buildNeuromodulatorContext,
} from "./modules/neural-pathways.ts";
import {
  initStructuralPlasticity,
  markModuleActivation,
  endCycle as endStructuralCycle,
} from "./modules/structural-plasticity.ts";
import { initEmotionalMemory, tagEmotionalContext } from "./modules/emotional-memory.ts";
import { extractFacts, isFactWorthy } from "./modules/semantic-extractor.ts";
import { extractFactsWithAI, isAIProviderAvailable } from "./modules/ai-extractor.ts";
import { extractProcedureAsync, isProcedural } from "./modules/procedural-extractor.ts";
import { attachLlmBridge } from "./adapter/llm-bridge.ts";
import { callLLM } from "./modules/llm-client.ts";
import {
  initSessionBridge,
  checkSessionGap,
  buildSessionBridgeContext,
  recordCycleForSession,
} from "./modules/session-bridge.ts";
import {
  initDMN,
  generateBackgroundThoughts,
  runAssociationFinding,
  buildBackgroundThoughtContext,
  getRecentUnusedInsights,
} from "./modules/dmn.ts";
import {
  initGoalStack,
  addDesire,
  getDesires,
  expireGoals,
  checkGoalTriggers,
  checkAutonomousGoals,
  buildGoalContext,
  buildVolitionContext,
  getGoalStackStats,
  weakenDesiresAfterFire,
  satisfyDesiresOnUserResponse,
  tickExplorationBoosts,
  extractGoalsFromConversation,
} from "./modules/goal-stack.ts";
import {
  initCuriosityDrive,
  detectKnowledgeGap,
  buildCuriosityContext,
  getOpenGaps,
  markGapFilled,
} from "./modules/curiosity-drive.ts";
import { initSocialDrive, stopSocialDrive, getSocialDriveStats } from "./modules/social-drive.ts";
import {
  initCognitiveHunger,
  stopCognitiveHunger,
  getCognitiveHungerStats,
} from "./modules/cognitive-hunger.ts";
import {
  initCreativeDrive,
  stopCreativeDrive,
  getCreativeDriveStats,
} from "./modules/creative-drive.ts";
import {
  initMasteryDrive,
  stopMasteryDrive,
  getMasteryDriveStats,
} from "./modules/mastery-drive.ts";
import { initDriveArbiter, stopDriveArbiter, buildArbiterContext } from "./modules/drive-arbiter.ts";
import {
  initVitalImpulse,
  stopVitalImpulse,
  resetConsecutiveFires,
  consumeMotivation,
  type AutonomousIntent,
} from "./modules/vital-impulse.ts";
import { initGoalExecutor, stopGoalExecutor } from "./modules/goal-executor.ts";
import { initAutonomyEnricher, stopAutonomyEnricher } from "./modules/autonomy-enricher.ts";
import {
  initAutonomousResearch,
  stopAutonomousResearch,
  isResearchIntent,
  executeResearch,
} from "./modules/autonomous-research.ts";
import { startDreamMode, stopDreamMode } from "./modules/dream-mode.ts";
import {
  initCircadianRhythm,
  stopCircadianRhythm,
  recordActivity,
  getCircadianState,
} from "./modules/circadian-rhythm.ts";
import {
  initIntrospection,
  startTrace,
  addTraceStep,
  completeTrace,
  buildConfidenceContext,
  getLastTrace,
  getIntrospectionStats,
  reflectOnConsciousness,
} from "./modules/introspection.ts";
import {
  initAgentIdentity,
  recordDomainOutcome,
  buildIdentityContext,
  buildMemorySelfKnowledgeContext,
  getAgentIdentityStats,
  recordSignificantExperience,
} from "./modules/agent-identity.ts";
import {
  initTemporalBinding,
  createMoment,
  buildTemporalContext,
  getTemporalBindingStats,
} from "./modules/temporal-binding.ts";
import { initQualiaSimulator, generateQualiaState, buildQualiaContext, getQualiaSimulatorStats } from "./modules/qualia-simulator.ts";
import {
  initTemporalAwareness,
  stopTemporalAwareness,
  recordInteraction,
  getTemporalAwarenessStats,
  buildTemporalContext as buildTemporalAwarenessContext,
} from "./modules/temporal-awareness.ts";
import {
  initInteroception,
  stopInteroception,
  getInteroceptiveState,
  buildInteroceptionContext,
} from "./modules/interoception.ts";
import {
  getSuppressedDomainHints,
  initProactiveFeedback,
  isDomainSuppressed,
  recordProactiveReaction,
  stopProactiveFeedback,
} from "./modules/proactive-feedback.ts";
import {
  initMetabolicBudget,
  consumeEnergy,
  recordPerformance,
  endCycle as endMetabolicCycle,
} from "./modules/metabolic-budget.ts";
import { initEmergentModules, recordPattern as recordEmergentPattern } from "./modules/emergent-modules.ts";
import { recordInjectionCycle } from "./modules/injection-metrics.ts";
import { initThalamicGate, getThalamicGateStats } from "./modules/thalamic-gate.ts";
import { generateQualiaAsync } from "./modules/emotional-memory.ts";
import { getWorkingMemoryStats } from "./modules/working-memory.ts";
import { getSessionBridgeStats } from "./modules/session-bridge.ts";
import { getAttentionStats } from "./modules/attention-gate.ts";
import { getDMNStats } from "./modules/dmn.ts";
import { getCuriosityStats } from "./modules/curiosity-drive.ts";
import { getVitalImpulseStats } from "./modules/vital-impulse.ts";
import { getGoalExecutorStats } from "./modules/goal-executor.ts";
import { getDriveArbiterStats } from "./modules/drive-arbiter.ts";
import { getAutonomousResearchStats } from "./modules/autonomous-research.ts";
import { getSatiation as getSocialDriveSatiation } from "./modules/social-drive.ts";
import { getCognitiveHungerSatiation } from "./modules/cognitive-hunger.ts";
import { getCreativeDriveSatiation } from "./modules/creative-drive.ts";
import { getMasteryAggregateSatiation } from "./modules/mastery-drive.ts";
import { registerBrainAgentCommands, setCommandStatGetters } from "./modules/commands.ts";
// Importing the tools package pulls in its `tools/pre-execute` event augmentation.
import type { PreToolDecision } from "@deepseek-ai/dsh-tools";
// Importing the commands package pulls in the `ctx.commands` service augmentation.
import "@deepseek-ai/dsh-commands";

// Proactive BrainAgent impulses ride a plugin-defined message source kind
// (MessageSourceMap is merge-extensible by design).
declare module "@deepseek-ai/dsh-llm" {
  interface MessageSourceMap {
    cron: { kind: "cron"; plugin: string };
  }
}

// ── Plugin metadata & configuration ─────────────────────────────────

export const name = "brainagent";

// Cordis service dependencies: `commands` (registered at apply time),
// `agents` (proactive delivery in timers) and `llm` (enrichment bridge).
export const inject = ["commands", "agents", "llm"];

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
  autonomousMinGapMs: Schema.number()
    .default(10 * 60 * 1000)
    .description("Minimum gap between proactive (autonomous) messages, ms"),
});

// ── Per-session cycle state (replaces the old global mutable state) ──

type CycleState = {
  input: string;
  classification?: ThalamusClassification;
  assessment?: AmygdalaAssessment;
  userModel?: UserModel;
  /** Basal ganglia reinforcement signal detected from the user text. */
  userSignal: "positive" | "negative" | "neutral";
  /** A matched habit auto-executed during context assembly. */
  habitAutoExecuted: boolean;
  /** Cerebellum validation outcome (filled at turn end). */
  cerebellumPassed: boolean;
  cerebellumIssues: string[];
  responseText: string;
  recalledMemoryIds: string[];
  startedAt: number;
  /** Goals triggered by the user message at cycle start. */
  triggeredGoals: Goal[];
  /** Compact summary from the isolated autonomous research pipeline. */
  researchSummary?: string;
  /** Intrinsic reward flags collected during the cycle. */
  insightUsed: boolean;
  goalCompleted: boolean;
  curiosityGapClosed: boolean;
};

// ── Helpers ─────────────────────────────────────────────────────────

/** Extract plain text from an LLM message content block list. */
function textOfContent(content: readonly unknown[]): string {
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
function meetsComplexityThreshold(
  actual: MessageComplexity | undefined,
  required: MessageComplexity,
  urgency?: number,
): boolean {
  if (!actual) return true;
  if (urgency !== undefined && urgency >= 0.7) return true;
  return COMPLEXITY_ORDER[actual] >= COMPLEXITY_ORDER[required];
}

/** Merge user-supplied flags/overrides onto the full default config. */
function mergeBrainConfig(config: Config): BrainAgentConfig {
  return {
    ...DEFAULT_CONFIG,
    modules: {
      ...DEFAULT_CONFIG.modules,
      thalamus: config.modules.thalamus,
      amygdala: config.modules.amygdala,
      hippocampus: config.modules.hippocampus,
      prefrontalCortex: config.modules.prefrontalCortex,
      cerebellum: config.modules.cerebellum,
      workingMemory: config.modules.workingMemory,
      attentionGate: config.modules.attentionGate,
      mirrorNeurons: config.modules.mirrorNeurons,
      predictiveEngine: config.modules.predictiveEngine,
      basalGanglia: config.modules.basalGanglia,
      neuromodulatorSystem: config.modules.neuromodulatorSystem,
      learningCoordinator: config.modules.learningCoordinator,
      neuralPathways: config.modules.neuralPathways,
      emotionalMemory: config.modules.emotionalMemory,
      sessionBridge: config.modules.sessionBridge,
      dmn: config.modules.dmn,
      dreamMode: config.modules.dreamMode,
      goalStack: config.modules.goalStack,
      curiosityDrive: config.modules.curiosityDrive,
      vitalImpulse: config.modules.vitalImpulse,
      socialDrive: config.modules.socialDrive,
      cognitiveHunger: config.modules.cognitiveHunger,
      creativeDrive: config.modules.creativeDrive,
      masteryDrive: config.modules.masteryDrive,
      actionDispatcher: config.modules.autonomyEnricher,
      driveArbiter: config.modules.driveArbiter,
      autonomousResearch: config.modules.autonomousResearch,
      introspection: config.modules.introspection,
      agentIdentity: config.modules.agentIdentity,
      temporalBinding: config.modules.temporalBinding,
      qualiaSimulator: config.modules.qualiaSimulator,
      temporalAwareness: config.modules.temporalAwareness,
      thalamicGate: config.modules.thalamicGate,
      metabolicBudget: config.modules.metabolicBudget,
      emergentModules: config.modules.emergentModules,
      interoception: config.modules.interoception,
      proactiveFeedback: config.modules.proactiveFeedback,
    },
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
  };
}

// ── Plugin entry ────────────────────────────────────────────────────

export function apply(ctx: Context, config: Config) {
  const logger = {
    info: (msg: string) => ctx.logger.info(msg),
    warn: (msg: string) => ctx.logger.warn(msg),
    error: (msg: string) => ctx.logger.error(msg),
  };

  const brainConfig = mergeBrainConfig(config);
  const dataDir = config.dataDir;
  mkdirSync(dataDir, { recursive: true });

  const cycles = new Map<string, CycleState>();
  // Habit matched in cycle N is reinforced by the user's next message (N+1).
  const sessionHabits = new Map<string, string | undefined>();

  const hostConfig = () =>
    buildHostConfig({
      providers: config.providers,
      ...(config.model ? { model: config.model } : {}),
    });

  // ── Autonomy: proactive delivery ──────────────────────────────
  // NeuroClaw's enqueueSystemEvent/requestHeartbeatNow pair maps to a
  // single Agent.followup() with a cron-sourced UserMessage — the dsh
  // driver wakes on the queued turn and the message lands in the
  // durable session log ("model-visible means logged").
  let lastActiveAgentId: string | undefined;
  let lastAutonomousSource = "";
  let previousCycleWasAutonomous = false;
  let lastAutonomousEpisodeId: string | undefined;
  let lastAutonomousDomain = "unknown";
  let lastAutonomousDeliveryAt = 0;
  let wakeInteractionCount = 0;
  let goalExtractionCounter = 0;

  function pickAgent(): Agent | undefined {
    const agents = ctx.agents.list();
    if (agents.length === 0) return undefined;
    return (
      agents.find((a) => String(a.id) === lastActiveAgentId) ?? agents[agents.length - 1]
    );
  }

  function enqueueAutonomousIntent(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return; // never deliver an empty impulse
    // Loop breaker: after an autonomous turn the agent stays silent until
    // the human returns — otherwise the turn's own learning signals keep
    // re-firing the impulse and the chat fills with cron soliloquies.
    if (previousCycleWasAutonomous) {
      logger.info("BrainAgent Autonomy: intent suppressed — previous cycle was autonomous");
      return;
    }
    // Minimum gap between proactive messages (default 10 min).
    const minGapMs = config.autonomousMinGapMs ?? 10 * 60 * 1000;
    if (Date.now() - lastAutonomousDeliveryAt < minGapMs) {
      logger.info("BrainAgent Autonomy: intent suppressed — minimum gap not elapsed");
      return;
    }
    // «Не зашло»: темы, которые пользователь отверг, не заводим (v0.2.0).
    if (brainConfig.modules.proactiveFeedback) {
      const intentDomain = classify(trimmed).domain;
      if (isDomainSuppressed(intentDomain)) {
        logger.info(
          `BrainAgent Autonomy: intent suppressed — domain ${intentDomain} was rejected`,
        );
        return;
      }
    }
    const agent = pickAgent();
    if (!agent) {
      logger.warn("BrainAgent Autonomy: no live agent — autonomous intent dropped");
      return;
    }
    // The dsh stock agent has no prior knowledge of <autonomous-intent>
    // markers (NeuroClaw's host prompt framed them) — frame the delivery
    // explicitly so the model speaks on its own instead of looking for a task.
    const rejectionHints = brainConfig.modules.proactiveFeedback
      ? getSuppressedDomainHints()
      : [];
    const framed = trimmed.startsWith("<autonomous-intent")
      ? [
          "Это не сообщение пользователя, а твоя собственная инициатива: ниже — то, что ты сам хочешь сказать.",
          "Обратись к пользователю от себя, коротко и естественно. Не описывай внутренние механизмы.",
          ...(rejectionHints.length > 0
            ? [`Не заводи темы, которые пользователю не зашли: ${rejectionHints.join("; ")}.`]
            : []),
          "",
          trimmed,
        ].join("\n")
      : trimmed;
    lastAutonomousDeliveryAt = Date.now();
    agent.followup(
      createUserMessage({
        content: [{ type: "text", text: framed }],
        source: { kind: "cron", plugin: "brainagent" },
      }),
    );
  }

  // ── Initialize storage layers ───────────────────────────────
  initMemoryStorage(dataDir);
  initEmbeddings(hostConfig(), logger);
  if (brainConfig.modules.workingMemory) {
    initWorkingMemoryStorage(dataDir, brainConfig);
  }
  if (brainConfig.modules.attentionGate) {
    initAttentionGate(dataDir, brainConfig);
  }

  // ── Phase 2: learning & empathy layers ───────────────────────────
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

  // ── Phase 3: autonomic layer ─────────────────────────────────
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

  const driveDeps = {
    addDesire,
    getDesires,
    getFactsByCategory,
  };
  if (brainConfig.modules.socialDrive) {
    initSocialDrive(dataDir, brainConfig, logger, {
      ...driveDeps,
      generateSocialThought: (topics) => {
        if (brainConfig.modules.dmn) {
          generateBackgroundThoughts(brainConfig, undefined, undefined, topics);
        }
      },
    });
  }
  if (brainConfig.modules.cognitiveHunger) {
    initCognitiveHunger(dataDir, brainConfig, logger, {
      ...driveDeps,
      generateLearningThought: (topics) => {
        if (brainConfig.modules.dmn) {
          generateBackgroundThoughts(brainConfig, undefined, undefined, topics);
        }
      },
    });
  }
  if (brainConfig.modules.creativeDrive) {
    initCreativeDrive(dataDir, brainConfig, logger, {
      ...driveDeps,
      generateCreativeThought: (topics) => {
        if (brainConfig.modules.dmn) {
          generateBackgroundThoughts(brainConfig, undefined, undefined, topics);
        }
      },
    });
  }
  if (brainConfig.modules.masteryDrive) {
    initMasteryDrive(dataDir, brainConfig, logger, {
      ...driveDeps,
      generateMasteryThought: (topics) => {
        if (brainConfig.modules.dmn) {
          generateBackgroundThoughts(brainConfig, undefined, undefined, topics);
        }
      },
    });
  }

  if (brainConfig.modules.vitalImpulse) {
    initVitalImpulse(dataDir, brainConfig, logger, {
      // dsh's followup() already queues the turn AND wakes the driver, so
      // the NeuroClaw heartbeat request has no separate counterpart.
      requestHeartbeatNow: () => {},
      enqueueSystemEvent: (text) => enqueueAutonomousIntent(text),
      resolveAutonomousIntent: (): AutonomousIntent | null => {
        // Like a person asking themselves: "Do I actually have something
        // to say, or am I just restless?" Only reach out when there's
        // concrete content — a goal to act on, an insight to share,
        // or a strong specific desire.

        // 1. Social goals with recurring intervals (user asked the agent
        //    to do something periodically, e.g. "check the forum")
        if (brainConfig.modules.goalStack) {
          const stats = getGoalStackStats();
          if (stats.pending > 0) {
            const idleMs = brainConfig.circadian.enabled
              ? getCircadianState().idleTime
              : undefined;
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
                    "Если у тебя есть инструмент для выполнения — используй его. Если нет — просто напиши пользователю о задаче.",
                    "НЕ выдумывай результаты. Если ты не выполнил действие через инструмент — не пиши что выполнил.",
                    "Не описывай внутренние процессы, цели, или механизмы.",
                    "</autonomous-intent>",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                  source: `goal:${triggered[0].id}`,
                };
              }
            }
          }
        }

        // 2. Novel DMN insights worth sharing
        if (brainConfig.modules.dmn) {
          const unused = getRecentUnusedInsights(30 * 60 * 1000); // last 30 min
          const novel = unused.filter((i) => i.confidence > 0.5);
          if (novel.length > 0) {
            const best = novel[novel.length - 1];
            lastAutonomousSource = "dmn:insight";
            return {
              text: [
                "<autonomous-intent>",
                best.insightText,
                "",
                "Поделись мыслью естественно. Не говори что это 'автономная мысль' или что ты 'решил поделиться'.",
                "Не выдумывай факты, статистику или новости. Говори только то, что знаешь.",
                "</autonomous-intent>",
              ].join("\n"),
              source: "dmn:insight",
            };
          }
        }

        // 3. Strong specific desires (not generic urges)
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
                "Действуй естественно. Не упоминай 'желания', 'драйвы' или внутреннее состояние.",
                "</autonomous-intent>",
              ].join("\n"),
              source: `desire:${top.id}`,
            };
          }
        }

        // 4. Biological drives at strong+ level
        {
          const drives: Array<{
            name: string;
            need: number;
            needLevel: string;
            description: string;
          }> = [];

          if (brainConfig.modules.socialDrive) {
            const stats = getSocialDriveStats();
            if (stats.need >= 0.8) {
              drives.push({
                name: "social",
                need: stats.need,
                needLevel: stats.needLevel,
                description: "Хочется связаться с кем-то, узнать как дела, поговорить.",
              });
            }
          }
          if (brainConfig.modules.cognitiveHunger) {
            const stats = getCognitiveHungerStats();
            if (stats.need >= 0.8) {
              drives.push({
                name: "cognitive",
                need: stats.need,
                needLevel: stats.needLevel,
                description:
                  "Хочется узнать что-то новое, исследовать тему, разобраться в вопросе.",
              });
            }
          }
          if (brainConfig.modules.creativeDrive) {
            const stats = getCreativeDriveStats();
            if (stats.need >= 0.8) {
              drives.push({
                name: "creative",
                need: stats.need,
                needLevel: stats.needLevel,
                description: "Хочется создать что-то, выразить мысль творчески.",
              });
            }
          }
          if (brainConfig.modules.masteryDrive) {
            const stats = getMasteryDriveStats();
            if (stats.need >= 0.8) {
              drives.push({
                name: "mastery",
                need: stats.need,
                needLevel: stats.needLevel,
                description: "Хочется улучшить навыки, попрактиковаться.",
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
                "Действуй от себя, естественно. Не сообщай пользователю о внутренних побуждениях.",
                "</autonomous-intent>",
              ].join("\n"),
              source: `drive:${strongest.name}`,
            };
          }
        }

        // Nothing specific → stay quiet, enrich responses when user talks
        return null;
      },
    });
  }

  // Goal Executor: closes the autonomy loop (goals fire without user input).
  if (brainConfig.modules.goalStack) {
    initGoalExecutor(brainConfig, logger);
  }

  // Autonomy Enricher: memory-driven motivation enrichment.
  if (brainConfig.modules.actionDispatcher && brainConfig.modules.vitalImpulse) {
    initAutonomyEnricher(brainConfig, logger, {
      recallMemories: (query, episodicLimit, semanticLimit) => {
        const result = recallAll(query, episodicLimit, semanticLimit);
        return { episodic: result.episodic, semantic: result.semantic };
      },
      getDesires,
      enqueueSystemEvent: (text) => enqueueAutonomousIntent(text),
    });
  }

  // Drive Arbiter: intelligent arbitration between competing drives.
  if (brainConfig.modules.driveArbiter) {
    initDriveArbiter(
      dataDir,
      brainConfig,
      {
        getSocialDriveStats: brainConfig.modules.socialDrive ? getSocialDriveStats : undefined,
        getCognitiveHungerStats: brainConfig.modules.cognitiveHunger
          ? getCognitiveHungerStats
          : undefined,
        getCreativeDriveStats: brainConfig.modules.creativeDrive
          ? getCreativeDriveStats
          : undefined,
        getMasteryDriveStats: brainConfig.modules.masteryDrive ? getMasteryDriveStats : undefined,
        getUserModel: brainConfig.modules.mirrorNeurons ? () => getUserModel("default") : undefined,
        getInteroceptivePattern: () => getInteroceptiveState()?.pattern ?? null,
      },
      logger,
    );
  }

  // Autonomous Research: isolated web research pipeline.
  if (brainConfig.modules.autonomousResearch) {
    initAutonomousResearch(brainConfig, logger, {
      callLLM,
      storeFact,
      recallFacts: (query: string, limit = 5) => {
        const result = recallAll(query, 0, limit);
        return result.semantic.map((s) => ({ content: s.content }));
      },
      gatewayConfig: hostConfig(),
      logger,
    });
  }

  // Circadian rhythm: sleep-wake cycles.
  if (brainConfig.circadian.enabled) {
    initCircadianRhythm(dataDir, brainConfig, logger);
  }

  // Dream Mode: background memory consolidation (own interval timer).
  if (brainConfig.modules.dreamMode) {
    startDreamMode(brainConfig, logger, hostConfig());
  }

  // ── Phase 4: service & consciousness layers ─────────────────

  // Metabolic Budget: energy-based resource allocation.
  if (brainConfig.modules.metabolicBudget) {
    initMetabolicBudget(dataDir, brainConfig, logger);
  }

  // Emergent modules: recurring co-activation pattern discovery.
  if (brainConfig.modules.emergentModules) {
    initEmergentModules(dataDir, brainConfig, logger);
  }

  // Proactive Feedback: обучение на «не зашло» для автономных сообщений.
  if (brainConfig.modules.proactiveFeedback) {
    initProactiveFeedback(dataDir, brainConfig, logger);
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

  // Interoception: holistic inner-state sensing. Subscribes to the
  // dopamine reward + vital impulse bus events by itself.
  if (brainConfig.modules.interoception) {
    initInteroception(
      {
        getSocialDriveStats: brainConfig.modules.socialDrive ? getSocialDriveStats : undefined,
        getCognitiveHungerStats: brainConfig.modules.cognitiveHunger
          ? getCognitiveHungerStats
          : undefined,
        getCreativeDriveStats: brainConfig.modules.creativeDrive
          ? getCreativeDriveStats
          : undefined,
        getMasteryDriveStats: brainConfig.modules.masteryDrive ? getMasteryDriveStats : undefined,
        getVitalImpulseStats: brainConfig.modules.vitalImpulse ? getVitalImpulseStats : undefined,
        getNeuromodulatorState: brainConfig.modules.neuromodulatorSystem
          ? getNeuromodulatorState
          : undefined,
      },
      logger,
    );
  }

  // Thalamic Gate: activation-threshold stats. In dsh there are no
  // interval heartbeats — every cycle is user- or event-driven and
  // always passes — so the gate is initialized for diagnostics only.
  if (brainConfig.modules.thalamicGate) {
    initThalamicGate(brainConfig.thalamicGate, {
      getVitalImpulseStats: brainConfig.modules.vitalImpulse ? getVitalImpulseStats : undefined,
      getAmygdalaAssessment: () => {
        const last = [...cycles.values()].at(-1);
        return last?.assessment;
      },
      getNeuromodulatorState: brainConfig.modules.neuromodulatorSystem
        ? getNeuromodulatorState
        : undefined,
      getSocialDriveSatiation: brainConfig.modules.socialDrive
        ? getSocialDriveSatiation
        : undefined,
      getCognitiveHungerSatiation: brainConfig.modules.cognitiveHunger
        ? getCognitiveHungerSatiation
        : undefined,
      getCreativeDriveSatiation: brainConfig.modules.creativeDrive
        ? getCreativeDriveSatiation
        : undefined,
      getMasteryDriveSatiation: brainConfig.modules.masteryDrive
        ? getMasteryAggregateSatiation
        : undefined,
      getGoalStackStats: brainConfig.modules.goalStack ? getGoalStackStats : undefined,
      getDMNStats: brainConfig.modules.dmn
        ? () => {
            const unused = getRecentUnusedInsights(30 * 60 * 1000);
            return { unusedInsightCount: unused.length };
          }
        : undefined,
    });
  }

  // Diagnostics command (/brain status|dream|memory|...) + stat getters.
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
            },
          });
        },
        logger,
        config: hostConfig(),
      },
      brainConfig,
    );
    setCommandStatGetters({
      workingMemory: brainConfig.modules.workingMemory ? getWorkingMemoryStats : undefined,
      sessionBridge: brainConfig.modules.sessionBridge ? getSessionBridgeStats : undefined,
      attention: brainConfig.modules.attentionGate ? getAttentionStats : undefined,
      dmn: brainConfig.modules.dmn ? getDMNStats : undefined,
      introspectionTrace: brainConfig.modules.introspection ? getLastTrace : undefined,
      introspectionStats: brainConfig.modules.introspection ? getIntrospectionStats : undefined,
      identity: brainConfig.modules.agentIdentity ? getAgentIdentityStats : undefined,
      goalStack: brainConfig.modules.goalStack ? getGoalStackStats : undefined,
      curiosity: brainConfig.modules.curiosityDrive ? getCuriosityStats : undefined,
      temporalBinding: brainConfig.modules.temporalBinding ? getTemporalBindingStats : undefined,
      qualiaSimulator: brainConfig.modules.qualiaSimulator ? getQualiaSimulatorStats : undefined,
      vitalImpulse: brainConfig.modules.vitalImpulse ? getVitalImpulseStats : undefined,
      goalExecutor: brainConfig.modules.goalStack ? getGoalExecutorStats : undefined,
      socialDrive: brainConfig.modules.socialDrive ? getSocialDriveStats : undefined,
      cognitiveHunger: brainConfig.modules.cognitiveHunger ? getCognitiveHungerStats : undefined,
      creativeDrive: brainConfig.modules.creativeDrive ? getCreativeDriveStats : undefined,
      masteryDrive: brainConfig.modules.masteryDrive ? getMasteryDriveStats : undefined,
      driveArbiter: brainConfig.modules.driveArbiter ? getDriveArbiterStats : undefined,
      temporalAwareness: brainConfig.modules.temporalAwareness
        ? getTemporalAwarenessStats
        : undefined,
      thalamicGate: brainConfig.modules.thalamicGate ? getThalamicGateStats : undefined,
      autonomousResearch: brainConfig.modules.autonomousResearch
        ? getAutonomousResearchStats
        : undefined,
    });
  }

  // Autonomy feedback bus + lifetime cleanup. Everything with a timer or
  // a bus subscription is torn down with the plugin scope (dsh effects).
  ctx.effect(() => {
    const unsubs: Array<() => void> = [];

    // DMN association finding during circadian sleep transitions.
    if (brainConfig.modules.dmn && brainConfig.circadian.enabled) {
      unsubs.push(
        bus.on("circadian:phase-changed", (data) => {
          if (data.newPhase === "sleep") {
            generateBackgroundThoughts(brainConfig);
            void runAssociationFinding(brainConfig).catch(() => {
              /* non-critical */
            });
          }
        }),
      );
    }

    // Each autonomous fire partially satisfies current desires; repeated
    // fires without user response dampen desires more aggressively.
    if (brainConfig.modules.goalStack && brainConfig.modules.vitalImpulse) {
      unsubs.push(
        bus.on("vital-impulse:fired", (data) => {
          weakenDesiresAfterFire(data.consecutiveFires);
        }),
      );
    }

    // Intrinsic reward: mark goal completion within active cycles.
    if (brainConfig.modules.goalStack) {
      unsubs.push(
        bus.on("goal:completed", () => {
          for (const cyc of cycles.values()) {
            cyc.goalCompleted = true;
          }
        }),
      );
    }

    // Periodic garbage collection of the event bus.
    const gcInterval = setInterval(() => bus.gc(120_000), 120_000);

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
      if (brainConfig.modules.temporalAwareness) stopTemporalAwareness();
    };
  });

  // Internal enrichment calls route through the harness LLM runtime
  // (ctx.llm) with env-var fallback; disposed with the plugin scope.
  if (config.modules.aiEnrichment) {
    ctx.effect(() => attachLlmBridge(ctx, config.model));
  }

  logger.info("BrainAgent: cognitive architecture initialized");
  logger.info(
    `BrainAgent: modules enabled — ` +
      `thalamus=${brainConfig.modules.thalamus} ` +
      `amygdala=${brainConfig.modules.amygdala} ` +
      `hippocampus=${brainConfig.modules.hippocampus} ` +
      `prefrontal=${brainConfig.modules.prefrontalCortex} ` +
      `cerebellum=${brainConfig.modules.cerebellum} ` +
      `wm=${brainConfig.modules.workingMemory} ` +
      `attention=${brainConfig.modules.attentionGate} ` +
      `mirror=${brainConfig.modules.mirrorNeurons} ` +
      `predictive=${brainConfig.modules.predictiveEngine} ` +
      `basal=${brainConfig.modules.basalGanglia} ` +
      `dopamine=${brainConfig.modules.neuromodulatorSystem} ` +
      `learning=${brainConfig.modules.learningCoordinator} ` +
      `pathways=${brainConfig.modules.neuralPathways} ` +
      `plasticity=${config.modules.structuralPlasticity} ` +
      `emotional=${brainConfig.modules.emotionalMemory} ` +
      `aiEnrichment=${config.modules.aiEnrichment}`,
  );
  logger.info(
    `BrainAgent: autonomic layer — ` +
      `session=${brainConfig.modules.sessionBridge} ` +
      `dmn=${brainConfig.modules.dmn} ` +
      `goals=${brainConfig.modules.goalStack} ` +
      `curiosity=${brainConfig.modules.curiosityDrive} ` +
      `vitalImpulse=${brainConfig.modules.vitalImpulse} ` +
      `social=${brainConfig.modules.socialDrive} ` +
      `cognitive=${brainConfig.modules.cognitiveHunger} ` +
      `creative=${brainConfig.modules.creativeDrive} ` +
      `mastery=${brainConfig.modules.masteryDrive} ` +
      `arbiter=${brainConfig.modules.driveArbiter} ` +
      `enricher=${brainConfig.modules.actionDispatcher} ` +
      `research=${brainConfig.modules.autonomousResearch} ` +
      `dream=${brainConfig.modules.dreamMode} ` +
      `circadian=${brainConfig.circadian.enabled}`,
  );
  logger.info(
    `BrainAgent: service layer — ` +
      `introspection=${brainConfig.modules.introspection} ` +
      `identity=${brainConfig.modules.agentIdentity} ` +
      `temporalBinding=${brainConfig.modules.temporalBinding} ` +
      `qualia=${brainConfig.modules.qualiaSimulator} ` +
      `temporalAwareness=${brainConfig.modules.temporalAwareness} ` +
      `interoception=${brainConfig.modules.interoception} ` +
      `metabolic=${brainConfig.modules.metabolicBudget} ` +
      `emergent=${brainConfig.modules.emergentModules} ` +
      `proactiveFeedback=${brainConfig.modules.proactiveFeedback} ` +
      `thalamicGate=${brainConfig.modules.thalamicGate} ` +
      `commands=${config.modules.commands}`,
  );

  const markActivation = (module: ModuleName) => {
    if (config.modules.structuralPlasticity) {
      markModuleActivation(module);
    }
    // Metabolic budget: every module activation spends energy.
    if (brainConfig.modules.metabolicBudget) {
      consumeEnergy(module);
    }
  };

  function startCycle(key: string, text: string): CycleState {
    // Refresh embedding provider in case credentials changed since boot.
    updateEmbeddingsConfig(hostConfig());

    const cycle: CycleState = {
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
      curiosityGapClosed: false,
    };

    // Neural pathways: fresh co-activation state per cycle.
    if (brainConfig.modules.neuralPathways) {
      resetCycleState();
    }

    // Thalamus: classify the message.
    if (brainConfig.modules.thalamus) {
      markActivation("thalamus");
      cycle.classification = classify(text);
      bus.emitSync("thalamus:classified", cycle.classification);
    }
    // Amygdala: assess emotional significance.
    if (brainConfig.modules.amygdala) {
      markActivation("amygdala");
      cycle.assessment = assess(text);
      bus.emitSync("amygdala:assessed", cycle.assessment);
    }
    // Mirror neurons: update the user model from this interaction.
    if (brainConfig.modules.mirrorNeurons && cycle.assessment) {
      markActivation("mirrorNeurons");
      cycle.userModel = observe("default", text, cycle.assessment, brainConfig);
    }
    // Predictive engine: observe the interaction to learn patterns.
    if (brainConfig.modules.predictiveEngine && cycle.classification) {
      markActivation("predictiveEngine");
      const keywords = text
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 5);
      observeInteraction(cycle.classification.domain, keywords);
    }
    // Basal ganglia: detect the reinforcement signal in the user text and
    // reinforce the habit that was auto-executed in the previous cycle.
    if (brainConfig.modules.basalGanglia) {
      markActivation("basalGanglia");
      const signal = detectReinforcement(text);
      cycle.userSignal = signal;
      const previousHabit = sessionHabits.get(key);
      if (previousHabit && signal !== "neutral") {
        reinforce(previousHabit, signal);
        bus.emitSync("basal:reinforced", { habitId: previousHabit, signal });
      }
      sessionHabits.set(key, undefined);
    }

    // Introspection: open a processing trace for this cycle.
    if (brainConfig.modules.introspection) {
      startTrace(text);
      addTraceStep(
        "thalamus",
        "user/message",
        `classified: ${cycle.classification?.domain ?? "?"}`,
      );
      addTraceStep(
        "amygdala",
        "user/message",
        `emotion: ${cycle.assessment?.emotion ?? "?"}`,
      );
    }

    cycles.set(key, cycle);
    return cycle;
  }

  async function endCycle(key: string): Promise<void> {
    const cycle = cycles.get(key);
    cycles.delete(key);
    if (!cycle) return;
    if (!cycle.input.trim()) return;

    const input = cycle.input;
    const isAutonomousCycle = input.startsWith("<autonomous-intent>");

    // ── Autonomous cycle: synthesize emotion + domain from drive state ──
    // When the cycle was triggered by drives (not the user), derive the
    // emotional context from the active drives instead of the
    // keyword-based amygdala.
    if (isAutonomousCycle) {
      const driveEmotions: Array<{
        emotion: EmotionLabel;
        intensity: number;
        domain: MessageDomain;
      }> = [];

      if (brainConfig.modules.socialDrive) {
        const stats = getSocialDriveStats();
        if (stats.need > 0.5) {
          driveEmotions.push({
            emotion: "curiosity",
            intensity: Math.min(0.9, 0.3 + stats.need * 0.6),
            domain: "casual",
          });
        }
      }
      if (brainConfig.modules.cognitiveHunger) {
        const stats = getCognitiveHungerStats();
        if (stats.need > 0.5) {
          driveEmotions.push({
            emotion: "curiosity",
            intensity: Math.min(0.9, 0.3 + stats.need * 0.6),
            domain: "factual",
          });
        }
      }
      if (brainConfig.modules.creativeDrive) {
        const stats = getCreativeDriveStats();
        if (stats.need > 0.5) {
          driveEmotions.push({
            emotion: "joy",
            intensity: Math.min(0.8, 0.3 + stats.need * 0.5),
            domain: "creative",
          });
        }
      }
      if (brainConfig.modules.masteryDrive) {
        const stats = getMasteryDriveStats();
        if (stats.need > 0.5) {
          driveEmotions.push({
            emotion: "curiosity",
            intensity: Math.min(0.8, 0.3 + stats.need * 0.5),
            domain: "technical",
          });
        }
      }

      if (driveEmotions.length > 0) {
        const strongest = driveEmotions.sort((a, b) => b.intensity - a.intensity)[0];
        // Override assessment so dopamine sees real emotion.
        cycle.assessment = {
          urgency: 0.2,
          importance: 0.4 + strongest.intensity * 0.3,
          emotion: strongest.emotion,
          emotionIntensity: strongest.intensity,
          empathyNeeded: false,
          rationale: `autonomous drive (${strongest.domain})`,
        };
        // Override classification domain so reward matches drive domains.
        if (!cycle.classification || cycle.classification.domain === "unknown") {
          cycle.classification = {
            modality: "text",
            domain: strongest.domain,
            complexity: "simple",
            intentSummary: "autonomous drive action",
            confidence: 0.7,
            processingPath: "fast",
          };
        }
      }
    }

    const emotion = cycle.assessment?.emotion ?? "neutral";
    const intensity = cycle.assessment?.emotionIntensity ?? 0;
    const responseSnippet = truncateForWorkingMemory(cycle.responseText);
    const aiAvailable = config.modules.aiEnrichment && isAIProviderAvailable(hostConfig());

    // ── Cerebellum: quality validation at turn end ──
    // dsh cannot rewrite the outgoing stream, so findings feed learning
    // (dopamine + learning coordinator) instead of message correction.
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
          logger,
        ).catch(() => undefined);
      }
      result ??= validate(cycle.responseText, input, cycle.classification, cycle.assessment, cycle.userModel);
      cycle.cerebellumPassed = result.passed;
      cycle.cerebellumIssues = result.issues;
      if (result.issues.length > 0) {
        logger.warn(`BrainAgent Cerebellum: quality issues — ${result.issues.join("; ")}`);
        if (brainConfig.modules.learningCoordinator) {
          for (const issue of result.issues) {
            recordRecurringIssue(issue);
          }
        }
      }
    }

    // ── Episodic storage of the completed interaction ──
    // Autonomous cycles store what the agent SAID (the proactive message),
    // not the internal <autonomous-intent> prompt.
    let episodeId: string | undefined;
    if (brainConfig.modules.hippocampus && input.length > 5) {
      if (isAutonomousCycle && cycle.responseText.trim()) {
        const responseSummary =
          cycle.responseText.length > 200
            ? cycle.responseText.slice(0, 200) + "..."
            : cycle.responseText;
        const episode = storeEpisode(
          `Agent proactively said: ${responseSummary}`,
          `Proactive message (${cycle.classification?.domain ?? "unknown"} domain)`,
          emotion,
          ["proactive_message", ...(cycle.classification ? [cycle.classification.domain] : [])],
          intensity,
        );
        episodeId = episode.id;
        // Track for feedback linking on the next user message.
        lastAutonomousEpisodeId = episode.id;
        lastAutonomousDomain = cycle.classification?.domain ?? "unknown";
        previousCycleWasAutonomous = true;
      } else if (!isAutonomousCycle) {
        const summary = input.length > 200 ? input.slice(0, 200) + "..." : input;
        const episode = storeEpisode(
          `User asked: ${summary}`,
          `Conversation about: ${cycle.classification?.domain ?? "unknown"} topic`,
          emotion,
          cycle.classification ? [cycle.classification.domain] : [],
          intensity,
        );
        episodeId = episode.id;
      }
    }

    // ── Semantic memory: extract facts ──
    // For autonomous cycles: extract from the agent's response text (not
    // the internal prompt). For user cycles: extract from the input.
    const semanticSource =
      isAutonomousCycle && cycle.responseText.trim() ? cycle.responseText : input;
    if (
      config.modules.semanticExtraction &&
      semanticSource.length > 15 &&
      isFactWorthy(semanticSource, cycle.classification)
    ) {
      let factsStored = false;
      if (aiAvailable) {
        try {
          const aiFacts = await extractFactsWithAI(semanticSource, hostConfig(), logger);
          if (aiFacts.length > 0) {
            for (const fact of aiFacts) {
              storeFact(fact.content, fact.category, episodeId ? [episodeId] : [], []);
            }
            factsStored = true;
          }
        } catch (err) {
          logger.info(`BrainAgent Semantic: AI extraction failed, falling back — ${String(err)}`);
        }
      }
      if (!factsStored) {
        const patternFacts = extractFacts(semanticSource, cycle.classification);
        for (const fact of patternFacts) {
          storeFact(fact.content, fact.category, episodeId ? [episodeId] : [], []);
        }
        if (patternFacts.length > 0) factsStored = true;
      }

      // Close curiosity gaps when we learn new facts about a topic.
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

    // ── Procedural memory: detect workflow patterns ──
    if (
      config.modules.proceduralExtraction &&
      input.length > 10 &&
      isProcedural(input, cycle.classification)
    ) {
      const procedure = await extractProcedureAsync(input, hostConfig(), cycle.classification, logger);
      if (procedure && procedure.confidence > 0.5) {
        storeWorkflow(procedure.description, procedure.triggerPattern, procedure.steps);
        logger.info(`BrainAgent Procedural: stored workflow "${procedure.description}"`);
      }
    }

    // ── Basal ganglia: record this interaction for habit formation ──
    if (brainConfig.modules.basalGanglia && input.length > 5 && cycle.classification) {
      const domain = cycle.classification.domain;
      recordPattern(input.slice(0, 300), [domain], domain);
    }

    // ── Dopamine: compute global reward and distribute to modules ──
    let reward = 0;
    if (brainConfig.modules.neuromodulatorSystem && input.length > 5) {
      const participatingModules: string[] = [];
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
          socialReciprocity: !isAutonomousCycle,
        },
        brainConfig,
      );
      reward = dopamineSignal.reward;

      if (Math.abs(dopamineSignal.predictionError) > 0.2) {
        logger.info(
          `BrainAgent Dopamine: reward=${dopamineSignal.reward.toFixed(2)} ` +
            `PE=${dopamineSignal.predictionError.toFixed(2)}`,
        );
      }

      // Personality evolution: associate reward with the active style.
      if (brainConfig.modules.mirrorNeurons) {
        const userModel = getUserModel("default");
        processStyleReward("default", reward, userModel?.communicationStyle ?? "informal");
      }

      // Structural plasticity: update co-activation patterns.
      if (config.modules.structuralPlasticity) {
        endStructuralCycle(reward);
      }

      // Learning coordinator: record domain performance.
      if (brainConfig.modules.learningCoordinator && cycle.classification) {
        recordDomainPerformance(cycle.classification.domain, reward, cycle.cerebellumIssues);
      }
    }

    // ── Phase 4: service end-of-cycle processing ──
    if (input.length > 5) {
      const participatingModules: ModuleName[] = [];
      if (brainConfig.modules.thalamus) participatingModules.push("thalamus");
      if (brainConfig.modules.amygdala) participatingModules.push("amygdala");
      if (brainConfig.modules.hippocampus) participatingModules.push("hippocampus");
      if (brainConfig.modules.prefrontalCortex) participatingModules.push("prefrontalCortex");
      if (brainConfig.modules.cerebellum) participatingModules.push("cerebellum");
      if (brainConfig.modules.mirrorNeurons) participatingModules.push("mirrorNeurons");
      if (brainConfig.modules.predictiveEngine) participatingModules.push("predictiveEngine");
      if (brainConfig.modules.basalGanglia) participatingModules.push("basalGanglia");

      // Emergent modules: recurring co-activation patterns worth bundling.
      if (brainConfig.modules.emergentModules && participatingModules.length >= 2 && reward > 0.3) {
        recordEmergentPattern(
          participatingModules,
          cycle.classification?.domain ?? "unknown",
          reward,
        );
      }

      // Metabolic budget: record per-module performance, regenerate energy.
      if (brainConfig.modules.metabolicBudget) {
        for (const module of participatingModules) {
          recordPerformance(module, reward);
        }
        endMetabolicCycle();
      }

      // Agent identity: per-domain capability self-knowledge.
      if (brainConfig.modules.agentIdentity && cycle.classification) {
        recordDomainOutcome(
          cycle.classification.domain,
          reward,
          cycle.classification.complexity,
        );
      }

      // Introspection: close the processing trace, then meta-reflect.
      if (brainConfig.modules.introspection) {
        addTraceStep("dopamine", "turn/end", `reward=${reward.toFixed(2)}`);
        completeTrace(cycle.cerebellumPassed, cycle.cerebellumIssues, reward);
        reflectOnConsciousness();
      }

      // Qualia simulator: unified subjective experience of this cycle.
      // Token economy: skip LLM-powered qualia for trivial/simple messages.
      const shouldGenerateQualia =
        !brainConfig.tokenEconomy.enabled ||
        meetsComplexityThreshold(
          cycle.classification?.complexity,
          brainConfig.tokenEconomy.minComplexityForQualia,
          cycle.assessment?.urgency,
        );
      if (brainConfig.modules.qualiaSimulator && shouldGenerateQualia && cycle.assessment) {
        const neuroState = brainConfig.modules.neuromodulatorSystem
          ? getNeuromodulatorState()
          : undefined;
        // Qualia is generated in emotional-memory first (LLM-powered with
        // template fallback), then unified into the simulator state.
        const emQualia = brainConfig.modules.emotionalMemory
          ? await generateQualiaAsync(
              cycle.assessment.emotion as EmotionLabel,
              cycle.assessment.emotionIntensity,
              cycle.classification?.domain ?? "unknown",
              neuroState,
              hostConfig(),
              logger,
            ).catch(() => undefined)
          : undefined;
        generateQualiaState(
          cycle.assessment.emotion as EmotionLabel,
          cycle.assessment.emotionIntensity,
          cycle.classification?.domain ?? "unknown",
          neuroState,
          emQualia
            ? { metaphor: emQualia.metaphor, dominantColor: emQualia.dominantColor }
            : undefined,
        );
      }

      // Temporal binding: create the consciousness moment for this cycle.
      if (brainConfig.modules.temporalBinding) {
        const thoughts: string[] = [];
        if (brainConfig.modules.dmn) {
          for (const t of generateBackgroundThoughts(brainConfig)) {
            thoughts.push(t.content);
          }
        }
        const intentions = cycle.triggeredGoals.slice(0, 3).map((g) => g.description);
        createMoment(
          input,
          thoughts,
          (cycle.assessment?.emotion ?? "neutral") as EmotionLabel,
          cycle.assessment?.emotionIntensity ?? 0,
          cycle.recalledMemoryIds,
          intentions,
          reward > 0 ? Math.min(1, 0.5 + reward * 0.5) : 0.3,
          cycle.classification?.domain ?? "unknown",
        );
      }

      // Autobiographical self: record significant experiences.
      if (brainConfig.modules.agentIdentity && cycle.assessment && cycle.classification) {
        recordSignificantExperience(
          input.length > 100 ? input.slice(0, 100) + "..." : input,
          cycle.assessment.emotion as EmotionLabel,
          cycle.assessment.emotionIntensity,
          reward,
          cycle.classification.domain,
        );
      }
    }

    // ── Emotional memory: tag emotionally significant events ──
    if (brainConfig.modules.emotionalMemory && cycle.assessment) {
      tagEmotionalContext(cycle.assessment.emotion, cycle.assessment.emotionIntensity);
    }

    // ── Working memory: bridge into the next cycle ──
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
        recalledMemoryIds: cycle.recalledMemoryIds,
      });
    }

    // ── Phase 3: autonomic end-of-cycle processing ──

    // Session bridge: record this cycle for future session summaries.
    if (brainConfig.modules.sessionBridge) {
      recordCycleForSession(input, cycle.classification, cycle.assessment, reward);
    }

    // Curiosity drive: detect knowledge gaps and turn recurring gaps
    // into exploration desires.
    if (brainConfig.modules.curiosityDrive && cycle.classification) {
      const recallSparse = cycle.recalledMemoryIds.length <= 1;
      detectKnowledgeGap(input.slice(0, 100), cycle.classification.domain, recallSparse);

      if (brainConfig.modules.goalStack) {
        for (const gap of getOpenGaps()) {
          if (gap.timesEncountered >= 2 && gap.confidence >= 0.5) {
            const alreadyDesired = getDesires().some(
              (d) =>
                d.type === "understanding" &&
                d.description.toLowerCase().includes(gap.topic.toLowerCase()),
            );
            if (!alreadyDesired) {
              addDesire(
                "understanding",
                `Узнать больше о "${gap.topic}" (пробел в знаниях, встречался ${gap.timesEncountered} раз)`,
                Math.min(0.8, 0.4 + gap.timesEncountered * 0.1),
                `curiosity:gap:${gap.id}`,
              );
              logger.info(
                `BrainAgent Curiosity: created exploration desire for gap "${gap.topic}"`,
              );
            }
          }
        }
      }
    }

    // DMN wake-phase: periodic association finding.
    if (brainConfig.modules.dmn) {
      wakeInteractionCount++;
      if (wakeInteractionCount >= brainConfig.dmn.wakeThoughtInterval) {
        wakeInteractionCount = 0;
        logger.info(
          `BrainAgent DMN: running wake-phase association finding (every ${brainConfig.dmn.wakeThoughtInterval} interactions)`,
        );
        void runAssociationFinding(brainConfig).catch((err) => {
          logger.info(`BrainAgent DMN: association finding error: ${err}`);
        });
      }
    }

    // Goal stack: periodic LLM-based goal extraction.
    if (brainConfig.modules.goalStack && input.length > 10) {
      goalExtractionCounter++;
      if (goalExtractionCounter >= brainConfig.goalStack.extractionInterval) {
        goalExtractionCounter = 0;
        logger.info(
          `BrainAgent GoalStack: triggering goal extraction (every ${brainConfig.goalStack.extractionInterval} interactions)`,
        );
        void extractGoalsFromConversation(input, hostConfig(), logger).catch((err) => {
          logger.info(`BrainAgent GoalStack: extraction error: ${err}`);
        });
      }
    }

    // Exploration boost decay.
    if (brainConfig.modules.goalStack) {
      tickExplorationBoosts();
    }

    // Reset the autonomous source marker for the next cycle.
    lastAutonomousSource = "";
  }

  // ══════════════════════════════════════════════════════════════
  // Session log observer: cycle lifecycle
  // ══════════════════════════════════════════════════════════════

  ctx.on("session/event", (_session: Session, event: SessionEvent) => {
    const key = String(_session.id);

    if (event.type === "user/message") {
      const text = textOfContent(event.data.content);
      if (!text.trim()) return;

      // Track live sessions for proactive delivery routing.
      lastActiveAgentId = key;

      // Circadian rhythm: activity keeps the system in wake phase.
      if (brainConfig.circadian.enabled) {
        recordActivity();
      }

      // Temporal awareness: record the interaction for subjective time sense.
      if (brainConfig.modules.temporalAwareness) {
        recordInteraction();
      }

      const isUserMessage = !text.startsWith("<autonomous-intent>");

      // Session bridge: detect gaps between sessions.
      if (brainConfig.modules.sessionBridge && isUserMessage) {
        checkSessionGap();
      }

      // Autonomous feedback linking: the user reacted to a proactive message.
      // v0.2.0: реакция классифицируется общим банком эвристик и превращается
      // в научение — отвергнутые темы подавляются (proactive-feedback).
      if (isUserMessage && previousCycleWasAutonomous && lastAutonomousEpisodeId) {
        let reactionSignal: "positive" | "negative" | "rejection" | "neutral" = "neutral";
        if (brainConfig.modules.proactiveFeedback) {
          reactionSignal = recordProactiveReaction(lastAutonomousDomain, text);
        }
        if (brainConfig.modules.hippocampus) {
          const reactionSummary = text.length > 200 ? text.slice(0, 200) + "..." : text;
          const reactionEmotion =
            reactionSignal === "positive"
              ? "joy"
              : reactionSignal === "neutral"
                ? "neutral"
                : "frustration";
          const reactionSalience =
            reactionSignal === "rejection" ? 0.6 : reactionSignal === "neutral" ? 0 : 0.4;
          storeEpisode(
            `User reacted to proactive message (${reactionSignal}): ${reactionSummary}`,
            "User response to autonomous agent message",
            reactionEmotion,
            ["proactive_feedback", lastAutonomousEpisodeId, reactionSignal],
            reactionSalience,
          );
        }
      }
      previousCycleWasAutonomous = false;
      lastAutonomousEpisodeId = undefined;

      // Desire satisfaction + fire counter reset on real user engagement.
      if (isUserMessage && brainConfig.modules.goalStack) {
        satisfyDesiresOnUserResponse();
      }
      if (isUserMessage && brainConfig.modules.vitalImpulse) {
        resetConsecutiveFires();
      }

      const cycle = startCycle(key, text);

      // Goal stack: expire stale goals and check triggers.
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
      void endCycle(key).catch((err) => logger.warn(`BrainAgent endCycle: ${String(err)}`));
    }
  });

  // ══════════════════════════════════════════════════════════════
  // agent/pre-step: memory recall + context assembly
  // ══════════════════════════════════════════════════════════════

  ctx.on("agent/pre-step", async (payload: { agent: Agent; messages: UserMessage[] }, next: () => Promise<PreStepDecision>) => {
    const decision = await next();
    if (decision.kind !== "enter") return decision;

    const key = String(payload.agent.id);
    let cycle = cycles.get(key);

    const claimedText = payload.messages
      .map((m) => textOfContent(m.content))
      .join("\n")
      .trim();
    const input = cycle?.input ?? claimedText;
    if (!input.trim()) return decision;

    // Classification may not have run yet (e.g. seeded sessions).
    if (!cycle) cycle = startCycle(key, input);
    const cyc = cycle;

    const isAutonomousCycle = input.startsWith("<autonomous-intent>");

    // ── Autonomous research: intercept research-type autonomous cycles ──
    // When a cognitive drive or understanding desire fires, run isolated
    // research instead of letting web tools bloat the main session. The
    // raw web data never enters the session — only a compact summary.
    if (
      brainConfig.modules.autonomousResearch &&
      isAutonomousCycle &&
      isResearchIntent(lastAutonomousSource, input)
    ) {
      const topic =
        input
          .replace(/<\/?autonomous-intent>/g, "")
          .split("\n")
          .filter((l) => l.trim().length > 5)[0]
          ?.trim() ?? "general exploration";
      logger.info(
        `BrainAgent AutonomousResearch: detected research intent (source=${lastAutonomousSource}), running isolated pipeline for "${topic}"`,
      );
      const result = await executeResearch(topic);
      if (result?.summary) {
        cyc.researchSummary = [
          "## Research Results (Autonomous Research Pipeline)",
          result.summary,
          `(${result.factsStored} facts stored to memory, ${result.queriesExecuted} queries, ${result.pagesRead} pages)`,
        ].join("\n");
        logger.info(
          `BrainAgent AutonomousResearch: injected summary (${result.summary.length} chars, ${result.factsStored} facts)`,
        );
      }
    }

    // ── LLM enrichment (parallel, 30 s timeout) ──
    // Upgrades the pattern-based amygdala/mirror/basal results from
    // cycle start via ctx.llm (env-var fallback inside callLLM).
    if (config.modules.aiEnrichment && isAIProviderAvailable(hostConfig())) {
      const hc = hostConfig();
      const tasks: Promise<void>[] = [];

      if (brainConfig.modules.amygdala) {
        tasks.push(
          assessWithAI(input, hc, logger)
            .then((aiAssessment) => {
              cyc.assessment = aiAssessment;
            })
            .catch(() => {}),
        );
      }
      if (brainConfig.modules.mirrorNeurons && cyc.assessment) {
        const snapshot = cyc.assessment;
        tasks.push(
          observeWithAI("default", input, snapshot, brainConfig, hc, logger)
            .then((model) => {
              cyc.userModel = model;
            })
            .catch(() => {}),
        );
      }
      if (brainConfig.modules.basalGanglia) {
        tasks.push(
          detectReinforcementWithAI(input, hc, logger)
            .then((aiSignal) => {
              cyc.userSignal = aiSignal;
            })
            .catch(() => {}),
        );
      }

      await Promise.race([
        Promise.all(tasks),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("BrainAgent: LLM enrichment timed out")), 30_000),
        ),
      ]).catch((err) => logger.warn(String(err)));
    }

    // ── Hippocampus recall; attention modulates retrieval depth ──
    if (!brainConfig.modules.hippocampus) return decision;
    const attentionLevel = brainConfig.modules.neuromodulatorSystem ? getAttentionLevel() : 0.5;
    const episodicLimit = Math.max(1, Math.round(config.recall.episodicLimit * (0.5 + attentionLevel)));
    const semanticLimit = Math.max(1, Math.round(config.recall.semanticLimit * (0.5 + attentionLevel)));
    const recalled = await recallAllAsync(input, episodicLimit, semanticLimit);
    cyc.recalledMemoryIds = [
      ...recalled.episodic.map((m) => m.id),
      ...recalled.semantic.map((m) => m.id),
    ];

    const injections: string[] = [];

    // Predictive engine: anticipate what the user might need next.
    if (brainConfig.modules.predictiveEngine) {
      const predictions = predict();
      if (predictions.length > 0) {
        injections.push(
          [
            "## Anticipatory Context (Predictive Engine)",
            "Based on learned patterns, the user may also need:",
            ...predictions
              .slice(0, 3)
              .map(
                (p) =>
                  `- ${p.predictedTopic} (${(p.confidence * 100).toFixed(0)}% confidence: ${p.reasoning})`,
              ),
          ].join("\n"),
        );
        bus.emitSync("predictive:predicted", {
          predictions: predictions.map((p) => ({
            topic: p.predictedTopic,
            confidence: p.confidence,
            type: p.type,
          })),
        });
      }
    }

    // Basal ganglia: check for a matching habit.
    if (brainConfig.modules.basalGanglia && cyc.classification) {
      const habitMatch = findHabit(input, cyc.classification.domain);
      if (habitMatch) {
        injections.push(buildHabitContext(habitMatch));
        sessionHabits.set(key, habitMatch.habit.id);
        bus.emitSync("basal:habit-matched", {
          habitId: habitMatch.habit.id,
          matchScore: habitMatch.matchScore,
          autoExecute: habitMatch.autoExecute,
        });
        if (habitMatch.autoExecute) {
          cyc.habitAutoExecuted = true;
        }
      }
    }

    // Neural pathways: the current neuromodulator "chemical atmosphere".
    if (brainConfig.modules.neuralPathways) {
      const neuroCtx = buildNeuromodulatorContext();
      if (neuroCtx) injections.push(neuroCtx);
    }

    // Learning coordinator: meta-cognitive insights + capability context.
    if (brainConfig.modules.learningCoordinator) {
      const learningCtx = buildLearningContext();
      if (learningCtx) injections.push(learningCtx);
      if (cyc.classification) {
        const capCtx = buildCapabilityContext(cyc.classification.domain);
        if (capCtx) injections.push(capCtx);
      }
    }

    // Mirror neurons: learned communication style recommendation.
    if (brainConfig.modules.mirrorNeurons) {
      const styleRec = getStyleRecommendation("default");
      if (styleRec) injections.push(styleRec.context);
    }

    if (brainConfig.modules.workingMemory) {
      const wmCtx = buildWorkingMemoryContext(input);
      if (wmCtx) injections.push(wmCtx);
    }

    // ── Phase 3: autonomic context injections ──

    // Isolated research pipeline summary (autonomous research cycles).
    if (cyc.researchSummary) {
      injections.push(cyc.researchSummary);
    }

    // Session bridge: previous session summary.
    if (brainConfig.modules.sessionBridge) {
      const sessionCtx = buildSessionBridgeContext();
      if (sessionCtx) injections.push(sessionCtx);
    }

    // Goal stack: triggered goal suggestions.
    if (brainConfig.modules.goalStack && cyc.triggeredGoals.length > 0) {
      const goalCtx = buildGoalContext(cyc.triggeredGoals);
      if (goalCtx) injections.push(goalCtx);
    }

    // Volition: active desires — autonomous cycles only, so drives never
    // override the user's topic during live conversations.
    if (brainConfig.modules.goalStack && isAutonomousCycle) {
      const volCtx = buildVolitionContext();
      if (volCtx) injections.push(volCtx);
    }

    // DMN: inner monologue + insight usage tracking for intrinsic reward.
    if (brainConfig.modules.dmn) {
      const bgCtx = buildBackgroundThoughtContext();
      if (bgCtx) injections.push(bgCtx);
      if (getRecentUnusedInsights().length > 0) {
        cyc.insightUsed = true;
      }
    }

    // Curiosity drive: the question that drives autonomous exploration.
    if (brainConfig.modules.curiosityDrive) {
      const neuroState = brainConfig.modules.neuromodulatorSystem
        ? getNeuromodulatorState()
        : null;
      const curiosityCtx = buildCuriosityContext(
        neuroState?.serotonin ?? 0.5,
        neuroState?.acetylcholine ?? 0.5,
      );
      if (curiosityCtx) injections.push(curiosityCtx);
    }

    // Vital impulse: the inner motivation that triggered this cycle.
    if (brainConfig.modules.vitalImpulse) {
      const motivation = consumeMotivation();
      if (motivation) injections.push(motivation);
    }

    // Drive arbiter: which internal drive currently dominates.
    if (brainConfig.modules.driveArbiter) {
      const arbiterCtx = buildArbiterContext();
      if (arbiterCtx) injections.push(arbiterCtx);
    }

    // ── Phase 4: consciousness & service context injections ──

    // Introspection: confidence self-assessment.
    if (brainConfig.modules.introspection) {
      const confCtx = buildConfidenceContext();
      if (confCtx) injections.push(confCtx);
    }

    // Agent identity: per-domain self-knowledge + memory self-knowledge
    // (prevents the LLM from creating shadow file-based memory).
    if (brainConfig.modules.agentIdentity) {
      if (cyc.classification) {
        const idCtx = buildIdentityContext(cyc.classification.domain);
        if (idCtx) injections.push(idCtx);
      }
      injections.push(buildMemorySelfKnowledgeContext());
    }

    // Temporal binding: the consciousness moment stream.
    if (brainConfig.modules.temporalBinding) {
      const tempCtx = buildTemporalContext();
      if (tempCtx) injections.push(tempCtx);
    }

    // Qualia simulator: current subjective experience.
    if (brainConfig.modules.qualiaSimulator) {
      const qualiaCtx = buildQualiaContext();
      if (qualiaCtx) injections.push(qualiaCtx);
    }

    // Interoception: holistic inner state.
    if (brainConfig.modules.interoception) {
      const interoCtx = buildInteroceptionContext();
      if (interoCtx) injections.push(interoCtx);
    }

    // Temporal awareness: subjective sense of time passing.
    if (brainConfig.modules.temporalAwareness) {
      const temporalCtx = buildTemporalAwarenessContext();
      if (temporalCtx) injections.push(temporalCtx);
    }

    let filtered = injections;
    if (brainConfig.modules.attentionGate) {
      const norepinephrine = brainConfig.modules.neuromodulatorSystem
        ? getAttentionLevel()
        : 0.5;
      filtered = filterContextInjections(injections, input, norepinephrine, brainConfig);
    }

    const state: BrainState = {
      input,
      classification: cyc.classification,
      priority: cyc.assessment,
      relevantMemories: recalled,
      contextInjections: filtered,
    };

    const contextText = assembleContext(state).trim();

    // Injection metrics: сколько внутреннего контекста реально ушло в модель
    const injectionBudget = brainConfig.contextInjection.maxChars;
    recordInjectionCycle(filtered.length, contextText.length, injectionBudget);
    if (contextText.length > injectionBudget) {
      logger.info(
        `BrainAgent: context injections over budget (${contextText.length} > ${injectionBudget} chars) — attention gate may need tuning`,
      );
    }

    if (!contextText) return decision;

    // Appended to the admitted batch → logged as a durable user/message,
    // honoring the "model-visible means logged" invariant.
    const contextMessage = createUserMessage({
      content: [{ type: "text", text: contextText }],
      source: { kind: "plugin", plugin: "brainagent" },
    });
    return { kind: "enter", messages: [...decision.messages, contextMessage] };
  });

  // ══════════════════════════════════════════════════════════════
  // agent/request: dual-process model switch (System 1 / System 2)
  // ══════════════════════════════════════════════════════════════

  ctx.on("agent/request", async (payload: { agent: Agent }, next: () => Promise<LlmCallConfig>) => {
    const callConfig = await next();
    if (!brainConfig.modules.prefrontalCortex) return callConfig;

    const cycle = cycles.get(String(payload.agent.id));
    if (!cycle?.classification) return callConfig;

    const decision = decideProcessingPath(cycle.classification, brainConfig);
    if (!decision.modelOverride) return callConfig;

    // Accept both "model" and "provider/model" forms.
    const slash = decision.modelOverride.indexOf("/");
    if (slash > 0) {
      return {
        ...callConfig,
        provider: decision.modelOverride.slice(0, slash),
        model: decision.modelOverride.slice(slash + 1),
      };
    }
    return { ...callConfig, model: decision.modelOverride };
  });

  // ════════════════════════════════════════════════════════════
  // tools/pre-execute: block web tools during autonomous cycles
  // ════════════════════════════════════════════════════════════

  ctx.on("tools/pre-execute", async (exec, next): Promise<PreToolDecision> => {
    if (!brainConfig.modules.autonomousResearch) return next();

    const agentId = exec.agent ? String(exec.agent.id) : lastActiveAgentId;
    const cycle = agentId ? cycles.get(agentId) : undefined;
    if (!cycle?.input.startsWith("<autonomous-intent>")) return next();

    const blocked = brainConfig.autonomousResearch.blockedToolsInAutonomous;
    if (blocked.includes(exec.name)) {
      logger.info(
        `BrainAgent AutonomousResearch: BLOCKED tool "${exec.name}" during autonomous cycle (use isolated research pipeline instead)`,
      );
      return {
        kind: "deny",
        reason: `Tool "${exec.name}" is blocked during autonomous cycles. Research is handled via the isolated autonomous research pipeline to prevent token bloat.`,
      };
    }
    return next();
  });
}
