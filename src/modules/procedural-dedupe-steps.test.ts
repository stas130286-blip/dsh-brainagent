import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initMemoryStorage, storeWorkflow, mergeDuplicateWorkflows } from "./hippocampus.ts";

let tempDir: string;

const STEPS = ["проверь доступность сервера по пингу", "проверь свободное место на диске", "проверь список запущенных сервисов"];

describe("процедурная память — дедупликация по шагам (v0.9.14)", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-dedupe-steps-"));
    initMemoryStorage(tempDir);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  it("разные триггеры, но одинаковые шаги — одна запись", () => {
    const first = storeWorkflow("Запомнить последовательность проверки сервера", "запомни как проверять сервер", STEPS);
    const second = storeWorkflow("Проверка доступности сервера и диска", "проверка сервера шаги", STEPS);
    expect(second.id).toBe(first.id);
  });

  it("шаги, отличающиеся только регистром и пробелами, тоже сливаются", () => {
    const first = storeWorkflow("Процедура A", "триггер один", STEPS);
    const second = storeWorkflow(
      "Процедура B",
      "триггер два",
      STEPS.map((s) => `  ${s.toUpperCase()} `),
    );
    expect(second.id).toBe(first.id);
  });

  it("разные наборы шагов остаются разными записями", () => {
    const first = storeWorkflow("Процедура A", "триггер один", STEPS);
    const other = storeWorkflow("Процедура B", "триггер два", ["установить nginx", "настроить firewall"]);
    expect(other.id).not.toBe(first.id);
  });
});

describe("процедурная память — слияние накопленных дублей (v0.9.14)", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-merge-"));
    // Имитируем стор, накопленный до v0.9.14: два дубля с одинаковыми
    // шагами, но разными триггерами (LLM-парафраз), плюс уникальная запись.
    const dir = join(tempDir, ".brainagent", "memory", "procedural");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "store.json"),
      JSON.stringify([
        {
          id: "proc-keep",
          description: "Проверка сервера (первая диктовка)",
          triggerPattern: "запомни как проверять сервер",
          steps: STEPS,
          successRate: 0.5,
          usageCount: 3,
          lastUsed: 1000,
        },
        {
          id: "proc-dup",
          description: "Проверка сервера (парафраз)",
          triggerPattern: "проверка сервера шаги",
          steps: STEPS.map((s) => s.toUpperCase()),
          successRate: 0.7,
          usageCount: 1,
          lastUsed: 2000,
        },
        {
          id: "proc-unique",
          description: "Резервное копирование",
          triggerPattern: "настроить бэкап",
          steps: ["смонтировать диск", "настроить rsync", "добавить в cron"],
          successRate: 0.5,
          usageCount: 0,
          lastUsed: 3000,
        },
      ]),
      "utf8",
    );
    initMemoryStorage(tempDir);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  it("сливает дубли, суммирует использования, оставляет более используемую запись", () => {
    const merged = mergeDuplicateWorkflows();
    expect(merged).toBe(1);

    // Повторная диктовка тех же шагов попадает в оставшуюся запись
    const stored = storeWorkflow("Ещё один парафраз", "сервер проверить как", STEPS);
    expect(stored.id).toBe("proc-keep");
    expect(stored.usageCount).toBe(4); // 3 + 1 слитый дубль
    expect(stored.successRate).toBe(0.7); // лучшая из двух

    // Повторное слияние ничего не находит
    expect(mergeDuplicateWorkflows()).toBe(0);
  });
});
