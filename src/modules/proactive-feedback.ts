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

// ── Состояние модуля ────────────────────────────────────────────────

let storageDir = "";
let stateFile = "";
let config: BrainAgentConfig["proactiveFeedback"] | null = null;
let logger: { info: (msg: string) => void } | undefined;
let domainFeedback = new Map<string, DomainFeedback>();

// ── Инициализация ───────────────────────────────────────────────────

export function initProactiveFeedback(
  workspaceDir: string,
  cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
): void {
  storageDir = join(workspaceDir, ".brainagent", "proactive-feedback");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  stateFile = join(storageDir, "state.json");

  config = cfg.proactiveFeedback;
  logger = log;

  // Сброс состояния в памяти (пере-инициализация)
  domainFeedback = new Map();

  // Отложенная запись прежнего экземпляра больше не актуальна
  cancelPersist(stateFile);
  loadState();

  logger.info(
    `BrainAgent ProactiveFeedback: initialized (threshold=${config.suppressionThreshold}, ` +
      `cooldown=${config.cooldownMs}ms, decay=${config.decayPerDay}/day, ` +
      `tracked=${domainFeedback.size})`,
  );
}

export function stopProactiveFeedback(): void {
  flushPersist(stateFile);
  logger?.info("BrainAgent ProactiveFeedback: stopped.");
}

// ── Ядро: реакция на проактивное сообщение ──────────────────────────

/**
 * Записать реакцию пользователя на проактивное сообщение.
 * Возвращает классифицированный сигнал (для эпизода в index.ts).
 */
export function recordProactiveReaction(
  domain: string,
  reactionText: string,
): FeedbackSignal {
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

// ── Подавление тем ──────────────────────────────────────────────────

/** Подавлен ли домен: score выше порога и кулдаун с последнего отвержения не истёк. */
export function isDomainSuppressed(domain: string): boolean {
  if (!config) return false;
  applyDecay();
  const entry = domainFeedback.get(domain);
  if (!entry) return false;
  if (entry.suppressionScore < config.suppressionThreshold) return false;
  return Date.now() - entry.lastRejectionTime < config.cooldownMs;
}

/** Человекочитаемые подсказки по подавленным доменам (для проактивного фрейма). */
export function getSuppressedDomainHints(): string[] {
  if (!config) return [];
  const hints: string[] = [];
  for (const [domain, entry] of domainFeedback) {
    if (isDomainSuppressed(domain)) {
      hints.push(
        `тема «${domain}» отвергнута ${entry.rejections} раз(а)` +
          (entry.lastHits.length > 0 ? ` (${entry.lastHits.join(", ")})` : ""),
      );
    }
  }
  return hints;
}

// ── Статистика (для /brainagent neuro) ──────────────────────────────

export function getProactiveFeedbackStats(): {
  trackedDomains: number;
  totalRejections: number;
  totalAccepts: number;
  suppressedDomains: string[];
} {
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

// ── Внутренняя механика ─────────────────────────────────────────────

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

// ── Персистентность ─────────────────────────────────────────────────

function loadState(): void {
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
