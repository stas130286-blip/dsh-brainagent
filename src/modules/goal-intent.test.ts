/**
 * v0.9.4: детектор явного целеполагания hasGoalIntent().
 *
 * Боевой тест h6 показал: цель «планирую на этой неделе две задачи…»
 * не попадала в Goal Stack — извлечение запускалось раз в 10 реплик
 * и анализировало только текущую реплику. Явные формулировки теперь
 * запускают извлечение сразу; периодика сохранена для неявных целей.
 */
import { describe, expect, it } from "vitest";
import { hasGoalIntent } from "./goal-stack.ts";

describe("hasGoalIntent — явное целеполагание (v0.9.4)", () => {
  it("ловит русские формулировки планов и целей", () => {
    expect(hasGoalIntent("Планирую на этой неделе две задачи: написать пост и обновить README.")).toBe(true);
    expect(hasGoalIntent("Я запланировал отпуск на пятницу.")).toBe(true);
    expect(hasGoalIntent("Моя цель — выучить TypeScript.")).toBe(true);
    expect(hasGoalIntent("Мои цели на квартал уже расписаны.")).toBe(true);
    expect(hasGoalIntent("Поставь цель: каждый день делать зарядку.")).toBe(true);
  });

  it("ловит напоминания и обязательства", () => {
    expect(hasGoalIntent("Напомни мне проверить отчёт завтра.")).toBe(true);
    expect(hasGoalIntent("Не забудь про релиз в пятницу.")).toBe(true);
    expect(hasGoalIntent("Надо не забыть обновить зависимости.")).toBe(true);
    expect(hasGoalIntent("Хочу успеть закончить проект до отпуска.")).toBe(true);
    // v0.9.10: существительное «напоминание» и краткое «напомни» без «мне»
    expect(hasGoalIntent("Поставь мне напоминание через месяц проверить сервер.")).toBe(true);
    expect(hasGoalIntent("Поставь напоминание на завтра.")).toBe(true);
    expect(hasGoalIntent("Напомни проверить домашний сервер Атлас.")).toBe(true);
    expect(hasGoalIntent("Напоминание про отчёт на пятницу.")).toBe(true);
  });

  it("ловит задачи на период", () => {
    expect(hasGoalIntent("Задачи на неделю: пост и README.")).toBe(true);
    expect(hasGoalIntent("Задачи на сегодня — тесты и релиз.")).toBe(true);
    expect(hasGoalIntent("Задачи на завтра обсудим утром.")).toBe(true);
  });

  it("ловит английские формулировки", () => {
    expect(hasGoalIntent("My plan is to ship the release on Friday.")).toBe(true);
    expect(hasGoalIntent("Remind me to check the deploy.")).toBe(true);
    expect(hasGoalIntent("add this to my todo list")).toBe(true);
    expect(hasGoalIntent("my goal is to learn Rust")).toBe(true);
  });

  it("не срабатывает на обычные реплики", () => {
    expect(hasGoalIntent("как дела?")).toBe(false);
    expect(hasGoalIntent("подготови отчёт")).toBe(false);
    expect(hasGoalIntent("привет")).toBe(false);
    expect(hasGoalIntent("спасибо, всё получилось")).toBe(false);
    expect(hasGoalIntent("какая сейчас погода?")).toBe(false);
  });

  it("не срабатывает на слова внутри других слов", () => {
    // «планшет», «goalkeeper» не должны давать ложных срабатываний
    expect(hasGoalIntent("купил новый планшет")).toBe(false);
    expect(hasGoalIntent("the goalkeeper saved the ball")).toBe(false);
  });
});
