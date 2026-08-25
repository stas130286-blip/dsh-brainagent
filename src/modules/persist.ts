/**
 * Общие утилиты персистентности — debounce + атомарная запись.
 *
 * Раньше каждый модуль писал свой state.json синхронно на каждое
 * значимое событие (до ~6 файлов на один dopamine:reward), блокируя
 * event loop дисковым вводом. Теперь горячие пути используют
 * отложенную запись:
 *
 *  - schedulePersist() — несколько изменений за окно debounce
 *    коллапсируют в ОДНУ запись; сериализатор вызывается лениво,
 *    поэтому на диск всегда попадает самое свежее состояние.
 *  - Запись атомарная (tmp-файл + rename): повреждённый от
 *    прерывания state.json больше невозможен.
 *  - flushPersist() — немедленная запись (используется в stop*()
 *    модулей, чтобы состояние не терялось при завершении).
 *
 * Таймеры unref'ятся, чтобы не держать процесс Node открытым.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

export const DEFAULT_PERSIST_DEBOUNCE_MS = 500;

type PendingWrite = {
  timer: ReturnType<typeof setTimeout>;
  serialize: () => string;
};

const pendingWrites = new Map<string, PendingWrite>();

/**
 * Общая точка записи: ошибки диска не критичны и молча глотаются —
 * следующее изменение состояния попробует записаться снова.
 */
function persistNow(filePath: string, serialize: () => string): void {
  try {
    atomicWrite(filePath, serialize());
  } catch {
    // Некритичная ошибка диска — попробуем в следующий раз
  }
}

/**
 * Атомарная запись: сначала во временный файл, затем rename.
 * Ошибки диска пробрасываются наверх — обработка (логирование и
 * отказ от ретрая) остаётся на усмотрение вызывающего, как в
 * schedulePersist/flushPersist.
 */
export function atomicWrite(filePath: string, data: string): void {
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, data, "utf-8");
  renameSync(tmpPath, filePath);
}

/**
 * Прочитать JSON-файл с фолбэком на дефолт: отсутствующий файл или
 * повреждённый/невалидный JSON молча возвращает fallback — ровно та
 * семантика, которую раньше дублировали локальные loadState в пяти
 * модулях (hippocampus, emotional-memory, mirror-neurons, working-memory,
 * attention-gate).
 */
export function loadJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!existsSync(filePath)) return fallback;
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

/** Атомарная запись JSON: tmp-файл + rename через atomicWrite. */
export function saveJsonFile(filePath: string, data: unknown): void {
  atomicWrite(filePath, JSON.stringify(data, null, 2));
}

/**
 * Отложенная запись: повторяющиеся вызовы для одного файла
 * сбрасывают таймер, и на диск уходит только последнее состояние.
 */
export function schedulePersist(
  filePath: string,
  serialize: () => string,
  delayMs: number = DEFAULT_PERSIST_DEBOUNCE_MS,
): void {
  const existing = pendingWrites.get(filePath);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    pendingWrites.delete(filePath);
    persistNow(filePath, serialize);
  }, delayMs);
  timer.unref?.();

  pendingWrites.set(filePath, { timer, serialize });
}

/** Немедленно записать отложенное состояние (для stop*() и тестов). */
export function flushPersist(filePath: string): void {
  const entry = pendingWrites.get(filePath);
  if (!entry) return;
  clearTimeout(entry.timer);
  pendingWrites.delete(filePath);
  persistNow(filePath, entry.serialize);
}

/** Отменить отложенную запись без записи на диск (для init*). */
export function cancelPersist(filePath: string): void {
  const entry = pendingWrites.get(filePath);
  if (!entry) return;
  clearTimeout(entry.timer);
  pendingWrites.delete(filePath);
}

/** Немедленно записать все отложенные состояния (завершение работы). */
export function flushAllPersists(): void {
  for (const filePath of [...pendingWrites.keys()]) {
    flushPersist(filePath);
  }
}

/** Количество ожидающих записей (для диагностики и тестов). */
export function getPendingPersistCount(): number {
  return pendingWrites.size;
}
