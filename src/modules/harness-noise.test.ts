import { describe, expect, it } from "vitest";
import { isHarnessSystemMessage, isInternalPluginMessage } from "./message-guard.ts";

describe("message-guard: служебные сообщения хоста (v0.9.2)", () => {
  it("каталог скиллов dsh распознаётся как служебное сообщение хоста", () => {
    const catalog = [
      "<system-reminder>",
      "A skill is a reusable set of task-specific instructions. The following skills are available in this session:",
      "",
      "<available_skills>",
      "skill-a: описание скилла",
      "</available_skills>",
      "",
      "If the user names a skill, call the `skill` tool.",
      "</system-reminder>",
    ].join("\n");
    expect(isHarnessSystemMessage(catalog)).toBe(true);
    expect(isHarnessSystemMessage("  \n<system-reminder>\nкаталог")).toBe(true);
  });

  it("обычные сообщения пользователя проходят", () => {
    expect(isHarnessSystemMessage("Привет! Как дела?")).toBe(false);
    expect(isHarnessSystemMessage("Что такое <system-reminder>?")).toBe(false);
  });

  it("guard плагина и guard хоста не пересекаются", () => {
    // Каталог хоста — не наше сообщение.
    expect(isInternalPluginMessage("<system-reminder>\n<available_skills>")).toBe(false);
    // Наши инъекции — не сообщения хоста (их фильтрует isInternalPluginMessage).
    expect(isHarnessSystemMessage("<brainagent-context>\nконтекст")).toBe(false);
    expect(isHarnessSystemMessage("<autonomous-intent> мысль")).toBe(false);
  });
});
