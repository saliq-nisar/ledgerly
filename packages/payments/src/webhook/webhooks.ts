import Stripe from "stripe";

import { PaymentConfigurationError, PaymentWebhookError } from "../errors/errors.js";
import type { Observer } from "../observability/observability.js";
import type {
  PaymentEvent,
  PaymentEventType,
  WebhookHandler,
  WebhookOutcome,
  WebhookPayload,
  WebhookResult,
} from "../types/public.js";
import { resolveRequestId } from "../validation/validation.js";
import type { EventHandler } from "./outcomes.js";
import type { EventGate } from "./storage.js";

export interface WebhookDependencies {
  stripe: () => Stripe;
  secret: string | undefined;
  secretStatus: "ok" | "missing" | "placeholder";
  toleranceSeconds: number;
  storage: EventGate | undefined;
  /** Handlers derived from `callbacks` (run after `on` handlers). */
  callbackHandlers: ReadonlyMap<string, EventHandler>;
  observer: Observer;
}

export interface WebhooksApi {
  /**
   * Verifies the Stripe-Signature header against the *raw* request body and
   * returns the parsed event. Throws PaymentWebhookError on any problem.
   */
  constructEvent(payload: WebhookPayload, signature: string | null | undefined): PaymentEvent;
  /** Registers a handler for one event type. Returns an unsubscribe function. */
  on<T extends PaymentEventType>(type: T, handler: WebhookHandler<T>): () => void;
  /**
   * Verifies the event, skips duplicates (when an eventStore is configured),
   * and runs the registered handlers.
   */
  handle(
    payload: WebhookPayload,
    signature: string | null | undefined,
    options?: { requestId?: string },
  ): Promise<WebhookResult>;
}

type AnyHandler = (event: PaymentEvent, context: { requestId: string }) => void | Promise<void>;

function isEventShape(value: PaymentEvent): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    value.object === "event" &&
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    typeof value.data === "object" &&
    value.data !== null
  );
}

export function createWebhooksApi(deps: WebhookDependencies): WebhooksApi {
  const handlers = new Map<string, Set<AnyHandler>>();

  function constructEvent(payload: WebhookPayload, signature: string | null | undefined): PaymentEvent {
    if (!deps.secret) {
      throw new PaymentConfigurationError(
        `webhookSecret (STRIPE_WEBHOOK_SECRET) is ${deps.secretStatus === "placeholder" ? "a placeholder value" : "not set"}, so webhook signatures cannot be verified. Use the signing secret from \`stripe listen\` or your Dashboard webhook endpoint.`,
      );
    }
    if (typeof signature !== "string" || signature.trim().length === 0 || signature.length > 4096) {
      throw new PaymentWebhookError("webhook_signature_missing", "Missing or invalid Stripe-Signature header.");
    }
    if (!(typeof payload === "string" || payload instanceof Uint8Array) || payload.length === 0) {
      throw new PaymentWebhookError(
        "webhook_payload_invalid",
        "Webhook payload must be the raw request body as a string or bytes (not parsed JSON).",
      );
    }

    let event: PaymentEvent;
    try {
      // Stripe checks the HMAC over the exact bytes and the timestamp tolerance
      // (replay window) before parsing the JSON.
      event = deps.stripe().webhooks.constructEvent(payload, signature, deps.secret, deps.toleranceSeconds);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
        throw new PaymentWebhookError(
          "webhook_signature_invalid",
          "Webhook signature verification failed (wrong secret, modified body, or expired timestamp).",
          { source: "stripe", type: "StripeSignatureVerificationError" },
        );
      }
      throw new PaymentWebhookError("webhook_payload_invalid", "Webhook payload is not valid JSON.", {
        source: "internal",
        type: error instanceof Error ? error.name : typeof error,
      });
    }
    if (!isEventShape(event)) {
      throw new PaymentWebhookError("webhook_payload_invalid", "Webhook payload is not a Stripe event.");
    }
    return event;
  }

  function on<T extends PaymentEventType>(type: T, handler: WebhookHandler<T>): () => void {
    if (typeof handler !== "function") throw new PaymentConfigurationError(`Webhook handler for "${type}" must be a function.`);
    const set = handlers.get(type) ?? new Set<AnyHandler>();
    // Safe widening: the handler is only ever invoked for events whose `type` equals T.
    const widened = handler as unknown as AnyHandler;
    set.add(widened);
    handlers.set(type, set);
    return () => {
      set.delete(widened);
    };
  }

  async function handle(
    payload: WebhookPayload,
    signature: string | null | undefined,
    options?: { requestId?: string },
  ): Promise<WebhookResult> {
    const requestId = resolveRequestId(options?.requestId);
    return deps.observer.instrument("webhooks.handle", requestId, async () => {
      const started = performance.now();
      const event = constructEvent(payload, signature);
      deps.observer.webhookReceived({ requestId, eventId: event.id, eventType: event.type });

      // Order: `on` handlers in registration order, then the callback handler.
      const registered: AnyHandler[] = [...(handlers.get(event.type) ?? [])];
      const fromCallbacks = deps.callbackHandlers.get(event.type);
      if (fromCallbacks) registered.push(fromCallbacks);

      const finish = (outcome: WebhookOutcome) => {
        deps.observer.webhook({
          requestId,
          eventId: event.id,
          eventType: event.type,
          outcome,
          durationMs: Math.round(performance.now() - started),
        });
        return { value: { eventId: event.id, eventType: event.type, outcome } };
      };

      if (registered.length === 0) return finish("ignored");

      const storageError = (error: unknown, step: string) =>
        new PaymentWebhookError("webhook_storage_failed", `Webhook event storage failed during ${step}.`, {
          source: "storage",
          type: error instanceof Error ? error.name : typeof error,
        });

      if (deps.storage) {
        let proceed: boolean;
        try {
          proceed = await deps.storage.begin(event.id, event.type);
        } catch (error) {
          throw storageError(error, "claim");
        }
        if (!proceed) return finish("duplicate");
      }

      try {
        for (const handler of registered) await handler(event, { requestId });
      } catch (error) {
        if (deps.storage) {
          await deps.storage.fail(event.id).catch(() =>
            deps.observer.log("error", "Failed to release webhook event claim", { requestId, eventId: event.id }),
          );
        }
        throw new PaymentWebhookError("webhook_handler_failed", `Webhook handler for ${event.type} failed.`, {
          source: "handler",
          type: error instanceof Error ? error.name : typeof error,
        });
      }

      if (deps.storage) {
        try {
          await deps.storage.succeed(event.id, event.type);
        } catch (error) {
          // Handlers already ran; a 500 makes Stripe retry, so they must be idempotent.
          throw storageError(error, "completion");
        }
      }
      return finish("processed");
    });
  }

  return { constructEvent, on, handle };
}
