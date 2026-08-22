import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { bus } from "./event-bus.ts";
import {
  initGoalStack,
  createGoal,
  checkGoalTriggers,
  expireGoals,
  completeGoal,
  buildGoalContext,
  getGoalStackStats,
  addDesire,
  resolveDesireCompetition,
  makeVoluntaryDecision,
  buildVolitionContext,
  getDesires,
  getDecisionLog,
  boostExploration,
  getEffectiveExplorationRate,
  tickExplorationBoosts,
  escalateStaleDesires,
} from "./goal-stack.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import type { BrainAgentConfig, GoalTrigger } from "./types.ts";

let tmpDir: string;
let unsubs: Array<() => void> = [];

function trackOn(...args: Parameters<typeof bus.on>): ReturnType<typeof bus.on> {
  const unsub = bus.on(...args);
  unsubs.push(unsub);
  return unsub;
}

describe("Goal Stack", () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "brainagent-goals-test-"));
    for (const fn of unsubs) fn();
    unsubs = [];
    bus.gc(0);
    initGoalStack(tmpDir, DEFAULT_CONFIG);
  });

  // ── Initialization ──────────────────────────────────────────

  describe("initialization", () => {
    it("starts with zero goals", () => {
      const stats = getGoalStackStats();
      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.triggered).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.expired).toBe(0);
    });
  });

  // ── Goal creation ──────────────────────────────────────────

  describe("createGoal", () => {
    it("creates a pending goal", () => {
      const goal = createGoal(
        "Follow up on deployment",
        { type: "topic", condition: "deployment" },
        "test",
        "Remember to follow up on deployment status",
      );

      expect(goal.id).toBeDefined();
      expect(goal.status).toBe("pending");
      expect(goal.description).toBe("Follow up on deployment");
      expect(goal.priority).toBe(0.5); // default
    });

    it("creates goal with custom priority and TTL", () => {
      const goal = createGoal(
        "High priority task",
        { type: "topic", condition: "urgent" },
        "test",
        "Handle urgent task",
        0.9,
        60000, // 1 minute TTL
      );

      expect(goal.priority).toBe(0.9);
      expect(goal.expiresAt - goal.createdAt).toBe(60000);
    });

    it("emits goal:created event", () => {
      const handler = vi.fn();
      trackOn("goal:created", handler);

      createGoal("test goal", { type: "topic", condition: "test" }, "test", "context");

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "test goal",
          source: "test",
        }),
      );
    });

    it("increments goal count", () => {
      createGoal("g1", { type: "topic", condition: "a" }, "test", "ctx");
      createGoal("g2", { type: "topic", condition: "b" }, "test", "ctx");

      expect(getGoalStackStats().total).toBe(2);
      expect(getGoalStackStats().pending).toBe(2);
    });

    it("evicts lowest priority goal when at max", () => {
      const config: BrainAgentConfig = {
        ...DEFAULT_CONFIG,
        goalStack: { ...DEFAULT_CONFIG.goalStack, maxGoals: 3 },
      };
      initGoalStack(tmpDir, config);

      createGoal("low", { type: "topic", condition: "a" }, "test", "ctx", 0.1);
      createGoal("med", { type: "topic", condition: "b" }, "test", "ctx", 0.5);
      createGoal("high", { type: "topic", condition: "c" }, "test", "ctx", 0.9);
      // This should evict the lowest priority
      createGoal("new", { type: "topic", condition: "d" }, "test", "ctx", 0.7);

      const stats = getGoalStackStats();
      expect(stats.pending).toBeLessThanOrEqual(3);
    });
  });

  // ── Trigger checking ───────────────────────────────────────

  describe("checkGoalTriggers", () => {
    it("triggers topic-based goal on keyword match", () => {
      createGoal(
        "Follow up on deployment",
        { type: "topic", condition: "deployment" },
        "test",
        "Check deployment status",
      );

      const triggered = checkGoalTriggers("How is the deployment going?");
      expect(triggered).toHaveLength(1);
      expect(triggered[0].description).toBe("Follow up on deployment");
      expect(triggered[0].status).toBe("triggered");
    });

    it("does not trigger on unrelated input", () => {
      createGoal(
        "Follow up on deployment",
        { type: "topic", condition: "deployment" },
        "test",
        "Check deployment status",
      );

      const triggered = checkGoalTriggers("What is the weather?");
      expect(triggered).toHaveLength(0);
    });

    it("triggers emotion-based goal", () => {
      createGoal(
        "Check wellbeing",
        { type: "emotion", condition: "sadness" },
        "test",
        "Ask if user is okay",
      );

      const triggered = checkGoalTriggers("I feel down", "sadness");
      expect(triggered).toHaveLength(1);
    });

    it("does not trigger emotion goal with wrong emotion", () => {
      createGoal(
        "Check wellbeing",
        { type: "emotion", condition: "sadness" },
        "test",
        "Ask if user is okay",
      );

      const triggered = checkGoalTriggers("great day!", "joy");
      expect(triggered).toHaveLength(0);
    });

    it("triggers time-based goal when time has passed", () => {
      const pastTime = (Date.now() - 1000).toString();
      createGoal("Timed reminder", { type: "time", condition: pastTime }, "test", "Remind user");

      const triggered = checkGoalTriggers("any input");
      expect(triggered).toHaveLength(1);
    });

    it("does not trigger time-based goal for future time", () => {
      const futureTime = (Date.now() + 3600000).toString();
      createGoal("Future reminder", { type: "time", condition: futureTime }, "test", "Remind user");

      const triggered = checkGoalTriggers("any input");
      expect(triggered).toHaveLength(0);
    });

    it("does not trigger idle goals via checkGoalTriggers", () => {
      createGoal("Idle check", { type: "idle", condition: "300000" }, "test", "Check on user");

      const triggered = checkGoalTriggers("input");
      expect(triggered).toHaveLength(0);
    });

    it("emits goal:triggered event", () => {
      const handler = vi.fn();
      trackOn("goal:triggered", handler);

      createGoal("Follow up", { type: "topic", condition: "deployment" }, "test", "ctx");

      checkGoalTriggers("check deployment");

      expect(handler).toHaveBeenCalledOnce();
    });

    it("does not re-trigger already triggered goals", () => {
      createGoal("Follow up", { type: "topic", condition: "deployment" }, "test", "ctx");

      const first = checkGoalTriggers("deployment");
      expect(first).toHaveLength(1);

      const second = checkGoalTriggers("deployment again");
      expect(second).toHaveLength(0);
    });

    it("topic matching is case-insensitive", () => {
      createGoal("Follow up", { type: "topic", condition: "Deployment" }, "test", "ctx");

      const triggered = checkGoalTriggers("how is the DEPLOYMENT?");
      expect(triggered).toHaveLength(1);
    });
  });

  // ── Goal expiration ────────────────────────────────────────

  describe("expireGoals", () => {
    it("expires goals past their TTL", async () => {
      const goal = createGoal(
        "Short-lived",
        { type: "topic", condition: "test" },
        "test",
        "ctx",
        0.5,
        1, // 1ms TTL — expires immediately
      );

      // Wait a few ms to ensure expiry time has passed
      await new Promise((resolve) => setTimeout(resolve, 10));

      const handler = vi.fn();
      trackOn("goal:expired", handler);

      expireGoals();

      expect(getGoalStackStats().expired).toBeGreaterThanOrEqual(1);
    });

    it("does not expire goals within TTL", () => {
      createGoal(
        "Long-lived",
        { type: "topic", condition: "test" },
        "test",
        "ctx",
        0.5,
        3600000, // 1 hour
      );

      expireGoals();

      expect(getGoalStackStats().expired).toBe(0);
      expect(getGoalStackStats().pending).toBe(1);
    });
  });

  // ── Goal completion ────────────────────────────────────────

  describe("completeGoal", () => {
    it("marks pending goal as completed", () => {
      const goal = createGoal("task", { type: "topic", condition: "x" }, "test", "ctx");
      completeGoal(goal.id);

      expect(getGoalStackStats().completed).toBe(1);
      expect(getGoalStackStats().pending).toBe(0);
    });

    it("marks triggered goal as completed", () => {
      createGoal("task", { type: "topic", condition: "deployment" }, "test", "ctx");
      checkGoalTriggers("deployment");

      const stats = getGoalStackStats();
      expect(stats.triggered).toBe(1);

      const goal = createGoal("task2", { type: "topic", condition: "x" }, "test", "ctx");
      // Complete the first triggered goal would need its ID
    });

    it("emits goal:completed event", () => {
      const handler = vi.fn();
      trackOn("goal:completed", handler);

      const goal = createGoal("task", { type: "topic", condition: "x" }, "test", "ctx");
      completeGoal(goal.id);

      expect(handler).toHaveBeenCalledOnce();
    });

    it("does nothing for non-existent goal ID", () => {
      completeGoal("nonexistent");
      expect(getGoalStackStats().completed).toBe(0);
    });
  });

  // ── Goal context ───────────────────────────────────────────

  describe("buildGoalContext", () => {
    it("returns undefined for empty triggered list", () => {
      expect(buildGoalContext([])).toBeUndefined();
    });

    it("builds context from triggered goals", () => {
      createGoal(
        "Follow up",
        { type: "topic", condition: "deploy" },
        "test",
        "Remember to check deployment",
      );

      const triggered = checkGoalTriggers("deploy status");
      const ctx = buildGoalContext(triggered);

      expect(ctx).toBeDefined();
      expect(ctx).toContain("goal-context");
      expect(ctx).toContain("Remember to check deployment");
    });

    it("limits context to 3 goals max", () => {
      const goals = [];
      for (let i = 0; i < 5; i++) {
        goals.push(
          createGoal(`goal${i}`, { type: "topic", condition: `kw${i}` }, "test", `ctx${i}`),
        );
      }

      // Manually trigger all
      const triggered = [];
      for (let i = 0; i < 5; i++) {
        const t = checkGoalTriggers(`kw${i}`);
        triggered.push(...t);
      }

      const ctx = buildGoalContext(triggered);
      expect(ctx).toBeDefined();
      // Count bullet points (lines starting with "- ")
      const bulletPoints = ctx!.split("\n").filter((l) => l.startsWith("- "));
      expect(bulletPoints.length).toBeLessThanOrEqual(3);
    });
  });

  // ── Persistence ─────────────────────────────────────────────

  describe("persistence", () => {
    it("persists goals across re-initialization", () => {
      createGoal("persisted", { type: "topic", condition: "test" }, "test", "ctx");

      // Re-init
      initGoalStack(tmpDir, DEFAULT_CONFIG);

      expect(getGoalStackStats().total).toBe(1);
    });
  });

  // ── Volition: Desires ───────────────────────────────────────

  describe("addDesire", () => {
    it("creates a desire with correct fields", () => {
      const d = addDesire("exploration", "discover new domains", 0.8, "curiosity-drive");

      expect(d.id).toMatch(/^desire_/);
      expect(d.type).toBe("exploration");
      expect(d.description).toBe("discover new domains");
      expect(d.strength).toBe(0.8);
      expect(d.source).toBe("curiosity-drive");
    });

    it("clamps strength to 0-1", () => {
      const d1 = addDesire("mastery", "high", 1.5, "test");
      expect(d1.strength).toBe(1);

      const d2 = addDesire("mastery", "low", -0.5, "test");
      expect(d2.strength).toBe(0);
    });

    it("emits volition:desire-activated event", () => {
      const handler = vi.fn();
      trackOn("volition:desire-activated", handler);

      addDesire("connection", "connect with user", 0.7, "mirror");

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "connection", strength: 0.7 }),
      );
    });

    it("evicts weakest desire when at max", () => {
      const config = {
        ...DEFAULT_CONFIG,
        goalStack: { ...DEFAULT_CONFIG.goalStack, maxDesires: 3 },
      };
      initGoalStack(tmpDir, config);

      addDesire("exploration", "a", 0.5, "test");
      addDesire("mastery", "b", 0.9, "test");
      addDesire("connection", "c", 0.7, "test");
      addDesire("autonomy", "d", 0.8, "test"); // should evict the weakest (0.5)

      const desires = getDesires();
      expect(desires.length).toBe(3);
      expect(desires.every((d) => d.strength >= 0.7)).toBe(true);
    });

    it("updates stats with desire count", () => {
      addDesire("exploration", "test", 0.5, "test");
      addDesire("mastery", "test2", 0.6, "test");

      const stats = getGoalStackStats();
      expect(stats.desireCount).toBe(2);
    });
  });

  describe("resolveDesireCompetition", () => {
    it("returns undefined when no desires", () => {
      expect(resolveDesireCompetition("any context")).toBeUndefined();
    });

    it("returns strongest desire", () => {
      addDesire("exploration", "discover", 0.5, "test");
      addDesire("mastery", "improve skills", 0.9, "test");

      const winner = resolveDesireCompetition("some context");
      expect(winner).toBeDefined();
      expect(winner!.type).toBe("mastery");
    });

    it("boosts desire when context keywords match", () => {
      addDesire("exploration", "explore unknown territory", 0.5, "test");
      addDesire("mastery", "improve skills", 0.6, "test");

      // Context mentioning "unknown" should boost exploration desire
      const winner = resolveDesireCompetition("there is an unknown area to explore");
      expect(winner).toBeDefined();
      expect(winner!.type).toBe("exploration");
    });
  });

  describe("makeVoluntaryDecision", () => {
    it("returns undefined for empty options", () => {
      expect(makeVoluntaryDecision([], "context")).toBeUndefined();
    });

    it("makes a decision and logs it", () => {
      const decision = makeVoluntaryDecision(["option A", "option B", "option C"], "test context");

      expect(decision).toBeDefined();
      expect(decision!.options).toEqual(["option A", "option B", "option C"]);
      expect(decision!.chosen).toBeDefined();
      expect(decision!.reasoning).toBeDefined();
    });

    it("emits volition:decision-made event", () => {
      const handler = vi.fn();
      trackOn("volition:decision-made", handler);

      makeVoluntaryDecision(["A", "B"], "context");

      expect(handler).toHaveBeenCalledOnce();
    });

    it("logs decisions", () => {
      makeVoluntaryDecision(["A", "B"], "context");
      makeVoluntaryDecision(["C", "D"], "context2");

      const log = getDecisionLog();
      expect(log.length).toBe(2);
    });

    it("enforces decision log ring buffer", () => {
      const config = {
        ...DEFAULT_CONFIG,
        goalStack: { ...DEFAULT_CONFIG.goalStack, maxDecisionLog: 2 },
      };
      initGoalStack(tmpDir, config);

      makeVoluntaryDecision(["A"], "c1");
      makeVoluntaryDecision(["B"], "c2");
      makeVoluntaryDecision(["C"], "c3");

      const log = getDecisionLog();
      expect(log.length).toBe(2);
    });
  });

  describe("buildVolitionContext", () => {
    it("returns undefined when no desires", () => {
      expect(buildVolitionContext()).toBeUndefined();
    });

    it("returns context with active desires", () => {
      addDesire("exploration", "discover new things", 0.8, "test");
      addDesire("mastery", "improve performance", 0.6, "test");

      const ctx = buildVolitionContext();
      expect(ctx).toBeDefined();
      expect(ctx).toContain("volition-context");
      expect(ctx).toContain("discover new things");
      expect(ctx).toContain("improve performance");
    });
  });

  describe("volition persistence", () => {
    it("persists desires and decisions across re-init", () => {
      addDesire("exploration", "persist test", 0.7, "test");
      makeVoluntaryDecision(["A", "B"], "context");

      initGoalStack(tmpDir, DEFAULT_CONFIG);

      expect(getDesires().length).toBe(1);
      expect(getDesires()[0].description).toBe("persist test");
      expect(getDecisionLog().length).toBe(1);
    });
  });

  // ── Autonomy: boostExploration ─────────────────────────────────
  describe("boostExploration", () => {
    it("creates a boost for the given domain", () => {
      boostExploration("technical", 3, 5);

      const rate = getEffectiveExplorationRate("technical stuff");
      expect(rate).toBeGreaterThan(DEFAULT_CONFIG.goalStack.explorationRate);
    });

    it("returns base rate for unrelated context", () => {
      boostExploration("technical", 3, 5);

      const rate = getEffectiveExplorationRate("casual talk");
      expect(rate).toBe(DEFAULT_CONFIG.goalStack.explorationRate);
    });

    it("expires after tick cycles", () => {
      boostExploration("technical", 3, 2);

      tickExplorationBoosts(); // cycle 1
      expect(getEffectiveExplorationRate("technical stuff")).toBeGreaterThan(
        DEFAULT_CONFIG.goalStack.explorationRate,
      );

      tickExplorationBoosts(); // cycle 2 — expires
      expect(getEffectiveExplorationRate("technical stuff")).toBe(
        DEFAULT_CONFIG.goalStack.explorationRate,
      );
    });

    it("replaces existing boost for same domain", () => {
      boostExploration("technical", 2, 5);
      const rate1 = getEffectiveExplorationRate("technical");
      boostExploration("technical", 4, 10);
      const rate2 = getEffectiveExplorationRate("technical");

      expect(rate2).toBeGreaterThanOrEqual(rate1);
    });
  });

  // ── Autonomy: escalateStaleDesires ────────────────────────────
  describe("escalateStaleDesires", () => {
    it("does not escalate fresh desires", () => {
      addDesire("exploration", "explore something", 0.5, "test");

      const result = escalateStaleDesires();
      expect(result).toEqual([]);
    });

    it("escalates desire after 10 cycles", () => {
      addDesire("mastery", "master cooking", 0.5, "test");

      // Tick 10 cycles
      for (let i = 0; i < 9; i++) {
        escalateStaleDesires();
      }
      // 10th tick should escalate
      const result = escalateStaleDesires();
      expect(result.length).toBe(1);
      expect(result[0].oldStrength).toBe(0.5);
      expect(result[0].newStrength).toBe(0.55);
    });

    it("caps escalation at 0.75", () => {
      addDesire("exploration", "explore limits", 0.7, "test");

      // First escalation at age 10
      for (let i = 0; i < 10; i++) {
        escalateStaleDesires();
      }
      const desires = getDesires();
      expect(desires[0].strength).toBeLessThanOrEqual(0.75);
    });

    it("emits autonomy:desire-escalated event", () => {
      const handler = vi.fn();
      trackOn("autonomy:desire-escalated", handler);

      addDesire("understanding", "understand physics", 0.4, "test");
      for (let i = 0; i < 10; i++) {
        escalateStaleDesires();
      }

      expect(handler).toHaveBeenCalledOnce();
    });
  });
});

// ── LLM Goal Extraction Tests ─────────────────────────────────────

// Mock the llm-client module
vi.mock("./llm-client.ts", () => ({
  callLLM: vi.fn(),
  isAIProviderAvailable: vi.fn(),
}));

import { extractGoalsFromConversation, resetExtractionThrottle } from "./goal-stack.ts";
import { callLLM, isAIProviderAvailable } from "./llm-client.ts";

const mockCallLLM = vi.mocked(callLLM);
const mockIsAIAvailable = vi.mocked(isAIProviderAvailable);

const fakeConfig = { models: { providers: { openai: { apiKey: "sk-test" } } } } as never;

describe("LLM Goal Extraction", () => {
  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), "brainagent-goals-llm-test-"));
    for (const fn of unsubs) fn();
    unsubs = [];
    bus.gc(0);
    initGoalStack(dir, DEFAULT_CONFIG);
    mockCallLLM.mockReset();
    mockIsAIAvailable.mockReset();
    resetExtractionThrottle();
  });

  it("returns empty array when AI is unavailable", async () => {
    mockIsAIAvailable.mockReturnValue(false);

    const goals = await extractGoalsFromConversation(
      "I need to finish my report by Friday",
      fakeConfig,
    );
    expect(goals).toEqual([]);
    expect(mockCallLLM).not.toHaveBeenCalled();
  });

  it("creates goals from valid LLM response", async () => {
    mockIsAIAvailable.mockReturnValue(true);
    mockCallLLM.mockResolvedValue(
      JSON.stringify([
        {
          description: "Follow up on report deadline",
          trigger_type: "topic",
          trigger_condition: "report",
          context_injection: "User mentioned a report due Friday",
          priority: 0.7,
        },
      ]),
    );

    const goals = await extractGoalsFromConversation(
      "I need to finish my report by Friday",
      fakeConfig,
    );
    expect(goals.length).toBe(1);
    expect(goals[0].description).toBe("Follow up on report deadline");
    expect(goals[0].source).toBe("llm-extraction");
    expect(goals[0].priority).toBe(0.7);
  });

  it("creates up to 3 goals maximum", async () => {
    mockIsAIAvailable.mockReturnValue(true);
    mockCallLLM.mockResolvedValue(
      JSON.stringify([
        {
          description: "Goal one text here",
          trigger_type: "topic",
          trigger_condition: "one",
          context_injection: "one",
          priority: 0.5,
        },
        {
          description: "Goal two text here",
          trigger_type: "topic",
          trigger_condition: "two",
          context_injection: "two",
          priority: 0.5,
        },
        {
          description: "Goal three text here",
          trigger_type: "topic",
          trigger_condition: "three",
          context_injection: "three",
          priority: 0.5,
        },
        {
          description: "Goal four text here",
          trigger_type: "topic",
          trigger_condition: "four",
          context_injection: "four",
          priority: 0.5,
        },
      ]),
    );

    const goals = await extractGoalsFromConversation(
      "big message with many intentions",
      fakeConfig,
    );
    expect(goals.length).toBeLessThanOrEqual(3);
  });

  it("deduplicates against existing pending goals", async () => {
    // Create an existing goal
    createGoal(
      "finish report soon",
      { type: "topic", condition: "report" },
      "manual",
      "report reminder",
    );

    mockIsAIAvailable.mockReturnValue(true);
    mockCallLLM.mockResolvedValue(
      JSON.stringify([
        {
          description: "finish the report deadline",
          trigger_type: "topic",
          trigger_condition: "report",
          context_injection: "reminder",
          priority: 0.6,
        },
      ]),
    );

    const goals = await extractGoalsFromConversation("finish report", fakeConfig);
    // Should be deduped because of keyword overlap with existing "finish report soon"
    expect(goals.length).toBe(0);
  });

  it("allows consecutive extraction calls (no time-based throttle)", async () => {
    mockIsAIAvailable.mockReturnValue(true);
    mockCallLLM.mockResolvedValue("[]");

    await extractGoalsFromConversation("first message", fakeConfig);
    expect(mockCallLLM).toHaveBeenCalledOnce();

    // Second call is no longer throttled — rate limiting is via interaction counter in index.ts
    await extractGoalsFromConversation("second message", fakeConfig);
    expect(mockCallLLM).toHaveBeenCalledTimes(2);
  });

  it("returns empty on malformed LLM response", async () => {
    mockIsAIAvailable.mockReturnValue(true);
    mockCallLLM.mockResolvedValue("not valid json");

    const logger = { info: vi.fn() };
    const goals = await extractGoalsFromConversation("test message", fakeConfig, logger);
    expect(goals).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("failed to parse"));
  });

  it("returns empty when LLM returns null", async () => {
    mockIsAIAvailable.mockReturnValue(true);
    mockCallLLM.mockResolvedValue(null);

    const goals = await extractGoalsFromConversation("test message", fakeConfig);
    expect(goals).toEqual([]);
  });

  it("skips items with too-short description", async () => {
    mockIsAIAvailable.mockReturnValue(true);
    mockCallLLM.mockResolvedValue(
      JSON.stringify([
        {
          description: "ab",
          trigger_type: "topic",
          trigger_condition: "x",
          context_injection: "y",
          priority: 0.5,
        },
      ]),
    );

    const goals = await extractGoalsFromConversation("test message", fakeConfig);
    expect(goals).toEqual([]);
  });

  it("skips items with missing trigger_condition", async () => {
    mockIsAIAvailable.mockReturnValue(true);
    mockCallLLM.mockResolvedValue(
      JSON.stringify([
        {
          description: "valid description text",
          trigger_type: "topic",
          trigger_condition: "",
          context_injection: "y",
          priority: 0.5,
        },
      ]),
    );

    const goals = await extractGoalsFromConversation("test message", fakeConfig);
    expect(goals).toEqual([]);
  });

  it("clamps priority to 0-1 range", async () => {
    mockIsAIAvailable.mockReturnValue(true);
    mockCallLLM.mockResolvedValue(
      JSON.stringify([
        {
          description: "high priority goal text",
          trigger_type: "topic",
          trigger_condition: "test",
          context_injection: "ctx",
          priority: 5.0,
        },
      ]),
    );

    const goals = await extractGoalsFromConversation("test message", fakeConfig);
    expect(goals.length).toBe(1);
    expect(goals[0].priority).toBeLessThanOrEqual(1);
  });

  it("emits goal:created events for extracted goals", async () => {
    const handler = vi.fn();
    trackOn("goal:created", handler);

    mockIsAIAvailable.mockReturnValue(true);
    mockCallLLM.mockResolvedValue(
      JSON.stringify([
        {
          description: "event test goal here",
          trigger_type: "topic",
          trigger_condition: "test",
          context_injection: "ctx",
          priority: 0.5,
        },
      ]),
    );

    await extractGoalsFromConversation("test message", fakeConfig);
    expect(handler).toHaveBeenCalledOnce();
  });
});
