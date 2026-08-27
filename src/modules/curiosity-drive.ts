/**
 * Curiosity Drive — Knowledge gap tracking and exploration motivation.
 *
 * The dopamine system already marks novelty, but there's no mechanism
 * to proactively seek information. This module tracks knowledge gaps
 * (topics where hippocampus recall returned empty) and occasionally
 * generates curiosity-driven context injections, modulated by
 * serotonin (exploration drive) and acetylcholine (learning readiness).
 *
 * v0.6.9: фабрика createCuriosityDrive() с per-instance состоянием;
 * свободные функции — тонкие обёртки над слотом активного инстанса.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWrite } from "./persist.ts";
import { bus } from "./event-bus.ts";
import type { BrainAgentConfig, KnowledgeGap, MessageDomain } from "./types.ts";

export interface CuriosityDriveInstance {
  detectKnowledgeGap: (
    topic: string,
    domain: MessageDomain,
    recallWasEmpty: boolean,
    predictionConfidence?: number,
  ) => void;
  buildCuriosityContext: (serotoninLevel: number, acetylcholineLevel: number) => string | undefined;
  markGapFilled: (topic: string) => void;
  getStats: () => {
    openGaps: number;
    totalDetected: number;
    questionsGenerated: number;
    gapsFilled: number;
  };
  getOpenGaps: () => KnowledgeGap[];
  stop: () => void;
}

/**
 * Create a Curiosity Drive instance with its own state.
 *
 * Пустой workspaceDir = detached-режим: состояние живёт в памяти,
 * диск не трогается (в точности поведение модуля до init).
 */
export function createCuriosityDrive(
  workspaceDir: string,
  config?: BrainAgentConfig,
): CuriosityDriveInstance {
  // ── State ─────────────────────────────────────────────────────────
  const storageDir = workspaceDir ? join(workspaceDir, ".brainagent", "curiosity") : "";
  const gaps: KnowledgeGap[] = [];
  let totalDetected = 0;
  let questionsGenerated = 0;
  let gapsFilled = 0;
  let maxGaps = config?.curiosity?.maxGaps ?? 15;
  let minGapConfidence = config?.curiosity?.minGapConfidence ?? 0.3;
  let askProbability = config?.curiosity?.askProbability ?? 0.1;
  let idCounter = 0;

  // ── Persistence helpers ───────────────────────────────────────────

  function loadState(): void {
    if (!storageDir) return;
    try {
      const path = join(storageDir, "state.json");
      if (existsSync(path)) {
        const data = JSON.parse(readFileSync(path, "utf-8")) as {
          gaps: KnowledgeGap[];
          totalDetected: number;
          questionsGenerated: number;
          gapsFilled: number;
        };
        gaps.length = 0;
        gaps.push(...(data.gaps ?? []));
        totalDetected = data.totalDetected ?? 0;
        questionsGenerated = data.questionsGenerated ?? 0;
        gapsFilled = data.gapsFilled ?? 0;
      }
    } catch {
      /* fresh start */
    }
  }

  function persistState(): void {
    if (!storageDir) return;
    try {
      atomicWrite(
        join(storageDir, "state.json"),
        JSON.stringify(
          { gaps: gaps.slice(-maxGaps * 2), totalDetected, questionsGenerated, gapsFilled },
          null,
          2,
        ),
      );
    } catch {
      /* non-critical */
    }
  }

  // ── Core API ──────────────────────────────────────────────────────

  /**
   * Detect a knowledge gap when hippocampus recall is empty
   * or prediction confidence is low for a topic.
   */
  function detectKnowledgeGap(
    topic: string,
    domain: MessageDomain,
    recallWasEmpty: boolean,
    predictionConfidence?: number,
  ): void {
    const isLowConfidence =
      predictionConfidence !== undefined && predictionConfidence < minGapConfidence;
    if (!recallWasEmpty && !isLowConfidence) {
      return;
    }

    const topicLower = topic.toLowerCase();

    // Check for existing gap on this topic
    const existing = gaps.find(
      (g) => g.topic.toLowerCase() === topicLower && g.status === "open",
    );
    if (existing) {
      existing.timesEncountered++;
      existing.lastEncountered = Date.now();
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      persistState();
      return;
    }

    // Create new gap
    const confidence = recallWasEmpty ? 0.7 : 0.4;
    if (confidence < minGapConfidence) return;

    const gap: KnowledgeGap = {
      id: `gap_${Date.now()}_${++idCounter}`,
      topic,
      domain,
      confidence,
      discoveredAt: Date.now(),
      timesEncountered: 1,
      lastEncountered: Date.now(),
      status: "open",
    };

    gaps.push(gap);
    totalDetected++;

    // Enforce limit: remove oldest low-confidence gaps
    const openGaps = gaps.filter((g) => g.status === "open");
    if (openGaps.length > maxGaps) {
      openGaps.sort((a, b) => a.confidence - b.confidence);
      openGaps[0].status = "filled"; // Drop weakest
    }

    persistState();

    bus.emitSync("curiosity:gap-detected", { topic, domain });
  }

  /**
   * Build a curiosity-driven context injection.
   * Modulated by serotonin (exploration) and acetylcholine (learning).
   * Only triggers probabilistically.
   */
  function buildCuriosityContext(
    serotoninLevel: number,
    _acetylcholineLevel: number,
  ): string | undefined {
    const openGaps = gaps.filter((g) => g.status === "open");
    if (openGaps.length === 0) return undefined;

    // Modulate ask probability by serotonin (high = more exploratory)
    const effectiveProbability = askProbability * serotoninLevel * 2;
    if (Math.random() > effectiveProbability) return undefined;

    // Pick the most encountered gap
    openGaps.sort((a, b) => b.timesEncountered - a.timesEncountered);
    const gap = openGaps[0];

    questionsGenerated++;
    persistState();

    const question = `I notice we haven't discussed "${gap.topic}" in detail. If relevant, I'd like to learn more about this topic to better assist you.`;

    bus.emitSync("curiosity:question-generated", {
      topic: gap.topic,
      question,
    });

    return `## Curiosity Note\n${question}`;
  }

  /** Mark a gap as filled when relevant information is learned. */
  function markGapFilled(topic: string): void {
    const topicLower = topic.toLowerCase();
    for (const gap of gaps) {
      if (gap.status === "open" && gap.topic.toLowerCase() === topicLower) {
        gap.status = "filled";
        gapsFilled++;
      }
    }
    persistState();
  }

  /** Get diagnostics stats. */
  function getStats() {
    return {
      openGaps: gaps.filter((g) => g.status === "open").length,
      totalDetected,
      questionsGenerated,
      gapsFilled,
    };
  }

  /** Get all currently open knowledge gaps. */
  function getOpenGaps(): KnowledgeGap[] {
    return gaps.filter((g) => g.status === "open");
  }

  /** Stop the instance: clear in-memory state. */
  function stop(): void {
    gaps.length = 0;
    totalDetected = 0;
    questionsGenerated = 0;
    gapsFilled = 0;
    idCounter = 0;
  }

  // Фабрика с непустым workspaceDir готовит директорию и грузит состояние
  // (эквивалент initCuriosityDrive) — как в исходном модуле после init.
  if (storageDir) {
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }
    if (config) {
      maxGaps = config.curiosity.maxGaps;
      minGapConfidence = config.curiosity.minGapConfidence;
      askProbability = config.curiosity.askProbability;
    }
    loadState();
  }

  return {
    detectKnowledgeGap,
    buildCuriosityContext,
    markGapFilled,
    getStats,
    getOpenGaps,
    stop,
  };
}

// ── Active instance slot + тонкие обёртки (внешний API сохранён) ────

let active: CuriosityDriveInstance | null = null;

function current(): CuriosityDriveInstance {
  // Detached-инстанс с пустым dir: состояние в памяти, диск не трогается —
  // в точности поведение модульных переменных до init.
  if (!active) active = createCuriosityDrive("");
  return active;
}

export function initCuriosityDrive(workspaceDir: string, config: BrainAgentConfig): void {
  active?.stop();
  active = createCuriosityDrive(workspaceDir, config);
}

/**
 * v0.9.23: тема пробела знаний — очищенная фраза, а не сырой ввод.
 * Возвращает null, если реплика не несёт познавательного содержания:
 * приветствия, команды-напоминания, короткие подтверждения. Из запросов
 * напоминаний вырезается каркас («напомни через 2 минуты, что …»).
 */
export function extractGapTopic(input: string): string | null {
  const text = input.trim();
  if (text.length < 4) return null;

  const NOISE_RE = [
    /^(привет|здравствуй|хай|добрый\s+(день|вечер|утро)|хеллоу)[\s!,.?]/i,
    /^(hi|hello|hey)[\s!,.?]/i,
    /как\s+(дела|ты|настроение)/i,
  ];
  // \b в JS-регэкспах не работает с кириллицей — пробельные якоря вместо него
  const REMINDER_COMMAND_RE =
    /(поставь|создай)?\s*(напоминание|напомни)\s.*(через|в)\s/i;

  let candidate = text;
  if (REMINDER_COMMAND_RE.test(candidate)) {
    const commaIdx = candidate.indexOf(",");
    const colonIdx = candidate.indexOf(":");
    const dashIdx = candidate.indexOf("—");
    const idx = [commaIdx, colonIdx, dashIdx].find((i) => i > 0) ?? -1;
    if (idx === -1) return null; // чистая команда-напоминание — не пробел знаний
    candidate = candidate.slice(idx + 1).trim();
    // каркас вырезан — убираем стартовый союз («что», «чтобы»)
    candidate = candidate.replace(/^(что|чтобы)\s+/i, "").trim();
  }

  if (candidate.length < 4) return null;
  if (NOISE_RE.some((re) => re.test(candidate))) return null;

  // Обрезаем по границе предложения и чистим хвостовую пунктуацию
  let clean = candidate.replace(/[.!?…]+\s*$/g, "").trim();
  const sentenceEnd = clean.search(/[.!?]/);
  if (sentenceEnd > 0 && sentenceEnd < clean.length - 1) {
    clean = clean.slice(0, sentenceEnd).trim();
  }
  if (clean.length > 100) clean = clean.slice(0, 100).trim();
  if (clean.length < 4) return null;
  return clean;
}

export function detectKnowledgeGap(
  topic: string,
  domain: MessageDomain,
  recallWasEmpty: boolean,
  predictionConfidence?: number,
): void {
  current().detectKnowledgeGap(topic, domain, recallWasEmpty, predictionConfidence);
}

export function buildCuriosityContext(
  serotoninLevel: number,
  _acetylcholineLevel: number,
): string | undefined {
  return current().buildCuriosityContext(serotoninLevel, _acetylcholineLevel);
}

export function markGapFilled(topic: string): void {
  current().markGapFilled(topic);
}

export function getCuriosityStats(): {
  openGaps: number;
  totalDetected: number;
  questionsGenerated: number;
  gapsFilled: number;
} {
  return current().getStats();
}

export function getOpenGaps(): KnowledgeGap[] {
  return current().getOpenGaps();
}

/** Симметричная остановка (освобождает состояние активного инстанса). */
export function stopCuriosityDrive(): void {
  active?.stop();
  active = null;
}
