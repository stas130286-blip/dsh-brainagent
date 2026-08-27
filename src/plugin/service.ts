/**
 * BrainAgent Cordis service — публичный фасад плагина для других плагинов dsh.
 *
 * v0.8.0 (m5): провайдер сервиса `brainagent`:
 * - createBrainAgentService(deps) — фабрика: весь фасад строится поверх
 *   переданных зависимостей, без обращения к модульным глобалам напрямую;
 * - provideBrainAgentService(ctx, service) — регистрирует сервис как
 *   `ctx.brainagent`; регистрация принадлежит fiber-у плагина (scope) и
 *   автоматически снимается при выгрузке плагина;
 * - аугментация `declare module "@deepseek-ai/cordis"` типизирует
 *   `ctx.brainagent` для потребителей с `inject: ["brainagent"]`.
 *
 * Фасад намеренно узкий и стабильный: сводный статус, доступ к памяти
 * (recall/store) и к стеку целей. Внутреннее устройство модулей не
 * раскрывается — потребители не должны ломаться от рефакторинга.
 */

import type { Context } from "@deepseek-ai/cordis";
import type { Desire, EpisodicMemory, ProceduralMemory, SemanticMemory } from "../modules/types.ts";

/** Версия плагина, которую видит потребитель сервиса. */
export const BRAINAGENT_VERSION = "0.9.22";

/** Результат комбинированного поиска по слоям памяти. */
export interface BrainAgentRecallResult {
  episodic: EpisodicMemory[];
  semantic: SemanticMemory[];
  procedural: ProceduralMemory[];
}

/** Зависимости фасада — подводятся при сборке сервиса в apply(). */
export interface BrainAgentServiceDeps {
  /** Сводный текстовый статус (аналог /brain status). */
  status: () => string;
  /** Комбинированный поиск по эпизодической/семантической/процедурной памяти. */
  recall: (query: string, episodicLimit?: number, semanticLimit?: number) => BrainAgentRecallResult;
  /** Записать факт в семантическую память. */
  storeFact: (content: string, category: string) => void;
  /** Записать эпизод в эпизодическую память. */
  storeEpisode: (event: string, summary: string) => void;
  /** Текущие желания стека целей ([] при выключенном goal-stack). */
  getDesires: () => Desire[];
  /** Добавить желание (бросает ошибку при выключенном goal-stack). */
  addDesire: (type: Desire["type"], description: string, strength: number, source: string) => Desire;
  /** Флаги включённых модулей когнитивной архитектуры. */
  moduleFlags: () => Readonly<Record<string, boolean>>;
}

/** Публичная поверхность сервиса `ctx.brainagent`. */
export interface BrainAgentService {
  /** Имя сервиса (совпадает с именем Cordis-регистрации). */
  readonly name: "brainagent";
  /** Версия плагина. */
  readonly version: string;
  /** Сводный текстовый статус архитектуры. */
  status(): string;
  /** Комбинированный поиск по памяти. */
  recall(query: string, episodicLimit?: number, semanticLimit?: number): BrainAgentRecallResult;
  /** Записать факт в семантическую память. */
  storeFact(content: string, category: string): void;
  /** Записать эпизод в эпизодическую память. */
  storeEpisode(event: string, summary: string): void;
  /** Текущие желания стека целей. */
  getDesires(): Desire[];
  /** Добавить желание в стек целей. */
  addDesire(type: Desire["type"], description: string, strength: number, source: string): Desire;
  /** Флаги включённых модулей. */
  modules(): Readonly<Record<string, boolean>>;
}

/**
 * Фабрика сервиса: экземпляр целиком определяется переданными deps,
 * поэтому два сервиса с разными deps полностью независимы.
 */
export function createBrainAgentService(deps: BrainAgentServiceDeps): BrainAgentService {
  return {
    name: "brainagent",
    version: BRAINAGENT_VERSION,
    status: () => deps.status(),
    recall: (query, episodicLimit, semanticLimit) => deps.recall(query, episodicLimit, semanticLimit),
    storeFact: (content, category) => deps.storeFact(content, category),
    storeEpisode: (event, summary) => deps.storeEpisode(event, summary),
    getDesires: () => deps.getDesires(),
    addDesire: (type, description, strength, source) =>
      deps.addDesire(type, description, strength, source),
    modules: () => deps.moduleFlags(),
  };
}

/**
 * Регистрация сервиса в Cordis-контексте плагина.
 *
 * `ctx.provide` привязывает регистрацию к fiber-у вызывающего плагина:
 * сервис живёт ровно в scope плагина и снимается вместе с ним — отдельный
 * dispose не нужен.
 */
export function provideBrainAgentService(ctx: Context, service: BrainAgentService): void {
  // Eval-обвязка и некоторые тесты дают мок-контекст без полного Cordis —
  // регистрация сервиса там не нужна и молча пропускается.
  if (typeof ctx.provide !== "function") return;
  ctx.provide("brainagent", service);
}

// Типизация для потребителей: import + inject: ["brainagent"] — и
// `ctx.brainagent` становится типизированным свойством контекста.
declare module "@deepseek-ai/cordis" {
  interface Context {
    brainagent: BrainAgentService;
  }
}
