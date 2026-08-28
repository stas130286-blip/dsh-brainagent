/**
 * v0.9.26: устойчивость извлечения фактов к обрезанному ответу модели.
 * Боевой случай: ночной цикл про аэрогель — факт оборвался на полуслове,
 * и в долговременную память легло 0 фактов.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initAutonomousResearch,
  executeResearch,
  salvageExtraction,
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

function setup(depsOverrides: Partial<Parameters<typeof initAutonomousResearch>[2]> = {}) {
  const cfg = { ...DEFAULT_CONFIG };
  const deps = makeDeps(depsOverrides);
  initAutonomousResearch(cfg, { info: vi.fn() }, deps);
  return { cfg, deps };
}

function makeBraveGateway() {
  return {
    tools: { web: { search: { provider: "brave", apiKey: "test-brave-key-12345" } } },
  } as never;
}

function mockBraveSearchAndPage() {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          web: { results: [{ title: "R", url: "https://r.com", description: "d" }] },
        }),
    })
    .mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "text/html" },
      text: () => Promise.resolve("<p>Content about aerogel</p>"),
    });
  vi.stubGlobal("fetch", fetchMock);
}

// ── salvageExtraction ─────────────────────────────────────────────

describe("salvageExtraction", () => {
  it("recovers complete facts when JSON is truncated mid-fact", () => {
    const raw =
      '{"facts":[{"content":"Аэрогель — один из самых лёгких твёрдых материалов","category":"knowledge"},' +
      '{"content":"Аэрогель на 90–99% состоит из воздуха","category":"knowledge"},' +
      '{"content":"Теплопроводность аэрогеля — твёрд';
    const { facts, summary } = salvageExtraction(raw);
    expect(facts).toHaveLength(2);
    expect(facts[0].content).toContain("самых лёгких");
    expect(facts[0].category).toBe("knowledge");
    expect(facts[1].content).toContain("состоит из воздуха");
    expect(summary).toBe("");
  });

  it("recovers summary only when its string is complete", () => {
    const complete =
      '{"facts":[{"content":"Достаточно длинный факт про аэрогель","category":"reference"}],' +
      '"summary":"Изучил свойства аэрогеля."}';
    expect(salvageExtraction(complete).summary).toBe("Изучил свойства аэрогеля.");

    const truncatedSummary =
      '{"facts":[{"content":"Достаточно длинный факт про аэрогель","category":"reference"}],' +
      '"summary":"Изучил свойства';
    const res = salvageExtraction(truncatedSummary);
    expect(res.facts).toHaveLength(1);
    expect(res.summary).toBe("");
  });

  it("handles swapped key order and unescapes quotes", () => {
    const raw =
      '{ "facts": [ { "category": "news", "content": "Факт с \\"кавычками\\" длиннее пяти" } ]';
    const { facts } = salvageExtraction(raw);
    expect(facts).toHaveLength(1);
    expect(facts[0].content).toBe('Факт с "кавычками" длиннее пяти');
    expect(facts[0].category).toBe("news");
  });

  it("returns no facts for non-JSON text", () => {
    expect(salvageExtraction("This is not valid JSON at all").facts).toHaveLength(0);
  });

  it("skips too-short contents and duplicates", () => {
    const raw =
      '{"facts":[{"content":"корот","category":"knowledge"},' +
      '{"content":"Достаточно длинный факт про аэрогель","category":"knowledge"},' +
      '{"content":"Достаточно длинный факт про аэрогель","category":"news"}]}';
    expect(salvageExtraction(raw).facts).toHaveLength(1);
  });

  it("tolerates pretty-printed JSON with newlines", () => {
    const raw =
      '{\n  "facts": [\n    {\n      "content": "Длинный факт с переносами в разметке",\n      "category": "knowledge"\n    }\n  ],\n  "summ';
    const { facts } = salvageExtraction(raw);
    expect(facts).toHaveLength(1);
    expect(facts[0].content).toContain("переносами");
  });
});

// ── executeResearch with truncated extraction ─────────────────────

describe("executeResearch with truncated extraction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("stores complete facts when extraction JSON is truncated", async () => {
    const truncated =
      '{"facts":[{"content":"Аэрогель получают методом сверхкритической сушки гелей","category":"how-to"},' +
      '{"content":"Аэрогель применяется в космических аппаратах как теплоизолятор","category":"knowledge"},' +
      '{"content":"Теплопров';

    const callLLM = vi
      .fn()
      .mockResolvedValueOnce('["aerogel insulation"]')
      .mockResolvedValueOnce(truncated);
    mockBraveSearchAndPage();

    const storeFact = vi.fn();
    setup({ callLLM, storeFact, gatewayConfig: makeBraveGateway() });

    const result = await executeResearch("аэрогель");
    expect(result).not.toBeNull();
    expect(result!.factsStored).toBe(2);
    expect(result!.facts).toHaveLength(2);
    expect(storeFact).toHaveBeenCalledTimes(2);
    expect(storeFact).toHaveBeenCalledWith(
      "Аэрогель получают методом сверхкритической сушки гелей",
      "how-to",
      [],
      ["autonomous-research"],
    );
  });

  it("raises extraction token budget default for reasoning models", () => {
    expect(DEFAULT_CONFIG.autonomousResearch.extractMaxTokens).toBe(1600);
  });
});
