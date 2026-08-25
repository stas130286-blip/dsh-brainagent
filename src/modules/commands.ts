/**
 * BrainAgent Commands — /brainagent diagnostics and control.
 *
 * Extracted from index.ts to keep the orchestrator focused on hooks.
 *
 * v0.7.0: фабрика createCommandRegistry() — сеттеры статистики
 * модулей в замыкании реестра. Свободные функции — обёртки над
 * ленивым синглтоном реестра (шина и диск не задействованы,
 * detached-реестр без геттеров ровно эквивалентен состоянию
 * модуля до первого обращения).
 */

import type { HostConfig as NeuroClawConfig } from "./host-config.ts";
import { BRAINAGENT_VERSION } from "../plugin/service.ts";
import { getBasalStats } from "./basal-ganglia.ts";
import { getCircadianStats, forcePhase } from "./circadian-rhythm.ts";
import { getDopamineStats } from "./dopamine-system.ts";
import { forceConsolidation, getDreamStats } from "./dream-mode.ts";
import { getEmergentStats } from "./emergent-modules.ts";
import { getEmbeddingsStatus } from "./hippocampus.ts";
import { getInjectionMetrics } from "./injection-metrics.ts";
import { getProactiveFeedbackStats } from "./proactive-feedback.ts";
import { getStats as getMemoryStats } from "./hippocampus.ts";
import { getLearningStats } from "./learning-coordinator.ts";
import { getMetabolicStats } from "./metabolic-budget.ts";
import { getUserModel, getStyleRecommendation } from "./mirror-neurons.ts";
import { getPathwayStats, getSynapticStats } from "./neural-pathways.ts";
import { getPredictiveStats, predict } from "./predictive-engine.ts";
import { getStructuralStats } from "./structural-plasticity.ts";
import type {
  BrainAgentConfig,
  CognitiveHungerStats,
  CreativeDriveStats,
  MasteryDriveStats,
  SocialDriveStats,
} from "./types.ts";
import { forceImpulse, type VitalImpulseStats } from "./vital-impulse.ts";

// ── Типы геттеров статистики (optional imports для новых модулей) ──

type WorkingMemoryStatsGetter =
  | (() => { entryCount: number; oldestTimestamp: number | null; newestTimestamp: number | null })
  | undefined;
type SessionBridgeStatsGetter =
  | (() => { currentCycles: number; lastSessionTopics: string[]; gapDetected: boolean })
  | undefined;
type AttentionStatsGetter =
  | (() => { totalProcessed: number; totalDropped: number; avgRelevance: number })
  | undefined;
type DmnStatsGetter =
  | (() => {
      totalInsights: number;
      lastRunTimestamp: number;
      associationsFound: number;
      backgroundThoughts: number;
    })
  | undefined;
type IntrospectionTraceGetter = (() => import("./types.ts").ProcessingTrace | undefined) | undefined;
type IntrospectionStatsGetter =
  | (() => {
      traceCount: number;
      avgConfidence: number;
      selfDialogueCount: number;
      metaSnapshotCount: number;
    })
  | undefined;
type IdentityStatsGetter =
  | (() => {
      totalCycles: number;
      snapshotCount: number;
      lessonsCount: number;
      autobiographicalCount: number;
      capabilities: Record<string, { avgReward: number; trend: string }>;
    })
  | undefined;
type GoalStackStatsGetter =
  | (() => {
      total: number;
      pending: number;
      triggered: number;
      completed: number;
      expired: number;
      desireCount: number;
      decisionCount: number;
    })
  | undefined;
type CuriosityStatsGetter =
  | (() => {
      openGaps: number;
      totalDetected: number;
      questionsGenerated: number;
      gapsFilled: number;
    })
  | undefined;
type TemporalBindingStatsGetter =
  | (() => {
      momentCount: number;
      oldestTimestamp: number | null;
      newestTimestamp: number | null;
      dominantDomain: string | null;
    })
  | undefined;
type QualiaSimulatorStatsGetter =
  | (() => {
      currentEmotion: string | null;
      currentIntensity: number;
      logSize: number;
      dominantColor: string | null;
    })
  | undefined;
type VitalImpulseStatsGetter = (() => VitalImpulseStats) | undefined;
type GoalExecutorStatsGetter =
  | (() => { totalChecks: number; totalGoalsExecuted: number; lastHeartbeatTime: number })
  | undefined;
type SocialDriveStatsGetter = (() => SocialDriveStats) | undefined;
type CognitiveHungerStatsGetter = (() => CognitiveHungerStats) | undefined;
type CreativeDriveStatsGetter = (() => CreativeDriveStats) | undefined;
type MasteryDriveStatsGetter = (() => MasteryDriveStats) | undefined;
type DriveArbiterStatsGetter =
  | (() => {
      driveWeights: Record<string, number>;
      lastSelectedDrive: string | null;
      totalArbitrations: number;
      recentConflicts: number;
    })
  | undefined;
type TemporalAwarenessStatsGetter =
  | (() => {
      typicalGapMs: number;
      lastInteractionTime: number;
      currentGapMs: number;
      interactionDensity: number;
      totalInteractions: number;
      temporalSurprise: number;
    })
  | undefined;
type ThalamicGateStatsGetter =
  | (() => {
      totalChecks: number;
      totalActivations: number;
      totalSkips: number;
      consecutiveSkips: number;
      lastActivationTime: number;
      lastScore: number;
      lastDominantSignal: string;
    })
  | undefined;
type AutonomousResearchStatsGetter =
  | (() => {
      totalCycles: number;
      totalFactsExtracted: number;
      lastResearchTime: number;
      consecutiveCooldowns: number;
    })
  | undefined;

export type CommandStatGetters = {
  workingMemory?: WorkingMemoryStatsGetter;
  sessionBridge?: SessionBridgeStatsGetter;
  attention?: AttentionStatsGetter;
  dmn?: DmnStatsGetter;
  introspectionTrace?: IntrospectionTraceGetter;
  introspectionStats?: IntrospectionStatsGetter;
  identity?: IdentityStatsGetter;
  goalStack?: GoalStackStatsGetter;
  curiosity?: CuriosityStatsGetter;
  temporalBinding?: TemporalBindingStatsGetter;
  qualiaSimulator?: QualiaSimulatorStatsGetter;
  vitalImpulse?: VitalImpulseStatsGetter;
  goalExecutor?: GoalExecutorStatsGetter;
  socialDrive?: SocialDriveStatsGetter;
  cognitiveHunger?: CognitiveHungerStatsGetter;
  creativeDrive?: CreativeDriveStatsGetter;
  masteryDrive?: MasteryDriveStatsGetter;
  driveArbiter?: DriveArbiterStatsGetter;
  temporalAwareness?: TemporalAwarenessStatsGetter;
  thalamicGate?: ThalamicGateStatsGetter;
  autonomousResearch?: AutonomousResearchStatsGetter;
};

/** Minimal host API surface the commands module needs (dsh adapter). */
export type BrainCommandApi = {
  registerCommand: (def: {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    handler: (ctx: { args?: string }) => Promise<{ text: string }> | { text: string };
  }) => void;
  logger: { info: (msg: string) => void };
  config: NeuroClawConfig;
};

// ── Instance type ─────────────────────────────────────────────────

export type CommandRegistryInstance = {
  setStatGetters(getters: CommandStatGetters): void;
  register(api: BrainCommandApi, config: BrainAgentConfig): void;
  buildStatus(config: BrainAgentConfig): { text: string };
};

// ── Factory ───────────────────────────────────────────────────────

/**
 * Create a command registry with isolated stat-getter slots.
 * No bus subscriptions and no disk I/O — instances are pure
 * holders of optional module getters plus the /brainagent handler.
 */
export function createCommandRegistry(): CommandRegistryInstance {
  // Optional imports for new modules — these are set via setters so commands
  // don't depend on modules that may not be initialised.
  let workingMemoryStatsGetter: WorkingMemoryStatsGetter;
  let sessionBridgeStatsGetter: SessionBridgeStatsGetter;
  let attentionStatsGetter: AttentionStatsGetter;
  let dmnStatsGetter: DmnStatsGetter;
  let introspectionTraceGetter: IntrospectionTraceGetter;
  let introspectionStatsGetter: IntrospectionStatsGetter;
  let identityStatsGetter: IdentityStatsGetter;
  let goalStackStatsGetter: GoalStackStatsGetter;
  let curiosityStatsGetter: CuriosityStatsGetter;
  let temporalBindingStatsGetter: TemporalBindingStatsGetter;
  let qualiaSimulatorStatsGetter: QualiaSimulatorStatsGetter;
  let vitalImpulseStatsGetter: VitalImpulseStatsGetter;
  let goalExecutorStatsGetter: GoalExecutorStatsGetter;
  let socialDriveStatsGetter: SocialDriveStatsGetter;
  let cognitiveHungerStatsGetter: CognitiveHungerStatsGetter;
  let creativeDriveStatsGetter: CreativeDriveStatsGetter;
  let masteryDriveStatsGetter: MasteryDriveStatsGetter;
  let driveArbiterStatsGetter: DriveArbiterStatsGetter;
  let temporalAwarenessStatsGetter: TemporalAwarenessStatsGetter;
  let thalamicGateStatsGetter: ThalamicGateStatsGetter;
  let autonomousResearchStatsGetter: AutonomousResearchStatsGetter;

  function setStatGetters(getters: CommandStatGetters): void {
    workingMemoryStatsGetter = getters.workingMemory;
    sessionBridgeStatsGetter = getters.sessionBridge;
    attentionStatsGetter = getters.attention;
    dmnStatsGetter = getters.dmn;
    introspectionTraceGetter = getters.introspectionTrace;
    introspectionStatsGetter = getters.introspectionStats;
    identityStatsGetter = getters.identity;
    goalStackStatsGetter = getters.goalStack;
    curiosityStatsGetter = getters.curiosity;
    temporalBindingStatsGetter = getters.temporalBinding;
    qualiaSimulatorStatsGetter = getters.qualiaSimulator;
    vitalImpulseStatsGetter = getters.vitalImpulse;
    goalExecutorStatsGetter = getters.goalExecutor;
    socialDriveStatsGetter = getters.socialDrive;
    cognitiveHungerStatsGetter = getters.cognitiveHunger;
    creativeDriveStatsGetter = getters.creativeDrive;
    masteryDriveStatsGetter = getters.masteryDrive;
    driveArbiterStatsGetter = getters.driveArbiter;
    temporalAwarenessStatsGetter = getters.temporalAwareness;
    thalamicGateStatsGetter = getters.thalamicGate;
    autonomousResearchStatsGetter = getters.autonomousResearch;
  }

  /**
   * Register the /brainagent command with all subcommands.
   */
  function register(api: BrainCommandApi, config: BrainAgentConfig): void {
    api.registerCommand({
      name: "brainagent",
      description: "BrainAgent cognitive architecture diagnostics and control",
      acceptsArgs: true,
      handler: async (ctx) => {
        const args = (ctx.args ?? "").trim();

        if (args === "status" || args === "") {
          return buildStatus(config);
        }

        if (args === "dream") {
          const result = await forceConsolidation(config, api.logger, api.config);
          return {
            text: [
              "**BrainAgent Dream Mode**: forced consolidation complete.",
              `- Merged: ${result.merged} duplicate facts`,
              `- Pruned: ${result.pruned} weak memories`,
              `- Strengthened: ${result.strengthened} important memories`,
              `- Contradictions found: ${result.contradictions}`,
            ].join("\n"),
          };
        }

        if (args === "memory") {
          const stats = getMemoryStats();
          return {
            text: [
              "**BrainAgent Memory Stats**",
              `- Episodic memories: ${stats.episodic}`,
              `- Semantic facts: ${stats.semantic}`,
              `- Procedural workflows: ${stats.procedural}`,
              `- Vector vocabulary: ep=${stats.vectorVocabulary.episodic}, sem=${stats.vectorVocabulary.semantic}, proc=${stats.vectorVocabulary.procedural}`,
            ].join("\n"),
          };
        }

        if (args === "predict") {
          const predictions = predict();
          const pStats = getPredictiveStats();
          if (predictions.length === 0) {
            return {
              text: [
                "**BrainAgent Predictive Engine**",
                `Patterns learned: temporal=${pStats.temporalPatterns}, sequential=${pStats.sequentialPatterns}, contextual=${pStats.contextualPatterns}`,
                `Total observations: ${pStats.totalObservations}`,
                "No predictions at this moment (need more observations).",
              ].join("\n"),
            };
          }
          return {
            text: [
              "**BrainAgent Predictive Engine**",
              `Patterns: temporal=${pStats.temporalPatterns}, sequential=${pStats.sequentialPatterns}, contextual=${pStats.contextualPatterns}`,
              "",
              "**Current Predictions:**",
              ...predictions.map(
                (p, i) =>
                  `${i + 1}. [${p.type}] ${p.predictedTopic} — ${(p.confidence * 100).toFixed(0)}% (${p.reasoning})`,
              ),
            ].join("\n"),
          };
        }

        if (args === "habits") {
          const hStats = getBasalStats();
          return {
            text: [
              "**BrainAgent Basal Ganglia (Habits)**",
              `- Total habits: ${hStats.totalHabits}`,
              `- Automated habits: ${hStats.automatedHabits}`,
              `- Average reward: ${(hStats.averageReward * 100).toFixed(0)}%`,
              `- Total activations: ${hStats.totalActivations}`,
            ].join("\n"),
          };
        }

        if (args === "dopamine" || args === "neuro") {
          const dStats = getDopamineStats();
          const ns = dStats.currentState;
          return {
            text: [
              "**BrainAgent Neuromodulatory System**",
              "",
              "**Current Levels:**",
              `  Dopamine (reward/motivation): ${(ns.dopamine * 100).toFixed(0)}%`,
              `  Serotonin (mood/risk):        ${(ns.serotonin * 100).toFixed(0)}%`,
              `  Norepinephrine (attention):    ${(ns.norepinephrine * 100).toFixed(0)}%`,
              `  Acetylcholine (learning):      ${(ns.acetylcholine * 100).toFixed(0)}%`,
              "",
              "**Stats:**",
              `  Expected reward baseline: ${(dStats.expectedReward * 100).toFixed(0)}%`,
              `  Average recent reward:    ${(dStats.averageReward * 100).toFixed(0)}%`,
              `  Total interactions:       ${dStats.totalInteractions}`,
              `  Novelty ratio:            ${(dStats.noveltyRatio * 100).toFixed(0)}%`,
            ].join("\n"),
          };
        }

        if (args === "learning") {
          const lStats = getLearningStats();
          const lines = [
            "**BrainAgent Learning Coordinator (Meta-Cognition)**",
            "",
            `Learning cycles: ${lStats.cycleCount}`,
            `Active insights: ${lStats.activeInsights}`,
            `Tracked modules: ${lStats.moduleCount}`,
          ];

          if (Object.keys(lStats.modulePerformance).length > 0) {
            lines.push("", "**Per-Module Performance:**");
            for (const [mod, perf] of Object.entries(lStats.modulePerformance)) {
              const trendIcon =
                perf.trend === "improving" ? "^" : perf.trend === "degrading" ? "v" : "=";
              lines.push(
                `  ${mod}: reward=${(perf.avgReward * 100).toFixed(0)}% err=${(perf.errorRate * 100).toFixed(0)}% [${trendIcon}]`,
              );
            }
          }

          if (lStats.recentInsights.length > 0) {
            lines.push("", "**Recent Insights:**");
            for (const insight of lStats.recentInsights) {
              lines.push(`  [${insight.type}] ${insight.description}`);
            }
          }

          return { text: lines.join("\n") };
        }

        if (args === "pathways") {
          const pStats = getPathwayStats();
          const ns = pStats.neuroState;
          return {
            text: [
              "**BrainAgent Neural Pathways**",
              "",
              `Active pathways: ${pStats.pathwayCount}`,
              `Current habit in cycle: ${pStats.currentHabitId ?? "none"}`,
              `Pending predictions: ${pStats.lastPredictionCount}`,
              `Total learning cycles: ${pStats.totalLearningCycles}`,
              "",
              "**Neuromodulator Influence:**",
              `  Dopamine:        ${(ns.dopamine * 100).toFixed(0)}%`,
              `  Serotonin:       ${(ns.serotonin * 100).toFixed(0)}%`,
              `  Norepinephrine:  ${(ns.norepinephrine * 100).toFixed(0)}%`,
              `  Acetylcholine:   ${(ns.acetylcholine * 100).toFixed(0)}%`,
            ].join("\n"),
          };
        }

        if (args === "synapses" || args === "weights") {
          const sStats = getSynapticStats();
          const lines = [
            "**BrainAgent Synaptic Plasticity (Hebbian Learning)**",
            "",
            `Total learning cycles: ${sStats.totalCycles}`,
            `Learning rate: ${sStats.learningRate}`,
            `Strongest pathway: ${sStats.strongestPathway ?? "none"}`,
            `Weakest pathway: ${sStats.weakestPathway ?? "none"}`,
            "",
            "**Pathway Weights:**",
          ];

          for (const p of sStats.pathways) {
            const bar =
              "#".repeat(Math.round(p.weight * 5)) + ".".repeat(Math.round((2 - p.weight) * 5));
            const trendIcon = p.trend === "strengthening" ? "^" : p.trend === "weakening" ? "v" : "=";
            lines.push(
              `  ${p.name.padEnd(25)} ${bar} ${p.weight.toFixed(2)} (${p.activationCount} acts, avg=${p.avgReward.toFixed(2)}) ${trendIcon}`,
            );
          }

          return { text: lines.join("\n") };
        }

        if (args === "personality" || args === "style") {
          const userId = "default";
          const userModel = getUserModel(userId);
          const styleRec = getStyleRecommendation(userId);
          const lines = [
            "**BrainAgent Personality Evolution (Mirror Neurons)**",
            "",
            `Current detected style: ${userModel?.communicationStyle ?? "unknown"}`,
            `Recommended response style: ${userModel?.preferredResponseStyle ?? "unknown"}`,
          ];

          if (userModel?.styleRewards) {
            lines.push("", "**Per-Style Reward History:**");
            for (const [style, entry] of Object.entries(userModel.styleRewards)) {
              const avg = entry.count > 0 ? (entry.total / entry.count).toFixed(2) : "n/a";
              lines.push(`  ${style}: avg=${avg}, samples=${entry.count}`);
            }
          }

          if (styleRec) {
            lines.push(
              "",
              `**Active Recommendation:** ${styleRec.style} (${(styleRec.confidence * 100).toFixed(0)}% confidence)`,
            );
          } else {
            lines.push("", "Not enough data yet for style recommendation.");
          }

          return { text: lines.join("\n") };
        }

        if (args === "structure" || args === "structural") {
          const sStats = getStructuralStats();
          const lines = [
            "**BrainAgent Structural Plasticity (Neurogenesis)**",
            "",
            `Total cycles analyzed: ${sStats.totalCycles}`,
            `Co-activation pairs tracked: ${sStats.coActivationPairs}`,
            "",
            "**Dynamic Pathways:**",
            `  Active: ${sStats.dynamicPathways.active}`,
            `  Dormant: ${sStats.dynamicPathways.dormant}`,
            `  Pruned: ${sStats.dynamicPathways.pruned}`,
          ];

          if (sStats.topCorrelations.length > 0) {
            lines.push("", "**Top Co-Activated Module Pairs:**");
            for (const c of sStats.topCorrelations) {
              const bar = "#".repeat(Math.round(c.correlation * 10));
              lines.push(
                `  ${c.moduleA} <-> ${c.moduleB}: ${bar} ${(c.correlation * 100).toFixed(0)}%`,
              );
            }
          }

          if (sStats.pathwayDetails.length > 0) {
            lines.push("", "**Active Dynamic Pathways:**");
            for (const p of sStats.pathwayDetails) {
              lines.push(
                `  ${p.from} -> ${p.to}: strength=${p.strength.toFixed(2)}, uses=${p.usageCount}, avgReward=${p.avgReward.toFixed(2)}`,
              );
            }
          }

          return { text: lines.join("\n") };
        }

        if (args === "emergent" || args === "patterns") {
          const eStats = getEmergentStats();
          const lines = [
            "**BrainAgent Emergent Modules (Self-Discovered Specializations)**",
            "",
            `Total patterns discovered: ${eStats.totalDiscovered}`,
            `Emerging: ${eStats.emerging} | Established: ${eStats.established} | Deprecated: ${eStats.deprecated}`,
          ];

          if (eStats.topModules.length > 0) {
            lines.push("", "**Top Emergent Modules:**");
            for (const m of eStats.topModules) {
              const statusIcon = m.status === "established" ? "[ok]" : "[..]";
              lines.push(
                `  ${statusIcon} "${m.name}" [${m.domain}]`,
                `    Modules: ${m.participants.join(" + ")}`,
                `    Avg reward: ${m.avgReward.toFixed(2)}, Confidence: ${(m.confidence * 100).toFixed(0)}%`,
              );
            }
          } else {
            lines.push("", "No emergent patterns discovered yet.");
          }

          return { text: lines.join("\n") };
        }

        if (args === "metabolic" || args === "energy") {
          const mStats = getMetabolicStats();
          const lines = [
            "**BrainAgent Metabolic Budget (Energy Allocation)**",
            "",
            `Total budget: ${mStats.totalBudget.toFixed(1)} units`,
            `Currently used: ${mStats.usedEnergy.toFixed(2)} units`,
            `Cycles since rebalance: ${mStats.cyclesSinceRebalance}`,
          ];

          if (mStats.lowPowerModules.length > 0) {
            lines.push("", `**Modules in Low Power Mode:** ${mStats.lowPowerModules.join(", ")}`);
          }

          lines.push(
            "",
            `**Top Performers:** ${mStats.topPerformers.join(", ")}`,
            "",
            "**Module Energy Levels:**",
          );

          for (const m of mStats.modules.sort((a, b) => b.energy - a.energy)) {
            const bar =
              "#".repeat(Math.round(m.energy * 10)) + ".".repeat(Math.round((1 - m.energy) * 10));
            const lowPower = m.lowPowerMode ? " [LOW POWER]" : "";
            lines.push(
              `  ${m.name.padEnd(20)} ${bar} ${(m.energy * 100).toFixed(0)}% (perf: ${(m.performance * 100).toFixed(0)}%)${lowPower}`,
            );
          }

          return { text: lines.join("\n") };
        }

        if (args === "circadian" || args === "sleep" || args === "wake") {
          if (!config.circadian?.enabled) {
            return { text: "**Circadian Rhythm:** disabled in config" };
          }

          const cStats = getCircadianStats();
          const phaseLabel =
            cStats.phase === "wake"
              ? "[WAKE]"
              : cStats.phase === "sleep"
                ? "[SLEEP]"
                : cStats.phase === "transition-to-sleep"
                  ? "[->SLEEP]"
                  : "[->WAKE]";

          const lines = [
            "**BrainAgent Circadian Rhythm (Sleep-Wake Cycles)**",
            "",
            `**Current Phase:** ${phaseLabel} ${cStats.phase.toUpperCase()}`,
            `  Phase duration: ${Math.floor(cStats.phaseDuration / 1000)}s`,
            `  Phase progress: ${(cStats.phaseProgress * 100).toFixed(0)}%`,
            "",
            `**Activity:**`,
            `  Idle time: ${Math.floor(cStats.idleTime / 1000)}s`,
            `  Activity level: ${(cStats.activityLevel * 100).toFixed(0)}%`,
            `  Wake interactions: ${cStats.wakeInteractions}`,
            `  Sleep consolidations: ${cStats.sleepConsolidations}`,
            "",
            "**Neuromodulator Modulation:**",
          ];

          const mod = cStats.modulation;
          lines.push(
            `  Dopamine:        ${mod.dopamine > 1 ? "+" : ""}${((mod.dopamine - 1) * 100).toFixed(0)}%`,
            `  Serotonin:       ${mod.serotonin > 1 ? "+" : ""}${((mod.serotonin - 1) * 100).toFixed(0)}%`,
            `  Acetylcholine:   ${mod.acetylcholine > 1 ? "+" : ""}${((mod.acetylcholine - 1) * 100).toFixed(0)}%`,
            `  Norepinephrine:  ${mod.norepinephrine > 1 ? "+" : ""}${((mod.norepinephrine - 1) * 100).toFixed(0)}%`,
          );

          lines.push(
            "",
            "**Sleep Settings:**",
            `  Consolidation intensity: ${(cStats.sleepSettings.consolidationIntensity * 100).toFixed(0)}%`,
            `  Pruning aggressiveness: ${(cStats.sleepSettings.pruningAggressiveness * 100).toFixed(0)}%`,
            `  Synaptic normalization: ${cStats.sleepSettings.synapticNormalization ? "ON" : "OFF"}`,
          );

          return { text: lines.join("\n") };
        }

        // Force circadian phase (for testing)
        if (args.startsWith("force-")) {
          const phase = args.replace("force-", "") as "wake" | "sleep";
          if (phase === "wake" || phase === "sleep") {
            forcePhase(phase);
            return { text: `**Circadian:** forced phase to ${phase}` };
          }
        }

        // ── New consciousness module commands ────────────────────

        if (args === "wm" || args === "working-memory") {
          if (!workingMemoryStatsGetter) return { text: "Working Memory: module not loaded" };
          const s = workingMemoryStatsGetter();
          return {
            text: [
              "**BrainAgent Working Memory**",
              `  Entries: ${s.entryCount}`,
              `  Oldest: ${s.oldestTimestamp ? new Date(s.oldestTimestamp).toLocaleString() : "none"}`,
              `  Newest: ${s.newestTimestamp ? new Date(s.newestTimestamp).toLocaleString() : "none"}`,
            ].join("\n"),
          };
        }

        if (args === "session") {
          if (!sessionBridgeStatsGetter) return { text: "Session Bridge: module not loaded" };
          const s = sessionBridgeStatsGetter();
          return {
            text: [
              "**BrainAgent Session Bridge**",
              `  Current session cycles: ${s.currentCycles}`,
              `  Last session topics: ${s.lastSessionTopics.length > 0 ? s.lastSessionTopics.join(", ") : "none"}`,
              `  Gap detected: ${s.gapDetected ? "yes" : "no"}`,
            ].join("\n"),
          };
        }

        if (args === "attention") {
          if (!attentionStatsGetter) return { text: "Attention Gate: module not loaded" };
          const s = attentionStatsGetter();
          return {
            text: [
              "**BrainAgent Attention Gate**",
              `  Total sections processed: ${s.totalProcessed}`,
              `  Total sections dropped: ${s.totalDropped}`,
              `  Avg relevance score: ${(s.avgRelevance * 100).toFixed(0)}%`,
            ].join("\n"),
          };
        }

        if (args === "dmn") {
          if (!dmnStatsGetter) return { text: "Default Mode Network: module not loaded" };
          const s = dmnStatsGetter();
          return {
            text: [
              "**BrainAgent Default Mode Network**",
              `  Total insights: ${s.totalInsights}`,
              `  Last run: ${s.lastRunTimestamp ? new Date(s.lastRunTimestamp).toLocaleString() : "never"}`,
              `  Associations found: ${s.associationsFound}`,
              `  Background thoughts: ${s.backgroundThoughts}`,
            ].join("\n"),
          };
        }

        if (args === "explain") {
          if (!introspectionTraceGetter) return { text: "Introspection: module not loaded" };
          const trace = introspectionTraceGetter();
          if (!trace) return { text: "No processing trace available yet." };
          const lines = [
            "**BrainAgent Introspection — Last Processing Trace**",
            "",
            `Input: ${trace.inputSnippet}`,
            `Confidence: ${(trace.finalConfidence * 100).toFixed(0)}%`,
            `Cerebellum: ${trace.cerebellumPassed ? "PASSED" : "FAILED"}`,
            `Reward: ${(trace.reward * 100).toFixed(0)}%`,
            "",
            "**Processing Steps:**",
          ];
          for (const step of trace.steps) {
            lines.push(`  [${step.hook}] ${step.module}: ${step.outputSummary}`);
          }
          return { text: lines.join("\n") };
        }

        if (args === "identity") {
          if (!identityStatsGetter) return { text: "Agent Identity: module not loaded" };
          const s = identityStatsGetter();
          const lines = [
            "**BrainAgent Agent Identity**",
            "",
            `Total cycles: ${s.totalCycles}`,
            `Snapshots: ${s.snapshotCount}`,
            `Lessons learned: ${s.lessonsCount}`,
            `Autobiographical memories: ${s.autobiographicalCount}`,
          ];
          if (Object.keys(s.capabilities).length > 0) {
            lines.push("", "**Domain Capabilities:**");
            for (const [domain, cap] of Object.entries(s.capabilities)) {
              const trendIcon =
                cap.trend === "improving" ? "^" : cap.trend === "degrading" ? "v" : "=";
              lines.push(`  ${domain}: ${(cap.avgReward * 100).toFixed(0)}% [${trendIcon}]`);
            }
          }
          return { text: lines.join("\n") };
        }

        if (args === "goals") {
          if (!goalStackStatsGetter) return { text: "Goal Stack: module not loaded" };
          const s = goalStackStatsGetter();
          return {
            text: [
              "**BrainAgent Goal Stack**",
              `  Total goals: ${s.total}`,
              `  Pending: ${s.pending}`,
              `  Triggered: ${s.triggered}`,
              `  Completed: ${s.completed}`,
              `  Expired: ${s.expired}`,
              `  Active desires: ${s.desireCount}`,
              `  Decisions logged: ${s.decisionCount}`,
            ].join("\n"),
          };
        }

        if (args === "curiosity") {
          if (!curiosityStatsGetter) return { text: "Curiosity Drive: module not loaded" };
          const s = curiosityStatsGetter();
          return {
            text: [
              "**BrainAgent Curiosity Drive**",
              `  Open knowledge gaps: ${s.openGaps}`,
              `  Total gaps detected: ${s.totalDetected}`,
              `  Questions generated: ${s.questionsGenerated}`,
              `  Gaps filled: ${s.gapsFilled}`,
            ].join("\n"),
          };
        }

        if (args === "temporal" || args === "stream") {
          if (!temporalBindingStatsGetter) return { text: "Temporal Binding: module not loaded" };
          const s = temporalBindingStatsGetter();
          return {
            text: [
              "**BrainAgent Temporal Binding (Consciousness Stream)**",
              `  Moments in stream: ${s.momentCount}`,
              `  Oldest: ${s.oldestTimestamp ? new Date(s.oldestTimestamp).toLocaleString() : "none"}`,
              `  Newest: ${s.newestTimestamp ? new Date(s.newestTimestamp).toLocaleString() : "none"}`,
              `  Dominant domain: ${s.dominantDomain ?? "none"}`,
            ].join("\n"),
          };
        }

        if (args === "qualia" || args === "subjective") {
          if (!qualiaSimulatorStatsGetter) return { text: "Qualia Simulator: module not loaded" };
          const s = qualiaSimulatorStatsGetter();
          return {
            text: [
              "**BrainAgent Qualia Simulator (Subjective Experience)**",
              `  Current emotion: ${s.currentEmotion ?? "none"}`,
              `  Intensity: ${(s.currentIntensity * 100).toFixed(0)}%`,
              `  Experience log: ${s.logSize} entries`,
              `  Dominant color: ${s.dominantColor ?? "none"}`,
            ].join("\n"),
          };
        }

        if (args === "meta" || args === "meta-consciousness") {
          if (!introspectionStatsGetter) return { text: "Introspection: module not loaded" };
          const s = introspectionStatsGetter();
          return {
            text: [
              "**BrainAgent Meta-Consciousness**",
              `  Processing traces: ${s.traceCount}`,
              `  Avg confidence: ${(s.avgConfidence * 100).toFixed(0)}%`,
              `  Self-dialogue entries: ${s.selfDialogueCount}`,
              `  Meta-awareness snapshots: ${s.metaSnapshotCount}`,
            ].join("\n"),
          };
        }

        if (args === "impulse" || args === "vital-impulse") {
          if (!vitalImpulseStatsGetter) return { text: "Vital Impulse: module not loaded" };
          const vi = vitalImpulseStatsGetter();
          const pressurePct =
            vi.effectiveThreshold > 0
              ? (vi.currentPressure / vi.effectiveThreshold) * 100
              : 0;
          const bar =
            "█".repeat(Math.min(20, Math.round(pressurePct / 5))) +
            "░".repeat(Math.max(0, 20 - Math.round(pressurePct / 5)));
          return {
            text: [
              "**BrainAgent Vital Impulse (Autonomous Communication)**",
              "",
              `  Pressure: [${bar}] ${pressurePct.toFixed(0)}%`,
              `  Current:   ${vi.currentPressure.toFixed(3)} / ${vi.effectiveThreshold.toFixed(3)} (threshold)`,
              `  Refractory: ${vi.isInRefractory ? `cooling down (${(vi.refractoryRemainingMs / 1000).toFixed(0)}s left)` : "ready to fire"}`,
              "",
              `  Total fires:    ${vi.totalFires}`,
              `  Signals recv:   ${vi.totalSignalsReceived}`,
              `  Recent signals: ${vi.recentSignalCount}`,
              `  Last fire:      ${vi.lastFireTime ? new Date(vi.lastFireTime).toLocaleString() : "never"}`,
            ].join("\n"),
          };
        }

        if (args === "impulse force" || args === "vital-impulse force") {
          if (!vitalImpulseStatsGetter) return { text: "Vital Impulse: module not loaded" };
          forceImpulse("Manual impulse triggered via /brainagent impulse force");
          return { text: "**BrainAgent Vital Impulse**: forced autonomous impulse fired." };
        }

        return {
          text: [
            "**BrainAgent Commands:**",
            "`/brainagent status` — show full module status",
            "`/brainagent memory` — show memory statistics",
            "`/brainagent predict` — show predictions and pattern stats",
            "`/brainagent habits` — show habit formation stats",
            "`/brainagent dream` — force memory consolidation",
            "`/brainagent dopamine` — show neuromodulator levels",
            "`/brainagent learning` — show meta-cognitive learning stats",
            "`/brainagent pathways` — show cross-module pathway status",
            "`/brainagent synapses` — show synaptic weights (Hebbian learning)",
            "`/brainagent structure` — show structural plasticity (dynamic pathways)",
            "`/brainagent emergent` — show emergent modules (self-discovered patterns)",
            "`/brainagent metabolic` — show energy allocation",
            "`/brainagent personality` — show personality evolution and style adaptation",
            "`/brainagent circadian` — show sleep-wake cycle status",
            "`/brainagent wm` — show working memory buffer",
            "`/brainagent session` — show session bridge status",
            "`/brainagent attention` — show attention gate stats",
            "`/brainagent dmn` — show default mode network status",
            "`/brainagent explain` — show last processing trace",
            "`/brainagent identity` — show agent identity/capabilities",
            "`/brainagent goals` — show goal stack status",
            "`/brainagent curiosity` — show curiosity drive stats",
            "`/brainagent temporal` — show consciousness stream (temporal binding)",
            "`/brainagent qualia` — show subjective experience (qualia simulator)",
            "`/brainagent meta` — show meta-consciousness stats",
            "`/brainagent impulse` — show vital impulse (autonomous communication) status",
            "`/brainagent impulse force` — force an autonomous impulse",
            "`/brainagent force-wake` — force wake phase",
            "`/brainagent force-sleep` — force sleep phase",
          ].join("\n"),
        };
      },
    });
  }

  function buildStatus(config: BrainAgentConfig): { text: string } {
    const memStats = getMemoryStats();
    const dreamStats = getDreamStats();
    const pStats = getPredictiveStats();
    const hStats = getBasalStats();

    const lines = [
      "**BrainAgent Cognitive Architecture — Status**",
      "",
      `**Version:** v${BRAINAGENT_VERSION}`,
      "",
      "**Core Modules:**",
      `  Thalamus (classifier):        ${config.modules.thalamus ? "ON" : "OFF"}`,
      `  Amygdala (emotion/priority):   ${config.modules.amygdala ? "ON" : "OFF"}`,
      `  Hippocampus (memory):          ${config.modules.hippocampus ? "ON" : "OFF"}`,
      `  Prefrontal Cortex (reasoning): ${config.modules.prefrontalCortex ? "ON" : "OFF"}`,
      `  Cerebellum (quality):          ${config.modules.cerebellum ? "ON" : "OFF"}`,
      `  Mirror Neurons (empathy):      ${config.modules.mirrorNeurons ? "ON" : "OFF"}`,
      `  Predictive Engine (anticip.):  ${config.modules.predictiveEngine ? "ON" : "OFF"}`,
      `  Basal Ganglia (habits):        ${config.modules.basalGanglia ? "ON" : "OFF"}`,
      `  Dream Mode (consolidation):    ${config.modules.dreamMode ? "ON" : "OFF"}`,
      "",
      "**Integration Modules:**",
      `  Dopamine System (reward):      ${config.modules.neuromodulatorSystem ? "ON" : "OFF"}`,
      `  Learning Coordinator (meta):   ${config.modules.learningCoordinator ? "ON" : "OFF"}`,
      `  Neural Pathways (connections):  ${config.modules.neuralPathways ? "ON" : "OFF"}`,
      "",
      "**Consciousness Modules:**",
      `  Working Memory (continuity):   ${config.modules.workingMemory ? "ON" : "OFF"}`,
      `  Session Bridge (cross-sess.):  ${config.modules.sessionBridge ? "ON" : "OFF"}`,
      `  Emotional Memory (flashbulb):  ${config.modules.emotionalMemory ? "ON" : "OFF"}`,
      `  Attention Gate (filtering):    ${config.modules.attentionGate ? "ON" : "OFF"}`,
      `  DMN (idle thinking):           ${config.modules.dmn ? "ON" : "OFF"}`,
      `  Introspection (self-trace):    ${config.modules.introspection ? "ON" : "OFF"}`,
      `  Agent Identity (self-model):   ${config.modules.agentIdentity ? "ON" : "OFF"}`,
      `  Goal Stack (proactive):        ${config.modules.goalStack ? "ON" : "OFF"}`,
      `  Curiosity Drive (gaps):        ${config.modules.curiosityDrive ? "ON" : "OFF"}`,
      `  Temporal Binding (stream):     ${config.modules.temporalBinding ? "ON" : "OFF"}`,
      `  Qualia Simulator (subjective): ${config.modules.qualiaSimulator ? "ON" : "OFF"}`,
      `  Vital Impulse (autonomous):   ${config.modules.vitalImpulse ? "ON" : "OFF"}`,
      `  Goal Executor (autonomous):   ${config.modules.goalStack ? "ON" : "OFF"}`,
      "",
      "**Autonomic Modules:**",
      `  Metabolic Budget (energy):     ${config.modules.metabolicBudget ? "ON" : "OFF"}`,
      `  Emergent Modules (patterns):   ${config.modules.emergentModules ? "ON" : "OFF"}`,
      `  Interoception (inner state):   ${config.modules.interoception ? "ON" : "OFF"}`,
      `  Proactive Feedback («не зашло»): ${config.modules.proactiveFeedback ? "ON" : "OFF"}`,
      "",
      "**Memory:**",
      `  Episodic memories:  ${memStats.episodic}`,
      `  Semantic facts:     ${memStats.semantic}`,
      `  Procedural flows:   ${memStats.procedural}`,
      "",
      "**Predictive Engine:**",
      `  Temporal patterns:    ${pStats.temporalPatterns}`,
      `  Sequential patterns:  ${pStats.sequentialPatterns}`,
      `  Contextual patterns:  ${pStats.contextualPatterns}`,
      "",
      "**Basal Ganglia (Habits):**",
      `  Total habits:       ${hStats.totalHabits}`,
      `  Automated habits:   ${hStats.automatedHabits}`,
      `  Average reward:     ${(hStats.averageReward * 100).toFixed(0)}%`,
    ];

    // Neuromodulator status
    if (config.modules.neuromodulatorSystem) {
      const dStats = getDopamineStats();
      const ns = dStats.currentState;
      lines.push(
        "",
        "**Neuromodulators:**",
        `  Dopamine:        ${(ns.dopamine * 100).toFixed(0)}%`,
        `  Serotonin:       ${(ns.serotonin * 100).toFixed(0)}%`,
        `  Norepinephrine:  ${(ns.norepinephrine * 100).toFixed(0)}%`,
        `  Acetylcholine:   ${(ns.acetylcholine * 100).toFixed(0)}%`,
      );
    }

    // Learning coordinator status
    if (config.modules.learningCoordinator) {
      const lStats = getLearningStats();
      lines.push(
        "",
        "**Learning Coordinator:**",
        `  Cycles completed:  ${lStats.cycleCount}`,
        `  Active insights:   ${lStats.activeInsights}`,
      );
    }

    // Consciousness module stats
    if (workingMemoryStatsGetter && config.modules.workingMemory) {
      const wm = workingMemoryStatsGetter();
      lines.push("", "**Working Memory:**", `  Buffer entries: ${wm.entryCount}`);
    }

    if (sessionBridgeStatsGetter && config.modules.sessionBridge) {
      const sb = sessionBridgeStatsGetter();
      lines.push("", "**Session Bridge:**", `  Current session cycles: ${sb.currentCycles}`);
    }

    if (attentionStatsGetter && config.modules.attentionGate) {
      const ag = attentionStatsGetter();
      lines.push(
        "",
        "**Attention Gate:**",
        `  Processed: ${ag.totalProcessed}, Dropped: ${ag.totalDropped}`,
      );
    }

    if (identityStatsGetter && config.modules.agentIdentity) {
      const ai = identityStatsGetter();
      lines.push(
        "",
        "**Agent Identity:**",
        `  Cycles: ${ai.totalCycles}, Lessons: ${ai.lessonsCount}`,
      );
    }

    if (goalStackStatsGetter && config.modules.goalStack) {
      const gs = goalStackStatsGetter();
      lines.push("", "**Goal Stack:**", `  Pending: ${gs.pending}, Completed: ${gs.completed}`);
    }

    if (curiosityStatsGetter && config.modules.curiosityDrive) {
      const cs = curiosityStatsGetter();
      lines.push("", "**Curiosity Drive:**", `  Open gaps: ${cs.openGaps}, Filled: ${cs.gapsFilled}`);
    }

    if (temporalBindingStatsGetter && config.modules.temporalBinding) {
      const tb = temporalBindingStatsGetter();
      lines.push(
        "",
        "**Temporal Binding:**",
        `  Moments: ${tb.momentCount}, Domain: ${tb.dominantDomain ?? "none"}`,
      );
    }

    if (qualiaSimulatorStatsGetter && config.modules.qualiaSimulator) {
      const qs = qualiaSimulatorStatsGetter();
      lines.push(
        "",
        "**Qualia Simulator:**",
        `  Emotion: ${qs.currentEmotion ?? "none"}, Color: ${qs.dominantColor ?? "none"}`,
      );
    }

    if (vitalImpulseStatsGetter && config.modules.vitalImpulse) {
      const vi = vitalImpulseStatsGetter();
      const pressurePct =
        vi.effectiveThreshold > 0 ? (vi.currentPressure / vi.effectiveThreshold) * 100 : 0;
      lines.push(
        "",
        "**Vital Impulse:**",
        `  Pressure: ${pressurePct.toFixed(0)}% of threshold`,
        `  Fires: ${vi.totalFires}, Signals: ${vi.totalSignalsReceived}`,
        `  Status: ${vi.isInRefractory ? "refractory" : "ready"}`,
      );
    }

    if (goalExecutorStatsGetter && config.modules.goalStack) {
      const ge = goalExecutorStatsGetter();
      lines.push(
        "",
        "**Goal Executor:**",
        `  Checks: ${ge.totalChecks}, Goals executed: ${ge.totalGoalsExecuted}`,
        `  Last heartbeat: ${ge.lastHeartbeatTime ? new Date(ge.lastHeartbeatTime).toLocaleString() : "never"}`,
      );
    }

    // Prompt-injection volume metrics (0.1.2)
    const im = getInjectionMetrics();
    if (im.cycles > 0) {
      lines.push(
        "",
        "**Context Injections:**",
        `  Cycles: ${im.cycles}, Over budget: ${im.overBudgetCycles}`,
        `  Avg: ${im.avgChars} chars (~${im.avgEstTokens} tokens), Max: ${im.maxChars} chars`,
        `  Sections: avg ${im.avgSections}, max ${im.maxSections}`,
      );
    }

    // Proactive feedback stats (0.2.0)
    if (config.modules.proactiveFeedback) {
      const pf = getProactiveFeedbackStats();
      lines.push(
        "",
        "**Proactive Feedback («не зашло»):**",
        `  Domains tracked: ${pf.trackedDomains}, Rejections: ${pf.totalRejections}, Accepts: ${pf.totalAccepts}`,
        `  Suppressed now: ${pf.suppressedDomains.length > 0 ? pf.suppressedDomains.join(", ") : "—"}`,
      );
    }

    // Memory search backend status (0.2.0)
    const emb = getEmbeddingsStatus();
    lines.push(
      "",
      "**Memory Search:**",
      `  Backend: ${emb.available ? `AI embeddings (${emb.provider} / ${emb.model})` : "TF-IDF (локальный)"}`,
      `  Cached vectors: episodic ${emb.cached.episodic}, semantic ${emb.cached.semantic}, procedural ${emb.cached.procedural}`,
    );

    if (socialDriveStatsGetter && config.modules.socialDrive) {
      const sd = socialDriveStatsGetter();
      const timeSince =
        sd.lastSocialInteractionTime > 0
          ? `${((Date.now() - sd.lastSocialInteractionTime) / 60_000).toFixed(0)}m ago`
          : "never";
      lines.push(
        "",
        "**Social Drive:**",
        `  Need: ${sd.needLevel}, Satiation: ${(sd.satiation * 100).toFixed(0)}%`,
        `  Last social: ${timeSince}`,
        `  Rewards: ${sd.totalSocialRewards}, Signals: ${sd.totalNeedSignals}`,
      );
    }

    if (cognitiveHungerStatsGetter && config.modules.cognitiveHunger) {
      const ch = cognitiveHungerStatsGetter();
      const timeSince =
        ch.lastLearningInteractionTime > 0
          ? `${((Date.now() - ch.lastLearningInteractionTime) / 60_000).toFixed(0)}m ago`
          : "never";
      lines.push(
        "",
        "**Cognitive Hunger:**",
        `  Need: ${ch.needLevel}, Satiation: ${(ch.satiation * 100).toFixed(0)}%`,
        `  Last learning: ${timeSince}`,
        `  Rewards: ${ch.totalLearningRewards}, Signals: ${ch.totalNeedSignals}`,
      );
    }

    if (creativeDriveStatsGetter && config.modules.creativeDrive) {
      const cd = creativeDriveStatsGetter();
      const timeSince =
        cd.lastCreativeInteractionTime > 0
          ? `${((Date.now() - cd.lastCreativeInteractionTime) / 60_000).toFixed(0)}m ago`
          : "never";
      lines.push(
        "",
        "**Creative Drive:**",
        `  Need: ${cd.needLevel}, Satiation: ${(cd.satiation * 100).toFixed(0)}%`,
        `  Last creative: ${timeSince}`,
        `  Rewards: ${cd.totalCreativeRewards}, Signals: ${cd.totalNeedSignals}`,
      );
    }

    if (masteryDriveStatsGetter && config.modules.masteryDrive) {
      const md = masteryDriveStatsGetter();
      const domainList = Object.entries(md.domainSatiations)
        .map(([d, s]) => `${d}:${(s * 100).toFixed(0)}%`)
        .join(", ");
      lines.push(
        "",
        "**Mastery Drive:**",
        `  Need: ${md.needLevel}, Aggregate satiation: ${(md.satiation * 100).toFixed(0)}%`,
        `  Weakest: ${md.weakestDomain} (${(md.weakestDomainSatiation * 100).toFixed(0)}%)`,
        `  Domains (${md.activeDomainCount}): ${domainList || "none yet"}`,
        `  Improvements: ${md.totalImprovementRewards}, Signals: ${md.totalNeedSignals}`,
      );
    }

    if (driveArbiterStatsGetter && config.modules.driveArbiter) {
      const da = driveArbiterStatsGetter();
      const weightStr = Object.entries(da.driveWeights)
        .map(([d, w]) => `${d}:${(w as number).toFixed(2)}`)
        .join(", ");
      lines.push(
        "",
        "**Drive Arbiter:**",
        `  Last selected: ${da.lastSelectedDrive ?? "none"}`,
        `  Weights: ${weightStr}`,
        `  Arbitrations: ${da.totalArbitrations}, Recent conflicts: ${da.recentConflicts}`,
      );
    }

    if (temporalAwarenessStatsGetter && config.modules.temporalAwareness) {
      const ta = temporalAwarenessStatsGetter();
      lines.push(
        "",
        "**Temporal Awareness:**",
        `  Typical gap: ${formatMs(ta.typicalGapMs)}, Current gap: ${formatMs(ta.currentGapMs)}`,
        `  Density: ${ta.interactionDensity.toFixed(1)} interactions/day`,
        `  Surprise: ${ta.temporalSurprise.toFixed(1)}x, Total: ${ta.totalInteractions}`,
      );
    }

    if (autonomousResearchStatsGetter && config.modules.autonomousResearch) {
      const ar = autonomousResearchStatsGetter();
      lines.push(
        "",
        "**Autonomous Research:**",
        `  Cycles: ${ar.totalCycles}, Facts extracted: ${ar.totalFactsExtracted}`,
        `  Last research: ${ar.lastResearchTime ? new Date(ar.lastResearchTime).toLocaleString() : "never"}`,
        `  Consecutive cooldowns: ${ar.consecutiveCooldowns}`,
      );
    }

    lines.push(
      "",
      "**Dream Mode:**",
      `  Running: ${dreamStats.isRunning ? "yes" : "no"}`,
      `  Last consolidation: ${dreamStats.lastConsolidation ? new Date(dreamStats.lastConsolidation).toLocaleString() : "never"}`,
    );

    if (config.circadian?.enabled) {
      const cStats = getCircadianStats();
      lines.push(
        "",
        "**Circadian Rhythm:**",
        `  Phase: ${cStats.phase}`,
        `  Activity level: ${(cStats.activityLevel * 100).toFixed(0)}%`,
      );
    }

    return { text: lines.join("\n") };
  }

  return {
    setStatGetters,
    register,
    buildStatus,
  };
}

// ── Active-instance wrappers (backward-compatible API) ────────────

let active: CommandRegistryInstance | undefined;

function current(): CommandRegistryInstance {
  if (!active) {
    active = createCommandRegistry();
  }
  return active;
}

export function setCommandStatGetters(getters: CommandStatGetters): void {
  current().setStatGetters(getters);
}

export function registerBrainAgentCommands(
  api: BrainCommandApi,
  config: BrainAgentConfig,
): void {
  current().register(api, config);
}

export function buildStatusReport(config: BrainAgentConfig): { text: string } {
  return current().buildStatus(config);
}

function formatMs(ms: number): string {
  if (ms <= 0) return "0s";
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(0)}m`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)}h`;
  return `${(ms / 86_400_000).toFixed(1)}d`;
}
