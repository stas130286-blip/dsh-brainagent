/**
 * BrainAgent — Cycle engine.
 *
 * One "cycle" = one user (or autonomous) message → response → turn end.
 * `startCycle` runs the phase-1 classifiers (Thalamus, Amygdala, Mirror
 * Neurons, Predictive Engine, Basal Ganglia) and opens an introspection
 * trace; `endCycle` runs validation (Cerebellum), memory storage
 * (episodic/semantic/procedural), reward distribution (dopamine) and the
 * phase-3/4 end-of-cycle processing.
 *
 * All per-cycle state lives in the engine-owned `cycles` Map keyed by
 * SessionId — parallel sessions cannot bleed into each other. Module
 * singletons (storage, stat getters) are imported directly: they are
 * process-global by design, exactly as in the previous monolithic apply().
 */

import type { HostConfig } from "../modules/host-config.ts";
import { bus } from "../modules/event-bus.ts";
import { updateEmbeddingsConfig } from "../modules/hippocampus.ts";
import { classify } from "../modules/thalamus.ts";
import { assess } from "../modules/amygdala.ts";
import { observe } from "../modules/mirror-neurons.ts";
import { observeInteraction } from "../modules/predictive-engine.ts";
import { detectReinforcement, reinforce, recordPattern as recordBasalPattern } from "../modules/basal-ganglia.ts";
import { startTrace, addTraceStep, completeTrace, reflectOnConsciousness } from "../modules/introspection.ts";
import { resetCycleState } from "../modules/neural-pathways.ts";
import { truncateForWorkingMemory, storeCompletedCycle } from "../modules/working-memory.ts";
import { isAIProviderAvailable, extractFactsWithAI } from "../modules/ai-extractor.ts";
import { validate, validateAsync } from "../modules/cerebellum.ts";
import { storeEpisode, storeFact, storeWorkflow } from "../modules/hippocampus.ts";
import { extractFacts, isFactWorthy } from "../modules/semantic-extractor.ts";
import { isProcedural, extractProcedureAsync, isStorableProcedure } from "../modules/procedural-extractor.ts";
import { processInteractionOutcome, getNeuromodulatorState } from "../modules/dopamine-system.ts";
import { getUserModel, processStyleReward } from "../modules/mirror-neurons.ts";
import { endCycle as endStructuralCycle } from "../modules/structural-plasticity.ts";
import { recordDomainPerformance, recordRecurringIssue } from "../modules/learning-coordinator.ts";
import { recordPattern as recordEmergentPattern } from "../modules/emergent-modules.ts";
import { recordPerformance, endCycle as endMetabolicCycle } from "../modules/metabolic-budget.ts";
import { recordDomainOutcome, recordSignificantExperience } from "../modules/agent-identity.ts";
import { generateQualiaAsync, tagEmotionalContext } from "../modules/emotional-memory.ts";
import { generateQualiaState } from "../modules/qualia-simulator.ts";
import { generateBackgroundThoughts, runAssociationFinding } from "../modules/dmn.ts";
import { createMoment } from "../modules/temporal-binding.ts";
import { recordCycleForSession } from "../modules/session-bridge.ts";
import {
  detectKnowledgeGap,
  markGapFilled,
  getOpenGaps,
} from "../modules/curiosity-drive.ts";
import {
  getDesires,
  addDesire,
  extractGoalsFromConversation,
  hasGoalIntent,
  tickExplorationBoosts,
} from "../modules/goal-stack.ts";
import { getSocialDriveStats } from "../modules/social-drive.ts";
import { getCognitiveHungerStats } from "../modules/cognitive-hunger.ts";
import { getCreativeDriveStats } from "../modules/creative-drive.ts";
import { getMasteryDriveStats } from "../modules/mastery-drive.ts";
import { isAutonomousInput, meetsComplexityThreshold, truncateText } from "./config.ts";
import type { Config } from "./config.ts";
import type { AutonomyState, DriveGetters } from "./autonomy.ts";
import { synthesizeAutonomousCycleState } from "./autonomy.ts";
import type {
  AmygdalaAssessment,
  BrainAgentConfig,
  EmotionLabel,
  Goal,
  MessageDomain,
  ModuleName,
  ThalamusClassification,
  UserModel,
} from "../modules/types.ts";

export type Logger = { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };

export type CycleState = {
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

export type CycleEngineDeps = {
  /** Raw plugin config (recall limits, module toggles consumed here). */
  config: Config;
  /** Merged brain config (module flags + nested settings). */
  brainConfig: BrainAgentConfig;
  /** Lazily-built host config (env creds may change between cycles). */
  getHostConfig: () => HostConfig;
  logger: Logger;
  /** Per-module activation bookkeeping (plasticity + metabolic budget). */
  markActivation: (module: ModuleName) => void;
  /** Shared autonomy state (proactive delivery bookkeeping). */
  state: AutonomyState;
};

export type CycleEngine = {
  cycles: Map<string, CycleState>;
  /** Habit matched in cycle N is reinforced by the user's next message (N+1). */
  sessionHabits: Map<string, string | undefined>;
  startCycle: (key: string, text: string) => CycleState;
  endCycle: (key: string) => Promise<void>;
};

/** Modules that participate in reward distribution & metabolic accounting. */
function participatingModules(brainConfig: BrainAgentConfig): ModuleName[] {
  const modules: ModuleName[] = [];
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

/** Live drive stats for autonomous-cycle emotion synthesis. */
function driveGetters(brainConfig: BrainAgentConfig): DriveGetters {
  return {
    social: brainConfig.modules.socialDrive ? getSocialDriveStats : undefined,
    cognitive: brainConfig.modules.cognitiveHunger ? getCognitiveHungerStats : undefined,
    creative: brainConfig.modules.creativeDrive ? getCreativeDriveStats : undefined,
    mastery: brainConfig.modules.masteryDrive ? getMasteryDriveStats : undefined,
  };
}

export function createCycleEngine(deps: CycleEngineDeps): CycleEngine {
  const { config, brainConfig, getHostConfig, logger, markActivation, state } = deps;

  const cycles = new Map<string, CycleState>();
  const sessionHabits = new Map<string, string | undefined>();

  // Counters for periodic autonomous processing (per plugin lifetime).
  let wakeInteractionCount = 0;
  let goalExtractionCounter = 0;

  function startCycle(key: string, text: string): CycleState {
    // Refresh embedding provider in case credentials changed since boot.
    updateEmbeddingsConfig(getHostConfig());

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
    const isAutonomousCycle = isAutonomousInput(input);

    // v0.9.18: фиксируем время настоящего сообщения пользователя —
    // для тихого гарда проактивных доставок (не вклиниваться после диалога).
    if (!isAutonomousCycle) {
      state.lastUserMessageAt = Date.now();
    }

    // ── Autonomous cycle: synthesize emotion + domain from drive state ──
    // When the cycle was triggered by drives (not the user), derive the
    // emotional context from the active drives instead of the
    // keyword-based amygdala.
    if (isAutonomousCycle) {
      synthesizeAutonomousCycleState(brainConfig, driveGetters(brainConfig), cycle);
    }

    const emotion = cycle.assessment?.emotion ?? "neutral";
    const intensity = cycle.assessment?.emotionIntensity ?? 0;
    const responseSnippet = truncateForWorkingMemory(cycle.responseText);
    const aiAvailable = config.modules.aiEnrichment && isAIProviderAvailable(getHostConfig());

    // ── Cerebellum: quality validation at turn end ──
    // dsh cannot rewrite the outgoing stream, so findings feed learning
    // (dopamine + learning coordinator) instead of message correction.
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
        const responseSummary = truncateText(cycle.responseText, 200);
        const episode = storeEpisode(
          `Agent proactively said: ${responseSummary}`,
          `Proactive message (${cycle.classification?.domain ?? "unknown"} domain)`,
          emotion,
          ["proactive_message", ...(cycle.classification ? [cycle.classification.domain] : [])],
          intensity,
        );
        episodeId = episode.id;
        // Track for feedback linking on the next user message.
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
          intensity,
        );
        episodeId = episode.id;
      }
    }

    // ── Semantic memory: extract facts ──
    // v0.9.22: автономные циклы больше не учатся на собственных репликах.
    // Раньше ответ агента на своё же напоминание («Стас, 3 минуты прошли…»)
    // извлекался как факт категории definition — память отравлялась
    // собственными словами. Эпизод «что я сказал» уже сохранён выше;
    // семантические знания — только из реплик пользователя.
    const semanticSource = isAutonomousCycle ? "" : input;
    if (
      config.modules.semanticExtraction &&
      semanticSource.length > 15 &&
      isFactWorthy(semanticSource, cycle.classification)
    ) {
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
      const procedure = await extractProcedureAsync(input, getHostConfig(), cycle.classification, logger);
      // v0.9.13: храним только настоящие многоступенчатые процедуры.
      // Одиночные команды («Action: ANY», «Действие: напоминание»)
      // процедурой не являются — они засоряли стор (14 из 16 записей
      // в боевом сторе оказались мусором без переиспользования).
      if (procedure && isStorableProcedure(procedure)) {
        storeWorkflow(procedure.description, procedure.triggerPattern, procedure.steps);
        logger.info(`BrainAgent Procedural: stored workflow "${procedure.description}"`);
      }
    }

    // ── Basal ganglia: record this interaction for habit formation ──
    if (brainConfig.modules.basalGanglia && input.length > 5 && cycle.classification) {
      const domain = cycle.classification.domain;
      recordBasalPattern(input.slice(0, 300), [domain], domain);
    }

    // ── Dopamine: compute global reward and distribute to modules ──
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
      const participants = participatingModules(brainConfig);

      // Emergent modules: recurring co-activation patterns worth bundling.
      if (brainConfig.modules.emergentModules && participants.length >= 2 && reward > 0.3) {
        recordEmergentPattern(
          participants,
          cycle.classification?.domain ?? "unknown",
          reward,
        );
      }

      // Metabolic budget: record per-module performance, regenerate energy.
      if (brainConfig.modules.metabolicBudget) {
        for (const module of participants) {
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
              getHostConfig(),
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
          truncateText(input, 100),
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
      // v0.9.18: приветствия и тривиальности — не пробел в знаниях, иначе
      // «Привет! Как дела?» становится «незакрытым вопросом» и поводом для инициативы.
      if (cycle.classification.complexity !== "trivial") {
        const recallSparse = cycle.recalledMemoryIds.length <= 1;
        detectKnowledgeGap(input.slice(0, 100), cycle.classification.domain, recallSparse);
      }

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

    // Goal stack: LLM-based goal extraction. v0.9.4: явные
    // формулировки целей («планирую…», «напомни…») извлекаются
    // сразу; периодика раз в extractionInterval реплик сохранена
    // как фоновый механизм для неявных целей.
    if (brainConfig.modules.goalStack && input.length > 10) {
      goalExtractionCounter++;
      // v0.9.4: автономные циклы (<goal_round>… и инициативы) содержат
      // слова «цель»/«план» — детектор срабатывал на них каждые
      // 2 секунды и впустую дёргал LLM. Явное извлечение — только
      // на репликах пользователя.
      const explicitGoalIntent = !isAutonomousCycle && hasGoalIntent(input);
      if (explicitGoalIntent || goalExtractionCounter >= brainConfig.goalStack.extractionInterval) {
        goalExtractionCounter = 0;
        logger.info(
          `BrainAgent GoalStack: triggering goal extraction (every ${brainConfig.goalStack.extractionInterval} interactions)`,
        );
        void extractGoalsFromConversation(input, getHostConfig(), logger).catch((err) => {
          logger.info(`BrainAgent GoalStack: extraction error: ${err}`);
        });
      }
    }

    // Exploration boost decay.
    if (brainConfig.modules.goalStack) {
      tickExplorationBoosts();
    }

    // Reset the autonomous source marker for the next cycle.
    state.lastAutonomousSource = "";
  }

  return { cycles, sessionHabits, startCycle, endCycle };
}
