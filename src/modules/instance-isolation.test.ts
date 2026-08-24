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
import { bus } from "./event-bus.ts";
import { DEFAULT_CONFIG, type DopamineSignal, type WorkingMemoryEntry } from "./types.ts";

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
