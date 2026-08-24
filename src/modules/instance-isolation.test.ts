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
    const b = createTemporalAwareness(makeDir("brainagent-ta-b-"), DEFAULT_CONFIG);

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
