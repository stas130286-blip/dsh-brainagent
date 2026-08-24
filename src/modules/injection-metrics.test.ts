import { describe, it, expect, beforeEach } from "vitest";
import {
  createInjectionMetrics,
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

describe("injection metrics per-instance state (v0.6.0)", () => {
  it("фабрика создаёт независимые инстансы", () => {
    const a = createInjectionMetrics();
    const b = createInjectionMetrics();
    a.record(3, 300);
    a.record(3, 300);
    expect(a.get().cycles).toBe(2);
    expect(a.get().avgChars).toBe(300);
    // Второй инстанс не видит записи первого
    expect(b.get().cycles).toBe(0);
    expect(b.get().avgChars).toBe(0);
    b.record(1, 100);
    expect(b.get().cycles).toBe(1);
    expect(a.get().cycles).toBe(2);
  });

  it("обёртки пишут в инстанс по умолчанию и не трогают чужие инстансы", () => {
    resetInjectionMetrics();
    const own = createInjectionMetrics();
    recordInjectionCycle(2, 200);
    expect(getInjectionMetrics().cycles).toBe(1);
    expect(own.get().cycles).toBe(0);
    own.reset();
    expect(getInjectionMetrics().cycles).toBe(1);
  });
});
