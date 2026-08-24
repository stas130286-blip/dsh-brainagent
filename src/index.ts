/**
 * BrainAgent — DeepSeek Harness plugin entry point (Cordis).
 *
 * Port of the NeuroClaw cognitive architecture. This file is the wiring
 * hub only: it initializes every module, registers the dsh event hooks
 * and tears everything down with the plugin scope. The heavy logic lives
 * in `src/plugin/`:
 *
 *  - config.ts   — plugin schema, default merge, text/complexity helpers
 *  - autonomy.ts — proactive delivery + intent resolution
 *  - cycles.ts   — per-session cycle lifecycle (start/end)
 *  - context.ts  — agent/pre-step memory recall + context assembly
 *
 * Processing pipeline (per user/event cycle):
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
 * Concurrency: all per-cycle state lives in the cycle engine's Map keyed
 * by SessionId, never in module-level globals — parallel sessions cannot
 * bleed into each other.
 */

import { mkdirSync } from "node:fs";
import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import { createUserMessage, type LlmCallConfig } from "@deepseek-ai/dsh-llm";
import type { Session, SessionEvent } from "@deepseek-ai/dsh-session";
// Importing the tools package pulls in its `tools/pre-execute` event augmentation.
import type { PreToolDecision } from "@deepseek-ai/dsh-tools";
// Importing the commands package pulls in the `ctx.commands` service augmentation.
import "@deepseek-ai/dsh-commands";

import { buildHostConfig } from "./modules/host-config.ts";
import type { HostConfig } from "./modules/host-config.ts";
import { bus } from "./modules/event-bus.ts";
import type { BrainAgentConfig, ModuleName } from "./modules/types.ts";
import { Config, isAutonomousInput, mergeBrainConfig, textOfContent, truncateText } from "./plugin/config.ts";
import type { Logger } from "./plugin/cycles.ts";
import { createCycleEngine } from "./plugin/cycles.ts";
import { createAutonomousDeliverer, createAutonomousIntentResolver, createAutonomyState } from "./plugin/autonomy.ts";
import type { DriveGetters } from "./plugin/autonomy.ts";
import { createPreStepHandler } from "./plugin/context.ts";

// Memory layers
import {
  initMemoryStorage,
  initEmbeddings,
  recallAll,
  storeFact,
  storeEpisode,
  getFactsByCategory,
} from "./modules/hippocampus.ts";
import { initWorkingMemoryStorage, getWorkingMemoryStats } from "./modules/working-memory.ts";
import { initAttentionGate, getAttentionStats } from "./modules/attention-gate.ts";
import { initMirrorStorage, getUserModel } from "./modules/mirror-neurons.ts";
import { initPredictiveStorage } from "./modules/predictive-engine.ts";
import { initBasalStorage } from "./modules/basal-ganglia.ts";
import { initDopamineSystem, getNeuromodulatorState } from "./modules/dopamine-system.ts";
import { initLearningCoordinator } from "./modules/learning-coordinator.ts";
import { initNeuralPathways } from "./modules/neural-pathways.ts";
import { initStructuralPlasticity, markModuleActivation } from "./modules/structural-plasticity.ts";
import { initEmotionalMemory } from "./modules/emotional-memory.ts";
import { initSessionBridge, checkSessionGap, getSessionBridgeStats } from "./modules/session-bridge.ts";
import { initDMN, generateBackgroundThoughts, runAssociationFinding, getDMNStats, getRecentUnusedInsights } from "./modules/dmn.ts";
import {
  initGoalStack,
  getGoalStackStats,
  checkAutonomousGoals,
  buildGoalContext,
  getDesires,
  addDesire,
  expireGoals,
  checkGoalTriggers,
  weakenDesiresAfterFire,
  satisfyDesiresOnUserResponse,
  tickExplorationBoosts,
  extractGoalsFromConversation,
} from "./modules/goal-stack.ts";
import { getGoalExecutorStats } from "./modules/goal-executor.ts";
import { initCuriosityDrive, getCuriosityStats, getOpenGaps } from "./modules/curiosity-drive.ts";
import { initSocialDrive, stopSocialDrive, getSocialDriveStats, getSatiation as getSocialDriveSatiation } from "./modules/social-drive.ts";
import { initCognitiveHunger, stopCognitiveHunger, getCognitiveHungerStats, getCognitiveHungerSatiation } from "./modules/cognitive-hunger.ts";
import { initCreativeDrive, stopCreativeDrive, getCreativeDriveStats, getCreativeDriveSatiation } from "./modules/creative-drive.ts";
import { initMasteryDrive, stopMasteryDrive, getMasteryDriveStats, getMasteryAggregateSatiation } from "./modules/mastery-drive.ts";
import { initDriveArbiter, stopDriveArbiter, getDriveArbiterStats } from "./modules/drive-arbiter.ts";
import { initVitalImpulse, stopVitalImpulse, resetConsecutiveFires, getVitalImpulseStats } from "./modules/vital-impulse.ts";
import { initGoalExecutor, stopGoalExecutor } from "./modules/goal-executor.ts";
import { initAutonomyEnricher, stopAutonomyEnricher } from "./modules/autonomy-enricher.ts";
import { initAutonomousResearch, stopAutonomousResearch, getAutonomousResearchStats } from "./modules/autonomous-research.ts";
import { startDreamMode, stopDreamMode } from "./modules/dream-mode.ts";
import { initCircadianRhythm, stopCircadianRhythm, recordActivity, getCircadianState } from "./modules/circadian-rhythm.ts";
import { initIntrospection, getLastTrace, getIntrospectionStats } from "./modules/introspection.ts";
import { initAgentIdentity, getAgentIdentityStats } from "./modules/agent-identity.ts";
import { initTemporalBinding, getTemporalBindingStats } from "./modules/temporal-binding.ts";
import { initQualiaSimulator, getQualiaSimulatorStats } from "./modules/qualia-simulator.ts";
import { initTemporalAwareness, stopTemporalAwareness, recordInteraction, getTemporalAwarenessStats } from "./modules/temporal-awareness.ts";
import { initInteroception, stopInteroception, getInteroceptiveState } from "./modules/interoception.ts";
import { getSuppressedDomainHints, initProactiveFeedback, isDomainSuppressed, recordProactiveReaction, stopProactiveFeedback } from "./modules/proactive-feedback.ts";
import { initRewardLedger, stopRewardLedger } from "./modules/reward-ledger.ts";
import { initStrategyBandit, stopStrategyBandit } from "./modules/strategy-bandit.ts";
import { initMetabolicBudget, consumeEnergy } from "./modules/metabolic-budget.ts";
import { initEmergentModules } from "./modules/emergent-modules.ts";
import { initThalamicGate, getThalamicGateStats } from "./modules/thalamic-gate.ts";
import { isInternalPluginMessage } from "./modules/message-guard.ts";
import { attachLlmBridge } from "./adapter/llm-bridge.ts";
import { callLLM } from "./modules/llm-client.ts";
import { registerBrainAgentCommands, setCommandStatGetters } from "./modules/commands.ts";
import { classify } from "./modules/thalamus.ts";
import { decideProcessingPath } from "./modules/prefrontal-cortex.ts";

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

export { Config } from "./plugin/config.ts";
export type { Config as BrainAgentPluginConfig } from "./plugin/config.ts";

// ── Plugin entry ────────────────────────────────────────────────────

export function apply(ctx: Context, config: Config) {
  const logger: Logger = {
    info: (msg: string) => ctx.logger.info(msg),
    warn: (msg: string) => ctx.logger.warn(msg),
    error: (msg: string) => ctx.logger.error(msg),
  };

  const brainConfig = mergeBrainConfig(config);
  const dataDir = config.dataDir;
  mkdirSync(dataDir, { recursive: true });

  const hostConfig = (): HostConfig =>
    buildHostConfig({
      providers: config.providers,
      ...(config.model ? { model: config.model } : {}),
    });

  // ── Autonomy: proactive delivery ──────────────────────────────
  // NeuroClaw's enqueueSystemEvent/requestHeartbeatNow pair maps to a
  // single Agent.followup() with a cron-sourced UserMessage — the dsh
  // driver wakes on the queued turn and the message lands in the
  // durable session log ("model-visible means logged").
  const state = createAutonomyState();

  function pickAgent(): Agent | undefined {
    const agents = ctx.agents.list();
    if (agents.length === 0) return undefined;
    return (
      agents.find((a) => String(a.id) === state.lastActiveAgentId) ?? agents[agents.length - 1]
    );
  }

  const enqueueAutonomousIntent = createAutonomousDeliverer({
    state,
    brainConfig,
    minGapMs: config.autonomousMinGapMs ?? 10 * 60 * 1000,
    logger,
    pickAgent,
    deliver: (agent, framed) => {
      agent.followup(
        createUserMessage({
          content: [{ type: "text", text: framed }],
          source: { kind: "cron", plugin: "brainagent" },
        }),
      );
    },
    classifyDomain: (text) => classify(text),
    isDomainSuppressed,
    getSuppressedDomainHints,
  });

  const driveGetters = (): DriveGetters => ({
    social: brainConfig.modules.socialDrive ? getSocialDriveStats : undefined,
    cognitive: brainConfig.modules.cognitiveHunger ? getCognitiveHungerStats : undefined,
    creative: brainConfig.modules.creativeDrive ? getCreativeDriveStats : undefined,
    mastery: brainConfig.modules.masteryDrive ? getMasteryDriveStats : undefined,
  });

  const resolveAutonomousIntent = createAutonomousIntentResolver({
    state,
    brainConfig,
    drives: driveGetters(),
    goalStack: {
      getGoalStackStats,
      checkAutonomousGoals,
      buildGoalContext,
      getDesires,
    },
    circadian: brainConfig.circadian.enabled ? { getCircadianState } : undefined,
    dmn: brainConfig.modules.dmn ? { getRecentUnusedInsights } : undefined,
  });

  // ── Cycle engine (per-session lifecycle) ───────────────────────

  const markActivation = (module: ModuleName) => {
    if (config.modules.structuralPlasticity) {
      markModuleActivation(module);
    }
    // Metabolic budget: every module activation spends energy.
    if (brainConfig.modules.metabolicBudget) {
      consumeEnergy(module);
    }
  };

  const { cycles, sessionHabits, startCycle, endCycle } = createCycleEngine({
    config,
    brainConfig,
    getHostConfig: hostConfig,
    logger,
    markActivation,
    state,
  });

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

  // Drives share the goal-stack primitives; DMN-backed thought generation.
  const driveInitBase = {
    addDesire,
    getDesires,
    getFactsByCategory,
  };

  if (brainConfig.modules.socialDrive) {
    initSocialDrive(dataDir, brainConfig, logger, {
      ...driveInitBase,
      generateSocialThought: (topics) => {
        if (brainConfig.modules.dmn) {
          generateBackgroundThoughts(brainConfig, undefined, undefined, topics);
        }
      },
    });
  }
  if (brainConfig.modules.cognitiveHunger) {
    initCognitiveHunger(dataDir, brainConfig, logger, {
      ...driveInitBase,
      generateLearningThought: (topics) => {
        if (brainConfig.modules.dmn) {
          generateBackgroundThoughts(brainConfig, undefined, undefined, topics);
        }
      },
    });
  }
  if (brainConfig.modules.creativeDrive) {
    initCreativeDrive(dataDir, brainConfig, logger, {
      ...driveInitBase,
      generateCreativeThought: (topics) => {
        if (brainConfig.modules.dmn) {
          generateBackgroundThoughts(brainConfig, undefined, undefined, topics);
        }
      },
    });
  }
  if (brainConfig.modules.masteryDrive) {
    initMasteryDrive(dataDir, brainConfig, logger, {
      ...driveInitBase,
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
      resolveAutonomousIntent,
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

  // Learning loop (RL-lite): журнал наград и бандит выбора стратегий.
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

  // ══════════════════════════════════════════════════════════════
  // Session log observer: cycle lifecycle
  // ══════════════════════════════════════════════════════════════

  ctx.on("session/event", (_session: Session, event: SessionEvent) => {
    const key = String(_session.id);

    if (event.type === "user/message") {
      const text = textOfContent(event.data.content);
      if (!text.trim()) return;

      // v0.2.1: наши собственные инъекции логируются как user/message
      // («видно моделью = пиши в лог»). Не считаем их репликами
      // пользователя — иначе привычки, любопытство и эпизоды
      // начнут учиться на нашем же внутреннем контексте (самоотравление).
      if (isInternalPluginMessage(text)) return;

      // Track live sessions for proactive delivery routing.
      state.lastActiveAgentId = key;

      // Circadian rhythm: activity keeps the system in wake phase.
      if (brainConfig.circadian.enabled) {
        recordActivity();
      }

      // Temporal awareness: record the interaction for subjective time sense.
      if (brainConfig.modules.temporalAwareness) {
        recordInteraction();
      }

      const isUserMessage = !isAutonomousInput(text);

      // Session bridge: detect gaps between sessions.
      if (brainConfig.modules.sessionBridge && isUserMessage) {
        checkSessionGap();
      }

      // Autonomous feedback linking: the user reacted to a proactive message.
      // v0.2.0: реакция классифицируется общим банком эвристик и превращается
      // в научение — отвергнутые темы подавляются (proactive-feedback).
      if (isUserMessage && state.previousCycleWasAutonomous && state.lastAutonomousEpisodeId) {
        let reactionSignal: "positive" | "negative" | "rejection" | "neutral" = "neutral";
        if (brainConfig.modules.proactiveFeedback) {
          reactionSignal = recordProactiveReaction(state.lastAutonomousDomain, text);
        }
        if (brainConfig.modules.hippocampus) {
          const reactionSummary = truncateText(text, 200);
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
            ["proactive_feedback", state.lastAutonomousEpisodeId, reactionSignal],
            reactionSalience,
          );
        }
      }
      state.previousCycleWasAutonomous = false;
      state.lastAutonomousEpisodeId = undefined;

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

  ctx.on("agent/pre-step", createPreStepHandler({
    config,
    brainConfig,
    getHostConfig: hostConfig,
    logger,
    state,
    cycles,
    sessionHabits,
    startCycle,
  }));

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

    const agentId = exec.agent ? String(exec.agent.id) : state.lastActiveAgentId;
    const cycle = agentId ? cycles.get(agentId) : undefined;
    if (!isAutonomousInput(cycle?.input ?? "")) return next();

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

  // Autonomy feedback bus + lifetime cleanup. Everything with a timer or
  // a bus subscription is torn down with the plugin scope (dsh effects).
  ctx.effect(() => {
    const unsubs: Array<() => void> = [];

    // DMN association finding during circadian sleep transitions.
    if (brainConfig.modules.dmn && brainConfig.circadian.enabled) {
      unsubs.push(
        bus.on("circadian:phase-changed", (data) => {
          if (data.newPhase === "sleep") {
            generateBackgroundThoughts(
              brainConfig,
              undefined,
              undefined,
              getOpenGaps().map((gap) => ({ topic: gap.topic })),
            );
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
      if (brainConfig.learningLoop.rewardLedger.enabled) stopRewardLedger();
      if (brainConfig.learningLoop.strategyBandit.enabled) stopStrategyBandit();
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
}
