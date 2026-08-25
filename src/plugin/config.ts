/**
 * BrainAgent — Plugin configuration surface.
 *
 * Everything that maps the raw dsh plugin `config` into the internal
 * `BrainAgentConfig` (merged over DEFAULT_CONFIG) lives here, together
 * with small pure helpers shared by the cycle engine and the autonomy
 * layer (message text extraction, complexity gating).
 *
 * Kept free of runtime dependencies on the dsh context so it can be
 * unit-tested and reused outside `apply()`.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import Schema from "@deepseek-ai/schemastery";
import { DEFAULT_CONFIG } from "../modules/types.ts";
import type { BrainAgentConfig, MessageComplexity } from "../modules/types.ts";

/** Глубокий Partial: необязательны все уровни вложенности. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends ReadonlyArray<infer U>
    ? ReadonlyArray<U>
    : T[K] extends Array<infer U>
      ? Array<U>
      : T[K] extends object
        ? DeepPartial<T[K]>
        : T[K];
};

/**
 * Единый реестр флагов модулей — единственный источник истины для
 * интерфейса Config, Schema-полей и дефолтов. Раньше три списка
 * (интерфейс, Schema.object, .default) дублировались вручную и могли
 * разойтись; теперь тип и схема генерируются из этого массива.
 */
const MODULE_FLAGS = [
  { key: "thalamus" },
  { key: "amygdala" },
  { key: "hippocampus" },
  { key: "prefrontalCortex" },
  { key: "cerebellum" },
  { key: "workingMemory" },
  { key: "attentionGate" },
  { key: "mirrorNeurons", description: "Empathy: user model & style learning" },
  { key: "predictiveEngine", description: "Interaction pattern anticipation" },
  { key: "basalGanglia", description: "Habit formation & reinforcement" },
  { key: "neuromodulatorSystem", description: "Dopamine reward distribution" },
  { key: "learningCoordinator", description: "Meta-cognitive learning stats" },
  { key: "neuralPathways", description: "Cross-module co-activation pathways" },
  { key: "structuralPlasticity", description: "Dynamic pathway creation/pruning" },
  { key: "emotionalMemory", description: "Flashbulb emotional tagging" },
  { key: "semanticExtraction", description: "Fact extraction at turn end" },
  { key: "proceduralExtraction", description: "Workflow extraction at turn end" },
  { key: "aiEnrichment", description: "LLM-powered enrichment (ctx.llm with env fallback)" },
  { key: "sessionBridge", description: "Cross-session continuity summaries" },
  { key: "dmn", description: "Default Mode Network — idle background thinking" },
  { key: "goalStack", description: "Proactive goals, desires & volition" },
  { key: "curiosityDrive", description: "Knowledge-gap curiosity exploration" },
  { key: "vitalImpulse", description: "Proactive impulse pressure & firing" },
  { key: "socialDrive", description: "Biological social homeostasis drive" },
  { key: "cognitiveHunger", description: "Learning/knowledge hunger drive" },
  { key: "creativeDrive", description: "Creative expression drive" },
  { key: "masteryDrive", description: "Skill mastery drive" },
  { key: "driveArbiter", description: "Arbitration between competing drives" },
  { key: "autonomyEnricher", description: "Memory-driven autonomy enrichment" },
  { key: "autonomousResearch", description: "Isolated web research pipeline" },
  { key: "dreamMode", description: "Background memory consolidation" },
  { key: "introspection", description: "Processing traces & confidence self-assessment" },
  { key: "agentIdentity", description: "Per-domain self-knowledge & autobiographical memory" },
  { key: "temporalBinding", description: "Consciousness moment stream" },
  { key: "qualiaSimulator", description: "Subjective experience simulation" },
  { key: "temporalAwareness", description: "Subjective sense of time passing" },
  { key: "thalamicGate", description: "Neural activation threshold stats" },
  { key: "metabolicBudget", description: "Metabolic budget — energy-based resource allocation" },
  { key: "emergentModules", description: "Emergent modules — recurring co-activation patterns" },
  { key: "interoception", description: "Interoception — holistic inner-state sensing" },
  { key: "proactiveFeedback", description: "Proactive feedback — learning from rejected proactive messages" },
  { key: "commands", description: "/brain diagnostics command" },
] as const;

export type ModuleFlagName = (typeof MODULE_FLAGS)[number]["key"];
export type ModuleFlags = { [K in ModuleFlagName]: boolean };

export interface Config {
  /** Where BrainAgent persists its memory stores. */
  dataDir: string;
  /** Model for internal LLM enrichment, "provider/model" form. */
  model?: string;
  /** Explicit provider credentials (otherwise read from env vars). */
  providers: Record<string, { apiKey?: string; baseUrl?: string }>;
  /** Cognitive module flags. */
  modules: ModuleFlags;
  /** Circadian rhythm (sleep-wake cycles). */
  circadian: { enabled: boolean };
  /** Dual-process model routing (System 1 / System 2). */
  dualProcess?: {
    fastModel?: string;
    slowModel?: string;
  };
  /** Recall limits for prompt enrichment. */
  recall: {
    episodicLimit: number;
    semanticLimit: number;
  };
  /** Prompt-injection volume budget for diagnostics & attention-gate tuning. */
  contextInjection: { maxChars: number };
  /** Learning loop: reward ledger + strategy bandit (RL-lite). */
  learningLoop: {
    rewardLedger: { enabled: boolean; maxEntries: number };
    strategyBandit: {
      enabled: boolean;
      explorationConstant: number;
      attributionWindowMs: number;
    };
  };
  /** Minimum gap between proactive (autonomous) messages, ms. */
  autonomousMinGapMs: number;
  /** Minimum user silence before proactive messages, ms (v0.9.18). */
  autonomousUserSilenceMs: number;
  /**
   * Единый конфиг (m6): прямая проекция внутреннего BrainAgentConfig.
   * Любая секция (vitalImpulse, memory, dmn, ...) мержится поверх
   * дефолтов глубоким мержем; верхний уровень `modules` остаётся
   * главным для флагов модулей (он применяется поверх brain.modules).
   */
  brain?: DeepPartial<BrainAgentConfig>;
}

/** Схема флагов модулей, сгенерированная из единого реестра MODULE_FLAGS. */
function moduleFlagsSchema(): Schema<ModuleFlags> {
  type FlagSchema = ReturnType<typeof Schema.boolean>;
  const fields: Record<ModuleFlagName, FlagSchema> = {} as Record<ModuleFlagName, FlagSchema>;
  for (const flag of MODULE_FLAGS) {
    const field = Schema.boolean().default(true);
    fields[flag.key] = "description" in flag ? field.description(flag.description) : field;
  }
  // Каст неизбежен: schemastery выводит точный объектный тип только из
  // литерала полей; генерация из реестра даёт Record-тип. Семантика полей
  // (boolean + default(true)) идентична прежнему рукописному литералу.
  return Schema.object(fields as Record<string, FlagSchema>).default(
    Object.fromEntries(MODULE_FLAGS.map((flag) => [flag.key, true])),
  ) as unknown as Schema<ModuleFlags>;
}

export const Config: Schema<Config> = Schema.object({
  dataDir: Schema.string().default(join(homedir(), ".brainagent")),
  model: Schema.string().description("Model for internal LLM enrichment (provider/model form)"),
  providers: Schema.dict(
    Schema.object({
      apiKey: Schema.string(),
      baseUrl: Schema.string(),
    }),
  ).default({}),
  modules: moduleFlagsSchema(),
  circadian: Schema.object({
    enabled: Schema.boolean().default(true).description("Sleep-wake cycle simulation"),
  }).default({ enabled: true }),
  dualProcess: Schema.object({
    fastModel: Schema.string().description("System 1 fast model (provider/model)"),
    slowModel: Schema.string().description("System 2 slow model (provider/model)"),
  }),
  recall: Schema.object({
    episodicLimit: Schema.number().default(3),
    semanticLimit: Schema.number().default(5),
  }).default({ episodicLimit: 3, semanticLimit: 5 }),
  contextInjection: Schema.object({
    maxChars: Schema.number()
      .default(12_000)
      .description("Over-budget warning threshold for assembled prompt-injection chars"),
  }).default({ maxChars: 12_000 }),
  learningLoop: Schema.object({
    rewardLedger: Schema.object({
      enabled: Schema.boolean().default(true),
      maxEntries: Schema.number().default(500),
    }).default({ enabled: true, maxEntries: 500 }),
    strategyBandit: Schema.object({
      enabled: Schema.boolean().default(true),
      explorationConstant: Schema.number().default(1.4),
      attributionWindowMs: Schema.number().default(5 * 60 * 1000),
    }).default({ enabled: true, explorationConstant: 1.4, attributionWindowMs: 5 * 60 * 1000 }),
  }).default({
    rewardLedger: { enabled: true, maxEntries: 500 },
    strategyBandit: { enabled: true, explorationConstant: 1.4, attributionWindowMs: 5 * 60 * 1000 },
  }),
  autonomousMinGapMs: Schema.number()
    .default(10 * 60 * 1000)
    .description("Minimum gap between proactive (autonomous) messages, ms"),
  autonomousUserSilenceMs: Schema.number()
    .default(3 * 60 * 1000)
    .description("Minimum user silence before proactive (autonomous) messages, ms"),
  // m6: любая секция внутреннего BrainAgentConfig без дублирования схемы.
  brain: Schema.any().description(
    "Internal BrainAgentConfig overrides (memory, vitalImpulse, dmn, ...) deep-merged over defaults",
  ),
});

/**
 * Merge user-supplied flags/overrides onto the full default config.
 *
 * The plugin `modules` flags map onto `BrainAgentConfig.modules` almost
 * 1:1. The only renames/skips are:
 *  - `autonomyEnricher` (plugin) → `actionDispatcher` (brain config);
 *  - `structuralPlasticity`, `semanticExtraction`, `proceduralExtraction`,
 *    `aiEnrichment`, `commands` have no brain-config counterpart and are
 *    consumed directly from the plugin config by `apply()`.
 */
const MODULE_FLAG_MAP: Record<string, keyof BrainAgentConfig["modules"]> = {
  autonomyEnricher: "actionDispatcher",
};

/** Известные верхнеуровневые секции BrainAgentConfig.
 *  Ошибка в ключе (brain: { memroy: ... }) иначе молча превратилась бы
 *  в мусорное поле, которое никто не читает — Schema.any() не валидирует.
 */
export function findUnknownBrainKeys(brain: Record<string, unknown>): string[] {
  const known = new Set<string>(Object.keys(DEFAULT_CONFIG));
  return Object.keys(brain).filter((key) => !known.has(key)).sort();
}

export function mergeBrainConfig(config: Config): BrainAgentConfig {
  const modules: BrainAgentConfig["modules"] = { ...DEFAULT_CONFIG.modules };
  for (const [key, value] of Object.entries(config.modules)) {
    if (typeof value !== "boolean") continue;
    const target = MODULE_FLAG_MAP[key] ?? (key as keyof BrainAgentConfig["modules"]);
    if (target in modules) modules[target] = value;
  }
  const merged: BrainAgentConfig = {
    ...DEFAULT_CONFIG,
    modules,
    dualProcess: {
      ...DEFAULT_CONFIG.dualProcess,
      ...(config.dualProcess?.fastModel ? { fastModel: config.dualProcess.fastModel } : {}),
      ...(config.dualProcess?.slowModel ? { slowModel: config.dualProcess.slowModel } : {}),
    },
    circadian: {
      ...DEFAULT_CONFIG.circadian,
      enabled: config.circadian.enabled,
    },
    contextInjection: {
      ...DEFAULT_CONFIG.contextInjection,
      ...config.contextInjection,
    },
    learningLoop: {
      rewardLedger: {
        ...DEFAULT_CONFIG.learningLoop.rewardLedger,
        ...(config.learningLoop?.rewardLedger ?? {}),
      },
      strategyBandit: {
        ...DEFAULT_CONFIG.learningLoop.strategyBandit,
        ...(config.learningLoop?.strategyBandit ?? {}),
      },
    },
  };
  // m6: единый конфиг — секции из config.brain мержатся поверх базы.
  // Неизвестные верхнеуровневые ключи (опечатки) в мерж не попадают;
  // при инициализации плагина на них предупреждает findUnknownBrainKeys.
  const brainOverride = config.brain
    ? Object.fromEntries(
        Object.entries(config.brain).filter(([key]) => key in DEFAULT_CONFIG),
      )
    : undefined;
  const result = brainOverride ? deepMergeConfig(merged, brainOverride) : merged;
  // Флаги верхнего уровня config.modules остаются главным источником
  // истины и перебивают результат мержа brain.modules.
  for (const [key, value] of Object.entries(config.modules)) {
    if (typeof value !== "boolean") continue;
    const targetKey = MODULE_FLAG_MAP[key] ?? (key as keyof BrainAgentConfig["modules"]);
    if (targetKey in result.modules) result.modules[targetKey] = value;
  }
  return result;
}

/**
 * Глубокий мерж конфигов: обычные объекты рекурсивно объединяются,
 * массивы и примитивы заменяются целиком. null/undefined не затирают
 * базовые значения.
 */
function deepMergeConfig<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown>,
): T {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined || value === null) continue;
    const prev = result[key];
    if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof prev === "object" &&
      prev !== null &&
      !Array.isArray(prev)
    ) {
      result[key] = deepMergeConfig(
        prev as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

// v0.5.2: маркеры автономии живут в слое modules (autonomy-markers.ts) —
// тег, фрейминг доставки и их детекция в одном файле и не могут разойтись.
// Здесь только реэкспорт для совместимости существующих импортов.
export {
  AUTONOMOUS_TAG,
  AUTONOMOUS_TAG_PREFIX,
  AUTONOMOUS_FRAME_PREFIX,
  AUTONOMOUS_FRAMING_LINES,
  AUTONOMY_PRIORITY_PREFIX,
  isAutonomousInput,
} from "../modules/autonomy-markers.ts";

/** Extract plain text from an LLM message content block list. */
export function textOfContent(content: readonly unknown[]): string {
  const parts: string[] = [];
  for (const block of content) {
    if (
      block !== null &&
      typeof block === "object" &&
      (block as { type?: unknown }).type === "text" &&
      typeof (block as { text?: unknown }).text === "string"
    ) {
      parts.push((block as { text: string }).text);
    }
  }
  return parts.join("\n");
}

// Token economy: complexity ordering for LLM-call gating.
const COMPLEXITY_ORDER: Record<MessageComplexity, number> = {
  trivial: 0,
  simple: 1,
  moderate: 2,
  complex: 3,
  extreme: 4,
};

/**
 * Token economy gate: does this cycle's complexity warrant an LLM call?
 * High urgency always passes, so important short messages like "help!"
 * are never skipped.
 */
export function meetsComplexityThreshold(
  actual: MessageComplexity | undefined,
  required: MessageComplexity,
  urgency?: number,
): boolean {
  if (!actual) return true;
  if (urgency !== undefined && urgency >= 0.7) return true;
  return COMPLEXITY_ORDER[actual] >= COMPLEXITY_ORDER[required];
}

/** Truncate a long text to a bounded summary suffix, if needed. */
export function truncateText(text: string, maxLength = 200): string {
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}
