/**
 * Единый metrics-файл наблюдаемости (m7).
 *
 * Раньше наблюдаемость была размазана: reward-ledger писал свой ledger.json,
 * injection-metrics жили в памяти, статистика модулей доставалась только
 * через /brain status. Теперь один коллектор агрегирует ленивые провайдеры
 * статистики и пишет единый `.brainagent/metrics.json`.
 *
 *  - `createMetricsCollector(workspaceDir)` — фабрика с per-instance
 *    состоянием (шаблон миграции); пустой workspaceDir = detached-режим
 *    (состояние в памяти, диск не трогается).
 *  - Провайдеры ленивые и вызываются под try/catch: упавший модуль
 *    попадает в секцию `errors` и не ломает остальных.
 *  - Запись через schedulePersist: debounce + атомарно (tmp + rename),
 *    stop() сбрасывает немедленно.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { flushPersist, schedulePersist } from "./persist.ts";

export type MetricsProvider = () => unknown;

export type MetricsSnapshot = {
  generatedAt: string;
  startedAt: string;
  uptimeMs: number;
  updates: number;
  sections: Record<string, unknown>;
  errors: Record<string, string>;
};

export type MetricsCollectorInstance = {
  register(section: string, provider: MetricsProvider): void;
  update(): MetricsSnapshot;
  snapshot(): MetricsSnapshot;
  stop(): void;
};

export function createMetricsCollector(
  workspaceDir: string,
  options: { debounceMs?: number } = {},
): MetricsCollectorInstance {
  const providers = new Map<string, MetricsProvider>();
  const startedAt = new Date();
  const filePath = workspaceDir ? join(workspaceDir, ".brainagent", "metrics.json") : "";
  let updates = 0;

  if (filePath) {
    mkdirSync(join(workspaceDir, ".brainagent"), { recursive: true });
  }

  function collect(): MetricsSnapshot {
    const sections: Record<string, unknown> = {};
    const errors: Record<string, string> = {};
    for (const [name, provider] of providers) {
      try {
        sections[name] = provider();
      } catch (error) {
        errors[name] = (error as Error).message;
      }
    }
    return {
      generatedAt: new Date().toISOString(),
      startedAt: startedAt.toISOString(),
      uptimeMs: Date.now() - startedAt.getTime(),
      updates,
      sections,
      errors,
    };
  }

  let last = collect();

  function register(section: string, provider: MetricsProvider): void {
    providers.set(section, provider);
  }

  function update(): MetricsSnapshot {
    updates += 1;
    last = collect();
    if (filePath) {
      schedulePersist(filePath, () => JSON.stringify(last, null, 2), options.debounceMs);
    }
    return last;
  }

  function snapshot(): MetricsSnapshot {
    return last;
  }

  function stop(): void {
    if (filePath) flushPersist(filePath);
  }

  return { register, update, snapshot, stop };
}
