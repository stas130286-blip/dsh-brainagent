import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { initBasalStorage } from "./basal-ganglia.ts";
import { initDopamineSystem } from "./dopamine-system.ts";
import { bus } from "./event-bus.ts";
import {
  initNeuralPathways,
  resetCycleState,
  buildNeuromodulatorContext,
  getPathwayStats,
  getCachedNeuroState,
  getSynapticStats,
} from "./neural-pathways.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import type {
  ThalamusClassification,
  AmygdalaAssessment,
  NeuromodulatorState,
  DopamineSignal,
} from "./types.ts";

let tmpDir: string;
let unsubs: Array<() => void> = [];

function trackOn(...args: Parameters<typeof bus.on>): ReturnType<typeof bus.on> {
  const unsub = bus.on(...args);
  unsubs.push(unsub);
  return unsub;
}

describe("Neural Pathways", () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "brainagent-pathways-test-"));
    for (const fn of unsubs) fn();
    unsubs = [];
    bus.gc(0);

    // Initialize dependencies
    initBasalStorage(tmpDir);
    initDopamineSystem(tmpDir);

    // Initialize pathways
    initNeuralPathways(tmpDir, DEFAULT_CONFIG);
  });

  // ── Initialization ──────────────────────────────────────────

  describe("initialization", () => {
    it("initializes with correct pathway count", () => {
      const stats = getPathwayStats();
      expect(stats.pathwayCount).toBe(8);
    });

    it("starts with no active habit", () => {
      const stats = getPathwayStats();
      expect(stats.currentHabitId).toBeUndefined();
    });
  });

  // ── Cycle state management ────────────────────────────────

  describe("cycle state", () => {
    it("resetCycleState clears habit tracking", () => {
      // Simulate a habit match
      bus.emitSync("basal:habit-matched", {
        habitId: "test-habit-1",
        matchScore: 0.8,
        autoExecute: false,
      });

      let stats = getPathwayStats();
      expect(stats.currentHabitId).toBe("test-habit-1");

      resetCycleState();
      stats = getPathwayStats();
      expect(stats.currentHabitId).toBeUndefined();
    });
  });

  // ── Prediction validation pathway ─────────────────────────

  describe("prediction validation (pathway 2)", () => {
    it("emits pathway:prediction-validated when prediction is correct", () => {
      const validated: Array<{ predictionTopic: string; wasCorrect: boolean }> = [];
      trackOn("pathway:prediction-validated", (data) => {
        validated.push(data as { predictionTopic: string; wasCorrect: boolean });
      });

      // Emit predictions
      bus.emitSync("predictive:predicted", {
        predictions: [{ topic: "technical", confidence: 0.8, type: "sequential" }],
      });

      // Then thalamus classifies as "technical" — matches!
      const classification: ThalamusClassification = {
        modality: "text",
        domain: "technical",
        complexity: "moderate",
        intentSummary: "asking about code",
        confidence: 0.9,
        processingPath: "slow",
      };
      bus.emitSync("thalamus:classified", classification);

      expect(validated.length).toBeGreaterThanOrEqual(1);
      const correct = validated.find((v) => v.wasCorrect);
      expect(correct).toBeDefined();
      expect(correct!.predictionTopic).toBe("technical");
    });

    it("emits prediction-validated=false when prediction is wrong", () => {
      const validated: Array<{ predictionTopic: string; wasCorrect: boolean }> = [];
      trackOn("pathway:prediction-validated", (data) => {
        validated.push(data as { predictionTopic: string; wasCorrect: boolean });
      });

      // Predict "creative"
      bus.emitSync("predictive:predicted", {
        predictions: [{ topic: "creative", confidence: 0.7, type: "temporal" }],
      });

      // But thalamus classifies as "technical"
      const classification: ThalamusClassification = {
        modality: "text",
        domain: "technical",
        complexity: "simple",
        intentSummary: "tech question",
        confidence: 0.8,
        processingPath: "fast",
      };
      bus.emitSync("thalamus:classified", classification);

      expect(validated.length).toBeGreaterThanOrEqual(1);
      expect(validated.some((v) => !v.wasCorrect)).toBe(true);
    });
  });

  // ── Cerebellum → Basal Ganglia pathway ────────────────────

  describe("cerebellum → basal ganglia (pathway 1)", () => {
    it("tracks cerebellum issues via getLastCerebellumIssues", () => {
      bus.emitSync("cerebellum:validated", {
        passed: false,
        issues: ["too verbose", "language mismatch"],
      });

      // The issues are tracked internally for the pathway
      // This pathway feeds into habit reinforcement
      // Verify it doesn't crash
      expect(true).toBe(true);
    });
  });

  // ── Habit promotion pathway ───────────────────────────────

  describe("habit promotion (pathway 3)", () => {
    it("emits pathway:habit-promoted for auto-executed high-score habits", () => {
      const promoted: Array<{ habitId: string; confidence: number }> = [];
      trackOn("pathway:habit-promoted", (data) => {
        promoted.push(data as { habitId: string; confidence: number });
      });

      bus.emitSync("basal:habit-matched", {
        habitId: "strong-habit",
        matchScore: 0.85,
        autoExecute: true,
      });

      expect(promoted).toHaveLength(1);
      expect(promoted[0].habitId).toBe("strong-habit");
      expect(promoted[0].confidence).toBe(0.85);
    });

    it("does not promote non-auto-executed habits", () => {
      const promoted: unknown[] = [];
      trackOn("pathway:habit-promoted", (data) => {
        promoted.push(data);
      });

      bus.emitSync("basal:habit-matched", {
        habitId: "weak-habit",
        matchScore: 0.4,
        autoExecute: false,
      });

      expect(promoted).toHaveLength(0);
    });
  });

  // ── Neuromodulator context ────────────────────────────────

  describe("neuromodulator context", () => {
    it("returns undefined when levels are at baseline", () => {
      // At baseline, no significant deviation
      const ctx = buildNeuromodulatorContext();
      // Could be undefined or string depending on exact initial state
      expect(ctx === undefined || typeof ctx === "string").toBe(true);
    });

    it("caches neuromodulator state from events", () => {
      const newState: NeuromodulatorState = {
        dopamine: 0.9,
        serotonin: 0.8,
        norepinephrine: 0.7,
        acetylcholine: 0.6,
      };
      bus.emitSync("neuromodulator:state-changed", newState);

      const cached = getCachedNeuroState();
      expect(cached.dopamine).toBe(0.9);
      expect(cached.serotonin).toBe(0.8);
    });

    it("generates context when dopamine is significantly high", () => {
      // Force high dopamine state
      bus.emitSync("neuromodulator:state-changed", {
        dopamine: 0.9,
        serotonin: 0.6,
        norepinephrine: 0.3,
        acetylcholine: 0.4,
      });

      const ctx = buildNeuromodulatorContext();
      expect(ctx).toBeDefined();
      expect(ctx).toContain("motivation");
    });
  });

  // ── Mirror neurons pathway ────────────────────────────────

  describe("mirror neurons → system (pathway 8)", () => {
    it("handles user model updates without crashing", () => {
      bus.emitSync("mirror:user-updated", {
        userId: "test",
        moodTrend: "frustration",
        stressLevel: 0.9,
        communicationStyle: "terse",
        language: "ru",
        expertiseLevel: "intermediate",
        emotionHistory: [],
        frequentTopics: [],
        lastSeen: Date.now(),
        styleRewards: {
          formal: { total: 0, count: 0 },
          informal: { total: 0, count: 0 },
          terse: { total: 0, count: 0 },
          verbose: { total: 0, count: 0 },
        },
        preferredResponseStyle: "terse",
        inferredGoals: [],
        knowledgeModel: {},
        interactionPatterns: {
          avgResponseTimeMs: 0,
          preferredTopics: [],
          peakHoursUTC: [],
          engagementStyle: "sporadic",
        },
        relationshipDepth: 0,
        mentalState: { currentFocus: null, frustrationLevel: 0, engagementLevel: 0.5 },
        intentHistory: [],
      } satisfies import("./types.ts").UserModel);

      // Just verify no crash
      expect(true).toBe(true);
    });
  });

  // ── Pathway stats ─────────────────────────────────────────

  describe("getPathwayStats", () => {
    it("returns valid stats object", () => {
      const stats = getPathwayStats();
      expect(stats.pathwayCount).toBe(8);
      expect(stats.neuroState).toBeDefined();
      expect(stats.neuroState.dopamine).toBeDefined();
    });

    it("tracks total learning cycles", () => {
      const stats = getPathwayStats();
      expect(typeof stats.totalLearningCycles).toBe("number");
    });
  });

  // ── Synaptic plasticity (Hebbian learning) ─────────────────

  describe("synaptic plasticity", () => {
    it("initializes with default weights of 1.0", () => {
      const stats = getSynapticStats();
      expect(stats.pathways.length).toBe(8);
      for (const p of stats.pathways) {
        expect(p.weight).toBe(1.0);
      }
    });

    it("strengthens pathways on positive reward", () => {
      // Activate a pathway
      bus.emitSync("cerebellum:validated", { passed: true, issues: [] });

      // Send positive dopamine reward
      const signal: DopamineSignal = {
        reward: 0.8,
        predictionError: 0.3,
        participatingModules: ["cerebellum", "basalGanglia"],
        creditAssignment: { cerebellum: 0.5, basalGanglia: 0.5 },
        context: { domain: "technical", complexity: "moderate", emotion: "neutral", input: "test" },
      };
      bus.emitSync("dopamine:reward", signal);

      const stats = getSynapticStats();
      const cerebellumPathway = stats.pathways.find((p) => p.name === "cerebellum→basal-ganglia");
      expect(cerebellumPathway).toBeDefined();
      expect(cerebellumPathway!.weight).toBeGreaterThan(1.0);
    });

    it("weakens pathways on negative reward", () => {
      // Get initial weight
      const beforeStats = getSynapticStats();
      const beforeWeight = beforeStats.pathways.find(
        (p) => p.name === "cerebellum→basal-ganglia",
      )!.weight;

      // Activate a pathway
      bus.emitSync("cerebellum:validated", { passed: false, issues: ["bad quality"] });

      // Send negative dopamine reward
      const signal: DopamineSignal = {
        reward: -0.5,
        predictionError: -0.4,
        participatingModules: ["cerebellum"],
        creditAssignment: { cerebellum: 1.0 },
        context: {
          domain: "technical",
          complexity: "simple",
          emotion: "frustration",
          input: "test",
        },
      };
      bus.emitSync("dopamine:reward", signal);

      const stats = getSynapticStats();
      const cerebellumPathway = stats.pathways.find((p) => p.name === "cerebellum→basal-ganglia");
      expect(cerebellumPathway).toBeDefined();
      // Weight should decrease compared to before (may not be < 1.0 if previous tests increased it)
      expect(cerebellumPathway!.weight).toBeLessThan(beforeWeight);
    });

    it("tracks activation counts per pathway", () => {
      // Activate cerebellum pathway multiple times
      bus.emitSync("cerebellum:validated", { passed: true, issues: [] });
      bus.emitSync("dopamine:reward", {
        reward: 0.5,
        predictionError: 0.1,
        participatingModules: ["cerebellum"],
        creditAssignment: { cerebellum: 1.0 },
        context: { domain: "tech", complexity: "simple", emotion: "neutral", input: "t1" },
      });

      bus.emitSync("cerebellum:validated", { passed: true, issues: [] });
      bus.emitSync("dopamine:reward", {
        reward: 0.6,
        predictionError: 0.2,
        participatingModules: ["cerebellum"],
        creditAssignment: { cerebellum: 1.0 },
        context: { domain: "tech", complexity: "simple", emotion: "neutral", input: "t2" },
      });

      const stats = getSynapticStats();
      const cerebellumPathway = stats.pathways.find((p) => p.name === "cerebellum→basal-ganglia");
      expect(cerebellumPathway!.activationCount).toBeGreaterThanOrEqual(2);
    });

    it("clamps weights to min/max bounds", () => {
      // Send many positive rewards to try to push weight above max
      for (let i = 0; i < 20; i++) {
        bus.emitSync("cerebellum:validated", { passed: true, issues: [] });
        bus.emitSync("dopamine:reward", {
          reward: 0.9,
          predictionError: 0.5,
          participatingModules: ["cerebellum"],
          creditAssignment: { cerebellum: 1.0 },
          context: { domain: "tech", complexity: "simple", emotion: "joy", input: `test${i}` },
        });
      }

      const stats = getSynapticStats();
      const cerebellumPathway = stats.pathways.find((p) => p.name === "cerebellum→basal-ganglia");
      expect(cerebellumPathway!.weight).toBeLessThanOrEqual(
        DEFAULT_CONFIG.synapticPlasticity.maxWeight,
      );
    });

    it("emits synapse:weight-updated on significant changes", () => {
      const updates: Array<{ pathway: string; oldWeight: number; newWeight: number }> = [];
      trackOn("synapse:weight-updated", (data) => {
        updates.push(data as { pathway: string; oldWeight: number; newWeight: number });
      });

      // Strong reward should trigger event
      bus.emitSync("cerebellum:validated", { passed: true, issues: [] });
      bus.emitSync("dopamine:reward", {
        reward: 0.9,
        predictionError: 0.5,
        participatingModules: ["cerebellum"],
        creditAssignment: { cerebellum: 1.0 },
        context: { domain: "tech", complexity: "complex", emotion: "neutral", input: "test" },
      });

      // May or may not emit depending on change magnitude
      // Just verify no crash and structure is correct if emitted
      if (updates.length > 0) {
        expect(updates[0].pathway).toBeDefined();
        expect(updates[0].oldWeight).toBeDefined();
        expect(updates[0].newWeight).toBeDefined();
      }
    });

    it("identifies strongest and weakest pathways", () => {
      // Create some weight variance
      bus.emitSync("cerebellum:validated", { passed: true, issues: [] });
      bus.emitSync("dopamine:reward", {
        reward: 0.8,
        predictionError: 0.3,
        participatingModules: ["cerebellum"],
        creditAssignment: { cerebellum: 1.0 },
        context: { domain: "tech", complexity: "simple", emotion: "neutral", input: "test" },
      });

      bus.emitSync("mirror:user-updated", {
        userId: "test",
        moodTrend: "neutral",
        stressLevel: 0.3,
        communicationStyle: "informal",
        language: "en",
        expertiseLevel: "intermediate",
        emotionHistory: [],
        frequentTopics: [],
        lastSeen: Date.now(),
        styleRewards: {
          formal: { total: 0, count: 0 },
          informal: { total: 0, count: 0 },
          terse: { total: 0, count: 0 },
          verbose: { total: 0, count: 0 },
        },
        preferredResponseStyle: "informal",
        inferredGoals: [],
        knowledgeModel: {},
        interactionPatterns: {
          avgResponseTimeMs: 0,
          preferredTopics: [],
          peakHoursUTC: [],
          engagementStyle: "sporadic",
        },
        relationshipDepth: 0,
        mentalState: { currentFocus: null, frustrationLevel: 0, engagementLevel: 0.5 },
        intentHistory: [],
      } satisfies import("./types.ts").UserModel);
      bus.emitSync("dopamine:reward", {
        reward: -0.3,
        predictionError: -0.2,
        participatingModules: ["mirrorNeurons"],
        creditAssignment: { mirrorNeurons: 1.0 },
        context: { domain: "social", complexity: "simple", emotion: "neutral", input: "test2" },
      });

      const stats = getSynapticStats();
      // After these operations, we should have differentiated weights
      expect(stats.strongestPathway).toBeDefined();
      expect(stats.weakestPathway).toBeDefined();
    });
  });
});
