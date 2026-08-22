import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { bus } from "./event-bus.ts";
import {
  initTemporalBinding,
  createMoment,
  buildTemporalContext,
  getCurrentMoment,
  getMomentStream,
  getTemporalBindingStats,
} from "./temporal-binding.ts";
import { DEFAULT_CONFIG } from "./types.ts";

let tmpDir: string;
let unsubs: Array<() => void> = [];

function trackOn(...args: Parameters<typeof bus.on>): ReturnType<typeof bus.on> {
  const unsub = bus.on(...args);
  unsubs.push(unsub);
  return unsub;
}

describe("Temporal Binding", () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "brainagent-temporal-test-"));
    for (const fn of unsubs) fn();
    unsubs = [];
    bus.gc(0);
    initTemporalBinding(tmpDir, DEFAULT_CONFIG);
  });

  describe("initialization", () => {
    it("starts with zero moments", () => {
      const stats = getTemporalBindingStats();
      expect(stats.momentCount).toBe(0);
      expect(stats.oldestTimestamp).toBeNull();
      expect(stats.newestTimestamp).toBeNull();
      expect(stats.dominantDomain).toBeNull();
    });

    it("has no current moment initially", () => {
      expect(getCurrentMoment()).toBeUndefined();
    });

    it("returns empty stream initially", () => {
      expect(getMomentStream()).toEqual([]);
    });
  });

  describe("createMoment", () => {
    it("creates a consciousness moment with all fields", () => {
      const moment = createMoment(
        "Hello world",
        ["thinking about greeting"],
        "joy",
        0.6,
        ["mem_1"],
        ["respond warmly"],
        0.8,
        "casual",
      );

      expect(moment.id).toMatch(/^moment_/);
      expect(moment.input).toBe("Hello world");
      expect(moment.thoughts).toEqual(["thinking about greeting"]);
      expect(moment.emotions).toEqual({ label: "joy", intensity: 0.6 });
      expect(moment.activeMemoryIds).toEqual(["mem_1"]);
      expect(moment.intentions).toEqual(["respond warmly"]);
      expect(moment.confidence).toBe(0.8);
      expect(moment.domain).toBe("casual");
      expect(moment.causalLinkId).toBeNull(); // First moment has no causal link
    });

    it("links subsequent moments causally", () => {
      const m1 = createMoment("First", [], "neutral", 0, [], [], 0.5, "casual");
      const m2 = createMoment("Second", [], "neutral", 0, [], [], 0.5, "casual");
      const m3 = createMoment("Third", [], "neutral", 0, [], [], 0.5, "casual");

      expect(m2.causalLinkId).toBe(m1.id);
      expect(m3.causalLinkId).toBe(m2.id);
    });

    it("truncates long input", () => {
      const longInput = "x".repeat(200);
      const moment = createMoment(longInput, [], "neutral", 0, [], [], 0.5, "casual");
      expect(moment.input.length).toBeLessThanOrEqual(154); // 150 + "..."
    });

    it("limits thoughts to 5", () => {
      const thoughts = ["a", "b", "c", "d", "e", "f", "g"];
      const moment = createMoment("test", thoughts, "neutral", 0, [], [], 0.5, "casual");
      expect(moment.thoughts.length).toBe(5);
    });

    it("emits temporal:moment-created event", () => {
      const handler = vi.fn();
      trackOn("temporal:moment-created", handler);

      createMoment("test", [], "neutral", 0, [], [], 0.5, "casual");

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ momentId: expect.any(String) }),
      );
    });

    it("emits temporal:stream-updated event", () => {
      const handler = vi.fn();
      trackOn("temporal:stream-updated", handler);

      createMoment("test", [], "neutral", 0, [], [], 0.5, "casual");

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ streamLength: 1 }));
    });

    it("enforces ring buffer limit", () => {
      const config = { ...DEFAULT_CONFIG, temporalBinding: { maxMoments: 3 } };
      initTemporalBinding(tmpDir, config);

      createMoment("a", [], "neutral", 0, [], [], 0.5, "casual");
      createMoment("b", [], "neutral", 0, [], [], 0.5, "casual");
      createMoment("c", [], "neutral", 0, [], [], 0.5, "casual");
      createMoment("d", [], "neutral", 0, [], [], 0.5, "casual");

      const stream = getMomentStream();
      expect(stream.length).toBe(3);
      expect(stream[0].input).toBe("b");
    });
  });

  describe("buildTemporalContext", () => {
    it("returns undefined when no moments exist", () => {
      expect(buildTemporalContext()).toBeUndefined();
    });

    it("returns context with recent moments", () => {
      createMoment("first", ["thinking"], "curiosity", 0.7, [], [], 0.8, "technical");
      createMoment("second", [], "joy", 0.5, [], [], 0.6, "creative");

      const ctx = buildTemporalContext();
      expect(ctx).toBeDefined();
      expect(ctx).toContain("Temporal Stream");
      expect(ctx).toContain("technical");
      expect(ctx).toContain("creative");
      expect(ctx).toContain("Flow:");
    });
  });

  describe("stats", () => {
    it("tracks dominant domain", () => {
      createMoment("a", [], "neutral", 0, [], [], 0.5, "technical");
      createMoment("b", [], "neutral", 0, [], [], 0.5, "technical");
      createMoment("c", [], "neutral", 0, [], [], 0.5, "casual");

      const stats = getTemporalBindingStats();
      expect(stats.momentCount).toBe(3);
      expect(stats.dominantDomain).toBe("technical");
    });
  });

  describe("persistence", () => {
    it("persists and reloads moments across init", () => {
      createMoment("persistent", ["thought"], "joy", 0.8, [], [], 0.9, "emotional");

      // Reinitialize — should reload from disk
      initTemporalBinding(tmpDir, DEFAULT_CONFIG);

      const stream = getMomentStream();
      expect(stream.length).toBe(1);
      expect(stream[0].input).toBe("persistent");
    });
  });
});
