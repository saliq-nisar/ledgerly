// Fully customised, production-style configuration. Every option is optional.
import {
  createPaymentClient,
  defineProducts,
  rejectCheckout,
  type PaymentLogger,
  type WebhookEventStore,
} from "../src/index.js";

// Your own infrastructure (stubs for the example).
// `#region` markers are used by the demo website to display these exact snippets.
declare const db: {
  insertEventIfAbsent(id: string, type: string): Promise<boolean>;
  deleteEvent(id: string): Promise<void>;
  markOrderPaid(orderId: string): Promise<void>;
  attachSession(orderId: string, sessionId: string): Promise<void>;
};
declare const inventory: { available(productId: string, quantity: number): Promise<boolean> };
declare const logger: PaymentLogger; // pino / winston / console-compatible
declare const metrics: { timing(name: string, ms: number): void; increment(name: string): void };
declare const errorTracker: { capture(code: string, context: object): void };

// #region products
const products = defineProducts({
  basic: { name: "Basic", description: "For side projects", price: 999, currency: "usd" },
  pro: {
    name: "Professional",
    description: "For growing teams",
    price: 2999,
    currency: "usd",
    images: ["https://cdn.example.com/pro.png"],
    taxCode: "txcd_10103001",
    taxBehavior: "exclusive",
    maxQuantity: 50,
    metadata: { tier: "pro" },
    checkout: { allowPromotionCodes: true },
  },
  // A Price managed in the Stripe Dashboard; verified against price/currency before use.
  enterprise: { name: "Enterprise", price: 99900, currency: "usd", stripePriceId: "price_1ExampleEnterprise" },
  legacy: { name: "Legacy", price: 499, currency: "usd", active: false },
});
// #endregion products

// Atomic dedupe via a unique index on event_id.
const storage: WebhookEventStore = {
  claim: (id, type) => db.insertEventIfAbsent(id, type),
  release: (id) => db.deleteEvent(id),
};

// #region config
export const payments = createPaymentClient({
  environment: "production",
  products,
  appUrl: "https://shop.example.com",

  urls: { success: "/orders/complete", cancel: "/pricing?cancelled={PRODUCT_ID}" },

  checkout: {
    collectBillingAddress: true,
    collectPhoneNumber: false,
    automaticTax: true,
    locale: "auto",
    submitType: "pay",
    createInvoice: true,
    customText: { submit: "You can cancel any time from your account settings." },
    expiresInMinutes: 60,
    quantity: { min: 1, max: 10 },
  },

  metadata: { allowedKeys: ["orderId", "userId"], maxKeys: 10 },

  security: { allowedRedirectOrigins: ["https://account.example.com"] },

  storage,

  callbacks: {
    async beforeCheckout({ product, quantity }) {
      if (!(await inventory.available(product.id, quantity))) throw rejectCheckout("Sorry, that's sold out.");
    },
    async afterCheckout({ session, metadata }) {
      if (metadata.orderId) await db.attachSession(metadata.orderId, session.id);
    },
    async onPaymentSucceeded(payment) {
      if (payment.metadata.orderId) await db.markOrderPaid(payment.metadata.orderId);
    },
  },

  logging: { logger, level: "info" },

  monitoring: {
    onRequest: (info) => metrics.timing(`payments.${info.operation}`, info.durationMs),
    onError: (error, info) => errorTracker.capture(error.code, info),
    onWebhookProcessed: (info) => metrics.increment(`payments.webhook.${info.outcome}`),
  },

  errors: { publicMessages: { product_unavailable: "That plan is no longer offered." } },
});
// #endregion config

// Per-checkout customisation (always server-side values).
export async function checkoutForUser(user: { id: string; email: string }, orderId: string) {
  // #region per-call
  return payments.checkout.create({
    productId: "pro",
    quantity: 3,
    idempotencyKey: `order-${orderId}`,
    customer: { email: user.email },
    clientReferenceId: orderId,
    metadata: { orderId, userId: user.id },
    options: { locale: "fr", allowPromotionCodes: false },
    redirect: { success: "https://account.example.com/billing" },
  });
  // #endregion per-call
}
