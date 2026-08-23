import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bus } from "./event-bus.ts";
import { flushAllPersists } from "./persist.ts";
import {
  getProactiveFeedbackStats,
  getSuppressedDomainHints,
  initProactiveFeedback,
  isDomainSuppressed,
  recordProactiveReaction,
  stopProactiveFeedback,
} from "./proactive-feedback.ts";
import type { BrainAgentConfig } from "./types.ts";

let tempDir: string;

function makeConfig(overrides: Partial<BrainAgentConfig["proactiveFeedback"]> = {}) {
  return {
    proactiveFeedback: {
      suppressionThreshold: 2,
      rejectionStep: 1,
      negativeStep: 0.5,
      positiveStep: 0.5,
      decayPerDay: 0.25,
      cooldownMs: 60_000,
      maxTrackedDomains: 10,
      ...overrides,
    },
  } as unknown as BrainAgentConfig;
}

const log = { info: () => {} };

describe("proactive-feedback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-proactive-feedback-"));
    initProactiveFeedback(tempDir, makeConfig(), log);
  });

  afterEach(() => {
    stopProactiveFeedback();
    flushAllPersists();
    vi.useRealTimers();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  it("classifies rejection reactions and returns the signal", () => {
    expect(recordProactiveReaction("casual", "Хватит об этом")).toBe("rejection");
    expect(recordProactiveReaction("casual", "Ну как тебе?")).toBe("neutral");
    expect(recordProactiveReaction("casual", "Спасибо, интересно")).toBe("positive");
  });

  it("suppresses a domain once rejection score crosses the threshold", () => {
    expect(isDomainSuppressed("casual")).toBe(false);
    recordProactiveReaction("casual", "Не надо мне это присылать"); // score 1
    expect(isDomainSuppressed("casual")).toBe(false);
    recordProactiveReaction("casual", "Я сказал хватит"); // score 2 = threshold
    expect(isDomainSuppressed("casual")).toBe(true);
    // Другие домены не затронуты
    expect(isDomainSuppressed("technical")).toBe(false);
  });

  it("negative reactions count half-weight; positive lowers the score", () => {
    recordProactiveReaction("casual", "Не то ты говоришь"); // +0.5
    recordProactiveReaction("casual", "Неправильно"); // +0.5 → 1.0
    expect(isDomainSuppressed("casual")).toBe(false);
    recordProactiveReaction("casual", "Спасибо, круто"); // −0.5 → 0.5
    recordProactiveReaction("casual", "Хватит"); // +1 → 1.5
    expect(isDomainSuppressed("casual")).toBe(false);
  });

  it("suppression lifts after cooldown elapses", () => {
    recordProactiveReaction("casual", "Отстань");
    recordProactiveReaction("casual", "Отстань, я сказал");
    expect(isDomainSuppressed("casual")).toBe(true);
    // 61 с спустя: кулдаун истёк (и затухание чуть снизило score)
    vi.advanceTimersByTime(61_000);
    expect(isDomainSuppressed("casual")).toBe(false);
  });

  it("suppression score decays over days", () => {
    recordProactiveReaction("casual", "Хватит"); // score 1
    recordProactiveReaction("casual", "Хватит, сказал же"); // score 2
    expect(isDomainSuppressed("casual")).toBe(true);
    // 4 дня спустя: score −1.0 (decay 0.25/день) → 1.0 < threshold 2
    vi.advanceTimersByTime(4 * 24 * 60 * 60 * 1000);
    expect(isDomainSuppressed("casual")).toBe(false);
    const stats = getProactiveFeedbackStats();
    // Счётчики отвержений не сгорают — затухает только score подавления
    expect(stats.totalRejections).toBe(2);
  });

  it("emits proactive:reaction event with domain and signal", () => {
    const seen: Array<{ domain: string; signal: string }> = [];
    const unsub = bus.on("proactive:reaction", (data) => {
      seen.push({ domain: data.domain, signal: data.signal });
    });
    recordProactiveReaction("technical", "stop it");
    unsub();
    expect(seen).toEqual([{ domain: "technical", signal: "rejection" }]);
  });

  it("persists state and restores it on re-init", () => {
    recordProactiveReaction("casual", "Не надо");
    recordProactiveReaction("casual", "Хватит");
    stopProactiveFeedback(); // flush на диск

    // Пере-инициализация в той же директории
    vi.advanceTimersByTime(1); // минимальное затухание
    initProactiveFeedback(tempDir, makeConfig(), log);
    expect(isDomainSuppressed("casual")).toBe(true);
    expect(getProactiveFeedbackStats().totalRejections).toBe(2);
  });

  it("returns human-readable hints for suppressed domains", () => {
    recordProactiveReaction("emotional", "Отстань");
    recordProactiveReaction("emotional", "Я сказал отстань");
    const hints = getSuppressedDomainHints();
    expect(hints.length).toBe(1);
    expect(hints[0]).toContain("emotional");
    expect(hints[0]).toContain("отвергнута");
  });

  it("caps tracked domains at maxTrackedDomains", () => {
    const cfg = makeConfig({ maxTrackedDomains: 3 });
    initProactiveFeedback(tempDir, cfg, log);
    for (const domain of ["a", "b", "c", "d"]) {
      recordProactiveReaction(domain, "просто разговор");
    }
    expect(getProactiveFeedbackStats().trackedDomains).toBeLessThanOrEqual(3);
  });
});
