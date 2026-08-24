/**
 * BrainAgent eval harness (v0.5.0).
 *
 * Поднимает плагин целиком на мокнутом dsh-контексте — тот же контракт,
 * что smoke-phase2/3, но с перехватом результатов вместо логов:
 * слушатели, команды, followup-доставка и эффекты с честным cleanup.
 * Каждый *.eval.ts-файл получает свежий процесс vitest и собственный
 * dataDir во временной папке, поэтому сценарии не отравляют друг друга.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apply, Config } from "../index.ts";
import { textOfContent } from "../plugin/config.ts";

type Listener = (...args: any[]) => any;
type ContentPart = { type: string; text?: string };

export type PreStepResult = {
  kind: string;
  contextText: string;
  messages: Array<{ content: ContentPart[] }>;
};

export type BrainHandle = {
  config: any;
  dataDir: string;
  session: { id: string };
  agent: { id: string; followup: (m: { content: ContentPart[] }) => void };
  listeners: Record<string, Listener[]>;
  logs: string[];
  followups: Array<{ content: ContentPart[] }>;
  commands: Record<string, { name: string; handler: (...args: any[]) => any }>;
  errors: () => string[];
  emit: (event: { type: string; data: unknown }) => void;
  userTurn: (userText: string, replyText: string) => void;
  preStep: (text: string) => Promise<PreStepResult>;
  runCommand: (name: string, rawInput: string) => Promise<any>;
  dispose: () => void;
};

const mkContent = (text: string): ContentPart[] => [{ type: "text", text }];

export async function bootBrain(
  configOverrides: Record<string, unknown> = {},
): Promise<BrainHandle> {
  const dataDir = mkdtempSync(join(tmpdir(), "brainagent-eval-"));
  // Схема schemastery вызывается как функция (применяет дефолты),
  // но в типах это не отражено — зовём через any, как и smoke-файлы.
  const config = (Config as unknown as (input: unknown) => any)({
    dataDir,
    ...configOverrides,
  });

  const listeners: Record<string, Listener[]> = {};
  const disposers: Array<() => void> = [];
  const logs: string[] = [];
  const followups: Array<{ content: ContentPart[] }> = [];
  const commands: BrainHandle["commands"] = {};
  const session = { id: "eval-session" };
  const agent = {
    id: session.id,
    followup: (m: { content: ContentPart[] }) => followups.push(m),
  };

  const ctx = {
    logger: {
      info: (m: string) => logs.push("info: " + m),
      warn: (m: string) => logs.push("warn: " + m),
      error: (m: string) => logs.push("error: " + m),
    },
    on: (name: string, cb: Listener) => {
      (listeners[name] ??= []).push(cb);
      return () => {};
    },
    effect: (fn: () => unknown) => {
      const disposer = fn();
      if (typeof disposer === "function") disposers.push(disposer as () => void);
      return () => {};
    },
    agents: { list: () => [agent] },
    commands: {
      register: (def: { name: string; handler: (...args: any[]) => any }) => {
        commands[def.name] = def;
        return () => {};
      },
    },
  };

  apply(ctx as any, config);

  const emit = (event: { type: string; data: unknown }): void => {
    for (const cb of listeners["session/event"] ?? []) cb(session, event);
  };

  const userTurn = (userText: string, replyText: string): void => {
    emit({ type: "user/message", data: { content: mkContent(userText) } });
    emit({
      type: "assistant/message",
      data: { message: { content: mkContent(replyText) } },
    });
    emit({ type: "turn/end", data: {} });
  };

  const preStep = async (text: string): Promise<PreStepResult> => {
    const base = { kind: "enter" as const, messages: [] as Array<{ content: ContentPart[] }> };
    let decision: any = base;
    for (const cb of listeners["agent/pre-step"] ?? []) {
      decision = await cb(
        { agent, messages: [{ content: mkContent(text) }] },
        async () => base,
      );
    }
    const added =
      decision.messages.length > base.messages.length
        ? decision.messages[decision.messages.length - 1]
        : null;
    return {
      kind: decision.kind,
      contextText: added ? textOfContent(added.content as any) : "",
      messages: decision.messages,
    };
  };

  const runCommand = (name: string, rawInput: string): Promise<any> => {
    const def = commands[name];
    if (!def) throw new Error(`команда /${name} не зарегистрирована`);
    return def.handler({
      commandId: "eval",
      agent,
      rawInput,
      attachments: [],
      signal: new AbortController().signal,
    });
  };

  const dispose = (): void => {
    for (const d of disposers) {
      try {
        d();
      } catch {
        /* очистка не должна ронять сценарий */
      }
    }
  };

  return {
    config,
    dataDir,
    session,
    agent,
    listeners,
    logs,
    followups,
    commands,
    errors: () => logs.filter((l) => l.startsWith("error:")),
    emit,
    userTurn,
    preStep,
    runCommand,
    dispose,
  };
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
