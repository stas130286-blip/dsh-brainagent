import { describe, it, expect } from "vitest";
import { createAttentionGate } from "./attention-gate.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import type { BrainAgentConfig } from "./types.ts";

const FILLER =
  "Внутреннее состояние: энергия 0.71, настроение спокойное, доминирующая эмоция — " +
  "любопытство, социальная потребность 0.78, рабочая память заполнена на треть, " +
  "циркадная фаза бодрствования, метаболический бюджет в норме.";

function makeConfig(patch: Partial<BrainAgentConfig["attentionGate"]> = {}): BrainAgentConfig {
  return {
    ...DEFAULT_CONFIG,
    attentionGate: { ...DEFAULT_CONFIG.attentionGate, ...patch },
  };
}

describe("Attention Gate — query coverage scoring", () => {
  it("keeps a long relevant section despite its size", () => {
    const gate = createAttentionGate("");
    const relevant = `${FILLER} Последний python asyncio прогон прошёл успешно.`;
    const irrelevant = FILLER;

    const kept = gate.filter([irrelevant, relevant], "python asyncio", 0.2, makeConfig());

    expect(kept).toContain(relevant);
    expect(kept).not.toContain(irrelevant);
  });

  it("never empties the context, even when the input shares no terms", () => {
    const gate = createAttentionGate("");
    const kept = gate.filter([FILLER, `${FILLER} Второй блок.`], "привет", 0.2, makeConfig());

    expect(kept.length).toBeGreaterThan(0);
  });

  it("respects maxContextSections", () => {
    const gate = createAttentionGate("");
    const sections = Array.from({ length: 6 }, (_, i) => `${FILLER} python asyncio прогон ${i}`);

    const kept = gate.filter(sections, "python asyncio", 0.2, makeConfig({ maxContextSections: 3 }));

    expect(kept.length).toBe(3);
  });

  it("preserves the original section order", () => {
    const gate = createAttentionGate("");
    const first = `${FILLER} python`;
    const second = `${FILLER} asyncio`;

    const kept = gate.filter([first, second], "python asyncio", 0.2, makeConfig());

    expect(kept).toEqual([first, second]);
  });
});
