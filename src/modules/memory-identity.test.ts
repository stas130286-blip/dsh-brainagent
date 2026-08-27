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

  // v0.9.22: вызов из context.ts передаёт 3 user_info + 2 entity с
  // лимитом 5 — факты-«имущество» (имя сервера и т.п.) должны
  // закрепляться наравне с именем пользователя.
  it("закрепляет и имя пользователя, и факты-имущество (3+2, лимит 5)", () => {
    const userInfo = [
      fact("u1", "Имя пользователя: Стас", 0.9),
      fact("u2", "Пользователь живёт в России", 0.8),
      fact("u3", "Пользователь собирает сервера", 0.7),
    ];
    const entity = [
      { ...fact("e1", "Домашний сервер пользователя называется Атлас", 0.75), category: "entity" },
      { ...fact("e2", "Кота пользователя зовут Барсик", 0.7), category: "entity" },
    ];

    const result = pinIdentityFacts([], [...userInfo, ...entity], 5);
    expect(result.map((f) => f.id)).toEqual(["u1", "u2", "u3", "e1", "e2"]);
  });

  it("при лимите 5 шестой факт не закрепляется", () => {
    const identity = [
      fact("u1", "Ф1", 0.9),
      fact("u2", "Ф2", 0.8),
      fact("u3", "Ф3", 0.7),
      { ...fact("e1", "Ф4", 0.6), category: "entity" },
      { ...fact("e2", "Ф5", 0.5), category: "entity" },
      { ...fact("e3", "Ф6", 0.4), category: "entity" },
    ];

    const result = pinIdentityFacts([], identity, 5);
    expect(result).toHaveLength(5);
    expect(result.map((f) => f.id)).not.toContain("e3");
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
