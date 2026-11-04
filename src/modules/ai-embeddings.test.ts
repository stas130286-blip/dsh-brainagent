import { describe, it, expect } from "vitest";
import { resolveEmbeddingProvider } from "./ai-embeddings.ts";
import type { HostConfig } from "./host-config.ts";

describe("resolveEmbeddingProvider — lexical by default", () => {
  it("returns null when the selected model has no embeddings API", () => {
    const config = {
      agents: { defaults: { model: "deepseek/deepseek-chat" } },
      models: { providers: { deepseek: { apiKey: "sk-ds" }, openai: { apiKey: "sk-oa" } } },
    } as unknown as HostConfig;

    expect(resolveEmbeddingProvider(config)).toBeNull();
  });

  it("does not silently enable Ollama", () => {
    const config = { models: { providers: {} } } as unknown as HostConfig;

    expect(resolveEmbeddingProvider(config)).toBeNull();
  });

  it("uses Ollama when the user selects it", () => {
    const config = {
      agents: { defaults: { model: "ollama/nomic-embed-text" } },
      models: { providers: { ollama: { baseUrl: "http://localhost:11434" } } },
    } as unknown as HostConfig;

    const provider = resolveEmbeddingProvider(config);
    expect(provider?.name).toBe("Ollama");
    expect(provider?.model).toBe("nomic-embed-text");
  });

  it("uses OpenAI when the user selects an OpenAI model", () => {
    const config = {
      agents: { defaults: { model: "openai/gpt-4o" } },
      models: { providers: { openai: { apiKey: "sk-oa" } } },
    } as unknown as HostConfig;

    const provider = resolveEmbeddingProvider(config);
    expect(provider?.name).toBe("OpenAI");
    expect(provider?.model).toBe("text-embedding-3-small");
  });
});
