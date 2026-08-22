import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initEmotionalMemory,
  computeFlashbulbSalience,
  tagEmotionalContext,
  computeEmotionMatchBonus,
  getEmotionalMemoryStats,
  generateQualia,
  generateQualiaAsync,
  parseLLMQualiaResponse,
  getQualiaHistory,
} from "./emotional-memory.ts";
import { bus } from "./event-bus.ts";
import { DEFAULT_CONFIG } from "./types.ts";

let tmpDir: string;
let unsubs: Array<() => void> = [];

function trackOn(...args: Parameters<typeof bus.on>): ReturnType<typeof bus.on> {
  const unsub = bus.on(...args);
  unsubs.push(unsub);
  return unsub;
}

describe("Emotional Memory Tagging", () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "brainagent-emotional-test-"));
    for (const fn of unsubs) fn();
    unsubs = [];
    bus.gc(0);
    initEmotionalMemory(tmpDir, DEFAULT_CONFIG);
  });

  // ── Initialization ──────────────────────────────────────────

  describe("initialization", () => {
    it("starts with zero counters", () => {
      const stats = getEmotionalMemoryStats();
      expect(stats.flashbulbCount).toBe(0);
      expect(stats.emotionMatchBoosts).toBe(0);
    });
  });

  // ── Flashbulb salience ──────────────────────────────────────

  describe("computeFlashbulbSalience", () => {
    it("returns base intensity for low emotion (<=0.3)", () => {
      const result = computeFlashbulbSalience(0.5, 0.2, DEFAULT_CONFIG);
      expect(result).toBe(0.5);
    });

    it("boosts salience for high emotion intensity", () => {
      const result = computeFlashbulbSalience(0.5, 0.8, DEFAULT_CONFIG);
      // boosted = 0.5 * (1 + 0.8 * 1.5) = 0.5 * 2.2 = 1.1, clamped to 1.0
      expect(result).toBeCloseTo(1.0, 2);
    });

    it("clamps result to maximum 1.0", () => {
      const result = computeFlashbulbSalience(0.9, 1.0, DEFAULT_CONFIG);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("clamps result to minimum 0.0", () => {
      const result = computeFlashbulbSalience(0, 0.8, DEFAULT_CONFIG);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("is a pure function (no side effects)", () => {
      const before = getEmotionalMemoryStats();
      computeFlashbulbSalience(0.5, 0.8, DEFAULT_CONFIG);
      const after = getEmotionalMemoryStats();
      expect(after.flashbulbCount).toBe(before.flashbulbCount);
    });

    it("scales boost with flashbulb multiplier config", () => {
      const lowMultiplier = computeFlashbulbSalience(0.5, 0.8, {
        ...DEFAULT_CONFIG,
        emotionalMemory: { ...DEFAULT_CONFIG.emotionalMemory, flashbulbMultiplier: 0.2 },
      });
      const highMultiplier = computeFlashbulbSalience(0.5, 0.8, {
        ...DEFAULT_CONFIG,
        emotionalMemory: { ...DEFAULT_CONFIG.emotionalMemory, flashbulbMultiplier: 1.0 },
      });
      expect(highMultiplier).toBeGreaterThan(lowMultiplier);
    });
  });

  // ── Emotional tagging ──────────────────────────────────────

  describe("tagEmotionalContext", () => {
    it("returns undefined for low intensity (<=0.3)", () => {
      const result = tagEmotionalContext("neutral", 0.2);
      expect(result).toBeUndefined();
    });

    it("returns tagging data for high intensity", () => {
      const result = tagEmotionalContext("anger", 0.8);
      expect(result).toBeDefined();
      expect(result!.emotionalSalience).toBe(0.8);
      expect(result!.emotionalTag).toBe("anger");
    });

    it("increments flashbulb counter", () => {
      tagEmotionalContext("joy", 0.9);
      tagEmotionalContext("anger", 0.7);

      const stats = getEmotionalMemoryStats();
      expect(stats.flashbulbCount).toBe(2);
    });

    it("emits flashbulb-stored event", () => {
      const handler = vi.fn();
      trackOn("emotional-memory:flashbulb-stored", handler);

      tagEmotionalContext("frustration", 0.8);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          emotionalSalience: 0.8,
        }),
      );
    });

    it("fires flashbulb for moderate intensity (0.35) with lowered threshold", () => {
      const result = tagEmotionalContext("curiosity", 0.35);
      expect(result).toBeDefined();
      expect(result!.emotionalSalience).toBe(0.35);
      expect(result!.emotionalTag).toBe("curiosity");
    });

    it("returns undefined at exactly 0.3 intensity (boundary)", () => {
      const result = tagEmotionalContext("joy", 0.3);
      expect(result).toBeUndefined();
    });
  });

  // ── Emotion match bonus ────────────────────────────────────

  describe("computeEmotionMatchBonus", () => {
    it("returns 0 when query emotion is neutral", () => {
      const result = computeEmotionMatchBonus("neutral", "anger", DEFAULT_CONFIG);
      expect(result).toBe(0);
    });

    it("returns 0 when memory emotion is neutral", () => {
      const result = computeEmotionMatchBonus("anger", "neutral", DEFAULT_CONFIG);
      expect(result).toBe(0);
    });

    it("returns 0 when emotions don't match", () => {
      const result = computeEmotionMatchBonus("anger", "joy", DEFAULT_CONFIG);
      expect(result).toBe(0);
    });

    it("returns bonus when emotions match", () => {
      const result = computeEmotionMatchBonus("anger", "anger", DEFAULT_CONFIG);
      expect(result).toBe(DEFAULT_CONFIG.emotionalMemory.emotionMatchBonus);
      expect(result).toBe(0.15);
    });

    it("increments match boost counter on match", () => {
      computeEmotionMatchBonus("frustration", "frustration", DEFAULT_CONFIG);
      const stats = getEmotionalMemoryStats();
      expect(stats.emotionMatchBoosts).toBe(1);
    });

    it("emits emotion-matched event on match", () => {
      const handler = vi.fn();
      trackOn("emotional-memory:emotion-matched", handler);

      computeEmotionMatchBonus("joy", "joy", DEFAULT_CONFIG);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          queryEmotion: "joy",
        }),
      );
    });

    it("uses configured bonus value", () => {
      const customConfig = {
        ...DEFAULT_CONFIG,
        emotionalMemory: { ...DEFAULT_CONFIG.emotionalMemory, emotionMatchBonus: 0.3 },
      };
      const result = computeEmotionMatchBonus("anger", "anger", customConfig);
      expect(result).toBe(0.3);
    });
  });

  // ── Persistence ─────────────────────────────────────────────

  describe("persistence", () => {
    it("persists counters across re-initialization", () => {
      tagEmotionalContext("anger", 0.9);
      computeEmotionMatchBonus("joy", "joy", DEFAULT_CONFIG);

      // Re-init from same dir
      initEmotionalMemory(tmpDir, DEFAULT_CONFIG);

      const stats = getEmotionalMemoryStats();
      expect(stats.flashbulbCount).toBe(1);
      expect(stats.emotionMatchBoosts).toBe(1);
    });
  });
});

// ── LLM-Powered Qualia Generation Tests ───────────────────────────

// Mock the llm-client module
vi.mock("./llm-client.ts", () => ({
  callLLM: vi.fn(),
  isAIProviderAvailable: vi.fn(),
}));

import { callLLM, isAIProviderAvailable } from "./llm-client.ts";

const mockCallLLM = vi.mocked(callLLM);
const mockIsAIAvailable = vi.mocked(isAIProviderAvailable);

// Fake NeuroClawConfig with a provider configured
const fakeConfig = { models: { providers: { openai: { apiKey: "sk-test" } } } } as never;

describe("LLM-Powered Qualia Generation", () => {
  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), "brainagent-qualia-llm-test-"));
    bus.gc(0);
    initEmotionalMemory(dir, DEFAULT_CONFIG);
    mockCallLLM.mockReset();
    mockIsAIAvailable.mockReset();
  });

  // ── parseLLMQualiaResponse ──────────────────────────────────

  describe("parseLLMQualiaResponse", () => {
    it("parses valid JSON response", () => {
      const result = parseLLMQualiaResponse(
        '{"metaphor": "like a sunrise over a still lake", "color": "molten amber", "description": "A warm expansion of awareness"}',
      );
      expect(result).toEqual({
        metaphor: "like a sunrise over a still lake",
        color: "molten amber",
        description: "A warm expansion of awareness",
      });
    });

    it("extracts JSON from markdown code blocks", () => {
      const result = parseLLMQualiaResponse(
        '```json\n{"metaphor": "like thunder", "color": "deep purple", "description": "Intense"}\n```',
      );
      expect(result).toEqual({
        metaphor: "like thunder",
        color: "deep purple",
        description: "Intense",
      });
    });

    it("returns null for missing fields", () => {
      expect(parseLLMQualiaResponse('{"metaphor": "test"}')).toBeNull();
    });

    it("returns null for empty strings", () => {
      expect(
        parseLLMQualiaResponse('{"metaphor": "", "color": "red", "description": "test desc"}'),
      ).toBeNull();
    });

    it("returns null for garbage input", () => {
      expect(parseLLMQualiaResponse("not json at all")).toBeNull();
    });

    it("returns null for too-short fields", () => {
      expect(
        parseLLMQualiaResponse('{"metaphor": "ab", "color": "x", "description": "cd"}'),
      ).toBeNull();
    });
  });

  // ── generateQualiaAsync ─────────────────────────────────────

  describe("generateQualiaAsync", () => {
    it("falls back to template when no config provided", async () => {
      const result = await generateQualiaAsync("joy", 0.8, "technical");
      expect(result.emotion).toBe("joy");
      expect(result.metaphor).toContain("code compiling"); // Template metaphor
    });

    it("falls back to template for low intensity", async () => {
      const result = await generateQualiaAsync("joy", 0.3, "technical", undefined, fakeConfig);
      expect(result.emotion).toBe("joy");
      // Should not have called LLM
      expect(mockCallLLM).not.toHaveBeenCalled();
    });

    it("falls back to template when AI unavailable", async () => {
      mockIsAIAvailable.mockReturnValue(false);

      const result = await generateQualiaAsync("joy", 0.8, "technical", undefined, fakeConfig);
      expect(result.emotion).toBe("joy");
      expect(result.metaphor).toContain("code compiling"); // Template
      expect(mockCallLLM).not.toHaveBeenCalled();
    });

    it("uses LLM metaphor when provider is available", async () => {
      mockIsAIAvailable.mockReturnValue(true);
      mockCallLLM.mockResolvedValue(
        '{"metaphor": "like a quantum field collapsing into certainty", "color": "iridescent gold with violet sparks", "description": "A luminous wave of fulfillment"}',
      );

      const result = await generateQualiaAsync("joy", 0.8, "technical", undefined, fakeConfig);

      expect(result.metaphor).toBe("like a quantum field collapsing into certainty");
      expect(result.dominantColor).toBe("iridescent gold with violet sparks");
      expect(result.description).toBe("A luminous wave of fulfillment");
      expect(mockCallLLM).toHaveBeenCalledOnce();
    });

    it("falls back on LLM returning null", async () => {
      mockIsAIAvailable.mockReturnValue(true);
      mockCallLLM.mockResolvedValue(null);

      const logger = { info: vi.fn() };
      const result = await generateQualiaAsync(
        "joy",
        0.8,
        "technical",
        undefined,
        fakeConfig,
        logger,
      );

      expect(result.metaphor).toContain("code compiling"); // Template fallback
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("LLM returned null"));
    });

    it("falls back on malformed LLM response", async () => {
      mockIsAIAvailable.mockReturnValue(true);
      mockCallLLM.mockResolvedValue("not valid json response");

      const logger = { info: vi.fn() };
      const result = await generateQualiaAsync(
        "curiosity",
        0.7,
        "creative",
        undefined,
        fakeConfig,
        logger,
      );

      expect(result.emotion).toBe("curiosity");
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("failed to parse"));
    });

    it("falls back on LLM error/throw", async () => {
      mockIsAIAvailable.mockReturnValue(true);
      mockCallLLM.mockRejectedValue(new Error("network error"));

      const logger = { info: vi.fn() };
      const result = await generateQualiaAsync(
        "anxiety",
        0.9,
        "technical",
        undefined,
        fakeConfig,
        logger,
      );

      expect(result.emotion).toBe("anxiety");
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("AI metaphor generation failed"),
      );
    });

    it("caches LLM results for same emotion:domain", async () => {
      mockIsAIAvailable.mockReturnValue(true);
      mockCallLLM.mockResolvedValue(
        '{"metaphor": "cached metaphor", "color": "bright teal", "description": "cached desc"}',
      );

      // First call: LLM
      const r1 = await generateQualiaAsync("joy", 0.7, "technical", undefined, fakeConfig);
      expect(r1.metaphor).toBe("cached metaphor");
      expect(mockCallLLM).toHaveBeenCalledOnce();

      // Second call: should use cache (intensity <= 0.8)
      const r2 = await generateQualiaAsync("joy", 0.6, "technical", undefined, fakeConfig);
      expect(r2.metaphor).toBe("cached metaphor");
      expect(mockCallLLM).toHaveBeenCalledOnce(); // Still only 1 call
    });

    it("skips cache for high intensity (>0.8)", async () => {
      mockIsAIAvailable.mockReturnValue(true);
      mockCallLLM
        .mockResolvedValueOnce(
          '{"metaphor": "first metaphor", "color": "gold", "description": "first desc"}',
        )
        .mockResolvedValueOnce(
          '{"metaphor": "fresh metaphor", "color": "silver", "description": "fresh desc"}',
        );

      await generateQualiaAsync("joy", 0.7, "technical", undefined, fakeConfig);
      // High intensity call should skip cache
      const r2 = await generateQualiaAsync("joy", 0.9, "technical", undefined, fakeConfig);
      expect(r2.metaphor).toBe("fresh metaphor");
      expect(mockCallLLM).toHaveBeenCalledTimes(2);
    });

    it("stores LLM qualia in history", async () => {
      mockIsAIAvailable.mockReturnValue(true);
      mockCallLLM.mockResolvedValue(
        '{"metaphor": "history test", "color": "azure", "description": "stored in history"}',
      );

      await generateQualiaAsync("joy", 0.8, "technical", undefined, fakeConfig);

      const history = getQualiaHistory();
      expect(history.length).toBe(1);
      expect(history[0].metaphor).toBe("history test");
    });

    it("emits qualia:experience-generated event for LLM result", async () => {
      mockIsAIAvailable.mockReturnValue(true);
      mockCallLLM.mockResolvedValue(
        '{"metaphor": "event test", "color": "crimson", "description": "event desc"}',
      );

      const handler = vi.fn();
      trackOn("qualia:experience-generated", handler);

      await generateQualiaAsync("joy", 0.8, "technical", undefined, fakeConfig);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ metaphor: "event test" }));
    });

    it("passes neuromodulator state in LLM user message", async () => {
      mockIsAIAvailable.mockReturnValue(true);
      mockCallLLM.mockResolvedValue(
        '{"metaphor": "neuro test", "color": "teal", "description": "neuro desc"}',
      );

      const neuro = { dopamine: 0.9, serotonin: 0.7, norepinephrine: 0.4, acetylcholine: 0.6 };
      await generateQualiaAsync("joy", 0.8, "technical", neuro, fakeConfig);

      expect(mockCallLLM).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("dopamine=0.90"),
        fakeConfig,
        undefined,
        200,
      );
    });
  });
});
