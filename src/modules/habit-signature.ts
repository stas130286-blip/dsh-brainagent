/**
 * Habit signature — the cue that the basal ganglia actually store.
 *
 * v0.9.33: раньше ключом привычки был сырой текст сообщения
 * (`input.slice(0, 300)`). Это биологически неверно: стриатум хранит не
 * предложение-стимул, а схему действия — «тип задачи → рутина». Текст
 * сообщения каждый раз новый, поэтому 168 привычек из 200 были
 * одноразовыми: они не могли ни повториться, ни автоматизироваться.
 *
 * Здесь из сообщения извлекается тип задачи (моторная программа) и вместе
 * с доменом таламуса образует ключ `task:domain`. Такой ключ воспроизводим:
 * одинаковые по типу запросы сливаются в одну привычку, повторение
 * накапливает активации, и автоматизация становится достижимой.
 *
 * Тема сообщения намеренно НЕ входит в ключ: содержание подставляет кора,
 * а привычка отвечает за способ действия.
 */

/** Моторные программы, которые мы умеем различать по тексту запроса. */
export type HabitTask =
  | "reminder"
  | "search"
  | "status"
  | "deploy"
  | "install"
  | "run"
  | "fix"
  | "explain"
  | "translate"
  | "plan"
  | "analyze"
  | "write"
  | "general";

export type HabitSignature = {
  task: HabitTask;
  /** Ключ привычки: `task:domain`. */
  cue: string;
  /** Рутина, которую стриатум связывает с ключом. */
  routine: string[];
};

/**
 * Порядок важен: первое совпадение выигрывает. Более специфичные программы
 * стоят раньше общих («напиши план» — это plan, а не write).
 */
const TASK_PATTERNS: ReadonlyArray<readonly [HabitTask, RegExp]> = [
  ["reminder", /(напомн|напомин|напомина|remind)/],
  ["search", /(найд|поиск|поищи|ищи|погугл|search|look ?up)/],
  ["status", /(статус|status|покажи|отч[её]т|report|сводк|метрик|metrics)/],
  ["deploy", /(деплой|deploy|выпуст|релиз|release|publish|опублику)/],
  ["install", /(установ|поставь|install|обнови|update|апдейт)/],
  ["run", /(запуст|перезапуст|стартуй|run|start|restart)/],
  ["fix", /(почин|исправ|фикс|fix|debug|отлад|баг|bug)/],
  ["explain", /(объясн|почему|как работает|explain|why|разбер)/],
  ["translate", /(перевед|перевод|translate)/],
  ["plan", /(план|спланир|plan|roadmap)/],
  ["analyze", /(проанали|сравн|analyze|compare|диагностик)/],
  ["write", /(напиш|создай|сгенерир|write|create|generate|сочин)/],
];

function detectTask(text: string): HabitTask {
  for (const [task, pattern] of TASK_PATTERNS) {
    if (pattern.test(text)) return task;
  }
  return "general";
}

/**
 * Построить сигнатуру привычки из сообщения и домена таламуса.
 * Детерминирована: одно и то же сообщение всегда даёт один и тот же ключ.
 */
export function deriveHabitSignature(input: string, domain: string): HabitSignature {
  const text = input.slice(0, 300).toLowerCase();
  const task = detectTask(text);
  return { task, cue: `${task}:${domain}`, routine: [task, domain] };
}

/** Является ли строка ключом привычки нового формата (`task:domain`). */
export function isHabitSignature(value: string): boolean {
  return /^[a-z-]+:[a-z-]+$/.test(value);
}
