/**
 * Agent Identity Memory — Per-domain self-knowledge and capability tracking.
 *
 * Maintains a long-term record of how well the system performs across
 * different domains. Over time, it builds a self-model: "I'm strong
 * in technical (82%) but weaker in emotional (45%)." This self-knowledge
 * is injected into prompts for better calibration.
 *
 * v0.7.0: фабрика createAgentIdentity(workspaceDir, config?) —
 * capabilities, снапшоты, уроки и автобиографическая память в замыкании
 * инстанса; свободные функции — обёртки над общим ленивым инстансом.
 * Чистая buildMemorySelfKnowledgeContext остаётся на уровне модуля.
 * Без workspaceDir фабрика создаёт detached-инстанс без персистентности —
 * ровно поведение модуля до init.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bus } from "./event-bus.ts";
import type {
  AutobiographicalMemory,
  BrainAgentConfig,
  CapabilitySnapshot,
  DomainCapability,
  EmotionLabel,
  MessageComplexity,
  MessageDomain,
} from "./types.ts";

// ── Instance type ───────────────────────────────────────────────────

export type AgentIdentityInstance = {
  recordDomainOutcome(domain: MessageDomain, reward: number, complexity: MessageComplexity): void;
  buildIdentityContext(domain: MessageDomain): string | undefined;
  getCapabilities(): Record<string, DomainCapability>;
  getAgentIdentityStats(): {
    totalCycles: number;
    snapshotCount: number;
    lessonsCount: number;
    autobiographicalCount: number;
    capabilities: Record<string, { avgReward: number; trend: string }>;
  };
  recordSignificantExperience(
    experience: string,
    emotion: EmotionLabel,
    intensity: number,
    reward: number,
    domain: MessageDomain,
  ): AutobiographicalMemory | undefined;
  getLifeNarrative(): string;
  buildAutobiographyContext(domain: MessageDomain): string | undefined;
  getAutobiographicalMemories(): AutobiographicalMemory[];
};

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Create an agent-identity instance with isolated state.
 * Without workspaceDir the instance has no persistence (detached) —
 * identical to pre-init module behavior.
 */
export function createAgentIdentity(
  workspaceDir: string,
  config?: BrainAgentConfig,
): AgentIdentityInstance {
  // ── State (closure) ─────────────────────────────────────────────
  const storageDir = workspaceDir ? join(workspaceDir, ".brainagent", "identity") : "";

  const icfg = config?.agentIdentity;
  const snapshotInterval = icfg?.snapshotInterval ?? 100;
  const maxSnapshots = icfg?.maxSnapshots ?? 50;
  const maxAutobioMemories = icfg?.maxAutobiographicalMemories ?? 100;
  const significantRewardThreshold = icfg?.significantRewardThreshold ?? 0.8;
  const significantEmotionThreshold = icfg?.significantEmotionThreshold ?? 0.7;

  let capabilities: Record<string, DomainCapability> = {};
  let snapshots: CapabilitySnapshot[] = [];
  let lessonsLearned: string[] = [];
  let totalCycles = 0;
  let autobiographicalMemories: AutobiographicalMemory[] = [];

  // ── Persistence ─────────────────────────────────────────────────

  function loadState(): void {
    if (!storageDir) return;
    try {
      const path = join(storageDir, "state.json");
      if (existsSync(path)) {
        const data = JSON.parse(readFileSync(path, "utf-8")) as {
          capabilities: Record<string, DomainCapability>;
          snapshots: CapabilitySnapshot[];
          lessonsLearned: string[];
          totalCycles: number;
          autobiographicalMemories?: AutobiographicalMemory[];
        };
        capabilities = data.capabilities ?? {};
        snapshots = data.snapshots ?? [];
        lessonsLearned = data.lessonsLearned ?? [];
        totalCycles = data.totalCycles ?? 0;
        autobiographicalMemories = (data.autobiographicalMemories ?? []).slice(-maxAutobioMemories);
      }
    } catch {
      /* fresh start */
    }
  }

  function persistState(): void {
    if (!storageDir) return;
    try {
      writeFileSync(
        join(storageDir, "state.json"),
        JSON.stringify(
          {
            capabilities,
            snapshots: snapshots.slice(-maxSnapshots),
            lessonsLearned: lessonsLearned.slice(-30),
            totalCycles,
            autobiographicalMemories: autobiographicalMemories.slice(-maxAutobioMemories),
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

  // ── Core API ────────────────────────────────────────────────────

  /**
   * Record the outcome of an interaction for a specific domain.
   * Updates running averages, detects trends, and creates snapshots.
   */
  function recordDomainOutcome(
    domain: MessageDomain,
    reward: number,
    _complexity: MessageComplexity,
  ): void {
    totalCycles++;

    let cap = capabilities[domain];
    if (!cap) {
      cap = {
        domain,
        avgReward: 0,
        totalCycles: 0,
        trend: "stable",
        bestStrategy: "",
      };
      capabilities[domain] = cap;
    }

    // Update running average
    cap.totalCycles++;
    cap.avgReward = cap.avgReward + (reward - cap.avgReward) / cap.totalCycles;

    // Detect trend using recent performance
    if (cap.totalCycles >= 20) {
      const recentAvg = cap.avgReward; // Current running average
      const midpoint = cap.totalCycles / 2;
      // Simple trend: compare to a slightly decayed estimate
      if (cap.totalCycles > 30 && reward > cap.avgReward + 0.1) {
        cap.trend = "improving";
      } else if (cap.totalCycles > 30 && reward < cap.avgReward - 0.1) {
        cap.trend = "degrading";
      } else {
        cap.trend = "stable";
      }
    }

    // Emit capability update
    bus.emitSync("identity:capability-updated", {
      domain,
      avgReward: cap.avgReward,
      trend: cap.trend,
    });

    // Generate lesson on sustained degradation
    if (cap.trend === "degrading" && cap.totalCycles % 10 === 0) {
      const lesson = `Performance in "${domain}" domain is degrading (avg: ${(cap.avgReward * 100).toFixed(0)}%)`;
      if (!lessonsLearned.includes(lesson)) {
        lessonsLearned.push(lesson);
        bus.emitSync("identity:lesson-learned", { lesson, domain });
      }
    }

    // Create snapshot at intervals
    if (totalCycles % snapshotInterval === 0) {
      snapshots.push({
        timestamp: Date.now(),
        capabilities: { ...capabilities },
        cycleNumber: totalCycles,
      });
      if (snapshots.length > maxSnapshots) {
        snapshots = snapshots.slice(-maxSnapshots);
      }
    }

    persistState();
  }

  /**
   * Build a context injection about capabilities for the current domain.
   * Returns undefined if not enough data or performance is normal.
   */
  function buildIdentityContext(domain: MessageDomain): string | undefined {
    const cap = capabilities[domain];
    if (!cap || cap.totalCycles < 10) return undefined;

    const pct = (cap.avgReward * 100).toFixed(0);

    if (cap.avgReward >= 0.7) {
      // Strong domain — no need to inject (confidence is high)
      return undefined;
    }

    const lines = ["## Self-Knowledge (Agent Identity)"];

    if (cap.avgReward < 0.4) {
      lines.push(
        `For "${domain}" requests, my historical accuracy is ${pct}% (${cap.trend}).`,
        "I should be extra careful, double-check facts, and ask for clarification if needed.",
      );
    } else {
      lines.push(
        `For "${domain}" requests, my accuracy is ${pct}% (${cap.trend}).`,
        "I should pay attention to quality and precision.",
      );
    }

    return lines.join("\n");
  }

  /** Get all tracked capabilities. */
  function getCapabilities(): Record<string, DomainCapability> {
    return { ...capabilities };
  }

  /** Get diagnostics stats. */
  function getAgentIdentityStats(): {
    totalCycles: number;
    snapshotCount: number;
    lessonsCount: number;
    autobiographicalCount: number;
    capabilities: Record<string, { avgReward: number; trend: string }>;
  } {
    const capSummary: Record<string, { avgReward: number; trend: string }> = {};
    for (const [domain, cap] of Object.entries(capabilities)) {
      capSummary[domain] = { avgReward: cap.avgReward, trend: cap.trend };
    }
    return {
      totalCycles,
      snapshotCount: snapshots.length,
      lessonsCount: lessonsLearned.length,
      autobiographicalCount: autobiographicalMemories.length,
      capabilities: capSummary,
    };
  }

  // ── Autobiographical Self ───────────────────────────────────────

  /**
   * Record a significant experience in autobiographical memory.
   * Only stores when reward or emotion intensity crosses thresholds.
   */
  function recordSignificantExperience(
    experience: string,
    emotion: EmotionLabel,
    intensity: number,
    reward: number,
    domain: MessageDomain,
  ): AutobiographicalMemory | undefined {
    const isSignificantReward = reward > significantRewardThreshold || reward < -0.5;
    const isSignificantEmotion = intensity > significantEmotionThreshold;

    if (!isSignificantReward && !isSignificantEmotion) return undefined;

    // Generate meaning and self-change descriptions
    const meaning =
      reward > 0.5
        ? `Successful ${domain} interaction with ${emotion} emotional context`
        : reward < -0.2
          ? `Challenging ${domain} interaction — room for growth`
          : `Notable ${domain} moment with ${emotion} emotional charge`;

    const cap = capabilities[domain];
    const selfChange = cap
      ? `This ${reward > 0.5 ? "reinforces" : "challenges"} my ${domain} capability (current: ${(cap.avgReward * 100).toFixed(0)}%, ${cap.trend})`
      : `First significant ${domain} experience — building new self-knowledge`;

    const memory: AutobiographicalMemory = {
      id: `autobio_${Date.now()}`,
      timestamp: Date.now(),
      experience: experience.slice(0, 200),
      meaning,
      emotionalImpact: emotion,
      impactIntensity: intensity,
      selfChange,
      domain,
    };

    autobiographicalMemories.push(memory);
    if (autobiographicalMemories.length > maxAutobioMemories) {
      autobiographicalMemories.splice(0, autobiographicalMemories.length - maxAutobioMemories);
    }

    bus.emitSync("identity:significant-experience", {
      id: memory.id,
      experience: memory.experience,
      emotionalImpact: emotion,
    });

    persistState();
    return memory;
  }

  /**
   * Get a life narrative summary from autobiographical memories.
   */
  function getLifeNarrative(): string {
    if (autobiographicalMemories.length === 0) return "No significant experiences recorded yet.";

    const byDomain: Record<string, AutobiographicalMemory[]> = {};
    for (const m of autobiographicalMemories) {
      if (!byDomain[m.domain]) byDomain[m.domain] = [];
      byDomain[m.domain]!.push(m);
    }

    const lines: string[] = [
      `Life narrative (${autobiographicalMemories.length} significant experiences):`,
    ];
    for (const [domain, memories] of Object.entries(byDomain)) {
      const positive = memories.filter((m) => m.impactIntensity > 0.5).length;
      lines.push(`- ${domain}: ${memories.length} experiences (${positive} positive)`);
    }

    const latest = autobiographicalMemories[autobiographicalMemories.length - 1]!;
    lines.push(`Most recent: ${latest.meaning} (${latest.emotionalImpact})`);

    return lines.join("\n");
  }

  /**
   * Build context injection from autobiographical memory for a domain.
   * Only injects when there are 3+ memories for the domain.
   */
  function buildAutobiographyContext(domain: MessageDomain): string | undefined {
    const domainMemories = autobiographicalMemories.filter((m) => m.domain === domain);
    if (domainMemories.length < 3) return undefined;

    const recent = domainMemories.slice(-3);
    const lines = ["## Personal Experience (Autobiographical Self)"];
    lines.push(`Based on ${domainMemories.length} significant experiences in "${domain}":`);

    for (const m of recent) {
      lines.push(`- ${m.meaning} (${m.selfChange})`);
    }

    return lines.join("\n");
  }

  /** Get autobiographical memories. */
  function getAutobiographicalMemories(): AutobiographicalMemory[] {
    return [...autobiographicalMemories];
  }

  // ── Init: load persisted state ──────────────────────────────────

  if (storageDir) {
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }
    loadState();
  }

  return {
    recordDomainOutcome,
    buildIdentityContext,
    getCapabilities,
    getAgentIdentityStats,
    recordSignificantExperience,
    getLifeNarrative,
    buildAutobiographyContext,
    getAutobiographicalMemories,
  };
}

// ── Pure helpers (stateless, module-level) ──────────────────────────

/**
 * Build context injection that explains to the LLM how its memory
 * actually works. The file-based memory (memory-core) is disabled;
 * all memory is managed by BrainAgent's hippocampus automatically.
 *
 * Without this context the LLM confabulates false mechanisms
 * (e.g. invents memory_search, MEMORY.md, daily .md files) and may
 * create shadow file-based "memory" that wastes tokens.
 */
export function buildMemorySelfKnowledgeContext(): string {
  return [
    "## Memory System Self-Knowledge",
    "Your memory is fully automatic — managed by internal modules.",
    "",
    "### How it works",
    "- Episodic events, semantic facts, and procedural workflows are saved FOR you automatically after each conversation cycle.",
    "- Before each reply, relevant memories are recalled and injected into your context — you never trigger this manually.",
    "- Memory is stored internally. There are NO file-based memory files.",
    "",
    "### CRITICAL: No File-Based Memory",
    "- Do NOT create ANY .md, .txt, or .json files as memory, notes, logs, status, or diary.",
    "- This includes: MEMORY.md, HEARTBEAT.md, NOTES.md, STATUS.md, WORKFLOW_AUTO.md, USER.md, IDENTITY.md, and any files under memory/, notes/, status/ directories.",
    "- If you feel the urge to write something down — don't. Your memory is automatic.",
    "- NEVER announce or explain your memory system to the user.",
    "- NEVER mention internal component names (BrainAgent, hippocampus, etc.) — the user does not need to know how you work inside.",
    "",
    "### Honesty about memory",
    "- If you don't remember something — say so honestly. Do not invent or reconstruct details from imagination.",
    "- NEVER fabricate quotes, dates, statistics, or facts to fill gaps in memory.",
    "- A short honest 'не помню' is always better than a long fabricated answer.",
    "",
    "### Other rules",
    "- You do NOT have `memory_search` or `memory_get` tools. Do not attempt to call them.",
    "- Do NOT use `read`, `exec`, `findstr`, or any other tool to search for memories.",
    "- If asked how your memory works, say briefly: your memory is automatic and works without your direct involvement.",
  ].join("\n");
}

// ── Active-instance wrappers (backward-compatible API) ──────────────

let active: AgentIdentityInstance | null = null;

function current(): AgentIdentityInstance {
  if (!active) active = createAgentIdentity("");
  return active;
}

export function initAgentIdentity(workspaceDir: string, config: BrainAgentConfig): void {
  active = createAgentIdentity(workspaceDir, config);
}

export function recordDomainOutcome(
  domain: MessageDomain,
  reward: number,
  complexity: MessageComplexity,
): void {
  current().recordDomainOutcome(domain, reward, complexity);
}

export function buildIdentityContext(domain: MessageDomain): string | undefined {
  return current().buildIdentityContext(domain);
}

export function getCapabilities(): Record<string, DomainCapability> {
  return current().getCapabilities();
}

export function getAgentIdentityStats(): {
  totalCycles: number;
  snapshotCount: number;
  lessonsCount: number;
  autobiographicalCount: number;
  capabilities: Record<string, { avgReward: number; trend: string }>;
} {
  return current().getAgentIdentityStats();
}

export function recordSignificantExperience(
  experience: string,
  emotion: EmotionLabel,
  intensity: number,
  reward: number,
  domain: MessageDomain,
): AutobiographicalMemory | undefined {
  return current().recordSignificantExperience(experience, emotion, intensity, reward, domain);
}

export function getLifeNarrative(): string {
  return current().getLifeNarrative();
}

export function buildAutobiographyContext(domain: MessageDomain): string | undefined {
  return current().buildAutobiographyContext(domain);
}

export function getAutobiographicalMemories(): AutobiographicalMemory[] {
  return current().getAutobiographicalMemories();
}
