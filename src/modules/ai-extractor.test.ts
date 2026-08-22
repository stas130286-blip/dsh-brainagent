import type { HostConfig as NeuroClawConfig } from "./host-config.ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractFactsWithAI, isAIProviderAvailable } from "./ai-extractor.ts";
import { resolveProvider, parseUserModelSelection } from "./llm-client.ts";

describe("ai-extractor", () => {
  // ═══════════════════════════════════════════════════════════════
  // parseUserModelSelection — config parsing
  // ═══════════════════════════════════════════════════════════════
  describe("parseUserModelSelection", () => {
    it("parses object format agents.defaults.model.primary", () => {
      const config = {
        agents: { defaults: { model: { primary: "openrouter/qwen/qwen-2.5-72b" } } },
        models: { providers: {} },
      } as unknown as NeuroClawConfig;
      const result = parseUserModelSelection(config);
      expect(result).toEqual({ provider: "openrouter", model: "qwen/qwen-2.5-72b" });
    });

    it("parses string format agents.defaults.model", () => {
      const config = {
        agents: { defaults: { model: "deepseek/deepseek-chat" } },
        models: { providers: {} },
      } as unknown as NeuroClawConfig;
      const result = parseUserModelSelection(config);
      expect(result).toEqual({ provider: "deepseek", model: "deepseek-chat" });
    });

    it("returns null when no agents config", () => {
      const config = { models: { providers: {} } } as unknown as NeuroClawConfig;
      expect(parseUserModelSelection(config)).toBeNull();
    });

    it("returns null when no model configured", () => {
      const config = {
        agents: { defaults: {} },
        models: { providers: {} },
      } as unknown as NeuroClawConfig;
      expect(parseUserModelSelection(config)).toBeNull();
    });

    it("returns null for model string without slash", () => {
      const config = {
        agents: { defaults: { model: "gpt-4o" } },
        models: { providers: {} },
      } as unknown as NeuroClawConfig;
      expect(parseUserModelSelection(config)).toBeNull();
    });

    it("lowercases provider name", () => {
      const config = {
        agents: { defaults: { model: "OpenAI/gpt-4o" } },
        models: { providers: {} },
      } as unknown as NeuroClawConfig;
      const result = parseUserModelSelection(config);
      expect(result).toEqual({ provider: "openai", model: "gpt-4o" });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // resolveProvider — user model preference
  // ═══════════════════════════════════════════════════════════════
  describe("resolveProvider with user model selection", () => {
    it("uses user-selected model when configured", () => {
      const config = {
        agents: { defaults: { model: { primary: "openrouter/qwen/qwen-2.5-72b" } } },
        models: {
          providers: {
            openai: { apiKey: "sk-openai" },
            openrouter: { apiKey: "sk-or" },
          },
        },
      } as unknown as NeuroClawConfig;
      const provider = resolveProvider(config);
      expect(provider).not.toBeNull();
      expect(provider!.name).toBe("OpenRouter");
      expect(provider!.model).toBe("qwen/qwen-2.5-72b");
    });

    it("falls back to auto-detect when user provider has no credentials", () => {
      const config = {
        agents: { defaults: { model: { primary: "groq/llama-3.3-70b" } } },
        models: {
          providers: {
            openai: { apiKey: "sk-openai" },
            // groq has no apiKey
          },
        },
      } as unknown as NeuroClawConfig;
      const provider = resolveProvider(config);
      expect(provider).not.toBeNull();
      expect(provider!.name).toBe("OpenAI");
      expect(provider!.model).toBe("gpt-4o-mini");
    });

    it("falls back to auto-detect when no user model configured", () => {
      const config = {
        models: {
          providers: {
            deepseek: { apiKey: "sk-ds" },
          },
        },
      } as unknown as NeuroClawConfig;
      const provider = resolveProvider(config);
      expect(provider).not.toBeNull();
      expect(provider!.name).toBe("DeepSeek");
      expect(provider!.model).toBe("deepseek-chat");
    });

    it("uses Anthropic bodyFormat for anthropic provider", () => {
      const config = {
        agents: { defaults: { model: "anthropic/claude-3.5-sonnet" } },
        models: {
          providers: {
            anthropic: { apiKey: "sk-ant" },
          },
        },
      } as unknown as NeuroClawConfig;
      const provider = resolveProvider(config);
      expect(provider!.bodyFormat).toBe("anthropic");
      expect(provider!.model).toBe("claude-3.5-sonnet");
    });

    it("uses Ollama without apiKey when user selects it", () => {
      const config = {
        agents: { defaults: { model: "ollama/llama3.3" } },
        models: {
          providers: {
            ollama: { baseUrl: "http://localhost:11434" },
          },
        },
      } as unknown as NeuroClawConfig;
      const provider = resolveProvider(config);
      expect(provider!.name).toBe("Ollama");
      expect(provider!.model).toBe("llama3.3");
      expect(provider!.apiKey).toBe("");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // isAIProviderAvailable — provider detection
  // ═══════════════════════════════════════════════════════════════
  describe("isAIProviderAvailable", () => {
    it("returns true when DeepSeek API key is configured", () => {
      const config = {
        models: { providers: { deepseek: { apiKey: "sk-test" } } },
      } as unknown as NeuroClawConfig;
      expect(isAIProviderAvailable(config)).toBe(true);
    });

    it("returns true when OpenAI API key is configured", () => {
      const config = {
        models: { providers: { openai: { apiKey: "sk-test" } } },
      } as unknown as NeuroClawConfig;
      expect(isAIProviderAvailable(config)).toBe(true);
    });

    it("returns true when Anthropic API key is configured", () => {
      const config = {
        models: { providers: { anthropic: { apiKey: "sk-test" } } },
      } as unknown as NeuroClawConfig;
      expect(isAIProviderAvailable(config)).toBe(true);
    });

    it("returns true when Ollama baseUrl is configured (no key needed)", () => {
      const config = {
        models: { providers: { ollama: { baseUrl: "http://localhost:11434" } } },
      } as unknown as NeuroClawConfig;
      expect(isAIProviderAvailable(config)).toBe(true);
    });

    it("returns false when models.providers is absent", () => {
      const config = { models: {} } as unknown as NeuroClawConfig;
      expect(isAIProviderAvailable(config)).toBe(false);
    });

    it("returns false when models is absent", () => {
      const config = {} as unknown as NeuroClawConfig;
      expect(isAIProviderAvailable(config)).toBe(false);
    });

    it("returns false when provider has no API key", () => {
      const config = {
        models: { providers: { deepseek: { baseUrl: "https://api.deepseek.com/v1" } } },
      } as unknown as NeuroClawConfig;
      expect(isAIProviderAvailable(config)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // extractFactsWithAI — API interaction
  // ═══════════════════════════════════════════════════════════════
  describe("extractFactsWithAI", () => {
    const mockFetch = vi.fn();
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = mockFetch;
      mockFetch.mockReset();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("returns empty array when DeepSeek is not configured", async () => {
      const config = { models: {} } as unknown as NeuroClawConfig;
      const result = await extractFactsWithAI("Some text about user", config);
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns empty array when API key is missing", async () => {
      const config = {
        models: { providers: { deepseek: { baseUrl: "https://api.deepseek.com/v1" } } },
      } as unknown as NeuroClawConfig;
      const result = await extractFactsWithAI("Some text about user", config);
      expect(result).toEqual([]);
    });

    it("extracts facts from valid API response", async () => {
      const config = {
        models: { providers: { deepseek: { apiKey: "test-key" } } },
      } as unknown as NeuroClawConfig;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    content: "Пользователя зовут Станислав",
                    category: "user_info",
                    confidence: 0.95,
                  },
                  {
                    content: "Пользователь живёт в Калининграде",
                    category: "user_info",
                    confidence: 0.9,
                  },
                ]),
              },
            },
          ],
        }),
      });

      const result = await extractFactsWithAI(
        "Меня зовут Станислав и я живу в Калининграде",
        config,
      );

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe("Пользователя зовут Станислав");
      expect(result[0].category).toBe("user_info");
      expect(result[0].confidence).toBe(0.95);
      expect(result[1].content).toBe("Пользователь живёт в Калининграде");
    });

    it("handles API error gracefully", async () => {
      const config = {
        models: { providers: { deepseek: { apiKey: "test-key" } } },
      } as unknown as NeuroClawConfig;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const result = await extractFactsWithAI("Тестовый текст", config);
      expect(result).toEqual([]);
    });

    it("handles network error gracefully", async () => {
      const config = {
        models: { providers: { deepseek: { apiKey: "test-key" } } },
      } as unknown as NeuroClawConfig;

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await extractFactsWithAI("Тестовый текст", config);
      expect(result).toEqual([]);
    });

    it("handles malformed JSON response", async () => {
      const config = {
        models: { providers: { deepseek: { apiKey: "test-key" } } },
      } as unknown as NeuroClawConfig;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "This is not valid JSON" } }],
        }),
      });

      const result = await extractFactsWithAI("Тестовый текст", config);
      expect(result).toEqual([]);
    });

    it("filters out facts with invalid categories", async () => {
      const config = {
        models: { providers: { deepseek: { apiKey: "test-key" } } },
      } as unknown as NeuroClawConfig;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { content: "Valid fact", category: "user_info", confidence: 0.9 },
                  { content: "Invalid category", category: "unknown_category", confidence: 0.9 },
                ]),
              },
            },
          ],
        }),
      });

      const result = await extractFactsWithAI("Тестовый текст", config);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("Valid fact");
    });

    it("filters out facts with very low confidence", async () => {
      const config = {
        models: { providers: { deepseek: { apiKey: "test-key" } } },
      } as unknown as NeuroClawConfig;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { content: "High confidence", category: "user_info", confidence: 0.9 },
                  { content: "Low confidence", category: "user_info", confidence: 0.3 },
                ]),
              },
            },
          ],
        }),
      });

      const result = await extractFactsWithAI("Тестовый текст", config);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("High confidence");
    });

    it("extracts JSON from response with surrounding text", async () => {
      const config = {
        models: { providers: { deepseek: { apiKey: "test-key" } } },
      } as unknown as NeuroClawConfig;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  'Here are the facts I found:\n[{"content": "Test fact", "category": "user_info", "confidence": 0.8}]\n\nThat\'s all!',
              },
            },
          ],
        }),
      });

      const result = await extractFactsWithAI("Тестовый текст", config);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("Test fact");
    });

    it("uses custom baseUrl from config", async () => {
      const config = {
        models: {
          providers: {
            deepseek: {
              apiKey: "test-key",
              baseUrl: "https://custom.deepseek.com/api",
            },
          },
        },
      } as unknown as NeuroClawConfig;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "[]" } }],
        }),
      });

      await extractFactsWithAI("Test", config);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom.deepseek.com/api/chat/completions",
        expect.any(Object),
      );
    });

    it("sends correct headers and body", async () => {
      const config = {
        models: { providers: { deepseek: { apiKey: "test-api-key" } } },
      } as unknown as NeuroClawConfig;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "[]" } }],
        }),
      });

      await extractFactsWithAI("Меня зовут Станислав", config);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
          },
        }),
      );

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.model).toBe("deepseek-chat");
      expect(body.temperature).toBe(0.1);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[1].content).toBe("Меня зовут Станислав");
    });
  });
});
