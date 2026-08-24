/**
 * Eval-сценарии: полный конвейер на «живом» диалоге.
 * Плагин поднимается целиком; проверяется механика потока
 * (слушатели → циклы → pre-step → команда /brain), а не содержимое
 * эвристик — содержимое покрывает recall-regression.eval.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootBrain, sleep } from "./harness.ts";
import type { BrainHandle } from "./harness.ts";

describe("eval: полный конвейер", () => {
  let brain: BrainHandle;

  beforeAll(async () => {
    brain = await bootBrain();
  });

  afterAll(() => {
    brain.dispose();
  });

  it("запуск: все крючки пайплайна на месте", () => {
    const hooked = Object.keys(brain.listeners);
    for (const name of [
      "session/event",
      "agent/pre-step",
      "agent/request",
      "tools/pre-execute",
    ]) {
      expect(hooked).toContain(name);
    }
    expect(brain.commands.brain).toBeDefined();
    expect(brain.errors()).toEqual([]);
  });

  it("ход 1: пользовательский цикл проходит без ошибок", async () => {
    brain.userTurn(
      "Привет! Расскажи, как устроена твоя память.",
      "Я запоминаю важные факты и события из наших разговоров.",
    );
    await sleep(400); // endCycle асинхронный — даём циклу завершиться
    expect(brain.errors()).toEqual([]);
  });

  it("ход 2: pre-step возвращает enter и заворачивает контекст в brainagent-context", async () => {
    const res = await brain.preStep("А что ты помнишь о нашем прошлом разговоре?");
    expect(res.kind).toBe("enter");
    if (res.contextText) {
      expect(res.contextText).toContain("<brainagent-context>");
    }
    expect(brain.errors()).toEqual([]);
  });

  it("/brain status отвечает текстом", async () => {
    const result = await brain.runCommand("brain", " status");
    expect(result.kind).toBe("success");
    expect(String(result.text ?? "").length).toBeGreaterThan(0);
    expect(brain.errors()).toEqual([]);
  });
});
