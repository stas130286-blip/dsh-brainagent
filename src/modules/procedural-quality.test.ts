import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initMemoryStorage, storeWorkflow, pruneWeakWorkflows, findMatchingWorkflow } from "./hippocampus.ts";
import {
  extractProcedure,
  isMeaningfulStep,
  isStorableProcedure,
  parseProcedureResponse,
  type ProceduralPattern,
} from "./procedural-extractor.ts";

let tempDir: string;

function makePattern(overrides: Partial<ProceduralPattern>): ProceduralPattern {
  return {
    triggerPattern: "настроить проект",
    description: "Процедура из 2 шагов",
    steps: ["клонировать репозиторий", "установить зависимости"],
    domain: "technical",
    confidence: 0.85,
    ...overrides,
  };
}

describe("процедурная память — гейт качества (v0.9.13)", () => {
  describe("isMeaningfulStep", () => {
    it("отклоняет слишком короткие шаги", () => {
      expect(isMeaningfulStep("ок")).toBe(false);
      expect(isMeaningfulStep("  ")).toBe(false);
    });

    it("отклоняет шаги-плейсхолдеры", () => {
      expect(isMeaningfulStep("...")).toBe(false);
      expect(isMeaningfulStep("any")).toBe(false);
      expect(isMeaningfulStep("шаг 1")).toBe(false);
      expect(isMeaningfulStep("TODO")).toBe(false);
    });

    it("отклоняет шаг, дублирующий триггер", () => {
      expect(isMeaningfulStep("Создай напоминание", "создай напоминание")).toBe(false);
    });

    it("принимает реальный шаг", () => {
      expect(isMeaningfulStep("установить зависимости")).toBe(true);
    });
  });

  describe("isStorableProcedure", () => {
    it("отклоняет одиночную команду (бывший мусор «Action: ANY»)", () => {
      const p = makePattern({
        triggerPattern: "create any",
        description: "Action: any",
        steps: ["create any"],
        confidence: 0.85,
      });
      expect(isStorableProcedure(p)).toBe(false);
    });

    it("отклоняет два одинаковых шага", () => {
      const p = makePattern({ steps: ["установить npm", "Установить NPM"] });
      expect(isStorableProcedure(p)).toBe(false);
    });

    it("принимает два и более реальных шага", () => {
      expect(isStorableProcedure(makePattern({}))).toBe(true);
    });

    it("отклоняет низкую уверенность даже при шагах", () => {
      const p = makePattern({ confidence: 0.4 });
      expect(isStorableProcedure(p)).toBe(false);
    });

    it("отклоняет пустой список шагов", () => {
      const p = makePattern({ steps: [] });
      expect(isStorableProcedure(p)).toBe(false);
    });
  });

  describe("интеграция с extractProcedure", () => {
    it("action_request всё ещё извлекается, но гейт не даёт сохранить один шаг", () => {
      const proc = extractProcedure("Создай напоминание о встрече.");
      expect(proc).not.toBeNull();
      expect(isStorableProcedure(proc!)).toBe(false);
    });

    it("нумерованная процедура из трёх шагов проходит гейт", () => {
      const proc = extractProcedure(
        "выполняй ровно три шага: 1) собери показатели системы, 2) проверь состояние памяти, 3) составь короткую сводку.",
        {
          modality: "text",
          domain: "technical",
          complexity: "moderate",
          intentSummary: "test",
          confidence: 0.9,
          processingPath: "slow",
        },
      );
      expect(proc).not.toBeNull();
      expect(isStorableProcedure(proc!)).toBe(true);
    });
  });

  describe("parseProcedureResponse", () => {
    it("отфильтровывает шаги-плейсхолдеры из ответа LLM", () => {
      const parsed = parseProcedureResponse(
        '{"isProcedure":true,"trigger":"настроить сервер","description":"Настройка сервера","steps":["...","any","установить nginx","настроить firewall"],"domain":"technical"}',
      );
      expect(parsed).not.toBeNull();
      expect(parsed!.steps).toEqual(["установить nginx", "настроить firewall"]);
    });

    it("возвращает пустые шаги, если LLM нагородил только плейсхолдеры", () => {
      const parsed = parseProcedureResponse(
        '{"isProcedure":true,"trigger":"запустить сервер","description":"Запуск","steps":["...","TODO"],"domain":"technical"}',
      );
      expect(parsed).not.toBeNull();
      expect(parsed!.steps).toEqual([]);
      expect(isStorableProcedure(parsed!)).toBe(false);
    });
  });
});

describe("процедурная память — чистка стора (v0.9.13)", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-prune-"));
    initMemoryStorage(tempDir);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  it("удаляет слабые процедуры и оставляет настоящие", () => {
    storeWorkflow("Action: any", "create any", ["create any"]);
    storeWorkflow("Действие: напоминание", "создай напоминание о встрече", [
      "создай напоминание о встрече",
    ]);
    storeWorkflow("Процедура из 3 шагов", "развернуть сервер", [
      "клонировать репозиторий",
      "установить зависимости",
      "запустить процесс",
    ]);

    const removed = pruneWeakWorkflows(2);
    expect(removed).toBe(2);

    // Мусор больше не всплывает в подборе процедур
    const match = findMatchingWorkflow("create any files");
    expect(match?.triggerPattern).not.toBe("create any");
  });

  it("на чистом сторе возвращает 0", () => {
    storeWorkflow("Процедура из 2 шагов", "настроить проект", [
      "клонировать репозиторий",
      "установить зависимости",
    ]);
    expect(pruneWeakWorkflows(2)).toBe(0);
  });
});
