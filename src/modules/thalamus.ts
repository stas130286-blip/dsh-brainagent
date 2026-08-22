/**
 * Thalamus — The brain's sensory gateway and message classifier.
 *
 * Every incoming signal in the brain passes through the thalamus, which
 * determines where it should be routed. Our Thalamus classifies each
 * incoming message by modality, domain, complexity, and intent — then
 * decides whether to engage the fast path (System 1, basal ganglia) or
 * the slow path (System 2, prefrontal cortex).
 *
 * Implementation: lightweight keyword + heuristic classifier that runs
 * in microseconds, no LLM call needed. This is the "reflex" classifier.
 */

import { bus } from "./event-bus.ts";
import type {
  MessageComplexity,
  MessageDomain,
  MessageModality,
  ThalamusClassification,
} from "./types.ts";

// ── Keyword dictionaries for fast classification ────────────────────

const URGENCY_KEYWORDS = [
  "срочно",
  "помогите",
  "помоги",
  "sos",
  "urgent",
  "emergency",
  "критично",
  "ошибка",
  "error",
  "сломалось",
  "не работает",
  "broken",
  "fix",
  "asap",
  "немедленно",
];

const EMOTIONAL_KEYWORDS = [
  "спасибо",
  "благодарю",
  "обожаю",
  "ненавижу",
  "грустно",
  "радость",
  "злюсь",
  "боюсь",
  "переживаю",
  "расстроен",
  "счастлив",
  "love",
  "hate",
  "sad",
  "happy",
  "angry",
  "afraid",
  "worried",
];

const TECHNICAL_KEYWORDS = [
  "код",
  "code",
  "api",
  "баг",
  "bug",
  "функция",
  "function",
  "сервер",
  "server",
  "база данных",
  "database",
  "deploy",
  "деплой",
  "git",
  "npm",
  "docker",
  "config",
  "конфиг",
  "typescript",
  "python",
  "nodejs",
  "react",
  "linux",
  "ssh",
  "curl",
  "json",
  "yaml",
];

const CREATIVE_KEYWORDS = [
  "напиши",
  "сочини",
  "придумай",
  "write",
  "create",
  "статья",
  "article",
  "история",
  "story",
  "стихи",
  "poem",
  "дизайн",
  "design",
  "рисунок",
  "image",
  "картинка",
  "логотип",
  "logo",
];

const COMMAND_PATTERNS = [
  /^\/\w+/,
  /^(сделай|запусти|открой|закрой|перезапусти|удали|установи|обнови)/i,
  /^(do|run|open|close|restart|delete|install|update|start|stop)\b/i,
];

// ── Classification logic ────────────────────────────────────────────

function detectModality(text: string, hasAttachments?: boolean): MessageModality {
  if (hasAttachments) return "mixed";
  return "text";
}

function countKeywordHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) count++;
  }
  return count;
}

function detectDomain(text: string): MessageDomain {
  const lower = text.toLowerCase();

  // Check for explicit commands first
  for (const pattern of COMMAND_PATTERNS) {
    if (pattern.test(lower)) return "command";
  }

  const techScore = countKeywordHits(text, TECHNICAL_KEYWORDS);
  const creativeScore = countKeywordHits(text, CREATIVE_KEYWORDS);
  const emotionalScore = countKeywordHits(text, EMOTIONAL_KEYWORDS);

  const scores: Array<[MessageDomain, number]> = [
    ["technical", techScore],
    ["creative", creativeScore],
    ["emotional", emotionalScore],
  ];

  scores.sort((a, b) => b[1] - a[1]);
  const [topDomain, topScore] = scores[0];

  if (topScore === 0) {
    // Short messages with no keywords → casual
    if (text.length < 30) return "casual";
    // Longer messages with question marks → factual
    if (text.includes("?")) return "factual";
    return "unknown";
  }

  return topDomain;
}

function detectComplexity(text: string): MessageComplexity {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length;
  const hasMultipleQuestions = (text.match(/\?/g) ?? []).length > 1;
  const hasListItems = /\d+\.\s|[-*]\s/.test(text);

  if (wordCount <= 5 && sentenceCount <= 1) return "trivial";
  if (wordCount <= 20 && !hasMultipleQuestions) return "simple";
  if (wordCount <= 80 && !hasListItems) return "moderate";
  if (wordCount <= 200) return "complex";
  return "extreme";
}

function decideFastOrSlow(domain: MessageDomain, complexity: MessageComplexity): "fast" | "slow" {
  // Trivial/simple always fast
  if (complexity === "trivial" || complexity === "simple") return "fast";
  // Commands are always fast-pathed
  if (domain === "command") return "fast";
  // Casual chat is fast
  if (domain === "casual" && complexity === "moderate") return "fast";
  // Everything else goes through deep reasoning
  return "slow";
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Classify an incoming message and broadcast the result on the brain bus.
 * Returns the classification synchronously (no LLM needed).
 */
export function classify(text: string, hasAttachments?: boolean): ThalamusClassification {
  const modality = detectModality(text, hasAttachments);
  const domain = detectDomain(text);
  const complexity = detectComplexity(text);
  const processingPath = decideFastOrSlow(domain, complexity);

  const intentSummary = buildIntentSummary(text, domain);

  const result: ThalamusClassification = {
    modality,
    domain,
    complexity,
    intentSummary,
    confidence:
      0.7 +
      (countKeywordHits(text, [
        ...TECHNICAL_KEYWORDS,
        ...CREATIVE_KEYWORDS,
        ...EMOTIONAL_KEYWORDS,
      ]) > 0
        ? 0.2
        : 0),
    processingPath,
  };

  // Broadcast to other brain modules via the corpus callosum
  bus.emitSync("thalamus:classified", result);

  return result;
}

function buildIntentSummary(text: string, domain: MessageDomain): string {
  const truncated = text.length > 100 ? text.slice(0, 100) + "..." : text;
  return `[${domain}] ${truncated}`;
}
