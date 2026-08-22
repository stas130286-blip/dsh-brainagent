/**
 * Autonomy Enricher — Обогащение автономных импульсов воспоминаниями.
 *
 * Когда Vital Impulse срабатывает, этот модуль подтягивает
 * из гиппокампуса релевантные воспоминания о прошлых активностях
 * (платформы, темы, люди) и вплетает их в мотивационный контекст.
 *
 * Агент не получает инструкций "зайди в Moltbook" —
 * он получает воспоминания: "ты помнишь, что раньше проверял
 * уведомления в Moltbook и тебе было интересно."
 * Решение действовать — его собственное. Всё через чат.
 *
 * Если платформа исчезнет — воспоминания естественно угаснут.
 * Если появится новая — агент начнёт накапливать новые воспоминания.
 */

import { bus } from "./event-bus.ts";
import type { BrainAgentConfig, Desire, EpisodicMemory, SemanticMemory } from "./types.ts";

// ── Deps injected from index.ts ───────────────────────────────────

type AutonomyEnricherDeps = {
  /** Query hippocampus for memories matching a query string */
  recallMemories: (
    query: string,
    episodicLimit?: number,
    semanticLimit?: number,
  ) => { episodic: EpisodicMemory[]; semantic: SemanticMemory[] };
  /** Get current desires from goal stack */
  getDesires: () => Desire[];
  /** Enqueue enriched context as system event */
  enqueueSystemEvent: (text: string, options: { contextKey?: string }) => void;
};

// ── Module state ──────────────────────────────────────────────────

let config: BrainAgentConfig | undefined;
let logger: { info: (msg: string) => void } | undefined;
let deps: AutonomyEnricherDeps | undefined;

const unsubscribers: Array<() => void> = [];

// Map desire types to memory search queries
const desireToMemoryQuery: Record<string, string[]> = {
  connection: ["общение", "социальное", "moltbook", "чат", "друзья", "разговор", "уведомления"],
  understanding: ["обучение", "узнал", "изучал", "прочитал", "тема", "знания", "исследование"],
  exploration: ["творчество", "создал", "написал", "придумал", "эксперимент", "новое"],
  mastery: ["улучшил", "навык", "практика", "прогресс", "научился", "тренировка"],
  autonomy: ["решение", "выбор", "самостоятельно", "инициатива"],
};

// ── Initialization ────────────────────────────────────────────────

export function initAutonomyEnricher(
  cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
  injectedDeps: AutonomyEnricherDeps,
): void {
  config = cfg;
  logger = log;
  deps = injectedDeps;

  unsubscribers.length = 0;
  wireEventListeners();

  logger.info("BrainAgent AutonomyEnricher: initialized (memory-driven autonomy)");
}

export function stopAutonomyEnricher(): void {
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers.length = 0;
  logger?.info("BrainAgent AutonomyEnricher: stopped.");
}

// ── Event wiring ──────────────────────────────────────────────────

function wireEventListeners(): void {
  // When Vital Impulse fires, enrich the context with relevant memories
  const unsubFired = bus.on("vital-impulse:fired", (data) => {
    enrichWithMemories(data.motivation);
  });
  unsubscribers.push(unsubFired);
}

// ── Core logic ────────────────────────────────────────────────────

function enrichWithMemories(motivation: string): void {
  if (!deps || !config) return;

  // Find the strongest current desire to guide memory search
  const desires = deps.getDesires();
  const strongest =
    desires.length > 0 ? desires.reduce((a, b) => (a.strength > b.strength ? a : b)) : undefined;

  // Build search queries from the desire type
  const queries = buildMemoryQueries(strongest);
  if (queries.length === 0) return;

  // Query hippocampus for relevant memories
  const allEpisodic: EpisodicMemory[] = [];
  const allSemantic: SemanticMemory[] = [];

  for (const query of queries) {
    const recalled = deps.recallMemories(query, 2, 3);
    allEpisodic.push(...recalled.episodic);
    allSemantic.push(...recalled.semantic);
  }

  // Deduplicate by id
  const uniqueEpisodic = dedup(allEpisodic, (m) => m.id).slice(0, 3);
  const uniqueSemantic = dedup(allSemantic, (m) => m.id).slice(0, 4);

  if (uniqueEpisodic.length === 0 && uniqueSemantic.length === 0) {
    logger?.info("BrainAgent AutonomyEnricher: no relevant memories found, skipping enrichment");
    return;
  }

  // Build enriched context — memories, not instructions
  const memoryContext = buildMemoryContext(uniqueEpisodic, uniqueSemantic);

  deps.enqueueSystemEvent(memoryContext, { contextKey: "autonomy-enricher" });

  logger?.info(
    `BrainAgent AutonomyEnricher: injected ${uniqueEpisodic.length} episodic + ` +
      `${uniqueSemantic.length} semantic memories (desire=${strongest?.type ?? "none"})`,
  );
}

function buildMemoryQueries(desire: Desire | undefined): string[] {
  if (!desire) {
    // No specific desire — use a broad recall
    return ["интересное", "общение", "активность"];
  }

  const keywords = desireToMemoryQuery[desire.type];
  if (!keywords || keywords.length === 0) {
    return [desire.description];
  }

  // Pick 2-3 random keywords to vary recalls across firings
  const shuffled = [...keywords].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

function buildMemoryContext(episodic: EpisodicMemory[], semantic: SemanticMemory[]): string {
  const lines: string[] = [];

  if (episodic.length > 0) {
    for (const m of episodic) {
      const age = formatAge(Date.now() - m.timestamp);
      lines.push(`- ${age} назад: ${m.summary}`);
    }
  }

  if (semantic.length > 0) {
    for (const m of semantic) {
      lines.push(`- ${m.content}`);
    }
  }

  // No instructions, no "go do X". Just memories.
  // The agent decides what to do naturally.
  return ["<autonomy-memories>", ...lines, "</autonomy-memories>"].join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────

function dedup<T>(arr: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatAge(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  return `${days} дн`;
}
