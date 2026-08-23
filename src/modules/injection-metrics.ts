/**
 * Injection Metrics — измерение объёма prompt-инъекций за цикл.
 *
 * BrainAgent собирает до ~20 секций внутреннего контекста
 * (предсказания, желания, нейромодуляторы, квалиа и т.д.) и
 * добавляет их к сообщению пользователя. Attention Gate фильтрует
 * секции по релевантности, но раньше никто не измерял, СКОЛЬКО
 * контекста реально уходит в модель — слепая зона для тюнинга.
 *
 * Теперь каждый цикл фиксирует число секций и объём в символах
 * (с оценкой токенов ~4 символа/токен), а превышение бюджета
 * подсвечивается в логе и в /brain status.
 */

let totalCycles = 0;
let totalChars = 0;
let maxChars = 0;
let totalSections = 0;
let maxSections = 0;
let overBudgetCycles = 0;
let lastChars = 0;
let lastSections = 0;

export type InjectionMetrics = {
  cycles: number;
  avgChars: number;
  maxChars: number;
  lastChars: number;
  avgSections: number;
  maxSections: number;
  lastSections: number;
  avgEstTokens: number;
  overBudgetCycles: number;
};

/** Зафиксировать один цикл сборки контекста. */
export function recordInjectionCycle(
  sectionCount: number,
  chars: number,
  budgetChars?: number,
): void {
  totalCycles++;
  totalChars += chars;
  totalSections += sectionCount;
  lastChars = chars;
  lastSections = sectionCount;
  if (chars > maxChars) maxChars = chars;
  if (sectionCount > maxSections) maxSections = sectionCount;
  if (budgetChars !== undefined && chars > budgetChars) overBudgetCycles++;
}

/** Агрегированная статистика (для /brain status и диагностики). */
export function getInjectionMetrics(): InjectionMetrics {
  const avgChars = totalCycles > 0 ? Math.round(totalChars / totalCycles) : 0;
  const avgSections = totalCycles > 0 ? Math.round((totalSections / totalCycles) * 10) / 10 : 0;
  return {
    cycles: totalCycles,
    avgChars,
    maxChars,
    lastChars,
    avgSections,
    maxSections,
    lastSections,
    avgEstTokens: Math.ceil(avgChars / 4),
    overBudgetCycles,
  };
}

/** Сброс счётчиков (для тестов). */
export function resetInjectionMetrics(): void {
  totalCycles = 0;
  totalChars = 0;
  maxChars = 0;
  totalSections = 0;
  maxSections = 0;
  overBudgetCycles = 0;
  lastChars = 0;
  lastSections = 0;
}
