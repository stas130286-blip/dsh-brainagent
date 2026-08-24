/**
 * Procedural Extractor — Detect workflow patterns from conversations.
 *
 * Procedural memory stores "how to do things" — sequences of actions
 * that solve recurring problems. Unlike episodic memory (what happened)
 * or semantic memory (facts), procedural memory is about SKILLS.
 *
 * This module detects when a user is asking about or describing procedures:
 * - "Как сделать X?" → potential procedure trigger
 * - "Сначала X, потом Y, затем Z" → explicit procedure steps
 * - Successful task completion → record the pattern
 *
 * Since we don't have direct access to tool calls in the plugin hook,
 * we infer procedural patterns from:
 * 1. The domain of the request (technical = likely procedure)
 * 2. Step-by-step language in user input
 * 3. Successful task completion patterns
 */

import type { HostConfig as NeuroClawConfig } from "./host-config.ts";
import { callLLM, isAIProviderAvailable } from "./llm-client.ts";
import type { MessageDomain, ThalamusClassification } from "./types.ts";

export type ProceduralPattern = {
  /** What triggers this procedure (normalized request pattern) */
  triggerPattern: string;
  /** Description of what this procedure does */
  description: string;
  /** Detected or inferred steps */
  steps: string[];
  /** Domain this procedure belongs to */
  domain: MessageDomain;
  /** Confidence that this is a real procedure (0-1) */
  confidence: number;
};

// ── Pattern definitions ─────────────────────────────────────────────

type ProcedurePattern = {
  pattern: RegExp;
  type: "how_to" | "steps" | "action_request";
  extract: (match: RegExpMatchArray, fullText: string) => Partial<ProceduralPattern> | null;
};

const PROCEDURE_PATTERNS: ProcedurePattern[] = [
  // ═══════════════════════════════════════════════════════════════════
  // "HOW TO" QUESTIONS (Russian)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /как\s+(?:мне\s+)?(?:можно\s+)?(.+?)(?:\?|$)/i,
    type: "how_to",
    extract: (m) => ({
      triggerPattern: m[1].trim(),
      description: `Как: ${m[1].trim()}`,
      steps: [],
    }),
  },
  {
    pattern: /(?:подскажи|объясни|расскажи)\s+как\s+(.+?)(?:\?|$)/i,
    type: "how_to",
    extract: (m) => ({
      triggerPattern: m[1].trim(),
      description: `Инструкция: ${m[1].trim()}`,
      steps: [],
    }),
  },
  {
    pattern: /что\s+нужно\s+(?:сделать\s+)?(?:чтобы|для)\s+(.+?)(?:\?|$)/i,
    type: "how_to",
    extract: (m) => ({
      triggerPattern: m[1].trim(),
      description: `Процедура для: ${m[1].trim()}`,
      steps: [],
    }),
  },

  // ═══════════════════════════════════════════════════════════════════
  // "HOW TO" QUESTIONS (English)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /how\s+(?:do\s+i|can\s+i|to)\s+(.+?)(?:\?|$)/i,
    type: "how_to",
    extract: (m) => ({
      triggerPattern: m[1].trim(),
      description: `How to: ${m[1].trim()}`,
      steps: [],
    }),
  },
  {
    pattern: /(?:explain|tell\s+me)\s+how\s+to\s+(.+?)(?:\?|$)/i,
    type: "how_to",
    extract: (m) => ({
      triggerPattern: m[1].trim(),
      description: `Instructions for: ${m[1].trim()}`,
      steps: [],
    }),
  },

  // ═══════════════════════════════════════════════════════════════════
  // EXPLICIT STEPS (Russian)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern:
      /(?:сначала|первое|шаг\s*1)\s*[:.]?\s*(.+?)(?:,\s*(?:потом|затем|далее|второе|шаг\s*2)\s*[:.]?\s*(.+?))?(?:,\s*(?:потом|затем|и\s+наконец|третье|шаг\s*3)\s*[:.]?\s*(.+?))?/i,
    type: "steps",
    extract: (m, text) => {
      const steps = [m[1]?.trim(), m[2]?.trim(), m[3]?.trim()].filter(
        (s): s is string => !!s && s.length > 2,
      );
      if (steps.length < 2) return null;
      return {
        triggerPattern: text.slice(0, 50),
        description: `Процедура из ${steps.length} шагов`,
        steps,
      };
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACTION REQUESTS (Russian) - commands that imply procedures
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /(?:создай|сделай|настрой|установи|запусти|открой)\s+(.+?)(?:\.|$)/i,
    type: "action_request",
    extract: (m) => ({
      triggerPattern: m[0].trim(),
      description: `Действие: ${m[1].trim()}`,
      steps: [m[0].trim()],
    }),
  },
  {
    pattern: /(?:помоги|помоги\s+мне)\s+(.+?)(?:\.|$)/i,
    type: "action_request",
    extract: (m) => ({
      triggerPattern: m[1].trim(),
      description: `Помощь с: ${m[1].trim()}`,
      steps: [],
    }),
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACTION REQUESTS (English)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /(?:create|make|setup|install|run|open)\s+(.+?)(?:\.|$)/i,
    type: "action_request",
    extract: (m) => ({
      triggerPattern: m[0].trim(),
      description: `Action: ${m[1].trim()}`,
      steps: [m[0].trim()],
    }),
  },
  {
    pattern: /(?:help\s+me)\s+(.+?)(?:\.|$)/i,
    type: "action_request",
    extract: (m) => ({
      triggerPattern: m[1].trim(),
      description: `Help with: ${m[1].trim()}`,
      steps: [],
    }),
  },
];

// ── Main extraction function ────────────────────────────────────────

/**
 * v0.2.1: брак-контроль триггеров.
 * Отклоняет обрезанные фрагменты (например, куски вызовов инструментов
 * вида "any files ("), которые раньше сохранялись как «выученные
 * сценарии» и потом предлагались агенту.
 */
function isQualityTrigger(trigger: string): boolean {
  const t = trigger.trim();
  if (t.length < 5) return false;
  // Висящая открывающая скобка или пунктуация — признак обрезка
  if (/[[({,;:\-\s]$/.test(t)) return false;
  // Незакрытые скобки — фрагмент вырван из середины
  const opens = (t.match(/[([{]/g) ?? []).length;
  const closes = (t.match(/[)\]}]/g) ?? []).length;
  if (opens > closes) return false;
  return true;
}

/**
 * Extract procedural patterns from user input.
 * Returns patterns that could become procedural memories.
 */
export function extractProcedure(
  text: string,
  classification?: ThalamusClassification,
): ProceduralPattern | null {
  // Only technical/command domains are likely to have procedures
  const proceduralDomains: MessageDomain[] = ["technical", "command", "factual"];

  const domain = classification?.domain ?? "unknown";

  // Lower priority for non-procedural domains
  const domainBoost = proceduralDomains.includes(domain) ? 0.2 : 0;

  for (const procPattern of PROCEDURE_PATTERNS) {
    const match = text.match(procPattern.pattern);
    if (!match) continue;

    const extracted = procPattern.extract(match, text);
    if (!extracted) continue;
    if (!extracted.triggerPattern || !isQualityTrigger(extracted.triggerPattern)) continue;

    // Calculate confidence
    let confidence = 0.4 + domainBoost;

    // "how_to" questions are high-confidence procedure triggers
    if (procPattern.type === "how_to") {
      confidence += 0.25;
    }

    // Explicit steps are very high confidence
    if (procPattern.type === "steps" && extracted.steps && extracted.steps.length >= 2) {
      confidence += 0.35;
    }

    // Action requests are medium confidence
    if (procPattern.type === "action_request") {
      confidence += 0.15;
    }

    // Boost from classification confidence
    if (classification) {
      confidence += (classification.confidence - 0.7) * 0.15;
    }

    confidence = Math.max(0, Math.min(1, confidence));

    // Only return if confidence > 0.5
    if (confidence > 0.5) {
      return {
        triggerPattern: extracted.triggerPattern,
        description: extracted.description ?? extracted.triggerPattern,
        steps: extracted.steps ?? [],
        domain,
        confidence,
      };
    }
  }

  return null;
}

/**
 * Check if a message is likely to involve a procedure.
 */
export function isProcedural(text: string, classification?: ThalamusClassification): boolean {
  // Technical and command domains are procedural
  if (classification?.domain === "technical" || classification?.domain === "command") {
    return true;
  }

  // Check for procedural keywords
  const proceduralKeywords = [
    /как\s+/i,
    /how\s+to/i,
    /шаг/i,
    /step/i,
    /сначала/i,
    /first/i,
    /создай/i,
    /create/i,
    /сделай/i,
    /make/i,
    /настрой/i,
    /setup/i,
    /установи/i,
    /install/i,
  ];

  return proceduralKeywords.some((kw) => kw.test(text));
}

// ══════════════════════════════════════════════════════════════════════
// AI-enhanced procedural extraction
// ══════════════════════════════════════════════════════════════════════

const PROCEDURE_PROMPT = `Ты — модуль извлечения процедур. Проанализируй сообщение пользователя и определи, описывает ли оно процедуру (запрос инструкций, последовательность действий, команду).

Если да — извлеки:
- trigger: ключевые слова запроса (краткий паттерн)
- description: краткое описание процедуры
- steps: массив шагов (если можно определить, иначе пустой)
- domain: "technical" | "command" | "factual" | "casual"

Ответ СТРОГО в JSON (без markdown):
{"isProcedure":true,"trigger":"...","description":"...","steps":["шаг1","шаг2"],"domain":"technical"}

Если сообщение НЕ описывает процедуру:
{"isProcedure":false}`;

function parseProcedureResponse(
  response: string,
  classification?: ThalamusClassification,
): ProceduralPattern | null {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (!parsed.isProcedure) return null;

    const trigger = typeof parsed.trigger === "string" ? parsed.trigger : "";
    const description = typeof parsed.description === "string" ? parsed.description : trigger;
    const steps: string[] = [];
    if (Array.isArray(parsed.steps)) {
      for (const s of parsed.steps) {
        if (typeof s === "string") steps.push(s);
      }
    }
    const domain =
      typeof parsed.domain === "string"
        ? (parsed.domain as MessageDomain)
        : (classification?.domain ?? "unknown");

    if (!trigger || !isQualityTrigger(trigger)) return null;

    return {
      triggerPattern: trigger,
      description,
      steps,
      domain,
      confidence: 0.85,
    };
  } catch {
    return null;
  }
}

/**
 * AI-first procedural extraction: tries LLM first for semantic understanding,
 * falls back to regex patterns if AI unavailable or fails.
 */
export async function extractProcedureAsync(
  text: string,
  config: NeuroClawConfig,
  classification?: ThalamusClassification,
  logger?: { info: (msg: string) => void },
): Promise<ProceduralPattern | null> {
  if (isAIProviderAvailable(config)) {
    try {
      const aiResponse = await callLLM(PROCEDURE_PROMPT, text, config, logger, 300);
      if (aiResponse) {
        const parsed = parseProcedureResponse(aiResponse, classification);
        if (parsed) return parsed;
      }
    } catch (err) {
      logger?.info(`BrainAgent Procedural: AI extraction error — ${String(err)}`);
    }
  }

  // Fallback to regex patterns
  return extractProcedure(text, classification);
}
