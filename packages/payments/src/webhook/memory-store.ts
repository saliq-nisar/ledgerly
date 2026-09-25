import type { WebhookEventStore } from "../types/public.js";

/**
 * In-memory WebhookEventStore for local development, tests, and single-process
 * demos ONLY. It is lost on restart and not shared between instances, so it
 * cannot guarantee exactly-once processing in production. Use a database
 * table with a unique constraint on the event ID instead.
 */
export function createMemoryEventStore(options: { ttlMs?: number; maxEntries?: number } = {}): WebhookEventStore {
  const ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000;
  const maxEntries = options.maxEntries ?? 10_000;
  const claimed = new Map<string, number>();

  function prune(now: number) {
    for (const [id, at] of claimed) {
      if (now - at > ttlMs || claimed.size > maxEntries) claimed.delete(id);
      else break; // Map preserves insertion order, so the rest are newer.
    }
  }

  return {
    async claim(eventId) {
      const now = Date.now();
      prune(now);
      if (claimed.has(eventId)) return false;
      claimed.set(eventId, now);
      return true;
    },
    async release(eventId) {
      claimed.delete(eventId);
    },
  };
}
