import { describe, it, expect } from "vitest";
import { classify } from "./thalamus.ts";

describe("Thalamus — домен сообщения", () => {
  it("длинный технический текст распознаётся как technical", () => {
    const text =
      "После обновления плагина статус модуля показывает ошибку в логах сборки, версия не совпадает с конфигом.";
    expect(classify(text).domain).toBe("technical");
  });

  it("вопрос без ключевых слов — factual", () => {
    expect(classify("А что думаешь про это, если посмотреть со стороны?").domain).toBe("factual");
  });

  it("длинная проза без ключевых слов — casual, а не unknown", () => {
    const text =
      "Сегодня было много разговоров о том, как устроены привычки и почему они так важны для человека.";
    expect(classify(text).domain).toBe("casual");
  });

  it("короткое сообщение — casual", () => {
    expect(classify("привет").domain).toBe("casual");
  });

  it("текст без букв — unknown", () => {
    expect(classify("... 42 — 7").domain).toBe("unknown");
  });

  it("команда в начале — command", () => {
    expect(classify("запусти сборку проекта").domain).toBe("command");
  });
});
