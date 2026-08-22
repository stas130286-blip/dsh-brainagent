/**
 * Amygdala — Emotional evaluation and priority scoring.
 *
 * The amygdala instantly evaluates incoming stimuli for emotional significance:
 * Is this dangerous? Important? Pleasant? This module assigns a priority vector
 * to each message that influences all downstream processing.
 *
 * High urgency → skip the queue, respond immediately
 * High emotion → activate empathy (mirror neurons)
 * Low trust → more cautious responses
 */

import type { HostConfig as NeuroClawConfig } from "./host-config.ts";
import { bus } from "./event-bus.ts";
import { callLLM } from "./llm-client.ts";
import type { AmygdalaAssessment, EmotionLabel } from "./types.ts";

// ── Emotion detection patterns ──────────────────────────────────────

type EmotionPattern = {
  emotion: EmotionLabel;
  /** Keywords and phrases that suggest this emotion */
  indicators: RegExp[];
  /** Base intensity when detected (0-1) */
  baseIntensity: number;
};

const EMOTION_PATTERNS: EmotionPattern[] = [
  {
    emotion: "urgency",
    indicators: [
      /срочн/i,
      /немедленн/i,
      /asap/i,
      /urgent/i,
      /скор(ее|ей)/i,
      /быстр(ее|ей)/i,
      /!{2,}/,
      /помоги(те)?!/i,
    ],
    baseIntensity: 0.9,
  },
  {
    emotion: "frustration",
    indicators: [
      /не работает/i,
      /опять/i,
      /достало/i,
      /broken/i,
      /doesn't work/i,
      /не могу/i,
      /невозможно/i,
      /задолбал/i,
    ],
    baseIntensity: 0.7,
  },
  {
    emotion: "anger",
    indicators: [/злюсь/i, /бесит/i, /ненавижу/i, /angry/i, /hate/i, /какого чёрта/i, /чёрт/i],
    baseIntensity: 0.8,
  },
  {
    emotion: "anxiety",
    indicators: [
      /переживаю/i,
      /боюсь/i,
      /страшно/i,
      /worried/i,
      /afraid/i,
      /nervous/i,
      /тревожн/i,
      /вдруг/i,
    ],
    baseIntensity: 0.6,
  },
  {
    emotion: "confusion",
    indicators: [
      /не понимаю/i,
      /confused/i,
      /что это/i,
      /как это/i,
      /зачем/i,
      /почему/i,
      /\?\?+/,
      /не ясно/i,
      /непонятн/i,
    ],
    baseIntensity: 0.5,
  },
  {
    emotion: "gratitude",
    indicators: [
      /спасибо/i,
      /благодарю/i,
      /thank/i,
      /отлично/i,
      /молодец/i,
      /супер/i,
      /класс/i,
      /умница/i,
    ],
    baseIntensity: 0.7,
  },
  {
    emotion: "joy",
    indicators: [
      /ура/i,
      /круто/i,
      /здорово/i,
      /awesome/i,
      /great/i,
      /замечательно/i,
      /радость/i,
      /счастлив/i,
      /!{3,}/,
    ],
    baseIntensity: 0.7,
  },
  {
    emotion: "sadness",
    indicators: [
      /грустно/i,
      /печальн/i,
      /sad/i,
      /жаль/i,
      /unfortunately/i,
      /к сожалению/i,
      /расстроен/i,
    ],
    baseIntensity: 0.5,
  },
  {
    emotion: "curiosity",
    indicators: [/интересно/i, /curious/i, /расскажи/i, /а что если/i, /как думаешь/i, /можно ли/i],
    baseIntensity: 0.4,
  },
];

// ── Urgency indicators ──────────────────────────────────────────────

const URGENCY_BOOSTERS: Array<{ pattern: RegExp; boost: number }> = [
  { pattern: /!{3,}/, boost: 0.3 },
  { pattern: /CAPS_RATIO_HIGH/, boost: 0.2 }, // placeholder, checked separately
  { pattern: /срочн/i, boost: 0.4 },
  { pattern: /asap|немедленно|urgent/i, boost: 0.4 },
  { pattern: /помоги(те)?/i, boost: 0.2 },
  { pattern: /ошибк|error|broken|сломал/i, boost: 0.15 },
];

// ── Assessment logic ────────────────────────────────────────────────

function detectEmotion(text: string): { emotion: EmotionLabel; intensity: number } {
  let bestEmotion: EmotionLabel = "neutral";
  let bestIntensity = 0;

  for (const pattern of EMOTION_PATTERNS) {
    let matchCount = 0;
    for (const indicator of pattern.indicators) {
      if (indicator.test(text)) matchCount++;
    }
    if (matchCount > 0) {
      const intensity = Math.min(1, pattern.baseIntensity + (matchCount - 1) * 0.1);
      if (intensity > bestIntensity) {
        bestIntensity = intensity;
        bestEmotion = pattern.emotion;
      }
    }
  }

  // Baseline intensity: even neutral messages carry minimal emotional weight
  // based on message length and punctuation (longer/more complex = more engagement)
  if (bestIntensity === 0) {
    const words = text.split(/\s+/).length;
    const hasPunctuation = /[?!.,;:]/.test(text);
    bestIntensity = Math.min(
      0.15,
      0.05 + (words > 5 ? 0.03 : 0) + (words > 20 ? 0.03 : 0) + (hasPunctuation ? 0.02 : 0),
    );
  }

  return { emotion: bestEmotion, intensity: bestIntensity };
}

function calculateUrgency(text: string): number {
  let urgency = 0.1; // base urgency

  for (const booster of URGENCY_BOOSTERS) {
    if (booster.pattern.source === "CAPS_RATIO_HIGH") {
      // Check if more than 50% of alphabetic chars are uppercase
      const alphaChars = text.replace(/[^a-zA-Zа-яА-Я]/g, "");
      const upperChars = text.replace(/[^A-ZА-Я]/g, "");
      if (alphaChars.length > 5 && upperChars.length / alphaChars.length > 0.5) {
        urgency += booster.boost;
      }
    } else if (booster.pattern.test(text)) {
      urgency += booster.boost;
    }
  }

  return Math.min(1, urgency);
}

function calculateImportance(text: string, emotion: EmotionLabel, urgency: number): number {
  let importance = 0.3; // base

  // Urgency directly boosts importance
  importance += urgency * 0.3;

  // Negative emotions boost importance (problems need solving)
  if (["frustration", "anger", "anxiety", "urgency"].includes(emotion)) {
    importance += 0.2;
  }

  // Longer, more detailed messages are likely more important
  const wordCount = text.split(/\s+/).length;
  if (wordCount > 30) importance += 0.1;
  if (wordCount > 100) importance += 0.1;

  return Math.min(1, importance);
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Assess the emotional significance and priority of an incoming message.
 * Broadcasts the result on the brain bus.
 */
export function assess(text: string): AmygdalaAssessment {
  const { emotion, intensity } = detectEmotion(text);
  const urgency = calculateUrgency(text);
  const importance = calculateImportance(text, emotion, urgency);

  const empathyNeeded =
    intensity > 0.5 &&
    ["frustration", "anger", "anxiety", "sadness", "confusion"].includes(emotion);

  const result: AmygdalaAssessment = {
    urgency,
    importance,
    emotion,
    emotionIntensity: intensity,
    empathyNeeded,
    rationale: buildRationale(emotion, intensity, urgency),
  };

  // Broadcast to other brain modules
  bus.emitSync("amygdala:assessed", result);

  return result;
}

function buildRationale(emotion: EmotionLabel, intensity: number, urgency: number): string {
  const parts: string[] = [];
  if (emotion !== "neutral") {
    parts.push(`emotion=${emotion}(${(intensity * 100).toFixed(0)}%)`);
  }
  if (urgency > 0.5) {
    parts.push(`urgency=high(${(urgency * 100).toFixed(0)}%)`);
  }
  return parts.length > 0 ? parts.join(", ") : "routine message";
}

// ── LLM-enhanced emotion detection ──────────────────────────────────

const EMOTION_PROMPT = `You are an emotion detection system for a conversational AI.

Analyze the user's message and detect the PRIMARY emotion.

Emotion labels (pick ONE):
- "urgency": time pressure, emergency, needs immediate help
- "frustration": something isn't working, repeated failures
- "anger": strong displeasure, hostility
- "anxiety": worry, fear, nervousness about an outcome
- "confusion": doesn't understand, needs clarification
- "gratitude": thankful, appreciative
- "joy": happy, excited, celebrating
- "sadness": disappointed, upset, feeling loss
- "curiosity": interested, exploring, asking open-ended questions
- "neutral": no strong emotion detected

Rules:
- Detect the DOMINANT emotion, not every possible one
- Consider sarcasm: "oh great, another error" = frustration, not joy
- Consider cultural context (Russian/English)
- intensity: 0.0-1.0 how strong the emotion is
- urgency: 0.0-1.0 how urgent the message feels (independent of emotion)

Respond with ONLY a JSON object:
{"emotion": "...", "intensity": 0.X, "urgency": 0.X}`;

/**
 * Assess emotional significance using LLM for nuanced understanding.
 * Falls back to pattern-based assessment if LLM is unavailable.
 */
export async function assessWithAI(
  text: string,
  config: NeuroClawConfig,
  logger?: { info: (msg: string) => void },
): Promise<AmygdalaAssessment> {
  const content = await callLLM(EMOTION_PROMPT, text, config, logger, 100);
  if (!content) return assess(text);

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return assess(text);

    const parsed = JSON.parse(jsonMatch[0]) as {
      emotion?: string;
      intensity?: number;
      urgency?: number;
    };

    const validEmotions: EmotionLabel[] = [
      "urgency",
      "frustration",
      "anger",
      "anxiety",
      "confusion",
      "gratitude",
      "joy",
      "sadness",
      "curiosity",
      "neutral",
    ];

    const emotion = (
      validEmotions.includes(parsed.emotion as EmotionLabel) ? parsed.emotion : "neutral"
    ) as EmotionLabel;
    const intensity =
      typeof parsed.intensity === "number" ? Math.max(0, Math.min(1, parsed.intensity)) : 0.1;
    const urgency =
      typeof parsed.urgency === "number" ? Math.max(0, Math.min(1, parsed.urgency)) : 0.1;

    const importance = calculateImportance(text, emotion, urgency);
    const empathyNeeded =
      intensity > 0.5 &&
      ["frustration", "anger", "anxiety", "sadness", "confusion"].includes(emotion);

    const result: AmygdalaAssessment = {
      urgency,
      importance,
      emotion,
      emotionIntensity: intensity,
      empathyNeeded,
      rationale: buildRationale(emotion, intensity, urgency),
    };

    bus.emitSync("amygdala:assessed", result);
    return result;
  } catch {
    return assess(text);
  }
}
