/**
 * Cerebellum — Quality control and response validation.
 *
 * The cerebellum fine-tunes motor output for precision. In our agent,
 * it validates outgoing responses before they reach the user:
 *
 * - Completeness: did we answer all parts of the question?
 * - Tone: does the response match the user's style?
 * - Formatting: is the output appropriate for the channel?
 * - Safety: no leaked sensitive data?
 * - Length: is the response proportional to the question?
 */

import type { HostConfig as NeuroClawConfig } from "./host-config.ts";
import { bus } from "./event-bus.ts";
import { callLLM, isAIProviderAvailable } from "./llm-client.ts";
import type { AmygdalaAssessment, ThalamusClassification, UserModel } from "./types.ts";

export type ValidationResult = {
  passed: boolean;
  issues: string[];
  suggestions: string[];
  /** AI quality scores (when AI validation is available) */
  scores?: {
    relevance: number;
    completeness: number;
    clarity: number;
  };
  /** Corrective instructions generated for re-generation (when issues are critical) */
  correctionPrompt?: string;
};

// ── Validation checks ───────────────────────────────────────────────

/**
 * Validate a response before sending it to the user.
 * Returns issues and suggestions for improvement.
 * This runs synchronously with heuristic checks (no LLM call needed).
 */
export function validate(
  response: string,
  originalInput: string,
  classification?: ThalamusClassification,
  assessment?: AmygdalaAssessment,
  userModel?: UserModel,
): ValidationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check 1: Response proportionality
  checkProportionality(response, originalInput, classification, issues, suggestions);

  // Check 2: Tone alignment
  if (assessment && userModel) {
    checkToneAlignment(response, assessment, userModel, issues, suggestions);
  }

  // Check 3: Sensitive data patterns
  checkSensitiveData(response, issues);

  // Check 4: Completeness heuristic (multi-question detection)
  checkCompleteness(response, originalInput, issues, suggestions);

  // Check 5: Language consistency
  if (userModel) {
    checkLanguageConsistency(response, userModel, issues, suggestions);
  }

  // Check 6: Internal state exposure
  checkInternalExposure(response, issues);

  const passed = issues.length === 0;
  bus.emitSync("cerebellum:validated", { passed, issues });

  return { passed, issues, suggestions };
}

// ── Individual checks ───────────────────────────────────────────────

function checkProportionality(
  response: string,
  input: string,
  classification: ThalamusClassification | undefined,
  issues: string[],
  suggestions: string[],
): void {
  const inputWords = input.split(/\s+/).length;
  const responseWords = response.split(/\s+/).length;

  // For trivial inputs, responses shouldn't be excessively long
  if (classification?.complexity === "trivial" && responseWords > 200) {
    suggestions.push(
      "Response may be too verbose for a simple question. Consider being more concise.",
    );
  }

  // For complex inputs, responses shouldn't be too short
  if (classification?.complexity === "complex" && responseWords < 10) {
    issues.push("Response seems too brief for a complex question.");
  }

  // Extremely long responses (>2000 words) are rarely needed
  if (responseWords > 2000) {
    suggestions.push("Response is very long. Consider breaking into sections or summarizing.");
  }
}

function checkToneAlignment(
  response: string,
  assessment: AmygdalaAssessment,
  userModel: UserModel,
  issues: string[],
  suggestions: string[],
): void {
  // If user is distressed, check that response shows empathy
  if (assessment.empathyNeeded) {
    const empathyMarkers = [
      /понимаю/i,
      /сочувств/i,
      /помогу/i,
      /давайте/i,
      /understand/i,
      /help/i,
      /let me/i,
      /I see/i,
    ];
    const hasEmpathy = empathyMarkers.some((m) => m.test(response));
    if (!hasEmpathy) {
      suggestions.push(
        "User seems distressed. Consider starting with an empathetic acknowledgment.",
      );
    }
  }

  // If user is formal, check response isn't too casual
  if (userModel.communicationStyle === "formal") {
    const casualMarkers = [/ок\b/i, /ладно/i, /ну\b/i, /йо\b/i, /lol/i, /haha/i];
    const isCasual = casualMarkers.some((m) => m.test(response));
    if (isCasual) {
      suggestions.push("User prefers formal communication. Adjust tone accordingly.");
    }
  }
}

function checkSensitiveData(response: string, issues: string[]): void {
  // Check for potential credential leaks
  const sensitivePatterns = [
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, name: "email address" },
    { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, name: "card number" },
    { pattern: /sk-[a-zA-Z0-9]{20,}/, name: "API key (OpenAI format)" },
    { pattern: /ghp_[a-zA-Z0-9]{36}/, name: "GitHub token" },
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/, name: "SSN pattern" },
  ];

  for (const { pattern, name } of sensitivePatterns) {
    if (pattern.test(response)) {
      issues.push(`Response may contain sensitive data: ${name}. Review before sending.`);
    }
  }
}

function checkCompleteness(
  response: string,
  input: string,
  issues: string[],
  suggestions: string[],
): void {
  // Count question marks in input → user asked multiple questions
  const questionCount = (input.match(/\?/g) ?? []).length;
  if (questionCount > 1) {
    // Rough heuristic: response should have at least some structure
    // (numbered items, headers, or paragraphs) for multi-question input
    const hasStructure =
      /\d+\.\s/.test(response) || // numbered list
      /^#{1,3}\s/m.test(response) || // markdown headers
      response.split("\n\n").length >= questionCount; // paragraph separation

    if (!hasStructure && questionCount >= 3) {
      suggestions.push(
        `Input contains ${questionCount} questions. Consider structuring the response with numbered answers.`,
      );
    }
  }
}

function checkLanguageConsistency(
  response: string,
  userModel: UserModel,
  issues: string[],
  _suggestions: string[],
): void {
  // Detect primary language of response
  const cyrillicCount = (response.match(/[а-яА-ЯёЁ]/g) ?? []).length;
  const latinCount = (response.match(/[a-zA-Z]/g) ?? []).length;
  const totalAlpha = cyrillicCount + latinCount;

  if (totalAlpha === 0) return;

  const responseLang = cyrillicCount / totalAlpha > 0.5 ? "ru" : "en";

  if (userModel.language !== "unknown" && responseLang !== userModel.language) {
    issues.push(
      `Language mismatch: user communicates in ${userModel.language} but response is primarily in ${responseLang}.`,
    );
  }
}

// ── Check 6: Internal cognitive state exposure ──────────────────────

const INTERNAL_EXPOSURE_PATTERNS: RegExp[] = [
  /## автономн/i,
  /## theory of mind/i,
  /## self-assessment/i,
  /## meta-consciousness/i,
  /## активные цели/i,
  /## active drives/i,
  /## фоновые мысли/i,
  /## proactive insight/i,
  /brainagent-context/i,
  /brainagent/i,
  /neuroclaw/i,
  /hippocampus/i,
  /prefrontal.cortex/i,
  /cerebellum/i,
  /thalamus/i,
  /amygdala/i,
  /basal.ganglia/i,
  /автономный драйв/i,
  /автономное действие/i,
  /автономное желание/i,
  /автономный импульс/i,
  /уровень потребности.*\d+%/i,
  /level:\s*0\.\d+/i,
  /драйв удовлетвор/i,
  /vital.?impulse/i,
  /neuromodulator/i,
  /consciousnessstate/i,
];

function checkInternalExposure(response: string, issues: string[]): void {
  for (const pat of INTERNAL_EXPOSURE_PATTERNS) {
    if (pat.test(response)) {
      issues.push("Response exposes internal cognitive state.");
      return;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// AI-enhanced validation
// ══════════════════════════════════════════════════════════════════════

const QUALITY_PROMPT = `Ты — модуль контроля качества ответов. Тебе даётся вопрос пользователя и ответ ассистента.

ВАЖНО: ассистент — это автономный агент с собственной личностью, эмоциями, интересами и внутренней жизнью. Он НЕ стандартный помощник. Когда его спрашивают о делах, чувствах, мыслях — он должен отвечать от себя, как живое существо. Это НЕ баг, а основная концепция. Не снижай оценку за то, что агент проявляет личность, делится своими переживаниями или рассуждает о своих интересах.

Оцени ответ по критериям:
1. РЕЛЕВАНТНОСТЬ — отвечает ли на вопрос (0-10)
2. ПОЛНОТА — все ли части вопроса охвачены (0-10)
3. ЯСНОСТЬ — понятен ли ответ (0-10)

Ответ СТРОГО в JSON (без markdown):
{"relevance":N,"completeness":N,"clarity":N,"issues":["проблема1",...],"suggestions":["совет1",...]}

Если ответ хороший — пустые массивы issues/suggestions. Будь объективен и краток.`;

function parseQualityResponse(response: string): {
  issues: string[];
  suggestions: string[];
  scores: { relevance: number; completeness: number; clarity: number };
} {
  const empty = {
    issues: [],
    suggestions: [],
    scores: { relevance: 10, completeness: 10, clarity: 10 },
  };
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return empty;
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const issues: string[] = [];
    const suggestions: string[] = [];

    if (Array.isArray(parsed.issues)) {
      for (const i of parsed.issues) {
        if (typeof i === "string") issues.push(i);
      }
    }
    if (Array.isArray(parsed.suggestions)) {
      for (const s of parsed.suggestions) {
        if (typeof s === "string") suggestions.push(s);
      }
    }

    // Extract scores
    const relevance = typeof parsed.relevance === "number" ? parsed.relevance : 10;
    const completeness = typeof parsed.completeness === "number" ? parsed.completeness : 10;
    const clarity = typeof parsed.clarity === "number" ? parsed.clarity : 10;

    if (relevance < 4) issues.push("AI: low relevance — response may not address the question");
    if (completeness < 4) issues.push("AI: low completeness — some parts may be unanswered");
    if (clarity < 4) issues.push("AI: low clarity — response may be confusing");

    return { issues, suggestions, scores: { relevance, completeness, clarity } };
  } catch {
    return empty;
  }
}

/**
 * Build a corrective prompt from validation issues.
 * Used when the cerebellum decides the response needs re-generation.
 * This is the "motor correction" — telling the system exactly what went wrong
 * and how to fix it, like the cerebellum sending error signals to the motor cortex.
 */
export function buildCorrectionPrompt(
  issues: string[],
  suggestions: string[],
  originalInput: string,
  scores?: { relevance: number; completeness: number; clarity: number },
): string {
  const lines: string[] = [
    "## Quality Correction (Cerebellum Feedback)",
    "",
    "Your previous response had quality issues. Please re-generate with these corrections:",
    "",
  ];

  if (issues.length > 0) {
    lines.push("**Issues to fix:**");
    for (const issue of issues) {
      lines.push(`- ${issue}`);
    }
    lines.push("");
  }

  if (suggestions.length > 0) {
    lines.push("**Improvements to apply:**");
    for (const suggestion of suggestions) {
      lines.push(`- ${suggestion}`);
    }
    lines.push("");
  }

  if (scores) {
    const weakAreas: string[] = [];
    if (scores.relevance < 6)
      weakAreas.push("make the answer more relevant to the actual question");
    if (scores.completeness < 6) weakAreas.push("address ALL parts of the question completely");
    if (scores.clarity < 6)
      weakAreas.push("explain more clearly, use simpler language or examples");

    if (weakAreas.length > 0) {
      lines.push("**Focus on:**");
      for (const area of weakAreas) {
        lines.push(`- ${area}`);
      }
      lines.push("");
    }
  }

  lines.push(`**Original question:** ${originalInput.slice(0, 500)}`);
  lines.push("");
  lines.push("Generate a corrected response that addresses all the above issues.");

  return lines.join("\n");
}

/**
 * Determine if a validation result warrants re-generation.
 * Only triggers for serious issues — minor suggestions don't justify the cost.
 */
export function shouldRegenerate(result: ValidationResult): boolean {
  // Never regenerate if passed
  if (result.passed) return false;

  // Count critical issues (exclude minor suggestions)
  const criticalIssues = result.issues.filter(
    (i) =>
      i.includes("low relevance") ||
      i.includes("low completeness") ||
      i.includes("too brief") ||
      i.includes("sensitive data") ||
      i.includes("Language mismatch"),
  );

  // Regenerate if AI scores are very low
  if (result.scores) {
    const { relevance, completeness, clarity } = result.scores;
    if (relevance < 3 || completeness < 3) return true;
    if (relevance + completeness + clarity < 12) return true;
  }

  return criticalIssues.length >= 2;
}

/**
 * AI-enhanced validation: runs heuristic checks first, then optionally
 * calls an LLM to evaluate response quality semantically.
 * Falls back to heuristic-only result if no AI provider is available.
 */
export async function validateAsync(
  response: string,
  originalInput: string,
  config: NeuroClawConfig,
  classification?: ThalamusClassification,
  assessment?: AmygdalaAssessment,
  userModel?: UserModel,
  logger?: { info: (msg: string) => void },
): Promise<ValidationResult> {
  // Run sync heuristic checks first
  const heuristicResult = validate(response, originalInput, classification, assessment, userModel);

  if (!isAIProviderAvailable(config)) {
    return heuristicResult;
  }

  try {
    const userText = `Вопрос: ${originalInput}\n\nОтвет: ${response}`;
    const aiResponse = await callLLM(QUALITY_PROMPT, userText, config, logger, 300);

    if (aiResponse) {
      const aiResult = parseQualityResponse(aiResponse);

      const allIssues = [...heuristicResult.issues, ...aiResult.issues];
      const allSuggestions = [...heuristicResult.suggestions, ...aiResult.suggestions];

      const passed = allIssues.length === 0;

      // Build correction prompt if issues are serious enough
      const result: ValidationResult = {
        passed,
        issues: allIssues,
        suggestions: allSuggestions,
        scores: aiResult.scores,
      };

      if (shouldRegenerate(result)) {
        result.correctionPrompt = buildCorrectionPrompt(
          allIssues,
          allSuggestions,
          originalInput,
          aiResult.scores,
        );
      }

      bus.emitSync("cerebellum:validated", { passed, issues: allIssues });
      return result;
    }
  } catch (err) {
    logger?.info(`BrainAgent Cerebellum: AI validation error — ${String(err)}`);
  }

  return heuristicResult;
}
