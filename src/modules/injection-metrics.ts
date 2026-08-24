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
 *
 * v0.6.0 (шаблон миграции на per-instance состояние):
 *  - состояние живёт внутри инстанса, создаваемого фабрикой
 *    `createInjectionMetrics()` — никаких module-level `let`;
 *  - свободные функции (`recordInjectionCycle` и др.) — тонкие
 *    обёртки над инстансом по умолчанию, внешний API не меняется;
 *  - остальные модули переводятся на этот же шаблон волнами.
 */

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

/** Внутреннее состояние одного инстанса метрик. */
export type InjectionMetricsState = {
  totalCycles: number;
  totalChars: number;
  maxChars: number;
  totalSections: number;
  maxSections: number;
  overBudgetCycles: number;
  lastChars: number;
  lastSections: number;
};

export type InjectionMetricsInstance = {
  /** Зафиксировать один цикл сборки контекста. */
  record(sectionCount: number, chars: number, budgetChars?: number): void;
  /** Агрегированная статистика (для /brain status и диагностики). */
  get(): InjectionMetrics;
  /** Сброс счётчиков. */
  reset(): void;
};

function zeroState(): InjectionMetricsState {
  return {
    totalCycles: 0,
    totalChars: 0,
    maxChars: 0,
    totalSections: 0,
    maxSections: 0,
    overBudgetCycles: 0,
    lastChars: 0,
    lastSections: 0,
  };
}

/**
 * Фабрика инстансов: состояние изолировано внутри замыкания.
 * Несколько инстансов не влияют друг на друга — основа для
 * per-session скоупов и корректной перезагрузки плагина.
 */
export function createInjectionMetrics(): InjectionMetricsInstance {
  const state = zeroState();

  function record(sectionCount: number, chars: number, budgetChars?: number): void {
    state.totalCycles++;
    state.totalChars += chars;
    state.totalSections += sectionCount;
    state.lastChars = chars;
    state.lastSections = sectionCount;
    if (chars > state.maxChars) state.maxChars = chars;
    if (sectionCount > state.maxSections) state.maxSections = sectionCount;
    if (budgetChars !== undefined && chars > budgetChars) state.overBudgetCycles++;
  }

  function get(): InjectionMetrics {
    const avgChars = state.totalCycles > 0 ? Math.round(state.totalChars / state.totalCycles) : 0;
    const avgSections =
      state.totalCycles > 0 ? Math.round((state.totalSections / state.totalCycles) * 10) / 10 : 0;
    return {
      cycles: state.totalCycles,
      avgChars,
      maxChars: state.maxChars,
      lastChars: state.lastChars,
      avgSections,
      maxSections: state.maxSections,
      lastSections: state.lastSections,
      avgEstTokens: Math.ceil(avgChars / 4),
      overBudgetCycles: state.overBudgetCycles,
    };
  }

  function reset(): void {
    Object.assign(state, zeroState());
  }

  return { record, get, reset };
}

/**
 * Инстанс по умолчанию — единственный владелец глобального состояния.
 * В Cordis-скоупах (следующие волны) вместо него плагин будет
 * создавать инстанс на скоуп и передавать его зависимостям.
 */
export const defaultInjectionMetrics = createInjectionMetrics();

/** Зафиксировать один цикл сборки контекста (обёртка над инстансом по умолчанию). */
export function recordInjectionCycle(
  sectionCount: number,
  chars: number,
  budgetChars?: number,
): void {
  defaultInjectionMetrics.record(sectionCount, chars, budgetChars);
}

/** Агрегированная статистика (для /brain status и диагностики). */
export function getInjectionMetrics(): InjectionMetrics {
  return defaultInjectionMetrics.get();
}

/** Сброс счётчиков (для тестов). */
export function resetInjectionMetrics(): void {
  defaultInjectionMetrics.reset();
}
