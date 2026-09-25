// Callbacks, storage, logging and monitoring in isolation.
// `#region` markers are used by the demo website to display these exact snippets.
import { createPaymentClient, rejectCheckout, type PaymentLogger } from "../src/index.js";
import { products } from "./01-minimal.js";

declare const orders: { markPaid(orderId: string | null, sessionId: string): Promise<void> };
declare const inventory: { available(productId: string, quantity: number): Promise<boolean> };
declare const db: { insertEventIfAbsent(id: string, type: string): Promise<boolean>; deleteEvent(id: string): Promise<void> };
declare const logger: PaymentLogger;
declare const metrics: { timing(name: string, ms: number): void; increment(name: string): void };
declare const errorTracker: { capture(code: string, context: object): void };

export const withCallbacks = createPaymentClient({
  products,
  // #region callbacks
  callbacks: {
    // Before Stripe: throw to refuse the purchase (no session is created).
    async beforeCheckout({ product, quantity }) {
      if (!(await inventory.available(product.id, quantity))) throw rejectCheckout("Sorry, that's sold out.");
    },
    // After webhook verification: a typed, normalized payment outcome.
    async onPaymentSucceeded(payment) {
      await orders.markPaid(payment.clientReferenceId, payment.checkoutSessionId);
    },
  },
  // #endregion callbacks
});

export const withStorage = createPaymentClient({
  products,
  // #region storage
  // Deduplicate webhook deliveries with your own database (atomic claim).
  storage: {
    claim: (eventId, eventType) => db.insertEventIfAbsent(eventId, eventType),
    release: (eventId) => db.deleteEvent(eventId), // called if a handler fails
  },
  // #endregion storage
});

export const withObservability = createPaymentClient({
  products,
  // #region observability
  logging: { logger, level: "info" }, // every field is redacted first
  monitoring: {
    onRequest: (info) => metrics.timing(`payments.${info.operation}`, info.durationMs),
    onError: (error, info) => errorTracker.capture(error.code, info),
    onWebhookProcessed: (info) => metrics.increment(`webhook.${info.outcome}`),
  },
  // #endregion observability
});
