import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createCycleEngine } from "./cycles.ts";
import { MODULE_FLAGS } from "./config.ts";
import type { Config } from "./config.ts";
import { DEFAULT_CONFIG } from "../modules/types.ts";
import type { BrainAgentConfig } from "../modules/types.ts";
import { initMemoryStorage, getFactsByCategory, recallEpisodes } from "../modules/hippocampus.ts";
import type { AutonomyState } from "./autonomy.ts";

const noopLogger = { info: () => {}, warn: () => {}, error: () => {} };

function makePluginConfig(dataDir: string): Config {
  const modules = Object.fromEntries(MODULE_FLAGS.map((f) => [f.key, false]));
  modules.semanticExtraction = true; // извлечение фактов включено
  modules.aiEnrichment = false; // только локальные паттерны
  return {
    dataDir,
    providers: {},
    modules,
    circadian: { enabled: false },
    recall: { episodicLimit: 3, semanticLimit: 5 },
    contextInjection: { maxChars: 12_000 },
    learningLoop: {
      rewardLedger: { enabled: false, maxEntries: 10 },
      strategyBandit: { enabled: false, explorationConstant: 1.4, attributionWindowMs: 60_000 },
    },
    autonomousMinGapMs: 600_000,
    autonomousUserSilenceMs: 180_000,
  } as unknown as Config;
}

function makeBrainConfig(): BrainAgentConfig {
  const modules = { ...DEFAULT_CONFIG.modules };
  for (const key of Object.keys(modules) as Array<keyof typeof modules>) {
    modules[key] = false;
  }
  modules.hippocampus = true; // только память
  return { ...DEFAULT_CONFIG, modules, circadian: { ...DEFAULT_CONFIG.circadian, enabled: false } };
}

function makeState(): AutonomyState {
  return {
    lastAutonomousSource: "",
    previousCycleWasAutonomous: false,
    lastAutonomousDomain: "",
    lastAutonomousDeliveryAt: 0,
    lastUserMessageAt: 0,
  };
}

describe("v0.9.22: память не учится на собственных репликах", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-w22-"));
    initMemoryStorage(tempDir);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  function makeEngine() {
    return createCycleEngine({
      config: makePluginConfig(tempDir),
      brainConfig: makeBrainConfig(),
      getHostConfig: () => ({}) as never,
      logger: noopLogger,
      markActivation: () => {},
      state: makeState(),
    });
  }

  it("автономный цикл: ответ агента НЕ извлекается как факт", async () => {
    const { startCycle, endCycle } = makeEngine();
    const cycle = startCycle(
      "s1",
      '<autonomous-intent source="goal-reminder">Напомни пользователю про температуру сервера</autonomous-intent>',
    );
    // В ответе агента есть фраза с фактовым паттерном — раньше она
    // уезжала в семантическую стору как «знание».
    cycle.responseText = "Стас, время вышло. Мне очень нравится напоминать тебе о сервере.";
    await endCycle("s1");

    expect(getFactsByCategory("user_preference", 50)).toHaveLength(0);
  });

  it("реплика пользователя: факт по-прежнему извлекается", async () => {
    const { startCycle, endCycle } = makeEngine();
    const cycle = startCycle("s1", "Мне очень нравится зелёный чай с мёдом.");
    cycle.responseText = "Отличный выбор!";
    await endCycle("s1");

    const facts = getFactsByCategory("user_preference", 50);
    expect(facts.length).toBeGreaterThanOrEqual(1);
    expect(facts.some((f) => f.content.includes("зелёный чай"))).toBe(true);
  });

  it("автономный цикл сохраняет эпизод «что я сказал» (не удаляем)", async () => {
    const { startCycle, endCycle } = makeEngine();
    const cycle = startCycle(
      "s1",
      '<autonomous-intent source="goal-reminder">Напомни про температуру</autonomous-intent>',
    );
    cycle.responseText = "Стас, проверь температуру сервера.";
    await endCycle("s1");

    const episodes = recallEpisodes("температуру сервера", 10);
    expect(episodes.some((e) => e.event.includes("Agent proactively said"))).toBe(true);
  });
});
