/**
 * Важность семантических фактов (v0.9.38) — что считать устойчивым
 * знанием о пользователе, а что служебным шумом.
 *
 * Боевой разбор живого стора: 518 фактов, 89 из них про резюме, а в
 * промпт уходили пять — и четыре были путями к файлам («Рабочая папка
 * прогона: D:/…», «ПРОТОКОЛ.md», «инструкция роли АРБИТР по пути …»).
 * Пиннинг отбирал по confidence, а storeFact накручивает +0.1 за каждое
 * повторное упоминание: пока месяц шёл конвейер, служебные строки звучали
 * в каждом ходе и дошли до 1.00, обогнав единожды упомянутое «проходил
 * собеседование на должность главного метролога» (0.70).
 *
 * Здесь важность отделена от уверенности: уверенность говорит, насколько
 * факт подтверждён, важность — насколько он вообще про человека.
 */

import type { SemanticMemory } from "./types.ts";

/** Категория → вес того, насколько факт описывает самого пользователя. */
const CATEGORY_WEIGHT: Record<string, number> = {
  user_info: 1,
  relationship: 0.6,
  user_preference: 0.85,
  plan: 0.7,
  problem: 0.7,
  knowledge: 0.6,
  definition: 0.6,
  "how-to": 0.55,
  solution: 0.5,
  entity: 0.45,
  opinion: 0.4,
  reference: 0.35,
  news: 0.25,
  dmn_insight: 0.2,
};

/** Пути, ссылки, имена файлов и длинные идентификаторы — не знание о человеке. */
const PATH_RE = /[A-Za-z]:[\\/]|\\\\|https?:\/\/|\bwww\./u;
const FILE_RE = /[\p{L}\p{N}_-]+\.(?:md|txt|json|ts|tsx|js|py|ya?ml|ini|log|pdf|docx?|html?)\b/iu;
const ID_RE = /\b\d{6,}\b|\b(?:id|ид)\s*[:№#]?\s*\d{3,}\b/iu;
const OPERATIONAL_RE =
  /рабочая папка|в пути|по пути|папк[а-я]*|строго по схеме|формат ответа|промпт|роль[а-я]*\s+[^.]{0,20}«/iu;

/** Речевой акт — это событие диалога, а не свойство пользователя. */
const TRIVIA_RE =
  /^(?:пользователь\s+)?(?:упоминает|обсуждает|просматривает|смотрит|пишет|сообщает|интересуется)/iu;

/** Устойчивые атрибуты: имя, работа, опыт, резюме, поиск работы. */
const IDENTITY_RE = /^имя пользователя|^полное имя/iu;
const STABLE_RE =
  /пользователь\s+(?:работает|работал|живёт|живет|родился)|професси|специальност|образовани|опыт работ|трудовой стаж|резюме|собеседовани|автобиограф/iu;

export function isDurableFact(content: string): boolean {
  const c = content.trim();
  if (c.length < 8) return false;
  if (PATH_RE.test(c) || FILE_RE.test(c) || ID_RE.test(c)) return false;
  if (OPERATIONAL_RE.test(c)) return false;
  return true;
}

export function isTriviaFact(content: string): boolean {
  return TRIVIA_RE.test(content.trim());
}

/**
 * Вес факта для отбора в промпт: категория × confidence × устойчивость.
 * Служебные факты получают 0 и в пиннинг не попадают вовсе.
 */
export function factImportance(fact: SemanticMemory): number {
  const content = fact.content ?? "";
  if (!isDurableFact(content)) return 0;
  const categoryWeight = CATEGORY_WEIGHT[fact.category] ?? 0.3;
  let score = (fact.confidence ?? 0.5) * categoryWeight;
  if (isTriviaFact(content)) score *= 0.35;
  if (IDENTITY_RE.test(content)) score *= 1.35;
  else if (STABLE_RE.test(content)) score *= 1.2;
  return score;
}

/** Упорядочить факты по важности; служебные (вес 0) отбрасываются. */
export function rankFactsByImportance(facts: readonly SemanticMemory[]): SemanticMemory[] {
  return facts
    .map((fact) => ({ fact, score: factImportance(fact) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (b.fact.confidence ?? 0) - (a.fact.confidence ?? 0))
    .map((entry) => entry.fact);
}
