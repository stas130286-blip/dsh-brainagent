/**
 * Cross-Session Context Bridge — Continuity between sessions.
 *
 * When a user returns after a gap (e.g., 30+ minutes), the system
 * needs to know what happened last time. This module tracks the
 * current session, detects gaps, and injects the previous session's
 * summary into the prompt for seamless continuity.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bus } from "./event-bus.ts";
import type {
  AmygdalaAssessment,
  BrainAgentConfig,
  EmotionLabel,
  SessionSummary,
  ThalamusClassification,
} from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";

// ── Types ───────────────────────────────────────────────────────────

interface RunningSession {
  startedAt: number;
  topicCounts: Record<string, number>;
  emotions: Array<{ emotion: EmotionLabel; intensity: number }>;
  cycleCount: number;
  totalReward: number;
  questions: string[];
  lastInput: string;
}

export interface SessionBridgeInstance {
  recordCycleForSession(
    input: string,
    classification?: ThalamusClassification,
    assessment?: AmygdalaAssessment,
    reward?: number,
  ): void;
  checkSessionGap(): SessionSummary | undefined;
  buildSessionBridgeContext(): string | undefined;
  forceSessionEnd(): SessionSummary | undefined;
  getSessionBridgeStats(): {
    currentCycles: number;
    lastSessionTopics: string[];
    gapDetected: boolean;
  };
  stop(): void;
  dispose(): void;
}

// ── Helpers ─────────────────────────────────────────────────────────

function createFreshSession(): RunningSession {
  return {
    startedAt: Date.now(),
    topicCounts: {} as Record<string, number>,
    emotions: [] as Array<{ emotion: EmotionLabel; intensity: number }>,
    cycleCount: 0,
    totalReward: 0,
    questions: [] as string[],
    lastInput: "",
  };
}

// ── Factory ─────────────────────────────────────────────────────────

export function createSessionBridge(
  workspaceDir: string,
  config: BrainAgentConfig,
  _logger?: { info: (msg: string) => void },
): SessionBridgeInstance {
  // Пустой workspaceDir = detached-режим до init: состояние в памяти,
  // диск не трогается (точное поведение оригинала до initSessionBridge).
  const storageDir = workspaceDir ? join(workspaceDir, ".brainagent", "sessions") : "";
  if (storageDir && !existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  const gapThresholdMs = config.sessionBridge.gapThresholdMs;
  const maxSummaryTopics = config.sessionBridge.maxSummaryTopics;

  /** Timestamp of the last interaction */
  let lastInteractionTime = Date.now();

  /** Running session accumulator */
  let currentSession: RunningSession = createFreshSession();

  /** The completed previous session */
  let lastSession: SessionSummary | null = null;

  /** Whether a gap was just detected (inject once) */
  let gapJustDetected = false;

  function loadState(): void {
    if (!storageDir) return;
    try {
      const currentPath = join(storageDir, "current.json");
      if (existsSync(currentPath)) {
        const data = JSON.parse(readFileSync(currentPath, "utf-8"));
        if (data && typeof data.startedAt === "number") {
          currentSession = data;
        }
      }
    } catch {
      /* fresh start */
    }
    try {
      const lastPath = join(storageDir, "last.json");
      if (existsSync(lastPath)) {
        lastSession = JSON.parse(readFileSync(lastPath, "utf-8")) as SessionSummary;
      }
    } catch {
      /* fresh start */
    }
  }

  function persistCurrent(): void {
    if (!storageDir) return;
    try {
      writeFileSync(
        join(storageDir, "current.json"),
        JSON.stringify(currentSession, null, 2),
        "utf-8",
      );
    } catch {
      /* non-critical */
    }
  }

  function persistLast(): void {
    if (!storageDir) return;
    try {
      writeFileSync(join(storageDir, "last.json"), JSON.stringify(lastSession, null, 2), "utf-8");
    } catch {
      /* non-critical */
    }
  }

  function buildSummaryFromCurrent(endTime: number): SessionSummary {
    // Extract top topics by frequency
    const sortedTopics = Object.entries(currentSession.topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxSummaryTopics)
      .map(([topic]) => topic);

    const avgReward =
      currentSession.cycleCount > 0 ? currentSession.totalReward / currentSession.cycleCount : 0;

    // Last few questions as "unresolved"
    const unresolvedQuestions = currentSession.questions.slice(-3);

    return {
      sessionStartedAt: currentSession.startedAt,
      sessionEndedAt: endTime,
      topicsDiscussed: sortedTopics,
      unresolvedQuestions,
      emotionalArc: currentSession.emotions.slice(-10),
      cycleCount: currentSession.cycleCount,
      avgReward,
      lastInputSummary: currentSession.lastInput,
    };
  }

  loadState();
  lastInteractionTime = Date.now();

  /** Record data from a completed cycle into the current session. */
  function recordCycleForSession(
    input: string,
    classification?: ThalamusClassification,
    assessment?: AmygdalaAssessment,
    reward?: number,
  ): void {
    currentSession.cycleCount++;
    currentSession.lastInput = input.length > 200 ? input.slice(0, 200) + "..." : input;

    if (classification) {
      currentSession.topicCounts[classification.domain] =
        (currentSession.topicCounts[classification.domain] ?? 0) + 1;
    }

    if (assessment) {
      currentSession.emotions.push({
        emotion: assessment.emotion,
        intensity: assessment.emotionIntensity,
      });
      // Keep bounded
      if (currentSession.emotions.length > 50) {
        currentSession.emotions = currentSession.emotions.slice(-50);
      }
    }

    if (reward !== undefined) {
      currentSession.totalReward += reward;
    }

    // Detect questions in input
    if (input.includes("?")) {
      const q = input.length > 100 ? input.slice(0, 100) + "..." : input;
      currentSession.questions.push(q);
      if (currentSession.questions.length > 10) {
        currentSession.questions = currentSession.questions.slice(-10);
      }
    }

    lastInteractionTime = Date.now();
    persistCurrent();
  }

  /**
   * Check if there's been a gap since the last interaction.
   * If so, finalize the current session and return its summary.
   */
  function checkSessionGap(): SessionSummary | undefined {
    const now = Date.now();
    const gap = now - lastInteractionTime;

    if (gap < gapThresholdMs || currentSession.cycleCount === 0) {
      lastInteractionTime = now;
      return undefined;
    }

    // Finalize current session into a summary
    const summary = buildSummaryFromCurrent(now);
    lastSession = summary;
    persistLast();

    // Reset for new session
    currentSession = createFreshSession();
    persistCurrent();

    lastInteractionTime = now;
    gapJustDetected = true;

    bus.emitSync("session:summary-created", summary);
    bus.emitSync("session:resumed", {
      gapMs: gap,
      lastSessionTopics: summary.topicsDiscussed,
    });

    return summary;
  }

  /** Build context injection from the last session summary. */
  function buildSessionBridgeContext(): string | undefined {
    if (!gapJustDetected || !lastSession) return undefined;

    // Only inject once per gap
    gapJustDetected = false;

    const lines: string[] = [
      "## Previous Session Context (Session Bridge)",
      `Last session: ${lastSession.cycleCount} interactions, topics: ${lastSession.topicsDiscussed.join(", ")}`,
    ];

    if (lastSession.unresolvedQuestions.length > 0) {
      lines.push(`Unresolved questions: ${lastSession.unresolvedQuestions.slice(0, 3).join("; ")}`);
    }

    if (lastSession.lastInputSummary) {
      lines.push(`Last discussed: "${lastSession.lastInputSummary}"`);
    }

    return lines.join("\n");
  }

  /** Force session end (e.g., on circadian sleep). */
  function forceSessionEnd(): SessionSummary | undefined {
    if (currentSession.cycleCount === 0) return undefined;

    const summary = buildSummaryFromCurrent(Date.now());
    lastSession = summary;
    persistLast();

    currentSession = createFreshSession();
    persistCurrent();

    bus.emitSync("session:summary-created", summary);
    return summary;
  }

  /** Get diagnostics stats. */
  function getSessionBridgeStats(): {
    currentCycles: number;
    lastSessionTopics: string[];
    gapDetected: boolean;
  } {
    return {
      currentCycles: currentSession.cycleCount,
      lastSessionTopics: lastSession?.topicsDiscussed ?? [],
      gapDetected: gapJustDetected,
    };
  }

  function dispose(): void {
    // No subscriptions/timers — nothing to release.
  }

  return {
    recordCycleForSession,
    checkSessionGap,
    buildSessionBridgeContext,
    forceSessionEnd,
    getSessionBridgeStats,
    stop: dispose,
    dispose,
  };
}

// ── Active instance + legacy free-function API ──────────────────────

let active: SessionBridgeInstance | undefined;

/**
 * Ленивый detached-инстанс: модуль не подписывается на шину, поэтому
 * обращения до init ведут себя точно как до миграции (состояние в памяти,
 * персистентность отключена, пока не задан workspaceDir).
 */
function current(): SessionBridgeInstance {
  if (!active) {
    active = createSessionBridge("", DEFAULT_CONFIG);
  }
  return active;
}

export function initSessionBridge(
  workspaceDir: string,
  config: BrainAgentConfig,
  logger?: { info: (msg: string) => void },
): void {
  active?.dispose();
  active = createSessionBridge(workspaceDir, config, logger);
}

export function stopSessionBridge(): void {
  active?.stop();
  active = undefined;
}

/** Record data from a completed cycle into the current session. */
export function recordCycleForSession(
  input: string,
  classification?: ThalamusClassification,
  assessment?: AmygdalaAssessment,
  reward?: number,
): void {
  current().recordCycleForSession(input, classification, assessment, reward);
}

/**
 * Check if there's been a gap since the last interaction.
 * If so, finalize the current session and return its summary.
 */
export function checkSessionGap(): SessionSummary | undefined {
  return current().checkSessionGap();
}

/** Build context injection from the last session summary. */
export function buildSessionBridgeContext(): string | undefined {
  return current().buildSessionBridgeContext();
}

/** Force session end (e.g., on circadian sleep). */
export function forceSessionEnd(): SessionSummary | undefined {
  return current().forceSessionEnd();
}

/** Get diagnostics stats. */
export function getSessionBridgeStats(): {
  currentCycles: number;
  lastSessionTopics: string[];
  gapDetected: boolean;
} {
  return current().getSessionBridgeStats();
}
