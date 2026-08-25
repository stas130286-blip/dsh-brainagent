#!/usr/bin/env node
/**
 * postinstall: автоматически применяет патч хоста dsh (пейсинг
 * goal-round-driver) при установке пакета, если удаётся найти корень
 * dsh. Никогда не роняет установку — любые проблемы только логируются.
 *
 * Ручной запуск в любой момент:
 *     node host-patches/apply-goal-round-pacing.cjs [путь-к-dsh]
 */
const { existsSync } = require("node:fs");
const { dirname, resolve, join } = require("node:path");
const { spawnSync } = require("node:child_process");

// Пакет может лежать в <dsh>/brainagent (локальная копия) или в
// node_modules внутри монорепы dsh — ищем корень вверх по дереву.
function findDshRoot(start) {
  let dir = start;
  for (let depth = 0; depth < 8; depth++) {
    const candidate = join(dir, "packages", "goal", "goal-round-driver", "src", "index.ts");
    if (existsSync(candidate)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

try {
  const root = findDshRoot(__dirname);
  if (!root) {
    console.log(
      "[dsh-brainagent postinstall] корень dsh не найден — пропуск авто-патча.\n" +
        "  Если появится спам гол-раундов, выполните вручную:\n" +
        "  node <пакет>/host-patches/apply-goal-round-pacing.cjs <путь-к-dsh>",
    );
    process.exit(0);
  }
  const script = join(__dirname, "apply-goal-round-pacing.cjs");
  const res = spawnSync(process.execPath, [script, root], {
    stdio: "inherit",
    encoding: "utf8",
  });
  if (res.status !== 0) {
    console.log(
      "[dsh-brainagent postinstall] авто-патч не применился (хост изменился?).\n" +
        "  Установка продолжается. При спаме гол-раундов см. host-patches/README.md.",
    );
  }
} catch (error) {
  console.log(`[dsh-brainagent postinstall] пропуск авто-патча: ${error.message}`);
}
process.exit(0);
