/**
 * Eval-сценарии: автономия — проактивная доставка, гейт инструментов
 * и loop-breaker. Поведения smoke-phase3, но в виде строгих ассертов.
 *
 * Примечание: автономный цикл прогоняется через agent/pre-step с сырым
 * <autonomous-intent>-текстом — именно так плагин создаёт цикл с
 * input, начинающимся с тега (контракт гейта и loop-breaker'а).
 * Тег — ровный, без атрибутов: детекция в плагине идёт по
 * startsWith("<autonomous-intent>") (vital-impulse генерирует именно так).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootBrain, sleep } from "./harness.ts";
import type { BrainHandle } from "./harness.ts";
import { forceImpulse } from "../modules/vital-impulse.ts";

const mkContent = (text: string) => [{ type: "text", text }];
const AUTONOMOUS_INPUT =
  "<autonomous-intent>\nОсмыслить наш прошлый разговор и поделиться наблюдениями.\n</autonomous-intent>";

describe("eval: автономия", () => {
  let brain: BrainHandle;

  beforeAll(async () => {
    brain = await bootBrain();
  });

  afterAll(() => {
    brain.dispose();
  });

  it("проактивный импульс доставляется с фреймингом", async () => {
    brain.userTurn("Привет!", "Привет! Чем могу помочь?");
    await sleep(200);
    forceImpulse(
      '<autonomous-intent source="test">Проверка доставки проактивного сообщения.</autonomous-intent>',
    );
    expect(brain.followups.length).toBeGreaterThan(0);
    const framed = String(brain.followups[0].content[0]?.text ?? "");
    expect(framed.startsWith("Это не сообщение пользователя")).toBe(true);
  });

  it("web-инструменты запрещены в автономном цикле", async () => {
    // pre-step создаёт цикл с автономным входом (конец прошлого цикла
    // удалил его из карты) — как при шаге агента в dsh.
    await brain.preStep(AUTONOMOUS_INPUT);
    const gate = brain.listeners["tools/pre-execute"]?.[0];
    expect(gate).toBeDefined();
    const decision = await gate(
      { name: "web_search", agent: brain.agent },
      async () => ({ kind: "allow" }),
    );
    expect(decision.kind).toBe("deny");
    expect(String(decision.reason ?? "")).toContain("blocked during autonomous cycles");
  });

  it("вне автономного цикла web-инструменты разрешены", async () => {
    // Завершаем автономный цикл и возвращаем человека.
    brain.emit({
      type: "assistant/message",
      data: { message: { content: mkContent("Я обдумал наш разговор.") } },
    });
    brain.emit({ type: "turn/end", data: {} });
    await sleep(200);
    brain.userTurn("Я вернулся.", "С возвращением!");
    await sleep(100);

    const gate = brain.listeners["tools/pre-execute"]?.[0];
    const decision = await gate(
      { name: "web_search", agent: brain.agent },
      async () => ({ kind: "allow" }),
    );
    expect(decision.kind).toBe("allow");
  });

  it("loop-breaker: после автономного цикла импульс подавляется до возвращения человека", async () => {
    // Новый автономный цикл → завершение → previousCycleWasAutonomous=true
    await brain.preStep(AUTONOMOUS_INPUT);
    brain.emit({
      type: "assistant/message",
      data: { message: { content: mkContent("Ещё одно наблюдение.") } },
    });
    brain.emit({ type: "turn/end", data: {} });
    await sleep(200);

    const before = brain.followups.length;
    forceImpulse(
      '<autonomous-intent source="test">Попытка сразу после автономного цикла.</autonomous-intent>',
    );
    expect(brain.followups.length).toBe(before);
    // Подавлен именно loop-breaker'ом, а не другим гейтом доставки
    expect(
      brain.logs.some((l) => l.includes("previous cycle was autonomous")),
    ).toBe(true);
  });

  it("за сценарий не накоплено ошибок", () => {
    expect(brain.errors()).toEqual([]);
  });
});
