/**
 * Corpus Callosum — The event bus connecting all brain modules.
 *
 * In the human brain, the corpus callosum is a thick bundle of nerve fibers
 * that connects the left and right hemispheres, enabling them to communicate.
 *
 * Here it serves as the central pub/sub bus: every brain module can emit
 * signals and subscribe to signals from other modules, enabling parallel
 * processing with coordination.
 */

import type { BrainEventMap, BrainEventName } from "./types.ts";

type Listener<K extends BrainEventName> = (data: BrainEventMap[K]) => void | Promise<void>;

type ListenerEntry = {
  event: BrainEventName;
  handler: Listener<BrainEventName>;
  priority: number;
};

class CorpusCallosum {
  private listeners: ListenerEntry[] = [];
  private recentSignals = new Map<BrainEventName, { data: unknown; timestamp: number }>();

  /**
   * Subscribe to a brain signal.
   * Higher priority listeners execute first.
   */
  on<K extends BrainEventName>(event: K, handler: Listener<K>, priority = 0): () => void {
    const entry: ListenerEntry = {
      event,
      handler: handler as Listener<BrainEventName>,
      priority,
    };
    this.listeners.push(entry);
    this.listeners.sort((a, b) => b.priority - a.priority);

    // Return unsubscribe function
    return () => {
      const idx = this.listeners.indexOf(entry);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  /**
   * Emit a brain signal to all subscribers.
   * Errors in individual listeners are caught and logged, not propagated.
   */
  async emit<K extends BrainEventName>(event: K, data: BrainEventMap[K]): Promise<void> {
    // Store for late-arriving modules that need the last state
    this.recentSignals.set(event, { data, timestamp: Date.now() });

    const matching = this.listeners.filter((l) => l.event === event);

    await Promise.allSettled(matching.map((l) => Promise.resolve(l.handler(data))));
  }

  /**
   * Synchronous emit for hot paths where we can't afford async overhead.
   */
  emitSync<K extends BrainEventName>(event: K, data: BrainEventMap[K]): void {
    this.recentSignals.set(event, { data, timestamp: Date.now() });

    for (const l of this.listeners) {
      if (l.event !== event) continue;
      try {
        l.handler(data);
      } catch {
        // Swallow errors in sync path
      }
    }
  }

  /**
   * Get the most recent signal of a given type (useful for modules that
   * activate after the signal was already emitted in this cycle).
   */
  getLastSignal<K extends BrainEventName>(
    event: K,
    maxAgeMs = 30_000,
  ): BrainEventMap[K] | undefined {
    const entry = this.recentSignals.get(event);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > maxAgeMs) return undefined;
    return entry.data as BrainEventMap[K];
  }

  /** Clear all signals older than maxAgeMs. Called periodically. */
  gc(maxAgeMs = 60_000): void {
    const now = Date.now();
    for (const [key, val] of this.recentSignals) {
      if (now - val.timestamp > maxAgeMs) {
        this.recentSignals.delete(key);
      }
    }
  }
}

/** Singleton bus — all brain modules share one instance per plugin lifecycle */
export const bus = new CorpusCallosum();
