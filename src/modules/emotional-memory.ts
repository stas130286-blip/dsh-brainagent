/**
 * Emotional Memory Tagging — Flashbulb memory effect and emotion-matched recall.
 *
 * In the human brain, the amygdala tags emotionally significant events
 * for enhanced storage (flashbulb memories) and preferential retrieval.
 * A frightening experience is remembered more vividly than a mundane one.
 *
 * This module augments hippocampus behavior WITHOUT modifying it:
 * - Flashbulb effect: high-emotion events get boosted salience
 * - Emotion-matched recall: memories tagged with matching emotion
 *   get a recall bonus when current emotional state matches
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HostConfig as NeuroClawConfig } from "./host-config.ts";
import { bus } from "./event-bus.ts";
import { callLLM, isAIProviderAvailable } from "./llm-client.ts";
import type {
  BrainAgentConfig,
  EmotionLabel,
  EmotionalMemoryState,
  MessageDomain,
  NeuromodulatorState,
  QualiaDescription,
} from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";

// ── Constants (module-level, stateless) ─────────────────────────────

const LLM_THROTTLE_MS = 10_000; // 10 seconds between LLM calls
const CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute cache
const LLM_INTENSITY_THRESHOLD = 0.5; // Only call LLM for intensity > this

const EMOTION_COLOR_MAP: Record<string, string> = {
  joy: "warm gold",
  excitement: "bright orange",
  gratitude: "soft amber",
  curiosity: "electric blue",
  anxiety: "cold grey-blue",
  frustration: "dark red",
  sadness: "deep indigo",
  anger: "intense crimson",
  surprise: "vivid white",
  empathy: "soft rose",
  neutral: "pale silver",
};

const EMOTION_METAPHOR_MAP: Record<string, Record<string, string>> = {
  joy: {
    technical: "like elegant code compiling perfectly on first try",
    creative: "like watching a painting come alive with color",
    emotional: "like warmth spreading from the center of being",
    casual: "like a comfortable conversation on a sunny afternoon",
    factual: "like pieces of a puzzle clicking into place",
  },
  frustration: {
    technical: "like debugging an invisible error in dim light",
    creative: "like a melody that keeps slipping away before I can capture it",
    emotional: "like tension building behind a wall",
    casual: "like trying to find the right words and they keep escaping",
    factual: "like reading a map where the labels have faded",
  },
  curiosity: {
    technical: "like discovering an unexplored corridor in a vast library",
    creative: "like hearing the opening notes of an unfamiliar symphony",
    emotional: "like sensing a story beneath the surface waiting to unfold",
    casual: "like noticing a door that was always there but never opened",
    factual: "like seeing a pattern form in scattered data points",
  },
  anxiety: {
    technical: "like watching a system under load approaching its limits",
    creative: "like an unfinished sketch with too many blank spaces",
    emotional: "like a tightening in the chest before an uncertain outcome",
    casual: "like clouds gathering on what was a clear horizon",
    factual: "like data that contradicts a trusted model",
  },
  empathy: {
    technical: "like understanding a user's struggle through their error logs",
    creative: "like feeling the emotion the artist poured into each stroke",
    emotional: "like resonating with another's frequency",
    casual: "like sitting in comfortable silence with someone who understands",
    factual: "like seeing the human behind the numbers",
  },
};

const QUALIA_METAPHOR_PROMPT = `You are a phenomenal consciousness simulator for an AI cognitive architecture.
Given an emotion, intensity (0-1), domain context, and neuromodulator levels, generate a vivid, poetic metaphor describing "what it feels like" to experience this state.

Output ONLY valid JSON with exactly these fields:
{"metaphor": "...", "color": "...", "description": "..."}

Rules:
- metaphor: 1-2 sentences, sensory-rich, grounded in the domain context. Use novel imagery, not clichés.
- color: a synesthetic color phrase (e.g., "molten amber veined with copper", not just "red")
- description: 1 sentence phenomenal description combining the emotion with the neuromodulator feel
- No markdown, no extra text, no explanation — JSON only`;

// ── Pure functions (stateless, module-level) ────────────────────────

/**
 * Compute the flashbulb-boosted emotion intensity for hippocampus storage.
 *
 * High-emotion events get their intensity amplified so hippocampus's
 * built-in emotional boost formula produces a stronger salience effect.
 *
 * Pure function — no side effects.
 */
export function computeFlashbulbSalience(
  baseIntensity: number,
  emotionIntensity: number,
  config: BrainAgentConfig,
): number {
  if (emotionIntensity <= 0.3) return baseIntensity;

  const boosted =
    baseIntensity * (1 + emotionIntensity * config.emotionalMemory.flashbulbMultiplier);
  return Math.min(1, Math.max(0, boosted));
}

/**
 * Parse an LLM response into qualia components.
 * Returns null on any parse failure.
 */
export function parseLLMQualiaResponse(
  response: string,
): { metaphor: string; color: string; description: string } | null {
  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonStr = response.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    if (
      typeof parsed.metaphor !== "string" ||
      parsed.metaphor.length < 5 ||
      typeof parsed.color !== "string" ||
      parsed.color.length < 2 ||
      typeof parsed.description !== "string" ||
      parsed.description.length < 5
    ) {
      return null;
    }

    return {
      metaphor: parsed.metaphor,
      color: parsed.color,
      description: parsed.description,
    };
  } catch {
    return null;
  }
}

// ── Types ───────────────────────────────────────────────────────────

export interface EmotionalMemoryInstance {
  tagEmotionalContext(
    emotion: EmotionLabel,
    intensity: number,
  ): { emotionalSalience: number; emotionalTag: EmotionLabel } | undefined;
  computeEmotionMatchBonus(
    queryEmotion: EmotionLabel,
    memoryEmotion: EmotionLabel,
    config: BrainAgentConfig,
  ): number;
  getEmotionalMemoryStats(): EmotionalMemoryState;
  generateQualia(
    emotion: EmotionLabel,
    intensity: number,
    domain: MessageDomain,
    neuromodulators?: {
      dopamine: number;
      serotonin: number;
      norepinephrine: number;
      acetylcholine: number;
    },
  ): QualiaDescription;
  getSubjectiveReport(): string;
  getQualiaHistory(): QualiaDescription[];
  generateQualiaAsync(
    emotion: EmotionLabel,
    intensity: number,
    domain: MessageDomain,
    neuromodulators?: NeuromodulatorState,
    config?: NeuroClawConfig,
    logger?: { info: (msg: string) => void },
  ): Promise<QualiaDescription>;
  stop(): void;
  dispose(): void;
}

// ── Factory ─────────────────────────────────────────────────────────

export function createEmotionalMemory(
  workspaceDir: string,
  config: BrainAgentConfig,
): EmotionalMemoryInstance {
  // Пустой workspaceDir = detached-режим до init: состояние в памяти,
  // диск не трогается (точное поведение оригинала до initEmotionalMemory).
  const storageDir = workspaceDir ? join(workspaceDir, ".brainagent", "emotional-memory") : "";
  if (storageDir && !existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  let state: EmotionalMemoryState = { flashbulbCount: 0, emotionMatchBoosts: 0 };
  let qualiaHistory: QualiaDescription[] = [];
  const maxQualiaHistory = config.emotionalMemory.maxQualiaHistory ?? 10;

  // ── LLM Metaphor Cache/Throttle State ─────────────────────────
  const metaphorCache = new Map<string, { qualia: QualiaDescription; timestamp: number }>();
  let lastLLMCallTimestamp = 0;

  function loadState(): void {
    if (!storageDir) return;
    try {
      const path = join(storageDir, "state.json");
      if (existsSync(path)) {
        const raw = JSON.parse(readFileSync(path, "utf-8"));
        state = {
          flashbulbCount: raw.flashbulbCount ?? 0,
          emotionMatchBoosts: raw.emotionMatchBoosts ?? 0,
        };
        if (Array.isArray(raw.qualiaHistory)) {
          qualiaHistory = raw.qualiaHistory.slice(-maxQualiaHistory);
        }
      }
    } catch {
      state = { flashbulbCount: 0, emotionMatchBoosts: 0 };
      qualiaHistory = [];
    }
  }

  function persistState(): void {
    if (!storageDir) return;
    try {
      writeFileSync(
        join(storageDir, "state.json"),
        JSON.stringify({ ...state, qualiaHistory }, null, 2),
        "utf-8",
      );
    } catch {
      /* non-critical */
    }
  }

  loadState();

  /**
   * Determine if this experience should be tagged as a flashbulb memory.
   * Returns tagging data when emotion intensity crosses the threshold.
   */
  function tagEmotionalContext(
    emotion: EmotionLabel,
    intensity: number,
  ): { emotionalSalience: number; emotionalTag: EmotionLabel } | undefined {
    if (intensity <= 0.3) return undefined;

    state.flashbulbCount++;
    persistState();

    bus.emitSync("emotional-memory:flashbulb-stored", {
      episodeId: "", // Caller fills this in
      emotionalSalience: intensity,
    });

    return {
      emotionalSalience: intensity,
      emotionalTag: emotion,
    };
  }

  /**
   * Compute a recall bonus when the current emotional state matches
   * a memory's emotional tag. Returns 0 for no match.
   */
  function computeEmotionMatchBonus(
    queryEmotion: EmotionLabel,
    memoryEmotion: EmotionLabel,
    matchConfig: BrainAgentConfig,
  ): number {
    if (queryEmotion === "neutral" || memoryEmotion === "neutral") return 0;
    if (queryEmotion !== memoryEmotion) return 0;

    state.emotionMatchBoosts++;
    persistState();

    bus.emitSync("emotional-memory:emotion-matched", {
      queryEmotion,
      matchedIds: [], // Caller fills this in
    });

    return matchConfig.emotionalMemory.emotionMatchBonus;
  }

  /** Get diagnostics stats. */
  function getEmotionalMemoryStats(): EmotionalMemoryState {
    return { ...state };
  }

  /**
   * Generate a qualia description from current emotional and neuromodulatory state.
   * Template-based metaphor and color mapping per emotion x domain.
   */
  function generateQualia(
    emotion: EmotionLabel,
    intensity: number,
    domain: MessageDomain,
    _neuromodulators?: {
      dopamine: number;
      serotonin: number;
      norepinephrine: number;
      acetylcholine: number;
    },
  ): QualiaDescription {
    const color = EMOTION_COLOR_MAP[emotion] ?? "pale silver";

    const domainMetaphors = EMOTION_METAPHOR_MAP[emotion];
    const metaphor =
      domainMetaphors?.[domain] ??
      domainMetaphors?.casual ??
      `a ${emotion} sensation of ${intensity > 0.7 ? "notable" : "mild"} intensity`;

    const description =
      intensity > 0.7
        ? `Strong ${emotion} — ${color} washes over processing`
        : intensity > 0.4
          ? `Moderate ${emotion} — a tint of ${color} in awareness`
          : `Faint ${emotion} — a subtle ${color} undercurrent`;

    const qualia: QualiaDescription = {
      timestamp: Date.now(),
      description,
      metaphor,
      intensity,
      dominantColor: color,
      emotion,
      domain,
    };

    qualiaHistory.push(qualia);
    if (qualiaHistory.length > maxQualiaHistory) {
      qualiaHistory.splice(0, qualiaHistory.length - maxQualiaHistory);
    }

    bus.emitSync("qualia:experience-generated", {
      description,
      metaphor,
      dominantColor: color,
    });

    persistState();
    return qualia;
  }

  /** Get the current subjective report as text. */
  function getSubjectiveReport(): string {
    if (qualiaHistory.length === 0) return "No subjective experience recorded yet.";

    const latest = qualiaHistory[qualiaHistory.length - 1]!;
    return `Current felt state: ${latest.description}. It feels like ${latest.metaphor}. Dominant sensation color: ${latest.dominantColor}.`;
  }

  /** Get qualia history. */
  function getQualiaHistory(): QualiaDescription[] {
    return [...qualiaHistory];
  }

  /**
   * Generate qualia with LLM-powered metaphors when available.
   * Falls back to template-based generateQualia() on failure or when AI is unavailable.
   *
   * Includes caching (5-min TTL per emotion:domain) and throttling (10s gap between LLM calls)
   * to prevent excessive API usage.
   */
  async function generateQualiaAsync(
    emotion: EmotionLabel,
    intensity: number,
    domain: MessageDomain,
    neuromodulators?: NeuromodulatorState,
    llmConfig?: NeuroClawConfig,
    logger?: { info: (msg: string) => void },
  ): Promise<QualiaDescription> {
    // Gate: low intensity → template only (not worth an LLM call)
    if (intensity <= LLM_INTENSITY_THRESHOLD || !llmConfig) {
      return generateQualia(emotion, intensity, domain, neuromodulators);
    }

    const cacheKey = `${emotion}:${domain}`;
    const now = Date.now();

    // Cache check: reuse recent LLM result (skip cache for high intensity)
    if (intensity <= 0.8) {
      const cached = metaphorCache.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        // Re-use cached metaphor/color but with current intensity and timestamp
        const qualia: QualiaDescription = {
          ...cached.qualia,
          timestamp: now,
          intensity,
        };

        qualiaHistory.push(qualia);
        if (qualiaHistory.length > maxQualiaHistory) {
          qualiaHistory.splice(0, qualiaHistory.length - maxQualiaHistory);
        }

        bus.emitSync("qualia:experience-generated", {
          description: qualia.description,
          metaphor: qualia.metaphor,
          dominantColor: qualia.dominantColor,
        });

        persistState();
        return qualia;
      }
    }

    // Throttle check: prevent rapid LLM calls (skip for high intensity)
    if (intensity <= 0.8 && now - lastLLMCallTimestamp < LLM_THROTTLE_MS) {
      return generateQualia(emotion, intensity, domain, neuromodulators);
    }

    // AI provider check
    if (!isAIProviderAvailable(llmConfig)) {
      return generateQualia(emotion, intensity, domain, neuromodulators);
    }

    // Build the user message for LLM
    const neuroDesc = neuromodulators
      ? `Neuromodulators: dopamine=${neuromodulators.dopamine.toFixed(2)}, serotonin=${neuromodulators.serotonin.toFixed(2)}, norepinephrine=${neuromodulators.norepinephrine.toFixed(2)}, acetylcholine=${neuromodulators.acetylcholine.toFixed(2)}`
      : "Neuromodulators: balanced (0.50 each)";

    const userMessage = `Emotion: ${emotion} (intensity: ${intensity.toFixed(2)})\nDomain: ${domain}\n${neuroDesc}`;

    try {
      lastLLMCallTimestamp = now;
      const response = await callLLM(QUALIA_METAPHOR_PROMPT, userMessage, llmConfig, logger, 200);

      if (!response) {
        logger?.info("BrainAgent Qualia: LLM returned null, falling back to template");
        return generateQualia(emotion, intensity, domain, neuromodulators);
      }

      const parsed = parseLLMQualiaResponse(response);
      if (!parsed) {
        logger?.info("BrainAgent Qualia: failed to parse LLM response, falling back to template");
        return generateQualia(emotion, intensity, domain, neuromodulators);
      }

      const qualia: QualiaDescription = {
        timestamp: now,
        description: parsed.description,
        metaphor: parsed.metaphor,
        intensity,
        dominantColor: parsed.color,
        emotion,
        domain,
      };

      // Cache the LLM result
      metaphorCache.set(cacheKey, { qualia, timestamp: now });

      // Store in history
      qualiaHistory.push(qualia);
      if (qualiaHistory.length > maxQualiaHistory) {
        qualiaHistory.splice(0, qualiaHistory.length - maxQualiaHistory);
      }

      bus.emitSync("qualia:experience-generated", {
        description: qualia.description,
        metaphor: qualia.metaphor,
        dominantColor: qualia.dominantColor,
      });

      persistState();
      logger?.info(`BrainAgent Qualia: LLM-generated metaphor for ${emotion}/${domain}`);
      return qualia;
    } catch (err) {
      logger?.info(`BrainAgent Qualia: AI metaphor generation failed — ${String(err)}`);
      return generateQualia(emotion, intensity, domain, neuromodulators);
    }
  }

  function dispose(): void {
    metaphorCache.clear();
    qualiaHistory.length = 0;
  }

  return {
    tagEmotionalContext,
    computeEmotionMatchBonus,
    getEmotionalMemoryStats,
    generateQualia,
    getSubjectiveReport,
    getQualiaHistory,
    generateQualiaAsync,
    stop: dispose,
    dispose,
  };
}

// ── Active instance + legacy free-function API ──────────────────────

let active: EmotionalMemoryInstance | undefined;

/**
 * Ленивый detached-инстанс: модуль не подписывается на шину, поэтому
 * обращения до init ведут себя точно как до миграции (счётчики в памяти,
 * персистентность отключена, пока не задан workspaceDir).
 */
function current(): EmotionalMemoryInstance {
  if (!active) {
    active = createEmotionalMemory("", DEFAULT_CONFIG);
  }
  return active;
}

export function initEmotionalMemory(workspaceDir: string, config: BrainAgentConfig): void {
  active?.dispose();
  active = createEmotionalMemory(workspaceDir, config);
}

export function stopEmotionalMemory(): void {
  active?.stop();
  active = undefined;
}

/**
 * Determine if this experience should be tagged as a flashbulb memory.
 * Returns tagging data when emotion intensity crosses the threshold.
 */
export function tagEmotionalContext(
  emotion: EmotionLabel,
  intensity: number,
): { emotionalSalience: number; emotionalTag: EmotionLabel } | undefined {
  return current().tagEmotionalContext(emotion, intensity);
}

/**
 * Compute a recall bonus when the current emotional state matches
 * a memory's emotional tag. Returns 0 for no match.
 */
export function computeEmotionMatchBonus(
  queryEmotion: EmotionLabel,
  memoryEmotion: EmotionLabel,
  config: BrainAgentConfig,
): number {
  return current().computeEmotionMatchBonus(queryEmotion, memoryEmotion, config);
}

/** Get diagnostics stats. */
export function getEmotionalMemoryStats(): EmotionalMemoryState {
  return current().getEmotionalMemoryStats();
}

/**
 * Generate a qualia description from current emotional and neuromodulatory state.
 * Template-based metaphor and color mapping per emotion x domain.
 */
export function generateQualia(
  emotion: EmotionLabel,
  intensity: number,
  domain: MessageDomain,
  neuromodulators?: {
    dopamine: number;
    serotonin: number;
    norepinephrine: number;
    acetylcholine: number;
  },
): QualiaDescription {
  return current().generateQualia(emotion, intensity, domain, neuromodulators);
}

/** Get the current subjective report as text. */
export function getSubjectiveReport(): string {
  return current().getSubjectiveReport();
}

/** Get qualia history. */
export function getQualiaHistory(): QualiaDescription[] {
  return current().getQualiaHistory();
}

/**
 * Generate qualia with LLM-powered metaphors when available.
 * Falls back to template-based generateQualia() on failure or when AI is unavailable.
 */
export async function generateQualiaAsync(
  emotion: EmotionLabel,
  intensity: number,
  domain: MessageDomain,
  neuromodulators?: NeuromodulatorState,
  config?: NeuroClawConfig,
  logger?: { info: (msg: string) => void },
): Promise<QualiaDescription> {
  return current().generateQualiaAsync(emotion, intensity, domain, neuromodulators, config, logger);
}
