/**
 * v0.9.24 — полная инъекция итогов исследования.
 *
 * Боевой прогон показал: инъекция одной лишь сводки (1–3 предложения)
 * недостаточна — модель опиралась на общие знания, а не на извлечённые
 * факты. Теперь блок несёт топ фактов и инструкцию, а также освобождён
 * от фильтров бандита и гейта внимания (preserveResearchBlock).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  initAutonomousResearch,
  executeResearch,
  buildResearchInjection,
} from "./autonomous-research.ts";
import type { ResearchResult } from "./autonomous-research.ts";
import { preserveResearchBlock } from "../plugin/context.ts";
import { DEFAULT_CONFIG } from "./types.ts";

// ── Helpers (по образцу v0923-research-curiosity.test.ts) ───────

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
  savedUserProfile = process.env.USERPROFILE;
  process.env.USERPROFILE = join(mkdtempSync(join(tmpdir(), "v0924-nohome-")), "empty");
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

function makeResult(overrides: Partial<ResearchResult> = {}): ResearchResult {
  return {
    summary: "test summary",
    facts: ["fact one", "fact two"],
    factsStored: 2,
    queriesExecuted: 1,
    pagesRead: 1,
    ...overrides,
  };
}

// ── buildResearchInjection ───────────────────────────────────────

describe("v0.9.24: buildResearchInjection", () => {
  it("builds a block with instruction, summary and facts", () => {
    const block = buildResearchInjection(makeResult());
    expect(block).toBeDefined();
    expect(block).toContain("## Research Results (Autonomous Research Pipeline)");
    // инструкция: не вызывать поиск повторно + опираться на факты
    expect(block).toContain("не вызывай");
    expect(block).toContain("web_search");
    expect(block).toContain("опирайся");
    // сводка и факты
    expect(block).toContain("test summary");
    expect(block).toContain("- fact one");
    expect(block).toContain("- fact two");
    // счётчик
    expect(block).toContain("(2 facts stored to memory, 1 queries, 1 pages)");
  });

  it("caps the fact list at 8 entries", () => {
    const facts = Array.from({ length: 12 }, (_, i) => `fact-${String(i + 1).padStart(2, "0")}`);
    const block = buildResearchInjection(
      makeResult({ facts, factsStored: facts.length }),
    );
    expect(block).toBeDefined();
    expect(block).toContain("- fact-08");
    expect(block).not.toContain("fact-09");
    expect(block).not.toContain("fact-12");
    // счётчик сообщает полное число
    expect(block).toContain("(12 facts stored to memory");
  });

  it("truncates long facts to ~280 chars with ellipsis", () => {
    const long = "x".repeat(400);
    const block = buildResearchInjection(makeResult({ facts: [long] }));
    expect(block).toBeDefined();
    expect(block).toContain("x".repeat(280) + "…");
    expect(block).not.toContain("x".repeat(281));
  });

  it("returns undefined when there is nothing to inject", () => {
    expect(
      buildResearchInjection(
        makeResult({ summary: "", facts: [], factsStored: 0 }),
      ),
    ).toBeUndefined();
  });

  it("builds a block even without summary if facts exist", () => {
    const block = buildResearchInjection(
      makeResult({ summary: "", facts: ["only fact"], factsStored: 1 }),
    );
    expect(block).toBeDefined();
    expect(block).toContain("- only fact");
  });
});

// ── preserveResearchBlock: освобождение от фильтров ──────────────

describe("v0.9.24: preserveResearchBlock", () => {
  it("prepends the research block before filtered sections", () => {
    const out = preserveResearchBlock(["a", "b"], "RESEARCH");
    expect(out).toEqual(["RESEARCH", "a", "b"]);
  });

  it("passes filtered through when no research block", () => {
    expect(preserveResearchBlock(["a"], undefined)).toEqual(["a"]);
  });
});

// ── executeResearch возвращает факты ─────────────────────────────

describe("v0.9.24: executeResearch carries extracted facts", () => {
  it("returns facts alongside the summary (deepseek flow)", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test-deepseek";
    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["linux mint latest release"]')
      .mockResolvedValueOnce(
        '{"facts": [{"content": "Linux Mint 22.3 Zena вышла в январе 2026", "category": "news"}, ' +
          '{"content": "Короткий факт", "category": "news"}], "summary": "ds summary"}',
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
    setup({ enabled: true }, { callLLM, gatewayConfig: gatewayConfig as never });

    const result = await executeResearch("linux mint");

    expect(result).not.toBeNull();
    expect(result!.summary).toBe("ds summary");
    expect(result!.facts).toEqual([
      "Linux Mint 22.3 Zena вышла в январе 2026",
      "Короткий факт",
    ]);
    expect(result!.factsStored).toBe(2);

    // боевой сценарий целиком: из результата собирается инъекция
    const block = buildResearchInjection(result!);
    expect(block).toContain("- Linux Mint 22.3 Zena вышла в январе 2026");
    expect(block).toContain("- Короткий факт");
  });
});
