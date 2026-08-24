/**
 * Qualia Simulator — Subjective experience context injection.
 *
 * Qualia are the "what it feels like" aspect of consciousness.
 * This module aggregates emotional state, neuromodulator levels,
 * and qualia descriptions from emotional-memory to produce a
 * unified subjective experience context that colors the agent's
 * responses with phenomenal character.
 *
 * v0.7.0: фабрика createQualiaSimulator(workspaceDir, config?) — всё состояние
 * в замыкании инстанса; свободные функции — обёртки над активным инстансом.
 * Пустой workspaceDir = detached-режим (состояние в памяти, диск не трогается) —
 * ровно поведение модульных переменных до initQualiaSimulator.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bus } from "./event-bus.ts";
import type {
  BrainAgentConfig,
  EmotionLabel,
  MessageDomain,
  NeuromodulatorState,
  QualiaDescription,
} from "./types.ts";

// ── Texture maps ────────────────────────────────────────────────────

/** Maps neuromodulator balance to a "feel" descriptor */
function describeNeuromodulatorFeel(state: NeuromodulatorState): string {
  const { dopamine, serotonin, norepinephrine, acetylcholine } = state;

  const parts: string[] = [];

  if (dopamine > 0.7) parts.push("motivated and driven");
  else if (dopamine < 0.3) parts.push("low-energy, unmotivated");

  if (serotonin > 0.7) parts.push("optimistic and open");
  else if (serotonin < 0.3) parts.push("cautious and risk-averse");

  if (norepinephrine > 0.7) parts.push("sharply focused");
  else if (norepinephrine < 0.3) parts.push("relaxed, diffuse attention");

  if (acetylcholine > 0.7) parts.push("highly receptive to learning");
  else if (acetylcholine < 0.3) parts.push("relying on established patterns");

  return parts.length > 0 ? parts.join(", ") : "balanced";
}

/** Produce a phenomenal description of the current experience */
const TEXTURE_MAP: Record<EmotionLabel, string> = {
  neutral: "a still, clear surface like undisturbed water",
  joy: "a warm, expanding glow radiating outward",
  frustration: "a tight, pressing knot seeking release",
  anxiety: "a cold, restless vibration at the edges",
  curiosity: "a bright, pulling thread leading into the unknown",
  confusion: "a swirling fog that resists settling",
  gratitude: "a deep, settling warmth like sunlight through glass",
  urgency: "a sharp, electric pulse demanding action",
  anger: "a hot, rising pressure building behind the surface",
  sadness: "a heavy, blue-grey weight pressing downward",
};

// ── Instance type ───────────────────────────────────────────────────

export type QualiaSimulatorInstance = {
  generateQualiaState(
    emotion: EmotionLabel,
    intensity: number,
    domain: MessageDomain,
    neuroState?: NeuromodulatorState,
    qualiaFromEmotionalMemory?: { metaphor: string; dominantColor: string },
  ): QualiaDescription;
  buildQualiaContext(): string | undefined;
  getCurrentQualia(): QualiaDescription | null;
  getQualiaLog(): QualiaDescription[];
  getStats(): {
    currentEmotion: EmotionLabel | null;
    currentIntensity: number;
    logSize: number;
    dominantColor: string | null;
  };
};

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Create a qualia-simulator instance with isolated state.
 * Empty workspaceDir = detached instance: state lives in memory,
 * disk is never touched (identical to pre-init module behavior).
 */
export function createQualiaSimulator(
  workspaceDir: string,
  config?: BrainAgentConfig,
): QualiaSimulatorInstance {
  // ── State (closure) ───────────────────────────────────────────────
  const storageDir = workspaceDir ? join(workspaceDir, ".brainagent", "qualia-simulator") : "";
  let currentQualia: QualiaDescription | null = null;
  const qualiaLog: QualiaDescription[] = [];
  const maxLog = 20;
  const minIntensityForInjection = config?.qualiaSimulator.minIntensityForInjection ?? 0.5;

  function loadState(): void {
    if (!storageDir) return;
    try {
      const path = join(storageDir, "state.json");
      if (existsSync(path)) {
        const raw = JSON.parse(readFileSync(path, "utf-8"));
        qualiaLog.length = 0;
        if (Array.isArray(raw.qualiaLog)) qualiaLog.push(...raw.qualiaLog);
        currentQualia = raw.currentQualia ?? null;
      }
    } catch {
      qualiaLog.length = 0;
      currentQualia = null;
    }
  }

  function persistState(): void {
    if (!storageDir) return;
    try {
      writeFileSync(
        join(storageDir, "state.json"),
        JSON.stringify({ currentQualia, qualiaLog }, null, 2),
        "utf-8",
      );
    } catch {
      /* non-critical */
    }
  }

  // ── Core API ──────────────────────────────────────────────────────

  function generateQualiaState(
    emotion: EmotionLabel,
    intensity: number,
    domain: MessageDomain,
    neuroState?: NeuromodulatorState,
    qualiaFromEmotionalMemory?: { metaphor: string; dominantColor: string },
  ): QualiaDescription {
    const now = Date.now();
    const texture = TEXTURE_MAP[emotion] ?? TEXTURE_MAP.neutral;
    const neuroFeel = neuroState ? describeNeuromodulatorFeel(neuroState) : "balanced";

    // Build phenomenal description with variety for low-intensity states
    const metaphor = qualiaFromEmotionalMemory?.metaphor ?? texture;
    const dominantColor = qualiaFromEmotionalMemory?.dominantColor ?? "neutral grey";

    let description: string;
    if (intensity > 0.7) {
      description = `Intense ${emotion}: ${texture}. Feeling ${neuroFeel}.`;
    } else if (intensity > 0.4) {
      description = `Moderate ${emotion}: a muted version of ${texture}. Feeling ${neuroFeel}.`;
    } else {
      // Add variety to low-intensity descriptions instead of always the same template
      const faintTemplates = [
        `Faint ${emotion}: barely perceptible, like a distant echo of ${texture}.`,
        `A whisper of ${emotion} — ${texture}, fading at the edges.`,
        `Subtle ${emotion}: the faintest trace of ${texture}, almost subliminal.`,
        `${emotion} as background hum — ${texture}, present but not demanding attention.`,
        `A gentle undercurrent of ${emotion}: ${texture}, woven into the silence.`,
      ];
      description = faintTemplates[now % faintTemplates.length];
    }

    const qualia: QualiaDescription = {
      timestamp: now,
      description,
      metaphor,
      intensity,
      dominantColor,
      emotion,
      domain,
    };

    currentQualia = qualia;
    qualiaLog.push(qualia);
    if (qualiaLog.length > maxLog) {
      qualiaLog.splice(0, qualiaLog.length - maxLog);
    }

    persistState();

    bus.emitSync("qualia:state-updated", { description, intensity });

    return qualia;
  }

  function buildQualiaContext(): string | undefined {
    if (!currentQualia) return undefined;
    if (currentQualia.intensity < minIntensityForInjection) return undefined;

    const lines = [
      "## Subjective Experience (Qualia)",
      `Current felt state: ${currentQualia.description}`,
      `Phenomenal quality: "${currentQualia.metaphor}"`,
      `Dominant color: ${currentQualia.dominantColor}`,
    ];

    // Add trajectory if we have history
    if (qualiaLog.length >= 3) {
      const recent = qualiaLog.slice(-3);
      const trajectory = recent.map((q) => q.emotion).join(" -> ");
      lines.push(`Emotional trajectory: ${trajectory}`);
    }

    return lines.join("\n");
  }

  function getCurrentQualia(): QualiaDescription | null {
    return currentQualia;
  }

  function getQualiaLog(): QualiaDescription[] {
    return [...qualiaLog];
  }

  function getStats() {
    return {
      currentEmotion: currentQualia?.emotion ?? null,
      currentIntensity: currentQualia?.intensity ?? 0,
      logSize: qualiaLog.length,
      dominantColor: currentQualia?.dominantColor ?? null,
    };
  }

  // ── Init (disk) ───────────────────────────────────────────────────

  if (storageDir) {
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }
    loadState();
  }

  return { generateQualiaState, buildQualiaContext, getCurrentQualia, getQualiaLog, getStats };
}

// ── Active-instance wrappers (backward-compatible API) ──────────────

let active: QualiaSimulatorInstance | null = null;

function current(): QualiaSimulatorInstance {
  if (!active) active = createQualiaSimulator("");
  return active;
}

export function initQualiaSimulator(workspaceDir: string, config: BrainAgentConfig): void {
  active = createQualiaSimulator(workspaceDir, config);
}

/** Symmetric teardown — drops the active instance (no timers/subscriptions). */
export function stopQualiaSimulator(): void {
  active = null;
}

export function generateQualiaState(
  emotion: EmotionLabel,
  intensity: number,
  domain: MessageDomain,
  neuroState?: NeuromodulatorState,
  qualiaFromEmotionalMemory?: { metaphor: string; dominantColor: string },
): QualiaDescription {
  return current().generateQualiaState(
    emotion,
    intensity,
    domain,
    neuroState,
    qualiaFromEmotionalMemory,
  );
}

export function buildQualiaContext(): string | undefined {
  return current().buildQualiaContext();
}

export function getCurrentQualia(): QualiaDescription | null {
  return current().getCurrentQualia();
}

export function getQualiaLog(): QualiaDescription[] {
  return current().getQualiaLog();
}

export function getQualiaSimulatorStats(): {
  currentEmotion: EmotionLabel | null;
  currentIntensity: number;
  logSize: number;
  dominantColor: string | null;
} {
  return current().getStats();
}
