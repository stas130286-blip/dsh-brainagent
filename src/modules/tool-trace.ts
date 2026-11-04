/**
 * Tool trace — моторный след одного хода.
 *
 * v0.9.34: привычка должна хранить не только тип задачи, но и фактическую
 * последовательность действий. В мозге рутина — это моторная программа:
 * порядок сокращений мышц, а не описание «как вообще делают такие задачи».
 * Поэтому инструменты, реально выполненные за ход, копятся здесь и на
 * завершении цикла превращаются в рутину привычки.
 *
 * След живёт в памяти процесса и привязан к агенту: ключ — тот же, что у
 * цикла (String(agent.id)). Забирается один раз (`takeToolTrace`), чтобы
 * действия одного хода не просочились в следующий.
 */

/** Сколько шагов рутины запоминаем. Длиннее — уже не привычка, а сценарий. */
const MAX_TRACE_STEPS = 8;

const traces = new Map<string, string[]>();

/** Отметить выполненный инструмент в следе агента. */
export function noteToolUse(key: string, toolName: string): void {
  if (!key || !toolName) return;

  const trace = traces.get(key) ?? [];
  // Повтор подряд не добавляет нового шага: «прочитал → прочитал» — одно действие.
  if (trace[trace.length - 1] === toolName) return;

  trace.push(toolName);
  if (trace.length > MAX_TRACE_STEPS) {
    trace.splice(0, trace.length - MAX_TRACE_STEPS);
  }
  traces.set(key, trace);
}

/** Забрать и очистить след хода. */
export function takeToolTrace(key: string): string[] {
  const trace = traces.get(key);
  traces.delete(key);
  return trace ? [...trace] : [];
}

/** Сбросить след (начало нового хода или уборка). */
export function clearToolTrace(key: string): void {
  traces.delete(key);
}
