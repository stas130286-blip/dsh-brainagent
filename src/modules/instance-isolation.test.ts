import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { createWorkingMemory } from "./working-memory.ts";
import { createAttentionGate } from "./attention-gate.ts";
import { createTemporalBinding } from "./temporal-binding.ts";
import { DEFAULT_CONFIG, type WorkingMemoryEntry } from "./types.ts";

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
