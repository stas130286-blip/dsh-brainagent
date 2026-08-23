import { describe, it, expect } from "vitest";
import {
  classifyFeedback,
  detectLanguage,
} from "./i18n-heuristics.ts";

describe("i18n-heuristics: classifyFeedback", () => {
  it("detects Russian positive signals", () => {
    expect(classifyFeedback("Спасибо, отлично сработало").signal).toBe("positive");
    expect(classifyFeedback("Круто, именно то что нужно").signal).toBe("positive");
    expect(classifyFeedback("Топ!").signal).toBe("positive");
    expect(classifyFeedback("Огонь, помогло").signal).toBe("positive");
  });

  it("detects English positive signals", () => {
    expect(classifyFeedback("Thanks, that helped a lot").signal).toBe("positive");
    expect(classifyFeedback("Great job!").signal).toBe("positive");
  });

  it("detects Russian negative (correction) signals", () => {
    expect(classifyFeedback("Неправильно, переделай").signal).toBe("negative");
    expect(classifyFeedback("Ты меня не понял, я про другое").signal).toBe("negative");
  });

  it("detects English negative signals", () => {
    expect(classifyFeedback("That's wrong, try again").signal).toBe("negative");
  });

  it("detects Russian rejection («не зашло»)", () => {
    expect(classifyFeedback("Хватит об этом").signal).toBe("rejection");
    expect(classifyFeedback("Не надо мне это присылать").signal).toBe("rejection");
    expect(classifyFeedback("Забей, мне это не интересно").signal).toBe("rejection");
    expect(classifyFeedback("Больше не заводи эту тему").signal).toBe("rejection");
  });

  it("detects English rejection", () => {
    expect(classifyFeedback("Stop it, I'm not interested").signal).toBe("rejection");
    expect(classifyFeedback("Please drop it").signal).toBe("rejection");
  });

  it("rejection wins over positive in mixed messages", () => {
    expect(classifyFeedback("Спасибо, но хватит об этом").signal).toBe("rejection");
  });

  it("neutral for technical text without feedback", () => {
    expect(classifyFeedback("Как настроить nginx?").signal).toBe("neutral");
    expect(classifyFeedback("").signal).toBe("neutral");
  });

  it("reports matched heuristic labels", () => {
    const result = classifyFeedback("хватит, достало");
    expect(result.signal).toBe("rejection");
    expect(result.hits).toContain("хватит");
    expect(result.hits).toContain("достало");
  });
});

describe("i18n-heuristics: detectLanguage", () => {
  it("detects Russian, English and mixed text", () => {
    expect(detectLanguage("Привет, как дела?")).toBe("ru");
    expect(detectLanguage("Hello there")).toBe("en");
    expect(detectLanguage("123 456")).toBe("en"); // нет букв — условно en
  });
});
