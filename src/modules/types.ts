/**
 * BrainAgent — Shared types for inter-module communication.
 *
 * Barrel: типы разнесены по тематическим модулям в ./types/.
 * Импортируй отсюда как раньше: `import type { X } from "./types.ts"`.
 */
export * from "./types/core.ts";
export * from "./types/events.ts";
export * from "./types/neuro.ts";
export * from "./types/config.ts";
export * from "./types/rest.ts";
