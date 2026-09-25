import type Stripe from "stripe";

import { PaymentConfigurationError } from "../errors/errors.js";
import type { ProductRegistry } from "../products/products.js";
import type {
  PaymentCallbacks,
  PaymentEvent,
  PaymentOutcome,
  ProductCatalog,
  ProductId,
  WebhookContext,
} from "../types/public.js";
import { RESERVED_METADATA_KEYS } from "../validation/validation.js";

/**
 * Translates verified Stripe events into application-level callbacks, so apps
 * can react to "payment succeeded" without knowing which Stripe events mean that.
 */

export type EventHandler = (event: PaymentEvent, context: WebhookContext) => void | Promise<void>;

const CALLBACK_NAMES = [
  "beforeCheckout",
  "afterCheckout",
  "onPaymentSucceeded",
  "onPaymentFailed",
  "onPaymentAttemptFailed",
  "onCheckoutExpired",
] as const;

export function validateCallbacks<Id extends string>(input: unknown): PaymentCallbacks<Id> {
  if (input === undefined) return {};
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new PaymentConfigurationError("callbacks must be an object.");
  }
  for (const key of Object.keys(input)) {
    if (!(CALLBACK_NAMES as readonly string[]).includes(key)) {
      throw new PaymentConfigurationError(`callbacks has unsupported property "${key.slice(0, 40)}".`);
    }
    const value: unknown = Reflect.get(input, key);
    if (value !== undefined && typeof value !== "function") {
      throw new PaymentConfigurationError(`callbacks.${key} must be a function.`);
    }
  }
  return input as PaymentCallbacks<Id>;
}

function outcomeFromSession<P extends ProductCatalog>(
  eventId: string,
  session: Stripe.Checkout.Session,
  products: ProductRegistry<P>,
): PaymentOutcome<ProductId<P>> {
  const quantity = Number.parseInt(session.metadata?.quantity ?? "", 10);
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(session.metadata ?? {})) {
    if (!RESERVED_METADATA_KEYS.has(key)) metadata[key] = value;
  }
  return Object.freeze({
    eventId,
    checkoutSessionId: session.id,
    paymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
    product: products.get(session.metadata?.productId) ?? null,
    quantity: Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 1,
    amountTotal: session.amount_total ?? 0,
    currency: session.currency ?? "",
    customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
    clientReferenceId: session.client_reference_id ?? null,
    metadata: Object.freeze(metadata),
  });
}

/** Builds event handlers for the configured callbacks, keyed by Stripe event type. */
export function callbackHandlers<P extends ProductCatalog>(
  callbacks: PaymentCallbacks<ProductId<P>>,
  products: ProductRegistry<P>,
): ReadonlyMap<string, EventHandler> {
  const map = new Map<string, EventHandler>();
  const { onPaymentSucceeded, onPaymentFailed, onPaymentAttemptFailed, onCheckoutExpired } = callbacks;

  if (onPaymentSucceeded) {
    map.set("checkout.session.completed", async (event, ctx) => {
      if (event.type !== "checkout.session.completed") return;
      const session = event.data.object;
      // Delayed methods complete unpaid; they're reported via async_payment_succeeded.
      if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;
      await onPaymentSucceeded(outcomeFromSession(event.id, session, products), ctx);
    });
    map.set("checkout.session.async_payment_succeeded", async (event, ctx) => {
      if (event.type !== "checkout.session.async_payment_succeeded") return;
      await onPaymentSucceeded(outcomeFromSession(event.id, event.data.object, products), ctx);
    });
  }
  if (onPaymentFailed) {
    map.set("checkout.session.async_payment_failed", async (event, ctx) => {
      if (event.type !== "checkout.session.async_payment_failed") return;
      await onPaymentFailed(outcomeFromSession(event.id, event.data.object, products), ctx);
    });
  }
  if (onCheckoutExpired) {
    map.set("checkout.session.expired", async (event, ctx) => {
      if (event.type !== "checkout.session.expired") return;
      await onCheckoutExpired(outcomeFromSession(event.id, event.data.object, products), ctx);
    });
  }
  if (onPaymentAttemptFailed) {
    map.set("payment_intent.payment_failed", async (event, ctx) => {
      if (event.type !== "payment_intent.payment_failed") return;
      const intent = event.data.object;
      await onPaymentAttemptFailed(
        Object.freeze({
          eventId: event.id,
          paymentIntentId: intent.id,
          product: products.get(intent.metadata?.productId) ?? null,
          amount: intent.amount,
          currency: intent.currency,
          declineCode: intent.last_payment_error?.decline_code ?? null,
          errorCode: intent.last_payment_error?.code ?? null,
        }),
        ctx,
      );
    });
  }
  return map;
}
