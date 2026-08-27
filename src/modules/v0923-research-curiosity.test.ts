/**
 * v0.9.23 — провайдер поиска через ключ DeepSeek и чистка детектора пробелов.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initAutonomousResearch, executeResearch } from "./autonomous-research.ts";
import { extractGapTopic } from "./curiosity-drive.ts";
import { DEFAULT_CONFIG } from "./types.ts";

// ── Helpers (по образцу autonomous-research.test.ts) ─────────────

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

function setup(configOverrides = {}, depsOverrides = {}) {
  const cfg = {
    ...DEFAULT_CONFIG,
    autonomousResearch: { ...DEFAULT_CONFIG.autonomousResearch, ...configOverrides },
  };
  const deps = makeDeps(depsOverrides);
  initAutonomousResearch(cfg, { info: vi.fn() }, deps as never);
  return { cfg, deps };
}

const ENV_KEYS = [
  "BRAVE_API_KEY",
  "TAVILY_API_KEY",
  "PERPLEXITY_API_KEY",
  "OPENROUTER_API_KEY",
  "XAI_API_KEY",
  "DEEPSEEK_API_KEY",
];
let savedEnv: Record<string, string | undefined> = {};

let savedUserProfile: string | undefined;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  // изолируем фолбэк чтения ~/.dsh/.credentials.yaml от реальной машины
  savedUserProfile = process.env.USERPROFILE;
  process.env.USERPROFILE = join(mkdtempSync(join(tmpdir(), "v0923-nohome-")), "empty");
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  if (savedUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = savedUserProfile;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── DeepSeek search provider ─────────────────────────────────────

describe("v0.9.23: DeepSeek search provider", () => {
  it("uses DeepSeek provider when configured", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test-deepseek";
    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["linux mint latest release"]')
      .mockResolvedValueOnce(
        '{"facts": [{"content": "Linux Mint 22.3 Zena вышла в январе 2026", "category": "news"}], "summary": "ds summary"}',
      );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [
            {
              type: "web_search_tool_result",
              content: [
                { type: "web_search_result", url: "https://example.com/mint", title: "Mint 22.3" },
              ],
            },
            { type: "text", text: "The latest release is Linux Mint 22.3 Zena." },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const gatewayConfig = { tools: { web: { search: { provider: "deepseek" } } } };
    const { deps } = setup({ enabled: true }, { callLLM, gatewayConfig: gatewayConfig as never });

    const result = await executeResearch("linux mint");

    expect(result).not.toBeNull();
    expect(result!.summary).toBe("ds summary");
    expect(fetchMock).toHaveBeenCalledTimes(1); // текст — страницы не читаем
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("/anthropic/v1/messages");
    const init = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string>; body: string };
    expect(init.headers["x-api-key"]).toBe("sk-test-deepseek");
    expect(init.headers["anthropic-version"]).toBe("2023-06-01");
    expect(init.body).toContain("web_search_20250305");
    expect(deps.storeFact).toHaveBeenCalledWith(
      "Linux Mint 22.3 Zena вышла в январе 2026",
      "news",
      [],
      ["autonomous-research"],
    );
  });

  it("falls back to DeepSeek when configured provider has no key", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-fallback-key";
    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["test query"]')
      .mockResolvedValueOnce('{"facts": [], "summary": "fallback summary"}');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [
            {
              type: "web_search_tool_result",
              content: [{ type: "web_search_result", url: "https://example.com/x" }],
            },
            { type: "text", text: "Some answer." },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    // gatewayConfig пуст: дефолтный провайдер "brave" без ключа
    setup({ enabled: true }, { callLLM, gatewayConfig: {} as never });

    const result = await executeResearch("test topic");

    expect(result).not.toBeNull();
    expect(result!.summary).toBe("fallback summary");
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("/anthropic/v1/messages");
  });

  it("returns null when no provider keys exist (including DeepSeek)", async () => {
    const callLLM = vi.fn().mockResolvedValue('["query"]');
    setup({ enabled: true }, { callLLM, gatewayConfig: {} as never });

    const result = await executeResearch("test topic");
    expect(result).toBeNull();
  });

  it("resolves DeepSeek key from the host credentials store fallback", async () => {
    // фикстура: «дом» с credentials-стором, как у живого хоста
    const fakeHome = mkdtempSync(join(tmpdir(), "v0923-home-"));
    mkdirSync(join(fakeHome, ".dsh"));
    writeFileSync(
      join(fakeHome, ".dsh", ".credentials.yaml"),
      "version: 1\nrefs:\n  DEEPSEEK_API_KEY: sk-store-fallback-key\n",
    );
    process.env.USERPROFILE = fakeHome;

    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["store query"]')
      .mockResolvedValueOnce('{"facts": [], "summary": "store summary"}');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [
            {
              type: "web_search_tool_result",
              content: [{ type: "web_search_result", url: "https://example.com/s" }],
            },
            { type: "text", text: "Answer." },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    // gatewayConfig пуст: дефолтный "brave" без ключа → фолбэк на deepseek
    setup({ enabled: true }, { callLLM, gatewayConfig: {} as never });

    const result = await executeResearch("store topic");
    expect(result).not.toBeNull();
    expect(result!.summary).toBe("store summary");
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("/anthropic/v1/messages");
  });

  it("returns null when DeepSeek response has no search result blocks", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test-deepseek";
    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["query"]')
      .mockResolvedValueOnce('{"facts": [], "summary": "never"}');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: "text", text: "no search happened" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const gatewayConfig = { tools: { web: { search: { provider: "deepseek-official" } } } };
    setup({ enabled: true }, { callLLM, gatewayConfig: gatewayConfig as never });

    const result = await executeResearch("test topic");
    expect(result).toBeNull();
  });
});

// ── extractGapTopic: тема пробела вместо сырой реплики ───────────

describe("v0.9.23: extractGapTopic", () => {
  it("returns null for greetings", () => {
    expect(extractGapTopic("Привет! Как дела?")).toBeNull();
    expect(extractGapTopic("hi there")).toBeNull();
  });

  it("keeps content after reminder framing, drops bare commands", () => {
    // содержимое после тире — уже тема («проверить чайник»)
    expect(
      extractGapTopic("Поставь мне напоминание через 1 минуту — проверить чайник."),
    ).toBe("проверить чайник");
    // чистая команда без содержимого — не пробел знаний
    expect(extractGapTopic("Поставь напоминание через 5 минут")).toBeNull();
  });

  it("keeps meaningful questions", () => {
    expect(extractGapTopic("Что ты помнишь о наших прошлых разговорах?")).toBe(
      "Что ты помнишь о наших прошлых разговорах",
    );
  });

  it("keeps fact statements and strips trailing punctuation", () => {
    expect(
      extractGapTopic("Запомни важный факт: в сентябре я планирую перевести сервер на Linux Mint."),
    ).toBe("Запомни важный факт: в сентябре я планирую перевести сервер на Linux Mint");
  });

  it("extracts remainder after reminder framing", () => {
    expect(extractGapTopic("Напомни через 2 минуты, что нужно выпить стакан воды")).toBe(
      "нужно выпить стакан воды",
    );
  });

  it("truncates at sentence boundary for long input", () => {
    const topic = extractGapTopic(
      "Расскажи подробно, как работает ДМН. И ещё про дофамин тоже расскажи очень подробно.",
    );
    expect(topic).toBe("Расскажи подробно, как работает ДМН");
  });

  it("returns null for short noise", () => {
    expect(extractGapTopic("ок")).toBeNull();
    expect(extractGapTopic("...")).toBeNull();
  });
});
