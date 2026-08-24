/**
 * Eval-сценарии: регрессия recall.
 * Контракт «при таком-то состоянии памяти recall возвращает это»:
 * память засевается известными записями, затем проверяется и сам
 * recall, и его попадание в контекст, который уходит модели.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootBrain } from "./harness.ts";
import type { BrainHandle } from "./harness.ts";
import {
  recallAllAsync,
  storeEpisode,
  storeFact,
} from "../modules/hippocampus.ts";

describe("eval: регрессия recall", () => {
  let brain: BrainHandle;

  beforeAll(async () => {
    brain = await bootBrain();
    // Плагин уже инициализировал хранилище на свой dataDir —
    // засеваем состояние памяти известными записями.
    storeFact("Пользователь живёт в Казани", "user_info");
    storeFact("Любимый цвет пользователя — синий", "preference");
    storeEpisode(
      "Пользователь рассказал про поездку на Байкал летом",
      "Поездка на Байкал",
      "joy",
      ["Байкал"],
      0.6,
    );
  });

  afterAll(() => {
    brain.dispose();
  });

  it("семантический recall находит засеянный факт", async () => {
    const res = await recallAllAsync("Казань", 3, 5);
    expect(res.semantic.some((f) => f.content.includes("Казани"))).toBe(true);
  });

  it("эпизодический recall находит событие по сущности", async () => {
    const res = await recallAllAsync("Байкал", 3, 5);
    expect(res.episodic.some((e) => e.summary.includes("Байкал"))).toBe(true);
  });

  it("pre-step доносит извлечённую память до контекста модели", async () => {
    const res = await brain.preStep("Напомни про Казань");
    expect(res.kind).toBe("enter");
    expect(res.contextText).toContain("Казани");
  });

  it("второй факт не теряется при повторном извлечении", async () => {
    const res = await recallAllAsync("любимый цвет синий", 3, 5);
    expect(res.semantic.some((f) => f.content.includes("синий"))).toBe(true);
    expect(brain.errors()).toEqual([]);
  });
});
