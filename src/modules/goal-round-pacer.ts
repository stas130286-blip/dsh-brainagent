/**
 * Goal Round Pacer (v0.9.11) — runtime-пейсинг гол-раундов хоста
 * средствами самого плагина, без правки файлов dsh.
 *
 * Реестровая версия dsh-goal-round-driver не имеет пейсинга: раунд
 * инжектится сразу при каждом переходе агента в idle, что даёт
 * несколько автономных раундов в минуту (дефект, ради которого в
 * v0.9.5 появился host-patches/apply-goal-round-pacing.cjs — но тот
 * патчит только исходники моно-репо и не работает на registry-установках).
 *
 * Пейсер перехватывает сообщения раундов в inbox агента
 * (source.kind === "goal", round > 0): преждевременный раунд
 * удаляется из inbox, его цель ставится на паузу и возвращается в
 * работу по истечении окна тишины — раунд откладывается, а не
 * теряется. Порог задаёт DSH_GOAL_ROUND_MIN_IDLE_MS (по умолчанию
 * 180000 мс = 3 минуты; 0 = выключить пейсер). Если хост уже
 * пропатчен (моно-репо), двойной пейсинг безвреден.
 *
 * Использованы только публичные швы хоста: события
 * `agent/inbox/inserted` и сервис целей (pause/resume/get).
 */

export const DEFAULT_GOAL_ROUND_MIN_IDLE_MS = 180_000;

export type GoalRoundPacerAgent = {
  id: string;
  inbox: { remove(messageId: string): unknown };
};

export type GoalRoundPacerMessage = {
  id: string;
  source?: { kind?: string; round?: number };
};

export type GoalRoundPacerGoalView = {
  id: string;
  revision: number;
  phase: string;
  activation: string;
};

export type GoalRoundPacerGoals = {
  get(agent: GoalRoundPacerAgent): GoalRoundPacerGoalView | undefined;
  pause(
    agent: GoalRoundPacerAgent,
    ref: { id: string; revision: number },
  ): unknown;
  resume(
    agent: GoalRoundPacerAgent,
    ref: { id: string; revision: number },
  ): unknown;
};

export type GoalRoundPacerDeps = {
  /** Подписка на `agent/inbox/inserted`; может вернуть диспозер. */
  onInserted(
    handler: (data: {
      agent: GoalRoundPacerAgent;
      message: GoalRoundPacerMessage;
    }) => void,
  ): unknown;
  /**
   * Сервис целей или его ленивый getter: драйвер раундов сам может
   * успеть поставить цель на паузу к моменту нашего обработчика, а
   * сервис у хоста появляется вместе с dsh-goal — читаем по требованию.
   */
  goals: GoalRoundPacerGoals | (() => GoalRoundPacerGoals | undefined);
  logger?: { info: (msg: string) => void };
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => { cancel(): void };
  env?: Record<string, string | undefined>;
};

/** Источник сообщения идентифицирует автоматический гол-раунд. */
export function isGoalRoundSource(
  source: { kind?: string; round?: number } | undefined,
): boolean {
  return (
    !!source &&
    source.kind === "goal" &&
    typeof source.round === "number" &&
    source.round > 0
  );
}

/**
 * Порог тишины из окружения. 0 = пейсер выключен; нечисловые и
 * отрицательные значения → дефолт (как у патча хоста).
 */
export function resolveGoalRoundMinIdleMs(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env.DSH_GOAL_ROUND_MIN_IDLE_MS;
  if (raw === undefined || raw === "") return DEFAULT_GOAL_ROUND_MIN_IDLE_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_GOAL_ROUND_MIN_IDLE_MS;
}

/**
 * Запустить runtime-пейсер гол-раундов.
 * Возвращает диспозер; undefined, когда пейсер выключен (0 мс).
 */
export function startGoalRoundPacer(
  deps: GoalRoundPacerDeps,
): (() => void) | undefined {
  const now = deps.now ?? Date.now;
  const getGoals = (): GoalRoundPacerGoals | undefined =>
    typeof deps.goals === "function" ? deps.goals() : deps.goals;
  const minIdleMs = resolveGoalRoundMinIdleMs(deps.env ?? process.env);
  if (minIdleMs <= 0) return undefined;

  const schedule =
    deps.schedule ??
    ((fn: () => void, ms: number) => {
      const timer = setTimeout(fn, ms);
      timer.unref?.();
      return { cancel: () => clearTimeout(timer) };
    });

  const lastRoundAt = new Map<string, number>();
  const resumeTimers = new Map<string, { cancel(): void }>();
  let stopped = false;

  function scheduleResume(agent: GoalRoundPacerAgent, waitMs: number): void {
    if (resumeTimers.has(agent.id)) return; // уже возвращаем
    const timer = schedule(() => {
      resumeTimers.delete(agent.id);
      if (stopped) return;
      try {
        // Цель берём заново: за время паузы пользователь мог её
        // изменить/завершить — возобновляем только всё ещё paused.
        const goals = getGoals();
        const goal = goals?.get(agent);
        if (goals && goal && goal.phase === "paused") {
          goals.resume(agent, { id: goal.id, revision: goal.revision });
          deps.logger?.info(
            `BrainAgent GoalRoundPacer: цель ${goal.id} возвращена в работу после окна тишины`,
          );
        }
      } catch (error) {
        deps.logger?.info(
          `BrainAgent GoalRoundPacer: не удалось вернуть цель — ${(error as Error).message}`,
        );
      }
    }, waitMs);
    resumeTimers.set(agent.id, timer);
  }

  const off = deps.onInserted(({ agent, message }) => {
    if (stopped) return;
    if (!isGoalRoundSource(message.source)) return;

    const at = now();
    const last = lastRoundAt.get(agent.id);
    if (last === undefined || at - last >= minIdleMs) {
      lastRoundAt.set(agent.id, at);
      return; // окно тишины выдержано — пропускаем
    }

    // Преждевременный раунд: удаляем из inbox (драйвер увидит discard
    // и корректно свернёт свою резервацию), цель — на паузу.
    try {
      agent.inbox.remove(message.id);
    } catch (error) {
      deps.logger?.info(
        `BrainAgent GoalRoundPacer: не удалось удалить раунд из inbox — ${(error as Error).message}`,
      );
      return;
    }
    try {
      const goals = getGoals();
      if (!goals) return;
      const goal = goals.get(agent);
      if (!goal) return;
      if (goal.phase === "active" && goal.activation === "armed") {
        goals.pause(agent, { id: goal.id, revision: goal.revision });
      } else if (goal.phase !== "paused") {
        // Цель уже завершена/заблокирована — откладывать нечего.
        return;
      }
      // paused допускаем: драйвер раундов мог успеть поставить цель на
      // паузу сам после discard — мы всё равно обязаны её вернуть.
      scheduleResume(agent, minIdleMs - (at - last));
      deps.logger?.info(
        `BrainAgent GoalRoundPacer: раунд ${message.source?.round} цели ${goal.id} отложен на ${minIdleMs - (at - last)}мс`,
      );
    } catch (error) {
      deps.logger?.info(
        `BrainAgent GoalRoundPacer: не удалось поставить цель на паузу — ${(error as Error).message}`,
      );
    }
  });

  deps.logger?.info(
    `BrainAgent GoalRoundPacer: runtime-пейсинг гол-раундов запущен (окно ${minIdleMs}мс)`,
  );

  return () => {
    stopped = true;
    if (typeof off === "function") (off as () => void)();
    for (const timer of resumeTimers.values()) timer.cancel();
    resumeTimers.clear();
  };
}
