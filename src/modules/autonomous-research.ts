/**
 * Autonomous Research — Isolated web research with fact extraction.
 *
 * When the agent's cognitive drive fires, research happens in isolation:
 * 1. Plan: callLLM generates search queries from the topic
 * 2. Search: direct API call to configured provider (no session context)
 * 3. Fetch: read top pages if needed (Brave/Tavily), or use response text (Perplexity/Grok)
 * 4. Extract: callLLM extracts key facts from content
 * 5. Store: facts go to hippocampus via storeFact()
 * 6. Discard: raw web data never enters the main session
 *
 * Supports all search providers: brave, perplexity, grok, tavily, deepseek.
 * The main session only sees a compact summary (~500 tokens).
 *
 * v0.7.0: фабрика createAutonomousResearch(cfg?, log?, deps?) — конфиг,
 * зависимости и статистика в замыкании инстанса; свободные функции —
 * обёртки над общим ленивым инстансом. Без cfg/deps фабрика создаёт
 * detached-инстанс (executeResearch возвращает null) — ровно поведение
 * модуля до init.
 *
 * v0.9.23: провайдер "deepseek" — поиск через Anthropic-совместимый эндпоинт
 * DeepSeek (/anthropic/v1/messages) со встроенным инструментом
 * web_search_20250305; ключ тот же, что у чата (DEEPSEEK_API_KEY).
 * Если у настроенного провайдера ключа нет — автоматический фолбэк на него.
 */

import type { HostConfig as NeuroClawConfig } from "./host-config.ts";
import type { BrainAgentConfig } from "./types.ts";

// ── Types ─────────────────────────────────────────────────────────

export type ResearchResult = {
  summary: string;
  factsStored: number;
  queriesExecuted: number;
  pagesRead: number;
};

export type ResearchStats = {
  totalCycles: number;
  totalFactsExtracted: number;
  lastResearchTime: number;
  consecutiveCooldowns: number;
};

type ResearchDeps = {
  callLLM: (
    systemPrompt: string,
    userText: string,
    config: NeuroClawConfig,
    logger?: { info: (msg: string) => void },
    maxTokens?: number,
  ) => Promise<string | null>;
  storeFact: (content: string, category: string, episodeIds: string[], tags: string[]) => void;
  recallFacts: (query: string, limit?: number) => Array<{ content: string }>;
  gatewayConfig: NeuroClawConfig;
  logger: { info: (msg: string) => void };
};

/** Normalized search result from any provider */
type SearchResult = {
  title: string;
  url: string;
  description: string;
};

type SearchProvider = "brave" | "perplexity" | "grok" | "tavily" | "deepseek";

/** Providers that return ready text — no page fetching needed */
type TextSearchResponse = {
  type: "text";
  content: string;
  citations: string[];
};

/** Providers that return URL lists — need page fetching */
type LinkSearchResponse = {
  type: "links";
  results: SearchResult[];
};

type SearchResponse = TextSearchResponse | LinkSearchResponse;

// ── Intent detection (stateless) ──────────────────────────────────

const RESEARCH_SOURCES = new Set(["drive:cognitive"]);
const RESEARCH_SOURCE_PREFIXES = ["desire:understanding"];

const RESEARCH_KEYWORDS = [
  "узнать",
  "исследовать",
  "найти информацию",
  "разобраться",
  "изучить",
  "learn",
  "research",
  "find out",
  "look up",
  "explore",
  "что такое",
  "как работает",
  "почему",
];

/**
 * Detect whether an autonomous intent requires web research.
 * Only cognitive hunger and understanding desires trigger research.
 */
export function isResearchIntent(source: string, promptText?: string): boolean {
  // Direct match on known research sources
  if (RESEARCH_SOURCES.has(source)) return true;

  // Prefix match (desire:understanding-*)
  for (const prefix of RESEARCH_SOURCE_PREFIXES) {
    if (source.startsWith(prefix)) return true;
  }

  // Goal-based: check if goal prompt contains research keywords
  if (source.startsWith("goal:") && promptText) {
    const lower = promptText.toLowerCase();
    return RESEARCH_KEYWORDS.some((kw) => lower.includes(kw));
  }

  return false;
}

// ── Stateless helpers ─────────────────────────────────────────────

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function htmlToText(html: string): string {
  return (
    html
      // Remove script/style/head blocks entirely
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<head[\s\S]*?<\/head>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      // Convert block elements to newlines
      .replace(/<\/?(p|div|br|h[1-6]|li|tr|blockquote)[^>]*>/gi, "\n")
      // Strip remaining tags
      .replace(/<[^>]*>/g, "")
      // Decode entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      // Collapse whitespace
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// ── Instance type ─────────────────────────────────────────────────

export type AutonomousResearchInstance = {
  executeResearch(topic: string): Promise<ResearchResult | null>;
  getStats(): ResearchStats;
  stop(): void;
};

// ── Factory ───────────────────────────────────────────────────────

/**
 * Create an autonomous-research instance with isolated state.
 * Without cfg/deps the instance is inert (executeResearch returns null) —
 * identical to pre-init module behavior.
 */
export function createAutonomousResearch(
  cfg?: BrainAgentConfig,
  log?: { info: (msg: string) => void },
  injectedDeps?: ResearchDeps,
): AutonomousResearchInstance {
  // ── Module state (closure) ───────────────────────────────────────
  let config: BrainAgentConfig["autonomousResearch"] | undefined = cfg?.autonomousResearch;
  let deps: ResearchDeps | undefined = injectedDeps;

  let stats: ResearchStats = {
    totalCycles: 0,
    totalFactsExtracted: 0,
    lastResearchTime: 0,
    consecutiveCooldowns: 0,
  };

  // ── Phase 1: Plan queries ─────────────────────────────────────────

  async function planQueries(topic: string, knownContext: string): Promise<string[] | null> {
    if (!deps || !config) return null;

    const systemPrompt = [
      "You are a research planner. Given a topic and already-known facts,",
      "generate 1-3 concise web search queries to find NEW information.",
      "Return ONLY a JSON array of query strings, nothing else.",
      'Example: ["query one", "query two"]',
    ].join(" ");

    const userText = knownContext ? `Topic: ${topic}\n\n${knownContext}` : `Topic: ${topic}`;

    const result = await deps.callLLM(systemPrompt, userText, deps.gatewayConfig, deps.logger, 300);

    if (!result) return null;

    try {
      // Extract JSON array from response (may have markdown fencing)
      const cleaned = result
        .replace(/```json?\s*/g, "")
        .replace(/```/g, "")
        .trim();
      const parsed = JSON.parse(cleaned) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((q): q is string => typeof q === "string" && q.length > 2)
          .slice(0, config.maxSearchQueries);
      }
    } catch {
      // Try line-by-line fallback
      const lines = result
        .split("\n")
        .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim())
        .filter((l) => l.length > 3 && l.length < 200);
      if (lines.length > 0) return lines.slice(0, config.maxSearchQueries);
    }

    return null;
  }

  // ── Phase 2: Search (multi-provider) ──────────────────────────────

  function resolveSearchProvider(gatewayConfig: NeuroClawConfig): SearchProvider {
    const search = (gatewayConfig as Record<string, unknown>).tools as
      | { web?: { search?: { provider?: string } } }
      | undefined;
    const raw = (search?.web?.search?.provider ?? "").toString().trim().toLowerCase();
    if (raw === "perplexity") return "perplexity";
    if (raw === "grok") return "grok";
    if (raw === "tavily") return "tavily";
    if (raw === "brave") return "brave";
    // v0.9.23: хост может хранить провайдера как "deepseek-official"
    if (raw === "deepseek" || raw === "deepseek-official") return "deepseek";
    return "brave"; // default
  }

  async function searchWeb(
    queries: string[],
    provider: SearchProvider,
  ): Promise<SearchResponse | null> {
    switch (provider) {
      case "brave":
        return searchBrave(queries);
      case "tavily":
        return searchTavily(queries);
      case "perplexity":
        return searchPerplexity(queries);
      case "grok":
        return searchGrok(queries);
      case "deepseek":
        return searchDeepSeek(queries);
    }
  }

  // ── Brave Search ────────────────────────────────────────────

  async function searchBrave(queries: string[]): Promise<LinkSearchResponse | null> {
    if (!deps || !config) return null;

    const apiKey = resolveApiKey("brave");
    if (!apiKey) {
      deps.logger.info("BrainAgent AutonomousResearch: no Brave API key available");
      return null;
    }

    const allResults: SearchResult[] = [];

    for (const query of queries) {
      try {
        const params = new URLSearchParams({
          q: query,
          count: String(config.maxPagesPerQuery),
        });

        const response = await fetch(
          `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
          {
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip",
              "X-Subscription-Token": apiKey,
            },
            signal: AbortSignal.timeout(10_000),
          },
        );

        if (!response.ok) {
          deps.logger.info(
            `BrainAgent AutonomousResearch: Brave search failed (${response.status})`,
          );
          continue;
        }

        const data = (await response.json()) as {
          web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
        };

        for (const r of data.web?.results ?? []) {
          if (r.url && r.title) {
            allResults.push({
              title: stripHtml(r.title),
              url: r.url,
              description: stripHtml(r.description ?? ""),
            });
          }
        }
      } catch (err) {
        deps.logger.info(
          `BrainAgent AutonomousResearch: Brave error for "${query}" — ${String(err)}`,
        );
      }
    }

    return { type: "links", results: allResults };
  }

  // ── Tavily Search ─────────────────────────────────────────

  async function searchTavily(queries: string[]): Promise<LinkSearchResponse | null> {
    if (!deps || !config) return null;

    const apiKey = resolveApiKey("tavily");
    if (!apiKey) {
      deps.logger.info("BrainAgent AutonomousResearch: no Tavily API key available");
      return null;
    }

    const allResults: SearchResult[] = [];

    for (const query of queries) {
      try {
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            search_depth: "basic",
            include_answer: false,
            max_results: config.maxPagesPerQuery,
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
          deps.logger.info(
            `BrainAgent AutonomousResearch: Tavily search failed (${response.status})`,
          );
          continue;
        }

        const data = (await response.json()) as {
          results?: Array<{ title?: string; url?: string; content?: string }>;
        };

        for (const r of data.results ?? []) {
          if (r.url && r.title) {
            allResults.push({
              title: r.title,
              url: r.url,
              description: r.content ?? "",
            });
          }
        }
      } catch (err) {
        deps.logger.info(
          `BrainAgent AutonomousResearch: Tavily error for "${query}" — ${String(err)}`,
        );
      }
    }

    return { type: "links", results: allResults };
  }

  // ── Perplexity Search ─────────────────────────────────────

  async function searchPerplexity(queries: string[]): Promise<TextSearchResponse | null> {
    if (!deps || !config) return null;

    const apiKey = resolveApiKey("perplexity");
    if (!apiKey) {
      deps.logger.info("BrainAgent AutonomousResearch: no Perplexity API key available");
      return null;
    }

    // Perplexity returns synthesized text — combine all queries into one call
    const combinedQuery = queries.join("; ");
    const baseUrl = resolvePerplexityBaseUrl(apiKey, deps.gatewayConfig);
    const model = resolvePerplexityModel(deps.gatewayConfig);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: combinedQuery }],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        deps.logger.info(
          `BrainAgent AutonomousResearch: Perplexity search failed (${response.status})`,
        );
        return null;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        citations?: string[];
      };

      const content = data.choices?.[0]?.message?.content ?? "";
      if (!content) return null;

      return {
        type: "text",
        content,
        citations: data.citations ?? [],
      };
    } catch (err) {
      deps.logger.info(`BrainAgent AutonomousResearch: Perplexity error — ${String(err)}`);
      return null;
    }
  }

  // ── Grok (xAI) Search ─────────────────────────────────────

  async function searchGrok(queries: string[]): Promise<TextSearchResponse | null> {
    if (!deps || !config) return null;

    const apiKey = resolveApiKey("grok");
    if (!apiKey) {
      deps.logger.info("BrainAgent AutonomousResearch: no xAI/Grok API key available");
      return null;
    }

    const combinedQuery = queries.join("; ");
    const model = resolveGrokModel(deps.gatewayConfig);

    try {
      const response = await fetch("https://api.x.ai/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: [{ role: "user", content: combinedQuery }],
          tools: [{ type: "web_search" }],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        deps.logger.info(
          `BrainAgent AutonomousResearch: Grok search failed (${response.status})`,
        );
        return null;
      }

      const data = (await response.json()) as {
        output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
        citations?: string[];
      };

      // Extract text from Grok's response format
      const textParts = (data.output ?? [])
        .filter((item) => item.type === "message")
        .flatMap((item) => item.content ?? [])
        .filter((c) => c.type === "output_text" && c.text)
        .map((c) => c.text!);

      const content = textParts.join("\n\n");
      if (!content) return null;

      return {
        type: "text",
        content,
        citations: data.citations ?? [],
      };
    } catch (err) {
      deps.logger.info(`BrainAgent AutonomousResearch: Grok error — ${String(err)}`);
      return null;
    }
  }

  // ── API key resolution (multi-provider) ─────────────────────

  function resolveApiKey(provider: SearchProvider): string | null {
    if (!deps) return null;

    const search = (deps.gatewayConfig as Record<string, unknown>).tools as
      | { web?: { search?: Record<string, unknown> } }
      | undefined;
    const searchCfg = search?.web?.search;

    switch (provider) {
      case "brave": {
        const fromConfig = searchCfg?.apiKey;
        if (typeof fromConfig === "string" && fromConfig.length > 5) return fromConfig;
        const fromEnv = process.env.BRAVE_API_KEY;
        if (fromEnv && fromEnv.length > 5) return fromEnv;
        return null;
      }
      case "tavily": {
        const tavilyCfg = searchCfg?.tavily as { apiKey?: string } | undefined;
        if (typeof tavilyCfg?.apiKey === "string" && tavilyCfg.apiKey.length > 5)
          return tavilyCfg.apiKey;
        // Fallback to top-level apiKey
        const fromConfig = searchCfg?.apiKey;
        if (typeof fromConfig === "string" && fromConfig.length > 5) return fromConfig;
        const fromEnv = process.env.TAVILY_API_KEY;
        if (fromEnv && fromEnv.length > 5) return fromEnv;
        return null;
      }
      case "perplexity": {
        const pplxCfg = searchCfg?.perplexity as { apiKey?: string } | undefined;
        if (typeof pplxCfg?.apiKey === "string" && pplxCfg.apiKey.length > 5) return pplxCfg.apiKey;
        const fromEnv = process.env.PERPLEXITY_API_KEY || process.env.OPENROUTER_API_KEY;
        if (fromEnv && fromEnv.length > 5) return fromEnv;
        return null;
      }
      case "grok": {
        const grokCfg = searchCfg?.grok as { apiKey?: string } | undefined;
        if (typeof grokCfg?.apiKey === "string" && grokCfg.apiKey.length > 5) return grokCfg.apiKey;
        const fromEnv = process.env.XAI_API_KEY;
        if (fromEnv && fromEnv.length > 5) return fromEnv;
        return null;
      }
      case "deepseek": {
        const dsCfg = searchCfg?.deepseek as { apiKey?: string } | undefined;
        if (typeof dsCfg?.apiKey === "string" && dsCfg.apiKey.length > 5) return dsCfg.apiKey;
        const fromEnv = process.env.DEEPSEEK_API_KEY;
        if (fromEnv && fromEnv.length > 5) return fromEnv;
        return null;
      }
    }
  }

  function resolvePerplexityBaseUrl(apiKey: string, gatewayConfig: NeuroClawConfig): string {
    const search = (gatewayConfig as Record<string, unknown>).tools as
      | { web?: { search?: { perplexity?: { baseUrl?: string } } } }
      | undefined;
    const fromConfig = search?.web?.search?.perplexity?.baseUrl;
    if (typeof fromConfig === "string" && fromConfig.trim()) return fromConfig.trim();

    // Auto-detect from key prefix
    const lower = apiKey.toLowerCase();
    if (lower.startsWith("pplx-")) return "https://api.perplexity.ai";
    if (lower.startsWith("sk-or-")) return "https://openrouter.ai/api/v1";
    return "https://openrouter.ai/api/v1";
  }

  function resolvePerplexityModel(gatewayConfig: NeuroClawConfig): string {
    const search = (gatewayConfig as Record<string, unknown>).tools as
      | { web?: { search?: { perplexity?: { model?: string } } } }
      | undefined;
    const fromConfig = search?.web?.search?.perplexity?.model;
    if (typeof fromConfig === "string" && fromConfig.trim()) return fromConfig.trim();
    return "perplexity/sonar-pro";
  }

  function resolveGrokModel(gatewayConfig: NeuroClawConfig): string {
    const search = (gatewayConfig as Record<string, unknown>).tools as
      | { web?: { search?: { grok?: { model?: string } } } }
      | undefined;
    const fromConfig = search?.web?.search?.grok?.model;
    if (typeof fromConfig === "string" && fromConfig.trim()) return fromConfig.trim();
    return "grok-4-1-fast";
  }

  // ── DeepSeek (v0.9.23) ─────────────────────────────────────────
  // Anthropic-совместимый эндпоинт со встроенным инструментом
  // web_search_20250305; ключ тот же, что у чата. Возвращает готовый
  // текст с цитатами — страницы читать не нужно (тип "text").

  function resolveDeepSeekBaseUrl(gatewayConfig: NeuroClawConfig): string {
    const search = (gatewayConfig as Record<string, unknown>).tools as
      | { web?: { search?: { deepseek?: { baseUrl?: string } } } }
      | undefined;
    const fromConfig = search?.web?.search?.deepseek?.baseUrl;
    if (typeof fromConfig === "string" && fromConfig.trim()) return fromConfig.trim();
    return "https://api.deepseek.com/anthropic/v1";
  }

  function resolveDeepSeekModel(gatewayConfig: NeuroClawConfig): string {
    const search = (gatewayConfig as Record<string, unknown>).tools as
      | { web?: { search?: { deepseek?: { model?: string } } } }
      | undefined;
    const fromConfig = search?.web?.search?.deepseek?.model;
    if (typeof fromConfig === "string" && fromConfig.trim()) return fromConfig.trim();
    return "deepseek-v4-flash";
  }

  async function searchDeepSeek(queries: string[]): Promise<TextSearchResponse | null> {
    if (!deps || !config) return null;

    const apiKey = resolveApiKey("deepseek");
    if (!apiKey) {
      deps.logger.info("BrainAgent AutonomousResearch: no DeepSeek API key available");
      return null;
    }

    // Один запрос на все спланированные темы — как у Perplexity
    const combinedQuery = queries.join("; ");
    const baseUrl = resolveDeepSeekBaseUrl(deps.gatewayConfig);
    const model = resolveDeepSeekModel(deps.gatewayConfig);

    try {
      const response = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          // Официальный DeepSeek ждёт x-api-key; прокси — Bearer: шлём оба
          "x-api-key": apiKey,
          Authorization: `Bearer ${apiKey}`,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: `Perform a web search for the query: ${combinedQuery}` }],
            },
          ],
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        deps.logger.info(
          `BrainAgent AutonomousResearch: DeepSeek search failed (HTTP ${response.status})`,
        );
        return null;
      }

      const parsed = (await response.json()) as {
        content?: Array<Record<string, unknown>>;
      };

      const blocks = parsed.content ?? [];
      const textParts: string[] = [];
      const citations: string[] = [];

      for (const block of blocks) {
        if (block.type === "text" && typeof block.text === "string") {
          textParts.push(block.text);
        }
        if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
          for (const item of block.content as Array<Record<string, unknown>>) {
            if (item.type === "web_search_result" && typeof item.url === "string" && item.url) {
              citations.push(typeof item.title === "string" ? `${item.title} — ${item.url}` : item.url);
            }
          }
        }
      }

      if (citations.length === 0) {
        // Нет блоков поиска — запрос, видимо, не ушёл в вебе
        deps.logger.info(
          "BrainAgent AutonomousResearch: DeepSeek returned no web_search_tool_result blocks",
        );
        return null;
      }

      return { type: "text", content: textParts.join("\n\n"), citations };
    } catch (error) {
      deps.logger.info(`BrainAgent AutonomousResearch: DeepSeek search error: ${String(error)}`);
      return null;
    }
  }

  // ── Phase 3: Fetch pages (Brave/Tavily only) ─────────────────

  async function fetchPages(results: SearchResult[]): Promise<string> {
    if (!config) return "";

    let totalChars = 0;
    const pages: string[] = [];

    for (const result of results) {
      if (totalChars >= config.maxTotalChars) break;

      try {
        const response = await fetch(result.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; NeuroClaw/1.0)",
            Accept: "text/html,text/plain",
          },
          signal: AbortSignal.timeout(8_000),
          redirect: "follow",
        });

        if (!response.ok) continue;

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
          continue;
        }

        const html = await response.text();
        const text = htmlToText(html);
        const truncated = text.slice(0, config.maxPageChars);

        if (truncated.length < 50) continue; // Skip near-empty pages

        pages.push(`## ${result.title}\nSource: ${result.url}\n\n${truncated}`);
        totalChars += truncated.length;
      } catch {
        // Skip failed fetches — non-critical
      }
    }

    return pages.join("\n\n---\n\n");
  }

  // ── Phase 4: Extract facts and store ────────────────────────

  async function extractAndStore(
    topic: string,
    content: string,
    queriesExecuted: number,
    pagesRead: number,
  ): Promise<ResearchResult> {
    if (!deps || !config) {
      return { summary: "", factsStored: 0, queriesExecuted, pagesRead };
    }

    const systemPrompt = [
      "You are a fact extractor. From the web content below, extract the most",
      "important and useful facts related to the research topic.",
      "Return a JSON object with two fields:",
      '1. "facts": array of objects {content: string, category: string}',
      '   Categories: "knowledge", "news", "opinion", "how-to", "reference"',
      '2. "summary": a 1-3 sentence summary of what was learned.',
      "Return ONLY valid JSON, no markdown fencing.",
    ].join(" ");

    const truncatedContent = content.slice(0, config.maxTotalChars);
    const userText = `Topic: ${topic}\n\nWeb content:\n${truncatedContent}`;

    const result = await deps.callLLM(
      systemPrompt,
      userText,
      deps.gatewayConfig,
      deps.logger,
      config.extractMaxTokens,
    );

    if (!result) {
      deps.logger.info("BrainAgent AutonomousResearch: extraction LLM call failed");
      return { summary: "", factsStored: 0, queriesExecuted, pagesRead };
    }

    // Parse extracted facts
    let facts: Array<{ content: string; category: string }> = [];
    let summary = "";

    try {
      const cleaned = result
        .replace(/```json?\s*/g, "")
        .replace(/```/g, "")
        .trim();
      const parsed = JSON.parse(cleaned) as {
        facts?: Array<{ content: string; category: string }>;
        summary?: string;
      };
      facts = (parsed.facts ?? []).filter(
        (f) => typeof f.content === "string" && f.content.length > 5,
      );
      summary = typeof parsed.summary === "string" ? parsed.summary : "";
    } catch {
      // If JSON parsing fails, use the raw result as summary
      summary = result.slice(0, 500);
      deps.logger.info("BrainAgent AutonomousResearch: extraction JSON parse failed, using raw");
    }

    // Store facts in hippocampus
    for (const fact of facts) {
      deps.storeFact(fact.content, fact.category || "knowledge", [], ["autonomous-research"]);
    }

    stats.totalCycles++;
    stats.totalFactsExtracted += facts.length;

    deps.logger.info(
      `BrainAgent AutonomousResearch: completed — ${facts.length} facts stored, ` +
        `${queriesExecuted} queries, ${pagesRead} pages`,
    );

    return {
      summary: summary || `Researched "${topic}" — found ${facts.length} facts.`,
      factsStored: facts.length,
      queriesExecuted,
      pagesRead,
    };
  }

  // ── Core research pipeline ──────────────────────────────────

  async function executeResearch(topic: string): Promise<ResearchResult | null> {
    if (!config?.enabled || !deps) return null;

    // Cooldown check
    const now = Date.now();
    if (now - stats.lastResearchTime < config.cooldownMs) {
      stats.consecutiveCooldowns++;
      deps.logger.info(
        `BrainAgent AutonomousResearch: cooldown (${stats.consecutiveCooldowns} skipped)`,
      );
      return null;
    }

    stats.lastResearchTime = now;
    stats.consecutiveCooldowns = 0;

    // Check existing knowledge to avoid re-researching
    const existingFacts = deps.recallFacts(topic, 5);
    const knownContext =
      existingFacts.length > 0
        ? `Already known:\n${existingFacts.map((f) => `- ${f.content}`).join("\n")}`
        : "";

    // Phase 1: Plan search queries
    const queries = await planQueries(topic, knownContext);
    if (!queries || queries.length === 0) {
      deps.logger.info("BrainAgent AutonomousResearch: no queries planned, skipping");
      return null;
    }

    // Phase 2: Search via configured provider
    const provider = resolveSearchProvider(deps.gatewayConfig);
    deps.logger.info(`BrainAgent AutonomousResearch: using search provider "${provider}"`);

    let searchResponse = await searchWeb(queries, provider);
    // v0.9.23: если у настроенного провайдера нет ключа, пробуем DeepSeek —
    // тот же ключ, что у чата, дополнительных настроек не требует.
    if (!searchResponse && provider !== "deepseek" && resolveApiKey("deepseek")) {
      deps.logger.info(
        'BrainAgent AutonomousResearch: provider "' + provider + '" unavailable, falling back to deepseek',
      );
      searchResponse = await searchWeb(queries, "deepseek");
    }
    if (!searchResponse) {
      deps.logger.info("BrainAgent AutonomousResearch: search returned nothing, skipping");
      return null;
    }

    // Phase 3: Get content for extraction
    let content: string;
    let pagesRead = 0;

    if (searchResponse.type === "text") {
      // Perplexity/Grok already return synthesized text — skip page fetching
      content = searchResponse.content.slice(0, config.maxTotalChars);
      if (searchResponse.citations.length > 0) {
        content += "\n\nSources:\n" + searchResponse.citations.map((c) => `- ${c}`).join("\n");
      }
    } else {
      // Brave/Tavily return links — need to fetch pages
      if (searchResponse.results.length === 0) {
        deps.logger.info("BrainAgent AutonomousResearch: no search results, skipping");
        return null;
      }

      const pageContent = await fetchPages(searchResponse.results);
      pagesRead = searchResponse.results.length;

      if (!pageContent || pageContent.length === 0) {
        // Fall back to search snippets if fetch fails
        const snippetContent = searchResponse.results
          .map((r) => `${r.title}: ${r.description}`)
          .join("\n\n");
        return await extractAndStore(topic, snippetContent, queries.length, 0);
      }
      content = pageContent;
    }

    // Phase 4: Extract facts and store
    return await extractAndStore(topic, content, queries.length, pagesRead);
  }

  function getStats(): ResearchStats {
    return { ...stats };
  }

  function stop(): void {
    deps?.logger.info("BrainAgent AutonomousResearch: stopped.");
  }

  if (cfg) {
    log?.info("BrainAgent AutonomousResearch: initialized (isolated research pipeline)");
  }

  return { executeResearch, getStats, stop };
}

// ── Active-instance wrappers (backward-compatible API) ───────────

let active: AutonomousResearchInstance | null = null;

function current(): AutonomousResearchInstance {
  if (!active) active = createAutonomousResearch();
  return active;
}

export function initAutonomousResearch(
  cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
  injectedDeps: {
    callLLM: (
      systemPrompt: string,
      userText: string,
      config: NeuroClawConfig,
      logger?: { info: (msg: string) => void },
      maxTokens?: number,
    ) => Promise<string | null>;
    storeFact: (content: string, category: string, episodeIds: string[], tags: string[]) => void;
    recallFacts: (query: string, limit?: number) => Array<{ content: string }>;
    gatewayConfig: NeuroClawConfig;
    logger: { info: (msg: string) => void };
  },
): void {
  active = createAutonomousResearch(cfg, log, injectedDeps);
}

export function stopAutonomousResearch(): void {
  current().stop();
}

/**
 * Execute an isolated research cycle. Returns a compact summary
 * for injection into the main session context.
 */
export async function executeResearch(topic: string): Promise<ResearchResult | null> {
  return current().executeResearch(topic);
}

export function getAutonomousResearchStats(): ResearchStats {
  return current().getStats();
}
