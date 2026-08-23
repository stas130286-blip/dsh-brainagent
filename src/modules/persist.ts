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

import { renameSync, writeFileSync } from "node:fs";

export const DEFAULT_PERSIST_DEBOUNCE_MS = 500;

type PendingWrite = {
  timer: ReturnType<typeof setTimeout>;
  serialize: () => string;
};

const pendingWrites = new Map<string, PendingWrite>();

/** Атомарная запись: сначала во временный файл, затем rename. */
export function atomicWrite(filePath: string, data: string): void {
  const tmpPath = `${filePath}.tmp`;
  writeFileSyncSafe(tmpPath, data);
  renameSyncSafe(tmpPath, filePath);
}

function writeFileSyncSafe(path: string, data: string): void {
  writeFileSync(path, data, "utf-8");
}

function renameSyncSafe(from: string, to: string): void {
  renameSync(from, to);
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
    try {
      atomicWrite(filePath, serialize());
    } catch {
      // Некритичная ошибка диска — попробуем в следующий раз
    }
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
  try {
    atomicWrite(filePath, entry.serialize());
  } catch {
    // Некритичная ошибка
  }
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
