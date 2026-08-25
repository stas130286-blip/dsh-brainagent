import { describe, expect, it } from "vitest";
import {
  DEFAULT_GOAL_ROUND_MIN_IDLE_MS,
  isGoalRoundSource,
  resolveGoalRoundMinIdleMs,
  startGoalRoundPacer,
} from "./goal-round-pacer.ts";
import type {
  GoalRoundPacerAgent,
  GoalRoundPacerGoalView,
  GoalRoundPacerMessage,
} from "./goal-round-pacer.ts";

// ── Тестовые фейки ──────────────────────────────────────────────────

function makeAgent(id = "agent-1"): GoalRoundPacerAgent & { removed: string[] } {
  const removed: string[] = [];
  return {
    id,
    removed,
    inbox: {
      remove(messageId: string) {
        removed.push(messageId);
      },
    },
  };
}

function makeGoal(
  overrides: Partial<GoalRoundPacerGoalView> = {},
): GoalRoundPacerGoalView {
  return {
    id: "goal-1",
    revision: 1,
    phase: "active",
    activation: "armed",
    ...overrides,
  };
}

type RoundEvent = { agent: GoalRoundPacerAgent; message: GoalRoundPacerMessage };

function makeHarness(opts: {
  goal?: GoalRoundPacerGoalView | null;
  resumeGoal?: GoalRoundPacerGoalView | null;
  pauseThrows?: boolean;
  asGetter?: boolean;
  env?: Record<string, string | undefined>;
}) {
  let handler: ((data: RoundEvent) => void) | undefined;
  let unbound = false;
  const paused: { id: string; revision: number }[] = [];
  const resumed: { id: string; revision: number }[] = [];
  const scheduled: { fn: () => void; ms: number; cancelled: boolean }[] = [];
  let clock = 0;
  let goalCalls = 0;

  const goalsImpl = {
    get: () => {
      goalCalls += 1;
      return opts.resumeGoal ?? opts.goal ?? undefined;
    },
    pause: (_agent: GoalRoundPacerAgent, ref: { id: string; revision: number }) => {
      if (opts.pauseThrows) throw new Error("pause failed");
      paused.push(ref);
    },
    resume: (_agent: GoalRoundPacerAgent, ref: { id: string; revision: number }) => {
      resumed.push(ref);
    },
  };

  const stop = startGoalRoundPacer({
    onInserted(fn) {
      handler = fn;
      return () => {
        unbound = true;
      };
    },
    goals: opts.asGetter ? () => goalsImpl : goalsImpl,
    logger: { info: () => {} },
    now: () => clock,
    schedule: (fn, ms) => {
      const entry = { fn, ms, cancelled: false };
      scheduled.push(entry);
      return {
        cancel: () => {
          entry.cancelled = true;
        },
      };
    },
    ...(opts.env ? { env: opts.env } : {}),
  });

  return {
    emit(agent: GoalRoundPacerAgent, message: GoalRoundPacerMessage) {
      handler?.({ agent, message });
    },
    fireTimers() {
      for (const entry of scheduled) {
        if (!entry.cancelled) entry.fn();
      }
    },
    advance(ms: number) {
      clock += ms;
    },
    get paused() {
      return paused;
    },
    get resumed() {
      return resumed;
    },
    get scheduled() {
      return scheduled;
    },
    get unbound() {
      return unbound;
    },
    get goalCalls() {
      return goalCalls;
    },
    stop,
  };
}

const roundMsg = (id: string, round = 1): GoalRoundPacerMessage => ({
  id,
  source: { kind: "goal", round },
});

// ── Хелперы ─────────────────────────────────────────────────────────

describe("isGoalRoundSource", () => {
  it("ловит только автоматические раунды (kind=goal, round>0)", () => {
    expect(isGoalRoundSource({ kind: "goal", round: 1 })).toBe(true);
    expect(isGoalRoundSource({ kind: "goal", round: 0 })).toBe(false);
    expect(isGoalRoundSource({ kind: "user", round: 1 })).toBe(false);
    expect(isGoalRoundSource({ kind: "goal" })).toBe(false);
    expect(isGoalRoundSource(undefined)).toBe(false);
  });
});

describe("resolveGoalRoundMinIdleMs", () => {
  it("без переменной — дефолт", () => {
    expect(resolveGoalRoundMinIdleMs({})).toBe(DEFAULT_GOAL_ROUND_MIN_IDLE_MS);
  });

  it("0 = пейсер выключен", () => {
    expect(resolveGoalRoundMinIdleMs({ DSH_GOAL_ROUND_MIN_IDLE_MS: "0" })).toBe(0);
  });

  it("числовое значение применяется", () => {
    expect(resolveGoalRoundMinIdleMs({ DSH_GOAL_ROUND_MIN_IDLE_MS: "60000" })).toBe(60000);
  });

  it("нечисловые и отрицательные → дефолт", () => {
    expect(resolveGoalRoundMinIdleMs({ DSH_GOAL_ROUND_MIN_IDLE_MS: "abc" })).toBe(
      DEFAULT_GOAL_ROUND_MIN_IDLE_MS,
    );
    expect(resolveGoalRoundMinIdleMs({ DSH_GOAL_ROUND_MIN_IDLE_MS: "-5" })).toBe(
      DEFAULT_GOAL_ROUND_MIN_IDLE_MS,
    );
  });
});

// ── Поведение пейсера ───────────────────────────────────────────────

describe("startGoalRoundPacer", () => {
  it("выключен при 0 мс — возвращает undefined и не подписывается", () => {
    let subscribed = false;
    const stop = startGoalRoundPacer({
      onInserted() {
        subscribed = true;
        return undefined;
      },
      goals: { get: () => undefined, pause: () => {}, resume: () => {} },
      env: { DSH_GOAL_ROUND_MIN_IDLE_MS: "0" },
    });
    expect(stop).toBeUndefined();
    expect(subscribed).toBe(false);
  });

  it("первый раунд проходит и фиксирует время", () => {
    const h = makeHarness({ goal: makeGoal() });
    const agent = makeAgent();
    h.emit(agent, roundMsg("m1"));
    expect(agent.removed).toEqual([]);
    expect(h.paused).toEqual([]);
    expect(h.scheduled).toEqual([]);
  });

  it("преждевременный раунд удаляется, цель ставится на паузу, планируется resume", () => {
    const h = makeHarness({ goal: makeGoal(), env: { DSH_GOAL_ROUND_MIN_IDLE_MS: "60000" } });
    const agent = makeAgent();
    h.emit(agent, roundMsg("m1"));
    h.advance(20000);
    h.emit(agent, roundMsg("m2"));

    expect(agent.removed).toEqual(["m2"]);
    expect(h.paused).toEqual([{ id: "goal-1", revision: 1 }]);
    expect(h.scheduled).toHaveLength(1);
    expect(h.scheduled[0]?.ms).toBe(40000); // остаток окна 60-20
  });

  it("по истечении окна раунд снова проходит", () => {
    const h = makeHarness({ goal: makeGoal(), env: { DSH_GOAL_ROUND_MIN_IDLE_MS: "60000" } });
    const agent = makeAgent();
    h.emit(agent, roundMsg("m1"));
    h.advance(60000);
    h.emit(agent, roundMsg("m2"));

    expect(agent.removed).toEqual([]);
    expect(h.paused).toEqual([]);
  });

  it("таймер возобновляет цель со свежей ревизией", () => {
    const h = makeHarness({
      goal: makeGoal(),
      resumeGoal: makeGoal({ phase: "paused", revision: 3 }),
      env: { DSH_GOAL_ROUND_MIN_IDLE_MS: "60000" },
    });
    const agent = makeAgent();
    h.emit(agent, roundMsg("m1"));
    h.advance(10000);
    h.emit(agent, roundMsg("m2"));
    h.fireTimers();

    expect(h.resumed).toEqual([{ id: "goal-1", revision: 3 }]);
  });

  it("не возобновляет цель, если она больше не paused", () => {
    const h = makeHarness({
      goal: makeGoal(),
      resumeGoal: makeGoal({ phase: "completed", activation: "disarmed" }),
      env: { DSH_GOAL_ROUND_MIN_IDLE_MS: "60000" },
    });
    const agent = makeAgent();
    h.emit(agent, roundMsg("m1"));
    h.advance(10000);
    h.emit(agent, roundMsg("m2"));
    h.fireTimers();

    expect(h.resumed).toEqual([]);
  });

  it("не ставит на паузу цель вне active/armed", () => {
    const h = makeHarness({
      goal: makeGoal({ phase: "active", activation: "disarmed" }),
      env: { DSH_GOAL_ROUND_MIN_IDLE_MS: "60000" },
    });
    const agent = makeAgent();
    h.emit(agent, roundMsg("m1"));
    h.advance(10000);
    h.emit(agent, roundMsg("m2"));

    expect(agent.removed).toEqual(["m2"]); // раунд всё равно снимается
    expect(h.paused).toEqual([]);
    expect(h.scheduled).toEqual([]);
  });

  it("уже paused цель (драйвер успел сам) не паузится повторно, но возвращается", () => {
    const h = makeHarness({
      goal: makeGoal({ phase: "paused", activation: "disarmed" }),
      env: { DSH_GOAL_ROUND_MIN_IDLE_MS: "60000" },
    });
    const agent = makeAgent();
    h.emit(agent, roundMsg("m1"));
    h.advance(10000);
    h.emit(agent, roundMsg("m2"));

    expect(agent.removed).toEqual(["m2"]);
    expect(h.paused).toEqual([]);
    expect(h.scheduled).toHaveLength(1);
    h.fireTimers();
    // resumeGoal = paused-цель → возобновляется
    expect(h.resumed).toEqual([{ id: "goal-1", revision: 1 }]);
  });

  it("getter сервиса целей читается лениво", () => {
    const h = makeHarness({
      goal: makeGoal(),
      asGetter: true,
      env: { DSH_GOAL_ROUND_MIN_IDLE_MS: "60000" },
    });
    expect(h.goalCalls).toBe(0);
    const agent = makeAgent();
    h.emit(agent, roundMsg("m1"));
    h.advance(10000);
    h.emit(agent, roundMsg("m2"));
    expect(h.paused).toEqual([{ id: "goal-1", revision: 1 }]);
    expect(h.goalCalls).toBeGreaterThan(0);
  });

  it("ошибка pause не роняет обработчик", () => {
    const h = makeHarness({
      goal: makeGoal(),
      pauseThrows: true,
      env: { DSH_GOAL_ROUND_MIN_IDLE_MS: "60000" },
    });
    const agent = makeAgent();
    h.emit(agent, roundMsg("m1"));
    h.advance(10000);
    expect(() => h.emit(agent, roundMsg("m2"))).not.toThrow();
    expect(h.scheduled).toEqual([]);
  });

  it("раунды разных агентов трекаются независимо", () => {
    const h = makeHarness({ goal: makeGoal(), env: { DSH_GOAL_ROUND_MIN_IDLE_MS: "60000" } });
    const a = makeAgent("a");
    const b = makeAgent("b");
    h.emit(a, roundMsg("m1"));
    h.emit(b, roundMsg("m2"));
    expect(a.removed).toEqual([]);
    expect(b.removed).toEqual([]);
  });

  it("dispose отписывается, гасит таймеры и игнорирует события", () => {
    const h = makeHarness({ goal: makeGoal(), env: { DSH_GOAL_ROUND_MIN_IDLE_MS: "60000" } });
    const agent = makeAgent();
    h.emit(agent, roundMsg("m1"));
    h.advance(10000);
    h.emit(agent, roundMsg("m2"));
    expect(h.scheduled).toHaveLength(1);

    h.stop?.();
    expect(h.unbound).toBe(true);
    expect(h.scheduled[0]?.cancelled).toBe(true);

    h.emit(agent, roundMsg("m3"));
    expect(agent.removed).toEqual(["m2"]); // после dispose ничего не трогается
  });

  it("ignore не-гол сообщений", () => {
    const h = makeHarness({ goal: makeGoal(), env: { DSH_GOAL_ROUND_MIN_IDLE_MS: "60000" } });
    const agent = makeAgent();
    h.emit(agent, roundMsg("m1"));
    h.emit(agent, { id: "u1", source: { kind: "user" } });
    h.emit(agent, { id: "u2" });
    expect(agent.removed).toEqual([]);
    expect(h.paused).toEqual([]);
  });
});
