/**
 * Host Config Shim — structural replacement for `NeuroClawConfig`.
 *
 * BrainAgent modules were written against the NeuroClaw gateway config.
 * On DeepSeek Harness we synthesize the same shape from environment
 * variables and plugin configuration, so the modules stay untouched.
 *
 * Only the two surfaces BrainAgent actually reads are modeled:
 * - `models.providers` — API keys/base URLs for LLM & embedding calls
 * - `agents.defaults.model` — the user-selected model ("provider/model")
 */

export type HostConfig = {
  models?: {
    providers?: Record<string, { apiKey?: string; baseUrl?: string }>;
  };
  agents?: {
    defaults?: { model?: string | { primary?: string } };
  };
};

/** Environment variable names recognized by the builder. */
const ENV_PROVIDERS: Array<{
  key: string;
  apiKeyVar: string;
  baseUrlVar?: string;
}> = [
  { key: "deepseek", apiKeyVar: "DEEPSEEK_API_KEY", baseUrlVar: "DEEPSEEK_BASE_URL" },
  { key: "openai", apiKeyVar: "OPENAI_API_KEY", baseUrlVar: "OPENAI_BASE_URL" },
  { key: "anthropic", apiKeyVar: "ANTHROPIC_API_KEY", baseUrlVar: "ANTHROPIC_BASE_URL" },
  { key: "google", apiKeyVar: "GOOGLE_API_KEY", baseUrlVar: "GOOGLE_BASE_URL" },
  { key: "openrouter", apiKeyVar: "OPENROUTER_API_KEY", baseUrlVar: "OPENROUTER_BASE_URL" },
  { key: "groq", apiKeyVar: "GROQ_API_KEY", baseUrlVar: "GROQ_BASE_URL" },
  { key: "ollama", apiKeyVar: "OLLAMA_API_KEY", baseUrlVar: "OLLAMA_BASE_URL" },
];

export type HostConfigOptions = {
  /** Explicit provider entries from plugin configuration (win over env). */
  providers?: Record<string, { apiKey?: string; baseUrl?: string }>;
  /** Model selection in "provider/model" form (e.g. "deepseek/deepseek-chat"). */
  model?: string;
};

/**
 * Build a NeuroClaw-shaped config object from env vars + plugin options.
 * Reads `process.env` lazily so tests can override environment per case.
 */
export function buildHostConfig(options: HostConfigOptions = {}): HostConfig {
  const env = process.env as Record<string, string | undefined>;
  const providers: Record<string, { apiKey?: string; baseUrl?: string }> = {};

  for (const spec of ENV_PROVIDERS) {
    const apiKey = env[spec.apiKeyVar];
    const baseUrl = spec.baseUrlVar ? env[spec.baseUrlVar] : undefined;
    if (apiKey || baseUrl) {
      providers[spec.key] = { apiKey, baseUrl };
    }
  }

  // Plugin-configured providers override env-derived ones.
  for (const [key, entry] of Object.entries(options.providers ?? {})) {
    providers[key] = { ...providers[key], ...entry };
  }

  const config: HostConfig = { models: { providers } };
  if (options.model) {
    config.agents = { defaults: { model: options.model } };
  }
  return config;
}
