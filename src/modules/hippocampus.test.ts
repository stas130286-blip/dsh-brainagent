import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initMemoryStorage,
  storeFact,
  recallFacts,
  recallAll,
  getPendingContradictions,
  clearPendingContradictions,
} from "./hippocampus.ts";

let tempDir: string;

describe("Hippocampus — semantic memory", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-hippo-"));
    initMemoryStorage(tempDir);
    clearPendingContradictions();
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  // ── Basic storage ─────────────────────────────────────────────

  it("stores a fact with default confidence", () => {
    const fact = storeFact("The sky is blue", "general");
    expect(fact.id).toMatch(/^sem-/);
    expect(fact.content).toBe("The sky is blue");
    expect(fact.category).toBe("general");
    expect(fact.confidence).toBeCloseTo(0.7, 5);
  });

  it("repeating an identical fact strengthens it instead of duplicating", () => {
    const first = storeFact("Water boils at 100C", "general");
    const second = storeFact("water boils at 100c", "general"); // case-insensitive
    expect(second.id).toBe(first.id);
    expect(second.confidence).toBeCloseTo(0.8, 5); // 0.7 + 0.1
  });

  // ── Reconsolidation (Tier-1 contradiction) ────────────────────

  it("revises a contradicting structural fact instead of duplicating", () => {
    const first = storeFact("City: Moscow", "profile");
    const revised = storeFact("City: Berlin", "profile");

    expect(revised.id).toBe(first.id); // same fact, rewritten
    expect(revised.content).toBe("City: Berlin");
    expect(revised.revisionHistory).toHaveLength(1);
    expect(revised.revisionHistory?.[0].previousContent).toBe("City: Moscow");
  });

  // ── Tier-2 pending contradictions ─────────────────────────────

  it("queues topically related facts for dream-mode review with newFactId filled", () => {
    const first = storeFact("The user prefers drinking green tea every morning", "preferences");
    const second = storeFact("The user enjoys swimming at the local pool", "preferences");

    // Moderately similar but not a duplicate → a brand-new fact…
    expect(second.id).not.toBe(first.id);

    // …and a Tier-2 pending contradiction linking both ids.
    const pending = getPendingContradictions();
    expect(pending.length).toBeGreaterThan(0);
    const entry = pending.find((p) => p.existingFactId === first.id);
    expect(entry).toBeDefined();
    expect(entry?.newFactId).toBe(second.id); // backfilled by storeFact
  });

  // ── Recall ────────────────────────────────────────────────────

  it("recalls stored facts by keyword", () => {
    storeFact("Пользователь любит кофе по утрам", "preferences");
    const found = recallFacts("кофе утром");
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].content).toContain("кофе");
  });

  it("recallAll returns matching semantic results", () => {
    storeFact("Project deadline is Friday", "work");
    const all = recallAll("project deadline");
    expect(all.semantic.length).toBeGreaterThan(0);
    expect(all.semantic[0].category).toBe("work");
  });
});
