import { describe, expect, it } from "vitest";
import { extractFacts, isFactWorthy } from "./semantic-extractor.ts";
import type { ThalamusClassification } from "./types.ts";

describe("semantic-extractor", () => {
  describe("extractFacts", () => {
    // ═══════════════════════════════════════════════════════════════
    // User Preferences (Russian)
    // ═══════════════════════════════════════════════════════════════
    it("extracts 'мне нравится' preferences", () => {
      const facts = extractFacts("Мне очень нравится программировать на Python.");
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].category).toBe("user_preference");
      expect(facts[0].content).toContain("нравится");
    });

    it("extracts 'я люблю' preferences", () => {
      const facts = extractFacts("Я очень люблю рыбалку на спиннинг.");
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].category).toBe("user_preference");
      expect(facts[0].content).toContain("любит");
    });

    it("extracts 'люблю' without 'я' prefix", () => {
      const facts = extractFacts("Люблю рыбалку и онлайн игры.");
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].category).toBe("user_preference");
      expect(facts[0].content).toContain("любит");
    });

    it("extracts 'я предпочитаю' preferences", () => {
      const facts = extractFacts("Я предпочитаю работать по утрам.");
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].category).toBe("user_preference");
      expect(facts[0].content).toContain("предпочитает");
    });

    it("extracts negative preferences", () => {
      const facts = extractFacts("Мне не нравится когда жарко.");
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].category).toBe("user_preference");
      expect(facts[0].content).toContain("НЕ нравится");
    });

    // ═══════════════════════════════════════════════════════════════
    // User Info (Russian)
    // ═══════════════════════════════════════════════════════════════
    it("extracts user name", () => {
      const facts = extractFacts("Меня зовут Станислав.");
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].category).toBe("user_info");
      expect(facts[0].content).toContain("Станислав");
    });

    it("extracts workplace", () => {
      const facts = extractFacts("Я работаю в компании Google.");
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].category).toBe("user_info");
      expect(facts[0].content).toContain("Google");
    });

    it("extracts job title with workplace", () => {
      const facts = extractFacts("Работаю Главным метрологом на судостроительном заводе.");
      expect(facts.length).toBeGreaterThan(0);
      const jobFact = facts.find(
        (f) => f.content.includes("Должность") || f.content.includes("работы"),
      );
      expect(jobFact).toBeDefined();
      expect(jobFact!.category).toBe("user_info");
    });

    it("extracts zodiac sign", () => {
      const facts = extractFacts("Я по знаку зодиака водолей.");
      expect(facts.length).toBeGreaterThan(0);
      const zodiac = facts.find((f) => f.content.includes("зодиака"));
      expect(zodiac).toBeDefined();
      expect(zodiac!.content).toContain("водолей");
    });

    it("extracts birth date", () => {
      const facts = extractFacts("Я родился 13 февраля.");
      expect(facts.length).toBeGreaterThan(0);
      const birth = facts.find((f) => f.content.includes("рождения"));
      expect(birth).toBeDefined();
      expect(birth!.content).toContain("13");
      expect(birth!.content).toContain("февраля");
    });

    it("extracts location", () => {
      const facts = extractFacts("Я живу в Москве.");
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].category).toBe("user_info");
      expect(facts[0].content).toContain("Москве");
    });

    it("extracts age", () => {
      const facts = extractFacts("Мне 35 лет.");
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].category).toBe("user_info");
      expect(facts[0].content).toContain("35");
    });

    it("extracts possessions", () => {
      const facts = extractFacts("У меня есть собака по кличке Рекс.");
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].category).toBe("user_info");
      expect(facts[0].content).toContain("собака");
    });

    // ═══════════════════════════════════════════════════════════════
    // User Preferences (English)
    // ═══════════════════════════════════════════════════════════════
    it("extracts 'I like' preferences (English)", () => {
      const facts = extractFacts("I really like coding in TypeScript.");
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].category).toBe("user_preference");
      expect(facts[0].content).toContain("likes");
    });

    it("extracts 'my favorite' preferences (English)", () => {
      const facts = extractFacts("My favorite language is Python.");
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].category).toBe("user_preference");
      expect(facts[0].content).toContain("favorite");
    });

    // ═══════════════════════════════════════════════════════════════
    // Problems and Plans
    // ═══════════════════════════════════════════════════════════════
    it("extracts problems", () => {
      const facts = extractFacts("У меня проблема с плечом.");
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].category).toBe("problem");
      expect(facts[0].content).toContain("плечом");
    });

    it("extracts plans", () => {
      const facts = extractFacts("Я планирую поехать в отпуск в июне.");
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].category).toBe("plan");
      expect(facts[0].content).toContain("отпуск");
    });

    it("extracts plans without 'я' prefix", () => {
      const facts = extractFacts("Планирую осенью поехать в Сочи на красную поляну.");
      expect(facts.length).toBeGreaterThan(0);
      const plan = facts.find((f) => f.category === "plan");
      expect(plan).toBeDefined();
      expect(plan!.content).toContain("Сочи");
    });

    it("extracts 'нужно' plans", () => {
      const facts = extractFacts("Мне нужно позвонить в страховую.");
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].category).toBe("plan");
      expect(facts[0].content).toContain("страховую");
    });

    // ═══════════════════════════════════════════════════════════════
    // Classification boost
    // ═══════════════════════════════════════════════════════════════
    it("boosts confidence for factual domain", () => {
      const classification: ThalamusClassification = {
        modality: "text",
        domain: "factual",
        complexity: "simple",
        intentSummary: "test",
        confidence: 0.9,
        processingPath: "fast",
      };
      const facts = extractFacts("Я работаю в Google.", classification);
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].confidence).toBeGreaterThan(0.7);
    });

    // ═══════════════════════════════════════════════════════════════
    // Edge cases
    // ═══════════════════════════════════════════════════════════════
    it("returns empty array for short text", () => {
      const facts = extractFacts("Привет!");
      expect(facts).toEqual([]);
    });

    it("returns empty array for text without facts", () => {
      const facts = extractFacts("Какая сегодня погода?");
      expect(facts).toEqual([]);
    });

    it("does not duplicate similar facts", () => {
      const facts = extractFacts("Мне нравится Python и я люблю программировать.");
      // Should extract both preferences (they are different facts)
      const preferenceCount = facts.filter((f) => f.category === "user_preference").length;
      expect(preferenceCount).toBeGreaterThanOrEqual(1);

      // Check that there are no exact duplicates (same content)
      const contents = facts.map((f) => f.content);
      const uniqueContents = new Set(contents);
      expect(uniqueContents.size).toBe(contents.length);
    });
  });

  describe("isFactWorthy", () => {
    it("returns false for short text", () => {
      expect(isFactWorthy("Ок")).toBe(false);
      expect(isFactWorthy("Привет")).toBe(false);
    });

    it("returns false for greetings", () => {
      expect(isFactWorthy("Привет, как дела?")).toBe(false);
      expect(isFactWorthy("Добрый день!")).toBe(false);
    });

    it("returns false for commands", () => {
      const classification: ThalamusClassification = {
        modality: "text",
        domain: "command",
        complexity: "simple",
        intentSummary: "test",
        confidence: 0.9,
        processingPath: "fast",
      };
      expect(isFactWorthy("Создай напоминание", classification)).toBe(false);
    });

    it("returns true for substantial text", () => {
      expect(isFactWorthy("Мне нравится работать с TypeScript и Node.js")).toBe(true);
    });

    it("returns true for long message starting with greeting", () => {
      expect(
        isFactWorthy(
          "Привет! Я по знаку зодиака водолей, родился 13 февраля. Работаю Главным метрологом.",
        ),
      ).toBe(true);
    });

    it("extracts facts from full test message", () => {
      const text =
        "Привет! Я по знаку зодиака водолей, родился 13 февраля. Работаю Главным метрологом на судостроительном заводе. Люблю рыбалку и онлайн игры. Планирую осенью поехать в Сочи на красную поляну.";
      expect(isFactWorthy(text)).toBe(true);

      const facts = extractFacts(text);
      expect(facts.length).toBeGreaterThanOrEqual(3);

      const categories = facts.map((f) => f.category);
      // Should extract at least zodiac (user_info), hobby (user_preference), plan
      expect(categories).toContain("user_info");
      expect(categories).toContain("user_preference");
      expect(categories).toContain("plan");
    });
  });
});
