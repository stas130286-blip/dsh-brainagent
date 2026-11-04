/**
 * Memory Identity Pinning (v0.9.12) — гарантия, что ключевые факты о
 * пользователе доходят до модели независимо от релевантности запроса.
 *
 * Боевое тестирование показало: recall чисто релевантен (TF-IDF +
 * эмбеддинги), и на вопросе «что ты знаешь обо мне?» имя пользователя
 * могло не попасть в top-N — особенно при недоступном эмбеддинг-бэкенде
 * (лексический fallback). В итоге модель честно отвечала «не знаю»,
 * хотя факт лежал в сторе с высоким confidence.
 *
 * Пиннинг подмешивает топ user_info-фактов в начало semantic-recall
 * каждого цикла: identity-факты — это не «релевантный контекст», а
 * базовое знание агента о пользователе.
 *
 * v0.9.22: вызывающий код передаёт также факты категории «имущество»
 * (имя сервера, питомца и т.п.) — они не должны теряться в топ-по
 * сходству (боевой кросс-сессионный тест: факт об имени сервера был в
 * сторе, но модель честно отвечала «не помню», потому что контекст не
 * доехал).
 */

import type { SemanticMemory } from "./types.ts";
import { rankFactsByImportance } from "./fact-importance.ts";

/**
 * Подмешать identity-факты в результаты recall.
 *
 * Уже присутствующие в recall факты не дублируются; закреплённые
 * факты идут ПЕРВЫМИ, чтобы сборка контекста (slice(0, 5)) их не
 * отсекла. Порядок identity-фактов ожидается отсортированным по
 * confidence (getFactsByCategory это обеспечивает).
 */
export function pinIdentityFacts(
  recalled: readonly SemanticMemory[],
  identityFacts: readonly SemanticMemory[],
  maxPinned = 3,
): SemanticMemory[] {
  const present = new Set(recalled.map((f) => f.id));
  const pinned = identityFacts.filter((f) => !present.has(f.id)).slice(0, maxPinned);
  return [...pinned, ...recalled];
}

// ── v0.9.38: отбор базового знания ──────────────────────────────────

/**
 * Вопрос о самом пользователе. Здесь работает не поиск по сходству, а
 * дайджест: «что ты знаешь обо мне» не делит ни одного слова с
 * «Пользователь откликнулся на вакансию», поэтому TF-IDF при таком
 * вопросе возвращает случайный топ.
 */
const SELF_QUERY_RE =
  /(?:обо|о\s+бо)\s+мне|про\s+меня|кто\s+я(?!\p{L})|мо[йяеё]\S{0,3}\s+(?:резюме|опыт|работ|професси|биограф|семь|город|жизн|карьер)|what\s+do\s+you\s+(?:know|remember)\s+about\s+me|who\s+am\s+i/iu;

export function isSelfQuery(input: string): boolean {
  return SELF_QUERY_RE.test(input);
}

/**
 * v0.9.39: вопрос о прошлых разговорах, а не о теме. На «что мы обсуждали»
 * лексике не за что зацепиться — ни одно слово вопроса не встречается в
 * эпизодах. Такой запрос обслуживает откат по времени, а не сходство.
 */
const CONVERSATION_QUERY_RE =
  /помн[а-яё]*|обсужд[а-яё]+|обсуждал[а-яё]*|разговар[а-яё]+|говорили|в\s+прошл[а-яё]+\s+раз|на\s+прошл[а-яё]+\s+недел|позавчера|вчера|недавно|what\s+did\s+we\s+(?:discuss|talk)|do\s+you\s+remember|last\s+time/iu;

export function isConversationQuery(input: string): boolean {
  return CONVERSATION_QUERY_RE.test(input);
}

/** Слоты базового знания на обычном ходу. */
export const PINNED_FACT_SLOTS = 3;
/** Слоты дайджеста на вопросе о себе. */
export const SELF_DIGEST_SLOTS = 12;
const ENTITY_SLOTS_IN_DIGEST = 2;

/** Базовое знание: отбирается по важности, а не по голому confidence. */
export function selectPinnedFacts(
  facts: readonly SemanticMemory[],
  max = PINNED_FACT_SLOTS,
): SemanticMemory[] {
  return rankFactsByImportance(facts).slice(0, max);
}

/**
 * Дайджест «кто такой пользователь»: устойчивые факты по важности плюс
 * пара фактов-«имущество» (имя сервера, питомец) — их сохранял v0.9.22.
 */
export function buildSelfDigest(
  facts: readonly SemanticMemory[],
  max = SELF_DIGEST_SLOTS,
): SemanticMemory[] {
  const ranked = rankFactsByImportance(facts);
  const possession = ranked.filter(
    (f) => f.category === "entity" || f.category === "relationship",
  );
  const main = ranked
    .filter((f) => f.category !== "entity" && f.category !== "relationship")
    .slice(0, Math.max(0, max - ENTITY_SLOTS_IN_DIGEST));
  return dedupeSimilar([...main, ...possession.slice(0, ENTITY_SLOTS_IN_DIGEST)]).slice(0, max);
}

const STOP_TOKEN_RE = /^(?:пользователь|пользователя|который|которая|также|этого|этому)$/iu;

function significantTokens(content: string): Set<string> {
  const words = content
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_TOKEN_RE.test(w));
  return new Set(words);
}

function tooSimilar(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / (a.size + b.size - shared) >= 0.6;
}

/** Отбросить факты, повторяющие уже взятые другими словами. */
function dedupeSimilar(facts: readonly SemanticMemory[]): SemanticMemory[] {
  const kept: SemanticMemory[] = [];
  const tokenSets: Set<string>[] = [];
  for (const fact of facts) {
    const tokens = significantTokens(fact.content);
    if (tokenSets.some((seen) => tooSimilar(seen, tokens))) continue;
    kept.push(fact);
    tokenSets.push(tokens);
  }
  return kept;
}
