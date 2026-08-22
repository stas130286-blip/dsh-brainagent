/**
 * Mirror Neurons — Empathy engine and user modeling.
 *
 * In the brain, mirror neurons fire both when we perform an action and
 * when we observe someone else performing it — they're the neural basis
 * of empathy. This module builds and maintains a model of each user:
 * their mood, stress level, communication style, expertise, and frequent
 * topics. The model evolves with every interaction.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HostConfig as NeuroClawConfig } from "./host-config.ts";
import { bus } from "./event-bus.ts";
import { callLLM } from "./llm-client.ts";
import type {
  AmygdalaAssessment,
  BrainAgentConfig,
  CommunicationStyle,
  EmotionLabel,
  ThalamusClassification,
  UserModel,
} from "./types.ts";

// ── Storage ─────────────────────────────────────────────────────────

let storageDir = "";
const userModels = new Map<string, UserModel>();

export function initMirrorStorage(workspaceDir: string): void {
  userModels.clear();
  storageDir = join(workspaceDir, ".brainagent", "users");
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  // Load all existing user models
  try {
    const indexPath = join(storageDir, "index.json");
    if (existsSync(indexPath)) {
      const data = JSON.parse(readFileSync(indexPath, "utf-8")) as Record<string, UserModel>;
      for (const [id, model] of Object.entries(data)) {
        userModels.set(id, model);
      }
    }
  } catch {
    // Fresh start
  }
}

function persistModels(): void {
  if (!storageDir) return;
  try {
    const data = Object.fromEntries(userModels);
    writeFileSync(join(storageDir, "index.json"), JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Non-critical
  }
}

// ── User model management ───────────────────────────────────────────

function createDefaultModel(userId: string): UserModel {
  return {
    userId,
    moodTrend: "neutral",
    stressLevel: 0.2,
    communicationStyle: "informal",
    language: "ru",
    expertiseLevel: "intermediate",
    emotionHistory: [],
    frequentTopics: [],
    lastSeen: Date.now(),
    styleRewards: {
      formal: { total: 0, count: 0 },
      informal: { total: 0, count: 0 },
      terse: { total: 0, count: 0 },
      verbose: { total: 0, count: 0 },
    },
    preferredResponseStyle: "informal",
    // Theory of Mind defaults
    inferredGoals: [],
    knowledgeModel: {},
    interactionPatterns: {
      avgResponseTimeMs: 0,
      preferredTopics: [],
      peakHoursUTC: [],
      engagementStyle: "sporadic",
    },
    relationshipDepth: 0,
    mentalState: {
      currentFocus: null,
      frustrationLevel: 0,
      engagementLevel: 0.5,
    },
    intentHistory: [],
  };
}

export function getOrCreateModel(userId: string): UserModel {
  let model = userModels.get(userId);
  if (!model) {
    model = createDefaultModel(userId);
    userModels.set(userId, model);
  }
  return model;
}

export function getUserModel(userId: string): UserModel | undefined {
  return userModels.get(userId);
}

// ── Observation: update model from incoming message ─────────────────

/**
 * Observe a user message and update their model.
 * Called on every incoming message to build up understanding.
 */
export function observe(
  userId: string,
  text: string,
  amygdalaResult: AmygdalaAssessment,
  config: BrainAgentConfig,
): UserModel {
  const model = getOrCreateModel(userId);

  // Update emotion history
  model.emotionHistory.push({
    timestamp: Date.now(),
    emotion: amygdalaResult.emotion,
    intensity: amygdalaResult.emotionIntensity,
  });

  // Trim history to configured length
  if (model.emotionHistory.length > config.empathy.emotionHistoryLength) {
    model.emotionHistory = model.emotionHistory.slice(-config.empathy.emotionHistoryLength);
  }

  // Compute mood trend from recent emotions
  model.moodTrend = computeMoodTrend(model.emotionHistory);

  // Update stress level (exponential moving average)
  const stressEmotions: EmotionLabel[] = ["frustration", "anger", "anxiety", "urgency"];
  const isStressed = stressEmotions.includes(amygdalaResult.emotion);
  const alpha = 0.3;
  model.stressLevel =
    model.stressLevel * (1 - alpha) + (isStressed ? amygdalaResult.emotionIntensity : 0) * alpha;

  // Detect communication style
  model.communicationStyle = detectStyle(text);

  // Detect language
  model.language = detectLanguage(text);

  // Update frequent topics (simple keyword extraction)
  updateTopics(model, text);
  model.lastSeen = Date.now();

  // Theory of Mind updates
  applyTheoryOfMindUpdates(model, text, amygdalaResult, config);

  // Persist and broadcast
  persistModels();
  bus.emit("mirror:user-updated", model);

  return model;
}

// ── Style detection ─────────────────────────────────────────────────

function detectStyle(text: string): UserModel["communicationStyle"] {
  const wordCount = text.split(/\s+/).length;

  // Very short messages → terse
  if (wordCount <= 3) return "terse";

  // Check for formal indicators
  const formalPatterns = [
    /уважаем/i,
    /пожалуйста/i,
    /будьте добры/i,
    /прошу/i,
    /dear/i,
    /please/i,
    /could you/i,
    /would you/i,
  ];
  const formalHits = formalPatterns.filter((p) => p.test(text)).length;
  if (formalHits >= 2) return "formal";

  // Very long, detailed messages → verbose
  if (wordCount > 80) return "verbose";

  return "informal";
}

// ── Language detection (simple heuristic) ───────────────────────────

function detectLanguage(text: string): string {
  const cyrillicCount = (text.match(/[а-яА-ЯёЁ]/g) ?? []).length;
  const latinCount = (text.match(/[a-zA-Z]/g) ?? []).length;
  const totalAlpha = cyrillicCount + latinCount;

  if (totalAlpha === 0) return "unknown";
  if (cyrillicCount / totalAlpha > 0.5) return "ru";
  return "en";
}

// ── Mood trend computation ──────────────────────────────────────────

function computeMoodTrend(history: UserModel["emotionHistory"]): EmotionLabel {
  if (history.length === 0) return "neutral";

  // Take last 5 entries
  const recent = history.slice(-5);

  // Count emotions
  const counts = new Map<EmotionLabel, number>();
  for (const entry of recent) {
    counts.set(entry.emotion, (counts.get(entry.emotion) ?? 0) + entry.intensity);
  }

  // Find dominant emotion
  let dominant: EmotionLabel = "neutral";
  let maxWeight = 0;
  for (const [emotion, weight] of counts) {
    if (weight > maxWeight) {
      maxWeight = weight;
      dominant = emotion;
    }
  }

  return dominant;
}

// ── Topic extraction (simple keyword frequency) ─────────────────────

function updateTopics(model: UserModel, text: string): void {
  // Extract significant words (>4 chars, not common stopwords)
  const stopwords = new Set([
    "этот",
    "того",
    "быть",
    "который",
    "также",
    "когда",
    "если",
    "можно",
    "нужно",
    "будет",
    "было",
    "были",
    "есть",
    "очень",
    "just",
    "that",
    "this",
    "with",
    "from",
    "have",
    "will",
    "been",
    "what",
    "when",
    "where",
    "which",
    "their",
    "about",
    "would",
  ]);

  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4 && !stopwords.has(w))
    .map((w) => w.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, ""))
    .filter(Boolean);

  for (const word of words) {
    if (!model.frequentTopics.includes(word)) {
      model.frequentTopics.push(word);
    }
  }

  // Keep only top 30 most recent topics
  if (model.frequentTopics.length > 30) {
    model.frequentTopics = model.frequentTopics.slice(-30);
  }
}

// ── Personality Evolution: reward-driven style adaptation ────────────
//
// In the real brain, dopaminergic pathways reinforce behavioral patterns
// that lead to positive outcomes. Mirror neurons don't just mimic — they
// learn which mirrored behaviors produce the best social results.
//
// Here, the dopamine reward signal is used to reinforce the communication
// style that was active during each interaction cycle. Over time, the
// system learns the style each user responds to best and adapts its
// responses accordingly — true personality evolution.

/**
 * Process a dopamine reward signal to update style preferences.
 * Called after each interaction cycle. Associates the reward with
 * the communication style that was active during the response.
 *
 * @param userId The user whose style preference to update
 * @param reward The reward signal (-1 to 1) from dopamine system
 * @param activeStyle The communication style used in this response cycle
 */
export function processStyleReward(
  userId: string,
  reward: number,
  activeStyle: CommunicationStyle,
): void {
  const model = getOrCreateModel(userId);

  // Ensure styleRewards exists (for models loaded from old storage)
  if (!model.styleRewards) {
    model.styleRewards = {
      formal: { total: 0, count: 0 },
      informal: { total: 0, count: 0 },
      terse: { total: 0, count: 0 },
      verbose: { total: 0, count: 0 },
    };
  }

  // Record reward for this style
  const entry = model.styleRewards[activeStyle];
  entry.total += reward;
  entry.count++;

  // Recompute preferred style from accumulated rewards
  model.preferredResponseStyle = computePreferredStyle(model);

  persistModels();
}

/**
 * Compute the preferred response style from reward history.
 *
 * Uses a combination of:
 * 1. Average reward per style (which style gets the best reactions)
 * 2. Minimum sample count (need enough data before switching)
 * 3. Exploration bonus for under-sampled styles (avoid getting stuck)
 */
function computePreferredStyle(model: UserModel): CommunicationStyle {
  const styles: CommunicationStyle[] = ["formal", "informal", "terse", "verbose"];

  if (!model.styleRewards) return model.communicationStyle;

  const totalSamples = styles.reduce((sum, s) => sum + (model.styleRewards[s]?.count ?? 0), 0);

  // Need at least 5 interactions before making a recommendation
  if (totalSamples < 5) return model.communicationStyle;

  let bestStyle: CommunicationStyle = model.communicationStyle;
  let bestScore = -Infinity;

  for (const style of styles) {
    const entry = model.styleRewards[style];
    if (!entry || entry.count === 0) continue;

    const avgReward = entry.total / entry.count;

    // UCB1-like exploration bonus: encourage trying under-sampled styles
    const explorationBonus = Math.sqrt(Math.log(totalSamples) / entry.count) * 0.1;

    // Combined score: exploitation (avg reward) + exploration
    const score = avgReward + explorationBonus;

    if (score > bestScore) {
      bestScore = score;
      bestStyle = style;
    }
  }

  return bestStyle;
}

/**
 * Get the style recommendation for a user, including explanation.
 * Used by the context builder to inject style guidance into the LLM prompt.
 */
export function getStyleRecommendation(
  userId: string,
): { style: CommunicationStyle; confidence: number; context: string } | undefined {
  const model = userModels.get(userId);
  if (!model?.styleRewards) return undefined;

  const preferred = model.preferredResponseStyle ?? model.communicationStyle;
  const entry = model.styleRewards[preferred];
  if (!entry || entry.count < 3) return undefined;

  // Confidence = how much better this style is vs average
  const styles: CommunicationStyle[] = ["formal", "informal", "terse", "verbose"];
  const allAvgs = styles
    .map((s) => {
      const e = model.styleRewards[s];
      return e && e.count > 0 ? e.total / e.count : 0;
    })
    .filter((v) => v !== 0);

  const globalAvg = allAvgs.length > 0 ? allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length : 0;
  const preferredAvg = entry.total / entry.count;
  const advantage = preferredAvg - globalAvg;

  // Only recommend if there's a meaningful advantage
  if (advantage < 0.05 && entry.count < 10) return undefined;

  const confidence = Math.min(0.95, 0.3 + advantage * 2 + Math.min(entry.count / 30, 0.3));

  const styleDescriptions: Record<CommunicationStyle, string> = {
    formal: "Use polite, structured language with clear sections and professional tone.",
    informal: "Use conversational, friendly tone — relaxed but helpful.",
    terse: "Be concise and direct — short answers, no fluff.",
    verbose: "Provide detailed, thorough explanations with examples and context.",
  };

  return {
    style: preferred,
    confidence,
    context: [
      "## Communication Style Adaptation (Personality Evolution)",
      `This user responds best to **${preferred}** communication.`,
      styleDescriptions[preferred],
      `(Based on ${entry.count} interactions, confidence: ${(confidence * 100).toFixed(0)}%)`,
    ].join("\n"),
  };
}

// ── LLM-enhanced style detection ────────────────────────────────────

const STYLE_PROMPT = `You are a communication style detector for a conversational AI.

Analyze the user's message and determine their communication style.

Styles:
- "formal": polite, structured, professional (uses "please", formal pronouns, proper grammar)
- "informal": casual, conversational, friendly (contractions, slang, relaxed grammar)
- "terse": very brief, minimal words, to the point (1-3 word responses, commands)
- "verbose": detailed, thorough, long explanations (multiple sentences, lots of context)

Also detect:
- expertise: "beginner" | "intermediate" | "expert" — based on vocabulary and question complexity
- language: "ru" | "en" | other ISO code

Rules:
- Consider the OVERALL tone, not just individual words
- A message that says "please" once in casual context is still informal
- Technical jargon + short messages = terse expert, not formal
- Long emotional messages = verbose, even if informal

Respond with ONLY a JSON object:
{"style": "...", "expertise": "...", "language": "..."}`;

/**
 * Observe user with LLM-enhanced style detection.
 * Falls back to pattern-based detection if LLM is unavailable.
 */
export async function observeWithAI(
  userId: string,
  text: string,
  amygdalaResult: AmygdalaAssessment,
  config: BrainAgentConfig,
  neuroConfig: NeuroClawConfig,
  logger?: { info: (msg: string) => void },
): Promise<UserModel> {
  const model = getOrCreateModel(userId);

  // Update emotion history (same as pattern-based)
  model.emotionHistory.push({
    timestamp: Date.now(),
    emotion: amygdalaResult.emotion,
    intensity: amygdalaResult.emotionIntensity,
  });
  if (model.emotionHistory.length > config.empathy.emotionHistoryLength) {
    model.emotionHistory = model.emotionHistory.slice(-config.empathy.emotionHistoryLength);
  }
  model.moodTrend = computeMoodTrend(model.emotionHistory);

  // Update stress level
  const stressEmotions: EmotionLabel[] = ["frustration", "anger", "anxiety", "urgency"];
  const isStressed = stressEmotions.includes(amygdalaResult.emotion);
  const alpha = 0.3;
  model.stressLevel =
    model.stressLevel * (1 - alpha) + (isStressed ? amygdalaResult.emotionIntensity : 0) * alpha;

  // Try LLM-enhanced style detection
  const content = await callLLM(STYLE_PROMPT, text, neuroConfig, logger, 100);
  if (content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          style?: string;
          expertise?: string;
          language?: string;
        };

        const validStyles: CommunicationStyle[] = ["formal", "informal", "terse", "verbose"];
        if (validStyles.includes(parsed.style as CommunicationStyle)) {
          model.communicationStyle = parsed.style as CommunicationStyle;
        } else {
          model.communicationStyle = detectStyle(text);
        }

        const validExpertise = ["beginner", "intermediate", "expert"];
        if (validExpertise.includes(parsed.expertise as string)) {
          model.expertiseLevel = parsed.expertise as UserModel["expertiseLevel"];
        }

        if (parsed.language && typeof parsed.language === "string") {
          model.language = parsed.language;
        }
      } else {
        model.communicationStyle = detectStyle(text);
        model.language = detectLanguage(text);
      }
    } catch {
      model.communicationStyle = detectStyle(text);
      model.language = detectLanguage(text);
    }
  } else {
    model.communicationStyle = detectStyle(text);
    model.language = detectLanguage(text);
  }

  updateTopics(model, text);
  model.lastSeen = Date.now();

  // Theory of Mind updates
  applyTheoryOfMindUpdates(model, text, amygdalaResult, config);

  persistModels();
  bus.emit("mirror:user-updated", model);

  return model;
}

// ── Theory of Mind (ToM) — Intent inference & relationship depth ───
//
// The human brain maintains a "theory of mind" — an ongoing model of
// what others know, want, feel, and intend. These functions extend
// the existing mirror-neuron empathy model with richer user modeling:
// intent classification, per-domain knowledge estimation, mental state
// tracking, interaction pattern analysis, and relationship depth.

type InferredIntent =
  | "seeking_information"
  | "requesting_action"
  | "seeking_support"
  | "acknowledging"
  | "exploring_topic"
  | "expressing_frustration"
  | "unknown";

const QUESTION_PATTERNS = [
  /\?/,
  /^(как|что|почему|зачем|когда|где|кто|какой|сколько|можно\s+ли)/i,
  /^(how|what|why|when|where|who|which|can\s+you|could\s+you|is\s+it)/i,
];

const COMMAND_PATTERNS = [
  /^(сделай|создай|запусти|удали|измени|добавь|покажи|напиши|найди|открой|установи)/i,
  /^(do|create|run|delete|change|add|show|write|find|open|install|make|build|fix|set)/i,
];

const FRUSTRATION_PATTERNS = [
  /не работает/i,
  /опять/i,
  /doesn'?t work/i,
  /still broken/i,
  /again/i,
  /wtf/i,
  /блин|чёрт|черт/i,
];

/**
 * Ensure all Theory of Mind fields exist on a model (handles old storage).
 */
function ensureToMFields(model: UserModel): void {
  if (!model.inferredGoals) model.inferredGoals = [];
  if (!model.knowledgeModel) model.knowledgeModel = {};
  if (!model.interactionPatterns) {
    model.interactionPatterns = {
      avgResponseTimeMs: 0,
      preferredTopics: [],
      peakHoursUTC: [],
      engagementStyle: "sporadic",
    };
  }
  if (model.relationshipDepth == null) model.relationshipDepth = 0;
  if (!model.mentalState) {
    model.mentalState = { currentFocus: null, frustrationLevel: 0, engagementLevel: 0.5 };
  }
  if (!model.intentHistory) model.intentHistory = [];
}

/**
 * Main orchestrator: runs all Theory of Mind updates after base observation.
 */
function applyTheoryOfMindUpdates(
  model: UserModel,
  text: string,
  amygdalaResult: AmygdalaAssessment,
  config: BrainAgentConfig,
): void {
  ensureToMFields(model);

  const maxIntentHistory = config.empathy.maxIntentHistory ?? 20;
  const domainLimit = config.empathy.knowledgeModelDomainLimit ?? 15;

  // 1. Infer intent from text
  const { intent, confidence } = inferIntent(text);

  // Record in history
  model.intentHistory.push({ timestamp: Date.now(), inferredIntent: intent, confidence });
  if (model.intentHistory.length > maxIntentHistory) {
    model.intentHistory = model.intentHistory.slice(-maxIntentHistory);
  }

  // Emit intent event
  if (confidence > 0.3) {
    bus.emit("mirror:intent-inferred", { userId: model.userId, intent, confidence });
  }

  // 2. Update inferred goals from intent patterns
  updateInferredGoals(model);

  // 3. Update knowledge model
  updateKnowledgeModelToM(model, text, domainLimit);

  // 4. Update mental state
  updateMentalState(model, text, amygdalaResult);

  // 5. Update interaction patterns
  updateInteractionPatterns(model);

  // 6. Compute relationship depth
  const prevDepth = model.relationshipDepth;
  model.relationshipDepth = computeRelationshipDepth(model);

  // 7. Check relationship milestones
  checkRelationshipMilestones(model, prevDepth, model.relationshipDepth);
}

/**
 * Classify user intent from text patterns (no LLM needed).
 */
function inferIntent(text: string): { intent: InferredIntent; confidence: number } {
  const trimmed = text.trim();

  // Frustration check (highest priority)
  const frustrationHits = FRUSTRATION_PATTERNS.filter((p) => p.test(trimmed)).length;
  if (frustrationHits >= 1) {
    return {
      intent: "expressing_frustration",
      confidence: Math.min(0.5 + frustrationHits * 0.15, 0.95),
    };
  }

  // Question patterns
  const questionHits = QUESTION_PATTERNS.filter((p) => p.test(trimmed)).length;
  if (questionHits >= 1) {
    return {
      intent: "seeking_information",
      confidence: Math.min(0.5 + questionHits * 0.2, 0.95),
    };
  }

  // Command patterns
  const commandHits = COMMAND_PATTERNS.filter((p) => p.test(trimmed)).length;
  if (commandHits >= 1) {
    return {
      intent: "requesting_action",
      confidence: Math.min(0.6 + commandHits * 0.15, 0.95),
    };
  }

  // Short acknowledgment
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount <= 4) {
    const ackPatterns = [
      /^(ок|да|нет|понял|спасибо|ясно|хорошо|ладно|ага)/i,
      /^(ok|yes|no|got it|thanks|sure|right|yeah|yep|nope|cool)/i,
    ];
    if (ackPatterns.some((p) => p.test(trimmed))) {
      return { intent: "acknowledging", confidence: 0.7 };
    }
  }

  // Support-seeking
  const supportPatterns = [
    /помоги|не знаю что делать|запутал/i,
    /help me|i don'?t know|confused|stuck|lost/i,
  ];
  if (supportPatterns.some((p) => p.test(trimmed))) {
    return { intent: "seeking_support", confidence: 0.6 };
  }

  // Longer text → exploring topic
  if (wordCount > 8) {
    return { intent: "exploring_topic", confidence: 0.4 };
  }

  return { intent: "unknown", confidence: 0.2 };
}

/**
 * Derive user's top goals from recent intent patterns.
 */
function updateInferredGoals(model: UserModel): void {
  const recent = model.intentHistory.slice(-15);
  if (recent.length < 3) return;

  const intentCounts = new Map<string, number>();
  for (const entry of recent) {
    if (entry.inferredIntent === "unknown" || entry.inferredIntent === "acknowledging") continue;
    intentCounts.set(entry.inferredIntent, (intentCounts.get(entry.inferredIntent) ?? 0) + 1);
  }

  const goals: string[] = [];
  const infoCount = intentCounts.get("seeking_information") ?? 0;
  const actionCount = intentCounts.get("requesting_action") ?? 0;
  const exploreCount = intentCounts.get("exploring_topic") ?? 0;
  const frustCount = intentCounts.get("expressing_frustration") ?? 0;

  if (infoCount >= 3) goals.push("learning and understanding");
  if (actionCount >= 3) goals.push("building or creating something");
  if (exploreCount >= 2) goals.push("exploring new ideas");
  if (frustCount >= 2) goals.push("resolving a persistent problem");
  if (infoCount + actionCount >= 5) goals.push("active project development");

  model.inferredGoals = goals.slice(0, 5);
}

/**
 * Track per-domain knowledge levels from topic frequency and expertise signals.
 */
function updateKnowledgeModelToM(model: UserModel, text: string, domainLimit: number): void {
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 5)
    .map((w) => w.replace(/[^a-zA-Zа-яА-ЯёЁ0-9-]/g, ""))
    .filter(Boolean);

  const domainSignals = words.slice(0, 3);

  for (const domain of domainSignals) {
    const current = model.knowledgeModel[domain];
    if (!current) {
      model.knowledgeModel[domain] = "beginner";
    } else if (current === "beginner") {
      const topicFreq = model.frequentTopics.filter(
        (t) => t.includes(domain) || domain.includes(t),
      ).length;
      if (topicFreq >= 3) model.knowledgeModel[domain] = "familiar";
    } else if (current === "familiar") {
      const topicFreq = model.frequentTopics.filter(
        (t) => t.includes(domain) || domain.includes(t),
      ).length;
      if (topicFreq >= 7) model.knowledgeModel[domain] = "expert";
    }
  }

  // Cap domain count — remove least-mentioned domains
  const domains = Object.keys(model.knowledgeModel);
  if (domains.length > domainLimit) {
    const sorted = domains.sort((a, b) => {
      const aFreq = model.frequentTopics.filter((t) => t.includes(a)).length;
      const bFreq = model.frequentTopics.filter((t) => t.includes(b)).length;
      return aFreq - bFreq;
    });
    for (const d of sorted.slice(0, domains.length - domainLimit)) {
      delete model.knowledgeModel[d];
    }
  }
}

/**
 * Update mental state estimation from amygdala result and text signals.
 */
function updateMentalState(
  model: UserModel,
  text: string,
  amygdalaResult: AmygdalaAssessment,
): void {
  const frustEmotions = new Set(["frustration", "anger"]);
  const amygdalaFrustration = frustEmotions.has(amygdalaResult.emotion)
    ? amygdalaResult.emotionIntensity
    : 0;
  const textFrustration = FRUSTRATION_PATTERNS.some((p) => p.test(text)) ? 0.4 : 0;
  const alpha = 0.4;
  model.mentalState.frustrationLevel =
    model.mentalState.frustrationLevel * (1 - alpha) +
    Math.max(amygdalaFrustration, textFrustration) * alpha;

  // Engagement: estimate from message length
  const wordCount = text.split(/\s+/).length;
  const rawEngagement = Math.min(wordCount / 50, 1.0);
  model.mentalState.engagementLevel = model.mentalState.engagementLevel * 0.6 + rawEngagement * 0.4;

  // Current focus: most significant words
  const significant = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 5)
    .slice(0, 3);
  model.mentalState.currentFocus = significant.length > 0 ? significant.join(", ") : null;
}

/**
 * Track interaction timing patterns (response cadence, peak hours, engagement style).
 */
function updateInteractionPatterns(model: UserModel): void {
  const now = Date.now();
  const lastSeen = model.lastSeen || now;
  const gap = now - lastSeen;

  // Update average response time (EMA) — only count gaps under 24h
  if (gap > 0 && gap < 24 * 60 * 60 * 1000) {
    const prevAvg = model.interactionPatterns.avgResponseTimeMs || gap;
    model.interactionPatterns.avgResponseTimeMs = prevAvg * 0.7 + gap * 0.3;
  }

  // Track peak hours (UTC)
  const hourUTC = new Date(now).getUTCHours();
  if (!model.interactionPatterns.peakHoursUTC.includes(hourUTC)) {
    model.interactionPatterns.peakHoursUTC.push(hourUTC);
    if (model.interactionPatterns.peakHoursUTC.length > 6) {
      model.interactionPatterns.peakHoursUTC = model.interactionPatterns.peakHoursUTC.slice(-6);
    }
  }

  // Preferred topics: sync from top frequent topics
  model.interactionPatterns.preferredTopics = model.frequentTopics.slice(-10);

  // Engagement style: based on average response time
  const avgMs = model.interactionPatterns.avgResponseTimeMs;
  if (avgMs > 0 && avgMs < 5 * 60 * 1000) {
    model.interactionPatterns.engagementStyle = "active";
  } else if (avgMs < 60 * 60 * 1000) {
    model.interactionPatterns.engagementStyle = "sporadic";
  } else {
    model.interactionPatterns.engagementStyle = "passive";
  }
}

/**
 * Compute relationship depth (0-1) from interaction count, topic diversity, and time span.
 * Formula: interactionFactor * 0.4 + topicFactor * 0.3 + timeFactor * 0.3
 */
function computeRelationshipDepth(model: UserModel): number {
  const interactionCount = model.emotionHistory.length;
  const interactionFactor = Math.min(interactionCount / 100, 1.0);

  const topicDiversity = model.frequentTopics.length;
  const topicFactor = Math.min(topicDiversity / 20, 1.0);

  const firstInteraction = model.emotionHistory[0]?.timestamp ?? Date.now();
  const timeSpanMs = Date.now() - firstInteraction;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const timeFactor = Math.min(timeSpanMs / thirtyDaysMs, 1.0);

  return interactionFactor * 0.4 + topicFactor * 0.3 + timeFactor * 0.3;
}

/**
 * Emit relationship milestone events when crossing thresholds.
 */
function checkRelationshipMilestones(model: UserModel, prevDepth: number, newDepth: number): void {
  const milestones = [
    { threshold: 0.25, label: "acquaintance" },
    { threshold: 0.5, label: "familiar" },
    { threshold: 0.75, label: "deep" },
  ];

  for (const { threshold, label } of milestones) {
    if (prevDepth < threshold && newDepth >= threshold) {
      bus.emit("mirror:relationship-deepened", {
        userId: model.userId,
        depth: newDepth,
        milestone: label,
      });
    }
  }
}

/**
 * Build a Theory of Mind context block for prompt injection.
 */
export function buildTheoryOfMindContext(model: UserModel): string {
  ensureToMFields(model);

  if (model.emotionHistory.length < 3) return "";

  const lines: string[] = ["## Theory of Mind"];

  if (model.mentalState.currentFocus) {
    lines.push(`Current focus: ${model.mentalState.currentFocus}`);
  }

  if (model.inferredGoals.length > 0) {
    lines.push(`Inferred goals: ${model.inferredGoals.join(", ")}`);
  }

  const knownDomains = Object.entries(model.knowledgeModel)
    .filter(([, level]) => level !== "unknown")
    .slice(0, 5);
  if (knownDomains.length > 0) {
    const domainStr = knownDomains.map(([d, l]) => `${d} (${l})`).join(", ");
    lines.push(`Domain knowledge: ${domainStr}`);
  }

  if (model.mentalState.frustrationLevel > 0.3) {
    lines.push("Warning: user appears frustrated");
  }
  if (model.mentalState.engagementLevel > 0.7) {
    lines.push("User is highly engaged");
  }

  if (model.relationshipDepth > 0.1) {
    const depthLabel =
      model.relationshipDepth >= 0.75
        ? "deep"
        : model.relationshipDepth >= 0.5
          ? "familiar"
          : model.relationshipDepth >= 0.25
            ? "acquaintance"
            : "new";
    lines.push(`Relationship: ${depthLabel}`);
  }

  if (model.interactionPatterns.engagementStyle !== "sporadic") {
    lines.push(`Engagement style: ${model.interactionPatterns.engagementStyle}`);
  }

  return lines.length > 1 ? lines.join("\n") : "";
}
