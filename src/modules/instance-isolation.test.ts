import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { createWorkingMemory } from "./working-memory.ts";
import { createAttentionGate } from "./attention-gate.ts";
import { createTemporalBinding } from "./temporal-binding.ts";
import { createPredictiveEngine } from "./predictive-engine.ts";
import { createBasalGanglia } from "./basal-ganglia.ts";
import { createMirrorNeurons } from "./mirror-neurons.ts";
import { createInteroception } from "./interoception.ts";
import { createRewardLedger } from "./reward-ledger.ts";
import { createTemporalAwareness } from "./temporal-awareness.ts";
import { createCircadianRhythm } from "./circadian-rhythm.ts";
import { createMetabolicBudget } from "./metabolic-budget.ts";
import { createDopamineSystem } from "./dopamine-system.ts";
import { createStrategyBandit } from "./strategy-bandit.ts";
import { createLearningCoordinator } from "./learning-coordinator.ts";
import { createNeuralPathways } from "./neural-pathways.ts";
import { createHippocampus } from "./hippocampus.ts";
import { createEmotionalMemory } from "./emotional-memory.ts";
import { createSessionBridge } from "./session-bridge.ts";
import { createDreamMode } from "./dream-mode.ts";
import { createDMN } from "./dmn.ts";
import { createCuriosityDrive } from "./curiosity-drive.ts";
import { createDriveArbiter } from "./drive-arbiter.ts";
import { createIntrospection } from "./introspection.ts";
import { createThalamicGate } from "./thalamic-gate.ts";
import { createQualiaSimulator } from "./qualia-simulator.ts";
import { createStructuralPlasticity } from "./structural-plasticity.ts";
import { createEmergentModules } from "./emergent-modules.ts";
import { createProactiveFeedback } from "./proactive-feedback.ts";
import { createLLMClient } from "./llm-client.ts";
import { createAIEmbeddings } from "./ai-embeddings.ts";
import { createAutonomyEnricher, type AutonomyEnricherDeps } from "./autonomy-enricher.ts";
import { createGoalStack } from "./goal-stack.ts";
import { createAgentIdentity } from "./agent-identity.ts";
import { createMasteryDrive } from "./mastery-drive.ts";
import { createVitalImpulse } from "./vital-impulse.ts";
import { createCommandRegistry } from "./commands.ts";
import { Context } from "@deepseek-ai/cordis";
import { BRAINAGENT_VERSION, createBrainAgentService, provideBrainAgentService } from "../plugin/service.ts";
import type { BrainAgentServiceDeps } from "../plugin/service.ts";
import { bus } from "./event-bus.ts";
import type { HostConfig } from "./host-config.ts";
import {
  DEFAULT_CONFIG,
  type Desire,
  type DopamineSignal,
  type SemanticMemory,
  type WorkingMemoryEntry,
} from "./types.ts";

let dirs: string[] = [];

function makeDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  }
  dirs = [];
});

function makeEntry(snippet: string): WorkingMemoryEntry {
  return {
    timestamp: Date.now(),
    inputSnippet: snippet,
    responseSnippet: "ответ",
    emotion: "neutral",
    emotionIntensity: 0,
    domain: "casual",
    complexity: "simple",
    cerebellumPassed: true,
    reward: 0,
    recalledMemoryIds: [],
  };
}

describe("per-instance состояние пакета B (v0.6.2)", () => {
  it("фабрика working memory создаёт независимые буферы", () => {
    const a = createWorkingMemory(makeDir("brainagent-wm-a-"), {
      maxEntries: 7,
      summaryMaxLength: 10,
    });
    const b = createWorkingMemory(makeDir("brainagent-wm-b-"), {
      maxEntries: 7,
      summaryMaxLength: 10,
    });

    a.storeCompletedCycle(makeEntry("первый"));
    a.storeCompletedCycle(makeEntry("второй"));

    expect(a.getStats().entryCount).toBe(2);
    // Второй инстанс не видит записи первого
    expect(b.getStats().entryCount).toBe(0);
    expect(b.buildContext("x")).toBeUndefined();

    // Конфигурация инстанса (summaryMaxLength) применяется к truncate
    expect(a.truncate("12345678901234567")).toBe("1234567890...");
    expect(a.truncate("короткая")).toBe("короткая");
  });

  it("фабрика attention gate создаёт независимые счётчики", () => {
    const a = createAttentionGate(makeDir("brainagent-ag-a-"));
    const b = createAttentionGate(makeDir("brainagent-ag-b-"));

    const kept = a.filter(["яблоко это фрукт"], "яблоко", 0, DEFAULT_CONFIG);
    expect(kept.length).toBe(1);
    expect(a.getStats().totalProcessed).toBe(1);
    // Второй инстанс не видит фильтраций первого
    expect(b.getStats().totalProcessed).toBe(0);
    expect(b.getStats().totalDropped).toBe(0);
  });

  it("фабрика temporal binding создаёт независимые потоки моментов", () => {
    const a = createTemporalBinding(makeDir("brainagent-tb-a-"), { maxMoments: 30 });
    const b = createTemporalBinding(makeDir("brainagent-tb-b-"), { maxMoments: 30 });

    a.createMoment("привет", [], "neutral", 0, [], [], 0.5, "casual");
    a.createMoment("пока", [], "neutral", 0, [], [], 0.5, "casual");

    expect(a.getStats().momentCount).toBe(2);
    expect(a.getMomentStream()[1].causalLinkId).toBe(a.getCurrentMoment()?.causalLinkId);
    // Второй инстанс не видит моменты первого
    expect(b.getStats().momentCount).toBe(0);
    expect(b.buildContext()).toBeUndefined();
  });
});

describe("per-instance состояние пакета B2 (v0.6.3)", () => {
  it("фабрика predictive engine создаёт независимые паттерны", () => {
    const a = createPredictiveEngine(makeDir("brainagent-pe-a-"));
    const b = createPredictiveEngine(makeDir("brainagent-pe-b-"));

    a.observeInteraction("technical", ["code"]);
    a.observeInteraction("creative", ["design"]);

    expect(a.getStats().totalObservations).toBe(2);
    // Второй инстанс не видит наблюдения первого
    expect(b.getStats().totalObservations).toBe(0);
    expect(b.getStats().temporalPatterns).toBe(0);
  });

  it("фабрика basal ganglia создаёт независимые хранилища привычек", () => {
    const a = createBasalGanglia(makeDir("brainagent-bg-a-"));
    const b = createBasalGanglia(makeDir("brainagent-bg-b-"));

    a.recordPattern("deploy production app", ["build", "deploy"], "technical");

    expect(a.getStats().totalHabits).toBe(1);
    expect(a.findHabit("deploy app", "technical")).toBeDefined();
    // Второй инстанс не видит привычки первого
    expect(b.getStats().totalHabits).toBe(0);
    expect(b.findHabit("deploy app", "technical")).toBeUndefined();
  });

  it("фабрика mirror neurons создаёт независимые модели пользователей", () => {
    const a = createMirrorNeurons(makeDir("brainagent-mn-a-"));
    const b = createMirrorNeurons(makeDir("brainagent-mn-b-"));

    a.getOrCreateModel("user1");

    expect(a.getUserModel("user1")).toBeDefined();
    // Второй инстанс не видит модель первого
    expect(b.getUserModel("user1")).toBeUndefined();
    // Но лениво создаёт свою при getOrCreateModel
    expect(b.getOrCreateModel("user1").userId).toBe("user1");
    expect(a.getUserModel("user2")).toBeUndefined();
  });
});

describe("per-instance состояние пакета C (v0.6.4)", () => {
  it("фабрика reward ledger создаёт независимые журналы наград", () => {
    const a = createRewardLedger(makeDir("brainagent-rl-a-"), DEFAULT_CONFIG);
    const b = createRewardLedger(makeDir("brainagent-rl-b-"), DEFAULT_CONFIG);

    a.record("manual", 0.5);

    expect(a.getRecentEntries()).toHaveLength(1);
    // Второй инстанс не видит записи первого
    expect(b.getRecentEntries()).toHaveLength(0);
    expect(b.getStats().entries).toBe(0);

    a.stop();
    b.stop();
  });

  it("фабрика temporal awareness создаёт независимые счётчики взаимодействий", () => {
    const a = createTemporalAwareness(makeDir("brainagent-ta-a-"), DEFAULT_CONFIG);
    const b = createTemporalAwareness(makeDir("brainagent-tb2-b-"), DEFAULT_CONFIG);

    a.recordInteraction();
    a.recordInteraction();

    expect(a.getStats().totalInteractions).toBe(2);
    // Второй инстанс не видит взаимодействия первого
    expect(b.getStats().totalInteractions).toBe(0);

    a.stop();
    b.stop();
  });

  it("фабрика interoception создаёт независимые внутренние состояния", () => {
    // Инстансы с разными геттерами потребностей
    const a = createInteroception({
      getSocialDriveStats: () => ({ need: 0.9 }) as never,
    });
    const b = createInteroception({
      getCognitiveHungerStats: () => ({ need: 0.9 }) as never,
    });

    // Событие на шине заставляет оба инстанса пересчитать состояние,
    // но каждый классифицирует по своим геттерам
    bus.emitSync("dopamine:reward", {
      reward: 0.5,
      predictionError: 0,
      participatingModules: [],
      creditAssignment: {},
      context: { domain: "casual", complexity: "simple", emotion: "neutral", input: "test" },
    } as DopamineSignal);

    expect(a.getState()).not.toBeNull();
    expect(b.getState()).not.toBeNull();
    // Социальная потребность видна только в инстансе A
    expect(a.getState()?.driveNeeds.social).toBeCloseTo(0.9, 3);
    expect(b.getState()?.driveNeeds.social).toBe(0);
    // Познавательный голод — только в инстансе B
    expect(a.getState()?.driveNeeds.cognitive).toBe(0);
    expect(b.getState()?.driveNeeds.cognitive).toBeCloseTo(0.9, 3);

    a.stop();
    b.stop();
  });
});

describe("per-instance состояние пакета D (v0.6.5)", () => {
  it("фабрика dopamine system создаёт независимые нейромодуляторные состояния", () => {
    const a = createDopamineSystem(makeDir("brainagent-ds-a-"));
    const b = createDopamineSystem(makeDir("brainagent-ds-b-"));

    a.processOutcome(
      {
        cerebellumPassed: true,
        cerebellumIssues: [],
        userSignal: "positive",
        participatingModules: ["thalamus"],
        domain: "technical",
        complexity: "simple",
        emotion: "neutral",
        input: "test",
        habitAutoExecuted: false,
      },
      DEFAULT_CONFIG,
    );

    expect(a.getStats().totalInteractions).toBe(1);
    // Второй инстанс не видит обработки первого
    expect(b.getStats().totalInteractions).toBe(0);

    a.stop();
    b.stop();
  });

  it("фабрика metabolic budget создаёт независимые бюджеты энергии", () => {
    const a = createMetabolicBudget(makeDir("brainagent-mb-a-"), DEFAULT_CONFIG);
    const b = createMetabolicBudget(makeDir("brainagent-mb-b-"), DEFAULT_CONFIG);

    a.consumeEnergy("thalamus", 0.5);

    expect(a.getModuleEnergy("thalamus")).toBeCloseTo(0.5, 3);
    // Второй инстанс не видит траты энергии первого
    expect(b.getModuleEnergy("thalamus")).toBe(1.0);

    a.stop();
    b.stop();
  });

  it("фабрика circadian rhythm создаёт независимые фазы сна", () => {
    const a = createCircadianRhythm(makeDir("brainagent-cr-a-"), DEFAULT_CONFIG);
    const b = createCircadianRhythm(makeDir("brainagent-cr-b-"), DEFAULT_CONFIG);

    a.forcePhase("sleep");

    expect(a.getState().phase).toBe("sleep");
    expect(a.isInSleepPhase()).toBe(true);
    // Второй инстанс остаётся в фазе бодрствования
    expect(b.getState().phase).toBe("wake");
    expect(b.isInWakePhase()).toBe(true);

    a.stop();
    b.stop();
  });
});

describe("per-instance состояние пакета E (v0.6.6)", () => {
  it("фабрика strategy bandit создаёт независимые таблицы стратегий", () => {
    const a = createStrategyBandit(makeDir("brainagent-sb-a-"), DEFAULT_CONFIG);
    const b = createStrategyBandit(makeDir("brainagent-sb-b-"), DEFAULT_CONFIG);

    a.recordOutcome("dp", "arm", 1);

    expect(a.getBanditStats().totalPlays).toBe(1);
    expect(a.getArmStats("dp").arm.meanReward).toBe(1);
    // Второй инстанс не видит исходы первого
    expect(b.getBanditStats().totalPlays).toBe(0);
    expect(b.getArmStats("dp")).toEqual({});

    a.stop();
    b.stop();
  });

  it("фабрика learning coordinator создаёт независимую метрику доменов", () => {
    const a = createLearningCoordinator(makeDir("brainagent-lc-a-"), DEFAULT_CONFIG);
    const b = createLearningCoordinator(makeDir("brainagent-lc-b-"), DEFAULT_CONFIG);

    a.recordDomainPerformance("technical", 0.8);

    expect(a.getDomainPerformance("technical")?.cycleCount).toBe(1);
    // Второй инстанс не видит производительность доменов первого
    expect(b.getDomainPerformance("technical")).toBeUndefined();
    expect(b.getStats().moduleCount).toBe(0);

    a.stop();
    b.stop();
  });

  it("фабрика neural pathways создаёт независимые цикловые состояния", () => {
    const a = createNeuralPathways(makeDir("brainagent-np-a-"), DEFAULT_CONFIG);
    const b = createNeuralPathways(makeDir("brainagent-np-b-"), DEFAULT_CONFIG);

    // Событие на шине видят оба инстанса — каждый запоминает свой habitId
    bus.emitSync("basal:habit-matched", {
      habitId: "iso-habit",
      matchScore: 0.8,
      autoExecute: false,
    });

    expect(a.getPathwayStats().currentHabitId).toBe("iso-habit");
    expect(b.getPathwayStats().currentHabitId).toBe("iso-habit");

    // Сброс цикла одного инстанса не трогает другой
    a.resetCycleState();
    expect(a.getPathwayStats().currentHabitId).toBeUndefined();
    expect(b.getPathwayStats().currentHabitId).toBe("iso-habit");

    a.stop();
    b.stop();
  });
});

describe("per-instance состояние пакета F (v0.6.7)", () => {
  it("фабрика hippocampus создаёт независимые хранилища памяти", () => {
    const a = createHippocampus(makeDir("brainagent-hc-a-"));
    const b = createHippocampus(makeDir("brainagent-hc-b-"));

    a.storeFact("The sky is blue", "general");
    a.storeEpisode("test event", "event summary");

    expect(a.getStats().semantic).toBe(1);
    expect(a.getStats().episodic).toBe(1);
    expect(a.recallFacts("sky").length).toBeGreaterThan(0);
    // Второй инстанс не видит факты и эпизоды первого
    expect(b.getStats().semantic).toBe(0);
    expect(b.getStats().episodic).toBe(0);
    expect(b.recallFacts("sky")).toEqual([]);

    a.stop();
    b.stop();
  });

  it("фабрика emotional memory создаёт независимые счётчики и историю qualia", () => {
    const a = createEmotionalMemory(makeDir("brainagent-em-a-"), DEFAULT_CONFIG);
    const b = createEmotionalMemory(makeDir("brainagent-em-b-"), DEFAULT_CONFIG);

    a.tagEmotionalContext("joy", 0.9);
    a.generateQualia("joy", 0.8, "technical");

    expect(a.getEmotionalMemoryStats().flashbulbCount).toBe(1);
    expect(a.getQualiaHistory()).toHaveLength(1);
    // Второй инстанс не видит тегов и историю первого
    expect(b.getEmotionalMemoryStats().flashbulbCount).toBe(0);
    expect(b.getQualiaHistory()).toHaveLength(0);

    a.stop();
    b.stop();
  });

  it("фабрика session bridge создаёт независимые аккумуляторы сессий", () => {
    const a = createSessionBridge(makeDir("brainagent-sbr-a-"), DEFAULT_CONFIG);
    const b = createSessionBridge(makeDir("brainagent-sbr-b-"), DEFAULT_CONFIG);

    a.recordCycleForSession("hello");

    expect(a.getSessionBridgeStats().currentCycles).toBe(1);
    // Второй инстанс не видит циклы первого
    expect(b.getSessionBridgeStats().currentCycles).toBe(0);
    expect(b.getSessionBridgeStats().gapDetected).toBe(false);

    a.stop();
    b.stop();
  });
});

describe("per-instance состояние пакета G (v0.6.8)", () => {
  it("фабрика dream mode создаёт независимые сервисы консолидации", () => {
    const a = createDreamMode();
    const b = createDreamMode();

    a.start(DEFAULT_CONFIG);

    expect(a.getStats().isRunning).toBe(true);
    // Второй инстанс не запущен
    expect(b.getStats().isRunning).toBe(false);

    a.stop();
    expect(a.getStats().isRunning).toBe(false);
    expect(b.getStats().lastConsolidation).toBe(0);
  });

  it("фабрика DMN создаёт независимые внутренние монологи", () => {
    const a = createDMN(makeDir("brainagent-dmn-a-"), DEFAULT_CONFIG);
    const b = createDMN(makeDir("brainagent-dmn-b-"), DEFAULT_CONFIG);

    a.generateBackgroundThoughts(DEFAULT_CONFIG, ["What is quantum gravity?"]);

    expect(a.getStats().backgroundThoughts).toBe(1);
    expect(a.getInnerMonologue()).toHaveLength(1);
    // Второй инстанс не видит мысли первого
    expect(b.getStats().backgroundThoughts).toBe(0);
    expect(b.getInnerMonologue()).toHaveLength(0);
    expect(b.buildBackgroundThoughtContext()).toBeUndefined();

    a.stop();
    b.stop();
  });

  it("фабрика DMN с пустым dir живёт в памяти и не трогает диск", () => {
    const a = createDMN("");
    const b = createDMN("");

    a.generateBackgroundThoughts(DEFAULT_CONFIG, undefined, [
      { emotion: "frustration", intensity: 0.8 },
    ]);

    expect(a.getStats().backgroundThoughts).toBe(1);
    expect(b.getStats().backgroundThoughts).toBe(0);

    a.stop();
    b.stop();
  });
});

describe("per-instance состояние пакета H (v0.6.9)", () => {
  it("фабрика curiosity drive создаёт независимые списки пробелов знаний", () => {
    const a = createCuriosityDrive(makeDir("brainagent-cd-a-"), DEFAULT_CONFIG);
    const b = createCuriosityDrive(makeDir("brainagent-cd-b-"), DEFAULT_CONFIG);

    a.detectKnowledgeGap("quantum gravity", "technical", true);

    expect(a.getStats().totalDetected).toBe(1);
    expect(a.getOpenGaps()).toHaveLength(1);
    // Второй инстанс не видит пробелы первого
    expect(b.getStats().totalDetected).toBe(0);
    expect(b.getOpenGaps()).toHaveLength(0);

    a.stop();
    b.stop();
  });

  it("фабрика drive arbiter создаёт независимый выбор драйва", () => {
    const a = createDriveArbiter(makeDir("brainagent-da-a-"), DEFAULT_CONFIG, {
      getSocialDriveStats: () => ({ need: 0.9 }) as never,
    });
    const b = createDriveArbiter(makeDir("brainagent-da-b-"), DEFAULT_CONFIG, {});

    // Событие на шине видят оба инстанса, но выбирает только тот,
    // у кого геттеры отдают активный драйв
    bus.emitSync("social-drive:need-rising", {
      needLevel: "strong",
      satiation: 0.2,
      need: 0.9,
    });

    expect(a.getLastSelectedDrive()).toBe("social");
    // Второй инстанс без геттеров ничего не выбрал
    expect(b.getLastSelectedDrive()).toBeNull();

    a.stop();
    b.stop();
  });

  it("фабрика curiosity drive с пустым dir живёт в памяти и не трогает диск", () => {
    const a = createCuriosityDrive("");
    const b = createCuriosityDrive("");

    a.detectKnowledgeGap("black holes", "technical", true);

    expect(a.getStats().openGaps).toBe(1);
    expect(b.getStats().openGaps).toBe(0);

    a.stop();
    b.stop();
  });
});

describe("per-instance состояние пакета I (v0.7.0)", () => {
  it("фабрика introspection создаёт независимые трассы обработки", () => {
    const a = createIntrospection(makeDir("brainagent-ia-"), DEFAULT_CONFIG);
    const b = createIntrospection(makeDir("brainagent-ib-"), DEFAULT_CONFIG);

    a.startTrace("hello");
    a.addTraceStep("mod", "hook", "output");
    a.completeTrace(true, [], 1);

    expect(a.getIntrospectionStats().traceCount).toBe(1);
    expect(a.getLastTrace()).toBeDefined();
    // Второй инстанс не видит трассы первого
    expect(b.getIntrospectionStats().traceCount).toBe(0);
    expect(b.getLastTrace()).toBeUndefined();
  });

  it("фабрика thalamic gate принимает независимые решения гейтинга", () => {
    const cfg = {
      enabled: true,
      activationThreshold: 0.6,
      minIntervalBetweenActivations: 60_000,
      maxConsecutiveSkips: 30,
      signalWeights: { norepinephrine: 1.0 },
    };
    const heartbeat = { isUserMessage: false, isEventDriven: false, isIntervalHeartbeat: true };

    const a = createThalamicGate(cfg, {
      getNeuromodulatorState: () => ({ norepinephrine: 0.9 }),
    });
    const b = createThalamicGate(cfg, {});

    const now = Date.now();
    const da = a.shouldActivateCortex(heartbeat, now);
    const db = b.shouldActivateCortex(heartbeat, now);

    // У a сильный сигнал норэпинефрина (0.9 >= 0.6) — активация
    expect(da.activate).toBe(true);
    expect(da.dominantSignal).toBe("norepinephrine");
    // У b нет провайдеров — скор 0, гейт пропускает
    expect(db.activate).toBe(false);
    expect(a.getStats().totalActivations).toBe(1);
    expect(b.getStats().totalSkips).toBe(1);
  });

  it("фабрика introspection с пустым dir живёт в памяти и не трогает диск", () => {
    const a = createIntrospection("");
    const b = createIntrospection("");

    a.startTrace("hi");
    a.completeTrace(true, [], 0.5);

    expect(a.getIntrospectionStats().traceCount).toBe(1);
    expect(b.getIntrospectionStats().traceCount).toBe(0);
  });
});

describe("per-instance состояние пакета J (v0.7.0)", () => {
  it("фабрика qualia simulator создаёт независимые журналы переживаний", () => {
    const a = createQualiaSimulator(makeDir("brainagent-qs-a-"), DEFAULT_CONFIG);
    const b = createQualiaSimulator(makeDir("brainagent-qs-b-"), DEFAULT_CONFIG);

    a.generateQualiaState("joy", 0.8, "casual");

    expect(a.getStats().logSize).toBe(1);
    expect(a.getCurrentQualia()?.emotion).toBe("joy");
    expect(a.buildQualiaContext()).toContain("Subjective Experience");
    // Второй инстанс не видит переживания первого
    expect(b.getStats().logSize).toBe(0);
    expect(b.getCurrentQualia()).toBeNull();
    expect(b.buildQualiaContext()).toBeUndefined();
  });

  it("фабрика structural plasticity ведёт независимые циклы ко-активации", () => {
    const a = createStructuralPlasticity(makeDir("brainagent-sp-a-"), DEFAULT_CONFIG);
    const b = createStructuralPlasticity(makeDir("brainagent-sp-b-"), DEFAULT_CONFIG);

    a.markModuleActivation("thalamus");
    a.markModuleActivation("hippocampus");
    a.endCycle(0.5);

    expect(a.getStats().totalCycles).toBe(1);
    expect(a.getStats().coActivationPairs).toBeGreaterThan(0);
    // Второй инстанс не видел активаций первого
    expect(b.getStats().totalCycles).toBe(0);
    expect(b.getStats().coActivationPairs).toBe(0);
  });

  it("фабрика emergent modules открывает паттерны независимо", () => {
    const a = createEmergentModules(makeDir("brainagent-em-a-"), DEFAULT_CONFIG);
    const b = createEmergentModules(makeDir("brainagent-em-b-"), DEFAULT_CONFIG);

    // 5 повторений с высоким награждением = открытие паттерна (minOccurrences=5)
    for (let i = 0; i < 5; i++) {
      a.recordPattern(["thalamus", "hippocampus"], "technical", 0.8);
    }
    b.recordPattern(["thalamus", "hippocampus"], "technical", 0.8);

    expect(a.getStats().totalDiscovered).toBe(1);
    expect(a.getEmergentModules()).toHaveLength(1);
    // У второго инстанса только одна запись — паттерн не открыт
    expect(b.getStats().totalDiscovered).toBe(0);
  });

  it("фабрика proactive feedback учится на отвержениях независимо", () => {
    const a = createProactiveFeedback(makeDir("brainagent-pf-a-"), DEFAULT_CONFIG, {
      info: () => {},
    });
    const b = createProactiveFeedback(makeDir("brainagent-pf-b-"), DEFAULT_CONFIG, {
      info: () => {},
    });

    const signal = a.recordProactiveReaction("tech", "хватит об этом");

    expect(signal).toBe("rejection");
    expect(a.getStats().totalRejections).toBe(1);
    // Второй инстанс не видит реакции первого
    expect(b.getStats().totalRejections).toBe(0);
    expect(b.getStats().trackedDomains).toBe(0);

    a.stop();
    b.stop();
  });
});

// ── K: LLM-инфраструктура и обогащение импульсов ──────────────────

describe("K: фабрики LLM-инфраструктуры изолированы", () => {
  const silentLog = { info: () => {} };

  it("фабрика llm-client хранит seam-бэкенды и хуки локально", async () => {
    const emptyCfg = {} as unknown as HostConfig;

    const a = createLLMClient();
    const b = createLLMClient();
    const c = createLLMClient();

    a.setCallLLMBackend(async () => "ответ-A");
    b.setCallLLMBackend(async () => "ответ-B");

    // Каждый инстанс маршрутизирует через свой бэкенд
    await expect(a.callLLM("s", "u", emptyCfg)).resolves.toBe("ответ-A");
    await expect(b.callLLM("s", "u", emptyCfg)).resolves.toBe("ответ-B");
    // Без бэкенда и без провайдера — тихо null
    await expect(c.callLLM("s", "u", emptyCfg)).resolves.toBeNull();

    // Хук доступности тоже локальный
    a.setAIAvailabilityHook(() => true);
    expect(a.isAIProviderAvailable(emptyCfg)).toBe(true);
    expect(b.isAIProviderAvailable(emptyCfg)).toBe(false);
  });

  it("фабрика ai-embeddings независимо запоминает недоступность Ollama", async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error("connection refused");
    }) as typeof fetch;

    try {
      const cfg = {
        models: { providers: { ollama: { baseUrl: "http://localhost:11434" } } },
      } as unknown as HostConfig;

      const a = createAIEmbeddings();
      const b = createAIEmbeddings();

      expect(await a.getEmbedding("тест", cfg)).toBeNull();
      expect(await a.getEmbedding("тест", cfg)).toBeNull();
      // a запомнил недоступность — реальный запрос был один
      expect(fetchCalls).toBe(1);

      // b не видит флаг первого инстанса и пробует сам
      expect(await b.getEmbedding("тест", cfg)).toBeNull();
      expect(fetchCalls).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("фабрика autonomy-enricher независимо подписывается на vital-impulse", () => {
    const semanticMem = {
      id: "s1",
      content: "помню разговор",
      category: "fact",
      relatedIds: [],
      confidence: 0.9,
      sourceEpisodeIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as SemanticMemory;

    const eventsA: string[] = [];
    const eventsB: string[] = [];
    const makeDeps = (events: string[]): AutonomyEnricherDeps => ({
      recallMemories: () => ({ episodic: [], semantic: [semanticMem] }),
      getDesires: () => [],
      enqueueSystemEvent: (text: string) => {
        events.push(text);
      },
    });

    const a = createAutonomyEnricher(DEFAULT_CONFIG, silentLog, makeDeps(eventsA));
    const b = createAutonomyEnricher(DEFAULT_CONFIG, silentLog, makeDeps(eventsB));

    const payload = { pressure: 0.9, signalCount: 1, motivation: "тест", consecutiveFires: 1 };
    bus.emitSync("vital-impulse:fired", payload);

    // Оба инстанса обогатили контекст своими воспоминаниями
    expect(eventsA).toHaveLength(1);
    expect(eventsB).toHaveLength(1);
    expect(eventsA[0]).toContain("<autonomy-memories>");

    // После stop первый отписан, второй продолжает реагировать
    a.stop();
    bus.emitSync("vital-impulse:fired", payload);
    expect(eventsA).toHaveLength(1);
    expect(eventsB).toHaveLength(2);

    b.stop();
  });
});

// ── L: goal-stack ──────────────────────────────────────────────────

describe("L: фабрика goal-stack изолирована", () => {
  it("фабрика goal-stack ведёт независимые стеки целей и желаний", () => {
    const a = createGoalStack(makeDir("brainagent-gs-a-"), DEFAULT_CONFIG);
    const b = createGoalStack(makeDir("brainagent-gs-b-"), DEFAULT_CONFIG);

    a.createGoal(
      "проверить почту",
      { type: "topic", condition: "почта" },
      "test",
      "напомнить про почту",
    );
    a.addDesire("understanding", "разобраться в теме", 0.7, "test");

    expect(a.getGoalStackStats().total).toBe(1);
    expect(a.getGoalStackStats().desireCount).toBe(1);
    expect(a.buildVolitionContext()).toContain("volition-context");

    // Второй инстанс не видит целей и желаний первого
    expect(b.getGoalStackStats().total).toBe(0);
    expect(b.getGoalStackStats().desireCount).toBe(0);
    expect(b.buildVolitionContext()).toBeUndefined();

    // Триггеры тоже локальные: у b нет цели со словом "почта"
    expect(a.checkGoalTriggers("почта ждёт проверки")).toHaveLength(1);
    expect(b.checkGoalTriggers("почта ждёт проверки")).toHaveLength(0);
  });
});

// ── M: agent-identity ─────────────────────────────────────────────

describe("M: фабрика agent-identity изолирована", () => {
  it("фабрика agent-identity ведёт независимые карты способностей", () => {
    const a = createAgentIdentity(makeDir("brainagent-id-a-"), DEFAULT_CONFIG);
    const b = createAgentIdentity(makeDir("brainagent-id-b-"), DEFAULT_CONFIG);

    // 12 слабых исходов в technical — копится статистика и self-knowledge
    for (let i = 0; i < 12; i++) {
      a.recordDomainOutcome("technical", 0.3, "simple");
    }

    expect(a.getAgentIdentityStats().totalCycles).toBe(12);
    expect(a.getCapabilities().technical?.avgReward).toBeGreaterThan(0);
    expect(a.buildIdentityContext("technical")).toContain("Self-Knowledge");

    // Второй инстанс чист — ни циклов, ни контекста
    expect(b.getAgentIdentityStats().totalCycles).toBe(0);
    expect(b.getCapabilities().technical).toBeUndefined();
    expect(b.buildIdentityContext("technical")).toBeUndefined();

    // Автобиографическая память тоже локальная
    const mem = a.recordSignificantExperience("важный диалог", "joy", 0.9, 0.9, "technical");
    expect(mem).toBeDefined();
    expect(a.getAgentIdentityStats().autobiographicalCount).toBe(1);
    expect(b.getAgentIdentityStats().autobiographicalCount).toBe(0);
    expect(b.getLifeNarrative()).toContain("No significant experiences");
  });
});

// ── N: mastery-drive ──────────────────────────────────────────────

describe("N: фабрика mastery-drive изолирована", () => {
  it("фабрика mastery-drive независимо слушает шину и ведёт домены", () => {
    const silentLog = { info: () => {} };
    const noopDeps = {
      addDesire: () => ({}) as Desire,
      getDesires: () => [] as Desire[],
      getFactsByCategory: () => [] as SemanticMemory[],
      generateMasteryThought: () => {},
    };

    const a = createMasteryDrive(makeDir("brainagent-md-a-"), DEFAULT_CONFIG, silentLog, noopDeps);
    const b = createMasteryDrive(makeDir("brainagent-md-b-"), DEFAULT_CONFIG, silentLog, noopDeps);

    // Ручной буст домена — только у первого инстанса
    a.boostDomainSatiation("technical", 0.2, "test");
    expect(a.getStats().domainSatiations.technical).toBeDefined();
    expect(b.getStats().activeDomainCount).toBe(0);

    // stop() снимает подписки: событие шины доходит только до b
    a.stop();
    bus.emitSync("dopamine:prediction-error", { error: 0.5, context: "creative/simple" });
    expect(a.getStats().domainSatiations.creative).toBeUndefined();
    expect(b.getStats().domainSatiations.creative).toBeGreaterThan(0);
    b.stop();
  });
});

// ── O: vital-impulse ──────────────────────────────────────────────

describe("O: фабрика vital-impulse изолирована", () => {
  it("фабрика vital-impulse независимо копит давление и снимает подписки", () => {
    const silentLog = { info: () => {} };
    const noopDeps = {
      requestHeartbeatNow: () => {},
      enqueueSystemEvent: () => {},
    };

    const a = createVitalImpulse(makeDir("brainagent-vi-a-"), DEFAULT_CONFIG, silentLog, noopDeps);
    const b = createVitalImpulse(makeDir("brainagent-vi-b-"), DEFAULT_CONFIG, silentLog, noopDeps);

    // Сигнал шины — давление копится у каждого инстанса своё
    bus.emitSync("dmn:insight-generated", { insightId: "o-1", description: "идея" });
    expect(a.getStats().currentPressure).toBeCloseTo(0.4, 2);
    expect(b.getStats().currentPressure).toBeCloseTo(0.4, 2);

    // stop() снимает подписки: следующий сигнал доходит только до b
    a.stop();
    bus.emitSync("dmn:insight-generated", { insightId: "o-2", description: "ещё идея" });
    expect(a.getStats().totalSignalsReceived).toBe(1);
    expect(b.getStats().totalSignalsReceived).toBe(2);
    b.stop();
  });
});

// ── P: commands ──────────────────────────────────────────────────

describe("P: фабрика commands изолирована", () => {
  it("фабрика commands хранит независимые геттеры статистики", async () => {
    type Handler = (ctx: { args?: string }) => Promise<{ text: string }> | { text: string };
    const makeHost = () => {
      const handlers = new Map<string, Handler>();
      const api = {
        registerCommand: (def: { name: string; handler: Handler }) => {
          handlers.set(def.name, def.handler);
        },
        logger: { info: () => {} },
        config: {} as HostConfig,
      };
      return { api, handlers };
    };

    const a = createCommandRegistry();
    const b = createCommandRegistry();

    a.setStatGetters({
      workingMemory: () => ({ entryCount: 7, oldestTimestamp: null, newestTimestamp: null }),
    });
    b.setStatGetters({
      workingMemory: () => ({ entryCount: 3, oldestTimestamp: null, newestTimestamp: null }),
    });

    const hostA = makeHost();
    const hostB = makeHost();
    a.register(hostA.api, DEFAULT_CONFIG);
    b.register(hostB.api, DEFAULT_CONFIG);

    const handlerA = hostA.handlers.get("brainagent");
    const handlerB = hostB.handlers.get("brainagent");
    expect(handlerA).toBeDefined();
    expect(handlerB).toBeDefined();

    // Подкоманда wm читает геттеры своего реестра
    const resA = await handlerA!({ args: "wm" });
    const resB = await handlerB!({ args: "wm" });
    expect(resA.text).toContain("Entries: 7");
    expect(resB.text).toContain("Entries: 3");

    // buildStatus тоже использует локальные геттеры
    expect(a.buildStatus(DEFAULT_CONFIG).text).toContain("Buffer entries: 7");
    expect(b.buildStatus(DEFAULT_CONFIG).text).toContain("Buffer entries: 3");
  });
});

// ── Блок Q: Cordis-сервис ctx.brainagent (провайдер + fiber-scope) ─────

function makeServiceDepsQ(marker: string): BrainAgentServiceDeps {
  return {
    status: () => "status-" + marker,
    recall: (query: string) => ({
      episodic: [],
      semantic: [{ content: marker + ":" + query }] as unknown as SemanticMemory[],
      procedural: [],
    }),
    storeFact: () => {},
    storeEpisode: () => {},
    getDesires: () => [] as Desire[],
    addDesire: (type: Desire["type"], description: string, strength: number, source: string) => ({
      id: "d_" + marker,
      type,
      description,
      strength,
      source,
      createdAt: Date.now(),
    }),
    moduleFlags: () => ({ dmn: marker === "A" }),
  };
}

describe("пакет Q: Cordis-сервис ctx.brainagent (m5)", () => {
  it("фабрика: два сервиса независимы и читают свои deps", () => {
    const a = createBrainAgentService(makeServiceDepsQ("A"));
    const b = createBrainAgentService(makeServiceDepsQ("B"));
    expect(a.name).toBe("brainagent");
    expect(a.version).toBe(BRAINAGENT_VERSION);
    expect(a.status()).toBe("status-A");
    expect(b.status()).toBe("status-B");
    expect(a.recall("x").semantic[0].content).toBe("A:x");
    expect(b.recall("y").semantic[0].content).toBe("B:y");
    expect(a.modules().dmn).toBe(true);
    expect(b.modules().dmn).toBe(false);
    expect(a.addDesire("exploration", "проба", 0.5, "unit").id).toBe("d_A");
  });

  it("провайдер: сервис виден потребителю через inject и снимается с fiber (scope)", async () => {
    const svc = createBrainAgentService(makeServiceDepsQ("Q"));
    const root = new Context();
    const fiber = await root.plugin({
      name: "brainagent",
      apply: (inner: Context) => {
        provideBrainAgentService(inner, svc);
      },
    });
    const seen: string[] = [];
    await root.plugin({
      inject: ["brainagent"],
      apply: (inner: Context) => {
        seen.push(inner.brainagent.status());
      },
    });
    expect(seen).toEqual(["status-Q"]);
    // Сервис снимается вместе с fiber-ом провайдера (scope-семантика Cordis).
    await fiber.dispose();
    expect(root.get("brainagent")).toBeUndefined();
  });
});
