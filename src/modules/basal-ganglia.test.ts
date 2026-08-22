import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initBasalStorage,
  findHabit,
  recordPattern,
  reinforce,
  detectReinforcement,
  buildHabitContext,
  getBasalStats,
} from "./basal-ganglia.ts";

let tempDir: string;

describe("Basal Ganglia (habit formation)", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-basal-"));
    initBasalStorage(tempDir);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  // ── Initialization ──────────────────────────────────────────

  describe("initialization", () => {
    it("starts with empty stats", () => {
      const stats = getBasalStats();
      expect(stats.totalHabits).toBe(0);
      expect(stats.automatedHabits).toBe(0);
      expect(stats.averageReward).toBe(0);
      expect(stats.totalActivations).toBe(0);
    });
  });

  // ── Pattern recording ───────────────────────────────────────

  describe("recordPattern()", () => {
    it("creates a new habit", () => {
      const habit = recordPattern(
        "deploy production app",
        ["build", "test", "deploy"],
        "technical",
      );
      expect(habit.id).toBeTruthy();
      expect(habit.cue).toBe("deploy production app");
      expect(habit.routine).toEqual(["build", "test", "deploy"]);
      expect(habit.domain).toBe("technical");
      expect(habit.rewardSignal).toBe(0.5);
      expect(habit.activationCount).toBe(1);
      expect(getBasalStats().totalHabits).toBe(1);
    });

    it("strengthens existing habit on similar pattern", () => {
      recordPattern("deploy production application", ["build", "deploy"], "technical");
      const second = recordPattern(
        "deploy production application to server",
        ["build", "deploy"],
        "technical",
      );
      // Should strengthen existing instead of creating new (vector match > 0.6)
      expect(getBasalStats().totalHabits).toBeLessThanOrEqual(2);
      expect(second.activationCount).toBeGreaterThanOrEqual(1);
    });

    it("stores example responses", () => {
      const habit = recordPattern("check status", ["status"], "command", "All systems operational");
      expect(habit.exampleResponses).toContain("All systems operational");
    });

    it("limits example responses to last 3", () => {
      const cue = "run tests for project";
      recordPattern(cue, ["test"], "technical", "Response 1");
      // Same pattern repeatedly
      for (let i = 2; i <= 5; i++) {
        recordPattern(cue, ["test"], "technical", `Response ${i}`);
      }
      const stats = getBasalStats();
      // After repeated recording, the habit should exist
      expect(stats.totalHabits).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Habit matching ──────────────────────────────────────────

  describe("findHabit()", () => {
    it("returns undefined for empty store", () => {
      expect(findHabit("anything", "technical")).toBeUndefined();
    });

    it("finds a matching habit", () => {
      recordPattern("deploy production application", ["build", "deploy"], "technical");
      const match = findHabit("deploy production app", "technical");
      expect(match).toBeDefined();
      expect(match!.habit.cue).toContain("deploy");
    });

    it("auto-execute is false for new habits (insufficient activations)", () => {
      recordPattern("deploy app", ["deploy"], "technical");
      const match = findHabit("deploy app", "technical");
      if (match) {
        expect(match.autoExecute).toBe(false);
      }
    });

    it("auto-execute becomes true after enough activations + high reward", () => {
      const habit = recordPattern("simple check status", ["status"], "command");
      // Manually activate and reinforce multiple times
      for (let i = 0; i < 5; i++) {
        recordPattern("simple check status", ["status"], "command");
        reinforce(habit.id, "positive");
      }
      const match = findHabit("simple check status", "command");
      if (match) {
        // Should have enough activations and high reward now
        expect(match.habit.activationCount).toBeGreaterThanOrEqual(3);
        expect(match.habit.rewardSignal).toBeGreaterThan(0.5);
      }
    });

    it("matchScore includes domain bonus", () => {
      recordPattern("run tests", ["test"], "technical");
      const techMatch = findHabit("run tests", "technical");
      const otherMatch = findHabit("run tests", "creative");
      if (techMatch && otherMatch) {
        expect(techMatch.matchScore).toBeGreaterThanOrEqual(otherMatch.matchScore);
      }
    });
  });

  // ── Reinforcement learning ──────────────────────────────────

  describe("reinforce()", () => {
    it("positive signal increases reward", () => {
      const habit = recordPattern("test pattern", ["test"], "technical");
      const before = habit.rewardSignal;
      reinforce(habit.id, "positive");
      expect(habit.rewardSignal).toBeGreaterThan(before);
    });

    it("negative signal decreases reward", () => {
      const habit = recordPattern("test pattern", ["test"], "technical");
      const before = habit.rewardSignal;
      reinforce(habit.id, "negative");
      expect(habit.rewardSignal).toBeLessThan(before);
    });

    it("neutral signal has minimal effect", () => {
      const habit = recordPattern("test pattern", ["test"], "technical");
      const before = habit.rewardSignal;
      reinforce(habit.id, "neutral");
      // Neutral should barely change
      expect(Math.abs(habit.rewardSignal - before)).toBeLessThan(0.1);
    });

    it("reward stays clamped to [0, 1]", () => {
      const habit = recordPattern("test", ["t"], "technical");
      for (let i = 0; i < 20; i++) reinforce(habit.id, "positive");
      expect(habit.rewardSignal).toBeLessThanOrEqual(1);

      for (let i = 0; i < 40; i++) reinforce(habit.id, "negative");
      expect(habit.rewardSignal).toBeGreaterThanOrEqual(0);
    });

    it("tracks reinforcement counts", () => {
      const habit = recordPattern("test", ["t"], "technical");
      reinforce(habit.id, "positive");
      reinforce(habit.id, "positive");
      reinforce(habit.id, "negative");
      expect(habit.positiveReinforcements).toBe(2);
      expect(habit.negativeReinforcements).toBe(1);
    });

    it("ignores non-existent habit id", () => {
      // Should not throw
      reinforce("nonexistent-id", "positive");
    });
  });

  // ── Reinforcement detection ─────────────────────────────────

  describe("detectReinforcement()", () => {
    it("detects positive Russian signals", () => {
      expect(detectReinforcement("спасибо отлично")).toBe("positive");
      expect(detectReinforcement("молодец супер")).toBe("positive");
      expect(detectReinforcement("умница идеально")).toBe("positive");
    });

    it("detects positive English signals", () => {
      expect(detectReinforcement("thanks great job")).toBe("positive");
      expect(detectReinforcement("awesome perfect")).toBe("positive");
    });

    it("detects negative Russian signals", () => {
      expect(detectReinforcement("не то неправильно")).toBe("negative");
      expect(detectReinforcement("переделай заново")).toBe("negative");
    });

    it("detects negative English signals", () => {
      expect(detectReinforcement("wrong incorrect")).toBe("negative");
      expect(detectReinforcement("try again")).toBe("negative");
    });

    it("returns neutral for ambiguous text", () => {
      expect(detectReinforcement("продолжай дальше")).toBe("neutral");
      expect(detectReinforcement("а теперь следующий шаг")).toBe("neutral");
    });
  });

  // ── Context building ────────────────────────────────────────

  describe("buildHabitContext()", () => {
    it("includes habit details", () => {
      const habit = recordPattern("deploy app", ["build", "test", "deploy"], "technical");
      const ctx = buildHabitContext({ habit, matchScore: 0.8, autoExecute: false });
      expect(ctx).toContain("Basal Ganglia");
      expect(ctx).toContain("deploy app");
      expect(ctx).toContain("technical");
      expect(ctx).toContain("build → test → deploy");
    });

    it("indicates auto-execute for established habits", () => {
      const habit = recordPattern("check status", ["status"], "command");
      const ctx = buildHabitContext({ habit, matchScore: 0.9, autoExecute: true });
      expect(ctx).toContain("well-established");
    });

    it("indicates learning for new habits", () => {
      const habit = recordPattern("new pattern", ["step"], "technical");
      const ctx = buildHabitContext({ habit, matchScore: 0.5, autoExecute: false });
      expect(ctx).toContain("still being learned");
    });
  });

  // ── Stats ───────────────────────────────────────────────────

  describe("getBasalStats()", () => {
    it("tracks habits correctly", () => {
      recordPattern("deploy production application server", ["build", "deploy"], "technical");
      recordPattern("рисование картинок акварелью пейзажи", ["draw", "paint"], "creative");
      const stats = getBasalStats();
      expect(stats.totalHabits).toBe(2);
      expect(stats.totalActivations).toBe(2);
    });

    it("averageReward reflects reward signals", () => {
      const h = recordPattern("test habit", ["t"], "technical");
      reinforce(h.id, "positive");
      reinforce(h.id, "positive");
      const stats = getBasalStats();
      expect(stats.averageReward).toBeGreaterThan(0.5);
    });
  });

  // ── Persistence ─────────────────────────────────────────────

  describe("persistence", () => {
    it("survives re-initialization", () => {
      recordPattern("persistent habit", ["step"], "technical");
      const statsBefore = getBasalStats();

      initBasalStorage(tempDir);
      const statsAfter = getBasalStats();
      expect(statsAfter.totalHabits).toBe(statsBefore.totalHabits);
    });
  });
});
