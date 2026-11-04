/**
 * Source attribution for every message BrainAgent injects into a session.
 *
 * Session format v4 (dsh 0.2.1+) retired the shared `plugin` kind: a message
 * must name its producer, and the v3 migration lifts released plugin sources
 * into the `plugin:<name>` namespace. Format v3 hosts reject that namespace,
 * so the shape is picked from the format version the host declares.
 */

import * as sessionModule from "@deepseek-ai/dsh-session";
import type { MessageSource } from "@deepseek-ai/dsh-llm";

// MessageSourceMap is merge-extensible by design: each producer declares the
// kind it emits, so the v4 namespace entry has to be registered here.
declare module "@deepseek-ai/dsh-llm" {
  interface MessageSourceMap {
    "plugin:brainagent": { kind: "plugin:brainagent" };
  }
}

/** Format version the running host stamps into new session logs (3 when unexported). */
const hostFormatVersion =
  (sessionModule as { SESSION_FORMAT_VERSION?: number }).SESSION_FORMAT_VERSION ?? 3;

/** Producer-owned source on v4 hosts, released plugin wrapper on v3 hosts. */
export const BRAINAGENT_SOURCE: MessageSource =
  hostFormatVersion >= 4
    ? { kind: "plugin:brainagent" }
    : ({ kind: "plugin", plugin: "brainagent" } as unknown as MessageSource);
