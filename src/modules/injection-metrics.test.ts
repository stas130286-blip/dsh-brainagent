import { describe, it, expect, beforeEach } from "vitest";
import {
  getInjectionMetrics,
  recordInjectionCycle,
  resetInjectionMetrics,
} from "./injection-metrics.ts";

describe("injection metrics", () => {
  beforeEach(() => {
    resetInjectionMetrics();
  });

  it("starts with zeroed metrics", () => {
    const m = getInjectionMetrics();
    expect(m.cycles).toBe(0);
    expect(m.avgChars).toBe(0);
    expect(m.maxChars).toBe(0);
    expect(m.overBudgetCycles).toBe(0);
  });

  it("aggregates averages and maximums across cycles", () => {
    recordInjectionCycle(3, 100);
    recordInjectionCycle(5, 300);

    const m = getInjectionMetrics();
    expect(m.cycles).toBe(2);
    expect(m.avgChars).toBe(200);
    expect(m.maxChars).toBe(300);
    expect(m.lastChars).toBe(300);
    expect(m.avgSections).toBe(4);
    expect(m.maxSections).toBe(5);
    expect(m.lastSections).toBe(5);
    // Оценка токенов: ceil(200 / 4)
    expect(m.avgEstTokens).toBe(50);
  });

  it("counts over-budget cycles only when a budget is given", () => {
    recordInjectionCycle(1, 500); // без бюджета — не считается
    recordInjectionCycle(1, 500, 400); // превышение
    recordInjectionCycle(1, 300, 400); // в пределах

    const m = getInjectionMetrics();
    expect(m.cycles).toBe(3);
    expect(m.overBudgetCycles).toBe(1);
  });

  it("reset clears all counters", () => {
    recordInjectionCycle(2, 150, 100);
    resetInjectionMetrics();
    const m = getInjectionMetrics();
    expect(m.cycles).toBe(0);
    expect(m.overBudgetCycles).toBe(0);
    expect(m.maxChars).toBe(0);
  });
});
