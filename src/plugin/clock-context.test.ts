import { describe, expect, it } from "vitest";
import { buildClockContext } from "./context.ts";

describe("buildClockContext (v0.9.5)", () => {
  it("сообщает день недели, дату, месяц, год и время", () => {
    // 25 августа 2026 — вторник.
    const ctx = buildClockContext(new Date(2026, 7, 25, 13, 45));
    expect(ctx).toContain("вторник");
    expect(ctx).toContain("25 августа 2026");
    expect(ctx).toContain("13:45");
    expect(ctx).toContain("## Current date and time");
  });

  it("добавляет ведущие нули к часам и минутам", () => {
    const ctx = buildClockContext(new Date(2026, 0, 1, 3, 7));
    expect(ctx).toContain("03:07");
    expect(ctx).toContain("1 января 2026");
    expect(ctx).toContain("четверг");
  });
});
