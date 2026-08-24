/**
 * Proactive Feedback — обучение на «не зашло».
 *
 * До v0.2.0 реакция пользователя на автономное (проактивное) сообщение
 * сохранялась как эпизод с эмоцией «neutral» и важностью 0 — агент
 * ничему не учился и мог бесконечно наступать на одни и те же грабли.
 *
 * Теперь каждая реакция классифицируется общим банком эвристик
 * (i18n-heuristics) и превращается в поведенческое научение:
 *
 *  - отвержение («хватит», «не надо», "stop it") → счётчик отвержений
 *    домена растёт на rejectionStep;
 *  - негатив («не то», «переделай») → растёт на negativeStep;
 *  - позитив («спасибо», «круто») → счётчик снижается (positiveStep) —
 *    тема, наоборот, поощряется;
 *  - когда score достигает suppressionThreshold, домен подавляется на
 *    cooldownMs — enqueueAutonomousIntent() не пропускает такие темы,
 *    а подсказка в проактивном фрейме просит их не заводить.
 *
 * Счётчики затухают со временем (decayPerDay): как и у людей,
 * давнее раздражение постепенно забывается.
 *
 * v0.7.0: фабрика createProactiveFeedback(workspaceDir, cfg?, log?) —
 * всё состояние в замыкании инстанса; свободные функции — обёртки над
 * активным инстансом. Пустой workspaceDir = detached-режим (состояние в
 * памяти, диск не трогается) — ровно поведение модуля до init.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bus } from "./event-bus.ts";
import { classifyFeedback, type FeedbackSignal } from "./i18n-heuristics.ts";
import { cancelPersist, flushPersist, schedulePersist } from "./persist.ts";
import type { BrainAgentConfig } from "./types.ts";

// ── Типы ────────────────────────────────────────────────────────────

type DomainFeedback = {
  rejections: number;
  accepts: number;
  /** Накопленный score подавления (растёт от отвержений, затухает). */
  suppressionScore: number;
  lastRejectionTime: number;
  /** Метки эвристик последней негативной реакции (диагностика). */
  lastHits: string[];
  /** Последняя оценка затухания (для on-demand пересчёта). */
  lastDecayTime: number;
};

type PersistedState = {
  domains: Record<string, DomainFeedback>;
};

// ── Instance type ───────────────────────────────────────────────────

export type ProactiveFeedbackInstance = {
  recordProactiveReaction(domain: string, reactionText: string): FeedbackSignal;
  isDomainSuppressed(domain: string): boolean;
  getSuppressedDomainHints(): string[];
  getStats(): {
    trackedDomains: number;
    totalRejections: number;
    totalAccepts: number;
    suppressedDomains: string[];
  };
  stop(): void;
};

// ── Фабрика ─────────────────────────────────────────────────────────

/**
 * Создать инстанс proactive-feedback с изолированным состоянием.
 * Пустой workspaceDir = detached-инстанс: состояние в памяти,
 * диск не трогается (в точности поведение модуля до init).
 */
export function createProactiveFeedback(
  workspaceDir: string,
  cfg?: BrainAgentConfig,
  log?: { info: (msg: string) => void },
): ProactiveFeedbackInstance {
  // ── Состояние (замыкание) ─────────────────────────────────────────
  const storageDir = workspaceDir ? join(workspaceDir, ".brainagent", "proactive-feedback") : "";
  const stateFile = storageDir ? join(storageDir, "state.json") : "";
  let config: BrainAgentConfig["proactiveFeedback"] | null = cfg?.proactiveFeedback ?? null;
  const logger = log;
  const domainFeedback = new Map<string, DomainFeedback>();

  // ── Персистентность ───────────────────────────────────────────────

  function loadState(): void {
    if (!stateFile) return;
    try {
      if (!existsSync(stateFile)) return;
      const raw = JSON.parse(readFileSync(stateFile, "utf-8")) as PersistedState;
      for (const [domain, entry] of Object.entries(raw.domains ?? {})) {
        domainFeedback.set(domain, {
          rejections: entry.rejections ?? 0,
          accepts: entry.accepts ?? 0,
          suppressionScore: entry.suppressionScore ?? 0,
          lastRejectionTime: entry.lastRejectionTime ?? 0,
          lastHits: entry.lastHits ?? [],
          lastDecayTime: entry.lastDecayTime ?? Date.now(),
        });
      }
    } catch {
      // Повреждённый файл — начинаем с чистого состояния
    }
  }

  function persistState(): void {
    if (!stateFile) return;
    // Debounce + ленивый сериализатор: на диск уходит самое свежее состояние
    schedulePersist(stateFile, () => {
      const domains: Record<string, DomainFeedback> = {};
      for (const [domain, entry] of domainFeedback) {
        domains[domain] = entry;
      }
      const state: PersistedState = { domains };
      return JSON.stringify(state, null, 2);
    });
  }

  // ── Внутренняя механика ───────────────────────────────────────────

  function getOrCreateEntry(domain: string): DomainFeedback {
    let entry = domainFeedback.get(domain);
    if (!entry) {
      entry = {
        rejections: 0,
        accepts: 0,
        suppressionScore: 0,
        lastRejectionTime: 0,
        lastHits: [],
        lastDecayTime: Date.now(),
      };
      domainFeedback.set(domain, entry);
    }
    return entry;
  }

  /** On-demand затухание счётчиков подавления (как у драйвов). */
  function applyDecay(): void {
    if (!config) return;
    const now = Date.now();
    for (const entry of domainFeedback.values()) {
      const elapsedMs = now - entry.lastDecayTime;
      // Затухание суточное — чаще раза в минуту не пересчитываем:
      // иначе floating-point дрейф ломает сравнение score с порогом
      if (elapsedMs < 60_000) continue;
      const days = elapsedMs / (24 * 60 * 60 * 1000);
      entry.suppressionScore = Math.max(0, entry.suppressionScore - days * config.decayPerDay);
      entry.lastDecayTime = now;
    }
  }

  function enforceDomainLimit(): void {
    if (!config || domainFeedback.size <= config.maxTrackedDomains) return;
    // Выбрасываем домены с наименьшим score
    const sorted = [...domainFeedback.entries()].sort(
      (a, b) => a[1].suppressionScore - b[1].suppressionScore,
    );
    while (domainFeedback.size > config.maxTrackedDomains) {
      const oldest = sorted.shift();
      if (!oldest) break;
      domainFeedback.delete(oldest[0]);
    }
  }

  // ── Ядро: реакция на проактивное сообщение ────────────────────────

  function recordProactiveReaction(domain: string, reactionText: string): FeedbackSignal {
    if (!config) return "neutral";

    const classification = classifyFeedback(reactionText);
    const signal = classification.signal;

    applyDecay();
    const entry = getOrCreateEntry(domain);

    if (signal === "rejection") {
      entry.rejections += 1;
      entry.suppressionScore += config.rejectionStep;
      entry.lastRejectionTime = Date.now();
      entry.lastHits = classification.hits;
    } else if (signal === "negative") {
      entry.rejections += 1;
      entry.suppressionScore += config.negativeStep;
      entry.lastRejectionTime = Date.now();
      entry.lastHits = classification.hits;
    } else if (signal === "positive") {
      entry.accepts += 1;
      entry.suppressionScore = Math.max(0, entry.suppressionScore - config.positiveStep);
    }
    // neutral: контакт состоялся, но без оценки — ничего не меняем

    entry.lastDecayTime = Date.now();
    enforceDomainLimit();

    bus.emitSync("proactive:reaction", {
      domain,
      signal,
      hits: classification.hits,
    });

    if (signal === "rejection" || signal === "negative") {
      logger?.info(
        `BrainAgent ProactiveFeedback: «не зашло» in ${domain} ` +
          `(score=${entry.suppressionScore.toFixed(2)}, hits=${classification.hits.join(",")})`,
      );
    }

    persistState();
    return signal;
  }

  // ── Подавление тем ────────────────────────────────────────────────

  /** Подавлен ли домен: score выше порога и кулдаун с последнего отвержения не истёк. */
  function isDomainSuppressed(domain: string): boolean {
    if (!config) return false;
    applyDecay();
    const entry = domainFeedback.get(domain);
    if (!entry) return false;
    if (entry.suppressionScore < config.suppressionThreshold) return false;
    return Date.now() - entry.lastRejectionTime < config.cooldownMs;
  }

  /** Человекочитаемые подсказки по подавленным доменам (для проактивного фрейма). */
  function getSuppressedDomainHints(): string[] {
    if (!config) return [];
    const hints: string[] = [];
    for (const [domain] of domainFeedback) {
      if (isDomainSuppressed(domain)) {
        const entry = domainFeedback.get(domain);
        if (!entry) continue;
        hints.push(
          `тема «${domain}» отвергнута ${entry.rejections} раз(а)` +
            (entry.lastHits.length > 0 ? ` (${entry.lastHits.join(", ")})` : ""),
        );
      }
    }
    return hints;
  }

  // ── Статистика (для /brainagent neuro) ────────────────────────────

  function getStats() {
    applyDecay();
    let totalRejections = 0;
    let totalAccepts = 0;
    const suppressedDomains: string[] = [];
    for (const [domain, entry] of domainFeedback) {
      totalRejections += entry.rejections;
      totalAccepts += entry.accepts;
      if (isDomainSuppressed(domain)) suppressedDomains.push(domain);
    }
    return {
      trackedDomains: domainFeedback.size,
      totalRejections,
      totalAccepts,
      suppressedDomains,
    };
  }

  function stop(): void {
    if (stateFile) flushPersist(stateFile);
    logger?.info("BrainAgent ProactiveFeedback: stopped.");
  }

  // ── Init (disk) ───────────────────────────────────────────────────

  if (storageDir) {
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }
    // Отложенная запись прежнего экземпляра больше не актуальна
    cancelPersist(stateFile);
    loadState();
    if (config) {
      logger?.info(
        `BrainAgent ProactiveFeedback: initialized (threshold=${config.suppressionThreshold}, ` +
          `cooldown=${config.cooldownMs}ms, decay=${config.decayPerDay}/day, ` +
          `tracked=${domainFeedback.size})`,
      );
    }
  }

  return {
    recordProactiveReaction,
    isDomainSuppressed,
    getSuppressedDomainHints,
    getStats,
    stop,
  };
}

// ── Обёртки над активным инстансом (обратная совместимость) ────────

let active: ProactiveFeedbackInstance | null = null;

function current(): ProactiveFeedbackInstance {
  if (!active) active = createProactiveFeedback("");
  return active;
}

export function initProactiveFeedback(
  workspaceDir: string,
  cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
): void {
  // Пере-инициализация: новый инстанс сам отменит отложенную запись
  // того же пути (cancelPersist внутри фабрики) — как в оригинале.
  active = createProactiveFeedback(workspaceDir, cfg, log);
}

export function stopProactiveFeedback(): void {
  active?.stop();
  active = null;
}

export function recordProactiveReaction(domain: string, reactionText: string): FeedbackSignal {
  return current().recordProactiveReaction(domain, reactionText);
}

export function isDomainSuppressed(domain: string): boolean {
  return current().isDomainSuppressed(domain);
}

export function getSuppressedDomainHints(): string[] {
  return current().getSuppressedDomainHints();
}

export function getProactiveFeedbackStats(): {
  trackedDomains: number;
  totalRejections: number;
  totalAccepts: number;
  suppressedDomains: string[];
} {
  return current().getStats();
}
