import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDriveArbiter, stopDriveArbiter, getDriveArbiterStats, getLastSelectedDrive } from "./drive-arbiter.ts";
import { bus } from "./event-bus.ts";
import {
  DEFAULT_CONFIG,
  type CognitiveHungerStats,
  type SocialDriveStats,
} from "./types.ts";

let tempDir: string;
const unsubs: Array<() => void> = [];

function trackOn(...args: Parameters<typeof bus.on>): ReturnType<typeof bus.on> {
  const unsub = bus.on(...args);
  unsubs.push(unsub);
  return unsub;
}

function makeSocialStats(overrides: Partial<SocialDriveStats> = {}): SocialDriveStats {
  return {
    satiation: 0.2,
    need: 0.8,
    needLevel: "strong",
    lastSocialInteractionTime: Date.now(),
    timeSinceLastSocial: 0,
    totalSocialRewards: 0,
    totalNeedSignals: 0,
    recentInteractionCount: 0,
    ...overrides,
  };
}

function makeCognitiveStats(
  overrides: Partial<CognitiveHungerStats> = {},
): CognitiveHungerStats {
  return {
    satiation: 0.3,
    need: 0.7,
    needLevel: "moderate",
    lastLearningInteractionTime: Date.now(),
    timeSinceLastLearning: 0,
    totalLearningRewards: 0,
    totalNeedSignals: 0,
    recentInteractionCount: 0,
    ...overrides,
  };
}

// Два активных драйва — totalArbitrations считается только на пути конфликта
function makeGetters() {
  return {
    getSocialDriveStats: () => makeSocialStats(),
    getCognitiveHungerStats: () => makeCognitiveStats(),
  };
}

function makeNoExploreConfig() {
  return {
    ...DEFAULT_CONFIG,
    driveArbiter: { ...DEFAULT_CONFIG.driveArbiter, explorationRate: 0 },
  };
}

describe("Drive Arbiter reentrancy", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-arbiter-re-"));
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

  it("runs a single arbitration when selection handlers re-emit drive events", () => {
    initDriveArbiter(tempDir, makeNoExploreConfig(), makeGetters(), undefined);

    const selections: Array<{ driveId: string }> = [];
    trackOn("arbiter:drive-selected", (data) => {
      selections.push(data as { driveId: string });
      // Реентрантная попытка: слушатель выбора драйва снова излучает
      // событие потребности — синхронно внутри текущего арбитража
      bus.emitSync("social-drive:need-rising", {
        needLevel: "strong",
        satiation: 0.2,
        need: 0.8,
      });
    });

    bus.emitSync("social-drive:need-rising", { needLevel: "strong", satiation: 0.2, need: 0.8 });

    // Без гарда вложенный emitSync вызвал бы второй арбитраж
    // (и потенциально бесконечную рекурсию)
    expect(getDriveArbiterStats().totalArbitrations).toBe(1);
    expect(selections.length).toBe(1);
  });

  it("guard resets after stop/re-init so new arbitrations work", () => {
    initDriveArbiter(tempDir, makeNoExploreConfig(), makeGetters(), undefined);
    bus.emitSync("social-drive:need-rising", { needLevel: "strong", satiation: 0.2, need: 0.8 });
    const first = getDriveArbiterStats().totalArbitrations;
    stopDriveArbiter();

    initDriveArbiter(tempDir, makeNoExploreConfig(), makeGetters(), undefined);
    bus.emitSync("social-drive:need-rising", { needLevel: "strong", satiation: 0.2, need: 0.8 });

    // После ре-инита арбитраж снова работает (гард сброшен, счётчик из state-файла)
    expect(getDriveArbiterStats().totalArbitrations).toBeGreaterThanOrEqual(first);
    expect(getLastSelectedDrive()).not.toBeNull();
  });
});
