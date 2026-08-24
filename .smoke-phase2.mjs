// Phase 2 smoke test — run with: node --import tsx/esm smoke-phase2.mjs
// from the dsh checkout root (brainagent/.smoke-phase2.mjs copy).
const mod = await import("./src/index.ts");
const config = mod.Config({});
console.log("config modules flags:", JSON.stringify(config.modules));

const listeners = {};
const effects = [];
const logs = [];
const registeredCommands = {};
const mockAgent = { id: "smoke-session", followup: () => {} };
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

// Simulate a user message → cycle start.
const session = { id: "smoke-session" };
const mkContent = (text) => [{ type: "text", text }];
for (const cb of listeners["session/event"] ?? []) {
  cb(session, { type: "user/message", data: { content: mkContent("Привет! Расскажи, как у тебя дела с памятью?") } });
}
// Assistant reply capture.
for (const cb of listeners["session/event"] ?? []) {
  cb(session, {
    type: "assistant/message",
    data: { message: { content: mkContent("Привет! У меня отличная память, я запоминаю наши разговоры.") } },
  });
}
// Turn end → full learning cycle.
for (const cb of listeners["session/event"] ?? []) {
  cb(session, { type: "turn/end", data: {} });
}

await new Promise((r) => setTimeout(r, 1500));
console.log("--- log tail ---");
for (const line of logs.slice(-15)) console.log(line);
console.log("SMOKE OK");
// The plugin leaves background timers (bus GC, circadian, dream mode)
// running, so exit explicitly — same as the phase-3 smoke.
process.exit(0);
