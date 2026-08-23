/**
 * I18n Heuristics — общий банк русских и английских эвристик.
 *
 * До v0.2.0 каждый модуль держал собственный набор паттернов
 * (basal-ganglia, thalamus, mirror-neurons...), наборы расходились,
 * а русское покрытие было неполным. Этот модуль — единая точка:
 *
 *  - POSITIVE_PATTERNS   — похвала, благодарность, одобрение
 *  - NEGATIVE_PATTERNS   — коррекции: «неправильно», «переделай»
 *  - REJECTION_PATTERNS  — «не зашло»: просьбы прекратить, неинтерес
 *                          к теме (используется proactive-feedback)
 *
 * Порядок классификации в classifyFeedback(): отвержение → негатив →
 * позитив. Сильнейшее недовольство пользователя важнее похвалы:
 * лучше недооценить позитив, чем проигнорировать просьбу остановиться.
 */

export type FeedbackSignal = "positive" | "negative" | "rejection" | "neutral";

export type FeedbackClassification = {
  signal: FeedbackSignal;
  /** Человекочитаемые метки сработавших паттернов (диагностика). */
  hits: string[];
};

// ── Позитив: похвала, благодарность, одобрение ─────────────────────

export const POSITIVE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  // Русский
  { re: /спасибо/i, label: "спасибо" },
  { re: /благодар(?:ю|ствую)/i, label: "благодарю" },
  { re: /отлично/i, label: "отлично" },
  { re: /супер/i, label: "супер" },
  { re: /круто/i, label: "круто" },
  { re: /класс(?:но)?/i, label: "класс" },
  { re: /молодец/i, label: "молодец" },
  { re: /умница/i, label: "умница" },
  { re: /здорово/i, label: "здорово" },
  { re: /идеально/i, label: "идеально" },
  { re: /в\s+точку/i, label: "в точку" },
  { re: /именно\s+то/i, label: "именно то" },
  { re: /(?<![а-яё])топ(?![а-яё])/i, label: "топ" },
  { re: /(?<![а-яё])огонь(?![а-яё])/i, label: "огонь" },
  { re: /помогло/i, label: "помогло" },
  { re: /работает/i, label: "работает" },
  // English
  { re: /perfect/i, label: "perfect" },
  { re: /great/i, label: "great" },
  { re: /thanks/i, label: "thanks" },
  { re: /thank\s+you/i, label: "thank you" },
  { re: /awesome/i, label: "awesome" },
  { re: /excellent/i, label: "excellent" },
  { re: /good\s+job/i, label: "good job" },
  { re: /nice/i, label: "nice" },
  { re: /love\s+it/i, label: "love it" },
  { re: /well\s+done/i, label: "well done" },
  { re: /that\s+helped/i, label: "that helped" },
];

// ── Негатив: коррекция результата ──────────────────────────────────

export const NEGATIVE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  // Русский
  { re: /не\s+то(?![а-яё])/i, label: "не то" },
  { re: /неправильно/i, label: "неправильно" },
  { re: /ошибка/i, label: "ошибка" },
  { re: /переделай/i, label: "переделай" },
  { re: /заново/i, label: "заново" },
  { re: /не\s+так(?![а-яё])/i, label: "не так" },
  { re: /плохо/i, label: "плохо" },
  { re: /неверно/i, label: "неверно" },
  { re: /не\s+получилось/i, label: "не получилось" },
  { re: /не\s+работает/i, label: "не работает" },
  { re: /ты\s+меня\s+не\s+понял/i, label: "ты меня не понял" },
  // English
  { re: /wrong/i, label: "wrong" },
  { re: /incorrect/i, label: "incorrect" },
  { re: /redo/i, label: "redo" },
  { re: /\bfix\b/i, label: "fix" },
  { re: /try\s+again/i, label: "try again" },
  { re: /no,?\s+that'?s\s+not/i, label: "that's not it" },
  { re: /you\s+misunderstood/i, label: "misunderstood" },
];

// ── Отвержение: «не зашло» — прекратить, тема не интересна ─────────

export const REJECTION_PATTERNS: Array<{ re: RegExp; label: string }> = [
  // Русский
  { re: /не\s+надо(?![а-яё])/i, label: "не надо" },
  { re: /(?<![а-яё])хватит(?![а-яё])/i, label: "хватит" },
  { re: /перестань/i, label: "перестань" },
  { re: /прекрати/i, label: "прекрати" },
  { re: /отстань/i, label: "отстань" },
  { re: /(?<![а-яё])забей(?![а-яё])/i, label: "забей" },
  { re: /не\s+интересно/i, label: "не интересно" },
  { re: /мне\s+это\s+не\s+(?:нужно|интересно)/i, label: "мне это не нужно" },
  { re: /больше\s+(?:так\s+)?не\s+(?:делай|пиши|говори)/i, label: "больше не делай" },
  { re: /не\s+заводи/i, label: "не заводи" },
  { re: /достало/i, label: "достало" },
  { re: /задолбало/i, label: "задолбало" },
  { re: /бесишь/i, label: "бесишь" },
  { re: /замолчи/i, label: "замолчи" },
  // English
  { re: /stop\s+it/i, label: "stop it" },
  { re: /don'?t\s+(?:do|say|mention|bring\s+up)\b/i, label: "don't do that" },
  { re: /not\s+interested/i, label: "not interested" },
  { re: /\bleave\s+it\b/i, label: "leave it" },
  { re: /\bdrop\s+it\b/i, label: "drop it" },
  { re: /cut\s+it\s+out/i, label: "cut it out" },
  { re: /knock\s+it\s+off/i, label: "knock it off" },
  { re: /shut\s+up/i, label: "shut up" },
  { re: /leave\s+me\s+alone/i, label: "leave me alone" },
];

// ── Классификация ──────────────────────────────────────────────────

function matchBank(
  text: string,
  bank: Array<{ re: RegExp; label: string }>,
): string[] {
  const hits: string[] = [];
  for (const { re, label } of bank) {
    if (re.test(text)) hits.push(label);
  }
  return hits;
}

/**
 * Классифицировать сообщение пользователя как обратную связь.
 *
 * Приоритет: отвержение → негатив → позитив → нейтраль.
 * Пустой или чисто технический текст даёт neutral.
 */
export function classifyFeedback(text: string): FeedbackClassification {
  const trimmed = text.trim();
  if (!trimmed) return { signal: "neutral", hits: [] };

  const rejectionHits = matchBank(trimmed, REJECTION_PATTERNS);
  if (rejectionHits.length > 0) {
    return { signal: "rejection", hits: rejectionHits };
  }

  const negativeHits = matchBank(trimmed, NEGATIVE_PATTERNS);
  if (negativeHits.length > 0) {
    return { signal: "negative", hits: negativeHits };
  }

  const positiveHits = matchBank(trimmed, POSITIVE_PATTERNS);
  if (positiveHits.length > 0) {
    return { signal: "positive", hits: positiveHits };
  }

  return { signal: "neutral", hits: [] };
}

/**
 * Определить доминирующий язык текста (для i18n-диагностики).
 */
export function detectLanguage(text: string): "ru" | "en" | "mixed" {
  const cyrillic = (text.match(/[а-яё]/gi) ?? []).length;
  const latin = (text.match(/[a-z]/gi) ?? []).length;
  if (cyrillic === 0 && latin === 0) return "en";
  if (latin === 0) return "ru";
  if (cyrillic === 0) return "en";
  return cyrillic >= latin ? "ru" : "en";
}
