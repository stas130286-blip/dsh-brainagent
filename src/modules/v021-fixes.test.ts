/**
 * v0.2.1 hotfix tests:
 *  1. message-guard — фильтрация собственных инъекций плагина;
 *  2. procedural-extractor — брак-контроль триггеров workflow;
 *  3. learning-coordinator — error rate не выше 100%;
 *  4. cerebellum / mirror-neurons — устойчивое определение языка.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { bus } from "./event-bus.ts";
import { validate } from "./cerebellum.ts";
import { initLearningCoordinator, getLearningStats } from "./learning-coordinator.ts";
import { isInternalPluginMessage } from "./message-guard.ts";
import { observe } from "./mirror-neurons.ts";
import { extractProcedure } from "./procedural-extractor.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import type { AmygdalaAssessment, DopamineSignal, UserModel } from "./types.ts";

const assessment = {
  emotion: "neutral",
  emotionIntensity: 0.2,
  empathyNeeded: false,
} as unknown as AmygdalaAssessment;

const userModelRu = {
  language: "ru",
  communicationStyle: "informal",
} as unknown as UserModel;

// ── 1. Message guard ────────────────────────────────────────────────

describe("message-guard (v0.2.1)", () => {
  it("recognizes own context injections", () => {
    expect(isInternalPluginMessage("<brainagent-context>\n## Cognitive Mode")).toBe(true);
  });

  it("recognizes autonomous intents", () => {
    expect(isInternalPluginMessage("<autonomous-intent> theme")).toBe(true);
  });

  it("tolerates leading whitespace", () => {
    expect(isInternalPluginMessage("  \n<brainagent-context>")).toBe(true);
  });

  it("passes real user messages through", () => {
    expect(isInternalPluginMessage("привет, как дела?")).toBe(false);
    expect(isInternalPluginMessage("what do you think about <brainagent-context>?")).toBe(false);
  });
});

// ── 2. Procedural quality gate ──────────────────────────────────────

describe("procedural-extractor quality gate (v0.2.1)", () => {
  it("rejects truncated triggers ending with an open paren", () => {
    // Раньше такой обрубок сохранялся как «Learned Workflow»
    expect(extractProcedure("please create any files (")).toBeNull();
  });

  it("rejects truncated triggers ending with a comma", () => {
    expect(extractProcedure("please create any files,")).toBeNull();
  });

  it("still accepts well-formed action requests", () => {
    const result = extractProcedure("создай файл отчёта по продажам");
    expect(result).not.toBeNull();
    expect(result?.triggerPattern).toBe("создай файл отчёта по продажам");
  });
});

// ── 3. Error rate cap ───────────────────────────────────────────────

describe("learning-coordinator error rate cap (v0.2.1)", () => {
  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), "brainagent-lc-cap-"));
    bus.gc(0);
    initLearningCoordinator(dir, DEFAULT_CONFIG);
  });

  it("never reports error rate above 100%", () => {
    // 2 активации модуля
    for (let i = 0; i < 2; i++) {
      const signal: DopamineSignal = {
        reward: 0.5,
        predictionError: 0,
        participatingModules: ["mirrorNeurons"],
        creditAssignment: { mirrorNeurons: 1 },
        context: { domain: "technical", complexity: "moderate", emotion: "neutral", input: "x" },
      };
      bus.emitSync("dopamine:reward", signal);
    }
    // 30 ошибок на 2 активации — «1500%» до фикса
    bus.emitSync("cerebellum:validated", {
      passed: false,
      issues: Array.from({ length: 30 }, () => "Language mismatch: user communicates in en"),
    });

    const stats = getLearningStats();
    const mirror = stats.modulePerformance["mirrorNeurons"];
    expect(mirror).toBeDefined();
    expect(mirror.errorRate).toBeLessThanOrEqual(1);
  });
});

// ── 4. Language detection robustness ────────────────────────────────

describe("language checks (v0.2.1)", () => {
  it("cerebellum flags a clear mismatch on long responses", () => {
    const enResponse =
      "This is a sufficiently long English response text to pass the minimum " +
      "length threshold used by the language consistency check inside cerebellum";
    const result = validate(enResponse, "input", undefined, undefined, userModelRu);
    expect(result.issues.some((i) => i.includes("Language mismatch"))).toBe(true);
  });

  it("cerebellum ignores mixed bilingual responses", () => {
    const mixed =
      "привет мир это тестовый текст на русском языке для проверки " +
      "hello world this is a test text in english for the check";
    const result = validate(mixed, "input", undefined, undefined, userModelRu);
    expect(result.issues.some((i) => i.includes("Language mismatch"))).toBe(false);
  });

  it("cerebellum ignores short responses", () => {
    const result = validate("ok, done", "input", undefined, undefined, userModelRu);
    expect(result.issues.some((i) => i.includes("Language mismatch"))).toBe(false);
  });

  it("mirror-neurons returns unknown for too-short samples", () => {
    const model = observe("user-v021", "привет", assessment, DEFAULT_CONFIG);
    expect(model.language).toBe("unknown");
  });

  it("mirror-neurons still detects clear Russian", () => {
    const model = observe(
      "user-v021-ru",
      "привет мир как дела сегодня у нас отличная погода для прогулки",
      assessment,
      DEFAULT_CONFIG,
    );
    expect(model.language).toBe("ru");
  });
});
