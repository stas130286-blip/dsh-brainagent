/**
 * BrainAgent — Autonomy layer.
 *
 * Everything that decides WHEN and HOW the agent reaches out on its own:
 *  - the proactive deliverer (gap checks, loop breaker, domain suppression,
 *    framing for the model);
 *  - the intent resolver ("do I actually have something to say?") that
 *    picks goals / DMN insights / desires / strong drives;
 *  - the drive→emotion synthesis used to annotate autonomous cycles.
 *
 * All module-level mutable "last autonomous ..." variables of the old
 * `apply()` closure are consolidated into one {@link AutonomyState} object
 * so the lifecycle is explicit and testable.
 */

import type { Agent } from "@deepseek-ai/dsh-agent";
import type { AutonomousIntent } from "../modules/vital-impulse.ts";
import type {
  BrainAgentConfig,
  Desire,
  DMNInsight,
  EmotionLabel,
  Goal,
  MessageDomain,
} from "../modules/types.ts";
import {
  AUTONOMOUS_FRAMING_LINES,
  AUTONOMOUS_TAG,
  AUTONOMOUS_TAG_PREFIX,
  AUTONOMY_PRIORITY_PREFIX,
} from "./config.ts";
import { AUTONOMY_MEMORIES_PREFIX } from "../modules/autonomy-markers.ts";

// ── Shared mutable state ────────────────────────────────────────────

export type AutonomyState = {
  /** The session currently being served (proactive delivery routing). */
  lastActiveAgentId?: string;
  /** Source of the last autonomous intent ("goal:x", "dmn:insight", ...). */
  lastAutonomousSource: string;
  /** True when the previous cycle was autonomous (loop breaker). */
  previousCycleWasAutonomous: boolean;
  /** Episode id of the last proactive message (feedback linking). */
  lastAutonomousEpisodeId?: string;
  /** Domain of the last proactive message. */
  lastAutonomousDomain: string;
  /** Timestamp of the last proactive delivery (minimum-gap check). */
  lastAutonomousDeliveryAt: number;
  /**
   * Буфер блока воспоминаний автономи-энричера: вливается в
   * следующую доставку с реальным содержанием (v0.9.1) — соло
   * блок не доставляется (followup без вопроса и задачи).
   */
  pendingMemoryContext?: string;
};

export function createAutonomyState(): AutonomyState {
  return {
    lastActiveAgentId: undefined,
    lastAutonomousSource: "",
    previousCycleWasAutonomous: false,
    lastAutonomousEpisodeId: undefined,
    lastAutonomousDomain: "unknown",
    lastAutonomousDeliveryAt: 0,
    pendingMemoryContext: undefined,
  };
}

// ── Biological drives ───────────────────────────────────────────────

export type DriveName = "social" | "cognitive" | "creative" | "mastery";

export type DriveGetters = {
  social?: () => { need: number; needLevel: string };
  cognitive?: () => { need: number; needLevel: string };
  creative?: () => { need: number; needLevel: string };
  mastery?: () => { need: number; needLevel: string };
};

export type ActiveDrive = {
  name: DriveName;
  need: number;
  needLevel: string;
};

const DRIVE_DESCRIPTIONS: Record<DriveName, string> = {
  social: "Хочется связаться с кем-то, узнать как дела, поговорить.",
  cognitive: "Хочется узнать что-то новое, исследовать тему, разобраться в вопросе.",
  creative: "Хочется создать что-то, выразить мысль творчески.",
  mastery: "Хочется улучшить навыки, попрактиковаться.",
};

type DriveEmotionSpec = {
  emotion: EmotionLabel;
  domain: MessageDomain;
  intensityMax: number;
  intensityBase: number;
  intensityScale: number;
};

const DRIVE_EMOTIONS: Record<DriveName, DriveEmotionSpec> = {
  social: { emotion: "curiosity", domain: "casual", intensityMax: 0.9, intensityBase: 0.3, intensityScale: 0.6 },
  cognitive: { emotion: "curiosity", domain: "factual", intensityMax: 0.9, intensityBase: 0.3, intensityScale: 0.6 },
  creative: { emotion: "joy", domain: "creative", intensityMax: 0.8, intensityBase: 0.3, intensityScale: 0.5 },
  mastery: { emotion: "curiosity", domain: "technical", intensityMax: 0.8, intensityBase: 0.3, intensityScale: 0.5 },
};

/** Collect the drives whose need exceeds the given threshold. */
export function collectActiveDrives(drives: DriveGetters, threshold: number): ActiveDrive[] {
  const active: ActiveDrive[] = [];
  if (drives.social) {
    const s = drives.social();
    if (s.need >= threshold) active.push({ name: "social", need: s.need, needLevel: s.needLevel });
  }
  if (drives.cognitive) {
    const c = drives.cognitive();
    if (c.need >= threshold) active.push({ name: "cognitive", need: c.need, needLevel: c.needLevel });
  }
  if (drives.creative) {
    const c = drives.creative();
    if (c.need >= threshold) active.push({ name: "creative", need: c.need, needLevel: c.needLevel });
  }
  if (drives.mastery) {
    const m = drives.mastery();
    if (m.need >= threshold) active.push({ name: "mastery", need: m.need, needLevel: m.needLevel });
  }
  return active;
}

/**
 * Synthesize an emotional context for an autonomous cycle from the active
 * drives — the keyword-based amygdala cannot classify self-initiated text.
 * Overrides `cycle.assessment` and (if unknown) `cycle.classification`.
 */
export function synthesizeAutonomousCycleState(
  brainConfig: BrainAgentConfig,
  drives: DriveGetters,
  cycle: {
    assessment?: {
      urgency: number;
      importance: number;
      emotion: EmotionLabel;
      emotionIntensity: number;
      empathyNeeded: boolean;
      rationale: string;
    };
    classification?: {
      modality: "text" | "image" | "voice" | "file" | "mixed";
      domain: MessageDomain;
      complexity: "trivial" | "simple" | "moderate" | "complex" | "extreme";
      intentSummary: string;
      confidence: number;
      processingPath: "fast" | "slow";
    };
  },
): void {
  const active = collectActiveDrives(drives, 0.5);
  if (active.length === 0) return;

  // Original code ranked drives by the COMPUTED intensity (not by raw need),
  // because a saturated drive caps its intensity — keep that ordering.
  const ranked = active
    .map((d) => {
      const spec = DRIVE_EMOTIONS[d.name];
      return {
        drive: d,
        spec,
        intensity: Math.min(spec.intensityMax, spec.intensityBase + d.need * spec.intensityScale),
      };
    })
    .sort((a, b) => b.intensity - a.intensity);
  const { drive: strongest, spec, intensity } = ranked[0];

  // Override assessment so dopamine sees real emotion.
  cycle.assessment = {
    urgency: 0.2,
    importance: 0.4 + intensity * 0.3,
    emotion: spec.emotion,
    emotionIntensity: intensity,
    empathyNeeded: false,
    rationale: `autonomous drive (${spec.domain})`,
  };
  // Override classification domain so reward matches drive domains.
  if (!cycle.classification || cycle.classification.domain === "unknown") {
    cycle.classification = {
      modality: "text",
      domain: spec.domain,
      complexity: "simple",
      intentSummary: "autonomous drive action",
      confidence: 0.7,
      processingPath: "fast",
    };
  }
}

// ── Proactive delivery ──────────────────────────────────────────────

export type AutonomousDelivererDeps = {
  state: AutonomyState;
  brainConfig: BrainAgentConfig;
  /** Minimum gap between proactive messages (ms). */
  minGapMs: number;
  logger: { info: (msg: string) => void; warn: (msg: string) => void };
  /** Pick the live agent to deliver through (undefined → drop). */
  pickAgent: () => Agent | undefined;
  /** Actually deliver the framed text as a cron-sourced user message. */
  deliver: (agent: Agent, framedText: string) => void;
  classifyDomain: (text: string) => { domain: MessageDomain };
  isDomainSuppressed: (domain: MessageDomain) => boolean;
  getSuppressedDomainHints: () => string[];
};

/**
 * Build the proactive deliverer. Guards: loop breaker (never speak twice
 * in a row autonomously), minimum gap, and suppressed (rejected) domains.
 */
export function createAutonomousDeliverer(deps: AutonomousDelivererDeps): (text: string) => void {
  const { state, brainConfig, minGapMs, logger } = deps;

  return function enqueueAutonomousIntent(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return; // never deliver an empty impulse

    // v0.9.1: блок воспоминаний энричера — контекст, а не сообщение.
    // Соло-доставка превращается в followup без вопроса и задачи,
    // на который агент вынужден отвечать («сообщение пустое»).
    if (trimmed.startsWith(AUTONOMY_MEMORIES_PREFIX)) {
      state.pendingMemoryContext = trimmed;
      return;
    }

    // v0.9.7: напоминание по time-цели — обязательство по времени,
    // а не спонтанная инициатива: снимаем маркер и пропускаем мимо
    // loop-breaker и минимума-гэпа (иначе обещанное напоминание
    // подавляется недавней проактивной доставкой).
    let priority = false;
    let intentText = trimmed;
    if (trimmed.startsWith(AUTONOMY_PRIORITY_PREFIX)) {
      priority = true;
      intentText = trimmed.slice(AUTONOMY_PRIORITY_PREFIX.length).trim();
    }

    // Loop breaker: after an autonomous turn the agent stays silent until
    // the human returns — otherwise the turn's own learning signals keep
    // re-firing the impulse and the chat fills with cron soliloquies.
    if (!priority) {
      if (state.previousCycleWasAutonomous) {
        logger.info("BrainAgent Autonomy: intent suppressed — previous cycle was autonomous");
        return;
      }
      // Minimum gap between proactive messages (default 10 min).
      if (Date.now() - state.lastAutonomousDeliveryAt < minGapMs) {
        logger.info("BrainAgent Autonomy: intent suppressed — minimum gap not elapsed");
        return;
      }
    }
    // «Не зашло»: темы, которые пользователь отверг, не заводим (v0.2.0).
    if (brainConfig.modules.proactiveFeedback) {
      const intentDomain = deps.classifyDomain(intentText).domain;
      if (deps.isDomainSuppressed(intentDomain)) {
        logger.info(
          `BrainAgent Autonomy: intent suppressed — domain ${intentDomain} was rejected`,
        );
        return;
      }
    }
    const agent = deps.pickAgent();
    if (!agent) {
      logger.warn("BrainAgent Autonomy: no live agent — autonomous intent dropped");
      return;
    }
    // The dsh stock agent has no prior knowledge of <autonomous-intent>
    // markers (NeuroClaw's host prompt framed them) — frame the delivery
    // explicitly so the model speaks on its own instead of looking for a task.
    const rejectionHints = brainConfig.modules.proactiveFeedback
      ? deps.getSuppressedDomainHints()
      : [];
    // Скопленный блок памяти вливается в доставку и очищается.
    const memoryContext = state.pendingMemoryContext;
    state.pendingMemoryContext = undefined;
    const framed = intentText.startsWith(AUTONOMOUS_TAG_PREFIX)
      ? [
          ...AUTONOMOUS_FRAMING_LINES,
          ...(rejectionHints.length > 0
            ? [`Не заводи темы, которые пользователю не зашли: ${rejectionHints.join("; ")}.`]
            : []),
          "",
          trimmed,
          ...(memoryContext ? ["", memoryContext] : []),
        ].join("\n")
      : memoryContext
        ? `${trimmed}\n\n${memoryContext}`
        : trimmed;
    state.lastAutonomousDeliveryAt = Date.now();
    deps.deliver(agent, framed);
  };
}

// ── Intent resolution ("do I have something to say?") ───────────────

export type IntentResolverDeps = {
  state: AutonomyState;
  brainConfig: BrainAgentConfig;
  drives: DriveGetters;
  goalStack?: {
    getGoalStackStats: () => { pending: number };
    checkAutonomousGoals: (idleMs?: number) => Goal[];
    buildGoalContext: (goals: Goal[]) => string | undefined;
    getDesires: () => Desire[];
  };
  circadian?: {
    getCircadianState: () => { idleTime: number };
  };
  dmn?: {
    getRecentUnusedInsights: (windowMs?: number) => DMNInsight[];
  };
};

/**
 * Build the "do I actually have something to say?" resolver. Only returns
 * an intent when there is concrete content — a goal to act on, an insight
 * to share, or a strong specific desire; otherwise the agent stays quiet
 * and enriches responses when the user talks.
 */
export function createAutonomousIntentResolver(deps: IntentResolverDeps): () => AutonomousIntent | null {
  const { state, brainConfig, drives } = deps;

  return (): AutonomousIntent | null => {
    // 1. Social goals with recurring intervals (user asked the agent
    //    to do something periodically, e.g. "check the forum").
    if (brainConfig.modules.goalStack && deps.goalStack) {
      const stats = deps.goalStack.getGoalStackStats();
      if (stats.pending > 0) {
        const idleMs = brainConfig.circadian.enabled
          ? deps.circadian?.getCircadianState().idleTime
          : undefined;
        const triggered = deps.goalStack.checkAutonomousGoals(idleMs);
        if (triggered.length > 0) {
          const goalCtx = deps.goalStack.buildGoalContext(triggered);
          if (goalCtx) {
            // v0.9.7: time-цель — напоминание с приоритетной доставкой.
            const priority = triggered.some((g) => g.trigger.type === "time");
            state.lastAutonomousSource = `goal:${triggered[0].id}`;
            return {
              text: [
                ...(priority ? [AUTONOMY_PRIORITY_PREFIX] : []),
                AUTONOMOUS_TAG,
                ...triggered.slice(0, 3).map((g) => g.description),
                "",
                goalCtx,
                "",
                "Если у тебя есть инструмент для выполнения — используй его. Если нет — просто напиши пользователю о задаче.",
                "НЕ выдумывай результаты. Если ты не выполнил действие через инструмент — не пиши что выполнил.",
                "Не описывай внутренние процессы, цели, или механизмы.",
                `</${AUTONOMOUS_TAG.slice(1)}`,
              ]
                .filter(Boolean)
                .join("\n"),
              source: `goal:${triggered[0].id}`,
            };
          }
        }
      }
    }

    // 2. Novel DMN insights worth sharing
    if (brainConfig.modules.dmn && deps.dmn) {
      const unused = deps.dmn.getRecentUnusedInsights(30 * 60 * 1000); // last 30 min
      const novel = unused.filter((i) => i.confidence > 0.5);
      if (novel.length > 0) {
        const best = novel[novel.length - 1];
        state.lastAutonomousSource = "dmn:insight";
        return {
          text: [
            AUTONOMOUS_TAG,
            best.insightText,
            "",
            "Поделись мыслью естественно. Не говори что это 'автономная мысль' или что ты 'решил поделиться'.",
            "Не выдумывай факты, статистику или новости. Говори только то, что знаешь.",
            `</${AUTONOMOUS_TAG.slice(1)}`,
          ].join("\n"),
          source: "dmn:insight",
        };
      }
    }

    // 3. Strong specific desires (not generic urges)
    if (brainConfig.modules.goalStack && deps.goalStack) {
      const strong = deps.goalStack.getDesires().filter((d) => d.strength >= 0.9);
      if (strong.length > 0) {
        const top = strong.sort((a, b) => b.strength - a.strength)[0];
        state.lastAutonomousSource = `desire:${top.id}`;
        return {
          text: [
            AUTONOMOUS_TAG,
            top.description,
            "",
            "Действуй естественно. Не упоминай 'желания', 'драйвы' или внутреннее состояние.",
            `</${AUTONOMOUS_TAG.slice(1)}`,
          ].join("\n"),
          source: `desire:${top.id}`,
        };
      }
    }

    // 4. Biological drives at strong+ level
    const active = collectActiveDrives(drives, 0.8);
    if (active.length > 0) {
      const strongest = active.sort((a, b) => b.need - a.need)[0];
      state.lastAutonomousSource = `drive:${strongest.name}`;
      return {
        text: [
          AUTONOMOUS_TAG,
          DRIVE_DESCRIPTIONS[strongest.name],
          "",
          "Действуй от себя, естественно. Не сообщай пользователю о внутренних побуждениях.",
          `</${AUTONOMOUS_TAG.slice(1)}`,
        ].join("\n"),
        source: `drive:${strongest.name}`,
      };
    }

    // Nothing specific → stay quiet, enrich responses when user talks
    return null;
  };
}
