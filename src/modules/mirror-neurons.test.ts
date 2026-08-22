import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initMirrorStorage,
  getOrCreateModel,
  getUserModel,
  observe,
  processStyleReward,
  getStyleRecommendation,
  buildTheoryOfMindContext,
} from "./mirror-neurons.ts";
import type { AmygdalaAssessment } from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";

let tempDir: string;

function makeAssessment(overrides: Partial<AmygdalaAssessment> = {}): AmygdalaAssessment {
  return {
    urgency: 0.1,
    importance: 0.3,
    emotion: "neutral",
    emotionIntensity: 0,
    empathyNeeded: false,
    rationale: "routine message",
    ...overrides,
  };
}

describe("Mirror Neurons (user modeling)", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-mirror-"));
    initMirrorStorage(tempDir);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  // ── Model creation ──────────────────────────────────────────

  describe("model creation", () => {
    it("creates a default model for new user", () => {
      const model = getOrCreateModel("user1");
      expect(model.userId).toBe("user1");
      expect(model.moodTrend).toBe("neutral");
      expect(model.stressLevel).toBe(0.2);
      expect(model.communicationStyle).toBe("informal");
      expect(model.emotionHistory).toHaveLength(0);
    });

    it("returns existing model on second call", () => {
      const m1 = getOrCreateModel("user1");
      m1.stressLevel = 0.9;
      const m2 = getOrCreateModel("user1");
      expect(m2.stressLevel).toBe(0.9);
    });

    it("getUserModel returns undefined for unknown user", () => {
      expect(getUserModel("nonexistent")).toBeUndefined();
    });

    it("getUserModel returns existing model", () => {
      getOrCreateModel("user1");
      expect(getUserModel("user1")).toBeDefined();
    });
  });

  // ── Observation ─────────────────────────────────────────────

  describe("observe()", () => {
    it("adds emotion to history", () => {
      const model = observe(
        "user1",
        "тестовое сообщение",
        makeAssessment({ emotion: "joy", emotionIntensity: 0.7 }),
        DEFAULT_CONFIG,
      );
      expect(model.emotionHistory.length).toBe(1);
      expect(model.emotionHistory[0].emotion).toBe("joy");
    });

    it("trims history to configured length", () => {
      const config = { ...DEFAULT_CONFIG, empathy: { emotionHistoryLength: 3 } };
      for (let i = 0; i < 5; i++) {
        observe("user1", `msg ${i}`, makeAssessment({ emotion: "neutral" }), config);
      }
      const model = getUserModel("user1");
      expect(model!.emotionHistory.length).toBeLessThanOrEqual(3);
    });

    it("updates lastSeen timestamp", () => {
      const before = Date.now();
      const model = observe("user1", "hello", makeAssessment(), DEFAULT_CONFIG);
      expect(model.lastSeen).toBeGreaterThanOrEqual(before);
    });

    it("updates stress level higher for stressed emotions", () => {
      const model = getOrCreateModel("user1");
      const initialStress = model.stressLevel;
      observe(
        "user1",
        "всё сломалось срочно",
        makeAssessment({ emotion: "frustration", emotionIntensity: 0.9 }),
        DEFAULT_CONFIG,
      );
      expect(model.stressLevel).toBeGreaterThan(initialStress);
    });

    it("stress level decreases for calm emotions", () => {
      // First stress it up
      observe(
        "user1",
        "бесит",
        makeAssessment({ emotion: "anger", emotionIntensity: 0.8 }),
        DEFAULT_CONFIG,
      );
      const stressed = getUserModel("user1")!.stressLevel;

      // Then calm it down
      observe(
        "user1",
        "всё хорошо",
        makeAssessment({ emotion: "neutral", emotionIntensity: 0 }),
        DEFAULT_CONFIG,
      );
      observe(
        "user1",
        "спокойно",
        makeAssessment({ emotion: "neutral", emotionIntensity: 0 }),
        DEFAULT_CONFIG,
      );
      expect(getUserModel("user1")!.stressLevel).toBeLessThan(stressed);
    });
  });

  // ── Style detection ─────────────────────────────────────────

  describe("communication style", () => {
    it("detects terse style for very short messages", () => {
      const model = observe("user1", "ок", makeAssessment(), DEFAULT_CONFIG);
      expect(model.communicationStyle).toBe("terse");
    });

    it("detects formal style with formal markers", () => {
      const model = observe(
        "user1",
        "Уважаемый коллега, пожалуйста помогите мне с настройкой",
        makeAssessment(),
        DEFAULT_CONFIG,
      );
      expect(model.communicationStyle).toBe("formal");
    });

    it("detects verbose style for long messages", () => {
      const longMsg = Array.from({ length: 100 }, (_, i) => `слово${i}`).join(" ");
      const model = observe("user1", longMsg, makeAssessment(), DEFAULT_CONFIG);
      expect(model.communicationStyle).toBe("verbose");
    });

    it("defaults to informal", () => {
      const model = observe(
        "user1",
        "привет, помоги мне настроить проект",
        makeAssessment(),
        DEFAULT_CONFIG,
      );
      expect(model.communicationStyle).toBe("informal");
    });
  });

  // ── Language detection ───────────────────────────────────────

  describe("language detection", () => {
    it("detects Russian language", () => {
      const model = observe("user1", "привет мир как дела", makeAssessment(), DEFAULT_CONFIG);
      expect(model.language).toBe("ru");
    });

    it("detects English language", () => {
      const model = observe("user1", "hello world how are you", makeAssessment(), DEFAULT_CONFIG);
      expect(model.language).toBe("en");
    });

    it("returns unknown for no letters", () => {
      const model = observe("user1", "123 456 789", makeAssessment(), DEFAULT_CONFIG);
      expect(model.language).toBe("unknown");
    });
  });

  // ── Mood trend ──────────────────────────────────────────────

  describe("mood trend", () => {
    it("neutral with empty history", () => {
      const model = getOrCreateModel("user1");
      expect(model.moodTrend).toBe("neutral");
    });

    it("tracks dominant recent emotion", () => {
      observe(
        "user1",
        "frustrating",
        makeAssessment({ emotion: "frustration", emotionIntensity: 0.8 }),
        DEFAULT_CONFIG,
      );
      observe(
        "user1",
        "still frustrated",
        makeAssessment({ emotion: "frustration", emotionIntensity: 0.7 }),
        DEFAULT_CONFIG,
      );
      observe(
        "user1",
        "ok fine",
        makeAssessment({ emotion: "neutral", emotionIntensity: 0.1 }),
        DEFAULT_CONFIG,
      );
      const model = getUserModel("user1")!;
      expect(model.moodTrend).toBe("frustration");
    });
  });

  // ── Topic extraction ────────────────────────────────────────

  describe("topics", () => {
    it("extracts significant words as topics", () => {
      const model = observe(
        "user1",
        "typescript programming deployment docker kubernetes",
        makeAssessment(),
        DEFAULT_CONFIG,
      );
      expect(model.frequentTopics.length).toBeGreaterThan(0);
      expect(model.frequentTopics.some((t) => t.includes("typescript"))).toBe(true);
    });

    it("limits topics to 30", () => {
      const words = Array.from({ length: 50 }, (_, i) => `longtopic${i}`).join(" ");
      observe("user1", words, makeAssessment(), DEFAULT_CONFIG);
      const model = getUserModel("user1")!;
      expect(model.frequentTopics.length).toBeLessThanOrEqual(30);
    });
  });

  // ── Personality Evolution ────────────────────────────────────

  describe("personality evolution (reward-driven style)", () => {
    it("initializes styleRewards on new model", () => {
      const model = getOrCreateModel("user1");
      expect(model.styleRewards).toBeDefined();
      expect(model.styleRewards.formal.count).toBe(0);
      expect(model.styleRewards.informal.count).toBe(0);
      expect(model.preferredResponseStyle).toBe("informal");
    });

    it("processStyleReward accumulates per-style rewards", () => {
      getOrCreateModel("user1");
      processStyleReward("user1", 0.8, "formal");
      processStyleReward("user1", 0.6, "formal");
      processStyleReward("user1", -0.3, "terse");

      const model = getUserModel("user1")!;
      expect(model.styleRewards.formal.count).toBe(2);
      expect(model.styleRewards.formal.total).toBeCloseTo(1.4);
      expect(model.styleRewards.terse.count).toBe(1);
      expect(model.styleRewards.terse.total).toBeCloseTo(-0.3);
    });

    it("evolves preferred style toward highest-rewarded style", () => {
      getOrCreateModel("user1");

      // Give formal consistently high rewards
      for (let i = 0; i < 6; i++) {
        processStyleReward("user1", 0.7, "formal");
      }
      // Give informal low rewards
      for (let i = 0; i < 4; i++) {
        processStyleReward("user1", -0.2, "informal");
      }

      const model = getUserModel("user1")!;
      expect(model.preferredResponseStyle).toBe("formal");
    });

    it("needs minimum samples before switching preference", () => {
      getOrCreateModel("user1");

      // Only 2 interactions — not enough to switch
      processStyleReward("user1", 0.9, "verbose");
      processStyleReward("user1", 0.8, "verbose");

      const model = getUserModel("user1")!;
      // Still default because totalSamples < 5
      expect(model.preferredResponseStyle).toBe("informal");
    });

    it("getStyleRecommendation returns undefined when not enough data", () => {
      getOrCreateModel("user1");
      const rec = getStyleRecommendation("user1");
      expect(rec).toBeUndefined();
    });

    it("getStyleRecommendation returns recommendation after enough samples", () => {
      getOrCreateModel("user1");

      // Build up enough history for a recommendation
      for (let i = 0; i < 8; i++) {
        processStyleReward("user1", 0.6, "terse");
      }
      for (let i = 0; i < 3; i++) {
        processStyleReward("user1", -0.1, "informal");
      }

      const rec = getStyleRecommendation("user1");
      expect(rec).toBeDefined();
      expect(rec!.style).toBe("terse");
      expect(rec!.confidence).toBeGreaterThan(0);
      expect(rec!.context).toContain("terse");
      expect(rec!.context).toContain("Communication Style Adaptation");
    });

    it("adapts when user preference changes over time", () => {
      getOrCreateModel("user1");

      // Phase 1: user prefers formal
      for (let i = 0; i < 10; i++) {
        processStyleReward("user1", 0.7, "formal");
      }
      for (let i = 0; i < 5; i++) {
        processStyleReward("user1", -0.1, "informal");
      }
      expect(getUserModel("user1")!.preferredResponseStyle).toBe("formal");

      // Phase 2: user switches to preferring verbose (more samples to overcome)
      for (let i = 0; i < 20; i++) {
        processStyleReward("user1", 0.8, "verbose");
      }
      for (let i = 0; i < 10; i++) {
        processStyleReward("user1", -0.3, "formal");
      }

      expect(getUserModel("user1")!.preferredResponseStyle).toBe("verbose");
    });
  });

  // ── Theory of Mind ────────────────────────────────────────────

  describe("Theory of Mind", () => {
    it("initializes ToM fields on new model", () => {
      const model = getOrCreateModel("user1");
      expect(model.inferredGoals).toEqual([]);
      expect(model.knowledgeModel).toEqual({});
      expect(model.relationshipDepth).toBe(0);
      expect(model.mentalState).toBeDefined();
      expect(model.mentalState.frustrationLevel).toBe(0);
      expect(model.intentHistory).toEqual([]);
    });

    it("infers seeking_information intent from questions", () => {
      const model = observe(
        "user1",
        "Как настроить TypeScript для проекта?",
        makeAssessment(),
        DEFAULT_CONFIG,
      );
      expect(model.intentHistory.length).toBe(1);
      expect(model.intentHistory[0].inferredIntent).toBe("seeking_information");
      expect(model.intentHistory[0].confidence).toBeGreaterThan(0.3);
    });

    it("infers requesting_action intent from commands", () => {
      const model = observe(
        "user1",
        "создай новый файл конфигурации",
        makeAssessment(),
        DEFAULT_CONFIG,
      );
      expect(model.intentHistory[0].inferredIntent).toBe("requesting_action");
    });

    it("infers expressing_frustration from frustration patterns", () => {
      const model = observe(
        "user1",
        "это опять не работает блин",
        makeAssessment({ emotion: "frustration", emotionIntensity: 0.7 }),
        DEFAULT_CONFIG,
      );
      expect(model.intentHistory[0].inferredIntent).toBe("expressing_frustration");
      expect(model.mentalState.frustrationLevel).toBeGreaterThan(0);
    });

    it("infers acknowledging from short affirmations", () => {
      const model = observe("user1", "ок", makeAssessment(), DEFAULT_CONFIG);
      expect(model.intentHistory[0].inferredIntent).toBe("acknowledging");
    });

    it("updates knowledge model with domain words", () => {
      observe("user1", "typescript programming configuration", makeAssessment(), DEFAULT_CONFIG);
      const model = getUserModel("user1")!;
      expect(Object.keys(model.knowledgeModel).length).toBeGreaterThan(0);
    });

    it("tracks interaction patterns", () => {
      observe("user1", "first message for testing", makeAssessment(), DEFAULT_CONFIG);
      observe("user1", "second message for testing", makeAssessment(), DEFAULT_CONFIG);
      const model = getUserModel("user1")!;
      expect(model.interactionPatterns.peakHoursUTC.length).toBeGreaterThan(0);
      expect(model.interactionPatterns.preferredTopics.length).toBeGreaterThanOrEqual(0);
    });

    it("computes relationship depth from interaction count", () => {
      // Build up some history
      for (let i = 0; i < 10; i++) {
        observe(
          "user1",
          `message number ${i} about various topics`,
          makeAssessment(),
          DEFAULT_CONFIG,
        );
      }
      const model = getUserModel("user1")!;
      expect(model.relationshipDepth).toBeGreaterThan(0);
    });

    it("builds theory of mind context only after sufficient history", () => {
      const model = getOrCreateModel("user1");
      // No history yet — should return empty
      const ctx = buildTheoryOfMindContext(model);
      expect(ctx).toBe("");

      // Build up enough history
      for (let i = 0; i < 5; i++) {
        observe(
          "user1",
          `interesting question about typescript ${i}?`,
          makeAssessment(),
          DEFAULT_CONFIG,
        );
      }
      const updatedModel = getUserModel("user1")!;
      const ctxAfter = buildTheoryOfMindContext(updatedModel);
      expect(ctxAfter).toContain("Theory of Mind");
      // Verify no raw numbers leak into context
      expect(ctxAfter).not.toMatch(/level:\s*0\.\d+/);
      expect(ctxAfter).not.toMatch(/\d+%/);
    });

    it("limits intentHistory to configured maximum", () => {
      const config = {
        ...DEFAULT_CONFIG,
        empathy: { ...DEFAULT_CONFIG.empathy, maxIntentHistory: 5 },
      };
      for (let i = 0; i < 10; i++) {
        observe("user1", `message ${i} for testing intent history`, makeAssessment(), config);
      }
      const model = getUserModel("user1")!;
      expect(model.intentHistory.length).toBeLessThanOrEqual(5);
    });

    it("updates engagement level based on message length", () => {
      // Short message = low engagement
      observe("user1", "ок", makeAssessment(), DEFAULT_CONFIG);
      const afterShort = getUserModel("user1")!.mentalState.engagementLevel;

      // Long message = higher engagement
      const longMsg = Array.from({ length: 40 }, (_, i) => `interesting_word_${i}`).join(" ");
      observe("user1", longMsg, makeAssessment(), DEFAULT_CONFIG);
      const afterLong = getUserModel("user1")!.mentalState.engagementLevel;
      expect(afterLong).toBeGreaterThan(afterShort);
    });

    it("updates engagement style based on response time", () => {
      observe("user1", "first message testing engagement", makeAssessment(), DEFAULT_CONFIG);
      // Second message immediately after → should be "active"
      observe("user1", "second message testing engagement", makeAssessment(), DEFAULT_CONFIG);
      const model = getUserModel("user1")!;
      // Style should be set (active, sporadic, or passive)
      expect(["active", "sporadic", "passive"]).toContain(
        model.interactionPatterns.engagementStyle,
      );
    });
  });
});
