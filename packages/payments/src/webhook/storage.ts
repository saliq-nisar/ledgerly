import { PaymentConfigurationError } from "../errors/errors.js";
import type { PaymentStorage, ProcessedEventStorage, WebhookEventStore } from "../types/public.js";

/**
 * Internal, uniform view of the two supported storage styles.
 * - begin:   true = process the event; false = already handled (duplicate)
 * - succeed: all handlers finished
 * - fail:    a handler failed; allow Stripe's retry to reprocess
 */
export interface EventGate {
  begin(eventId: string, eventType: string): Promise<boolean>;
  succeed(eventId: string, eventType: string): Promise<void>;
  fail(eventId: string): Promise<void>;
}

function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === "function";
}

function isClaimStore(value: object): value is WebhookEventStore {
  return isFunction(Reflect.get(value, "claim")) && isFunction(Reflect.get(value, "release"));
}

function isProcessedStorage(value: object): value is ProcessedEventStorage {
  return isFunction(Reflect.get(value, "hasProcessedEvent")) && isFunction(Reflect.get(value, "markEventProcessed"));
}

export function toEventGate(storage: PaymentStorage | undefined, label: string): EventGate | undefined {
  if (storage === undefined) return undefined;
  if (typeof storage !== "object" || storage === null) throw new PaymentConfigurationError(`${label} must be an object.`);

  if (isClaimStore(storage)) {
    return {
      begin: (id, type) => storage.claim(id, type),
      succeed: async (id) => {
        await storage.complete?.(id);
      },
      fail: (id) => storage.release(id),
    };
  }
  if (isProcessedStorage(storage)) {
    return {
      begin: async (id) => !(await storage.hasProcessedEvent(id)),
      // Marked only after success, so a failed attempt is naturally retried.
      succeed: (id, type) => storage.markEventProcessed(id, type),
      fail: async () => {},
    };
  }
  throw new PaymentConfigurationError(
    `${label} must implement either { claim, release, complete? } or { hasProcessedEvent, markEventProcessed }.`,
  );
}
