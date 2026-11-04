/**
 * AI Embeddings — Multi-provider text embedding for semantic search.
 *
 * Converts text into dense vectors that capture meaning, not just words.
 * "тачка" and "машина" will have similar vectors even though they're
 * different words — because they mean the same thing.
 *
 * Supports: OpenAI, Google, Ollama, OpenRouter (providers with an embeddings API).
 * Falls back gracefully if no provider is available.
 *
 * v0.9.31: lexical (TF-IDF) is the default. Embeddings are opt-in — they
 * activate only for an explicitly selected provider that supports them;
 * the implicit Ollama fallback is gone.
 *
 * v0.7.0: фабрика createAIEmbeddings() — флаг недостижимости Ollama
 * в замыкании инстанса; свободные функции — обёртки над общим ленивым
 * инстансом. Чистые функции (resolveEmbeddingProvider,
 * embeddingCosineSimilarity) остаются на уровне модуля.
 */

import type { HostConfig as NeuroClawConfig } from "./host-config.ts";
import { parseUserModelSelection } from "./llm-client.ts";

type EmbeddingProviderConfig = {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  headers: Record<string, string>;
  format: "openai" | "google";
};

/** Embedding model per provider (only providers that support embeddings). */
const EMBEDDING_MODELS: Record<string, { model: string; format: "openai" | "google" }> = {
  openai: { model: "text-embedding-3-small", format: "openai" },
  google: { model: "text-embedding-004", format: "google" },
  ollama: { model: "nomic-embed-text", format: "openai" },
  openrouter: { model: "openai/text-embedding-3-small", format: "openai" },
};

/** Default base URLs per provider. */
const EMBEDDING_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  openrouter: "https://openrouter.ai/api/v1",
};

/** Display names per provider key. */
const EMBEDDING_PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  google: "Google",
  ollama: "Ollama",
  openrouter: "OpenRouter",
};

/** Локальная Ollama по умолчанию: бесплатные эмбеддинги без ключей (v0.2.0). */
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

/**
 * Build an EmbeddingProviderConfig for a given provider key.
 */
function buildEmbeddingConfig(
  providerKey: string,
  entry: { apiKey?: string; baseUrl?: string },
): EmbeddingProviderConfig | null {
  const spec = EMBEDDING_MODELS[providerKey];
  if (!spec) return null; // provider doesn't support embeddings

  const apiKey = entry.apiKey ?? "";
  const name = EMBEDDING_PROVIDER_NAMES[providerKey] ?? providerKey;

  if (providerKey === "ollama") {
    // Локальная Ollama работает без ключа; по умолчанию localhost
    return {
      name: "Ollama",
      apiKey: "",
      baseUrl: entry.baseUrl ?? DEFAULT_OLLAMA_BASE_URL,
      model: spec.model,
      headers: { "Content-Type": "application/json" },
      format: spec.format,
    };
  }

  if (providerKey === "google") {
    if (!apiKey) return null;
    return {
      name: "Google",
      apiKey,
      baseUrl: EMBEDDING_BASE_URLS.google!,
      model: spec.model,
      headers: { "Content-Type": "application/json" },
      format: spec.format,
    };
  }

  // OpenAI-compatible (openai, openrouter)
  if (!apiKey) return null;
  return {
    name,
    apiKey,
    baseUrl: entry.baseUrl ?? EMBEDDING_BASE_URLS[providerKey] ?? "https://api.openai.com/v1",
    model: spec.model,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    format: spec.format,
  };
}

/**
 * Resolve which provider to use for embeddings.
 *
 * v0.9.31: lexical (TF-IDF) is the default search backend. Embeddings are
 * used only for the model the user explicitly selected, and only when that
 * provider exposes an embeddings API. The old hardcoded
 * OpenAI → Google → Ollama → OpenRouter fallback switched local Ollama on
 * for every install and left an empty vector cache behind whenever it was
 * not running (the status line still claimed "AI embeddings").
 */
export function resolveEmbeddingProvider(config: NeuroClawConfig): EmbeddingProviderConfig | null {
  const providers = config.models?.providers;
  if (!providers) return null;

  const userSelection = parseUserModelSelection(config);
  if (!userSelection) return null;

  const entry = (providers as Record<string, { apiKey?: string; baseUrl?: string }>)[
    userSelection.provider
  ];
  if (!entry) return null;

  // Providers without an embeddings API (DeepSeek, Anthropic, …) resolve to
  // null here — the caller then stays on TF-IDF.
  return buildEmbeddingConfig(userSelection.provider, entry);
}

// ── Fetch helpers (stateless) ───────────────────────────────────────

/**
 * OpenAI-compatible embeddings API (OpenAI, Ollama, OpenRouter).
 */
async function fetchOpenAIEmbeddings(
  texts: string[],
  provider: EmbeddingProviderConfig,
  logger?: { info: (msg: string) => void },
): Promise<number[][] | null> {
  const response = await fetch(`${provider.baseUrl}/embeddings`, {
    method: "POST",
    headers: provider.headers,
    body: JSON.stringify({
      model: provider.model,
      input: texts,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger?.info(
      `BrainAgent Embeddings: ${provider.name} API error ${response.status}: ${errorText}`,
    );
    return null;
  }

  const data = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };

  if (!data.data || data.data.length === 0) return null;

  const embeddings = data.data
    .map((d) => d.embedding)
    .filter((e): e is number[] => Array.isArray(e));

  if (embeddings.length !== texts.length) return null;

  return embeddings;
}

/**
 * Google Gemini embeddings API.
 */
async function fetchGoogleEmbeddings(
  texts: string[],
  provider: EmbeddingProviderConfig,
  logger?: { info: (msg: string) => void },
): Promise<number[][] | null> {
  const url = `${provider.baseUrl}/models/${provider.model}:batchEmbedContents?key=${provider.apiKey}`;

  const requests = texts.map((text) => ({
    model: `models/${provider.model}`,
    content: { parts: [{ text }] },
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: provider.headers,
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger?.info(`BrainAgent Embeddings: Google API error ${response.status}: ${errorText}`);
    return null;
  }

  const data = (await response.json()) as {
    embeddings?: Array<{ values?: number[] }>;
  };

  if (!data.embeddings) return null;

  const embeddings = data.embeddings
    .map((e) => e.values)
    .filter((v): v is number[] => Array.isArray(v));

  if (embeddings.length !== texts.length) return null;

  return embeddings;
}

// ── Instance type ───────────────────────────────────────────────────

export type AIEmbeddingsInstance = {
  getEmbedding(
    text: string,
    config: NeuroClawConfig,
    logger?: { info: (msg: string) => void },
  ): Promise<number[] | null>;
  getEmbeddings(
    texts: string[],
    config: NeuroClawConfig,
    logger?: { info: (msg: string) => void },
  ): Promise<number[][] | null>;
  /** True when the provider has been failing — callers fall back to TF-IDF. */
  isProviderDown(): boolean;
};

// ── Factory ─────────────────────────────────────────────────────────

/** Create an embeddings client with an isolated Ollama-unreachable flag. */
export function createAIEmbeddings(): AIEmbeddingsInstance {
  // ── State (closure) ───────────────────────────────────────────────
  /** Ollama один раз не ответила — больше не дёргаем до перезапуска. */
  let ollamaUnreachable = false;
  /** Remote-провайдеры получают три страйка на транзиентные ошибки. */
  let consecutiveFailures = 0;

  function isProviderDown(): boolean {
    return ollamaUnreachable || consecutiveFailures >= 3;
  }

  async function getEmbeddings(
    texts: string[],
    config: NeuroClawConfig,
    logger?: { info: (msg: string) => void },
  ): Promise<number[][] | null> {
    const provider = resolveEmbeddingProvider(config);
    if (!provider) {
      return null;
    }

    // Локальная Ollama уже не ответила — не дёргаем её до перезапуска (v0.2.0)
    if (provider.name === "Ollama" && ollamaUnreachable) {
      return null;
    }

    if (texts.length === 0) return [];

    try {
      const result =
        provider.format === "google"
          ? await fetchGoogleEmbeddings(texts, provider, logger)
          : await fetchOpenAIEmbeddings(texts, provider, logger);
      if (result === null) {
        consecutiveFailures++;
        if (provider.name === "Ollama") {
          ollamaUnreachable = true; // нет модели/сервиса — переключаемся на TF-IDF
        }
      } else {
        consecutiveFailures = 0;
      }
      return result;
    } catch (error) {
      logger?.info(`BrainAgent Embeddings: ${provider.name} error — ${String(error)}`);
      consecutiveFailures++;
      if (provider.name === "Ollama") ollamaUnreachable = true;
      return null;
    }
  }

  async function getEmbedding(
    text: string,
    config: NeuroClawConfig,
    logger?: { info: (msg: string) => void },
  ): Promise<number[] | null> {
    const result = await getEmbeddings([text], config, logger);
    return result?.[0] ?? null;
  }

  return { getEmbedding, getEmbeddings, isProviderDown };
}

// ── Active-instance wrappers (backward-compatible API) ──────────────

let active: AIEmbeddingsInstance | null = null;

function current(): AIEmbeddingsInstance {
  if (!active) active = createAIEmbeddings();
  return active;
}

/**
 * Get embedding vector for a single text.
 * Returns null if the provider is unavailable or the request fails.
 */
export async function getEmbedding(
  text: string,
  config: NeuroClawConfig,
  logger?: { info: (msg: string) => void },
): Promise<number[] | null> {
  return current().getEmbedding(text, config, logger);
}

/**
 * Get embedding vectors for multiple texts in a single batch.
 * Returns null if the provider is unavailable or the request fails.
 */
export async function getEmbeddings(
  texts: string[],
  config: NeuroClawConfig,
  logger?: { info: (msg: string) => void },
): Promise<number[][] | null> {
  return current().getEmbeddings(texts, config, logger);
}

/**
 * True when the active embeddings client has been failing; hippocampus then
 * reports the honest backend (TF-IDF) instead of the configured provider.
 */
export function isEmbeddingsProviderDown(): boolean {
  return active?.isProviderDown() ?? false;
}

/**
 * Cosine similarity between two dense embedding vectors.
 */
export function embeddingCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
