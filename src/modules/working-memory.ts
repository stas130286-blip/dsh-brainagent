/**
 * Working Memory Buffer — Inter-cycle continuity via a ring buffer.
 *
 * The human brain maintains a working memory of ~7 items that persists
 * between thoughts. BrainAgent's BrainState resets each cycle, losing
 * context. This module keeps a ring buffer of recent cycle summaries
 * so each new cycle knows what came before without re-retrieving from
 * hippocampus.
 *
 * v0.6.2 (волна 1 миграции на per-instance состояние, пакет B):
 *  - фабрика `createWorkingMemory()` создаёт инстанс со своим буфером;
 *  - module-level `let` остался один — слот активного инстанса;
 *    обёртки до инициализации лениво используют detached-инстанс
 *    (без персистентности), как раньше работали на состоянии по умолчанию.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWrite } from "./persist.ts";
import { bus } from "./event-bus.ts";
import type { BrainAgentConfig, WorkingMemoryEntry } from "./types.ts";

// ── Константы по умолчанию (для detached-инстанса до инициализации) ─

const DEFAULT_MAX_ENTRIES = 7;
const DEFAULT_SUMMARY_MAX_LENGTH = 200;

// ── Типы ────────────────────────────────────────────────────────────

export type WorkingMemoryInstance = {
  storeCompletedCycle(entry: WorkingMemoryEntry): void;
  buildContext(currentInput: string): string | undefined;
  clear(): void;
  getStats(): {
    entryCount: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  };
  truncate(text: string): string;
};

// ── Фабрика ─────────────────────────────────────────────────────────

export function createWorkingMemory(
  workspaceDir: string,
  opts: { maxEntries: number; summaryMaxLength: number },
): WorkingMemoryInstance {
  const storageDir = workspaceDir ? join(workspaceDir, ".brainagent", "working-memory") : "";
  const maxEntries = opts.maxEntries;
  const summaryMaxLength = opts.summaryMaxLength;
  let entries: WorkingMemoryEntry[] = [];

  if (storageDir && !existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
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
      atomicWrite(join(storageDir, "state.json"), JSON.stringify(entries, null, 2));
    } catch {
      /* non-critical */
    }
  }

  loadState();

  function storeCompletedCycle(entry: WorkingMemoryEntry): void {
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

  function buildContext(_currentInput: string): string | undefined {
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

  function clear(): void {
    entries = [];
    persistState();
  }

  function getStats(): {
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

  function truncate(text: string): string {
    if (text.length <= summaryMaxLength) return text;
    return text.slice(0, summaryMaxLength) + "...";
  }

  return { storeCompletedCycle, buildContext, clear, getStats, truncate };
}

// ── Слот активного инстанса (обратная совместимость) ────────────────

let active: WorkingMemoryInstance | undefined;

/** Инстанс без персистентности — для вызовов до инициализации. */
function current(): WorkingMemoryInstance {
  return (
    active ??
    (active = createWorkingMemory("", {
      maxEntries: DEFAULT_MAX_ENTRIES,
      summaryMaxLength: DEFAULT_SUMMARY_MAX_LENGTH,
    }))
  );
}

// ── Initialization ──────────────────────────────────────────────────

export function initWorkingMemoryStorage(workspaceDir: string, config: BrainAgentConfig): void {
  active = createWorkingMemory(workspaceDir, {
    maxEntries: config.workingMemory.maxEntries,
    summaryMaxLength: config.workingMemory.summaryMaxLength,
  });
}

// ── Core API ────────────────────────────────────────────────────────

/** Store a completed cycle summary into the ring buffer. */
export function storeCompletedCycle(entry: WorkingMemoryEntry): void {
  current().storeCompletedCycle(entry);
}

/**
 * Build a context string from recent cycle summaries for injection
 * into the LLM prompt. Returns undefined if the buffer is empty.
 */
export function buildWorkingMemoryContext(currentInput: string): string | undefined {
  return current().buildContext(currentInput);
}

/** Clear all entries. */
export function clearWorkingMemory(): void {
  current().clear();
}

/** Get diagnostics stats. */
export function getWorkingMemoryStats(): {
  entryCount: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
} {
  return current().getStats();
}

/**
 * Truncate a string to the configured max length.
 * Utility for callers to prepare entry snippets.
 */
export function truncateForWorkingMemory(text: string): string {
  return current().truncate(text);
}
