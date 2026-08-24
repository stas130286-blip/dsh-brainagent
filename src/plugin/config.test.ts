import { describe, expect, it } from "vitest";
import { Config, mergeBrainConfig } from "./config.ts";
import { DEFAULT_CONFIG } from "../modules/types.ts";

describe("единый конфиг (m6): ключ brain прокидывает внутренние параметры", () => {
  // Схема заполняет дефолты из пустого входа — полный Config для мержа.
  const base = Config({} as Config);

  it("пустой конфиг даёт дефолты без изменений", () => {
    const merged = mergeBrainConfig(base);
    expect(merged.vitalImpulse).toEqual(DEFAULT_CONFIG.vitalImpulse);
    expect(merged.memory).toEqual(DEFAULT_CONFIG.memory);
    expect(merged.modules.dmn).toBe(true);
  });

  it("brain переопределяет вложенные параметры глубоким мержем", () => {
    const merged = mergeBrainConfig({
      ...base,
      brain: {
        vitalImpulse: { firingThreshold: 0.42 },
        memory: { maxEpisodicMemories: 7 },
      },
    });
    expect(merged.vitalImpulse.firingThreshold).toBeCloseTo(0.42, 5);
    // Непереопределённые соседи сохранены (глубокий мерж, не замена секции).
    expect(merged.vitalImpulse.refractoryPeriodMs).toBe(
      DEFAULT_CONFIG.vitalImpulse.refractoryPeriodMs,
    );
    expect(merged.memory.maxEpisodicMemories).toBe(7);
    expect(merged.memory.maxSemanticMemories).toBe(DEFAULT_CONFIG.memory.maxSemanticMemories);
  });

  it("флаги верхнего уровня modules перебивают brain.modules (совместимость)", () => {
    const merged = mergeBrainConfig({
      ...base,
      modules: { ...base.modules, dmn: false },
      brain: { modules: { dmn: true } },
    });
    // Верхний уровень modules — главный источник истины для флагов.
    expect(merged.modules.dmn).toBe(false);
  });

  it("переименование autonomyEnricher → actionDispatcher сохраняется", () => {
    const merged = mergeBrainConfig({
      ...base,
      modules: { ...base.modules, autonomyEnricher: false },
    });
    expect(merged.modules.actionDispatcher).toBe(false);
  });
});
