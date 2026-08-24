/**
 * Eval-сценарии: петля обучения reward-ledger → strategy-bandit.
 * Проверяется полная связка на реальных событиях шины: источник
 * награды → ledger → reward:recorded → атрибуция бандитом → статистика рук.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootBrain } from "./harness.ts";
import type { BrainHandle } from "./harness.ts";
import { bus } from "../modules/event-bus.ts";
import {
  chooseArm,
  getArmStats,
  getBanditStats,
} from "../modules/strategy-bandit.ts";
import { getRecentEntries } from "../modules/reward-ledger.ts";

const totalPlays = (
  stats: Record<string, { plays: number; meanReward: number }>,
): number => Object.values(stats).reduce((sum, arm) => sum + arm.plays, 0);

describe("eval: петля обучения ledger → bandit", () => {
  let brain: BrainHandle;

  beforeAll(async () => {
    brain = await bootBrain();
  });

  afterAll(() => {
    brain.dispose();
  });

  it("бандит и летопись наград инициализированы плагином", () => {
    expect(getBanditStats().initialized).toBe(true);
  });

  it("pre-step выбирает руку context-verbosity и эмитит событие", async () => {
    const events: Array<{ decisionPoint: string; arm: string }> = [];
    const unsub = bus.on("bandit:arm-chosen", (data) => {
      events.push(data);
    });
    await brain.preStep("Расскажи что-нибудь о фотосинтезе.");
    unsub();
    expect(events.some((e) => e.decisionPoint === "context-verbosity")).toBe(true);
  });

  it("награда из шины доходит до руки бандита через ledger", async () => {
    await brain.preStep("Сколько ног у осьминога?");
    const before = totalPlays(getArmStats("context-verbosity"));
    bus.emitSync("cerebellum:validated", { passed: true, issues: [] });
    const after = totalPlays(getArmStats("context-verbosity"));
    expect(after).toBe(before + 1);
  });

  it("запись в ledger помечена источником", () => {
    const before = getRecentEntries().length;
    bus.emitSync("dopamine:reward", {
      reward: 0.8,
      predictionError: 0.2,
      participatingModules: [],
      creditAssignment: {},
      context: { domain: "eval", complexity: "simple", emotion: "neutral", input: "eval" },
    });
    const entries = getRecentEntries();
    expect(entries.length).toBe(before + 1);
    expect(entries[entries.length - 1].source).toBe("dopamine");
  });

  it("две точки решения: награда уходит только позднему выбору", async () => {
    const armA = chooseArm("eval-point-a", ["a1", "a2"]);
    await new Promise((r) => setTimeout(r, 10));
    const armB = chooseArm("eval-point-b", ["b1", "b2"]);

    const playsABefore = totalPlays(getArmStats("eval-point-a"));
    const playsBBefore = totalPlays(getArmStats("eval-point-b"));

    bus.emitSync("cerebellum:validated", { passed: true, issues: [] });

    // Точка A эту награду не получила, точка B — получила
    expect(totalPlays(getArmStats("eval-point-a"))).toBe(playsABefore);
    expect(totalPlays(getArmStats("eval-point-b"))).toBe(playsBBefore + 1);

    // Вторая награда точке A уже доступна (её выбор ещё в окне атрибуции)
    bus.emitSync("cerebellum:validated", { passed: false, issues: ["eval"] });
    expect(totalPlays(getArmStats("eval-point-a"))).toBe(playsABefore + 1);

    // Исходы повлияли на средние награды рук
    const statsB = getArmStats("eval-point-b");
    expect(statsB[armB].plays).toBeGreaterThan(0);
    const statsA = getArmStats("eval-point-a");
    expect(statsA[armA].plays).toBeGreaterThan(0);
  });
});
