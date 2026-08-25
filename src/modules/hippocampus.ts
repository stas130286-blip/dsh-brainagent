/**
 * Hippocampus — Multi-layer memory system with vector-powered recall.
 *
 * The hippocampus is responsible for forming new memories and transferring
 * them from short-term to long-term storage. Now upgraded with:
 *
 * 1. Working Memory   — current conversation context (managed by NeuroClaw sessions)
 * 2. Episodic Memory   — timestamped events with VECTOR SEARCH for associative recall
 * 3. Semantic Memory   — facts/knowledge with VECTOR SEARCH for concept matching
 * 4. Procedural Memory — learned workflows with VECTOR SEARCH for fuzzy triggers
 * 5. Consolidation     — background process that strengthens/prunes memories
 *
 * The vector engine enables associative recall: asking about "рыбалка на спиннинг"
 * now finds memories about "ловля щуки" and "блёсны" through semantic similarity,
 * not just keyword matching. This is how real neurons work — pattern completion.
 *
 * Storage: JSON files under .brainagent/memory/
 * Retrieval: TF-IDF vector search + recency weighting + salience scoring
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HostConfig as NeuroClawConfig } from "./host-config.ts";
import {
  getEmbedding,
  embeddingCosineSimilarity,
  resolveEmbeddingProvider,
} from "./ai-embeddings.ts";
import { bus } from "./event-bus.ts";
import { callLLM, isAIProviderAvailable } from "./llm-client.ts";
import type {
  BrainAgentConfig,
  EpisodicMemory,
  ProceduralMemory,
  SemanticMemory,
} from "./types.ts";
import { VectorIndex } from "./vector-engine.ts";
import { atomicWrite } from "./persist.ts";

// ── Pure helpers (module-level, stateless) ──────────────────────────

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadJson<T>(filePath: string, fallback: T): T {
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, "utf-8")) as T;
    }
  } catch {
    // Corrupted file — start fresh
  }
  return fallback;
}

function saveJson(filePath: string, data: unknown): void {
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Disk write failure — log but don't crash
  }
}

/**
 * Extract the "key" portion of a structured fact.
 * Many facts follow "Key: Value" or "Key = Value" patterns.
 * Returns the key prefix (lowercased, trimmed) or null if unstructured.
 */
function extractFactKey(content: string): string | null {
  // Match "Key: Value" or "Key = Value"
  const colonMatch = content.match(/^(.+?):\s+/);
  if (colonMatch) return colonMatch[1].trim().toLowerCase();
  const equalsMatch = content.match(/^(.+?)\s*=\s+/);
  if (equalsMatch) return equalsMatch[1].trim().toLowerCase();
  return null;
}

/**
 * Extract the "value" portion of a structured fact.
 */
function extractFactValue(content: string): string | null {
  const colonMatch = content.match(/^.+?:\s+(.+)$/);
  if (colonMatch) return colonMatch[1].trim().toLowerCase();
  const equalsMatch = content.match(/^.+?\s*=\s+(.+)$/);
  if (equalsMatch) return equalsMatch[1].trim().toLowerCase();
  return null;
}

/** Negation pairs for contradiction detection. */
const NEGATION_PAIRS: Array<[RegExp, RegExp]> = [
  [/\blikes?\b/i, /\bdislikes?\b/i],
  [/\bloves?\b/i, /\bhates?\b/i],
  [/\bнравится\b/i, /\bне нравится\b/i],
  [/\bлюбит\b/i, /\bне любит\b/i],
  [/\bхочет\b/i, /\bне хочет\b/i],
  [/\bможет\b/i, /\bне может\b/i],
  [/\bis\b/i, /\bis not\b/i],
  [/\bcan\b/i, /\bcannot\b|\bcan't\b/i],
];

const CONSOLIDATION_PROMPT = `Ты — модуль консолидации памяти. Тебе даётся список фактов (формат: id: содержание [категория]).

Задачи:
1. Найди ДУБЛИКАТЫ — факты с одинаковым смыслом (даже если сформулированы по-разному)
2. Найди ПРОТИВОРЕЧИЯ — факты, которые логически не могут быть одновременно истинными
3. Найди УСТАРЕВШИЕ — факты которые явно устарели при наличии более свежей версии

Ответ СТРОГО в JSON (без markdown):
{"duplicates":[["id1","id2"],...],"contradictions":[["id1","id2","причина"],...],"obsolete":["id1",...]}

Если ничего не найдено — пустые массивы. Будь КОНСЕРВАТИВЕН: при сомнении — НЕ отмечай.`;

function parseConsolidationResponse(response: string): {
  duplicates: string[][];
  contradictions: string[][];
  obsolete: string[];
} {
  const empty = { duplicates: [], contradictions: [], obsolete: [] };
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return empty;
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return {
      duplicates: Array.isArray(parsed.duplicates) ? parsed.duplicates : [],
      contradictions: Array.isArray(parsed.contradictions) ? parsed.contradictions : [],
      obsolete: Array.isArray(parsed.obsolete) ? parsed.obsolete : [],
    };
  } catch {
    return empty;
  }
}

// ── Types ───────────────────────────────────────────────────────────

/** Pending contradiction for dream-mode AI review (moderate confidence). */
export interface PendingContradiction {
  newFactId: string;
  existingFactId: string;
  similarity: number;
}

export interface HippocampusInstance {
  storeEpisode(
    event: string,
    summary: string,
    emotionalContext?: EpisodicMemory["emotionalContext"],
    entities?: string[],
    emotionIntensity?: number,
  ): EpisodicMemory;
  recallEpisodes(
    query: string,
    limit?: number,
    embeddingResults?: Array<{ id: string; score: number }>,
  ): EpisodicMemory[];
  storeFact(
    content: string,
    category: string,
    sourceEpisodeIds?: string[],
    relatedIds?: string[],
  ): SemanticMemory;
  getPendingContradictions(): PendingContradiction[];
  clearPendingContradictions(): void;
  detectContradiction(
    content: string,
    category: string,
  ): { contradicts: SemanticMemory; confidence: number } | null;
  reviseFact(
    existing: SemanticMemory,
    newContent: string,
    newConfidence: number,
    sourceEpisodeIds: string[],
    reason: string,
  ): SemanticMemory;
  getRevisionHistory(factId: string): Array<{
    previousContent: string;
    previousConfidence: number;
    revisedAt: number;
    reason: string;
  }>;
  recallFacts(
    query: string,
    category?: string,
    limit?: number,
    embeddingResults?: Array<{ id: string; score: number }>,
  ): SemanticMemory[];
  getFactsByCategory(category: string, limit?: number): SemanticMemory[];
  storeWorkflow(description: string, triggerPattern: string, steps: string[]): ProceduralMemory;
  findMatchingWorkflow(input: string): ProceduralMemory | undefined;
  recordWorkflowOutcome(procId: string, success: boolean): void;
  pruneWeakWorkflows(minSteps?: number): number;
  mergeDuplicateWorkflows(): number;
  recallAll(
    query: string,
    episodicLimit?: number,
    semanticLimit?: number,
  ): {
    episodic: EpisodicMemory[];
    semantic: SemanticMemory[];
    procedural: ProceduralMemory[];
  };
  recallAllAsync(
    query: string,
    episodicLimit?: number,
    semanticLimit?: number,
  ): Promise<{
    episodic: EpisodicMemory[];
    semantic: SemanticMemory[];
    procedural: ProceduralMemory[];
  }>;
  consolidate(
    config: BrainAgentConfig,
    neuroClawConfig?: NeuroClawConfig,
    logger?: { info: (msg: string) => void },
    intensity?: number,
    skipAIReview?: boolean,
  ): Promise<{
    merged: number;
    pruned: number;
    strengthened: number;
    contradictions: number;
    revised: number;
  }>;
  getStats(): {
    episodic: number;
    semantic: number;
    procedural: number;
    vectorVocabulary: { episodic: number; semantic: number; procedural: number };
  };
  getSemanticVersion(): number;
  initEmbeddings(config: NeuroClawConfig, logger?: { info: (msg: string) => void }): void;
  updateEmbeddingsConfig(config: NeuroClawConfig): void;
  getEmbeddingsStatus(): {
    available: boolean;
    provider: string;
    model: string;
    cached: { episodic: number; semantic: number; procedural: number };
  };
  stop(): void;
  dispose(): void;
}

// ── Factory ─────────────────────────────────────────────────────────

export function createHippocampus(workspaceDir: string): HippocampusInstance {
  // Пустой workspaceDir = detached-режим до init: состояние в памяти,
  // диск не трогается (точное поведение оригинала до initMemoryStorage).
  const memoryDir = workspaceDir ? join(workspaceDir, ".brainagent", "memory") : "";
  if (memoryDir) {
    ensureDir(memoryDir);
    ensureDir(join(memoryDir, "episodic"));
    ensureDir(join(memoryDir, "semantic"));
    ensureDir(join(memoryDir, "procedural"));
  }

  // ── In-memory stores (loaded from disk on init) ───────────────────
  let episodicStore: EpisodicMemory[] = [];
  let semanticStore: SemanticMemory[] = [];
  let proceduralStore: ProceduralMemory[] = [];

  /** Incremented on every semantic store mutation; used by dream-mode to skip redundant AI reviews. */
  let semanticVersion = 0;

  // ── Vector indices (one per memory layer) ─────────────────────────
  const episodicIndex = new VectorIndex();
  const semanticIndex = new VectorIndex();
  const proceduralIndex = new VectorIndex();

  // ── AI Embedding cache (optional, enhances search when available) ─
  /** Cached embeddings per memory layer: id → dense vector */
  const embeddingCache: {
    episodic: Map<string, number[]>;
    semantic: Map<string, number[]>;
    procedural: Map<string, number[]>;
  } = {
    episodic: new Map(),
    semantic: new Map(),
    procedural: new Map(),
  };

  let embeddingsConfig: NeuroClawConfig | null = null;
  let embeddingsLogger: { info: (msg: string) => void } | undefined;
  let embeddingsAvailable = false;
  let embeddingsCacheDir = "";

  /** Pending contradictions for dream-mode AI review (moderate confidence). */
  const pendingContradictions: PendingContradiction[] = [];

  /** Cache for recently computed query embeddings */
  const queryEmbeddingCache = new Map<string, number[]>();

  // Debounced save to prevent concurrent writes from overwriting each other.
  // Multiple saves to the same layer within 500ms are coalesced into one.
  const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

  // ── ID generation ─────────────────────────────────────────────────
  let idCounter = 0;
  function nextId(prefix: string): string {
    return `${prefix}-${Date.now()}-${++idCounter}`;
  }

  function loadEmbeddingCache(layer: string, cache: Map<string, number[]>): void {
    try {
      const filePath = join(embeddingsCacheDir, `${layer}.json`);
      if (existsSync(filePath)) {
        const data = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, number[]>;
        for (const [id, vec] of Object.entries(data)) {
          cache.set(id, vec);
        }
      }
    } catch {
      // Corrupted cache — start fresh
    }
  }

  function saveEmbeddingCache(layer: string, cache: Map<string, number[]>): void {
    try {
      const filePath = join(embeddingsCacheDir, `${layer}.json`);
      const obj: Record<string, number[]> = {};
      for (const [id, vec] of cache) {
        obj[id] = vec;
      }
      // Атомарно (tmp + rename): кэш не повреждается при прерывании (v0.2.0)
      atomicWrite(filePath, JSON.stringify(obj));
    } catch {
      // Disk write failure
    }
  }

  function saveEmbeddingCacheDebounced(layer: string, cache: Map<string, number[]>): void {
    const existing = pendingSaves.get(layer);
    if (existing) clearTimeout(existing);
    pendingSaves.set(
      layer,
      setTimeout(() => {
        pendingSaves.delete(layer);
        saveEmbeddingCache(layer, cache);
      }, 500),
    );
  }

  /**
   * Compute embeddings for documents that don't have cached embeddings yet.
   * Runs in the background, doesn't block initialization.
   */
  function scheduleEmbeddingBackfill(): void {
    if (!embeddingsConfig) return;

    const config = embeddingsConfig;

    // Find documents without embeddings
    const missing: Array<{ layer: string; id: string; text: string }> = [];

    for (const ep of episodicStore) {
      if (!embeddingCache.episodic.has(ep.id)) {
        missing.push({ layer: "episodic", id: ep.id, text: `${ep.event} ${ep.summary}` });
      }
    }
    for (const fact of semanticStore) {
      if (!embeddingCache.semantic.has(fact.id)) {
        missing.push({ layer: "semantic", id: fact.id, text: `${fact.content} ${fact.category}` });
      }
    }
    for (const proc of proceduralStore) {
      if (!embeddingCache.procedural.has(proc.id)) {
        missing.push({
          layer: "procedural",
          id: proc.id,
          text: `${proc.description} ${proc.triggerPattern}`,
        });
      }
    }

    if (missing.length === 0) return;

    embeddingsLogger?.info(
      `BrainAgent Embeddings: computing ${missing.length} missing embeddings in background...`,
    );

    // Process in small batches to avoid overwhelming the API
    void (async () => {
      for (let i = 0; i < missing.length; i++) {
        const item = missing[i];
        try {
          const vec = await getEmbedding(item.text, config, embeddingsLogger);
          if (vec) {
            const cache = embeddingCache[item.layer as keyof typeof embeddingCache];
            cache.set(item.id, vec);
          }
        } catch {
          // Skip this document
        }
        // Small delay between requests to be respectful to the API
        if (i < missing.length - 1) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      // Save all caches after backfill (debounced to avoid overwriting concurrent updates)
      saveEmbeddingCacheDebounced("episodic", embeddingCache.episodic);
      saveEmbeddingCacheDebounced("semantic", embeddingCache.semantic);
      saveEmbeddingCacheDebounced("procedural", embeddingCache.procedural);
      embeddingsLogger?.info("BrainAgent Embeddings: backfill complete");
    })();
  }

  /**
   * Search using embeddings if available.
   * Returns similarity scores sorted descending, or null if embeddings unavailable.
   */
  async function searchWithEmbeddings(
    query: string,
    layer: "episodic" | "semantic" | "procedural",
    topK: number,
  ): Promise<Array<{ id: string; score: number }> | null> {
    if (!embeddingsAvailable || !embeddingsConfig) return null;

    const cache = embeddingCache[layer];
    if (cache.size === 0) return null;

    const queryVec = await getEmbedding(query, embeddingsConfig, embeddingsLogger);
    if (!queryVec) return null;

    const results: Array<{ id: string; score: number }> = [];
    for (const [id, docVec] of cache) {
      const score = embeddingCosineSimilarity(queryVec, docVec);
      if (score > 0.1) {
        results.push({ id, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Rebuild all vector indices from current stores.
   * Called on startup and after consolidation.
   */
  function rebuildVectorIndices(): void {
    // Episodic: index event + summary + entities
    for (const ep of episodicStore) {
      episodicIndex.add(ep.id, `${ep.event} ${ep.summary} ${ep.entities.join(" ")}`);
    }
    // Semantic: index content + category
    for (const fact of semanticStore) {
      semanticIndex.add(fact.id, `${fact.content} ${fact.category}`);
    }
    // Procedural: index description + trigger pattern + steps
    for (const proc of proceduralStore) {
      proceduralIndex.add(
        proc.id,
        `${proc.description} ${proc.triggerPattern} ${proc.steps.join(" ")}`,
      );
    }
  }

  // ── JSON persistence ──────────────────────────────────────────────

  function loadAll(): void {
    if (!memoryDir) return;
    episodicStore = loadJson(join(memoryDir, "episodic", "store.json"), []);
    semanticStore = loadJson(join(memoryDir, "semantic", "store.json"), []);
    proceduralStore = loadJson(join(memoryDir, "procedural", "store.json"), []);
  }

  function persistEpisodic(): void {
    if (!memoryDir) return;
    saveJson(join(memoryDir, "episodic", "store.json"), episodicStore);
  }

  function persistSemantic(): void {
    if (!memoryDir) return;
    saveJson(join(memoryDir, "semantic", "store.json"), semanticStore);
  }

  function persistProcedural(): void {
    if (!memoryDir) return;
    saveJson(join(memoryDir, "procedural", "store.json"), proceduralStore);
  }

  // ── Embeddings public API (instance) ──────────────────────────────

  /**
   * Initialize AI embeddings for enhanced semantic search.
   * Call after initMemoryStorage(). If no embedding provider is configured,
   * falls back to TF-IDF silently.
   */
  function initEmbeddings(
    config: NeuroClawConfig,
    logger?: { info: (msg: string) => void },
  ): void {
    const provider = resolveEmbeddingProvider(config);
    if (!provider) {
      logger?.info("BrainAgent Hippocampus: no embedding provider — using TF-IDF");
      return;
    }

    embeddingsConfig = config;
    embeddingsLogger = logger;
    embeddingsAvailable = true;
    embeddingsCacheDir = join(memoryDir, "..", "embeddings");
    ensureDir(embeddingsCacheDir);

    logger?.info(
      `BrainAgent Hippocampus: embeddings enabled via ${provider.name} (${provider.model})`,
    );

    // Load cached embeddings from disk
    loadEmbeddingCache("episodic", embeddingCache.episodic);
    loadEmbeddingCache("semantic", embeddingCache.semantic);
    loadEmbeddingCache("procedural", embeddingCache.procedural);

    // Schedule background embedding computation for documents without embeddings
    scheduleEmbeddingBackfill();
  }

  /**
   * Update the cached embedding config so that subsequent embedding calls
   * use the latest provider/model from user's config.
   * Called on each message cycle with fresh api.config.
   */
  function updateEmbeddingsConfig(config: NeuroClawConfig): void {
    if (!embeddingsAvailable) {
      // Эмбеддингов не было на старте — проверяем, не появились ли они сейчас
      const provider = resolveEmbeddingProvider(config);
      if (provider) {
        embeddingsConfig = config;
        embeddingsAvailable = true;
        // Полноценная ленивая активация (v0.2.0): каталог, кэш, бэкфилл
        embeddingsCacheDir = join(memoryDir, "..", "embeddings");
        ensureDir(embeddingsCacheDir);
        loadEmbeddingCache("episodic", embeddingCache.episodic);
        loadEmbeddingCache("semantic", embeddingCache.semantic);
        loadEmbeddingCache("procedural", embeddingCache.procedural);
        scheduleEmbeddingBackfill();
        embeddingsLogger?.info(
          `BrainAgent Hippocampus: embeddings enabled via ${provider.name} (${provider.model}) — lazy activation`,
        );
      }
      return;
    }
    embeddingsConfig = config;
  }

  /**
   * Статус эмбеддингов для диагностики (/brainagent neuro, v0.2.0).
   */
  function getEmbeddingsStatus(): {
    available: boolean;
    provider: string;
    model: string;
    cached: { episodic: number; semantic: number; procedural: number };
  } {
    const provider = embeddingsConfig ? resolveEmbeddingProvider(embeddingsConfig) : null;
    return {
      available: embeddingsAvailable && provider !== null,
      provider: provider?.name ?? "—",
      model: provider?.model ?? "—",
      cached: {
        episodic: embeddingCache.episodic.size,
        semantic: embeddingCache.semantic.size,
        procedural: embeddingCache.procedural.size,
      },
    };
  }

  // Load stores and build indices on creation (as initMemoryStorage did)
  loadAll();
  rebuildVectorIndices();

  // ════════════════════════════════════════════════════════════════
  // EPISODIC MEMORY — "What happened, when, in what emotional context"
  // ════════════════════════════════════════════════════════════════

  function storeEpisode(
    event: string,
    summary: string,
    emotionalContext: EpisodicMemory["emotionalContext"] = "neutral",
    entities: string[] = [],
    emotionIntensity = 0,
  ): EpisodicMemory {
    // Emotional memory enhancement: strong emotions boost initial salience.
    // In the real brain, the amygdala modulates hippocampal encoding —
    // emotionally charged events are remembered more vividly and longer.
    const emotionalBoost = emotionIntensity > 0.5 ? emotionIntensity * 0.15 : 0;
    const baseSalience = Math.min(1, 0.8 + emotionalBoost);

    const episode: EpisodicMemory = {
      id: nextId("ep"),
      timestamp: Date.now(),
      summary,
      event,
      emotionalContext,
      entities,
      salience: baseSalience,
      accessCount: 0,
    };
    episodicStore.push(episode);

    // Index in vector engine for associative recall
    episodicIndex.add(episode.id, `${event} ${summary} ${entities.join(" ")}`);

    // Schedule background embedding computation
    if (embeddingsAvailable && embeddingsConfig) {
      const config = embeddingsConfig;
      void getEmbedding(`${event} ${summary}`, config, embeddingsLogger).then((vec) => {
        if (vec) {
          embeddingCache.episodic.set(episode.id, vec);
          saveEmbeddingCacheDebounced("episodic", embeddingCache.episodic);
        }
      });
    }

    persistEpisodic();
    bus.emitSync("hippocampus:stored", { layer: "episodic", id: episode.id });
    return episode;
  }

  /**
   * Recall episodic memories using hybrid search:
   * vector similarity (60%) + recency (20%) + salience (20%)
   *
   * This mimics how real memory works: recent emotional events are recalled
   * more easily, but even old memories surface if they're semantically similar.
   */
  function recallEpisodes(
    query: string,
    limit = 5,
    embeddingResults?: Array<{ id: string; score: number }>,
  ): EpisodicMemory[] {
    if (episodicStore.length === 0) return [];

    // Get vector similarity scores (TF-IDF)
    const vectorResults = episodicIndex.search(query, Math.min(limit * 3, episodicStore.length));
    const vectorScoreMap = new Map(vectorResults.map((r) => [r.id, r.score]));

    // Merge embedding scores if available
    const embScoreMap = embeddingResults
      ? new Map(embeddingResults.map((r) => [r.id, r.score]))
      : null;

    // Compute hybrid scores for ALL episodes
    const scored = episodicStore.map((ep) => {
      const tfidfScore = vectorScoreMap.get(ep.id) ?? 0;
      const embScore = embScoreMap?.get(ep.id) ?? 0;
      // If embeddings available: 40% embedding + 20% TF-IDF + 20% recency + 20% salience
      // If not: 60% TF-IDF + 20% recency + 20% salience
      const vectorScore = embScoreMap ? embScore * 0.4 + tfidfScore * 0.2 : tfidfScore * 0.6;
      const recencyDays = (Date.now() - ep.timestamp) / (24 * 60 * 60 * 1000);
      const recencyScore = 1 / (1 + recencyDays * 0.1);
      const salienceScore = ep.salience;

      // Hybrid: vector + recency 20% + salience 20%
      const score = vectorScore + recencyScore * 0.2 + salienceScore * 0.2;
      return { episode: ep, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const results = scored
      .slice(0, limit)
      .filter((s) => s.score > 0.05)
      .map((s) => s.episode);

    // Hebb's rule: strengthen recalled memories
    for (const ep of results) {
      ep.accessCount++;
      ep.salience = Math.min(1, ep.salience + 0.05);
    }
    if (results.length > 0) persistEpisodic();

    return results;
  }

  // ════════════════════════════════════════════════════════════════
  // SEMANTIC MEMORY — "Facts, knowledge, concepts"
  // ════════════════════════════════════════════════════════════════

  function storeFact(
    content: string,
    category: string,
    sourceEpisodeIds: string[] = [],
    relatedIds: string[] = [],
  ): SemanticMemory {
    // Check for duplicate/similar facts via exact match
    const existing = semanticStore.find(
      (f) => f.content.toLowerCase() === content.toLowerCase() && f.category === category,
    );
    if (existing) {
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      existing.updatedAt = Date.now();
      existing.sourceEpisodeIds = [...new Set([...existing.sourceEpisodeIds, ...sourceEpisodeIds])];
      // Re-index with updated content
      semanticIndex.add(existing.id, `${existing.content} ${existing.category}`);
      semanticVersion++;
      persistSemantic();
      return existing;
    }

    // Check for near-duplicate via vector similarity
    const similar = semanticIndex.search(`${content} ${category}`, 1, 0.85);
    if (similar.length > 0) {
      const nearDup = semanticStore.find((f) => f.id === similar[0].id);
      if (nearDup) {
        // Strengthen the existing near-duplicate instead of creating new
        nearDup.confidence = Math.min(1, nearDup.confidence + 0.15);
        nearDup.updatedAt = Date.now();
        nearDup.sourceEpisodeIds = [...new Set([...nearDup.sourceEpisodeIds, ...sourceEpisodeIds])];
        nearDup.relatedIds = [...new Set([...nearDup.relatedIds, ...relatedIds])];
        semanticVersion++;
        persistSemantic();
        return nearDup;
      }
    }

    // Check for contradiction — same subject, different claim (memory reconsolidation).
    // Track the pending queue length so Tier-2 entries queued during this call
    // can be backfilled with the new fact's id once it exists.
    const pendingBefore = pendingContradictions.length;
    const contradiction = detectContradiction(content, category);
    if (contradiction && contradiction.confidence >= 0.7) {
      return reviseFact(
        contradiction.contradicts,
        content,
        0.7, // default confidence for new facts
        sourceEpisodeIds,
        `newer fact supersedes (confidence: ${contradiction.confidence.toFixed(2)})`,
      );
    }

    const fact: SemanticMemory = {
      id: nextId("sem"),
      content,
      category,
      relatedIds,
      confidence: 0.7,
      sourceEpisodeIds,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    semanticStore.push(fact);
    semanticIndex.add(fact.id, `${content} ${category}`);
    semanticVersion++;

    // Backfill newFactId on Tier-2 contradictions queued by detectContradiction —
    // dream-mode consolidation needs the link between the new and existing facts.
    for (let i = pendingBefore; i < pendingContradictions.length; i++) {
      pendingContradictions[i].newFactId = fact.id;
    }

    // Schedule background embedding computation
    if (embeddingsAvailable && embeddingsConfig) {
      const config = embeddingsConfig;
      void getEmbedding(`${content} ${category}`, config, embeddingsLogger).then((vec) => {
        if (vec) {
          embeddingCache.semantic.set(fact.id, vec);
          saveEmbeddingCacheDebounced("semantic", embeddingCache.semantic);
        }
      });
    }

    persistSemantic();
    bus.emitSync("hippocampus:stored", { layer: "semantic", id: fact.id });
    return fact;
  }

  // ── Memory Reconsolidation ──────────────────────────────────────
  // When humans recall a memory and encounter new contradicting info,
  // the memory becomes labile and gets rewritten. This is reconsolidation.

  function getPendingContradictions(): PendingContradiction[] {
    return [...pendingContradictions];
  }

  function clearPendingContradictions(): void {
    pendingContradictions.length = 0;
  }

  /**
   * Detect if a new fact contradicts an existing one in semantic memory.
   *
   * Tier 1 (structural): Same key prefix, different value → immediate reconsolidation.
   * Tier 2 (moderate similarity): Topically related but not duplicate → deferred to dream-mode.
   *
   * Returns the contradicting fact and confidence, or null.
   */
  function detectContradiction(
    content: string,
    category: string,
  ): { contradicts: SemanticMemory; confidence: number } | null {
    const sameCategoryFacts = semanticStore.filter((f) => f.category === category);
    if (sameCategoryFacts.length === 0) return null;

    const newKey = extractFactKey(content);
    const newValue = extractFactValue(content);

    // Tier 1a: Structural key:value contradiction
    if (newKey && newValue) {
      for (const existing of sameCategoryFacts) {
        const existingKey = extractFactKey(existing.content);
        const existingValue = extractFactValue(existing.content);
        if (existingKey && existingValue && existingKey === newKey && existingValue !== newValue) {
          return { contradicts: existing, confidence: 0.85 };
        }
      }
    }

    // Tier 1b: Negation flip — "likes X" vs "dislikes X"
    for (const existing of sameCategoryFacts) {
      for (const [posPattern, negPattern] of NEGATION_PAIRS) {
        const newHasPos = posPattern.test(content);
        const newHasNeg = negPattern.test(content);
        const existHasPos = posPattern.test(existing.content);
        const existHasNeg = negPattern.test(existing.content);

        if ((newHasPos && existHasNeg) || (newHasNeg && existHasPos)) {
          // Both facts mention something about the same subject?
          // Check that they share at least one meaningful word beyond the negation pair
          const newWords = new Set(
            content
              .toLowerCase()
              .split(/\s+/)
              .filter((w) => w.length > 3),
          );
          const existWords = existing.content
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3);
          const overlap = existWords.filter((w) => newWords.has(w)).length;
          if (overlap >= 1) {
            return { contradicts: existing, confidence: 0.8 };
          }
        }
      }
    }

    // Tier 2: Moderate vector similarity → defer to dream-mode
    const similar = semanticIndex.search(`${content} ${category}`, 3, 0.4);
    for (const match of similar) {
      if (match.score >= 0.85) continue; // Already handled as near-duplicate in storeFact
      if (match.score >= 0.4) {
        const existing = sameCategoryFacts.find((f) => f.id === match.id);
        if (existing) {
          pendingContradictions.push({
            newFactId: "", // Backfilled by storeFact once the fact exists
            existingFactId: existing.id,
            similarity: match.score,
          });
        }
      }
    }

    return null;
  }

  /**
   * Revise an existing fact — memory reconsolidation.
   *
   * The old content is preserved in revisionHistory (capped at 5),
   * and the fact's content is updated with the new information.
   * Confidence is weighted: newConfidence * 0.7 + oldConfidence * 0.3
   * (recency bias, like human memory).
   */
  function reviseFact(
    existing: SemanticMemory,
    newContent: string,
    newConfidence: number,
    sourceEpisodeIds: string[],
    reason: string,
  ): SemanticMemory {
    const oldContent = existing.content;
    const oldConfidence = existing.confidence;

    // Push old version to revision history
    if (!existing.revisionHistory) existing.revisionHistory = [];
    existing.revisionHistory.push({
      previousContent: oldContent,
      previousConfidence: oldConfidence,
      revisedAt: Date.now(),
      reason,
      sourceEpisodeIds,
    });

    // Cap at 5 entries (oldest first)
    if (existing.revisionHistory.length > 5) {
      existing.revisionHistory = existing.revisionHistory.slice(-5);
    }

    // Update content and confidence (recency-weighted)
    existing.content = newContent;
    existing.confidence = Math.min(1, newConfidence * 0.7 + oldConfidence * 0.3);
    existing.updatedAt = Date.now();
    existing.sourceEpisodeIds = [...new Set([...existing.sourceEpisodeIds, ...sourceEpisodeIds])];

    // Re-index
    semanticIndex.add(existing.id, `${newContent} ${existing.category}`);
    semanticVersion++;

    // Update embedding if available
    if (embeddingsAvailable && embeddingsConfig) {
      const config = embeddingsConfig;
      void getEmbedding(`${newContent} ${existing.category}`, config, embeddingsLogger).then(
        (vec) => {
          if (vec) {
            embeddingCache.semantic.set(existing.id, vec);
            saveEmbeddingCacheDebounced("semantic", embeddingCache.semantic);
          }
        },
      );
    }

    persistSemantic();

    bus.emitSync("hippocampus:fact-revised", {
      factId: existing.id,
      oldContent,
      newContent,
      reason,
    });

    return existing;
  }

  /**
   * Get revision history for a specific fact.
   * Returns empty array if fact not found or has no revisions.
   */
  function getRevisionHistory(factId: string): Array<{
    previousContent: string;
    previousConfidence: number;
    revisedAt: number;
    reason: string;
  }> {
    const fact = semanticStore.find((f) => f.id === factId);
    if (!fact?.revisionHistory) return [];
    return [...fact.revisionHistory];
  }

  /**
   * Recall semantic facts using hybrid search:
   * vector similarity (70%) + confidence (30%)
   *
   * Heavily weighted toward vector similarity because semantic memory
   * is about concepts and meaning, not timing.
   */
  function recallFacts(
    query: string,
    category?: string,
    limit = 10,
    embeddingResults?: Array<{ id: string; score: number }>,
  ): SemanticMemory[] {
    let candidates = semanticStore;
    if (category) {
      candidates = candidates.filter((f) => f.category === category);
    }
    if (candidates.length === 0) return [];

    const vectorResults = semanticIndex.search(query, Math.min(limit * 3, semanticStore.length));
    const vectorScoreMap = new Map(vectorResults.map((r) => [r.id, r.score]));

    // Merge embedding scores if available
    const embScoreMap = embeddingResults
      ? new Map(embeddingResults.map((r) => [r.id, r.score]))
      : null;

    const candidateIds = new Set(candidates.map((f) => f.id));

    const scored = candidates.map((fact) => {
      const tfidfScore = candidateIds.has(fact.id) ? (vectorScoreMap.get(fact.id) ?? 0) : 0;
      const embScore = embScoreMap?.get(fact.id) ?? 0;
      // If embeddings: 50% embedding + 20% TF-IDF + 30% confidence
      // If not: 70% TF-IDF + 30% confidence
      const vectorScore = embScoreMap ? embScore * 0.5 + tfidfScore * 0.2 : tfidfScore * 0.7;
      const score = vectorScore + fact.confidence * 0.3;
      return { fact, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored
      .slice(0, limit)
      .filter((s) => s.score > 0.03)
      .map((s) => s.fact);
  }

  /**
   * Get all facts in a category without TF-IDF scoring.
   * Used by DMN for cross-category association finding where we need
   * raw facts, not query-relevance-ranked results.
   */
  function getFactsByCategory(category: string, limit = 10): SemanticMemory[] {
    const candidates = semanticStore.filter((f) => f.category === category);
    if (candidates.length === 0) return [];
    // Sort by confidence descending, return top N
    return [...candidates].sort((a, b) => b.confidence - a.confidence).slice(0, limit);
  }

  // ════════════════════════════════════════════════════════════════
  // PROCEDURAL MEMORY — "Learned workflows and habits"
  // ════════════════════════════════════════════════════════════════

  function storeWorkflow(
    description: string,
    triggerPattern: string,
    steps: string[],
  ): ProceduralMemory {
    // v0.9.3: повторное извлечение того же триггера усиливает
    // существующую запись, а не плодит дубликаты (боевой тест:
    // 11 копий одного триггера; storeFact так умеет с v0.1).
    const key = triggerPattern.trim().toLowerCase();
    const existing = proceduralStore.find(
      (p) => p.triggerPattern.trim().toLowerCase() === key,
    );
    if (existing) {
      existing.lastUsed = Date.now();
      if (steps.length > 0 && existing.steps.length === 0) {
        existing.steps = steps;
        proceduralIndex.remove(existing.id);
        proceduralIndex.add(
          existing.id,
          `${existing.description} ${existing.triggerPattern} ${steps.join(" ")}`,
        );
      }
      persistProcedural();
      return existing;
    }
    // v0.9.14: LLM формулирует триггер по-разному при каждой диктовке,
    // но процедура (набор шагов) та же — сливаем по отпечатку шагов.
    // Одиночные шаги не сливаем: это старые одношаговые записи, у них
    // смысл различается именно триггером.
    const fp = stepsFingerprint(steps);
    if (fp && fp.split("\u0000").length >= 2) {
      const sameSteps = proceduralStore.find((p) => stepsFingerprint(p.steps) === fp);
      if (sameSteps) {
        sameSteps.lastUsed = Date.now();
        persistProcedural();
        return sameSteps;
      }
    }
    const proc: ProceduralMemory = {
      id: nextId("proc"),
      description,
      triggerPattern,
      steps,
      successRate: 0.5,
      usageCount: 0,
      lastUsed: Date.now(),
    };
    proceduralStore.push(proc);
    proceduralIndex.add(proc.id, `${description} ${triggerPattern} ${steps.join(" ")}`);
    persistProcedural();
    bus.emitSync("hippocampus:stored", { layer: "procedural", id: proc.id });
    return proc;
  }

  /**
   * Find matching workflow using vector similarity.
   * The brain doesn't pattern-match "word by word" — it recognizes
   * the gist of a situation and recalls the appropriate motor program.
   */
  function findMatchingWorkflow(input: string): ProceduralMemory | undefined {
    if (proceduralStore.length === 0) return undefined;

    const vectorResults = proceduralIndex.search(input, 3, 0.15);
    if (vectorResults.length === 0) return undefined;

    // Find the best match combining vector score and success rate
    let bestMatch: ProceduralMemory | undefined;
    let bestScore = 0;

    for (const result of vectorResults) {
      const proc = proceduralStore.find((p) => p.id === result.id);
      if (!proc) continue;
      const score = result.score * 0.7 + proc.successRate * 0.3;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = proc;
      }
    }

    if (bestMatch) {
      bestMatch.usageCount++;
      bestMatch.lastUsed = Date.now();
      persistProcedural();
    }

    return bestMatch;
  }

  function recordWorkflowOutcome(procId: string, success: boolean): void {
    const proc = proceduralStore.find((p) => p.id === procId);
    if (!proc) return;
    const alpha = 0.3;
    proc.successRate = proc.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;
    persistProcedural();
  }

  /**
   * v0.9.13: чистка стора от слабых процедур (меньше minSteps
   * содержательных уникальных шагов). Ранние версии экстрактора
   * накапливали мусор вида «Action: ANY» (0–1 шаг). Идемпотентна.
   */
  function pruneWeakWorkflows(minSteps = 2): number {
    const keep: ProceduralMemory[] = [];
    let removed = 0;
    for (const proc of proceduralStore) {
      const uniqueSteps = new Set(
        proc.steps
          .map((s) => s.trim())
          .filter((s) => s.length >= 3)
          .map((s) => s.toLowerCase()),
      );
      if (uniqueSteps.size >= minSteps) {
        keep.push(proc);
      } else {
        proceduralIndex.remove(proc.id);
        removed++;
      }
    }
    if (removed > 0) {
      proceduralStore = keep;
      persistProcedural();
    }
    return removed;
  }

  /**
   * v0.9.14: нормализованный «отпечаток» набора шагов —
   * регистр и пробелы не важны, порядок не важен.
   */
  function stepsFingerprint(stepsArr: string[]): string {
    return stepsArr
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length >= 3)
      .sort()
      .join("\u0000");
  }

  /**
   * v0.9.14: слияние дублей процедур с одинаковым набором шагов.
   * LLM формулирует триггер по-разному при каждой диктовке, поэтому
   * точное сравнение триггеров пропускает дубли. Оставляет самую
   * используемую запись, суммируя usageCount и лучший successRate.
   */
  function mergeDuplicateWorkflows(): number {
    const byFingerprint = new Map<string, ProceduralMemory[]>();
    for (const proc of proceduralStore) {
      const fp = stepsFingerprint(proc.steps);
      if (!fp) continue;
      const group = byFingerprint.get(fp);
      if (group) group.push(proc);
      else byFingerprint.set(fp, [proc]);
    }
    let merged = 0;
    for (const group of byFingerprint.values()) {
      if (group.length < 2) continue;
      group.sort((a, b) => b.usageCount - a.usageCount || b.lastUsed - a.lastUsed);
      const keep = group[0];
      for (const dup of group.slice(1)) {
        keep.usageCount += dup.usageCount;
        keep.lastUsed = Math.max(keep.lastUsed, dup.lastUsed);
        keep.successRate = Math.max(keep.successRate, dup.successRate);
        proceduralIndex.remove(dup.id);
        merged++;
      }
      proceduralIndex.remove(keep.id);
      proceduralIndex.add(
        keep.id,
        `${keep.description} ${keep.triggerPattern} ${keep.steps.join(" ")}`,
      );
      const drop = new Set(group.slice(1).map((d) => d.id));
      proceduralStore = proceduralStore.filter((p) => !drop.has(p.id));
    }
    if (merged > 0) persistProcedural();
    return merged;
  }

  // ════════════════════════════════════════════════════════════════
  // RECALL ALL — unified memory retrieval for prompt builder
  // ════════════════════════════════════════════════════════════════

  async function computeAndCacheQueryEmbedding(query: string): Promise<void> {
    if (queryEmbeddingCache.has(query) || !embeddingsConfig) return;
    const vec = await getEmbedding(query, embeddingsConfig, embeddingsLogger);
    if (vec) queryEmbeddingCache.set(query, vec);
    // Keep cache small
    if (queryEmbeddingCache.size > 50) {
      const first = queryEmbeddingCache.keys().next().value;
      if (first) queryEmbeddingCache.delete(first);
    }
  }

  /**
   * Get cached embedding scores synchronously (from query cache + doc cache).
   * Returns null if query embedding isn't cached yet.
   */
  function getEmbeddingScoresSync(query: string): {
    episodic: Array<{ id: string; score: number }>;
    semantic: Array<{ id: string; score: number }>;
  } | null {
    const queryVec = queryEmbeddingCache.get(query);
    if (!queryVec) return null;

    function scoreLayer(cache: Map<string, number[]>): Array<{ id: string; score: number }> {
      const results: Array<{ id: string; score: number }> = [];
      for (const [id, docVec] of cache) {
        const score = embeddingCosineSimilarity(queryVec!, docVec);
        if (score > 0.1) results.push({ id, score });
      }
      results.sort((a, b) => b.score - a.score);
      return results;
    }

    return {
      episodic: scoreLayer(embeddingCache.episodic),
      semantic: scoreLayer(embeddingCache.semantic),
    };
  }

  function recallAll(
    query: string,
    episodicLimit = 3,
    semanticLimit = 5,
  ): {
    episodic: EpisodicMemory[];
    semantic: SemanticMemory[];
    procedural: ProceduralMemory[];
  } {
    // Try embedding-enhanced search first, merge with TF-IDF
    const embeddingScores = embeddingsAvailable ? getEmbeddingScoresSync(query) : null;

    const episodic = recallEpisodes(query, episodicLimit, embeddingScores?.episodic);
    const semantic = recallFacts(query, undefined, semanticLimit, embeddingScores?.semantic);
    const workflow = findMatchingWorkflow(query);

    const result = {
      episodic,
      semantic,
      procedural: workflow ? [workflow] : [],
    };

    bus.emit("hippocampus:recalled", result);

    // Schedule async embedding computation for query (warm cache for next time)
    if (embeddingsAvailable && embeddingsConfig) {
      void computeAndCacheQueryEmbedding(query);
    }

    return result;
  }

  /**
   * Async version of recallAll that waits for embedding search.
   * Use this when calling from an async context (hooks).
   * episodicLimit/semanticLimit are modulated by the attention mechanism
   * (norepinephrine level) — high attention = deeper recall.
   */
  async function recallAllAsync(
    query: string,
    episodicLimit = 3,
    semanticLimit = 5,
  ): Promise<{
    episodic: EpisodicMemory[];
    semantic: SemanticMemory[];
    procedural: ProceduralMemory[];
  }> {
    if (!embeddingsAvailable) {
      return recallAll(query, episodicLimit, semanticLimit);
    }

    // Compute embedding-based scores for all layers
    const [epScores, semScores] = await Promise.all([
      searchWithEmbeddings(query, "episodic", 15),
      searchWithEmbeddings(query, "semantic", 15),
    ]);

    const episodic = recallEpisodes(query, episodicLimit, epScores ?? undefined);
    const semantic = recallFacts(query, undefined, semanticLimit, semScores ?? undefined);
    const workflow = findMatchingWorkflow(query);

    const result = {
      episodic,
      semantic,
      procedural: workflow ? [workflow] : [],
    };

    bus.emit("hippocampus:recalled", result);
    return result;
  }

  // ════════════════════════════════════════════════════════════════
  // CONSOLIDATION — called by Dream Mode
  // ════════════════════════════════════════════════════════════════

  /**
   * Consolidate memories — the core "dream" operation.
   * @param intensity - How aggressively to consolidate (0-1).
   *                    Higher = more merging, pruning, strengthening.
   *                    Default 0.5 for moderate consolidation.
   */
  async function consolidate(
    config: BrainAgentConfig,
    neuroClawConfig?: NeuroClawConfig,
    logger?: { info: (msg: string) => void },
    intensity = 0.5,
    skipAIReview = false,
  ): Promise<{
    merged: number;
    pruned: number;
    strengthened: number;
    contradictions: number;
    revised: number;
  }> {
    let merged = 0;
    let pruned = 0;
    let strengthened = 0;
    let contradictions = 0;
    let revised = 0;

    // Intensity modulates thresholds:
    // - Low intensity (0.1-0.3): only prune very weak memories, minimal merging
    // - Medium intensity (0.4-0.6): standard consolidation
    // - High intensity (0.7-1.0): aggressive pruning, more merging, deeper analysis
    const pruneThreshold = 1.0 - intensity * 0.5; // 0.5-1.0 → higher = stricter
    const mergeThreshold = 0.7 + (1 - intensity) * 0.2; // 0.7-0.9 → lower intensity = stricter
    const strengthenBonus = 0.05 + intensity * 0.1; // 0.05-0.15

    // 1. Decay salience on episodic memories
    const decayFactor = config.memory.salienceDecayFactor;
    for (const ep of episodicStore) {
      const daysSince = (Date.now() - ep.timestamp) / (24 * 60 * 60 * 1000);
      ep.salience *= decayFactor ** daysSince;
    }

    // 2. Prune low-salience episodic memories that exceed limit
    // Higher intensity = more aggressive limit (prune more)
    const effectiveMaxEpisodic = Math.floor(
      config.memory.maxEpisodicMemories * (1.1 - intensity * 0.2),
    );
    if (episodicStore.length > effectiveMaxEpisodic) {
      episodicStore.sort((a, b) => b.salience - a.salience);
      const removed = episodicStore.splice(effectiveMaxEpisodic);
      for (const r of removed) episodicIndex.remove(r.id);
      pruned += removed.length;
    }

    // 3. Strengthen frequently accessed memories
    // Higher intensity = more strengthening bonus
    for (const ep of episodicStore) {
      if (ep.accessCount > 3) {
        ep.salience = Math.min(1, ep.salience + strengthenBonus);
        strengthened++;
      }
    }

    // 4. Merge duplicate/near-duplicate semantic facts via vector similarity
    // Higher intensity = lower similarity threshold (more merging)
    const toRemoveIds = new Set<string>();
    for (let i = 0; i < semanticStore.length; i++) {
      const fact = semanticStore[i];
      if (toRemoveIds.has(fact.id)) continue;

      // Find near-duplicates
      const similar = semanticIndex.search(`${fact.content} ${fact.category}`, 5, mergeThreshold);
      for (const match of similar) {
        if (match.id === fact.id || toRemoveIds.has(match.id)) continue;
        const dup = semanticStore.find((f) => f.id === match.id);
        if (!dup || dup.category !== fact.category) continue;

        // Merge into the more confident one
        fact.confidence = Math.max(fact.confidence, dup.confidence);
        fact.sourceEpisodeIds = [...new Set([...fact.sourceEpisodeIds, ...dup.sourceEpisodeIds])];
        fact.relatedIds = [...new Set([...fact.relatedIds, ...dup.relatedIds])];
        fact.updatedAt = Date.now();
        toRemoveIds.add(dup.id);
        merged++;
      }
    }
    for (const id of toRemoveIds) semanticIndex.remove(id);
    semanticStore = semanticStore.filter((f) => !toRemoveIds.has(f.id));

    // 5. Cap semantic store size
    if (semanticStore.length > config.memory.maxSemanticMemories) {
      semanticStore.sort((a, b) => b.confidence - a.confidence);
      const removed = semanticStore.splice(config.memory.maxSemanticMemories);
      for (const r of removed) semanticIndex.remove(r.id);
      pruned += removed.length;
    }

    // 6. Prune unused procedural memories
    const procCutoffMs = 30 * 24 * 60 * 60 * 1000;
    const beforeLen = proceduralStore.length;
    const removedProcs = proceduralStore.filter(
      (p) => p.usageCount === 0 && Date.now() - p.lastUsed >= procCutoffMs,
    );
    for (const r of removedProcs) proceduralIndex.remove(r.id);
    proceduralStore = proceduralStore.filter(
      (p) => p.usageCount > 0 || Date.now() - p.lastUsed < procCutoffMs,
    );
    pruned += beforeLen - proceduralStore.length;

    // 7. AI-assisted semantic review (catches duplicates/contradictions TF-IDF misses)
    if (
      !skipAIReview &&
      neuroClawConfig &&
      isAIProviderAvailable(neuroClawConfig) &&
      semanticStore.length >= 5
    ) {
      try {
        const factsForReview = semanticStore.length > 100 ? semanticStore.slice(-100) : semanticStore;
        const factsText = factsForReview
          .map((f) => `${f.id}: ${f.content} [${f.category}]`)
          .join("\n");

        const aiResponse = await callLLM(
          CONSOLIDATION_PROMPT,
          factsText,
          neuroClawConfig,
          logger,
          800,
        );

        if (aiResponse) {
          const aiResult = parseConsolidationResponse(aiResponse);
          const maxRemovals = Math.floor(semanticStore.length * 0.3);
          let removals = 0;
          const aiRemoveIds = new Set<string>();
          const storeIds = new Set(semanticStore.map((f) => f.id));

          // Process duplicates: merge into first, remove rest
          for (const group of aiResult.duplicates) {
            if (removals >= maxRemovals) break;
            const validIds = group.filter((id) => storeIds.has(id));
            if (validIds.length < 2) continue;
            const primary = semanticStore.find((f) => f.id === validIds[0]);
            if (!primary) continue;
            for (let i = 1; i < validIds.length; i++) {
              if (removals >= maxRemovals) break;
              const dup = semanticStore.find((f) => f.id === validIds[i]);
              if (dup) {
                primary.confidence = Math.max(primary.confidence, dup.confidence);
                primary.sourceEpisodeIds = [
                  ...new Set([...primary.sourceEpisodeIds, ...dup.sourceEpisodeIds]),
                ];
                aiRemoveIds.add(validIds[i]);
                removals++;
                merged++;
              }
            }
          }

          // Process obsolete facts
          for (const obsId of aiResult.obsolete) {
            if (removals >= maxRemovals) break;
            if (storeIds.has(obsId) && !aiRemoveIds.has(obsId)) {
              aiRemoveIds.add(obsId);
              removals++;
              pruned++;
            }
          }

          // Apply removals
          for (const id of aiRemoveIds) semanticIndex.remove(id);
          semanticStore = semanticStore.filter((f) => !aiRemoveIds.has(f.id));

          // Resolve contradictions via reconsolidation (not just log)
          contradictions = aiResult.contradictions.length;
          for (const c of aiResult.contradictions) {
            if (c.length >= 2) {
              const factA = semanticStore.find((f) => f.id === c[0]);
              const factB = semanticStore.find((f) => f.id === c[1]);
              if (factA && factB) {
                // Newer fact with decent confidence supersedes older
                const newer = factA.updatedAt >= factB.updatedAt ? factA : factB;
                const older = newer === factA ? factB : factA;
                if (newer.confidence >= 0.5) {
                  reviseFact(
                    older,
                    newer.content,
                    newer.confidence,
                    newer.sourceEpisodeIds,
                    `dream-mode resolution${c[2] ? `: ${c[2]}` : ""}`,
                  );
                  revised++;
                } else {
                  // Both weak — link them and log
                  older.relatedIds = [...new Set([...older.relatedIds, newer.id])];
                  newer.relatedIds = [...new Set([...newer.relatedIds, older.id])];
                  logger?.info(
                    `BrainAgent Consolidation: ambiguous contradiction — ${c[0]} vs ${c[1]}, linked`,
                  );
                }
              }
            }
          }

          // Process pending contradictions from Tier 2 (deferred from storeFact)
          const pending = getPendingContradictions();
          if (pending.length > 0) {
            for (const pc of pending) {
              const existingFact = semanticStore.find((f) => f.id === pc.existingFactId);
              const newFact = semanticStore.find((f) => f.id === pc.newFactId);
              if (existingFact && newFact && existingFact.id !== newFact.id) {
                // Link as related for now — AI review in next cycle can resolve
                existingFact.relatedIds = [...new Set([...existingFact.relatedIds, newFact.id])];
                newFact.relatedIds = [...new Set([...newFact.relatedIds, existingFact.id])];
              }
            }
            clearPendingContradictions();
          }
        }
      } catch (err) {
        logger?.info(`BrainAgent Consolidation: AI review error — ${String(err)}`);
      }
    }

    // Persist all changes
    persistEpisodic();
    persistSemantic();
    persistProcedural();

    return { merged, pruned, strengthened, contradictions, revised };
  }

  // ── Stats (for diagnostics) ─────────────────────────────────

  function getStats(): {
    episodic: number;
    semantic: number;
    procedural: number;
    vectorVocabulary: { episodic: number; semantic: number; procedural: number };
  } {
    return {
      episodic: episodicStore.length,
      semantic: semanticStore.length,
      procedural: proceduralStore.length,
      vectorVocabulary: {
        episodic: episodicIndex.vocabularySize,
        semantic: semanticIndex.vocabularySize,
        procedural: proceduralIndex.vocabularySize,
      },
    };
  }

  function dispose(): void {
    // Отложенные записи кэша эмбеддингов снимаются, чтобы инстанс
    // не писал на диск после остановки.
    for (const timer of pendingSaves.values()) clearTimeout(timer);
    pendingSaves.clear();
  }

  return {
    storeEpisode,
    recallEpisodes,
    storeFact,
    getPendingContradictions,
    clearPendingContradictions,
    detectContradiction,
    reviseFact,
    getRevisionHistory,
    recallFacts,
    getFactsByCategory,
    storeWorkflow,
    findMatchingWorkflow,
    recordWorkflowOutcome,
    pruneWeakWorkflows,
    mergeDuplicateWorkflows,
    recallAll,
    recallAllAsync,
    consolidate,
    getStats,
    getSemanticVersion: () => semanticVersion,
    initEmbeddings,
    updateEmbeddingsConfig,
    getEmbeddingsStatus,
    stop: dispose,
    dispose,
  };
}

// ── Active instance + legacy free-function API ──────────────────────

let active: HippocampusInstance | undefined;

/**
 * Ленивый detached-инстанс: модуль не подписывается на шину, поэтому
 * обращения до init ведут себя точно как до миграции (хранилища в памяти,
 * персистентность отключена, пока не задан workspaceDir).
 */
function current(): HippocampusInstance {
  if (!active) {
    active = createHippocampus("");
  }
  return active;
}

export function initMemoryStorage(workspaceDir: string): void {
  active?.dispose();
  active = createHippocampus(workspaceDir);
}

export function stopMemoryStorage(): void {
  active?.stop();
  active = undefined;
}

export function getSemanticVersion(): number {
  return current().getSemanticVersion();
}

/**
 * Initialize AI embeddings for enhanced semantic search.
 * Call after initMemoryStorage(). If no embedding provider is configured,
 * falls back to TF-IDF silently.
 */
export function initEmbeddings(
  config: NeuroClawConfig,
  logger?: { info: (msg: string) => void },
): void {
  current().initEmbeddings(config, logger);
}

/**
 * Update the cached embedding config so that subsequent embedding calls
 * use the latest provider/model from user's config.
 * Called on each message cycle with fresh api.config.
 */
export function updateEmbeddingsConfig(config: NeuroClawConfig): void {
  current().updateEmbeddingsConfig(config);
}

/**
 * Статус эмбеддингов для диагностики (/brainagent neuro, v0.2.0).
 */
export function getEmbeddingsStatus(): {
  available: boolean;
  provider: string;
  model: string;
  cached: { episodic: number; semantic: number; procedural: number };
} {
  return current().getEmbeddingsStatus();
}

export function storeEpisode(
  event: string,
  summary: string,
  emotionalContext: EpisodicMemory["emotionalContext"] = "neutral",
  entities: string[] = [],
  emotionIntensity = 0,
): EpisodicMemory {
  return current().storeEpisode(event, summary, emotionalContext, entities, emotionIntensity);
}

export function recallEpisodes(
  query: string,
  limit = 5,
  embeddingResults?: Array<{ id: string; score: number }>,
): EpisodicMemory[] {
  return current().recallEpisodes(query, limit, embeddingResults);
}

export function storeFact(
  content: string,
  category: string,
  sourceEpisodeIds: string[] = [],
  relatedIds: string[] = [],
): SemanticMemory {
  return current().storeFact(content, category, sourceEpisodeIds, relatedIds);
}

export function getPendingContradictions(): PendingContradiction[] {
  return current().getPendingContradictions();
}

export function clearPendingContradictions(): void {
  current().clearPendingContradictions();
}

export function detectContradiction(
  content: string,
  category: string,
): { contradicts: SemanticMemory; confidence: number } | null {
  return current().detectContradiction(content, category);
}

export function reviseFact(
  existing: SemanticMemory,
  newContent: string,
  newConfidence: number,
  sourceEpisodeIds: string[],
  reason: string,
): SemanticMemory {
  return current().reviseFact(existing, newContent, newConfidence, sourceEpisodeIds, reason);
}

export function getRevisionHistory(factId: string): Array<{
  previousContent: string;
  previousConfidence: number;
  revisedAt: number;
  reason: string;
}> {
  return current().getRevisionHistory(factId);
}

export function recallFacts(
  query: string,
  category?: string,
  limit = 10,
  embeddingResults?: Array<{ id: string; score: number }>,
): SemanticMemory[] {
  return current().recallFacts(query, category, limit, embeddingResults);
}

export function getFactsByCategory(category: string, limit = 10): SemanticMemory[] {
  return current().getFactsByCategory(category, limit);
}

export function storeWorkflow(
  description: string,
  triggerPattern: string,
  steps: string[],
): ProceduralMemory {
  return current().storeWorkflow(description, triggerPattern, steps);
}

export function findMatchingWorkflow(input: string): ProceduralMemory | undefined {
  return current().findMatchingWorkflow(input);
}

export function recordWorkflowOutcome(procId: string, success: boolean): void {
  current().recordWorkflowOutcome(procId, success);
}

export function pruneWeakWorkflows(minSteps = 2): number {
  return current().pruneWeakWorkflows(minSteps);
}

export function mergeDuplicateWorkflows(): number {
  return current().mergeDuplicateWorkflows();
}

export function recallAll(
  query: string,
  episodicLimit = 3,
  semanticLimit = 5,
): {
  episodic: EpisodicMemory[];
  semantic: SemanticMemory[];
  procedural: ProceduralMemory[];
} {
  return current().recallAll(query, episodicLimit, semanticLimit);
}

export async function recallAllAsync(
  query: string,
  episodicLimit = 3,
  semanticLimit = 5,
): Promise<{
  episodic: EpisodicMemory[];
  semantic: SemanticMemory[];
  procedural: ProceduralMemory[];
}> {
  return current().recallAllAsync(query, episodicLimit, semanticLimit);
}

export async function consolidate(
  config: BrainAgentConfig,
  neuroClawConfig?: NeuroClawConfig,
  logger?: { info: (msg: string) => void },
  intensity = 0.5,
  skipAIReview = false,
): Promise<{
  merged: number;
  pruned: number;
  strengthened: number;
  contradictions: number;
  revised: number;
}> {
  return current().consolidate(config, neuroClawConfig, logger, intensity, skipAIReview);
}

export function getStats(): {
  episodic: number;
  semantic: number;
  procedural: number;
  vectorVocabulary: { episodic: number; semantic: number; procedural: number };
} {
  return current().getStats();
}
