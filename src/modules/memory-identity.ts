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
 */

import type { SemanticMemory } from "./types.ts";

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
