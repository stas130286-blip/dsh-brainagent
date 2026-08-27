import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initAutonomousResearch,
  stopAutonomousResearch,
  isResearchIntent,
  executeResearch,
  getAutonomousResearchStats,
} from "./autonomous-research.ts";
import { DEFAULT_CONFIG } from "./types.ts";

// ── Helpers ───────────────────────────────────────────────────────

function makeDeps(overrides: Partial<Parameters<typeof initAutonomousResearch>[2]> = {}) {
  return {
    callLLM: vi.fn().mockResolvedValue(null),
    storeFact: vi.fn(),
    recallFacts: vi.fn().mockReturnValue([]),
    gatewayConfig: {} as never,
    logger: { info: vi.fn() },
    ...overrides,
  };
}

function setup(
  configOverrides: Partial<typeof DEFAULT_CONFIG.autonomousResearch> = {},
  depsOverrides: Partial<Parameters<typeof initAutonomousResearch>[2]> = {},
) {
  const cfg = {
    ...DEFAULT_CONFIG,
    autonomousResearch: {
      ...DEFAULT_CONFIG.autonomousResearch,
      ...configOverrides,
    },
  };
  const deps = makeDeps(depsOverrides);
  initAutonomousResearch(cfg, { info: vi.fn() }, deps);
  return { cfg, deps };
}

/** Create a gatewayConfig with a specific search provider */
function makeGatewayConfig(
  provider: string,
  keys: Record<string, string> = {},
): Record<string, unknown> {
  const searchCfg: Record<string, unknown> = { provider };
  if (keys.apiKey) searchCfg.apiKey = keys.apiKey;
  if (keys.tavily) searchCfg.tavily = { apiKey: keys.tavily };
  if (keys.perplexity) searchCfg.perplexity = { apiKey: keys.perplexity };
  if (keys.grok) searchCfg.grok = { apiKey: keys.grok };
  return { tools: { web: { search: searchCfg } } };
}

// ── Tests ─────────────────────────────────────────────────────────

describe("isResearchIntent", () => {
  it("returns true for drive:cognitive source", () => {
    expect(isResearchIntent("drive:cognitive")).toBe(true);
  });

  it("returns true for desire:understanding-* sources", () => {
    expect(isResearchIntent("desire:understanding")).toBe(true);
    expect(isResearchIntent("desire:understanding-quantum")).toBe(true);
  });

  it("returns false for social drive", () => {
    expect(isResearchIntent("drive:social")).toBe(false);
  });

  it("returns false for creative drive", () => {
    expect(isResearchIntent("drive:creative")).toBe(false);
  });

  it("returns false for mastery drive", () => {
    expect(isResearchIntent("drive:mastery")).toBe(false);
  });

  it("returns false for DMN insight", () => {
    expect(isResearchIntent("dmn:insight")).toBe(false);
  });

  it("returns true for goal: with research keywords in prompt", () => {
    expect(isResearchIntent("goal:abc123", "Хочу узнать про квантовые компьютеры")).toBe(true);
    expect(isResearchIntent("goal:abc123", "Need to research AI safety")).toBe(true);
    expect(isResearchIntent("goal:abc123", "Нужно изучить тему")).toBe(true);
  });

  it("returns false for goal: without research keywords", () => {
    expect(isResearchIntent("goal:abc123", "Write a poem about spring")).toBe(false);
    expect(isResearchIntent("goal:abc123", "Say hello to user")).toBe(false);
  });

  it("returns false for goal: with no prompt", () => {
    expect(isResearchIntent("goal:abc123")).toBe(false);
  });
});

describe("getAutonomousResearchStats", () => {
  beforeEach(() => {
    setup();
  });

  it("returns zeroed stats after init", () => {
    const stats = getAutonomousResearchStats();
    expect(stats.totalCycles).toBe(0);
    expect(stats.totalFactsExtracted).toBe(0);
    expect(stats.lastResearchTime).toBe(0);
    expect(stats.consecutiveCooldowns).toBe(0);
  });
});

describe("executeResearch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when module is not initialized", async () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      autonomousResearch: { ...DEFAULT_CONFIG.autonomousResearch, enabled: false },
    };
    initAutonomousResearch(cfg, { info: vi.fn() }, makeDeps());
    const result = await executeResearch("test topic");
    expect(result).toBeNull();
  });

  it("returns null when disabled", async () => {
    setup({ enabled: false });
    const result = await executeResearch("test topic");
    expect(result).toBeNull();
  });

  it("enforces cooldown between research cycles", async () => {
    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["query one"]')
      .mockResolvedValueOnce(
        '{"facts": [{"content": "fact1", "category": "knowledge"}], "summary": "learned something"}',
      );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            web: {
              results: [{ title: "Result 1", url: "https://example.com", description: "desc" }],
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html" },
        text: () => Promise.resolve("<html><body><p>Some content</p></body></html>"),
      });
    vi.stubGlobal("fetch", fetchMock);

    setup(
      { enabled: true, cooldownMs: 60_000 },
      {
        callLLM,
        gatewayConfig: makeGatewayConfig("brave", { apiKey: "test-brave-key-12345" }) as never,
      },
    );

    const result1 = await executeResearch("quantum computing");
    expect(result1).not.toBeNull();

    const result2 = await executeResearch("quantum computing again");
    expect(result2).toBeNull();

    const stats = getAutonomousResearchStats();
    expect(stats.consecutiveCooldowns).toBe(1);
  });

  it("returns null when callLLM returns no queries", async () => {
    const callLLM = vi.fn().mockResolvedValue(null);
    setup({ enabled: true }, { callLLM });
    const result = await executeResearch("test topic");
    expect(result).toBeNull();
  });

  it("returns null when no API key is available", async () => {
    const callLLM = vi.fn().mockResolvedValue('["test query"]');
    setup({ enabled: true }, { callLLM, gatewayConfig: {} as never });

    const origEnv = process.env.BRAVE_API_KEY;
    delete process.env.BRAVE_API_KEY;
    // v0.9.23: фолбэк на deepseek не должен срабатывать в этом тесте
    const origDeepSeek = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    const result = await executeResearch("test topic");
    expect(result).toBeNull();

    if (origEnv) process.env.BRAVE_API_KEY = origEnv;
    if (origDeepSeek) process.env.DEEPSEEK_API_KEY = origDeepSeek;
  });

  // ── Brave provider ─────────────────────────────────────────────

  it("uses Brave provider by default", async () => {
    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["search query"]')
      .mockResolvedValueOnce('{"facts": [], "summary": "done"}');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            web: {
              results: [{ title: "R", url: "https://r.com", description: "d" }],
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html" },
        text: () => Promise.resolve("<p>Content</p>"),
      });
    vi.stubGlobal("fetch", fetchMock);

    setup(
      { enabled: true },
      {
        callLLM,
        gatewayConfig: makeGatewayConfig("brave", { apiKey: "test-brave-key-12345" }) as never,
      },
    );

    await executeResearch("test");

    // First fetch call should be to Brave API
    const firstUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(firstUrl).toContain("api.search.brave.com");
  });

  it("falls back to snippets when page fetch fails (Brave)", async () => {
    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["test query"]')
      .mockResolvedValueOnce(
        '{"facts": [{"content": "snippet fact", "category": "news"}], "summary": "learned from snippets"}',
      );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            web: {
              results: [
                {
                  title: "Page Title",
                  url: "https://fail.example.com",
                  description: "This is a search snippet",
                },
              ],
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/pdf" },
        text: () => Promise.resolve("binary data"),
      });
    vi.stubGlobal("fetch", fetchMock);

    const storeFact = vi.fn();
    setup(
      { enabled: true },
      {
        callLLM,
        storeFact,
        gatewayConfig: makeGatewayConfig("brave", { apiKey: "test-brave-key-12345" }) as never,
      },
    );

    const result = await executeResearch("test topic");
    expect(result).not.toBeNull();
    expect(result!.summary).toBe("learned from snippets");
    expect(storeFact).toHaveBeenCalledWith("snippet fact", "news", [], ["autonomous-research"]);
  });

  // ── Tavily provider ────────────────────────────────────────────

  it("uses Tavily provider when configured", async () => {
    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["tavily search"]')
      .mockResolvedValueOnce('{"facts": [], "summary": "tavily done"}');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              {
                title: "Tavily Result",
                url: "https://tavily.example.com",
                content: "some content",
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html" },
        text: () => Promise.resolve("<p>Tavily page content</p>"),
      });
    vi.stubGlobal("fetch", fetchMock);

    setup(
      { enabled: true },
      {
        callLLM,
        gatewayConfig: makeGatewayConfig("tavily", { tavily: "tvly-test-key-12345" }) as never,
      },
    );

    const result = await executeResearch("tavily test");
    expect(result).not.toBeNull();

    // First fetch call should be to Tavily API
    const firstUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(firstUrl).toContain("api.tavily.com");
  });

  // ── Perplexity provider ────────────────────────────────────────

  it("uses Perplexity provider — skips page fetch (returns text)", async () => {
    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["perplexity search"]')
      .mockResolvedValueOnce(
        '{"facts": [{"content": "pplx fact", "category": "knowledge"}], "summary": "perplexity summary"}',
      );

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "Perplexity synthesized answer about the topic." } }],
          citations: ["https://source1.com", "https://source2.com"],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const storeFact = vi.fn();
    setup(
      { enabled: true },
      {
        callLLM,
        storeFact,
        gatewayConfig: makeGatewayConfig("perplexity", {
          perplexity: "pplx-test-key-12345",
        }) as never,
      },
    );

    const result = await executeResearch("perplexity test");
    expect(result).not.toBeNull();
    expect(result!.summary).toBe("perplexity summary");
    expect(result!.pagesRead).toBe(0); // No page fetching for text providers

    // Only 1 fetch call (search), NOT 2+ (search + page fetch)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("chat/completions");
  });

  // ── Grok provider ──────────────────────────────────────────────

  it("uses Grok provider — skips page fetch (returns text)", async () => {
    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["grok search"]')
      .mockResolvedValueOnce(
        '{"facts": [{"content": "grok fact", "category": "news"}], "summary": "grok summary"}',
      );

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Grok synthesized answer here." }],
            },
          ],
          citations: ["https://grok-source.com"],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const storeFact = vi.fn();
    setup(
      { enabled: true },
      {
        callLLM,
        storeFact,
        gatewayConfig: makeGatewayConfig("grok", { grok: "xai-test-key-12345" }) as never,
      },
    );

    const result = await executeResearch("grok test");
    expect(result).not.toBeNull();
    expect(result!.summary).toBe("grok summary");
    expect(result!.pagesRead).toBe(0);
    expect(storeFact).toHaveBeenCalledWith("grok fact", "news", [], ["autonomous-research"]);

    // Only 1 fetch call (search), no page fetching
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("api.x.ai");
  });

  // ── Shared behavior ────────────────────────────────────────────

  it("stores extracted facts in hippocampus", async () => {
    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["AI safety research"]')
      .mockResolvedValueOnce(
        JSON.stringify({
          facts: [
            { content: "AI alignment is an active research area", category: "knowledge" },
            { content: "RLHF is a common technique", category: "how-to" },
          ],
          summary: "AI safety involves alignment and RLHF techniques",
        }),
      );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            web: {
              results: [{ title: "AI Safety", url: "https://ai.example.com", description: "desc" }],
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html" },
        text: () => Promise.resolve("<html><body><p>AI safety content here</p></body></html>"),
      });
    vi.stubGlobal("fetch", fetchMock);

    const storeFact = vi.fn();
    setup(
      { enabled: true },
      {
        callLLM,
        storeFact,
        gatewayConfig: makeGatewayConfig("brave", { apiKey: "test-brave-key-12345" }) as never,
      },
    );

    const result = await executeResearch("AI safety");
    expect(result).not.toBeNull();
    expect(result!.factsStored).toBe(2);
    expect(result!.summary).toBe("AI safety involves alignment and RLHF techniques");
    expect(storeFact).toHaveBeenCalledTimes(2);
    expect(storeFact).toHaveBeenCalledWith(
      "AI alignment is an active research area",
      "knowledge",
      [],
      ["autonomous-research"],
    );

    const stats = getAutonomousResearchStats();
    expect(stats.totalCycles).toBe(1);
    expect(stats.totalFactsExtracted).toBe(2);
  });

  it("handles malformed JSON from extraction gracefully", async () => {
    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["query"]')
      .mockResolvedValueOnce("This is not valid JSON at all");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            web: { results: [{ title: "Test", url: "https://test.com", description: "desc" }] },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html" },
        text: () => Promise.resolve("<p>Content</p>"),
      });
    vi.stubGlobal("fetch", fetchMock);

    setup(
      { enabled: true },
      {
        callLLM,
        gatewayConfig: makeGatewayConfig("brave", { apiKey: "test-brave-key-12345" }) as never,
      },
    );

    const result = await executeResearch("topic");
    expect(result).not.toBeNull();
    expect(result!.summary).toContain("This is not valid JSON");
    expect(result!.factsStored).toBe(0);
  });

  it("uses existing knowledge to avoid redundant research", async () => {
    const recallFacts = vi
      .fn()
      .mockReturnValue([{ content: "Already known fact about quantum computing" }]);

    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["new quantum query"]')
      .mockResolvedValueOnce('{"facts": [], "summary": "nothing new found"}');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            web: { results: [{ title: "Quantum", url: "https://q.com", description: "test" }] },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html" },
        text: () => Promise.resolve("<p>Content</p>"),
      });
    vi.stubGlobal("fetch", fetchMock);

    setup(
      { enabled: true },
      {
        callLLM,
        recallFacts,
        gatewayConfig: makeGatewayConfig("brave", { apiKey: "test-brave-key-12345" }) as never,
      },
    );

    await executeResearch("quantum computing");

    expect(callLLM).toHaveBeenCalledTimes(2);
    const planCall = callLLM.mock.calls[0];
    expect(planCall[1]).toContain("Already known");
  });

  it("respects maxSearchQueries limit", async () => {
    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["q1", "q2", "q3", "q4", "q5"]')
      .mockResolvedValueOnce('{"facts": [], "summary": "done"}');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          web: { results: [{ title: "R", url: "https://r.com", description: "d" }] },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    setup(
      { enabled: true, maxSearchQueries: 2 },
      {
        callLLM,
        gatewayConfig: makeGatewayConfig("brave", { apiKey: "test-brave-key-12345" }) as never,
      },
    );

    await executeResearch("topic");

    const braveSearchCalls = fetchMock.mock.calls.filter(
      (c: unknown[]) =>
        typeof c[0] === "string" && (c[0] as string).includes("api.search.brave.com"),
    );
    expect(braveSearchCalls.length).toBeLessThanOrEqual(2);
  });
});

describe("stopAutonomousResearch", () => {
  it("logs shutdown message", () => {
    const deps = makeDeps();
    setup({}, deps);
    stopAutonomousResearch();
    expect(deps.logger.info).toHaveBeenCalledWith("BrainAgent AutonomousResearch: stopped.");
  });
});
