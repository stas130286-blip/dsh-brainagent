import { describe, it, expect } from "vitest";
import { deriveHabitSignature, isHabitSignature } from "./habit-signature.ts";

describe("deriveHabitSignature() — ключ привычки как схема действия", () => {
  it("одна и та же задача в разной формулировке даёт один ключ", () => {
    const a = deriveHabitSignature("напомни мне через 10 минут про чайник", "command");
    const b = deriveHabitSignature("поставь напоминание на вечер", "command");
    expect(a.cue).toBe("reminder:command");
    expect(b.cue).toBe(a.cue);
  });

  it("разные задачи не сливаются", () => {
    expect(deriveHabitSignature("найди в документации", "technical").cue).toBe("search:technical");
    expect(deriveHabitSignature("задеплой сборку", "technical").cue).toBe("deploy:technical");
  });

  it("домен входит в ключ", () => {
    expect(deriveHabitSignature("запусти тесты", "technical").cue).toBe("run:technical");
    expect(deriveHabitSignature("запусти тесты", "creative").cue).toBe("run:creative");
  });

  it("без распознанной программы — general", () => {
    const s = deriveHabitSignature("ммм интересно", "casual");
    expect(s.task).toBe("general");
    expect(s.cue).toBe("general:casual");
  });

  it("рутина содержит моторную программу и домен", () => {
    const s = deriveHabitSignature("объясни, почему падает тест", "technical");
    expect(s.routine).toEqual(["explain", "technical"]);
  });

  it("ключ детерминирован и для длинного текста", () => {
    const text = "давай проверим статус " + "очень длинное сообщение ".repeat(50);
    expect(deriveHabitSignature(text, "technical").cue).toBe(
      deriveHabitSignature(text, "technical").cue,
    );
  });

  it("isHabitSignature отличает сигнатуру от свободного текста", () => {
    expect(isHabitSignature("reminder:command")).toBe(true);
    expect(isHabitSignature("напомни про чайник")).toBe(false);
  });
});
