/**
 * Semantic Extractor — Automatic fact extraction from conversations.
 *
 * The brain doesn't just remember events (episodic) — it extracts
 * meaning and relationships (semantic). When you tell me "I work at Google",
 * I don't just remember the conversation — I extract the FACT that
 * you work at Google, and that fact becomes reusable knowledge.
 *
 * This module detects patterns in user messages that indicate:
 * - User preferences ("мне нравится X", "я предпочитаю Y")
 * - User facts ("я работаю в X", "меня зовут Y", "мой номер Z")
 * - Relationships ("X связан с Y", "X это часть Y")
 * - Definitions ("X это Y", "X означает Y")
 */

import type { ThalamusClassification } from "./types.ts";

export type ExtractedFact = {
  content: string;
  category: FactCategory;
  confidence: number;
  entities: string[];
};

export type FactCategory =
  | "user_preference" // Preferences: likes, dislikes
  | "user_info" // Personal info: name, job, location
  | "entity" // Named entities: people, places, things
  | "relationship" // X is related to Y
  | "definition" // X is/means Y
  | "plan" // Future intentions
  | "problem" // Issues, complaints
  | "solution"; // Resolved issues

// ── Pattern definitions ─────────────────────────────────────────────

type FactPattern = {
  pattern: RegExp;
  category: FactCategory;
  /** Confidence boost when this pattern matches (base is 0.5) */
  confidenceBoost: number;
  /** Function to extract the fact content from the match */
  extract: (match: RegExpMatchArray, fullText: string) => string;
};

const FACT_PATTERNS: FactPattern[] = [
  // ═══════════════════════════════════════════════════════════════════
  // USER PREFERENCES (Russian) - NEGATIVE patterns FIRST to match before positive
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /(?:мне\s+)?(?:очень\s+)?не\s*нравится\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.3,
    extract: (m) => `Пользователю НЕ нравится: ${m[1].trim()}`,
  },
  {
    pattern: /(?:мне\s+)?(?:очень\s+)?нравится\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.3,
    extract: (m) => `Пользователю нравится: ${m[1].trim()}`,
  },
  {
    pattern: /(?:я\s+)?(?:очень\s+)?люблю\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.35,
    extract: (m) => `Пользователь любит: ${m[1].trim()}`,
  },
  {
    pattern: /(?:я\s+)?(?:очень\s+)?ненавижу\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.35,
    extract: (m) => `Пользователь ненавидит: ${m[1].trim()}`,
  },
  {
    pattern: /(?:я\s+)?предпочитаю\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.3,
    extract: (m) => `Пользователь предпочитает: ${m[1].trim()}`,
  },
  {
    pattern: /(?:мой|моя|мое|мои)\s+любимы[йяео]+\s+(.+?)\s+(?:это|[-—])\s*(.+?)(?:\.|$)/i,
    category: "user_preference",
    confidenceBoost: 0.35,
    extract: (m) => `Любимый ${m[1].trim()} пользователя: ${m[2].trim()}`,
  },

  // ═══════════════════════════════════════════════════════════════════
  // USER PREFERENCES (English)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /i\s+(?:really\s+)?like\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.3,
    extract: (m) => `User likes: ${m[1].trim()}`,
  },
  {
    pattern: /i\s+(?:really\s+)?(?:don'?t|do\s+not)\s+like\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.3,
    extract: (m) => `User dislikes: ${m[1].trim()}`,
  },
  {
    pattern: /i\s+(?:really\s+)?love\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.35,
    extract: (m) => `User loves: ${m[1].trim()}`,
  },
  {
    pattern: /i\s+prefer\s+(.+?)(?:\.|$|,)/i,
    category: "user_preference",
    confidenceBoost: 0.3,
    extract: (m) => `User prefers: ${m[1].trim()}`,
  },
  {
    pattern: /my\s+favorite\s+(.+?)\s+is\s+(.+?)(?:\.|$)/i,
    category: "user_preference",
    confidenceBoost: 0.35,
    extract: (m) => `User's favorite ${m[1].trim()}: ${m[2].trim()}`,
  },

  // ═══════════════════════════════════════════════════════════════════
  // USER INFO (Russian)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /меня\s+зовут\s+([А-ЯЁа-яёA-Za-z]+)/i,
    category: "user_info",
    confidenceBoost: 0.4,
    extract: (m) => `Имя пользователя: ${m[1].trim()}`,
  },
  {
    pattern: /(?:я\s+)?работаю\s+(?:в|на)\s+(.+?)(?:\.|$|,)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `Место работы пользователя: ${m[1].trim()}`,
  },
  // Job title without preposition: "Работаю главным метрологом на заводе"
  {
    pattern:
      /(?:я\s+)?работаю\s+(?!(?:в|на)\s)([А-ЯЁа-яё]+(?:\s+[а-яё]+)*?)(?:\s+(?:в|на)\s+(.+?))?(?:\.|$|,)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => {
      const job = m[1].trim();
      const place = m[2]?.trim();
      if (place) return `Должность пользователя: ${job}, ${place}`;
      return `Должность пользователя: ${job}`;
    },
  },
  {
    pattern: /я\s+(?:живу|нахожусь|проживаю)\s+в\s+([А-ЯЁа-яё][а-яё]+(?:[-\s][А-ЯЁа-яё][а-яё]+)*)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `Местоположение пользователя: ${m[1].trim()}`,
  },
  {
    pattern:
      /(?:мой|моя|мое)\s+(телефон|номер|email|почта|адрес)\s+(?:это|[-—:])?\s*(.+?)(?:\.|$)/i,
    category: "user_info",
    confidenceBoost: 0.4,
    extract: (m) => `${m[1].trim()} пользователя: ${m[2].trim()}`,
  },
  {
    pattern: /мне\s+(\d+)\s+(?:лет|год|года)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `Возраст пользователя: ${m[1]} лет`,
  },
  {
    pattern: /(?:я\s+)?по\s+профессии\s+(.+?)(?:\.|$|,)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `Профессия пользователя: ${m[1].trim()}`,
  },
  // Zodiac sign
  {
    pattern: /(?:я\s+)?по\s+знаку\s+(?:зодиака\s+)?[-—]?\s*([А-ЯЁа-яё]+)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `Знак зодиака пользователя: ${m[1].trim()}`,
  },
  {
    pattern: /(?:мой|моя)\s+знак\s+(?:зодиака\s+)?[-—:]?\s*([А-ЯЁа-яё]+)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `Знак зодиака пользователя: ${m[1].trim()}`,
  },
  // Birth date
  {
    pattern:
      /родил(?:ся|ась)\s+(?:в\s+)?(\d{1,2})\s*(?:числа|го)?\s*(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)?/i,
    category: "user_info",
    confidenceBoost: 0.4,
    extract: (m) => `Дата рождения пользователя: ${m[1]}${m[2] ? " " + m[2].trim() : ""}`,
  },
  {
    pattern:
      /(?:мой\s+)?день\s+рождения\s+(?:[-—:]?\s*)?(\d{1,2})\s*(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i,
    category: "user_info",
    confidenceBoost: 0.4,
    extract: (m) => `День рождения пользователя: ${m[1]} ${m[2].trim()}`,
  },
  {
    pattern:
      /родил(?:ся|ась)\s+в\s+(январе|феврале|марте|апреле|мае|июне|июле|августе|сентябре|октябре|ноябре|декабре)\s+(\d{1,2})\s*числа/i,
    category: "user_info",
    confidenceBoost: 0.4,
    extract: (m) => `Дата рождения пользователя: ${m[2]} ${m[1].trim()}`,
  },
  {
    pattern:
      /у\s+меня\s+есть\s+(собака|кошка|кот|машина|дом|квартира|дети|ребенок|автомобиль|авто)\s*(.*)(?:\.|$)/i,
    category: "user_info",
    confidenceBoost: 0.3,
    extract: (m) => `У пользователя есть: ${m[1].trim()}${m[2] ? " " + m[2].trim() : ""}`,
  },
  // More general possession pattern (captures brands like "Land Rover")
  {
    pattern: /у\s+меня\s+(?:есть\s+)?([A-Z][a-zA-Z]*(?:\s+[A-Z]?[a-zA-Z]*)*(?:\s+\d+)?)/i,
    category: "user_info",
    confidenceBoost: 0.25,
    extract: (m) => `У пользователя есть: ${m[1].trim()}`,
  },
  // Medical conditions
  {
    pattern:
      /у\s+меня\s+(вывих|перелом|артрит|грыжа|травма|болезнь|проблем[аы]?\s+(?:с|со)\s+\S+)\s*(.*)(?:\.|$)/i,
    category: "problem",
    confidenceBoost: 0.35,
    extract: (m) => `Медицинская проблема: ${m[1].trim()}${m[2] ? " " + m[2].trim() : ""}`,
  },
  {
    pattern: /(?:привычный|хронический)\s+(вывих|перелом|артрит|болезнь)\s+(\S+)/i,
    category: "problem",
    confidenceBoost: 0.4,
    extract: (m) => `Медицинская проблема: привычный ${m[1].trim()} ${m[2].trim()}`,
  },

  // ═══════════════════════════════════════════════════════════════════
  // USER INFO (English)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /my\s+name\s+is\s+([A-Za-z]+)/i,
    category: "user_info",
    confidenceBoost: 0.4,
    extract: (m) => `User's name: ${m[1].trim()}`,
  },
  {
    pattern: /i\s+work\s+(?:at|for|in)\s+(.+?)(?:\.|$|,)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `User works at: ${m[1].trim()}`,
  },
  {
    pattern: /i\s+live\s+in\s+(.+?)(?:\.|$|,)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `User lives in: ${m[1].trim()}`,
  },
  {
    pattern: /i\s+am\s+(\d+)\s+years?\s+old/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `User's age: ${m[1]}`,
  },
  {
    pattern: /i\s+(?:am\s+)?a\s+(.+?)\s+(?:by\s+profession|professionally)/i,
    category: "user_info",
    confidenceBoost: 0.35,
    extract: (m) => `User's profession: ${m[1].trim()}`,
  },

  // ═══════════════════════════════════════════════════════════════════
  // PROBLEMS & PLANS (Russian)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /у\s+меня\s+(?:проблема|болит|сломал(?:ся|ась)?|не\s+работает)\s+(.+?)(?:\.|$|,)/i,
    category: "problem",
    confidenceBoost: 0.25,
    extract: (m) => `Проблема пользователя: ${m[1].trim()}`,
  },
  {
    pattern: /(?:мне\s+)?нужно\s+(.+?)(?:\.|$|,)/i,
    category: "plan",
    confidenceBoost: 0.2,
    extract: (m) => `Пользователю нужно: ${m[1].trim()}`,
  },
  {
    pattern: /(?:я\s+)?(?:планирую|собираюсь|хочу)\s+(.+?)(?:\.|$|,)/i,
    category: "plan",
    confidenceBoost: 0.25,
    extract: (m) => `План пользователя: ${m[1].trim()}`,
  },
  {
    pattern: /(?:мне\s+)?(?:надо|необходимо)\s+(.+?)(?:\.|$|,)/i,
    category: "plan",
    confidenceBoost: 0.2,
    extract: (m) => `Необходимо: ${m[1].trim()}`,
  },

  // ═══════════════════════════════════════════════════════════════════
  // DEFINITIONS & RELATIONSHIPS (Russian)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /(.+?)\s+(?:это|[-—])\s+(.+?)(?:\.|$)/i,
    category: "definition",
    confidenceBoost: 0.15,
    extract: (m, text) => {
      // Only extract if both parts are substantial
      const subject = m[1].trim();
      const definition = m[2].trim();
      if (subject.length > 2 && definition.length > 5 && subject.split(/\s+/).length <= 4) {
        return `${subject} = ${definition}`;
      }
      return "";
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // SOLUTIONS (Russian)
  // ═══════════════════════════════════════════════════════════════════
  {
    pattern: /(?:решил|исправил|починил|сделал)\s+(.+?)(?:\.|$|,)/i,
    category: "solution",
    confidenceBoost: 0.25,
    extract: (m) => `Решено: ${m[1].trim()}`,
  },
  {
    pattern: /(?:проблема|вопрос)\s+(?:с\s+)?(.+?)\s+(?:решен|решён|закрыт)/i,
    category: "solution",
    confidenceBoost: 0.3,
    extract: (m) => `Решена проблема с: ${m[1].trim()}`,
  },
];

// ── Named entity extraction ─────────────────────────────────────────

/**
 * Extract named entities (proper nouns, technical terms).
 * Very basic implementation — looks for capitalized words and known patterns.
 */
function extractEntities(text: string): string[] {
  const entities: string[] = [];

  // Capitalized words (but not at sentence start) — likely proper nouns
  const capsPattern = /(?:^|[.!?]\s+)([А-ЯЁA-Z][а-яёa-z]+(?:\s+[А-ЯЁA-Z][а-яёa-z]+)*)/g;
  let match;
  while ((match = capsPattern.exec(text)) !== null) {
    if (match[1].length > 2) {
      entities.push(match[1]);
    }
  }

  // Technical terms (likely important)
  const techTerms = text.match(
    /\b(?:API|URL|HTTP|JSON|SQL|CSS|HTML|Docker|Git|npm|Node|React|TypeScript|Python)\b/gi,
  );
  if (techTerms) {
    entities.push(...techTerms);
  }

  return [...new Set(entities)];
}

// ── Main extraction function ────────────────────────────────────────

/**
 * Extract facts from user input text.
 * Returns an array of facts with confidence scores.
 *
 * Only returns facts with confidence > 0.5 to avoid noise.
 */
export function extractFacts(
  text: string,
  classification?: ThalamusClassification,
): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const entities = extractEntities(text);

  // Apply each pattern
  for (const factPattern of FACT_PATTERNS) {
    const match = text.match(factPattern.pattern);
    if (!match) continue;

    const content = factPattern.extract(match, text);
    if (!content || content.length < 5) continue;

    // Calculate confidence
    let confidence = 0.5 + factPattern.confidenceBoost;

    // Boost confidence based on classification
    if (classification) {
      // Factual domain → higher confidence for facts
      if (classification.domain === "factual") {
        confidence += 0.1;
      }
      // Lower confidence for casual chat (might be jokes/sarcasm)
      if (classification.domain === "casual") {
        confidence -= 0.05;
      }
      // High confidence classification → higher confidence facts
      confidence += (classification.confidence - 0.7) * 0.2;
    }

    // Clamp to [0, 1]
    confidence = Math.max(0, Math.min(1, confidence));

    // Only keep facts with confidence > 0.4
    if (confidence > 0.4) {
      facts.push({
        content,
        category: factPattern.category,
        confidence,
        entities,
      });
    }
  }

  // Deduplicate by content similarity (NOT by category - we want multiple facts per category)
  const uniqueFacts: ExtractedFact[] = [];
  for (const fact of facts) {
    const isDuplicate = uniqueFacts.some(
      (f) => f.content.toLowerCase() === fact.content.toLowerCase(),
    );
    if (!isDuplicate) {
      uniqueFacts.push(fact);
    }
  }

  return uniqueFacts;
}

/**
 * Check if a message is worth extracting facts from.
 * Short messages, greetings, and commands usually don't contain facts.
 */
export function isFactWorthy(text: string, classification?: ThalamusClassification): boolean {
  // Too short
  if (text.length < 15) return false;

  // Commands don't contain facts
  if (classification?.domain === "command") return false;

  // Check for greeting/small-talk patterns — but only reject SHORT messages.
  // "Привет! Я по знаку зодиака водолей" should NOT be rejected.
  const trimmed = text.trim();

  // One-word replies (exact match, short)
  if (/^(ок|ok|да|нет|угу|ага|ладно|хорошо|понял|спасибо|thanks)$/i.test(trimmed)) return false;

  // Pure greetings — only block if the message is short (< 40 chars)
  if (
    trimmed.length < 40 &&
    /^(привет|здравствуй|добрый|пока|до свидания|спокойной|hello|hi|bye|good\s+(morning|evening|night))/i.test(
      trimmed,
    )
  ) {
    return false;
  }

  return true;
}
