/**
 * LLM Client — Shared LLM call infrastructure for all BrainAgent modules.
 *
 * Handles provider auto-detection, API calls to multiple providers
 * (OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Groq, Ollama),
 * and response content extraction.
 *
 * Each module provides its own system prompt and response parser;
 * this module handles the transport plumbing.
 *
 * v0.7.0: фабрика createLLMClient() — dsh-seam слоты (callBackend,
 * availabilityHook) в замыкании инстанса; свободные функции — обёртки над
 * общим ленивым инстансом. Чистые функции (resolveProvider,
 * parseUserModelSelection) остаются на уровне модуля.
 */

import type { HostConfig as NeuroClawConfig } from "./host-config.ts";

type ProviderConfig = {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  headers: Record<string, string>;
  bodyFormat: "openai" | "anthropic";
};

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  // Anthropic format
  content?: Array<{
    text?: string;
  }>;
};

/** Abort in-flight enrichment calls so a hung provider can't block the cycle. */
const LLM_REQUEST_TIMEOUT_MS = 60_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse the user's selected model from config (agents.defaults.model).
 * Returns { provider, model } or null if not configured.
 * Format: "provider/model" (e.g., "openrouter/qwen/qwen-2.5-72b").
 */
export function parseUserModelSelection(
  config: NeuroClawConfig,
): { provider: string; model: string } | null {
  const agents = (config as Record<string, unknown>).agents as
    | { defaults?: { model?: string | { primary?: string } } }
    | undefined;
  const modelCfg = agents?.defaults?.model;
  const primary = typeof modelCfg === "string" ? modelCfg : modelCfg?.primary;
  if (!primary || typeof primary !== "string") return null;

  const trimmed = primary.trim();
  const slashIdx = trimmed.indexOf("/");
  if (slashIdx <= 0) return null;

  return {
    provider: trimmed.slice(0, slashIdx).toLowerCase(),
    model: trimmed.slice(slashIdx + 1),
  };
}

/** Default base URLs per provider. */
const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  deepseek: "https://api.deepseek.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
};

/** Display names per provider key. */
const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  deepseek: "DeepSeek",
  openrouter: "OpenRouter",
  groq: "Groq",
  ollama: "Ollama",
};

/**
 * Build a ProviderConfig from a known provider key, its config entry, and a model name.
 */
function buildProviderConfig(
  providerKey: string,
  entry: { apiKey?: string; baseUrl?: string },
  model: string,
): ProviderConfig | null {
  const apiKey = entry.apiKey ?? "";
  const name = PROVIDER_NAMES[providerKey] ?? providerKey;

  if (providerKey === "anthropic") {
    if (!apiKey) return null;
    return {
      name,
      apiKey,
      baseUrl: entry.baseUrl ?? DEFAULT_BASE_URLS.anthropic!,
      model,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      bodyFormat: "anthropic",
    };
  }

  if (providerKey === "google") {
    if (!apiKey) return null;
    return {
      name,
      apiKey,
      baseUrl: DEFAULT_BASE_URLS.google!,
      model,
      headers: { "Content-Type": "application/json" },
      bodyFormat: "openai",
    };
  }

  if (providerKey === "ollama") {
    if (!entry.baseUrl) return null;
    return {
      name,
      apiKey: "",
      baseUrl: entry.baseUrl,
      model,
      headers: { "Content-Type": "application/json" },
      bodyFormat: "openai",
    };
  }

  // OpenAI-compatible providers: openai, deepseek, openrouter, groq, etc.
  if (!apiKey) return null;
  return {
    name,
    apiKey,
    baseUrl: entry.baseUrl ?? DEFAULT_BASE_URLS[providerKey] ?? "https://api.openai.com/v1",
    model,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    bodyFormat: "openai",
  };
}

/** Hardcoded fallback model per provider (used only when user has no model selected). */
const FALLBACK_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-haiku-20240307",
  google: "gemini-1.5-flash",
  deepseek: "deepseek-chat",
  openrouter: "anthropic/claude-3-haiku",
  groq: "llama-3.1-8b-instant",
  ollama: "llama3.2",
};

/**
 * Resolve which AI provider to use based on configuration.
 *
 * Priority:
 * 1. User's selected model from agents.defaults.model (respects user's cost control)
 * 2. Hardcoded fallback chain: OpenAI > Anthropic > Google > DeepSeek > OpenRouter > Groq > Ollama
 */
export function resolveProvider(config: NeuroClawConfig): ProviderConfig | null {
  const providers = config.models?.providers;
  if (!providers) return null;

  // ── Priority 1: respect user's selected model ────────────────────
  const userSelection = parseUserModelSelection(config);
  if (userSelection) {
    const entry = (providers as Record<string, { apiKey?: string; baseUrl?: string }>)[
      userSelection.provider
    ];
    if (entry) {
      const result = buildProviderConfig(userSelection.provider, entry, userSelection.model);
      if (result) return result;
    }
  }

  // ── Priority 2: hardcoded fallback chain (no user model configured) ──
  const fallbackOrder = [
    "openai",
    "anthropic",
    "google",
    "deepseek",
    "openrouter",
    "groq",
    "ollama",
  ];
  for (const key of fallbackOrder) {
    const entry = (providers as Record<string, { apiKey?: string; baseUrl?: string }>)[key];
    if (!entry) continue;
    const model = FALLBACK_MODELS[key];
    if (!model) continue;
    const result = buildProviderConfig(key, entry, model);
    if (result) return result;
  }

  return null;
}

// ── dsh seam types ───────────────────────────────────────────────────
// The harness plugin registers a backend that routes enrichment calls
// through ctx.llm (registered provider adapters). Returning `undefined`
// from the backend means "decline" — the env-var transport below is
// used as a fallback, keeping the plugin functional without dsh LLM.

export type CallLLMBackend = (
  systemPrompt: string,
  userText: string,
  config: NeuroClawConfig,
  logger?: { info: (msg: string) => void },
  maxTokens?: number,
) => Promise<string | null | undefined>;

// ── Instance type ───────────────────────────────────────────────────

export type LLMClientInstance = {
  setCallLLMBackend(fn: CallLLMBackend | undefined): void;
  setAIAvailabilityHook(fn: (() => boolean) | undefined): void;
  isAIProviderAvailable(config: NeuroClawConfig): boolean;
  callLLM(
    systemPrompt: string,
    userText: string,
    config: NeuroClawConfig,
    logger?: { info: (msg: string) => void },
    maxTokens?: number,
  ): Promise<string | null>;
};

// ── Factory ─────────────────────────────────────────────────────────

/** Create an LLM client with isolated dsh-seam slots. */
export function createLLMClient(): LLMClientInstance {
  // ── State (closure) ───────────────────────────────────────────────
  let callBackend: CallLLMBackend | undefined;
  let availabilityHook: (() => boolean) | undefined;

  function setCallLLMBackend(fn: CallLLMBackend | undefined): void {
    callBackend = fn;
  }

  function setAIAvailabilityHook(fn: (() => boolean) | undefined): void {
    availabilityHook = fn;
  }

  function isAIProviderAvailable(config: NeuroClawConfig): boolean {
    return (availabilityHook?.() ?? false) || resolveProvider(config) !== null;
  }

  async function callLLM(
    systemPrompt: string,
    userText: string,
    config: NeuroClawConfig,
    logger?: { info: (msg: string) => void },
    maxTokens: number = 500,
  ): Promise<string | null> {
    // dsh seam: prefer the harness transport when registered.
    if (callBackend) {
      try {
        const bridged = await callBackend(systemPrompt, userText, config, logger, maxTokens);
        if (bridged !== undefined) return bridged;
      } catch (error) {
        logger?.info(`BrainAgent LLM: bridge failed, falling back — ${String(error)}`);
      }
    }

    const provider = resolveProvider(config);
    if (!provider) {
      logger?.info("BrainAgent LLM: no AI provider configured, skipping");
      return null;
    }

    const userSelection = parseUserModelSelection(config);
    if (userSelection) {
      logger?.info(`BrainAgent LLM: calling ${provider.name} (${provider.model}) [user-selected]`);
    } else {
      logger?.info(
        `BrainAgent LLM: calling ${provider.name} (${provider.model}) [auto-detected]`,
      );
    }

    try {
      let response: Response;

      if (provider.bodyFormat === "anthropic") {
        response = await fetchWithTimeout(`${provider.baseUrl}/messages`, {
          method: "POST",
          headers: provider.headers,
          body: JSON.stringify({
            model: provider.model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: "user", content: userText }],
          }),
        });
      } else if (provider.name === "Google") {
        const url = `${provider.baseUrl}/models/${provider.model}:generateContent?key=${provider.apiKey}`;
        response = await fetchWithTimeout(url, {
          method: "POST",
          headers: provider.headers,
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userText}` }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: maxTokens,
            },
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
        }
        const errorText = await response.text();
        logger?.info(`BrainAgent LLM: Google error ${response.status}: ${errorText}`);
        return null;
      } else {
        response = await fetchWithTimeout(`${provider.baseUrl}/chat/completions`, {
          method: "POST",
          headers: provider.headers,
          body: JSON.stringify({
            model: provider.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userText },
            ],
            temperature: 0.1,
            max_tokens: maxTokens,
          }),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger?.info(`BrainAgent LLM: ${provider.name} error ${response.status}: ${errorText}`);
        return null;
      }

      const data = (await response.json()) as ChatResponse;

      if (provider.bodyFormat === "anthropic") {
        return data.content?.[0]?.text ?? null;
      }
      return data.choices?.[0]?.message?.content ?? null;
    } catch (error) {
      logger?.info(`BrainAgent LLM: error — ${String(error)}`);
      return null;
    }
  }

  return { setCallLLMBackend, setAIAvailabilityHook, isAIProviderAvailable, callLLM };
}

// ── Active-instance wrappers (backward-compatible API) ──────────────

let active: LLMClientInstance | null = null;

function current(): LLMClientInstance {
  if (!active) active = createLLMClient();
  return active;
}

/** Register (or clear) the dsh ctx.llm transport backend. */
export function setCallLLMBackend(fn: CallLLMBackend | undefined): void {
  current().setCallLLMBackend(fn);
}

/** Register (or clear) an extra availability signal (e.g. ctx.llm routes). */
export function setAIAvailabilityHook(fn: (() => boolean) | undefined): void {
  current().setAIAvailabilityHook(fn);
}

/** Check if an AI provider is available. */
export function isAIProviderAvailable(config: NeuroClawConfig): boolean {
  return current().isAIProviderAvailable(config);
}

/**
 * Call an LLM with the given system prompt and user text.
 * Returns the raw text content of the model's response, or null on any failure.
 * All errors are caught and logged — callers never need try/catch.
 */
export async function callLLM(
  systemPrompt: string,
  userText: string,
  config: NeuroClawConfig,
  logger?: { info: (msg: string) => void },
  maxTokens: number = 500,
): Promise<string | null> {
  return current().callLLM(systemPrompt, userText, config, logger, maxTokens);
}
