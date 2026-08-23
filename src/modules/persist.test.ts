import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  atomicWrite,
  cancelPersist,
  flushAllPersists,
  flushPersist,
  getPendingPersistCount,
  schedulePersist,
} from "./persist.ts";

let tempDir: string;

describe("persist", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-persist-"));
  });

  afterEach(() => {
    flushAllPersists();
    vi.useRealTimers();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  it("coalesces repeated schedulePersist calls into a single write", () => {
    const file = join(tempDir, "state.json");
    let value = 1;
    schedulePersist(file, () => JSON.stringify({ value }), 100);
    value = 2;
    schedulePersist(file, () => JSON.stringify({ value }), 100);
    value = 3;
    schedulePersist(file, () => JSON.stringify({ value }), 100);

    expect(existsSync(file)).toBe(false); // ещё debounce
    expect(getPendingPersistCount()).toBe(1);

    vi.advanceTimersByTime(150);
    expect(existsSync(file)).toBe(true);
    expect(getPendingPersistCount()).toBe(0);
    // Ленивый сериализатор — на диск ушло самое свежее состояние
    expect(readFileSync(file, "utf-8")).toBe(JSON.stringify({ value: 3 }));
  });

  it("re-scheduling extends the debounce window", () => {
    const file = join(tempDir, "state.json");
    schedulePersist(file, () => "first", 100);
    vi.advanceTimersByTime(80);
    schedulePersist(file, () => "second", 100); // таймер сброшен
    vi.advanceTimersByTime(80); // суммарно 160 мс, но окно отсчитывается заново
    expect(existsSync(file)).toBe(false);
    vi.advanceTimersByTime(30);
    expect(readFileSync(file, "utf-8")).toBe("second");
  });

  it("flushPersist writes immediately and clears pending entry", () => {
    const file = join(tempDir, "state.json");
    schedulePersist(file, () => "flushed", 1000);
    expect(getPendingPersistCount()).toBe(1);

    flushPersist(file);
    expect(readFileSync(file, "utf-8")).toBe("flushed");
    expect(getPendingPersistCount()).toBe(0);

    // Повторный flush без ожидания — ничего не ломает
    flushPersist(file);
    expect(getPendingPersistCount()).toBe(0);
  });

  it("cancelPersist drops the pending write without touching disk", () => {
    const file = join(tempDir, "state.json");
    schedulePersist(file, () => "never", 100);
    cancelPersist(file);

    vi.advanceTimersByTime(500);
    expect(existsSync(file)).toBe(false);
    expect(getPendingPersistCount()).toBe(0);
  });

  it("atomicWrite leaves no .tmp file behind", () => {
    const file = join(tempDir, "state.json");
    atomicWrite(file, "data");
    expect(readFileSync(file, "utf-8")).toBe("data");
    expect(existsSync(`${file}.tmp`)).toBe(false);
  });

  it("flushAllPersists drains every pending file", () => {
    const a = join(tempDir, "a.json");
    const b = join(tempDir, "b.json");
    schedulePersist(a, () => "A", 5000);
    schedulePersist(b, () => "B", 5000);
    expect(getPendingPersistCount()).toBe(2);

    flushAllPersists();
    expect(readFileSync(a, "utf-8")).toBe("A");
    expect(readFileSync(b, "utf-8")).toBe("B");
    expect(getPendingPersistCount()).toBe(0);
  });
});
