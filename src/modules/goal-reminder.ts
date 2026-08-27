/**
 * Goal Reminder (v0.9.7) — фоновый планировщик time-напоминаний.
 *
 * До v0.9.7 time-цели проверялись только внутри Vital Impulse при
 * накоплении сигналов, а фоновый тик убрали как причину спама.
 * Результат: напоминание «напомни через 10 минут» в тишине не
 * срабатывало — пока пользователь молчит, сигналов нет, импульс не
 * загорается, время цели никто не проверяет.
 *
 * Планировщик раз в интервал проверяет time-цели и доставляет
 * напоминание с приоритетным маркером: обязательства по времени —
 * не спонтанная инициатива, поэтому loop-breaker и минимум-гэп
 * проактивной доставки их не задерживают.
 */

import type { Goal } from "./types.ts";
import { AUTONOMY_PRIORITY_PREFIX } from "./autonomy-markers.ts";

export const DEFAULT_REMINDER_CHECK_MS = 30_000;

export type GoalReminderDeps = {
  checkAutonomousGoals: (idleMs?: number) => Goal[];
  buildGoalContext: (goals: Goal[]) => string | undefined;
  enqueue: (text: string) => void;
  /** v0.9.20: учёт доставленных напоминаний в статистике goal-executor. */
  recordExecuted?: (count: number) => void;
  logger?: { info: (msg: string) => void };
  now?: () => number;
};

/** Форматирование текста напоминания по сработавшим целям. */
export function buildReminderText(triggered: Goal[], goalCtx: string | undefined): string {
  const lines = [
    AUTONOMY_PRIORITY_PREFIX,
    "<autonomous-intent>",
    ...triggered.slice(0, 3).map((g) => `- Напомни пользователю: ${g.description}`),
  ];
  if (goalCtx) {
    lines.push("", goalCtx);
  }
  lines.push(
    "",
    "Наступило время этого напоминания — обратись к пользователю коротко и естественно.",
    "Не описывай внутренние процессы, цели или механизмы.",
    "</autonomous-intent>",
  );
  return lines.filter(Boolean).join("\n");
}

/**
 * Запустить фоновый планировщик напоминаний.
 * Возвращает функцию остановки (clearInterval).
 */
export function startGoalReminderScheduler(deps: GoalReminderDeps): () => void {
  const rawEnv = process.env.BRAINAGENT_REMINDER_CHECK_MS;
  const parsed = rawEnv !== undefined && rawEnv !== "" ? Number(rawEnv) : NaN;
  const intervalMs =
    Number.isFinite(parsed) && parsed >= 5_000 ? parsed : DEFAULT_REMINDER_CHECK_MS;

  const timer = setInterval(() => {
    try {
      const triggered = deps.checkAutonomousGoals();
      if (triggered.length === 0) return;
      const goalCtx = deps.buildGoalContext(triggered);
      deps.enqueue(buildReminderText(triggered, goalCtx));
      deps.recordExecuted?.(triggered.length);
      deps.logger?.info(
        `BrainAgent GoalReminder: доставлено напоминаний: ${triggered.length}`,
      );
    } catch (error) {
      deps.logger?.info(
        `BrainAgent GoalReminder: ошибка проверки целей — ${(error as Error).message}`,
      );
    }
  }, intervalMs);
  timer.unref?.();

  deps.logger?.info(`BrainAgent GoalReminder: планировщик запущен (интервал ${intervalMs}мс)`);
  return () => clearInterval(timer);
}

/**
 * Защита от спама гол-раундов на случай хоста БЕЗ патча пейсинга
 * (host-patches/apply-goal-round-pacing.cjs не применили). Раунды,
 * пришедшие чаще порога, говорят об отсутствии патча — предупреждаем
 * один раз, чтобы пользователь узнал причину, а не молча терпел спам.
 */
export function createGoalRoundGuard(
  logWarn: (msg: string) => void,
  windowMs = 60_000,
  maxRounds = 2,
): (source: unknown) => void {
  let arrivals: number[] = [];
  let warned = false;
  return (source: unknown) => {
    if (warned) return;
    const src = source as { kind?: string; round?: number } | undefined;
    if (!src || src.kind !== "goal" || !(typeof src.round === "number" && src.round > 0)) return;
    const now = Date.now();
    arrivals.push(now);
    arrivals = arrivals.filter((t) => now - t <= windowMs);
    if (arrivals.length > maxRounds) {
      warned = true;
      logWarn(
        "BrainAgent: гол-раунды хоста приходят чаще раза в минуту — патч пейсинга " +
          "не применён. Выполните: node brainagent/host-patches/apply-goal-round-pacing.cjs",
      );
    }
  };
}
