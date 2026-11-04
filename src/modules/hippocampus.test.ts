import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  consolidate,
  initMemoryStorage,
  storeFact,
  storeEpisode,
  recallFacts,
  recallAll,
  recallEpisodes,
  getPendingContradictions,
  clearPendingContradictions,
} from "./hippocampus.ts";
import {
  computeEmotionMatchBonus,
  getEmotionalMemoryStats,
  stopEmotionalMemory,
} from "./emotional-memory.ts";
import { DEFAULT_CONFIG } from "./types.ts";

let tempDir: string;

describe("Hippocampus — semantic memory", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-hippo-"));
    initMemoryStorage(tempDir);
    clearPendingContradictions();
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  // ── Basic storage ─────────────────────────────────────────────

  it("stores a fact with default confidence", () => {
    const fact = storeFact("The sky is blue", "general");
    expect(fact.id).toMatch(/^sem-/);
    expect(fact.content).toBe("The sky is blue");
    expect(fact.category).toBe("general");
    expect(fact.confidence).toBeCloseTo(0.7, 5);
  });

  it("repeating an identical fact strengthens it instead of duplicating", () => {
    const first = storeFact("Water boils at 100C", "general");
    const second = storeFact("water boils at 100c", "general"); // case-insensitive
    expect(second.id).toBe(first.id);
    expect(second.confidence).toBeCloseTo(0.8, 5); // 0.7 + 0.1
  });

  // ── Reconsolidation (Tier-1 contradiction) ────────────────────

  it("revises a contradicting structural fact instead of duplicating", () => {
    const first = storeFact("City: Moscow", "profile");
    const revised = storeFact("City: Berlin", "profile");

    expect(revised.id).toBe(first.id); // same fact, rewritten
    expect(revised.content).toBe("City: Berlin");
    expect(revised.revisionHistory).toHaveLength(1);
    expect(revised.revisionHistory?.[0].previousContent).toBe("City: Moscow");
  });

  // ── Tier-2 pending contradictions ─────────────────────────────

  it("queues topically related facts for dream-mode review with newFactId filled", () => {
    const first = storeFact("The user prefers drinking green tea every morning", "preferences");
    const second = storeFact("The user enjoys swimming at the local pool", "preferences");

    // Moderately similar but not a duplicate → a brand-new fact…
    expect(second.id).not.toBe(first.id);

    // …and a Tier-2 pending contradiction linking both ids.
    const pending = getPendingContradictions();
    expect(pending.length).toBeGreaterThan(0);
    const entry = pending.find((p) => p.existingFactId === first.id);
    expect(entry).toBeDefined();
    expect(entry?.newFactId).toBe(second.id); // backfilled by storeFact
  });

  // ── Recall ────────────────────────────────────────────────────

  it("recalls stored facts by keyword", () => {
    storeFact("Пользователь любит кофе по утрам", "preferences");
    const found = recallFacts("кофе утром");
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].content).toContain("кофе");
  });

  it("recallAll returns matching semantic results", () => {
    storeFact("Project deadline is Friday", "work");
    const all = recallAll("project deadline");
    expect(all.semantic.length).toBeGreaterThan(0);
    expect(all.semantic[0].category).toBe("work");
  });
});

describe("Hippocampus — v0.9.20: эмоционально-согласованное вспоминание", () => {
  let tempDir2: string;

  beforeEach(() => {
    tempDir2 = mkdtempSync(join(tmpdir(), "brainagent-hippo-emo-"));
    initMemoryStorage(tempDir2);
  });

  afterEach(() => {
    stopEmotionalMemory();
    try {
      rmSync(tempDir2, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  it("бонус за совпадение эмоции поднимает эпизод с той же меткой", () => {
    storeEpisode(
      "Команда отпраздновала успешный релиз проекта",
      "релиз проекта",
      "joy",
      ["проект"],
      0.4,
    );
    storeEpisode(
      "Составили расписание встреч по проекту",
      "расписание встреч",
      "neutral",
      ["проект"],
      0.4,
    );
    const boosted = recallEpisodes("проект", 5, undefined, (memoryEmotion) =>
      memoryEmotion === "joy" ? 0.5 : 0,
    );
    expect(boosted.length).toBeGreaterThan(0);
    expect(boosted[0].emotionalContext).toBe("joy");
  });

  it("computeEmotionMatchBonus работает как бонус и считает матчи", () => {
    storeEpisode("Пользователь получил отличную новость", "отличная новость", "joy", ["новость"], 0.4);
    const bonus = (memoryEmotion: Parameters<typeof computeEmotionMatchBonus>[1]) =>
      computeEmotionMatchBonus("joy", memoryEmotion, DEFAULT_CONFIG);
    const all = recallAll("новость", 5, 5, bonus);
    expect(all.episodic.length).toBeGreaterThan(0);
    expect(getEmotionalMemoryStats().emotionMatchBoosts).toBeGreaterThanOrEqual(1);
  });
});

describe("Hippocampus — v0.9.35: забывание по силе следа", () => {
  let dir: string;
  const storePath = (): string => join(dir, ".brainagent", "memory", "episodic", "store.json");
  const readStore = (): Array<Record<string, unknown>> =>
    JSON.parse(readFileSync(storePath(), "utf8")) as Array<Record<string, unknown>>;
  const writeStore = (data: unknown): void => {
    writeFileSync(storePath(), JSON.stringify(data, null, 2), "utf8");
  };
  const DAY = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "brainagent-hippo-forget-"));
    initMemoryStorage(dir);
  });

  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  it("начисляет затухание за прошедшее время, а не накапливает его", async () => {
    storeEpisode("Прогон тестов", "прогон тестов");
    const store = readStore();
    const tenDaysAgo = Date.now() - 10 * DAY;
    store[0].timestamp = tenDaysAgo;
    store[0].lastDecayedAt = tenDaysAgo;
    store[0].salience = 0.8;
    writeStore(store);

    initMemoryStorage(dir);
    await consolidate(DEFAULT_CONFIG);

    const [episode] = readStore();
    // Компаундинг (decay^возраст на каждом проходе) оставил бы здесь ~1e-5.
    expect(episode.salience as number).toBeCloseTo(0.8 * Math.pow(0.95, 10), 3);
  });

  it("забывает слабый след, не глядя на возраст, и хранит сильный старый", async () => {
    storeEpisode("Слабый след", "слабый");
    storeEpisode("Сильный след", "сильный");
    const now = Date.now();
    const store = readStore();
    store[0].salience = 0.005; // молодой, но уже мёртвый
    store[0].timestamp = now - DAY;
    store[0].lastDecayedAt = now;
    store[1].salience = 0.5; // старый, но живой
    store[1].timestamp = now - 200 * DAY;
    store[1].lastDecayedAt = now;
    writeStore(store);

    initMemoryStorage(dir);
    await consolidate(DEFAULT_CONFIG);

    expect(readStore().map((e) => e.summary)).toEqual(["сильный"]);
  });

  it("при переполнении вытесняет менее используемый след", async () => {
    for (let i = 0; i < 4; i++) storeEpisode(`Событие ${i}`, `событие ${i}`);
    const now = Date.now();
    const store = readStore();
    store.forEach((ep, i) => {
      ep.salience = 0.5;
      ep.accessCount = i;
      ep.lastDecayedAt = now;
    });
    writeStore(store);

    initMemoryStorage(dir);
    const config = {
      ...DEFAULT_CONFIG,
      memory: { ...DEFAULT_CONFIG.memory, maxEpisodicMemories: 3 },
    };
    await consolidate(config);

    const left = readStore();
    expect(left).toHaveLength(3);
    expect(left.map((e) => e.accessCount).sort()).toEqual([1, 2, 3]);
  });

  it("подкрепляет только следы, всплывшие между проходами, а не по счётчику доступов", async () => {
    storeEpisode("Кварцевая жила", "кварц");
    storeEpisode("Базальтовый слой", "базальт");
    const now = Date.now();
    const store = readStore();
    store[0].salience = 0.3;
    store[0].lastDecayedAt = now;
    store[0].lastAccessedAt = now - 7 * DAY;
    store[1].salience = 0.3;
    store[1].lastDecayedAt = now;
    store[1].accessCount = 50; // старый счётчик больше ничего не даёт
    store[1].lastAccessedAt = now - 7 * DAY;
    writeStore(store);

    initMemoryStorage(dir);
    await consolidate(DEFAULT_CONFIG);

    const afterFirst = readStore();
    expect(afterFirst[0].salience as number).toBeCloseTo(0.3, 3);
    expect(afterFirst[1].salience as number).toBeCloseTo(0.3, 3);

    recallEpisodes("кварц", 1); // след всплыл уже после прохода
    await consolidate(DEFAULT_CONFIG);

    const afterSecond = readStore();
    expect(afterSecond[0].salience as number).toBeGreaterThan(0.35);
    expect(afterSecond[1].salience as number).toBeCloseTo(0.3, 3);
  });

  it("миграция пересчитывает испорченную силу следа и сохраняет архив", async () => {
    storeEpisode("Старый след", "старый");
    const store = readStore();
    store[0].timestamp = Date.now() - 30 * DAY;
    store[0].salience = 1e-7;
    delete store[0].lastDecayedAt;
    writeStore(store);

    initMemoryStorage(dir);
    await consolidate(DEFAULT_CONFIG);

    const [episode] = readStore();
    expect(episode.salience as number).toBeCloseTo(0.8 * Math.pow(0.95, 30), 2);
    expect(
      existsSync(join(dir, ".brainagent", "memory", "episodic", "store.legacy-v1.json")),
    ).toBe(true);
  });
});
