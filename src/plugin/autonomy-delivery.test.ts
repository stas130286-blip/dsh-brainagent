/**
 * v0.9.1: блок воспоминаний автономи-энричера (<autonomy-memories>)
 * никогда не доставляется самостоятельным сообщением — только
 * вливается в следующую доставку с реальным содержанием. Иначе
 * агент получает followup без вопроса и задачи.
 */
import { describe, expect, it } from "vitest";
import {
  createAutonomousDeliverer,
  createAutonomyState,
  type AutonomousDelivererDeps,
} from "./autonomy.ts";
import { AUTONOMY_MEMORIES_PREFIX } from "../modules/autonomy-markers.ts";
import { AUTONOMY_PRIORITY_PREFIX } from "./config.ts";
import { DEFAULT_CONFIG } from "../modules/types.ts";

const MEMORIES = [
  AUTONOMY_MEMORIES_PREFIX,
  "- 14 мин назад: Conversation about: technical topic",
  "- README.md = новая секция",
  "</autonomy-memories>",
].join("\n");

const TAGGED = "<autonomous-intent>\nПоделись мыслью.\n</autonomous-intent>";

function makeDeps(state = createAutonomyState(), minUserSilenceMs = 0) {
  const delivered: string[] = [];
  const deps: AutonomousDelivererDeps = {
    state,
    brainConfig: DEFAULT_CONFIG,
    minGapMs: 0,
    minUserSilenceMs,
    logger: { info: () => {}, warn: () => {} },
    pickAgent: () => ({ id: "agent-1" }) as never,
    deliver: (_agent, framed) => {
      delivered.push(framed);
    },
    classifyDomain: () => ({ domain: "casual" as const }),
    isDomainSuppressed: () => false,
    getSuppressedDomainHints: () => [],
  };
  return { state, delivered, deliver: createAutonomousDeliverer(deps) };
}

describe("v0.9.1: <autonomy-memories> не доставляется соло", () => {
  it("блок памяти не уходит самостоятельным сообщением", () => {
    const { state, delivered, deliver } = makeDeps();
    deliver(MEMORIES);
    expect(delivered).toHaveLength(0);
    expect(state.pendingMemoryContext).toBe(MEMORIES);
  });

  it("следующий интент с тегом получает блок памяти в доставке", () => {
    const { delivered, deliver } = makeDeps();
    deliver(MEMORIES);
    deliver(TAGGED);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toContain(TAGGED);
    expect(delivered[0]).toContain(AUTONOMY_MEMORIES_PREFIX);
    expect(delivered[0].indexOf(TAGGED)).toBeLessThan(
      delivered[0].indexOf(AUTONOMY_MEMORIES_PREFIX),
    );
  });

  it("после вливания буфер очищается", () => {
    const { state, delivered, deliver } = makeDeps();
    deliver(MEMORIES);
    deliver(TAGGED);
    expect(state.pendingMemoryContext).toBeUndefined();
    deliver(TAGGED);
    expect(delivered).toHaveLength(2);
    expect(delivered[1]).not.toContain(AUTONOMY_MEMORIES_PREFIX);
  });

  it("нетегированная доставка (high-pressure) тоже обогащается", () => {
    const { delivered, deliver } = makeDeps();
    deliver(MEMORIES);
    deliver("Хочется просто поговорить.");
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toContain("Хочется просто поговорить.");
    expect(delivered[0]).toContain(AUTONOMY_MEMORIES_PREFIX);
  });

  it("доставка без накопленного блока не меняется", () => {
    const { delivered, deliver } = makeDeps();
    deliver(TAGGED);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).not.toContain(AUTONOMY_MEMORIES_PREFIX);
  });
});

describe("v0.9.18: тихий гард — инициатива не вклинивается после диалога", () => {
  it("интент подавляется, если пользователь только что говорил", () => {
    const state = createAutonomyState();
    state.lastUserMessageAt = Date.now();
    const { delivered, deliver } = makeDeps(state, 3 * 60 * 1000);
    deliver(TAGGED);
    expect(delivered).toHaveLength(0);
  });

  it("интент доставляется, если пользователь молчит дольше гарда", () => {
    const state = createAutonomyState();
    state.lastUserMessageAt = Date.now() - 4 * 60 * 1000;
    const { delivered, deliver } = makeDeps(state, 3 * 60 * 1000);
    deliver(TAGGED);
    expect(delivered).toHaveLength(1);
  });

  it("напоминание по времени (priority) обходит тихий гард", () => {
    const state = createAutonomyState();
    state.lastUserMessageAt = Date.now();
    const { delivered, deliver } = makeDeps(state, 3 * 60 * 1000);
    deliver(AUTONOMY_PRIORITY_PREFIX + TAGGED);
    expect(delivered).toHaveLength(1);
  });
});
