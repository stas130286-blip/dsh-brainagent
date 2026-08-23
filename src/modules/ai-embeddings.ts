/**
 * AI Embeddings — Multi-provider text embedding for semantic search.
 *
 * Converts text into dense vectors that capture meaning, not just words.
 * "тачка" and "машина" will have similar vectors even though they're
 * different words — because they mean the same thing.
 *
 * Supports: OpenAI, Google, Ollama, OpenRouter (providers with an embeddings API).
 * Falls back gracefully if no provider is available.
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
    if (!entry.baseUrl) return null;
    return {
      name: "Ollama",
      apiKey: "",
      baseUrl: entry.baseUrl,
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
 * Priority:
 * 1. User's selected provider (if it supports embeddings)
 * 2. Hardcoded fallback: OpenAI > Google > Ollama > OpenRouter
 */
export function resolveEmbeddingProvider(config: NeuroClawConfig): EmbeddingProviderConfig | null {
  const providers = config.models?.providers;
  if (!providers) return null;

  // ── Priority 1: respect user's selected provider ──────────────────
  const userSelection = parseUserModelSelection(config);
  if (userSelection) {
    const entry = (providers as Record<string, { apiKey?: string; baseUrl?: string }>)[
      userSelection.provider
    ];
    if (entry) {
      const result = buildEmbeddingConfig(userSelection.provider, entry);
      if (result) return result;
      // User's provider doesn't support embeddings — fall through to auto-detect
    }
  }

  // ── Priority 2: hardcoded fallback (no user model or provider lacks embeddings) ──
  const fallbackOrder = ["openai", "google", "ollama", "openrouter"];
  for (const key of fallbackOrder) {
    const entry = (providers as Record<string, { apiKey?: string; baseUrl?: string }>)[key];
    if (!entry) continue;
    const result = buildEmbeddingConfig(key, entry);
    if (result) return result;
  }

  return null;
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
  const result = await getEmbeddings([text], config, logger);
  return result?.[0] ?? null;
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
  const provider = resolveEmbeddingProvider(config);
  if (!provider) {
    return null;
  }

  if (texts.length === 0) return [];

  try {
    if (provider.format === "google") {
      return await fetchGoogleEmbeddings(texts, provider, logger);
    }
    return await fetchOpenAIEmbeddings(texts, provider, logger);
  } catch (error) {
    logger?.info(`BrainAgent Embeddings: ${provider.name} error — ${String(error)}`);
    return null;
  }
}

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
