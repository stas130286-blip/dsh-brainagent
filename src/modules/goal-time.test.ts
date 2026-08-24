import { describe, expect, it } from "vitest";
import { buildGoalExtractionPrompt, parseTimeTriggerCondition } from "./goal-stack.ts";

describe("buildGoalExtractionPrompt (v0.9.5 temporal awareness)", () => {
  it("включает текущие дату и время в локальном ISO-формате", () => {
    const now = new Date(2026, 7, 25, 1, 5); // 25 августа 2026, 01:05
    const prompt = buildGoalExtractionPrompt(now);
    expect(prompt).toContain("Current local date and time: 2026-08-25T01:05");
  });

  it("требует ISO-дату для time-триггеров", () => {
    const prompt = buildGoalExtractionPrompt(new Date(2026, 0, 1, 12, 0));
    expect(prompt).toContain("YYYY-MM-DDTHH:MM");
    expect(prompt).toContain("Never use a moment in the past");
  });
});

describe("parseTimeTriggerCondition (v0.9.5)", () => {
  it("пропускает готовые epoch-миллисекунды", () => {
    expect(parseTimeTriggerCondition("1787985000000")).toBe(1787985000000);
  });

  it("парсит ISO-дату из ответа LLM", () => {
    const expected = new Date(2026, 7, 28, 9, 0).getTime();
    expect(parseTimeTriggerCondition("2026-08-28T09:00")).toBe(expected);
  });

  it("принимает дату без времени", () => {
    const parsed = parseTimeTriggerCondition("2026-09-01");
    expect(parsed).toBeTypeOf("number");
    expect(parsed).toBeGreaterThan(0);
  });

  it("отклоняет мусор и пустоту", () => {
    expect(parseTimeTriggerCondition("")).toBeUndefined();
    expect(parseTimeTriggerCondition("next friday")).toBeUndefined();
    expect(parseTimeTriggerCondition("-5")).toBeUndefined();
    expect(parseTimeTriggerCondition("1999-12-31T23:59")).toBeUndefined();
  });
});
