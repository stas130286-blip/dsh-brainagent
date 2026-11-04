/**
 * v0.9.40: опечатка — не приговор, мета-вопрос — не воспоминание.
 *
 * Снято с боевого хода. Пользователь спросил «ак о чем мы писали рюзиме».
 * В сторе 518 фактов, из них 89 про резюме, но в промпт не доехал ни один:
 * «рюзиме» не имеет общих слов с «резюме»; «писали» — служебный глагол, но
 * открывал шлюз релевантности; собственный вопрос пользователя лежит в
 * эпизодах и всплывает вместо ответа. Модель честно ответила «текста у меня
 * в памяти не осталось».
 *
 * Здесь три свойства сразу: второй проход по опечаткам, служебные глаголы
 * вне шлюза, мета-реплики вне пула воспоминаний.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  initMemoryStorage,
  recallEpisodes,
  recallFacts,
  storeEpisode,
  storeFact,
} from "./hippocampus.ts";
import { isSharedHistoryQuery } from "./memory-identity.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "brainagent-v0940-"));
  initMemoryStorage(dir);
});

afterEach(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ok */
  }
});

describe("v0.9.40 — опечатка в слове не обнуляет память", () => {
  it("«рюзиме» находит факты про резюме", () => {
    storeFact("Пользователь отправил резюме на HeadHunter", "user_info");
    storeFact("Пользователь любит кофе по утрам", "user_preference");

    const hits = recallFacts("ак о чем мы писали рюзиме", undefined, 5);
    expect(hits.map((f) => f.content)).toContain("Пользователь отправил резюме на HeadHunter");
  });

  it("«рюзиме» находит эпизод, где резюме обсуждали", () => {
    storeEpisode("Пользователь отправил два резюме — одно по качеству", "резюме");
    storeEpisode("Как вечер проходит — отдыхаешь уже", "вечер");

    const hits = recallEpisodes("ак о чем мы писали рюзиме", 3);
    expect(hits.map((e) => e.summary)).toContain("резюме");
  });

  it("опечатка не склеивает слова с разной первой буквой", () => {
    storeFact("Существует общий протокол: D:/работа/ПРОТОКОЛ.md", "entity");

    const hits = recallFacts("рюзиме", undefined, 5);
    expect(hits).toEqual([]);
  });
});

describe("v0.9.40 — служебный глагол не открывает шлюз", () => {
  it("«писали» само по себе ничего не находит", () => {
    storeEpisode("и что мы в нем писали", "болтовня");
    storeEpisode("Пользователь отправил резюме на вакансию", "резюме");

    const hits = recallEpisodes("о чем мы писали резюме", 3);
    expect(hits.map((e) => e.summary)).toEqual(["резюме"]);
  });

  it("«писали» не подменяет тему в фактах", () => {
    storeFact("Пользователь купил кофемолку", "user_preference");
    storeFact("Пользователь работал начальником лаборатории поверки", "user_info");

    const hits = recallFacts("о чем мы писали в резюме", undefined, 5);
    expect(hits).toEqual([]);
  });
});

describe("v0.9.40 — мета-реплика не занимает слот воспоминания", () => {
  it("свой же вопрос не возвращается как воспоминание", () => {
    storeEpisode("так о чем мы писали рюзиме", "мета");

    expect(recallEpisodes("так о чем мы писали рюзиме", 3)).toEqual([]);
  });

  it("«а ты помнишь про Крым?» не вытесняет сам Крым", () => {
    storeEpisode("а ты помнишь про Крым?", "мета");
    storeEpisode("Пользователь ездил в Крым в 2019", "крым");

    const hits = recallEpisodes("помнишь Крым", 3);
    expect(hits.map((e) => e.summary)).toEqual(["крым"]);
  });

  it("вопрос о совместной истории распознаётся", () => {
    expect(isSharedHistoryQuery("о чем мы писали рюзиме")).toBe(true);
    expect(isSharedHistoryQuery("что мы обсуждали вчера")).toBe(true);
    expect(isSharedHistoryQuery("помнишь вакансию")).toBe(true);
    expect(isSharedHistoryQuery("сколько стоит билет")).toBe(false);
  });
});
