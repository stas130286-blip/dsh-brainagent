/**
 * Message Guard — фильтрация собственных служебных сообщений плагина (v0.2.1).
 *
 * Внутренний контекст BrainAgent вливается в промпт и — по правилу
 * «видно моделью = пиши в лог» — попадает в журнал сессии как
 * user/message. До v0.2.1 наблюдатель обрабатывал такие сообщения
 * как настоящие реплики пользователя: таламус их классифицировал,
 * базальные ганглии учили на них «привычки», любопытство предлагало
 * их «обсудить», а эпизодическая память копила мусор — агент
 * отравлял сам себя собственным контекстом.
 *
 * Этот модуль — единая точка фильтрации: сообщения, начинающиеся
 * с наших служебных маркеров, игнорируются контуром обучения.
 */

import { AUTONOMOUS_FRAME_PREFIX, AUTONOMY_MEMORIES_PREFIX } from "./autonomy-markers.ts";

/** Служебные маркеры собственных сообщений плагина. */
export const INTERNAL_MESSAGE_PREFIXES = [
  "<brainagent-context>",
  "<autonomous-intent>",
  // v0.5.1: проактивная доставка приходит с фреймингом перед тегом —
  // распознаём и его, чтобы доставленный промпт не обрабатывался
  // контуром обучения как реплика пользователя.
  AUTONOMOUS_FRAME_PREFIX,
  // v0.9.1: блок воспоминаний автономи-энричера — тоже служебный.
  AUTONOMY_MEMORIES_PREFIX,
] as const;

/** Является ли сообщение собственным служебным сообщением плагина? */
export function isInternalPluginMessage(text: string): boolean {
  const trimmed = text.trimStart();
  return INTERNAL_MESSAGE_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

/**
 * v0.9.2: dsh вставляет в сессию служебные user-сообщения хоста —
 * каталог скиллов в обёртке <system-reminder> (tool-skill, source
 * skill-catalog). Это не реплики пользователя: до фильтра контур
 * обучения классифицировал каталог, извлекал из него «факты» и
 * заносил их в эпизодическую память (найдено боевым тестом).
 *
 * v0.9.3: туда же — runtime-context снапшоты system-prompt
 * («Current runtime context…», joinContextSections) и сигнал
 * очистки контекста (runtime-context.ts, CLEARED). Боевой тест:
 * снапшот перезаписал цикл с обучающим сообщением пользователя.
 */
const HARNESS_SYSTEM_PREFIXES = [
  "<system-reminder>",
  "Current runtime context.",
  "Current runtime context: none.",
] as const;

export function isHarnessSystemMessage(text: string): boolean {
  const trimmed = text.trimStart();
  return HARNESS_SYSTEM_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}
