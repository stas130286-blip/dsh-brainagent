/**
 * Working Memory Buffer — Inter-cycle continuity via a ring buffer.
 *
 * The human brain maintains a working memory of ~7 items that persists
 * between thoughts. BrainAgent's BrainState resets each cycle, losing
 * context. This module keeps a ring buffer of recent cycle summaries
 * so each new cycle knows what came before without re-retrieving from
 * hippocampus.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bus } from "./event-bus.ts";
import type { BrainAgentConfig, WorkingMemoryEntry } from "./types.ts";

// ── State ───────────────────────────────────────────────────────────

let storageDir = "";
let entries: WorkingMemoryEntry[] = [];
let maxEntries = 7;
let summaryMaxLength = 200;

// ── Initialization ──────────────────────────────────────────────────

export function initWorkingMemoryStorage(workspaceDir: string, config: BrainAgentConfig): void {
  storageDir = join(workspaceDir, ".brainagent", "working-memory");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  maxEntries = config.workingMemory.maxEntries;
  summaryMaxLength = config.workingMemory.summaryMaxLength;
  loadState();
}

function loadState(): void {
  if (!storageDir) return;
  try {
    const path = join(storageDir, "state.json");
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, "utf-8")) as WorkingMemoryEntry[];
      entries = Array.isArray(data) ? data : [];
    }
  } catch {
    entries = [];
  }
}

function persistState(): void {
  if (!storageDir) return;
  try {
    writeFileSync(join(storageDir, "state.json"), JSON.stringify(entries, null, 2), "utf-8");
  } catch {
    /* non-critical */
  }
}

// ── Core API ────────────────────────────────────────────────────────

/** Store a completed cycle summary into the ring buffer. */
export function storeCompletedCycle(entry: WorkingMemoryEntry): void {
  entries.push(entry);

  // Ring buffer eviction
  while (entries.length > maxEntries) {
    entries.shift();
  }

  persistState();

  bus.emitSync("working-memory:entry-added", {
    entryIndex: entries.length - 1,
    cycleInput: entry.inputSnippet,
  });
}

/**
 * Build a context string from recent cycle summaries for injection
 * into the LLM prompt. Returns undefined if the buffer is empty.
 */
export function buildWorkingMemoryContext(currentInput: string): string | undefined {
  if (entries.length === 0) return undefined;

  const lines: string[] = [
    "## Recent Conversation Thread (Working Memory)",
    `Last ${entries.length} interaction(s):`,
  ];

  for (const entry of entries) {
    const emotionTag = entry.emotion !== "neutral" ? ` [${entry.emotion}]` : "";
    lines.push(
      `- [${entry.domain}/${entry.complexity}]${emotionTag} User: "${entry.inputSnippet}" -> Response quality: ${entry.cerebellumPassed ? "good" : "had issues"}`,
    );
  }

  bus.emitSync("working-memory:context-built", { entriesUsed: entries.length });

  return lines.join("\n");
}

/** Clear all entries. */
export function clearWorkingMemory(): void {
  entries = [];
  persistState();
}

/** Get diagnostics stats. */
export function getWorkingMemoryStats(): {
  entryCount: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
} {
  return {
    entryCount: entries.length,
    oldestTimestamp: entries.length > 0 ? entries[0].timestamp : null,
    newestTimestamp: entries.length > 0 ? entries[entries.length - 1].timestamp : null,
  };
}

/**
 * Truncate a string to the configured max length.
 * Utility for callers to prepare entry snippets.
 */
export function truncateForWorkingMemory(text: string): string {
  if (text.length <= summaryMaxLength) return text;
  return text.slice(0, summaryMaxLength) + "...";
}
