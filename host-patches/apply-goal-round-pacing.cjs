#!/usr/bin/env node
/**
 * Патч хоста dsh: пейсинг goal-round-driver (фикс спама гол-раундов, v0.9.5).
 *
 * После обновления DeepSeek Harness заново примените этот скрипт:
 *
 *     node brainagent/host-patches/apply-goal-round-pacing.cjs [путь-к-dsh]
 *
 * Без аргумента корень dsh = родительский каталог репозитория brainagent.
 * Скрипт идемпотентен: повторный запуск ничего не меняет.
 *
 * Суть патча: хостовый goal-round-driver допускал следующий автономный
 * раунд сразу при каждом idle агента — одна «цель-напоминание» порождала
 * четыре раунда за минуту. Патч допускает раунд только после непрерывного
 * idle агента >= DSH_GOAL_ROUND_MIN_IDLE_MS (по умолчанию 180000 мс,
 * "0" = прежнее поведение без пауз).
 */
const { readFileSync, writeFileSync, existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

// Скрипт лежит в <dsh>/brainagent/host-patches/, корень dsh двумя уровнями выше.
const DSH_ROOT = process.argv[2] ? resolve(process.argv[2]) : resolve(__dirname, "..", "..");
const DRIVER = join(DSH_ROOT, "packages", "goal", "goal-round-driver");

const MARKER = "DSH_GOAL_ROUND_MIN_IDLE_MS";

function applyBlock(s, label, lines, replacementLines) {
  for (const nl of ["\r\n", "\n"]) {
    const from = lines.join(nl);
    if (s.includes(from)) {
      const fileNl = s.includes("\r\n") ? "\r\n" : "\n";
      return s.replace(from, replacementLines.join(fileNl));
    }
  }
  console.error(
    `ЯКОРЬ НЕ НАЙДЕН: ${label}. Файл хоста изменился относительно версии, ` +
      "для которой написан патч — обновите host-patches вручную.",
  );
  process.exit(1);
}

if (!existsSync(join(DRIVER, "src", "index.ts"))) {
  console.error(`Не найден ${join(DRIVER, "src", "index.ts")}.`);
  console.error("Укажите корень dsh аргументом: node apply-goal-round-pacing.cjs <путь-к-dsh>");
  process.exit(1);
}

// 1) src/index.ts
{
  const p = join(DRIVER, "src", "index.ts");
  let s = readFileSync(p, "utf8");
  if (s.includes(MARKER)) {
    console.log("OK: src/index.ts — патч уже применён, пропускаю");
  } else {
    s = applyBlock(
      s,
      "driver: helper пейсинга",
      [
        "export const name = 'goal-round-driver'",
        "export const inject = ['agents', 'goals', 'sessions']",
      ],
      [
        "export const name = 'goal-round-driver'",
        "export const inject = ['agents', 'goals', 'sessions']",
        "",
        "/** Default minimum continuous-idle time before admitting a goal round. */",
        "const DEFAULT_GOAL_ROUND_MIN_IDLE_MS = 180_000",
        "",
        "/** Resolve the goal-round idle pacing from the deployment environment. */",
        "function resolveGoalRoundMinIdleMs(): number {",
        "  const raw = process.env.DSH_GOAL_ROUND_MIN_IDLE_MS",
        "  if (raw !== undefined && raw !== '') {",
        "    const parsed = Number(raw)",
        "    if (Number.isFinite(parsed) && parsed >= 0) return parsed",
        "  }",
        "  return DEFAULT_GOAL_ROUND_MIN_IDLE_MS",
        "}",
      ],
    );

    s = applyBlock(
      s,
      "driver: поля состояния",
      ["  run: Promise<void> | undefined", "  stopping: boolean", "}"],
      [
        "  run: Promise<void> | undefined",
        "  stopping: boolean",
        "  /** When the exact Agent last became continuously idle. */",
        "  idleSince: number | undefined",
        "  /** Pending paced re-drive reservation. */",
        "  timer: ReturnType<typeof setTimeout> | undefined",
        "}",
      ],
    );

    s = applyBlock(
      s,
      "driver: init состояния",
      ["      run: undefined,", "      stopping: false,", "    }"],
      [
        "      run: undefined,",
        "      stopping: false,",
        "      idleSince: Date.now(),",
        "      timer: undefined,",
        "    }",
      ],
    );

    s = applyBlock(
      s,
      "driver: const minIdleMs",
      [
        "export function apply(ctx: Context): void {",
        "  const states = new Map<Agent, DriverState>()",
      ],
      [
        "export function apply(ctx: Context): void {",
        "  const states = new Map<Agent, DriverState>()",
        "  const minIdleMs = resolveGoalRoundMinIdleMs()",
      ],
    );

    s = applyBlock(
      s,
      "driver: attempt processing",
      [
        "    const attempt = state.attempt",
        "    if (attempt !== undefined) {",
        "      state.attempt = undefined",
        "      state.needsCheckpoint = true",
        "      state.requested = true",
        "      return",
        "    }",
      ],
      [
        "    const attempt = state.attempt",
        "    if (attempt !== undefined) {",
        "      state.attempt = undefined",
        "      state.needsCheckpoint = true",
        "      state.requested = true",
        "      return",
        "    }",
        "",
        "    // Round pacing: autonomous goal rounds are admitted only after the",
        "    // agent has been continuously idle for a while. Without pacing every",
        "    // idle moment immediately queued the next round, so one stuck goal",
        "    // spammed several back-to-back rounds within a single minute.",
        "    const idleFor = state.idleSince === undefined ? 0 : Date.now() - state.idleSince",
        "    if (minIdleMs > 0 && idleFor < minIdleMs) {",
        "      if (state.timer === undefined) {",
        "        state.timer = setTimeout(() => {",
        "          state.timer = undefined",
        "          requestDrive(state)",
        "        }, minIdleMs - idleFor)",
        "      }",
        "      return",
        "    }",
      ],
    );

    s = applyBlock(
      s,
      "driver: status listener",
      [
        "    ctx.on('agent/status', ({ agent, status }) => {",
        "      const state = stateFor(agent)",
        "      if (status === 'idle') {",
        "        state.competingQueued = false",
      ],
      [
        "    ctx.on('agent/status', ({ agent, status }) => {",
        "      const state = stateFor(agent)",
        "      if (status !== 'idle') {",
        "        state.idleSince = undefined",
        "        if (state.timer !== undefined) {",
        "          clearTimeout(state.timer)",
        "          state.timer = undefined",
        "        }",
        "        return",
        "      }",
        "      if (state.idleSince === undefined) state.idleSince = Date.now()",
        "      {",
        "        state.competingQueued = false",
      ],
    );

    s = applyBlock(
      s,
      "driver: disposed listener",
      ["    ctx.on('agent/disposed', ({ agent }) => { states.delete(agent) })"],
      [
        "    ctx.on('agent/disposed', ({ agent }) => {",
        "      const state = states.get(agent)",
        "      if (state?.timer !== undefined) clearTimeout(state.timer)",
        "      states.delete(agent)",
        "    })",
      ],
    );

    s = applyBlock(
      s,
      "driver: teardown",
      [
        "      for (const state of states.values()) {",
        "        state.stopping = true",
        "        disarm(state)",
      ],
      [
        "      for (const state of states.values()) {",
        "        state.stopping = true",
        "        if (state.timer !== undefined) {",
        "          clearTimeout(state.timer)",
        "          state.timer = undefined",
        "        }",
        "        disarm(state)",
      ],
    );

    writeFileSync(p, s);
    console.log("OK: src/index.ts — пейсинг установлен");
  }
}

// 2) tests/goal-round-driver.spec.ts — легаси-тесты сохраняют мгновенное поведение
{
  const p = join(DRIVER, "tests", "goal-round-driver.spec.ts");
  let s = readFileSync(p, "utf8");
  if (s.includes("process.env." + MARKER + " = '0'")) {
    console.log("OK: spec env — патч уже применён, пропускаю");
  } else {
    s = applyBlock(
      s,
      "spec: env пейсинга",
      ["import { afterEach, describe, expect, it, vi } from 'vitest'"],
      [
        "// Tests expect the legacy immediate round pacing.",
        "process.env.DSH_GOAL_ROUND_MIN_IDLE_MS = '0'",
        "import { afterEach, describe, expect, it, vi } from 'vitest'",
      ],
    );
    writeFileSync(p, s);
    console.log("OK: spec env установлен");
  }
}

// 3) tests/goal-round-driver.spec.ts — тест самого пейсинга
{
  const p = join(DRIVER, "tests", "goal-round-driver.spec.ts");
  let s = readFileSync(p, "utf8");
  if (s.includes("describe('goal-round pacing'")) {
    console.log("OK: тест пейсинга — уже добавлен, пропускаю");
  } else {
    const tail = s.trimEnd();
    if (tail.lastIndexOf("})") < 0) {
      console.error("ЯКОРЬ НЕ НАЙДЕН: конец spec");
      process.exit(1);
    }
    const fileNl = s.includes("\r\n") ? "\r\n" : "\n";
    const addition = [
      "",
      "describe('goal-round pacing', () => {",
      "  it('defers the first round until the configured idle window elapses', async () => {",
      "    const previous = process.env.DSH_GOAL_ROUND_MIN_IDLE_MS",
      "    process.env.DSH_GOAL_ROUND_MIN_IDLE_MS = '200'",
      "    try {",
      "      const test = await harness([textResponse('round one')])",
      "      test.ctx.goals.create(test.agent, { objective: 'paced continuation', maxGoalRounds: 1 })",
      "      await new Promise<void>(resolve => setTimeout(resolve, 60))",
      "      expect(test.adapter.requests).toHaveLength(0)",
      "      await waitForGoal(test.ctx, test.agent, goal => goal?.phase === 'blocked')",
      "      expect(test.adapter.requests).toHaveLength(1)",
      "    } finally {",
      "      if (previous === undefined) delete process.env.DSH_GOAL_ROUND_MIN_IDLE_MS",
      "      else process.env.DSH_GOAL_ROUND_MIN_IDLE_MS = previous",
      "    }",
      "  })",
      "})",
    ].join(fileNl);
    s = tail + fileNl + addition + fileNl;
    writeFileSync(p, s);
    console.log("OK: тест пейсинга добавлен");
  }
}

console.log("ГОТОВО. Перезапустите dsh, чтобы патч вступил в силу.");
