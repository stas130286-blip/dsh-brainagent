import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSocialDrive,
  initSocialDrive,
  stopSocialDrive,
  getSocialDriveStats,
  boostSatiation,
} from "./social-drive.ts";
import {
  initCognitiveHunger,
  stopCognitiveHunger,
  getCognitiveHungerStats,
  boostCognitiveHungerSatiation,
} from "./cognitive-hunger.ts";
import {
  initCreativeDrive,
  stopCreativeDrive,
  getCreativeDriveStats,
  boostCreativeDriveSatiation,
} from "./creative-drive.ts";
import {
  initMasteryDrive,
  stopMasteryDrive,
  getMasteryDriveStats,
  boostMasteryDomainSatiation,
} from "./mastery-drive.ts";
import { bus } from "./event-bus.ts";
import { DEFAULT_CONFIG, type DopamineSignal } from "./types.ts";

const noopLog = { info: () => {} };

function makeConfig() {
  return {
    ...DEFAULT_CONFIG,
    circadian: { ...DEFAULT_CONFIG.circadian, enabled: false },
  };
}

/** Dependency stub shared by all four drives (they differ only in the thought fn name). */
function makeDeps(thoughtFnName: string) {
  return {
    addDesire: vi.fn(() => ({}) as never),
    getDesires: vi.fn(() => []),
    getFactsByCategory: vi.fn(() => []),
    [thoughtFnName]: vi.fn(),
  };
}

function dopamineSignal(domain: string, reward: number): DopamineSignal {
  return {
    reward,
    predictionError: 0,
    participatingModules: [],
    creditAssignment: {},
    context: { domain, complexity: "low", emotion: "neutral", input: "test" },
  } as DopamineSignal;
}

let tempDir: string;

describe("Drives", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-drives-"));
  });

  afterEach(() => {
    vi.useRealTimers();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  // ── Social Drive ──────────────────────────────────────────────

  describe("social drive", () => {
    let deps: ReturnType<typeof makeDeps>;

    beforeEach(() => {
      deps = makeDeps("generateSocialThought");
      initSocialDrive(tempDir, makeConfig(), noopLog, deps as never);
    });
    afterEach(() => stopSocialDrive());

    it("starts at initial satiation with no need", () => {
      const stats = getSocialDriveStats();
      expect(stats.satiation).toBeCloseTo(0.5, 5);
      expect(stats.needLevel).toBe("none");
    });

    it("satiation decays over time and need rises with signals", () => {
      const seen: unknown[] = [];
      const unsub = bus.on("social-drive:need-rising", (d) => {
        seen.push(d);
      });

      vi.advanceTimersByTime(30 * 60 * 1000); // 30 minutes of silence
      const stats = getSocialDriveStats(); // triggers on-demand decay
      unsub();

      expect(stats.satiation).toBeLessThan(0.2);
      expect(stats.needLevel).not.toBe("none");
      expect(seen.length).toBeGreaterThan(0);
      expect(deps.addDesire).toHaveBeenCalled(); // connection desire created
      expect(deps.generateSocialThought).toHaveBeenCalled(); // DMN bias at strong+
    });

    it("positive social dopamine reward restores satiation", () => {
      bus.emitSync("dopamine:reward", dopamineSignal("casual", 0.5));
      const stats = getSocialDriveStats();
      // 0.5 + min(maxBoost 0.8, 0.5 × multiplier 0.6) = 0.8
      expect(stats.satiation).toBeCloseTo(0.8, 5);
      expect(stats.totalSocialRewards).toBe(1);
    });

    it("rewards outside social domains are ignored", () => {
      bus.emitSync("dopamine:reward", dopamineSignal("technical", 0.5));
      expect(getSocialDriveStats().totalSocialRewards).toBe(0);
    });

    it("manual boost raises satiation", () => {
      boostSatiation(0.4, "test");
      expect(getSocialDriveStats().satiation).toBeCloseTo(0.9, 5);
    });
  });

  // ── Cognitive Hunger ──────────────────────────────────────────

  describe("cognitive hunger", () => {
    let deps: ReturnType<typeof makeDeps>;

    beforeEach(() => {
      deps = makeDeps("generateLearningThought");
      initCognitiveHunger(tempDir, makeConfig(), noopLog, deps as never);
    });
    afterEach(() => stopCognitiveHunger());

    it("starts slightly satiated (onboarding = learning)", () => {
      expect(getCognitiveHungerStats().satiation).toBeCloseTo(0.6, 5);
    });

    it("satiation decays over time and need rises", () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
      const stats = getCognitiveHungerStats();
      expect(stats.satiation).toBeLessThan(0.3);
      expect(stats.needLevel).not.toBe("none");
      expect(deps.addDesire).toHaveBeenCalled();
    });

    it("learning-domain dopamine reward restores satiation", () => {
      bus.emitSync("dopamine:reward", dopamineSignal("technical", 0.5));
      const stats = getCognitiveHungerStats();
      // 0.6 + min(maxBoost 0.7, 0.5 × multiplier 0.5) = 0.85
      expect(stats.satiation).toBeCloseTo(0.85, 5);
    });

    it("manual boost raises satiation", () => {
      boostCognitiveHungerSatiation(0.3, "test");
      expect(getCognitiveHungerStats().satiation).toBeCloseTo(0.9, 5);
    });
  });

  // ── Creative Drive ────────────────────────────────────────────

  describe("creative drive", () => {
    let deps: ReturnType<typeof makeDeps>;

    beforeEach(() => {
      deps = makeDeps("generateCreativeThought");
      initCreativeDrive(tempDir, makeConfig(), noopLog, deps as never);
    });
    afterEach(() => stopCreativeDrive());

    it("starts at initial satiation", () => {
      expect(getCreativeDriveStats().satiation).toBeCloseTo(0.5, 5);
    });

    it("satiation decays over time and need rises", () => {
      vi.advanceTimersByTime(45 * 60 * 1000); // slower decay rate → longer window
      const stats = getCreativeDriveStats();
      expect(stats.satiation).toBeLessThan(0.3);
      expect(stats.needLevel).not.toBe("none");
    });

    it("creative-domain dopamine reward restores satiation", () => {
      bus.emitSync("dopamine:reward", dopamineSignal("creative", 0.5));
      const stats = getCreativeDriveStats();
      // 0.5 + min(maxBoost 0.8, 0.5 × multiplier 0.6) = 0.8
      expect(stats.satiation).toBeCloseTo(0.8, 5);
    });

    it("manual boost raises satiation", () => {
      boostCreativeDriveSatiation(0.4, "test");
      expect(getCreativeDriveStats().satiation).toBeCloseTo(0.9, 5);
    });
  });

  // ── Mastery Drive ─────────────────────────────────────────────

  describe("mastery drive", () => {
    let deps: ReturnType<typeof makeDeps>;

    beforeEach(() => {
      deps = makeDeps("generateMasteryThought");
      initMasteryDrive(tempDir, makeConfig(), noopLog, deps as never);
    });
    afterEach(() => stopMasteryDrive());

    it("tracks a boosted domain in stats", () => {
      boostMasteryDomainSatiation("coding", 0.3, "test");
      const stats = getMasteryDriveStats();
      expect(stats.activeDomainCount).toBe(1);
      expect(stats.domainSatiations["coding"]).toBeGreaterThanOrEqual(0.5);
    });

    it("aggregate satiation decays over time", () => {
      boostMasteryDomainSatiation("coding", 0.3, "test");
      const before = getMasteryDriveStats().satiation;
      vi.advanceTimersByTime(30 * 60 * 1000);
      const after = getMasteryDriveStats().satiation;
      expect(after).toBeLessThan(before);
    });
  });

  // ── Per-instance состояние (v0.6.1) ─────────────────────────

  describe("per-instance состояние (v0.6.1)", () => {
    it("фабрика социального драйва создаёт независимые инстансы", () => {
      const dirA = mkdtempSync(join(tmpdir(), "brainagent-sd-a-"));
      const dirB = mkdtempSync(join(tmpdir(), "brainagent-sd-b-"));
      const a = createSocialDrive(dirA, makeConfig(), noopLog, makeDeps("generateSocialThought") as never);
      const b = createSocialDrive(dirB, makeConfig(), noopLog, makeDeps("generateSocialThought") as never);

      a.boostSatiation(0.4, "test");
      expect(a.getStats().satiation).toBeCloseTo(0.9, 5);
      // Второй инстанс не видит буст первого
      expect(b.getStats().satiation).toBeCloseTo(0.5, 5);

      a.stop();
      b.stop();
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    });
  });
});
