import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { bus } from "./event-bus.ts";
import {
  initQualiaSimulator,
  generateQualiaState,
  buildQualiaContext,
  getCurrentQualia,
  getQualiaLog,
  getQualiaSimulatorStats,
} from "./qualia-simulator.ts";
import { DEFAULT_CONFIG } from "./types.ts";

let tmpDir: string;
let unsubs: Array<() => void> = [];

function trackOn(...args: Parameters<typeof bus.on>): ReturnType<typeof bus.on> {
  const unsub = bus.on(...args);
  unsubs.push(unsub);
  return unsub;
}

describe("Qualia Simulator", () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "brainagent-qualia-sim-test-"));
    for (const fn of unsubs) fn();
    unsubs = [];
    bus.gc(0);
    initQualiaSimulator(tmpDir, DEFAULT_CONFIG);
  });

  describe("initialization", () => {
    it("starts with no qualia", () => {
      const stats = getQualiaSimulatorStats();
      expect(stats.currentEmotion).toBeNull();
      expect(stats.currentIntensity).toBe(0);
      expect(stats.logSize).toBe(0);
      expect(stats.dominantColor).toBeNull();
    });

    it("has no current qualia initially", () => {
      expect(getCurrentQualia()).toBeNull();
    });

    it("returns empty log initially", () => {
      expect(getQualiaLog()).toEqual([]);
    });
  });

  describe("generateQualiaState", () => {
    it("generates qualia with description for high intensity", () => {
      const q = generateQualiaState("joy", 0.9, "creative");

      expect(q.emotion).toBe("joy");
      expect(q.intensity).toBe(0.9);
      expect(q.domain).toBe("creative");
      expect(q.description).toContain("Intense joy");
      expect(q.dominantColor).toBeDefined();
      expect(q.metaphor).toBeDefined();
    });

    it("generates qualia with moderate description", () => {
      const q = generateQualiaState("anxiety", 0.5, "technical");

      expect(q.description).toContain("Moderate anxiety");
    });

    it("generates qualia with faint description for low intensity", () => {
      const q = generateQualiaState("curiosity", 0.2, "casual");

      // Template rotation picks from 5 variants; all contain the emotion word
      expect(q.description.toLowerCase()).toContain("curiosity");
    });

    it("integrates neuromodulator state", () => {
      const neuro = { dopamine: 0.9, serotonin: 0.8, norepinephrine: 0.3, acetylcholine: 0.5 };
      const q = generateQualiaState("joy", 0.8, "technical", neuro);

      expect(q.description).toContain("motivated");
    });

    it("uses metaphor from emotional memory when provided", () => {
      const q = generateQualiaState("joy", 0.8, "technical", undefined, {
        metaphor: "like sunshine",
        dominantColor: "bright yellow",
      });

      expect(q.metaphor).toBe("like sunshine");
      expect(q.dominantColor).toBe("bright yellow");
    });

    it("emits qualia:state-updated event", () => {
      const handler = vi.fn();
      trackOn("qualia:state-updated", handler);

      generateQualiaState("joy", 0.7, "casual");

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ intensity: 0.7 }));
    });

    it("updates current qualia", () => {
      generateQualiaState("frustration", 0.6, "technical");

      const current = getCurrentQualia();
      expect(current).not.toBeNull();
      expect(current!.emotion).toBe("frustration");
    });

    it("appends to qualia log", () => {
      generateQualiaState("joy", 0.5, "casual");
      generateQualiaState("curiosity", 0.7, "technical");

      const log = getQualiaLog();
      expect(log.length).toBe(2);
      expect(log[0].emotion).toBe("joy");
      expect(log[1].emotion).toBe("curiosity");
    });
  });

  describe("buildQualiaContext", () => {
    it("returns undefined when no qualia exist", () => {
      expect(buildQualiaContext()).toBeUndefined();
    });

    it("returns undefined when intensity below threshold", () => {
      generateQualiaState("neutral", 0.1, "casual");
      expect(buildQualiaContext()).toBeUndefined();
    });

    it("returns context when intensity above threshold", () => {
      generateQualiaState("joy", 0.8, "creative");

      const ctx = buildQualiaContext();
      expect(ctx).toBeDefined();
      expect(ctx).toContain("Subjective Experience");
      expect(ctx).toContain("Phenomenal quality");
    });

    it("returns context at lowered threshold (0.25)", () => {
      generateQualiaState("curiosity", 0.25, "technical");

      const ctx = buildQualiaContext();
      expect(ctx).toBeDefined();
      expect(ctx).toContain("Subjective Experience");
    });

    it("returns undefined at exactly threshold boundary (0.19)", () => {
      generateQualiaState("neutral", 0.19, "casual");
      expect(buildQualiaContext()).toBeUndefined();
    });

    it("includes emotional trajectory when 3+ entries", () => {
      generateQualiaState("joy", 0.8, "creative");
      generateQualiaState("curiosity", 0.7, "technical");
      generateQualiaState("frustration", 0.6, "technical");

      const ctx = buildQualiaContext();
      expect(ctx).toContain("trajectory");
    });
  });

  describe("stats", () => {
    it("reflects current state", () => {
      generateQualiaState("curiosity", 0.75, "technical");

      const stats = getQualiaSimulatorStats();
      expect(stats.currentEmotion).toBe("curiosity");
      expect(stats.currentIntensity).toBe(0.75);
      expect(stats.logSize).toBe(1);
      expect(stats.dominantColor).toBeDefined();
    });
  });

  describe("persistence", () => {
    it("persists and reloads across init", () => {
      generateQualiaState("joy", 0.8, "creative");

      initQualiaSimulator(tmpDir, DEFAULT_CONFIG);

      const log = getQualiaLog();
      expect(log.length).toBe(1);
      expect(log[0].emotion).toBe("joy");
    });
  });
});
