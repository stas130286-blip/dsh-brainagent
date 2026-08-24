/**
 * Маркеры автономии (v0.5.2).
 *
 * Всё, чем помечаются автономные (самоинициированные) сообщения в
 * текстовом протоколе: тег, его префикс и фрейминг доставки. Доставка
 * идёт текстом и логируется в сессию как user/message, поэтому маркеры
 * и их детекция живут в одном файле: переформулировка фрейминга не
 * может тихо сломать детекцию.
 *
 * Фрейминг — единый источник: deliverer (plugin/autonomy.ts) собирает
 * текст доставки из AUTONOMOUS_FRAMING_LINES, а детекция и message-guard
 * используют ту же первую строку. Разойтись они физически не могут.
 */

/**
 * Тег, оборачивающий автономное сообщение. Модель видит тег в логе;
 * плагин по нему отличает автономные циклы от реплик пользователя.
 */
export const AUTONOMOUS_TAG = "<autonomous-intent>";
/**
 * Префикс тега: матчит и ровный тег, и тег с атрибутами
 * ("<autonomous-intent source=...>").
 */
export const AUTONOMOUS_TAG_PREFIX = "<autonomous-intent";

/**
 * Строки фрейминга доставки (v0.5.2): deliverer ставит их перед тегом,
 * чтобы модель понимала — говорит она сама, а не отвечает на задачу.
 */
export const AUTONOMOUS_FRAMING_LINES = [
  "Это не сообщение пользователя, а твоя собственная инициатива: ниже — то, что ты сам хочешь сказать.",
  "Обратись к пользователю от себя, коротко и естественно. Не описывай внутренние механизмы.",
] as const;

/**
 * Префикс фрейминга для детекции — сама первая строка фрейминга
 * (выводится из AUTONOMOUS_FRAMING_LINES, а не дублируется строкой).
 */
export const AUTONOMOUS_FRAME_PREFIX: string = AUTONOMOUS_FRAMING_LINES[0];

/**
 * Открывающий маркер блока воспоминаний автономи-энричера.
 * Блок — контекст для следующей проактивной доставки, а не
 * самостоятельное сообщение (v0.9.1).
 */
export const AUTONOMY_MEMORIES_PREFIX = "<autonomy-memories>";

/**
 * Единая детекция автономного ввода: ровный тег, тег с атрибутами
 * или фрейминг доставки перед тегом.
 */
export function isAutonomousInput(text: string): boolean {
  const trimmed = text.trimStart();
  if (trimmed.startsWith(AUTONOMOUS_TAG_PREFIX)) return true;
  return trimmed.startsWith(AUTONOMOUS_FRAME_PREFIX) && trimmed.includes(AUTONOMOUS_TAG_PREFIX);
}
