import { describe, expect, it } from "vitest";
import { extractProcedure, extractProcedureAsync, isProcedural } from "./procedural-extractor.ts";
import type { ThalamusClassification } from "./types.ts";

describe("procedural-extractor", () => {
  describe("extractProcedure", () => {
    // ═══════════════════════════════════════════════════════════════
    // "How to" questions (Russian)
    // ═══════════════════════════════════════════════════════════════
    it("extracts 'как' how-to questions", () => {
      const proc = extractProcedure("Как мне установить Node.js?");
      expect(proc).not.toBeNull();
      expect(proc?.triggerPattern).toContain("установить");
      expect(proc?.description).toContain("Node.js");
    });

    it("extracts 'подскажи как' questions", () => {
      const proc = extractProcedure("Подскажи как настроить Docker?");
      expect(proc).not.toBeNull();
      expect(proc?.triggerPattern).toContain("настроить");
    });

    it("extracts 'что нужно для' questions", () => {
      const proc = extractProcedure("Что нужно сделать чтобы запустить сервер?");
      expect(proc).not.toBeNull();
      expect(proc?.triggerPattern).toContain("запустить");
    });

    // ═══════════════════════════════════════════════════════════════
    // "How to" questions (English)
    // ═══════════════════════════════════════════════════════════════
    it("extracts 'how to' questions (English)", () => {
      const proc = extractProcedure("How do I install npm packages?");
      expect(proc).not.toBeNull();
      expect(proc?.triggerPattern).toContain("install");
    });

    it("extracts 'explain how to' questions", () => {
      const proc = extractProcedure("Explain how to configure webpack?");
      expect(proc).not.toBeNull();
      expect(proc?.triggerPattern).toContain("configure");
    });

    // ═══════════════════════════════════════════════════════════════
    // Action requests
    // ═══════════════════════════════════════════════════════════════
    it("extracts 'создай' action requests", () => {
      const proc = extractProcedure("Создай напоминание о встрече.");
      expect(proc).not.toBeNull();
      expect(proc?.description).toContain("напоминание");
    });

    it("extracts 'помоги' requests", () => {
      const proc = extractProcedure("Помоги мне настроить проект.");
      expect(proc).not.toBeNull();
      expect(proc?.triggerPattern).toContain("настроить");
    });

    it("extracts 'create' action requests (English)", () => {
      const proc = extractProcedure("Create a new reminder for tomorrow.");
      expect(proc).not.toBeNull();
      expect(proc?.description).toContain("reminder");
    });

    // ═══════════════════════════════════════════════════════════════
    // Classification boost
    // ═══════════════════════════════════════════════════════════════
    it("boosts confidence for technical domain", () => {
      const classification: ThalamusClassification = {
        modality: "text",
        domain: "technical",
        complexity: "moderate",
        intentSummary: "test",
        confidence: 0.9,
        processingPath: "slow",
      };
      const proc = extractProcedure("Как настроить базу данных?", classification);
      expect(proc).not.toBeNull();
      expect(proc!.confidence).toBeGreaterThan(0.6);
    });

    it("boosts confidence for command domain", () => {
      const classification: ThalamusClassification = {
        modality: "text",
        domain: "command",
        complexity: "simple",
        intentSummary: "test",
        confidence: 0.9,
        processingPath: "fast",
      };
      const proc = extractProcedure("Установи пакет typescript.", classification);
      expect(proc).not.toBeNull();
      expect(proc!.confidence).toBeGreaterThan(0.5);
    });

    // ═══════════════════════════════════════════════════════════════
    // Edge cases
    // ═══════════════════════════════════════════════════════════════
    it("returns null for non-procedural text", () => {
      const proc = extractProcedure("Привет, как дела?");
      expect(proc).toBeNull();
    });

    it("returns null for short text", () => {
      const proc = extractProcedure("Ок.");
      expect(proc).toBeNull();
    });

    it("returns null for casual chat", () => {
      const classification: ThalamusClassification = {
        modality: "text",
        domain: "casual",
        complexity: "trivial",
        intentSummary: "test",
        confidence: 0.5,
        processingPath: "fast",
      };
      const proc = extractProcedure("Что делаешь?", classification);
      expect(proc).toBeNull();
    });
  });

  describe("isProcedural", () => {
    it("returns true for technical domain", () => {
      const classification: ThalamusClassification = {
        modality: "text",
        domain: "technical",
        complexity: "moderate",
        intentSummary: "test",
        confidence: 0.9,
        processingPath: "slow",
      };
      expect(isProcedural("любой текст", classification)).toBe(true);
    });

    it("returns true for command domain", () => {
      const classification: ThalamusClassification = {
        modality: "text",
        domain: "command",
        complexity: "simple",
        intentSummary: "test",
        confidence: 0.9,
        processingPath: "fast",
      };
      expect(isProcedural("любой текст", classification)).toBe(true);
    });

    it("returns true for 'как' questions", () => {
      expect(isProcedural("Как сделать это?")).toBe(true);
    });

    it("returns true for 'how to' questions", () => {
      expect(isProcedural("How to do this?")).toBe(true);
    });

    it("returns true for action keywords", () => {
      expect(isProcedural("Создай файл")).toBe(true);
      expect(isProcedural("Setup project")).toBe(true);
      expect(isProcedural("Установи пакет")).toBe(true);
    });

    it("returns false for casual questions", () => {
      const classification: ThalamusClassification = {
        modality: "text",
        domain: "casual",
        complexity: "trivial",
        intentSummary: "test",
        confidence: 0.9,
        processingPath: "fast",
      };
      expect(isProcedural("Что делаешь?", classification)).toBe(false);
    });
  });

  describe("extractProcedureAsync", () => {
    it("falls back to regex when no AI provider", async () => {
      const config = { models: { providers: {} } } as never;
      const result = await extractProcedureAsync("Как мне установить Node.js?", config);
      expect(result).not.toBeNull();
      expect(result?.triggerPattern).toContain("установить");
    });

    it("returns null for non-procedural text without AI", async () => {
      const config = { models: { providers: {} } } as never;
      const result = await extractProcedureAsync("Привет, как дела?", config);
      expect(result).toBeNull();
    });

    it("passes classification to regex fallback", async () => {
      const config = { models: { providers: {} } } as never;
      const classification: ThalamusClassification = {
        modality: "text",
        domain: "technical",
        complexity: "moderate",
        intentSummary: "test",
        confidence: 0.9,
        processingPath: "slow",
      };
      const result = await extractProcedureAsync(
        "Как настроить базу данных?",
        config,
        classification,
      );
      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThan(0.6);
    });
  });
});
