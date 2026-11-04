import { describe, it, expect, beforeEach } from "vitest";
import { noteToolUse, takeToolTrace, clearToolTrace } from "./tool-trace.ts";

describe("tool-trace — моторный след хода", () => {
  beforeEach(() => {
    clearToolTrace("agent-1");
    clearToolTrace("agent-2");
  });

  it("копит инструменты в порядке применения", () => {
    noteToolUse("agent-1", "read_file");
    noteToolUse("agent-1", "apply_patch");
    expect(takeToolTrace("agent-1")).toEqual(["read_file", "apply_patch"]);
  });

  it("схлопывает повтор подряд, но сохраняет возврат к инструменту", () => {
    noteToolUse("agent-1", "grep");
    noteToolUse("agent-1", "grep");
    noteToolUse("agent-1", "read_file");
    noteToolUse("agent-1", "grep");
    expect(takeToolTrace("agent-1")).toEqual(["grep", "read_file", "grep"]);
  });

  it("take забирает след один раз", () => {
    noteToolUse("agent-1", "grep");
    takeToolTrace("agent-1");
    expect(takeToolTrace("agent-1")).toEqual([]);
  });

  it("ограничивает рутину восемью последними шагами", () => {
    for (let i = 0; i < 12; i++) noteToolUse("agent-1", `tool_${i}`);
    const trace = takeToolTrace("agent-1");
    expect(trace).toHaveLength(8);
    expect(trace[7]).toBe("tool_11");
  });

  it("ключи агентов не смешиваются", () => {
    noteToolUse("agent-1", "a");
    noteToolUse("agent-2", "b");
    expect(takeToolTrace("agent-1")).toEqual(["a"]);
    expect(takeToolTrace("agent-2")).toEqual(["b"]);
  });

  it("пустые значения игнорируются", () => {
    noteToolUse("", "grep");
    noteToolUse("agent-1", "");
    expect(takeToolTrace("agent-1")).toEqual([]);
  });
});
