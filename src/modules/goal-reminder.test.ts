/**
 * v0.9.7: фоновый планировщик time-напоминаний и защита от
 * гол-раундов хоста без патча пейсинга.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTONOMY_PRIORITY_PREFIX,
} from "./autonomy-markers.ts";
import {
  DEFAULT_REMINDER_CHECK_MS,
  buildReminderText,
  createGoalRoundGuard,
  startGoalReminderScheduler,
} from "./goal-reminder.ts";
import type { Goal } from "./types.ts";

const flowerGoal = { description: "полить цветы" } as Goal;

describe("buildReminderText (v0.9.7)", () => {
  it("содержит приоритетный маркер, суть напоминания и закрывающий тег", () => {
    const text = buildReminderText([flowerGoal], "контекст цели");
    expect(text.startsWith(AUTONOMY_PRIORITY_PREFIX)).toBe(true);
    expect(text).toContain("полить цветы");
    expect(text).toContain("контекст цели");
    expect(text.trimEnd().endsWith("</autonomous-intent>")).toBe(true);
  });

  it("обходится без контекста цели", () => {
    const text = buildReminderText([flowerGoal], undefined);
    expect(text).toContain("полить цветы");
    expect(text).toContain("</autonomous-intent>");
  });
});

describe("startGoalReminderScheduler (v0.9.7)", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.BRAINAGENT_REMINDER_CHECK_MS;
  });

  it("доставляет напоминание по созревшей time-цели и молчит дальше", () => {
    vi.useFakeTimers();
    const enqueued: string[] = [];
    let calls = 0;
    const stop = startGoalReminderScheduler({
      checkAutonomousGoals: () => (++calls === 1 ? [flowerGoal] : []),
      buildGoalContext: () => undefined,
      enqueue: (t) => enqueued.push(t),
    });
    try {
      vi.advanceTimersByTime(DEFAULT_REMINDER_CHECK_MS + 10);
      expect(enqueued).toHaveLength(1);
      expect(enqueued[0]).toContain(AUTONOMY_PRIORITY_PREFIX);
      expect(enqueued[0]).toContain("полить цветы");
      vi.advanceTimersByTime(DEFAULT_REMINDER_CHECK_MS * 2);
      expect(enqueued).toHaveLength(1); // целей нет — тишина
    } finally {
      stop();
    }
  });

  it("уважает интервал из окружения (не меньше 5 секунд)", () => {
    vi.useFakeTimers();
    process.env.BRAINAGENT_REMINDER_CHECK_MS = "5000";
    const enqueued: string[] = [];
    const stop = startGoalReminderScheduler({
      checkAutonomousGoals: () => [flowerGoal],
      buildGoalContext: () => undefined,
      enqueue: (t) => enqueued.push(t),
    });
    try {
      vi.advanceTimersByTime(5_010);
      expect(enqueued).toHaveLength(1);
    } finally {
      stop();
    }
  });

  it("stop() останавливает планировщик", () => {
    vi.useFakeTimers();
    const enqueued: string[] = [];
    const stop = startGoalReminderScheduler({
      checkAutonomousGoals: () => [flowerGoal],
      buildGoalContext: () => undefined,
      enqueue: (t) => enqueued.push(t),
    });
    stop();
    vi.advanceTimersByTime(DEFAULT_REMINDER_CHECK_MS * 3);
    expect(enqueued).toHaveLength(0);
  });

  it("ошибка проверки целей не роняет планировщик", () => {
    vi.useFakeTimers();
    const enqueued: string[] = [];
    let calls = 0;
    const stop = startGoalReminderScheduler({
      checkAutonomousGoals: () => {
        if (++calls === 1) throw new Error("boom");
        return [flowerGoal];
      },
      buildGoalContext: () => undefined,
      enqueue: (t) => enqueued.push(t),
    });
    try {
      vi.advanceTimersByTime(DEFAULT_REMINDER_CHECK_MS + 10);
      vi.advanceTimersByTime(DEFAULT_REMINDER_CHECK_MS + 10);
      expect(enqueued).toHaveLength(1);
    } finally {
      stop();
    }
  });
});

describe("createGoalRoundGuard (v0.9.7)", () => {
  it("предупреждает один раз при всплеске гол-раундов", () => {
    const warnings: string[] = [];
    const guard = createGoalRoundGuard((m) => warnings.push(m));
    for (let i = 0; i < 4; i++) guard({ kind: "goal", round: i + 1 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("apply-goal-round-pacing.cjs");
  });

  it("не предупреждает при спокойном темпе", () => {
    const warnings: string[] = [];
    const guard = createGoalRoundGuard((m) => warnings.push(m));
    guard({ kind: "goal", round: 1 });
    guard({ kind: "goal", round: 2 });
    expect(warnings).toHaveLength(0);
  });

  it("игнорирует не-голые источники", () => {
    const warnings: string[] = [];
    const guard = createGoalRoundGuard((m) => warnings.push(m));
    for (let i = 0; i < 5; i++) guard({ kind: "user" });
    for (let i = 0; i < 5; i++) guard(undefined);
    expect(warnings).toHaveLength(0);
  });
});
