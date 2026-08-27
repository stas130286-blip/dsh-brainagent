/**
 * v0.9.20: инъекция проверенных связок эмерджентных модулей
 * в контекст agent/pre-step.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildDomainRecommendationContext,
  initEmergentModules,
  recordPattern,
  resetDomainRecommendationDedup,
  stopEmergentModules,
} from "./emergent-modules.ts";
import { DEFAULT_CONFIG, type BrainAgentConfig, type ModuleName } from "./types.ts";

const PARTICIPANTS: ModuleName[] = ["thalamus", "amygdala", "hippocampus"];

/** Конфиг с заниженными порогами — паттерн устаканивается за 4 записи. */
function fastConfig(): BrainAgentConfig {
  return {
    ...DEFAULT_CONFIG,
    emergentModules: {
      ...DEFAULT_CONFIG.emergentModules,
      minOccurrences: 2,
      minRewardForEstablishment: 0.1,
    },
  };
}

describe("buildDomainRecommendationContext (v0.9.20)", () => {
  let tempDir: string;

  beforeEach(() => {
    resetDomainRecommendationDedup();
    stopEmergentModules();
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-emergent-"));
  });

  afterEach(() => {
    stopEmergentModules();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  it("без устоявшегося паттерна контекст не собирается", () => {
    expect(buildDomainRecommendationContext("technical")).toBeUndefined();
  });

  it("устоявшийся паттерн даёт инъекцию с участниками связки", () => {
    initEmergentModules(tempDir, fastConfig());
    // 2 вхождения → emerging, ещё 2 → established (≥ minOccurrences × 2)
    for (let i = 0; i < 4; i++) {
      recordPattern(PARTICIPANTS, "technical", 0.9);
    }
    const ctx = buildDomainRecommendationContext("technical");
    expect(ctx).toBeDefined();
    expect(ctx).toContain("Проверенная связка модулей");
    for (const p of PARTICIPANTS) {
      expect(ctx).toContain(p);
    }
  });

  it("повторная подсказка тому же домену дедуплицируется (окно 30 минут)", () => {
    initEmergentModules(tempDir, fastConfig());
    for (let i = 0; i < 4; i++) {
      recordPattern(PARTICIPANTS, "technical", 0.9);
    }
    const base = Date.now();
    expect(buildDomainRecommendationContext("technical", base)).toBeDefined();
    expect(buildDomainRecommendationContext("technical", base + 60_000)).toBeUndefined();
    // через 30 минут окно дедупликации открывается снова
    expect(buildDomainRecommendationContext("technical", base + 31 * 60_000)).toBeDefined();
  });
});
