import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMetricsCollector } from "./metrics.ts";

describe("единый metrics-файл (m7)", () => {
  it("инстансы изолированы: счётчики и секции независимы", () => {
    const a = createMetricsCollector("");
    const b = createMetricsCollector("");
    a.register("x", () => 1);
    a.update();
    a.update();
    b.register("y", () => 2);
    b.update();
    expect(a.snapshot().updates).toBe(2);
    expect(b.snapshot().updates).toBe(1);
    expect(a.snapshot().sections).toEqual({ x: 1 });
    expect(b.snapshot().sections).toEqual({ y: 2 });
  });

  it("падающий провайдер попадает в errors и не ломает остальные", () => {
    const m = createMetricsCollector("");
    m.register("ok", () => "fine");
    m.register("boom", () => {
      throw new Error("kaput");
    });
    const snap = m.update();
    expect(snap.sections.ok).toBe("fine");
    expect(snap.sections.boom).toBeUndefined();
    expect(snap.errors.boom).toBe("kaput");
  });

  it("detached-режим (пустой dir) не трогает диск", () => {
    const m = createMetricsCollector("");
    m.register("x", () => 1);
    m.update();
    m.stop();
    expect(m.snapshot().sections).toEqual({ x: 1 });
  });

  it("stop() сбрасывает snapshot в .brainagent/metrics.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "brainagent-metrics-"));
    const m = createMetricsCollector(dir);
    m.register("x", () => 42);
    m.update();
    m.stop();
    const path = join(dir, ".brainagent", "metrics.json");
    expect(existsSync(path)).toBe(true);
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    expect((parsed.sections as Record<string, unknown>).x).toBe(42);
    expect(parsed.updates).toBe(1);
    expect(typeof parsed.generatedAt).toBe("string");
    expect(typeof parsed.startedAt).toBe("string");
  });
});
