/**
 * AI Fact Extractor — Neural network-based fact extraction (PRIMARY).
 *
 * This module uses an LLM to intelligently extract facts from user messages.
 * Unlike pattern-based extraction which only catches specific phrases,
 * AI extraction understands context and meaning.
 *
 * AI is the primary extraction method. Pattern-based extraction
 * (semantic-extractor.ts) serves as offline fallback when no provider is available.
 */

import type { HostConfig as NeuroClawConfig } from "./host-config.ts";
import { callLLM, isAIProviderAvailable as _isAIProviderAvailable } from "./llm-client.ts";
import type { FactCategory } from "./semantic-extractor.ts";

export type AIExtractedFact = {
  content: string;
  category: FactCategory;
  confidence: number;
};

const EXTRACTION_PROMPT = `Ты — система извлечения фактов из сообщений пользователя.

Твоя задача: найти и извлечь ВСЕ ФАКТЫ о пользователе из его сообщения.

Категории фактов:
- user_preference: предпочтения, хобби, интересы ("нравится X", "люблю Y", "предпочитаю Z")
- user_info: информация о пользователе (имя, возраст, город, работа, должность, знак зодиака, дата рождения, имущество)
- entity: именованные объекты, компании, бренды, места, которые упоминает пользователь
- relationship: связи между объектами ("X связан с Y")
- definition: определения ("X это Y", "X означает Y")
- problem: проблемы пользователя (болезни, поломки, трудности)
- plan: планы и намерения ("нужно сделать X", "собираюсь Y", "планирую Z")
- solution: решённые проблемы

Правила:
1. Извлекай только ЯВНЫЕ факты, не додумывай
2. Каждый факт должен быть самодостаточным предложением
3. Confidence от 0.5 до 1.0 (насколько ты уверен)
4. Если фактов нет — верни пустой массив
5. ВАЖНО: перечисления через "и"/"," разбивай на ОТДЕЛЬНЫЕ факты.
   Пример: "люблю рыбалку и онлайн игры" → ДВА факта:
   {"content": "Пользователь любит рыбалку", "category": "user_preference", "confidence": 0.85}
   {"content": "Пользователь любит онлайн игры", "category": "user_preference", "confidence": 0.85}
6. Должность и место работы — отдельные факты.
   Пример: "работаю главным метрологом на заводе" →
   {"content": "Должность пользователя: главный метролог", "category": "user_info", "confidence": 0.9}
   {"content": "Место работы: завод", "category": "user_info", "confidence": 0.9}

Ответ ТОЛЬКО в формате JSON массива:
[
  {"content": "...", "category": "...", "confidence": 0.X},
  ...
]`;

/**
 * Extract facts using AI (LLM).
 * Automatically detects which provider is configured and uses it.
 * Returns empty array if no provider is configured or extraction fails.
 */
export async function extractFactsWithAI(
  text: string,
  config: NeuroClawConfig,
  logger?: { info: (msg: string) => void },
): Promise<AIExtractedFact[]> {
  const content = await callLLM(EXTRACTION_PROMPT, text, config, logger, 500);
  if (!content) return [];

  const facts = parseFactsFromResponse(content);
  if (facts.length > 0) {
    logger?.info(`BrainAgent AI Extractor: found ${facts.length} facts`);
  }
  return facts;
}

/**
 * Parse facts from LLM response.
 * Handles various response formats and validates the output.
 */
function parseFactsFromResponse(content: string): AIExtractedFact[] {
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as unknown[];
    if (!Array.isArray(parsed)) return [];

    const validCategories: FactCategory[] = [
      "user_preference",
      "user_info",
      "entity",
      "relationship",
      "definition",
      "plan",
      "problem",
      "solution",
    ];

    const facts: AIExtractedFact[] = [];

    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;

      const obj = item as Record<string, unknown>;
      const factContent = obj.content;
      const category = obj.category;
      const confidence = obj.confidence;

      if (typeof factContent !== "string" || factContent.length < 3) continue;
      if (typeof category !== "string" || !validCategories.includes(category as FactCategory))
        continue;

      const conf =
        typeof confidence === "number"
          ? confidence
          : typeof confidence === "string"
            ? parseFloat(confidence)
            : 0.7;

      if (conf < 0.5 || conf > 1.0) continue;

      facts.push({
        content: factContent,
        category: category as FactCategory,
        confidence: conf,
      });
    }

    return facts;
  } catch {
    return [];
  }
}

/**
 * Check if an AI provider is available for fact extraction.
 * Re-exported from llm-client for backward compatibility.
 */
export function isAIProviderAvailable(config: NeuroClawConfig): boolean {
  return _isAIProviderAvailable(config);
}
