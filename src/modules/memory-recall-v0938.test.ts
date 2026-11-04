import { describe, expect, it } from "vitest";
import { factImportance, isDurableFact } from "./fact-importance.ts";
import { buildSelfDigest, isSelfQuery, selectPinnedFacts } from "./memory-identity.ts";
import { assembleContext, episodeLabel } from "./prefrontal-cortex.ts";
import type { BrainState, EpisodicMemory, SemanticMemory } from "./types.ts";

function fact(
  id: string,
  content: string,
  confidence = 0.7,
  category = "user_info",
): SemanticMemory {
  return {
    id,
    content,
    category,
    relatedIds: [],
    confidence,
    sourceEpisodeIds: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

function episode(over: Partial<EpisodicMemory> = {}): EpisodicMemory {
  return {
    id: "ep-1",
    timestamp: 1,
    summary: "Conversation about: unknown topic",
    event: "User asked: и как теперь должен работать этот конвейер",
    emotionalContext: "neutral",
    entities: [],
    salience: 0.8,
    accessCount: 0,
    lastDecayedAt: 1,
    ...over,
  };
}

/** Живой стор 04.11.2026: служебные строки набрали 1.00 и заняли все слоты. */
const store: SemanticMemory[] = [
  fact("f1", "Имя пользователя: Стас", 1),
  fact("f2", "Рабочая папка прогона: D:/Работа/Плагин-метролог/примеры/учебный-СТО", 1),
  fact("f3", "Существует общий протокол: D:/Работа/Плагин-метролог/конвейер/ПРОТОКОЛ.md", 1, "entity"),
  fact("f4", "Инструкция роли АРБИТР расположена по пути D:/Работа/Плагин-метролог/РОЛИ", 1, "entity"),
  fact("f5", "Пользователь работал главным метрологом", 0.8),
  fact("f6", "Пользователь проходил собеседование на должность главного метролога", 0.7),
  fact("f7", "В резюме пользователь указал желаемую зарплату 90 000 рублей на руки", 0.7),
  fact("f8", "Пользователь имеет опыт работы с формой 8 (анализ рекламаций)", 0.7),
  fact("f9", "Пользователь упоминает платформу HeadHunter (hh.ru)", 0.7, "entity"),
  fact("f10", "Домашний сервер пользователя называется Атлас", 0.75, "entity"),
];

describe("v0.9.38: служебные факты не считаются знанием о человеке", () => {
  it("путь, имя файла и длинный id — не durable", () => {
    expect(isDurableFact("Рабочая папка прогона: D:/Работа/Плагин-метролог")).toBe(false);
    expect(isDurableFact("Существует общий протокол: D:/x/ПРОТОКОЛ.md")).toBe(false);
    expect(isDurableFact("Вакансия id 137311370 на hh.ru")).toBe(false);
    expect(isDurableFact("Ссылка https://hh.ru/vacancy/137311370")).toBe(false);
    expect(isDurableFact("Имя пользователя Windows в пути: stas1")).toBe(false);
    expect(isDurableFact("Умения персонажа находятся в папке 'навыки'")).toBe(false);
    expect(isDurableFact("кратко")).toBe(false);
  });

  it("факты о человеке остаются durable", () => {
    expect(isDurableFact("Пользователь работал главным метрологом")).toBe(true);
    expect(isDurableFact("В резюме пользователь указал желаемую зарплату 90 000 рублей")).toBe(true);
  });

  it("важность пути нулевая, важность профессии — нет", () => {
    expect(factImportance(store[1]!)).toBe(0);
    expect(factImportance(store[4]!)).toBeGreaterThan(0.5);
  });

  it("речевой акт весит меньше устойчивого свойства", () => {
    expect(factImportance(store[8]!)).toBeLessThan(factImportance(store[4]!));
  });
});

describe("v0.9.38: пиннинг по важности, а не по confidence", () => {
  it("пути не попадают в базовое знание даже с confidence 1.00", () => {
    const pinned = selectPinnedFacts(store, 3);
    expect(pinned).toHaveLength(3);
    expect(pinned.map((f) => f.content).join(" ")).not.toContain("D:/");
    expect(pinned[0]!.content).toContain("Имя пользователя");
  });

  it("работа и опыт обгоняют служебные строки", () => {
    const pinned = selectPinnedFacts(store, 3).map((f) => f.content).join(" | ");
    expect(pinned).toContain("метролог");
  });

  it("имя всегда первое: повторные упоминания не дают пути приоритета", () => {
    const noisy = [
      fact("p1", "Рабочая папка прогона: D:/Работа/проект", 1),
      fact("p2", "Существует общий протокол: D:/Работа/проект/ПРОТОКОЛ.md", 1, "entity"),
      fact("n1", "Имя пользователя: Стас", 1),
    ];
    expect(selectPinnedFacts(noisy, 3).map((f) => f.id)).toEqual(["n1"]);
  });
});

describe("v0.9.38: вопрос о себе обслуживается дайджестом", () => {
  it("распознаёт вопросы о пользователе и не срабатывает на технические", () => {
    expect(isSelfQuery("что ты знаешь обо мне?")).toBe(true);
    expect(isSelfQuery("расскажи про моё резюме")).toBe(true);
    expect(isSelfQuery("покажи факты из моего резюме")).toBe(true);
    expect(isSelfQuery("кто я")).toBe(true);
    expect(isSelfQuery("что ты знаешь о Docker?")).toBe(false);
    expect(isSelfQuery("как настроить nginx")).toBe(false);
  });

  it("дайджест содержит факты резюме и не содержит путей", () => {
    const digest = buildSelfDigest(store).map((f) => f.content).join("\n");
    expect(digest).toContain("метролог");
    expect(digest).toContain("зарплату");
    expect(digest).not.toContain("D:/");
  });

  it("дайджест ограничен слотами", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      fact(`m${i}`, `Пользователь имеет опыт работы в области ${["литья", "сварки", "оптики"][i % 3]} номер ${i}`, 0.7 - i * 0.001),
    );
    const digest = buildSelfDigest(many, 8);
    expect(digest.length).toBeGreaterThan(0);
    expect(digest.length).toBeLessThanOrEqual(8);
  });
});

describe("v0.9.38: эпизоды рендерятся по event, а не по шаблону", () => {
  it("шаблонная сводка заменяется текстом события", () => {
    expect(episodeLabel(episode())).toContain("и как теперь должен работать");
  });

  it("содержательная сводка остаётся как есть", () => {
    expect(episodeLabel(episode({ summary: "Обсуждали структуру резюме" }))).toBe(
      "Обсуждали структуру резюме",
    );
  });

  it("шаблон без события не превращается в пустую строку", () => {
    expect(episodeLabel(episode({ event: "" }))).toBe("Conversation about: unknown topic");
  });
});

describe("v0.9.38: пиннинг и релевантность не спорят за одни слоты", () => {
  it("рендерятся оба блока", () => {
    const state = {
      relevantMemories: {
        episodic: [],
        procedural: [],
        pinned: [fact("p1", "Имя пользователя: Стас", 1)],
        semantic: [fact("r1", "Пользователь откликнулся на вакансию в Автоторе")],
      },
      contextInjections: [],
    } as unknown as BrainState;

    const ctx = assembleContext(state);
    expect(ctx).toContain("## Core Knowledge About the User");
    expect(ctx).toContain("Имя пользователя: Стас");
    expect(ctx).toContain("## Known Facts About User/Context");
    expect(ctx).toContain("Автоторе");
  });

  it("без фактов блок Memory Usage не добавляется", () => {
    const state = {
      relevantMemories: { episodic: [], semantic: [], procedural: [] },
      contextInjections: [],
    } as unknown as BrainState;
    expect(assembleContext(state)).not.toContain("## Memory Usage");
  });
});
