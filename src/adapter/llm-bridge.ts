/**
 * LLM Bridge — routes BrainAgent's internal enrichment calls through the
 * harness `ctx.llm` runtime (registered provider adapters) instead of the
 * env-var HTTP transport.
 *
 * Seam contract (see llm-client.ts):
 * - backend returns `undefined` to decline → env-var fallback is used;
 * - availability hook makes `isAIProviderAvailable()` report harness routes.
 *
 * Route resolution: an explicit plugin `model` ("provider/model") wins;
 * otherwise the first provider with at least one model is picked. The
 * resolution is cached and refreshed lazily so adapters registered after
 * boot are discovered too.
 */

import type { Context } from "@deepseek-ai/cordis";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { setAIAvailabilityHook, setCallLLMBackend } from "../modules/llm-client.ts";

type Route = { provider: string; model: string };

const ROUTE_CACHE_MS = 60_000;

/** Wire ctx.llm into the module callLLM seam. Returns a disposer. */
export function attachLlmBridge(ctx: Context, preferredModel?: string): () => void {
  let cachedRoute: Route | undefined;
  let cachedAt = 0;
  let resolving: Promise<Route | undefined> | undefined;

  async function resolveRoute(): Promise<Route | undefined> {
    if (cachedRoute && Date.now() - cachedAt < ROUTE_CACHE_MS) return cachedRoute;
    if (resolving) return resolving;

    resolving = (async (): Promise<Route | undefined> => {
      try {
        if (!ctx.llm) return undefined;

        if (preferredModel) {
          const slash = preferredModel.indexOf("/");
          if (slash > 0) {
            return {
              provider: preferredModel.slice(0, slash),
              model: preferredModel.slice(slash + 1),
            };
          }
        }

        for (const provider of ctx.llm.listProviders()) {
          const models = await ctx.llm.listModels(provider.id);
          if (models.length > 0) {
            return { provider: provider.id, model: models[0].id };
          }
        }
        return undefined;
      } catch {
        return undefined;
      } finally {
        resolving = undefined;
        cachedAt = Date.now();
      }
    })();

    cachedRoute = (await resolving) ?? cachedRoute;
    return cachedRoute;
  }

  setAIAvailabilityHook(() => Boolean(preferredModel) || cachedRoute !== undefined);

  setCallLLMBackend(async (systemPrompt, userText, _config, logger, maxTokens) => {
    const route = await resolveRoute();
    if (!route || !ctx.llm) return undefined; // decline → env-var fallback

    try {
      const chunks = ctx.llm.stream({
        provider: route.provider,
        model: route.model,
        system: systemPrompt,
        messages: [
          createUserMessage({
            content: [{ type: "text", text: userText }],
            source: { kind: "plugin", plugin: "brainagent" },
          }),
        ],
        temperature: 0.1,
        maxTokens: maxTokens ?? 500,
      });

      let text = "";
      for await (const chunk of chunks) {
        if (chunk.type === "text-delta") {
          text += chunk.text;
        }
      }
      return text.trim() ? text : null;
    } catch (error) {
      logger?.info(`BrainAgent LLM bridge: ctx.llm call failed — ${String(error)}`);
      return undefined; // decline → env-var fallback
    }
  });

  // Warm the route cache so availability reports are accurate early.
  void resolveRoute();

  return () => {
    setCallLLMBackend(undefined);
    setAIAvailabilityHook(undefined);
  };
}
