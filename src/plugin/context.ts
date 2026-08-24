/**
 * BrainAgent — Context assembly (agent/pre-step handler).
 *
 * Runs before the model is invoked: LLM enrichment of the phase-1
 * classifiers, hippocampus recall (attention-modulated), then assembly of
 * every module's prompt injection (predictive, habits, pathways, learning,
 * style, working memory, session bridge, goals, volition, DMN, curiosity,
 * vital impulse, arbiter, introspection, identity, temporal binding,
 * qualia, interoception, temporal awareness) filtered by the attention
 * gate and appended to the admitted message batch.
 */

import type { Agent, PreStepDecision } from "@deepseek-ai/dsh-agent";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import type { UserMessage } from "@deepseek-ai/dsh-session";
import type { HostConfig } from "../modules/host-config.ts";
import { bus } from "../modules/event-bus.ts";
import { assessWithAI } from "../modules/amygdala.ts";
import { observeWithAI, getStyleRecommendation } from "../modules/mirror-neurons.ts";
import { detectReinforcementWithAI, findHabit, buildHabitContext } from "../modules/basal-ganglia.ts";
import { isAIProviderAvailable } from "../modules/ai-extractor.ts";
import { getAttentionLevel, getNeuromodulatorState } from "../modules/dopamine-system.ts";
import { recallAllAsync } from "../modules/hippocampus.ts";
import { predict } from "../modules/predictive-engine.ts";
import { buildNeuromodulatorContext } from "../modules/neural-pathways.ts";
import { buildLearningContext, buildCapabilityContext } from "../modules/learning-coordinator.ts";
import { buildWorkingMemoryContext } from "../modules/working-memory.ts";
import { buildSessionBridgeContext } from "../modules/session-bridge.ts";
import { buildGoalContext, buildVolitionContext } from "../modules/goal-stack.ts";
import { buildBackgroundThoughtContext, getRecentUnusedInsights } from "../modules/dmn.ts";
import { buildCuriosityContext } from "../modules/curiosity-drive.ts";
import { consumeMotivation } from "../modules/vital-impulse.ts";
import { buildArbiterContext } from "../modules/drive-arbiter.ts";
import { buildConfidenceContext } from "../modules/introspection.ts";
import {
  buildIdentityContext,
  buildMemorySelfKnowledgeContext,
} from "../modules/agent-identity.ts";
import { buildTemporalContext } from "../modules/temporal-binding.ts";
import { buildQualiaContext } from "../modules/qualia-simulator.ts";
import { buildInteroceptionContext } from "../modules/interoception.ts";
import { buildTemporalContext as buildTemporalAwarenessContext } from "../modules/temporal-awareness.ts";
import { filterContextInjections } from "../modules/attention-gate.ts";
import { assembleContext } from "../modules/prefrontal-cortex.ts";
import { recordInjectionCycle } from "../modules/injection-metrics.ts";
import { isResearchIntent, executeResearch } from "../modules/autonomous-research.ts";
import { AUTONOMOUS_TAG, textOfContent } from "./config.ts";
import type { Config } from "./config.ts";
import type { CycleState } from "./cycles.ts";
import type { AutonomyState } from "./autonomy.ts";
import type { BrainAgentConfig, BrainState } from "../modules/types.ts";

export type PreStepDeps = {
  config: Config;
  brainConfig: BrainAgentConfig;
  getHostConfig: () => HostConfig;
  logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
  /** Shared autonomy state (last autonomous source drives research routing). */
  state: AutonomyState;
  cycles: Map<string, CycleState>;
  /** Habit matched in cycle N is reinforced by the user's next message (N+1). */
  sessionHabits: Map<string, string | undefined>;
  startCycle: (key: string, text: string) => CycleState;
};

export type PreStepPayload = { agent: Agent; messages: UserMessage[] };
export type PreStepNext = () => Promise<PreStepDecision>;

export function createPreStepHandler(deps: PreStepDeps) {
  const { config, brainConfig, getHostConfig, logger, state, cycles, startCycle } = deps;

  return async (payload: PreStepPayload, next: PreStepNext): Promise<PreStepDecision> => {
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

    const isAutonomousCycle = input.startsWith(AUTONOMOUS_TAG);

    // ── Autonomous research: intercept research-type autonomous cycles ──
    // When a cognitive drive or understanding desire fires, run isolated
    // research instead of letting web tools bloat the main session. The
    // raw web data never enters the session — only a compact summary.
    if (
      brainConfig.modules.autonomousResearch &&
      isAutonomousCycle &&
      isResearchIntent(state.lastAutonomousSource, input)
    ) {
      const topic =
        input
          .replace(/<\/?autonomous-intent>/g, "")
          .split("\n")
          .filter((l) => l.trim().length > 5)[0]
          ?.trim() ?? "general exploration";
      logger.info(
        `BrainAgent AutonomousResearch: detected research intent (source=${state.lastAutonomousSource}), running isolated pipeline for "${topic}"`,
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
    if (config.modules.aiEnrichment && isAIProviderAvailable(getHostConfig())) {
      const hc = getHostConfig();
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
        deps.sessionHabits.set(key, habitMatch.habit.id);
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

    const brainState: BrainState = {
      input,
      classification: cyc.classification,
      priority: cyc.assessment,
      relevantMemories: recalled,
      contextInjections: filtered,
    };

    const contextText = assembleContext(brainState).trim();

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
  };
}
