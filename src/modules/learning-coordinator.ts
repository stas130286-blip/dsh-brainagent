/**
 * Learning Coordinator — Meta-cognitive oversight of all brain module learning.
 *
 * In the human brain, the anterior cingulate cortex (ACC) and dorsolateral
 * prefrontal cortex (dlPFC) work together to monitor cognitive performance,
 * detect errors, and adjust strategies. This is "thinking about thinking" —
 * metacognition.
 *
 * The Learning Coordinator:
 *
 * 1. MONITORS — tracks performance metrics for every brain module
 * 2. DETECTS  — finds cross-module patterns, correlations, and anomalies
 * 3. ADJUSTS  — modulates learning rates based on dopamine/acetylcholine
 * 4. REPORTS  — generates learning cycle reports and actionable insights
 *
 * Without this module, each brain module learns in isolation (like a
 * student studying alone). With it, the system learns as a TEAM —
 * the coordinator spots when one module's output hurts another,
 * when two modules consistently succeed together, and when the
 * system needs to change strategy.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bus } from "./event-bus.ts";
import type {
  BrainAgentConfig,
  CapabilityAssessment,
  DomainPerformance,
  DopamineSignal,
  LearningCycleReport,
  LearningInsight,
  MessageDomain,
  ModulePerformanceMetrics,
} from "./types.ts";

// ── State ───────────────────────────────────────────────────────────

let storageDir = "";

/** Per-module metrics, accumulated over time */
const moduleMetrics = new Map<
  string,
  {
    recentRewards: number[];
    activationCount: number;
    errorCount: number;
    totalReward: number;
  }
>();

/** Recent learning cycle reports (ring buffer) */
let cycleHistory: LearningCycleReport[] = [];

/** Discovered insights that are still actionable */
let activeInsights: LearningInsight[] = [];

/** Recurring issue tracker for cerebellum feedback loop */
const recurringIssues = new Map<string, { count: number; lastSeen: number }>();

/** Cycle counter */
let cycleCount = 0;
let revisionCounter = 0;

/** Unsubscribe functions for event listeners */
let coordinatorUnsubs: Array<() => void> = [];

/** Config reference */
let currentConfig: BrainAgentConfig | null = null;

// ── v2 State: Domain-level performance tracking ─────────────────────

/** Per-domain performance tracking */
const domainPerformance = new Map<string, DomainPerformance>();

/** Domain performance trend window */
const DOMAIN_TREND_WINDOW = 20;

// ── Initialization ──────────────────────────────────────────────────

export function initLearningCoordinator(workspaceDir: string, config: BrainAgentConfig): void {
  storageDir = join(workspaceDir, ".brainagent", "learning");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  currentConfig = config;

  // Reset in-memory state before loading from disk
  moduleMetrics.clear();
  cycleHistory = [];
  activeInsights = [];
  cycleCount = 0;
  domainPerformance.clear();
  recurringIssues.clear();

  loadState();

  // Clean up any previous listeners before setting up new ones
  for (const unsub of coordinatorUnsubs) unsub();
  coordinatorUnsubs = [];

  setupEventListeners();
}

function loadState(): void {
  if (!storageDir) return;
  try {
    const path = join(storageDir, "coordinator.json");
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, "utf-8")) as {
        moduleMetrics: Record<
          string,
          {
            recentRewards: number[];
            activationCount: number;
            errorCount: number;
            totalReward: number;
          }
        >;
        cycleHistory: LearningCycleReport[];
        activeInsights: LearningInsight[];
        cycleCount: number;
        domainPerformance?: Record<string, DomainPerformance>;
      };
      for (const [key, val] of Object.entries(data.moduleMetrics ?? {})) {
        moduleMetrics.set(key, val);
      }
      cycleHistory = data.cycleHistory ?? [];
      activeInsights = data.activeInsights ?? [];
      cycleCount = data.cycleCount ?? 0;
      // v2: load domain performance
      if (data.domainPerformance) {
        for (const [key, val] of Object.entries(data.domainPerformance)) {
          domainPerformance.set(key, val);
        }
      }
      // v3: load recurring issues
      if ((data as Record<string, unknown>).recurringIssues) {
        for (const [key, val] of Object.entries(
          (data as Record<string, unknown>).recurringIssues as Record<
            string,
            { count: number; lastSeen: number }
          >,
        )) {
          recurringIssues.set(key, val);
        }
      }
    }
  } catch {
    // Fresh start
  }
}

function persistState(): void {
  if (!storageDir) return;
  try {
    const metricsObj: Record<string, unknown> = {};
    for (const [key, val] of moduleMetrics) {
      metricsObj[key] = val;
    }
    writeFileSync(
      join(storageDir, "coordinator.json"),
      JSON.stringify(
        {
          moduleMetrics: metricsObj,
          cycleHistory: cycleHistory.slice(-50), // Keep last 50 cycles
          activeInsights: activeInsights.slice(-20),
          cycleCount,
          domainPerformance: Object.fromEntries(domainPerformance),
          recurringIssues: Object.fromEntries(recurringIssues),
        },
        null,
        2,
      ),
      "utf-8",
    );
  } catch {
    /* non-critical */
  }
}

// ── Event Listeners ─────────────────────────────────────────────────

function setupEventListeners(): void {
  // Listen to dopamine rewards to track per-module performance
  coordinatorUnsubs.push(
    bus.on("dopamine:reward", (signal: DopamineSignal) => {
      processRewardSignal(signal);
    }),
  );

  // Listen to cerebellum validation for error tracking
  coordinatorUnsubs.push(
    bus.on("cerebellum:validated", (data) => {
      if (!data.passed) {
        // Track which modules might be responsible
        for (const issue of data.issues) {
          const implicated = identifyImplicatedModule(issue);
          if (implicated) {
            const metrics = getOrCreateMetrics(implicated);
            metrics.errorCount++;
          }
        }
      }
    }),
  );

  // Listen to consolidation events for learning about memory health
  coordinatorUnsubs.push(
    bus.on("dream:consolidation-complete", (data) => {
      if (data.contradictions > 0) {
        // Deduplicate: only add if no recent similar insight exists
        const hasRecent = activeInsights.some(
          (i) =>
            i.source === "hippocampus" &&
            i.target === "semantic-extractor" &&
            i.description.includes("contradictions"),
        );
        if (!hasRecent) {
          activeInsights.push({
            type: "anomaly",
            source: "hippocampus",
            target: "semantic-extractor",
            description: `${data.contradictions} contradictions found during consolidation — extraction quality may need improvement`,
            confidence: 0.7,
            actionable: true,
          });
        }
      }
    }),
    // Track fact revisions — high revision rate signals unstable extraction
    bus.on("hippocampus:fact-revised", () => {
      revisionCounter++;
      if (revisionCounter >= 5) {
        const hasRecent = activeInsights.some(
          (i) =>
            i.source === "hippocampus" &&
            i.target === "semantic-extractor" &&
            i.description.includes("revision"),
        );
        if (!hasRecent) {
          activeInsights.push({
            type: "pattern",
            source: "hippocampus",
            target: "semantic-extractor",
            description: `${revisionCounter} fact revisions detected — semantic memory is actively reconsolidating`,
            confidence: 0.6,
            actionable: false,
          });
        }
        revisionCounter = 0;
      }
    }),
  );
}

// ── Core: Process reward signal from dopamine system ────────────────

function processRewardSignal(signal: DopamineSignal): void {
  cycleCount++;

  // Update per-module metrics
  for (const mod of signal.participatingModules) {
    const metrics = getOrCreateMetrics(mod);
    const moduleCredit = signal.creditAssignment[mod] ?? 0;
    const moduleReward = signal.reward * moduleCredit;

    metrics.recentRewards.push(moduleReward);
    if (metrics.recentRewards.length > 100) {
      metrics.recentRewards = metrics.recentRewards.slice(-100);
    }
    metrics.activationCount++;
    metrics.totalReward += moduleReward;
  }

  // Generate insights periodically
  const config = currentConfig;
  if (config && cycleCount >= config.learning.minCyclesForInsights && cycleCount % 5 === 0) {
    generateInsights(config);
  }

  // Generate cycle report every 10 cycles
  if (cycleCount % 10 === 0) {
    generateCycleReport(signal);
  }

  persistState();
}

// ── Insight Generation ──────────────────────────────────────────────

function generateInsights(config: BrainAgentConfig): void {
  const window = config.learning.trendWindowSize;
  const newInsights: LearningInsight[] = [];

  // Analyze per-module trends
  for (const [modName, metrics] of moduleMetrics) {
    const recent = metrics.recentRewards.slice(-window);
    if (recent.length < 10) continue;

    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));

    const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

    const trend = secondAvg - firstAvg;

    // Detect degrading modules
    if (trend < -0.15 && secondAvg < 0.3) {
      newInsights.push({
        type: "anomaly",
        source: modName,
        target: "system",
        description: `Module "${modName}" performance degrading (${(firstAvg * 100).toFixed(0)}% → ${(secondAvg * 100).toFixed(0)}%)`,
        confidence: Math.min(0.9, 0.5 + Math.abs(trend)),
        actionable: true,
      });
    }

    // Detect high-error modules
    if (metrics.errorCount > 0 && metrics.activationCount > 10) {
      const errorRate = metrics.errorCount / metrics.activationCount;
      if (errorRate > 0.3) {
        newInsights.push({
          type: "anomaly",
          source: modName,
          target: "cerebellum",
          description: `Module "${modName}" has ${(errorRate * 100).toFixed(0)}% error rate — may need tuning`,
          confidence: 0.8,
          actionable: true,
        });
      }
    }
  }

  // Cross-module correlation analysis
  const moduleNames = Array.from(moduleMetrics.keys());
  for (let i = 0; i < moduleNames.length; i++) {
    for (let j = i + 1; j < moduleNames.length; j++) {
      const metricsA = moduleMetrics.get(moduleNames[i])!;
      const metricsB = moduleMetrics.get(moduleNames[j])!;

      const len = Math.min(metricsA.recentRewards.length, metricsB.recentRewards.length, window);
      if (len < 10) continue;

      const rewardsA = metricsA.recentRewards.slice(-len);
      const rewardsB = metricsB.recentRewards.slice(-len);

      const correlation = computeCorrelation(rewardsA, rewardsB);

      // Strong positive correlation: modules work well together
      if (correlation > 0.7) {
        newInsights.push({
          type: "correlation",
          source: moduleNames[i],
          target: moduleNames[j],
          description: `Modules "${moduleNames[i]}" and "${moduleNames[j]}" are strongly correlated (r=${correlation.toFixed(2)}) — they succeed/fail together`,
          confidence: correlation,
          actionable: false,
        });
      }

      // Strong negative correlation: one hurts the other
      if (correlation < -0.5) {
        newInsights.push({
          type: "correlation",
          source: moduleNames[i],
          target: moduleNames[j],
          description: `Modules "${moduleNames[i]}" and "${moduleNames[j]}" are anti-correlated (r=${correlation.toFixed(2)}) — when one succeeds, the other struggles`,
          confidence: Math.abs(correlation),
          actionable: true,
        });
      }
    }
  }

  // Deduplicate insights (don't add same insight twice)
  for (const insight of newInsights) {
    const exists = activeInsights.some(
      (existing) =>
        existing.source === insight.source &&
        existing.target === insight.target &&
        existing.type === insight.type,
    );
    if (!exists) {
      activeInsights.push(insight);
      bus.emitSync("learning:insight-discovered", insight);
    }
  }

  // Prune old insights
  if (activeInsights.length > 30) {
    activeInsights = activeInsights.slice(-20);
  }
}

// ── Cycle Report Generation ─────────────────────────────────────────

function generateCycleReport(lastSignal: DopamineSignal): void {
  const perModuleMetrics: Record<string, ModulePerformanceMetrics> = {};

  for (const [modName, metrics] of moduleMetrics) {
    const recent = metrics.recentRewards.slice(-20);
    const avgReward = recent.length > 0 ? recent.reduce((s, v) => s + v, 0) / recent.length : 0;

    // Compute trend
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    const firstAvg =
      firstHalf.length > 0 ? firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length : 0;
    const secondAvg =
      secondHalf.length > 0 ? secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length : 0;
    const trendDiff = secondAvg - firstAvg;

    let trend: "improving" | "stable" | "degrading" = "stable";
    if (trendDiff > 0.1) trend = "improving";
    else if (trendDiff < -0.1) trend = "degrading";

    const errorRate =
      metrics.activationCount > 0 ? metrics.errorCount / metrics.activationCount : 0;

    perModuleMetrics[modName] = {
      activations: metrics.activationCount,
      averageReward: avgReward,
      influence: lastSignal.creditAssignment[modName] ?? 0,
      errorRate,
      trend,
    };
  }

  // System-wide metrics
  const allRewards: number[] = [];
  for (const metrics of moduleMetrics.values()) {
    allRewards.push(...metrics.recentRewards.slice(-20));
  }
  const systemAvgReward =
    allRewards.length > 0 ? allRewards.reduce((s, v) => s + v, 0) / allRewards.length : 0;

  // Learning efficiency: how fast we adapt (ratio of improving modules)
  const moduleCount = Object.keys(perModuleMetrics).length;
  const improvingCount = Object.values(perModuleMetrics).filter(
    (m) => m.trend === "improving",
  ).length;
  const learningEfficiency = moduleCount > 0 ? improvingCount / moduleCount : 0;

  // Adaptation rate: how quickly expected reward changes
  const adaptationRate = cycleCount > 10 ? 0.5 + systemAvgReward * 0.5 : 0.5;

  const report: LearningCycleReport = {
    timestamp: Date.now(),
    moduleMetrics: perModuleMetrics,
    systemMetrics: {
      averageReward: systemAvgReward,
      learningEfficiency,
      adaptationRate,
    },
    insights: activeInsights.filter((i) => i.actionable).slice(-5),
  };

  cycleHistory.push(report);
  if (cycleHistory.length > 100) {
    cycleHistory = cycleHistory.slice(-50);
  }

  bus.emit("learning:cycle-complete", report);
}

// ── Helpers ─────────────────────────────────────────────────────────

function getOrCreateMetrics(moduleName: string): {
  recentRewards: number[];
  activationCount: number;
  errorCount: number;
  totalReward: number;
} {
  let metrics = moduleMetrics.get(moduleName);
  if (!metrics) {
    metrics = {
      recentRewards: [],
      activationCount: 0,
      errorCount: 0,
      totalReward: 0,
    };
    moduleMetrics.set(moduleName, metrics);
  }
  return metrics;
}

function identifyImplicatedModule(issue: string): string | undefined {
  const lower = issue.toLowerCase();
  if (lower.includes("language") || lower.includes("mismatch")) return "mirrorNeurons";
  if (lower.includes("brief") || lower.includes("verbose") || lower.includes("proportional"))
    return "prefrontalCortex";
  if (lower.includes("empathy") || lower.includes("tone")) return "amygdala";
  if (lower.includes("sensitive") || lower.includes("data")) return "cerebellum";
  if (lower.includes("completeness") || lower.includes("question")) return "prefrontalCortex";
  if (lower.includes("relevance") || lower.includes("address")) return "hippocampus";
  return undefined;
}

/** Pearson correlation between two arrays */
function computeCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;

  const arrA = a.slice(-n);
  const arrB = b.slice(-n);

  const meanA = arrA.reduce((s, v) => s + v, 0) / n;
  const meanB = arrB.reduce((s, v) => s + v, 0) / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;

  for (let i = 0; i < n; i++) {
    const dA = arrA[i] - meanA;
    const dB = arrB[i] - meanB;
    cov += dA * dB;
    varA += dA * dA;
    varB += dB * dB;
  }

  const denom = Math.sqrt(varA * varB);
  if (denom === 0) return 0;
  return cov / denom;
}

// ── Public API for diagnostics ──────────────────────────────────────

export function getLearningStats(): {
  cycleCount: number;
  moduleCount: number;
  activeInsights: number;
  recentInsights: LearningInsight[];
  modulePerformance: Record<string, { avgReward: number; errorRate: number; trend: string }>;
} {
  const modulePerf: Record<string, { avgReward: number; errorRate: number; trend: string }> = {};

  for (const [name, metrics] of moduleMetrics) {
    const recent = metrics.recentRewards.slice(-20);
    const avgReward = recent.length > 0 ? recent.reduce((s, v) => s + v, 0) / recent.length : 0;
    const errorRate =
      metrics.activationCount > 0 ? metrics.errorCount / metrics.activationCount : 0;

    // Trend
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    const firstAvg =
      firstHalf.length > 0 ? firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length : 0;
    const secondAvg =
      secondHalf.length > 0 ? secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length : 0;
    const diff = secondAvg - firstAvg;
    const trend = diff > 0.1 ? "improving" : diff < -0.1 ? "degrading" : "stable";

    modulePerf[name] = { avgReward, errorRate, trend };
  }

  return {
    cycleCount,
    moduleCount: moduleMetrics.size,
    activeInsights: activeInsights.length,
    recentInsights: activeInsights.slice(-5),
    modulePerformance: modulePerf,
  };
}

/** Get the latest cycle report */
export function getLatestCycleReport(): LearningCycleReport | undefined {
  return cycleHistory.length > 0 ? cycleHistory[cycleHistory.length - 1] : undefined;
}

/**
 * Build a context string about the learning state for the LLM.
 * Injected into prompts when the system has actionable insights.
 */
export function buildLearningContext(): string | undefined {
  const actionable = activeInsights.filter((i) => i.actionable && i.confidence > 0.6);
  if (actionable.length === 0) return undefined;

  const lines: string[] = [
    "## System Learning Insights (Meta-Cognition)",
    "The following patterns have been detected in recent interactions:",
  ];

  for (const insight of actionable.slice(0, 3)) {
    lines.push(`- [${insight.type}] ${insight.description}`);
  }

  return lines.join("\n");
}

// ── Autonomy: Recurring Issue Detection ─────────────────────────────

/**
 * Record a recurring cerebellum issue. When the same issue type occurs 3+ times,
 * generates a learning insight that gets injected into future prompts.
 */
export function recordRecurringIssue(issueType: string): LearningInsight | undefined {
  const key = issueType.toLowerCase().trim();
  if (!key) return undefined;

  const existing = recurringIssues.get(key) ?? { count: 0, lastSeen: 0 };
  existing.count++;
  existing.lastSeen = Date.now();
  recurringIssues.set(key, existing);

  if (existing.count < 3) {
    persistState();
    return undefined;
  }

  // Deduplicate against existing insights
  const alreadyExists = activeInsights.some(
    (i) =>
      i.source === "cerebellum-feedback" && i.description.toLowerCase().includes(key.slice(0, 30)),
  );
  if (alreadyExists) return undefined;

  const insight: LearningInsight = {
    type: "pattern",
    source: "cerebellum-feedback",
    target: "system",
    description: `Recurring problem (${existing.count}x): ${issueType}. Adjust approach for this type of issue.`,
    confidence: Math.min(0.9, 0.5 + existing.count * 0.1),
    actionable: true,
  };

  activeInsights.push(insight);
  if (activeInsights.length > 30) {
    activeInsights = activeInsights.slice(-20);
  }

  persistState();

  bus.emitSync("learning:insight-discovered", insight);
  bus.emitSync("autonomy:learning-pattern-detected", {
    issueType: key,
    occurrences: existing.count,
    insight: insight.description,
  });

  return insight;
} // ── v2: Domain Performance Tracking ─────────────────────────────────

/**
 * Record a reward for a specific domain interaction.
 * Maintains per-domain running averages, trend detection,
 * and error correlation tracking.
 */
export function recordDomainPerformance(
  domain: MessageDomain,
  reward: number,
  errorIssues: string[] = [],
): void {
  let perf = domainPerformance.get(domain);
  if (!perf) {
    perf = {
      domain,
      cycleCount: 0,
      avgReward: 0,
      recentRewards: [],
      trend: "stable",
      errorCorrelations: [],
    };
    domainPerformance.set(domain, perf);
  }

  perf.cycleCount++;
  perf.recentRewards.push(reward);
  if (perf.recentRewards.length > 100) {
    perf.recentRewards = perf.recentRewards.slice(-100);
  }

  // Running average
  perf.avgReward = perf.avgReward + (reward - perf.avgReward) / perf.cycleCount;

  // Trend detection from recent window
  if (perf.recentRewards.length >= DOMAIN_TREND_WINDOW) {
    const recent = perf.recentRewards.slice(-DOMAIN_TREND_WINDOW);
    const firstHalf = recent.slice(0, DOMAIN_TREND_WINDOW / 2);
    const secondHalf = recent.slice(DOMAIN_TREND_WINDOW / 2);
    const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;
    perf.trend = diff > 0.1 ? "improving" : diff < -0.1 ? "degrading" : "stable";
  }

  // Track error correlations
  if (errorIssues.length > 0) {
    for (const issue of errorIssues) {
      if (!perf.errorCorrelations.includes(issue)) {
        perf.errorCorrelations.push(issue);
        if (perf.errorCorrelations.length > 20) {
          perf.errorCorrelations = perf.errorCorrelations.slice(-20);
        }
      }
    }
  }

  persistState();

  bus.emitSync("learning:domain-performance-updated", {
    domain,
    avgReward: perf.avgReward,
    trend: perf.trend,
  });
}

/**
 * Assess the system's capability for a given domain.
 * Returns a confidence level and reasoning based on tracked performance.
 */
export function assessCapability(domain: MessageDomain): CapabilityAssessment {
  const perf = domainPerformance.get(domain);

  if (!perf || perf.cycleCount < 5) {
    return {
      domain,
      confidenceLevel: 0.5,
      reasoning: `Insufficient data for "${domain}" domain (${perf?.cycleCount ?? 0} cycles). Using default confidence.`,
    };
  }

  const confidenceLevel = Math.max(0, Math.min(1, perf.avgReward));
  const parts: string[] = [];

  parts.push(`Based on ${perf.cycleCount} interactions`);
  parts.push(`avg reward: ${(perf.avgReward * 100).toFixed(0)}%`);
  parts.push(`trend: ${perf.trend}`);

  if (perf.errorCorrelations.length > 0) {
    parts.push(`common issues: ${perf.errorCorrelations.slice(-3).join(", ")}`);
  }

  bus.emitSync("learning:capability-assessed", {
    domain,
    confidence: confidenceLevel,
    reasoning: parts.join("; "),
  });

  return {
    domain,
    confidenceLevel,
    reasoning: parts.join("; "),
  };
}

/**
 * Get domain performance data for a specific domain.
 */
export function getDomainPerformance(domain: MessageDomain): DomainPerformance | undefined {
  return domainPerformance.get(domain);
}

/**
 * Build a capability context injection for the LLM prompt.
 * Summarizes the system's self-assessed strengths and weaknesses.
 */
export function buildCapabilityContext(currentDomain?: MessageDomain): string | undefined {
  if (domainPerformance.size === 0) return undefined;

  const weak: string[] = [];
  const strong: string[] = [];

  for (const [domain, perf] of domainPerformance) {
    if (perf.cycleCount < 10) continue;
    if (perf.avgReward < 0.3) {
      weak.push(`${domain} (${(perf.avgReward * 100).toFixed(0)}%)`);
    } else if (perf.avgReward > 0.6) {
      strong.push(`${domain} (${(perf.avgReward * 100).toFixed(0)}%)`);
    }
  }

  if (weak.length === 0 && strong.length === 0) return undefined;

  const lines = ["## Domain Capability Assessment (Learning Coordinator v2)"];

  if (strong.length > 0) {
    lines.push(`Strong domains: ${strong.join(", ")}`);
  }
  if (weak.length > 0) {
    lines.push(`Needs improvement: ${weak.join(", ")}`);
  }

  // Add specific advice for current domain if it's weak
  if (currentDomain) {
    const perf = domainPerformance.get(currentDomain);
    if (perf && perf.cycleCount >= 10 && perf.avgReward < 0.3) {
      lines.push(
        `Current domain "${currentDomain}" is below average — take extra care with accuracy.`,
      );
    }
  }

  return lines.join("\n");
}
