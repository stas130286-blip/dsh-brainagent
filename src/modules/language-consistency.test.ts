import { describe, expect, it } from "vitest";

import { validate } from "./cerebellum.ts";
import { identifyImplicatedModule } from "./learning-coordinator.ts";
import type { UserModel } from "./types/core.ts";

function userModel(language: string): UserModel {
  return {
    userId: "test-user",
    moodTrend: "neutral",
    stressLevel: 0,
    communicationStyle: "informal",
    language,
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
    inferredGoals: [],
    knowledgeModel: {},
    interactionPatterns: {
      avgResponseTimeMs: 0,
      preferredTopics: [],
      peakHoursUTC: [],
      engagementStyle: "active",
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

function mismatchIssues(response: string, language: string): string[] {
  const result = validate(
    response,
    "расскажи про систему",
    undefined,
    undefined,
    userModel(language),
  );
  return result.issues.filter((i) => i.includes("Language mismatch"));
}

describe("checkLanguageConsistency (v0.9.17)", () => {
  it("ignores English inside code blocks and links within a Russian response", () => {
    const response = [
      "Конечно, вот что получилось после проверки системы.",
      "",
      "```ts",
      "const instance = createMirrorNeurons(workspaceDir);",
      "await instance.observe(userId, text, assessment, config);",
      "```",
      "",
      "Как видите, модуль инициализируется корректно и сохраняет состояние на диск.",
      "Документация: https://example.com/very/long/english/path/to/the/documentation",
      "Если появятся вопросы по настройке, спрашивайте, я помогу разобраться.",
    ].join("\n");
    expect(mismatchIssues(response, "ru")).toEqual([]);
  });

  it("still flags a genuinely English response to a Russian user", () => {
    const response =
      "This is a completely English answer which should be detected as a real " +
      "mismatch because the user model clearly states the person speaks Russian.";
    expect(mismatchIssues(response, "ru")).toHaveLength(1);
  });

  it("does not flag mixed bilingual text", () => {
    const cyr = "абвгдежзиклмнопрстуфхцчшщэюя".repeat(3); // 84 cyrillic
    const lat = "abcdefghijklmnopqrstuvwxyz".repeat(2) + "abcdefghijklmnopqr"; // 70 latin
    expect(mismatchIssues(cyr + " " + lat, "ru")).toEqual([]);
  });

  it("skips short responses entirely", () => {
    expect(mismatchIssues("ok done", "ru")).toEqual([]);
  });

  it("does not flag when user language is unknown", () => {
    const response =
      "This is an English response but the user language is unknown so nothing should fire here.";
    expect(mismatchIssues(response, "unknown")).toEqual([]);
  });
});

describe("identifyImplicatedModule (v0.9.17)", () => {
  it("does not blame mirrorNeurons for language mismatches", () => {
    expect(
      identifyImplicatedModule(
        "Language mismatch: user communicates in ru but response is primarily in en.",
      ),
    ).toBeUndefined();
  });

  it("still attributes brevity issues to prefrontalCortex", () => {
    expect(
      identifyImplicatedModule("Response seems too brief for a complex question."),
    ).toBe("prefrontalCortex");
  });
});
