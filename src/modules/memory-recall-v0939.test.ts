/**
 * v0.9.39: релевантность — множитель, а не слагаемое.
 *
 * Регрессия снята с боевого стора: 417 эпизодов, из них 28 за сегодня. Три
 * разных запроса («плагин метролог конвейер», «резюме вакансия инженер по
 * качеству», «что мы обсуждали») возвращали одни и те же пять сегодняшних
 * эпизодов, включая запрос без единого общего слова. Причина: свежесть
 * входила в балл аддитивной константой (0.2 recency + 0.2 salience) и
 * перекрывала лексический вклад. На копии того же стора без свежих эпизодов
 * те же запросы находили ровно нужные сентябрьские воспоминания.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getRecentEpisodes,
  initMemoryStorage,
  recallEpisodes,
  recallFacts,
  storeEpisode,
  storeFact,
} from "./hippocampus.ts";
import { isConversationQuery, isSelfQuery } from "./memory-identity.ts";

const DAY = 24 * 60 * 60 * 1000;

let dir: string;

const storePath = (): string => join(dir, ".brainagent", "memory", "episodic", "store.json");

function patchEpisodes(patch: (list: Array<Record<string, unknown>>) => void): void {
  const list = JSON.parse(readFileSync(storePath(), "utf8")) as Array<Record<string, unknown>>;
  patch(list);
  writeFileSync(storePath(), JSON.stringify(list, null, 2), "utf8");
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "brainagent-v0939-"));
  initMemoryStorage(dir);
});

afterEach(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ok */
  }
});

describe("v0.9.39 — релевантность важнее свежести", () => {
  it("старое точное воспоминание обгоняет свежий шум", () => {
    storeEpisode(
      "Ты — роль конвейера разработки нормативной документации",
      "конвейер документации",
    );
    storeEpisode("Как вечер проходит — отдыхаешь уже или ещё что", "вечер");
    const now = Date.now();
    patchEpisodes((list) => {
      list[0].timestamp = now - 43 * DAY;
      list[0].salience = 0.14; // как у сентябрьских следов на боевом сторе
      list[0].lastDecayedAt = now;
      list[1].timestamp = now;
      list[1].salience = 1; // как у сегодняшних: подкреплены каждым ходом
      list[1].lastDecayedAt = now;
    });
    initMemoryStorage(dir);

    const hits = recallEpisodes("конвейер нормативной документации", 3);
    expect(hits[0]?.summary).toBe("конвейер документации");
  });

  it("свежий эпизод без единого общего слова не всплывает вовсе", () => {
    storeEpisode("Как вечер проходит — отдыхаешь уже или ещё что", "вечер");
    patchEpisodes((list) => {
      list[0].timestamp = Date.now();
      list[0].salience = 1;
    });
    initMemoryStorage(dir);

    expect(recallEpisodes("резюме вакансия инженер по качеству", 3)).toEqual([]);
  });

  it("подкрепляет след только за совпадение, а не за свежесть", () => {
    storeEpisode("Кварцевая жила", "кварц");
    storeEpisode("Как вечер проходит", "вечер");
    patchEpisodes((list) => {
      for (const ep of list) {
        ep.salience = 0.4;
        ep.lastDecayedAt = Date.now();
      }
    });
    initMemoryStorage(dir);

    recallEpisodes("кварцевая", 1);

    const after = JSON.parse(readFileSync(storePath(), "utf8")) as Array<{
      summary: string;
      salience: number;
    }>;
    const matched = after.find((e) => e.summary === "кварц");
    const untouched = after.find((e) => e.summary === "вечер");
    expect(matched?.salience).toBeCloseTo(0.45, 3);
    expect(untouched?.salience).toBeCloseTo(0.4, 3);
  });

  it("getRecentEpisodes отдаёт последние разговоры по времени", () => {
    storeEpisode("Первый разговор", "первый");
    storeEpisode("Второй разговор", "второй");
    storeEpisode("Третий разговор", "третий");
    const now = Date.now();
    patchEpisodes((list) => {
      list[0].timestamp = now - 3 * DAY;
      list[1].timestamp = now - 2 * DAY;
      list[2].timestamp = now;
    });
    initMemoryStorage(dir);

    expect(getRecentEpisodes(2).map((e) => e.summary)).toEqual(["третий", "второй"]);
  });
});

describe("v0.9.39 — уверенность не заменяет сходство", () => {
  it("факт с накопленной уверенностью не всплывает на чужой запрос", () => {
    storeFact("Пользователь живёт в Калининграде", "user_info");
    storeFact("Существует общий протокол: D:/работа/ПРОТОКОЛ.md", "entity");

    const hits = recallFacts("живёт", undefined, 5);
    expect(hits.map((f) => f.content)).toEqual(["Пользователь живёт в Калининграде"]);
  });
});

describe("v0.9.39 — детектор вопроса о прошлых разговорах", () => {
  it("узнаёт вопрос о разговоре", () => {
    for (const input of [
      "что мы обсуждали в прошлый раз?",
      "помнишь, как мы спорили о формулировке?",
      "вчера говорили про плагин метролога",
      "do you remember our talk about the resume",
    ]) {
      expect(isConversationQuery(input), input).toBe(true);
    }
  });

  it("не срабатывает на обычный вопрос", () => {
    for (const input of [
      "сколько я работал метрологом",
      "как настроить конвейер документации?",
      "покажи факты из моего резюме",
    ]) {
      expect(isConversationQuery(input), input).toBe(false);
    }
  });
});

describe("v0.9.39 — вопрос о себе с опечатками", () => {
  it("ловит «о бо мне»: так пользователь пишет на скорости", () => {
    expect(isSelfQuery("что ды знаешь о бо мне")).toBe(true);
    expect(isSelfQuery("что ты знаешь обо мне")).toBe(true);
  });
});
