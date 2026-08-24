/**
 * v0.5.1: единая детекция автономного ввода — ровный тег, тег с атрибутами
 * и доставка с фреймингом («Это не сообщение пользователя…»). Плюс фильтрация
 * фрейминг-доставки message-guard'ом: доставленный промпт не должен
 * обрабатываться контуром обучения как реплика пользователя.
 */
import { describe, expect, it } from "vitest";
import { isAutonomousInput } from "../plugin/config.ts";
import {
  AUTONOMOUS_FRAME_PREFIX,
  AUTONOMOUS_FRAMING_LINES,
} from "./autonomy-markers.ts";
import { isInternalPluginMessage } from "./message-guard.ts";

const TAGGED = "<autonomous-intent>\nПоделиться мыслью.\n</autonomous-intent>";
const TAGGED_ATTR = '<autonomous-intent source="test">Мысль.</autonomous-intent>';
const FRAMED = [
  "Это не сообщение пользователя, а твоя собственная инициатива: ниже — то, что ты сам хочешь сказать.",
  "Обратись к пользователю от себя, коротко и естественно. Не описывай внутренние механизмы.",
  "",
  TAGGED,
].join("\n");

describe("isAutonomousInput (v0.5.1)", () => {
  it("распознаёт ровный тег", () => {
    expect(isAutonomousInput(TAGGED)).toBe(true);
  });

  it("распознаёт тег с атрибутами", () => {
    expect(isAutonomousInput(TAGGED_ATTR)).toBe(true);
  });

  it("распознаёт фрейминг-доставку (включая ведущие пробелы)", () => {
    expect(isAutonomousInput(FRAMED)).toBe(true);
    expect(isAutonomousInput("  " + FRAMED)).toBe(true);
  });

  it("не срабатывает на сообщениях пользователя", () => {
    expect(isAutonomousInput("Привет!")).toBe(false);
    // Цитата фрейминга без тега — не автономный ввод.
    expect(isAutonomousInput("Это не сообщение пользователя, а просто цитата")).toBe(false);
  });
});

describe("message-guard: фрейминг-доставка (v0.5.1)", () => {
  it("фрейминг-доставка фильтруется как служебное сообщение", () => {
    expect(isInternalPluginMessage(FRAMED)).toBe(true);
  });

  it("ровный тег и контекст по-прежнему фильтруются", () => {
    expect(isInternalPluginMessage(TAGGED)).toBe(true);
    expect(isInternalPluginMessage("<brainagent-context>\nконтекст")).toBe(true);
  });

  it("обычные сообщения проходят", () => {
    expect(isInternalPluginMessage("Привет!")).toBe(false);
  });
});

describe("v0.5.2: фрейминг и детекция из одного источника", () => {
  it("префикс детекции — сама первая строка фрейминга", () => {
    expect(AUTONOMOUS_FRAME_PREFIX).toBe(AUTONOMOUS_FRAMING_LINES[0]);
  });

  it("текст deliverer'а (фрейминг + тег) проходит детекцию и guard", () => {
    // createAutonomousDeliverer собирает доставку ровно так
    // (без подсказок отвергнутых тем — они третьей строкой).
    const delivered = [...AUTONOMOUS_FRAMING_LINES, "", TAGGED].join("\n");
    expect(isAutonomousInput(delivered)).toBe(true);
    expect(isInternalPluginMessage(delivered)).toBe(true);
  });
});
