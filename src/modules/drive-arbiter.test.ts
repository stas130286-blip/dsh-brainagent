import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initDriveArbiter,
  stopDriveArbiter,
  getDriveArbiterStats,
  getLastSelectedDrive,
  buildArbiterContext,
} from "./drive-arbiter.ts";
import { bus } from "./event-bus.ts";
import type { DopamineSignal, SocialDriveStats, CognitiveHungerStats } from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";

let tempDir: string;
const unsubs: Array<() => void> = [];

function trackOn(...args: Parameters<typeof bus.on>): ReturnType<typeof bus.on> {
  const unsub = bus.on(...args);
  unsubs.push(unsub);
  return unsub;
}

function makeSocialStats(overrides: Partial<SocialDriveStats> = {}): SocialDriveStats {
  return {
    satiation: 0.5,
    need: 0.5,
    needLevel: "moderate",
    lastSocialInteractionTime: Date.now(),
    timeSinceLastSocial: 0,
    totalSocialRewards: 0,
    totalNeedSignals: 0,
    recentInteractionCount: 0,
    ...overrides,
  };
}

function makeCognitiveStats(overrides: Partial<CognitiveHungerStats> = {}): CognitiveHungerStats {
  return {
    satiation: 0.5,
    need: 0.5,
    needLevel: "moderate",
    lastLearningInteractionTime: Date.now(),
    timeSinceLastLearning: 0,
    totalLearningRewards: 0,
    totalNeedSignals: 0,
    recentInteractionCount: 0,
    ...overrides,
  };
}

function makeDopamineSignal(reward: number): DopamineSignal {
  return {
    reward,
    predictionError: 0,
    participatingModules: [],
    creditAssignment: {},
    context: { domain: "test", complexity: "low", emotion: "neutral", input: "test" },
  };
}

describe("Drive Arbiter", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-arbiter-"));
  });

  afterEach(() => {
    stopDriveArbiter();
    for (const unsub of unsubs) unsub();
    unsubs.length = 0;
    bus.gc(0);
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  // ── Initialization ──────────────────────────────────────────

  describe("initialization", () => {
    it("initializes with default weights", () => {
      initDriveArbiter(tempDir, DEFAULT_CONFIG, {}, undefined);
      const stats = getDriveArbiterStats();
      expect(stats.driveWeights.social).toBe(1.0);
      expect(stats.driveWeights.cognitive).toBe(1.0);
      expect(stats.driveWeights.creative).toBe(1.0);
      expect(stats.driveWeights.mastery).toBe(1.0);
      expect(stats.totalArbitrations).toBe(0);
    });

    it("starts with no selected drive", () => {
      initDriveArbiter(tempDir, DEFAULT_CONFIG, {}, undefined);
      expect(getLastSelectedDrive()).toBeNull();
    });
  });

  // ── Arbitration ─────────────────────────────────────────────

  describe("arbitration", () => {
    it("selects the drive with highest need when single drive active", () => {
      const events: Array<{ driveId: string }> = [];
      initDriveArbiter(
        tempDir,
        DEFAULT_CONFIG,
        {
          getSocialDriveStats: () =>
            makeSocialStats({ satiation: 0.2, need: 0.8, needLevel: "strong" }),
        },
        undefined,
      );

      trackOn("arbiter:drive-selected", (data) => {
        events.push(data as { driveId: string });
      });

      bus.emit("social-drive:need-rising", { needLevel: "strong", satiation: 0.2, need: 0.8 });

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].driveId).toBe("social");
    });

    it("arbitrates between multiple competing drives", () => {
      const conflicts: Array<{ winner: string; competing: string[] }> = [];
      const noExploreConfig = {
        ...DEFAULT_CONFIG,
        driveArbiter: { ...DEFAULT_CONFIG.driveArbiter, explorationRate: 0 },
      };
      initDriveArbiter(
        tempDir,
        noExploreConfig,
        {
          getSocialDriveStats: () =>
            makeSocialStats({ satiation: 0.3, need: 0.7, needLevel: "moderate" }),
          getCognitiveHungerStats: () =>
            makeCognitiveStats({ satiation: 0.1, need: 0.9, needLevel: "strong" }),
        },
        undefined,
      );

      trackOn("arbiter:conflict-resolved", (data) => {
        const d = data as { winner: string; competing: string[] };
        conflicts.push(d);
      });

      bus.emit("cognitive-hunger:need-rising", { needLevel: "strong", satiation: 0.1, need: 0.9 });

      expect(conflicts.length).toBe(1);
      expect(conflicts[0].competing).toContain("social");
      expect(conflicts[0].competing).toContain("cognitive");
      // Cognitive has higher need (0.9 vs 0.7) so should likely win
      expect(conflicts[0].winner).toBe("cognitive");
    });

    it("does not arbitrate when no drives above minimum threshold", () => {
      const events: unknown[] = [];
      initDriveArbiter(
        tempDir,
        DEFAULT_CONFIG,
        {
          getSocialDriveStats: () =>
            makeSocialStats({ satiation: 0.9, need: 0.1, needLevel: "none" }),
        },
        undefined,
      );

      trackOn("arbiter:drive-selected", (data) => {
        events.push(data);
      });

      bus.emit("social-drive:need-rising", { needLevel: "none", satiation: 0.9, need: 0.1 });

      expect(events.length).toBe(0);
    });
  });

  // ── Reward learning ─────────────────────────────────────────

  describe("reward learning", () => {
    it("adjusts drive weight on positive reward", () => {
      initDriveArbiter(
        tempDir,
        DEFAULT_CONFIG,
        {
          getSocialDriveStats: () =>
            makeSocialStats({ satiation: 0.2, need: 0.8, needLevel: "strong" }),
        },
        undefined,
      );

      // Trigger selection
      bus.emit("social-drive:need-rising", { needLevel: "strong", satiation: 0.2, need: 0.8 });
      const before = getDriveArbiterStats().driveWeights.social;

      // Emit reward
      bus.emit("dopamine:reward", makeDopamineSignal(0.5));

      const after = getDriveArbiterStats().driveWeights.social;
      expect(after).toBeGreaterThan(before);
    });
  });

  // ── Context building ────────────────────────────────────────

  describe("context building", () => {
    it("returns null when no drive selected", () => {
      initDriveArbiter(tempDir, DEFAULT_CONFIG, {}, undefined);
      expect(buildArbiterContext()).toBeNull();
    });

    it("returns context after drive selection", () => {
      initDriveArbiter(
        tempDir,
        DEFAULT_CONFIG,
        {
          getSocialDriveStats: () =>
            makeSocialStats({ satiation: 0.2, need: 0.8, needLevel: "strong" }),
        },
        undefined,
      );

      bus.emit("social-drive:need-rising", { needLevel: "strong", satiation: 0.2, need: 0.8 });

      const ctx = buildArbiterContext();
      expect(ctx).not.toBeNull();
      expect(ctx).toContain("social connection");
    });
  });

  // ── Persistence ─────────────────────────────────────────────

  describe("persistence", () => {
    it("persists and restores state across restarts", () => {
      initDriveArbiter(
        tempDir,
        DEFAULT_CONFIG,
        {
          getSocialDriveStats: () =>
            makeSocialStats({ satiation: 0.2, need: 0.8, needLevel: "strong" }),
        },
        undefined,
      );

      // Trigger selection + reward to change weights
      bus.emit("social-drive:need-rising", { needLevel: "strong", satiation: 0.2, need: 0.8 });
      bus.emit("dopamine:reward", makeDopamineSignal(0.5));

      const weightBefore = getDriveArbiterStats().driveWeights.social;
      stopDriveArbiter();

      // Re-init (stopDriveArbiter already cleaned up listeners)
      initDriveArbiter(tempDir, DEFAULT_CONFIG, {}, undefined);
      const weightAfter = getDriveArbiterStats().driveWeights.social;

      expect(weightAfter).toBeCloseTo(weightBefore, 5);
    });
  });
});
