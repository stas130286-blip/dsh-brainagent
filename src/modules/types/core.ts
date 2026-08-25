// ── Signal classification produced by the Thalamus ──────────────────

export type MessageModality = "text" | "image" | "voice" | "file" | "mixed";

export type MessageDomain =
  | "technical"
  | "creative"
  | "casual"
  | "emotional"
  | "factual"
  | "command"
  | "unknown";

export type MessageComplexity = "trivial" | "simple" | "moderate" | "complex" | "extreme";

export type ContextTier = "core" | "situational" | "reflective";

export type ThalamusClassification = {
  modality: MessageModality;
  domain: MessageDomain;
  complexity: MessageComplexity;
  intentSummary: string;
  /** 0-1: how confident the classifier is */
  confidence: number;
  /** fast path = System 1, slow path = System 2 */
  processingPath: "fast" | "slow";
};

// ── Priority vector produced by the Amygdala ────────────────────────

export type EmotionLabel =
  | "neutral"
  | "joy"
  | "frustration"
  | "anxiety"
  | "curiosity"
  | "confusion"
  | "gratitude"
  | "urgency"
  | "anger"
  | "sadness";

export type AmygdalaAssessment = {
  /** 0-1 */
  urgency: number;
  /** 0-1 */
  importance: number;
  emotion: EmotionLabel;
  /** 0-1 */
  emotionIntensity: number;
  /** Whether we should activate empathy mode */
  empathyNeeded: boolean;
  /** Short reasoning string */
  rationale: string;
};

// ── User model maintained by Mirror Neurons ─────────────────────────

export type CommunicationStyle = "formal" | "informal" | "terse" | "verbose";

export type UserModel = {
  userId: string;
  /** General mood trend across recent messages */
  moodTrend: EmotionLabel;
  /** 0-1: how stressed the user appears */
  stressLevel: number;
  /** Detected communication style from the latest message */
  communicationStyle: CommunicationStyle;
  /** Language preference */
  language: string;
  /** Expertise level in current topic */
  expertiseLevel: "beginner" | "intermediate" | "expert";
  /** Last N emotion readings for trend analysis */
  emotionHistory: Array<{ timestamp: number; emotion: EmotionLabel; intensity: number }>;
  /** Topics the user frequently discusses */
  frequentTopics: string[];
  /** Last interaction timestamp */
  lastSeen: number;

  // ── Personality Evolution (reward-driven style adaptation) ──────
  /**
   * Per-style accumulated reward. The dopamine system feeds reward
   * signals here so the mirror neurons learn which response style
   * the user prefers over time. Higher total reward = more preferred.
   */
  styleRewards: Record<CommunicationStyle, { total: number; count: number }>;
  /**
   * The response style recommended for this user based on reward history.
   * Starts as the detected style, then evolves as reward data accumulates.
   */
  preferredResponseStyle: CommunicationStyle;

  // ── Theory of Mind extensions ────────────────────────────────────
  /** Inferred user goals from conversation patterns (up to 5) */
  inferredGoals: string[];
  /** Per-domain knowledge estimates */
  knowledgeModel: Record<string, "unknown" | "beginner" | "familiar" | "expert">;
  /** Behavioral interaction patterns */
  interactionPatterns: {
    avgResponseTimeMs: number;
    preferredTopics: string[];
    peakHoursUTC: number[];
    engagementStyle: "active" | "passive" | "sporadic";
  };
  /** Relationship depth 0-1 (interaction count + topic intimacy + time span) */
  relationshipDepth: number;
  /** Real-time mental state estimation */
  mentalState: {
    currentFocus: string | null;
    frustrationLevel: number;
    engagementLevel: number;
  };
  /** Recent intent classifications */
  intentHistory: Array<{ timestamp: number; inferredIntent: string; confidence: number }>;
};

// ── Multi-layer memory types (Hippocampus) ──────────────────────────

export type MemoryLayer = "working" | "episodic" | "semantic" | "procedural";

export type EpisodicMemory = {
  id: string;
  timestamp: number;
  summary: string;
  /** What happened */
  event: string;
  /** Emotional context at the time */
  emotionalContext: EmotionLabel;
  /** Key entities involved */
  entities: string[];
  /** How important (0-1), decays over time */
  salience: number;
  /** How many times this was recalled (strengthens on access) */
  accessCount: number;
};

export type SemanticMemory = {
  id: string;
  /** The fact or knowledge */
  content: string;
  /** Category: user_preference, fact, relationship, etc. */
  category: string;
  /** Related memory IDs for graph traversal */
  relatedIds: string[];
  /** Confidence in this fact (0-1) */
  confidence: number;
  /** Source: which episodic memories led to this */
  sourceEpisodeIds: string[];
  createdAt: number;
  updatedAt: number;
  /**
   * Memory reconsolidation trail — previous versions of this fact.
   * Like the faint human memory of "I used to think X but now I know Y".
   * Capped at 5 entries (oldest trimmed first).
   */
  revisionHistory?: RevisionRecord[];
};

/**
 * A snapshot of a fact before it was revised (memory reconsolidation).
 * Preserves the old belief so the agent can recall "I updated my understanding".
 */
export type RevisionRecord = {
  previousContent: string;
  previousConfidence: number;
  revisedAt: number;
  reason: string;
  sourceEpisodeIds: string[];
};

export type ProceduralMemory = {
  id: string;
  /** What this procedure does */
  description: string;
  /** Pattern that triggers this procedure */
  triggerPattern: string;
  /** Sequence of steps/tools to execute */
  steps: string[];
  /** Success rate from past usage (0-1) */
  successRate: number;
  /** How many times used */
  usageCount: number;
  lastUsed: number;
};

// ── Consolidated brain state for a single processing cycle ──────────

export type BrainState = {
  /** Raw input text */
  input: string;
  /** Thalamus classification */
  classification?: ThalamusClassification;
  /** Amygdala priority assessment */
  priority?: AmygdalaAssessment;
  /** Current user model snapshot */
  userModel?: UserModel;
  /** Retrieved memories relevant to this input */
  relevantMemories: {
    episodic: EpisodicMemory[];
    semantic: SemanticMemory[];
    procedural: ProceduralMemory[];
  };
  /** Model override from prefrontal cortex */
  modelOverride?: string;
  /** Additional context to prepend to the prompt */
  contextInjections: string[];
};
