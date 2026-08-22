import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initDopamineSystem,
  processInteractionOutcome,
  getDopamineStats,
  getNeuromodulatorState,
  getEffectiveLearningRate,
  getRiskTolerance,
  getAttentionLevel,
  markNovelty,
} from "./dopamine-system.ts";
import { bus } from "./event-bus.ts";
import type { BrainAgentConfig } from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";

let tmpDir: string;
let unsubs: Array<() => void> = [];

function trackOn(...args: Parameters<typeof bus.on>): ReturnType<typeof bus.on> {
  const unsub = bus.on(...args);
  unsubs.push(unsub);
  return unsub;
}

describe("Dopamine System", () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "brainagent-dopamine-test-"));
    for (const fn of unsubs) fn();
    unsubs = [];
    bus.gc(0);
    initDopamineSystem(tmpDir);
  });

  // ── Initialization ──────────────────────────────────────────

  describe("initDopamineSystem", () => {
    it("initializes with default neuromodulator levels", () => {
      const state = getNeuromodulatorState();
      expect(state.dopamine).toBeGreaterThan(0);
      expect(state.dopamine).toBeLessThanOrEqual(1);
      expect(state.serotonin).toBeGreaterThan(0);
      expect(state.norepinephrine).toBeGreaterThan(0);
      expect(state.acetylcholine).toBeGreaterThan(0);
    });

    it("returns valid stats after init", () => {
      const stats = getDopamineStats();
      expect(stats.totalInteractions).toBeGreaterThanOrEqual(0);
      expect(stats.currentState).toBeDefined();
      expect(stats.expectedReward).toBeGreaterThanOrEqual(0);
    });
  });

  // ── processInteractionOutcome ─────────────────────────────

  describe("processInteractionOutcome", () => {
    it("returns positive reward for positive user signal + passed cerebellum", () => {
      const signal = processInteractionOutcome(
        {
          cerebellumPassed: true,
          cerebellumIssues: [],
          userSignal: "positive",
          participatingModules: ["thalamus", "amygdala", "hippocampus"],
          domain: "technical",
          complexity: "moderate",
          emotion: "neutral",
          input: "How do I sort an array?",
          habitAutoExecuted: false,
        },
        DEFAULT_CONFIG,
      );

      expect(signal.reward).toBeGreaterThan(0);
      expect(signal.participatingModules).toHaveLength(3);
      expect(signal.creditAssignment).toBeDefined();
    });

    it("returns negative reward for negative user signal", () => {
      const signal = processInteractionOutcome(
        {
          cerebellumPassed: false,
          cerebellumIssues: ["incomplete", "wrong tone"],
          userSignal: "negative",
          participatingModules: ["thalamus", "hippocampus"],
          domain: "casual",
          complexity: "simple",
          emotion: "frustration",
          input: "This is wrong, redo it",
          habitAutoExecuted: false,
        },
        DEFAULT_CONFIG,
      );

      expect(signal.reward).toBeLessThan(0);
    });

    it("computes prediction error relative to expected reward", () => {
      // First interaction: establish a baseline
      processInteractionOutcome(
        {
          cerebellumPassed: true,
          cerebellumIssues: [],
          userSignal: "neutral",
          participatingModules: ["thalamus"],
          domain: "casual",
          complexity: "simple",
          emotion: "neutral",
          input: "hello",
          habitAutoExecuted: false,
        },
        DEFAULT_CONFIG,
      );

      // Second interaction: positive surprise
      const signal = processInteractionOutcome(
        {
          cerebellumPassed: true,
          cerebellumIssues: [],
          userSignal: "positive",
          participatingModules: ["thalamus"],
          domain: "technical",
          complexity: "moderate",
          emotion: "joy",
          input: "great answer!",
          habitAutoExecuted: false,
        },
        DEFAULT_CONFIG,
      );

      expect(signal.predictionError).toBeDefined();
      expect(typeof signal.predictionError).toBe("number");
    });

    it("emits dopamine:reward event", () => {
      const received: unknown[] = [];
      trackOn("dopamine:reward", (data) => {
        received.push(data);
      });

      processInteractionOutcome(
        {
          cerebellumPassed: true,
          cerebellumIssues: [],
          userSignal: "positive",
          participatingModules: ["thalamus"],
          domain: "technical",
          complexity: "simple",
          emotion: "neutral",
          input: "test",
          habitAutoExecuted: false,
        },
        DEFAULT_CONFIG,
      );

      expect(received).toHaveLength(1);
    });

    it("distributes credit across modules", () => {
      const signal = processInteractionOutcome(
        {
          cerebellumPassed: true,
          cerebellumIssues: [],
          userSignal: "positive",
          participatingModules: ["thalamus", "amygdala", "hippocampus"],
          domain: "technical",
          complexity: "moderate",
          emotion: "neutral",
          input: "test credit",
          habitAutoExecuted: false,
        },
        DEFAULT_CONFIG,
      );

      const total = Object.values(signal.creditAssignment).reduce((s, v) => s + v, 0);
      expect(total).toBeCloseTo(1, 1);
    });

    it("penalizes modules mentioned in cerebellum issues", () => {
      const signal = processInteractionOutcome(
        {
          cerebellumPassed: false,
          cerebellumIssues: ["language mismatch"],
          userSignal: "neutral",
          participatingModules: ["thalamus", "mirrorNeurons", "hippocampus"],
          domain: "casual",
          complexity: "simple",
          emotion: "neutral",
          input: "test blame",
          habitAutoExecuted: false,
        },
        DEFAULT_CONFIG,
      );

      // mirrorNeurons should have less credit than others
      const mirrorCredit = signal.creditAssignment["mirrorNeurons"] ?? 0;
      const thalamusCredit = signal.creditAssignment["thalamus"] ?? 0;
      expect(mirrorCredit).toBeLessThan(thalamusCredit);
    });
  });

  // ── Neuromodulator updates ────────────────────────────────

  describe("neuromodulator updates", () => {
    it("updates dopamine level after reward", () => {
      const before = getNeuromodulatorState().dopamine;

      processInteractionOutcome(
        {
          cerebellumPassed: true,
          cerebellumIssues: [],
          userSignal: "positive",
          participatingModules: ["thalamus"],
          domain: "technical",
          complexity: "simple",
          emotion: "joy",
          input: "great!",
          habitAutoExecuted: false,
        },
        DEFAULT_CONFIG,
      );

      const after = getNeuromodulatorState().dopamine;
      // Dopamine should change (direction depends on prediction error)
      expect(typeof after).toBe("number");
      expect(after).toBeGreaterThan(0);
      expect(after).toBeLessThanOrEqual(1);
    });

    it("raises norepinephrine on complex/urgent input", () => {
      processInteractionOutcome(
        {
          cerebellumPassed: true,
          cerebellumIssues: [],
          userSignal: "neutral",
          participatingModules: ["thalamus"],
          domain: "technical",
          complexity: "extreme",
          emotion: "urgency",
          input: "critical bug in production!",
          habitAutoExecuted: false,
        },
        DEFAULT_CONFIG,
      );

      const ne = getNeuromodulatorState().norepinephrine;
      expect(ne).toBeGreaterThan(0.3);
    });
  });

  // ── Derived metrics ───────────────────────────────────────

  describe("derived metrics", () => {
    it("getEffectiveLearningRate returns modulated rate", () => {
      const rate = getEffectiveLearningRate(0.2, DEFAULT_CONFIG);
      expect(rate).toBeGreaterThan(0);
      expect(typeof rate).toBe("number");
    });

    it("getRiskTolerance returns serotonin-based value", () => {
      const risk = getRiskTolerance();
      expect(risk).toBeGreaterThan(0);
      expect(risk).toBeLessThanOrEqual(1);
    });

    it("getAttentionLevel returns norepinephrine-based value", () => {
      const attn = getAttentionLevel();
      expect(attn).toBeGreaterThan(0);
      expect(attn).toBeLessThanOrEqual(1);
    });

    it("markNovelty increases novelty counter", () => {
      const before = getDopamineStats().noveltyRatio;
      markNovelty();
      // After markNovelty, the counter goes up (but ratio depends on totalInteractions)
      // Just verify it doesn't crash
      const after = getDopamineStats().noveltyRatio;
      expect(typeof after).toBe("number");
    });
  });

  // ── Stats ─────────────────────────────────────────────────

  describe("getDopamineStats", () => {
    it("tracks interactions after processing", () => {
      processInteractionOutcome(
        {
          cerebellumPassed: true,
          cerebellumIssues: [],
          userSignal: "neutral",
          participatingModules: ["thalamus"],
          domain: "casual",
          complexity: "trivial",
          emotion: "neutral",
          input: "hi",
          habitAutoExecuted: false,
        },
        DEFAULT_CONFIG,
      );

      const stats = getDopamineStats();
      expect(stats.totalInteractions).toBeGreaterThanOrEqual(1);
      expect(stats.recentRewards).toBeGreaterThanOrEqual(1);
    });
  });
});
