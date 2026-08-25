import { describe, expect, it } from "vitest";
import { pinIdentityFacts } from "./memory-identity.ts";
import { assembleContext } from "./prefrontal-cortex.ts";
import type { BrainState, SemanticMemory } from "./types.ts";

function fact(id: string, content: string, confidence = 0.7): SemanticMemory {
  return {
    id,
    content,
    category: "user_info",
    relatedIds: [],
    confidence,
    sourceEpisodeIds: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

// ── pinIdentityFacts ────────────────────────────────────────────────

describe("pinIdentityFacts (v0.9.12)", () => {
  it("подмешивает отсутствующие identity-факты в начало recall", () => {
    const recalled = [fact("r1", "Случайный факт из поиска")];
    const identity = [fact("i1", "Имя пользователя: Стас", 0.85)];

    const result = pinIdentityFacts(recalled, identity);

    expect(result.map((f) => f.id)).toEqual(["i1", "r1"]);
  });

  it("не дублирует факт, который уже есть в recall", () => {
    const shared = fact("i1", "Имя пользователя: Стас", 0.85);
    const result = pinIdentityFacts([shared], [shared]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("i1");
  });

  it("ограничивает закрепление maxPinned", () => {
    const identity = [
      fact("i1", "Факт 1", 0.9),
      fact("i2", "Факт 2", 0.8),
      fact("i3", "Факт 3", 0.7),
      fact("i4", "Факт 4", 0.6),
    ];

    const result = pinIdentityFacts([], identity);
    expect(result.map((f) => f.id)).toEqual(["i1", "i2", "i3"]);
  });

  it("пустой набор identity не ломает recall", () => {
    const recalled = [fact("r1", "Что-то")];
    expect(pinIdentityFacts(recalled, [])).toEqual(recalled);
    expect(pinIdentityFacts([], [])).toEqual([]);
  });
});

// ── assembleContext: Memory Usage ───────────────────────────────────

function stateWithFacts(semantic: SemanticMemory[]): BrainState {
  return {
    relevantMemories: { episodic: [], semantic, procedural: [] },
    contextInjections: [],
  } as unknown as BrainState;
}

describe("assembleContext: инструкция по памяти (v0.9.12)", () => {
  it("при наличии фактов явно говорит модели, что это её реальная память", () => {
    const ctx = assembleContext(stateWithFacts([fact("i1", "Имя пользователя: Стас", 0.85)]));

    expect(ctx).toContain("## Memory Usage");
    expect(ctx).toContain("YOUR real long-term memory");
    expect(ctx).toContain("use them naturally and confidently");
  });

  it("без фактов блок Memory Usage не добавляется", () => {
    const ctx = assembleContext(stateWithFacts([]));
    expect(ctx).not.toContain("## Memory Usage");
  });

  it("запрещает отрицать факты, которые перечислены в блоке", () => {
    const ctx = assembleContext(stateWithFacts([fact("i1", "Имя пользователя: Стас", 0.85)]));

    expect(ctx).toContain("Never deny facts that ARE listed above");
    // старая формулировка «не помнишь — так и скажи» без оговорки убрана
    expect(ctx).not.toContain(
      "If you don't remember something from a previous conversation — honestly say you don't remember. Do not invent details.",
    );
  });

  it("закреплённые факты попадают в секцию Known Facts", () => {
    const ctx = assembleContext(
      stateWithFacts([fact("i1", "Домашний сервер называется Атлас", 0.7)]),
    );

    expect(ctx).toContain("## Known Facts About User/Context");
    expect(ctx).toContain("Домашний сервер называется Атлас");
  });
});
