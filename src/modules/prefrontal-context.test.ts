/**
 * v0.9.8: assembleContext содержит правило против дублирования
 * напоминаний (модель не должна создавать собственные таймеры —
 * напоминание уже ведёт внутренний планировщик BrainAgent).
 */
import { describe, expect, it } from "vitest";
import { assembleContext } from "./prefrontal-cortex.ts";
import type { BrainState } from "./types.ts";

function minimalState(): BrainState {
  return {
    relevantMemories: { episodic: [], semantic: [], procedural: [] },
    contextInjections: ["## Test Section"],
  } as unknown as BrainState;
}

describe("assembleContext: анти-дубль напоминаний (v0.9.8)", () => {
  it("содержит секцию Reminders с запретом самодельных таймеров", () => {
    const ctx = assembleContext(minimalState());
    expect(ctx).toContain("## Reminders");
    expect(ctx).toContain("internal reminder clock");
    expect(ctx).toContain("NEVER create your own timers");
  });

  it("правило находится внутри блока brainagent-context", () => {
    const ctx = assembleContext(minimalState());
    expect(ctx.startsWith("<brainagent-context>")).toBe(true);
    expect(ctx.trimEnd().endsWith("</brainagent-context>")).toBe(true);
    const start = ctx.indexOf("<brainagent-context>");
    const end = ctx.indexOf("</brainagent-context>");
    const pos = ctx.indexOf("## Reminders");
    expect(pos).toBeGreaterThan(start);
    expect(pos).toBeLessThan(end);
  });
});
