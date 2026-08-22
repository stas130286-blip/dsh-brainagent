// Phase-3 smoke: boots the plugin with a mocked dsh context (incl. ctx.agents),
// runs one user cycle and one autonomous (<autonomous-intent>) cycle.
// Run like the phase-2 smoke: from the brainagent dir in the dsh checkout
// (brainagent/.smoke-phase3.mjs copy) via `node --import tsx/esm .smoke-phase3.mjs`.
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const mod = await import("./src/index.ts");
const dataDir = join(tmpdir(), "brainagent-smoke3-" + Date.now());
mkdirSync(dataDir, { recursive: true });
const config = mod.Config({ dataDir });
const flags = config.modules;
console.log("module flags:", Object.keys(flags).length, JSON.stringify(flags));
console.log("circadian:", JSON.stringify(config.circadian));

const listeners = {};
const effects = [];
const logs = [];
const followups = [];
const registeredCommands = {};
const mockAgent = { id: "smoke-session", followup: (m) => followups.push(m) };
const ctx = {
  logger: {
    info: (m) => logs.push("info: " + m),
    warn: (m) => logs.push("warn: " + m),
    error: (m) => logs.push("error: " + m),
  },
  on: (name, cb) => {
    (listeners[name] ??= []).push(cb);
    return () => {};
  },
  effect: (fn) => {
    effects.push(fn);
    return () => {};
  },
  agents: { list: () => [mockAgent] },
  commands: {
    register: (def) => {
      registeredCommands[def.name] = def;
      return () => {};
    },
  },
};

mod.apply(ctx, config);
console.log("listeners:", Object.keys(listeners).join(", "));
console.log("effects registered:", effects.length);
console.log("commands registered:", Object.keys(registeredCommands).join(", "));

// /brain status through the dsh command surface.
if (registeredCommands.brain) {
  const result = await registeredCommands.brain.handler({
    commandId: "smoke",
    agent: mockAgent,
    rawInput: " status",
    attachments: [],
    signal: new AbortController().signal,
  });
  console.log("/brain status kind:", result.kind, "(text length:", (result.text ?? "").length + ")");
}

const session = { id: "smoke-session" };
const mkContent = (text) => [{ type: "text", text }];
const emit = (event) => {
  for (const cb of listeners["session/event"] ?? []) cb(session, event);
};

// 1. User message → cycle start.
emit({ type: "user/message", data: { content: mkContent("Привет! Расскажи, как у тебя дела с памятью?") } });
// 2. Assistant reply.
emit({
  type: "assistant/message",
  data: { message: { content: mkContent("Привет! У меня отличная память, я запоминаю наши разговоры.") } },
});
// 3. Turn end → learning cycle.
emit({ type: "turn/end", data: {} });

// 3a. Proactive delivery path (fresh state, previous cycle was a user one):
// forceImpulse → enqueueSystemEvent → followup(cron), framed for the model.
const vi = await import("./src/modules/vital-impulse.ts");
vi.forceImpulse('<autonomous-intent source="test">Проверка доставки проактивного сообщения.</autonomous-intent>');
console.log("followups queued by autonomy:", followups.length);
if (followups.length > 0) {
  console.log("followup source:", JSON.stringify(followups[0].source));
  console.log("followup framed:", followups[0].content[0].text.startsWith("Это не сообщение пользователя"));
}
const followupsBeforeLoop = followups.length;

// 4. Autonomous cycle: proactive intent delivered as a user message.
emit({
  type: "user/message",
  data: { content: mkContent('<autonomous-intent source="goal">Хочется осмыслить наш прошлый разговор и поделиться наблюдениями.</autonomous-intent>') },
});
emit({
  type: "assistant/message",
  data: { message: { content: mkContent("Я обдумал наш разговор — интересно, что ты спрашиваешь о памяти.") } },
});
emit({ type: "turn/end", data: {} });

// 5. tools/pre-execute gate: deny web tools during autonomous cycles, allow otherwise.
for (const cb of listeners["tools/pre-execute"] ?? []) {
  const decision = await cb({ name: "web_search", agent: mockAgent }, async () => ({ kind: "allow" }));
  console.log("tools gate decision:", JSON.stringify(decision));
}

// 6. Loop breaker: the previous cycle was autonomous → new impulses are
// suppressed until the human returns.
vi.forceImpulse('<autonomous-intent source="test">Вторая попытка сразу после автономного цикла.</autonomous-intent>');
console.log("loop-breaker held:", followups.length === followupsBeforeLoop);

await new Promise((r) => setTimeout(r, 2000));
console.log("--- log tail ---");
for (const line of logs.slice(-25)) console.log(line);
const errors = logs.filter((l) => l.startsWith("error:"));
if (errors.length > 0) {
  console.log("--- errors ---");
  for (const e of errors) console.log(e);
  throw new Error("smoke failed with errors");
}
console.log("SMOKE OK");
process.exit(0);
