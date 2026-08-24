import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initMemoryStorage, storeWorkflow } from "./hippocampus.ts";
import { extractProcedure } from "./procedural-extractor.ts";

let tempDir: string;

describe("процедурная память — дедупликация (v0.9.3)", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-proc-"));
    initMemoryStorage(tempDir);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  it("повторное извлечение того же триггера усиливает запись, а не плодит дубли", () => {
    const first = storeWorkflow(
      "Как: развернуть сервер",
      "развернуть сервер",
      ["установить зависимости", "запустить процесс"],
    );
    const second = storeWorkflow(
      "Как: развернуть сервер",
      "Развернуть Сервер",
      ["установить зависимости", "запустить процесс"],
    );
    expect(second.id).toBe(first.id);
  });

  it("шаги дополняются при повторном извлечении с шагами", () => {
    const first = storeWorkflow("Как: настроить проект", "настроить проект", []);
    const second = storeWorkflow(
      "Как: настроить проект",
      "настроить проект",
      ["клонировать репозиторий", "установить зависимости"],
    );
    expect(second.id).toBe(first.id);
    expect(second.steps).toEqual(["клонировать репозиторий", "установить зависимости"]);
  });

  it("разные триггеры остаются разными записями", () => {
    const first = storeWorkflow("Как: развернуть сервер", "развернуть сервер", ["шаг"]);
    const other = storeWorkflow("Как: собрать бандл", "собрать бандл", ["шаг"]);
    expect(other.id).not.toBe(first.id);
  });
});

describe("procedural-extractor — нумерованные шаги (v0.9.3)", () => {
  it("извлекает процедуру из перечисления «1) … 2) … 3)»", () => {
    const proc = extractProcedure(
      "выполняй ровно три шага: 1) собери показатели системы, 2) проверь состояние памяти, 3) составь короткую сводку.",
    );
    expect(proc).not.toBeNull();
    expect(proc!.steps).toHaveLength(3);
    expect(proc!.steps[0]).toContain("собери показатели системы");
    expect(proc!.steps[1]).toContain("проверь состояние памяти");
    expect(proc!.steps[2]).toContain("составь короткую сводку");
  });

  it("триггер нумерованной процедуры — начало сообщения без хвостовой пунктуации", () => {
    const proc = extractProcedure(
      "Запомни процедуру: 1) первый шаг, 2) второй шаг, 3) третий шаг.",
    );
    expect(proc).not.toBeNull();
    expect(proc!.triggerPattern.length).toBeGreaterThan(5);
    expect(proc!.triggerPattern).not.toMatch(/[\s,;:]$/);
  });
});
