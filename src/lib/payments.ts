import "server-only";

import {
  createMemoryEventStore,
  createPaymentClient,
  isPaymentError,
  type PaymentClient,
} from "@ledgerly/payments";
import { createCheckoutHandler, createWebhookHandler } from "@ledgerly/payments/web";

import { MAX_QUANTITY, MIN_QUANTITY, PRODUCT_CATALOG } from "@/config/products";
import { demoRateLimit } from "@/lib/rate-limit";

/**
 * The demo's single integration point with @ledgerly/payments, for the
 * OPTIONAL real Stripe test.
 *
 * The documentation site never depends on this: without Stripe credentials the
 * client simply isn't created and every page still renders. Nothing here runs
 * at import time; the client is created lazily on first use.
 *
 * `server-only` makes the build fail if a Client Component imports this file.
 */

type Payments = PaymentClient<typeof PRODUCT_CATALOG>;

interface ReadyPayments {
  ok: true;
  payments: Payments;
  checkoutHandler: (request: Request) => Promise<Response>;
  webhookHandler: (request: Request) => Promise<Response>;
}

interface UnavailablePayments {
  ok: false;
  /** Developer-facing reason. Never contains secret values. */
  reason: string;
}

function createPayments(): ReadyPayments {
  const payments = createPaymentClient({
    products: PRODUCT_CATALOG,
    // secretKey / webhookSecret / environment default to STRIPE_SECRET_KEY,
    // STRIPE_WEBHOOK_SECRET and PAYMENTS_ENVIRONMENT (default "test").
    // APP_URL is optional for local testing; it defaults to the dev server origin.
    appUrl: process.env.APP_URL?.trim() || "http://localhost:3000",
    checkout: { quantity: { min: MIN_QUANTITY, max: MAX_QUANTITY } },
    webhooks: {
      // DEMO ONLY: in-memory deduplication is lost on restart and not shared
      // across instances. Production apps should persist event IDs in a database.
      eventStore: createMemoryEventStore(),
    },
  });

  payments.webhooks.on("checkout.session.completed", async (event) => {
    const session = event.data.object;
    if (session.payment_status === "paid") {
      // Fulfil the order here (grant access, send email, …). This webhook, not
      // the success-page redirect, is the authoritative "paid" signal.
    }
  });
  payments.webhooks.on("checkout.session.async_payment_succeeded", async () => {
    // Delayed payment methods (e.g. bank debits) complete here.
  });
  payments.webhooks.on("checkout.session.async_payment_failed", async () => {
    // Notify the customer that their delayed payment failed.
  });
  payments.webhooks.on("payment_intent.succeeded", async () => {});
  payments.webhooks.on("payment_intent.payment_failed", async () => {});

  return {
    ok: true,
    payments,
    checkoutHandler: createCheckoutHandler(payments, { rateLimit: demoRateLimit }),
    webhookHandler: createWebhookHandler(payments),
  };
}

let cached: ReadyPayments | UnavailablePayments | null = null;

/**
 * Returns the configured payment client, or why the real Stripe test is
 * unavailable. "Unavailable" is a normal state: the docs work without it.
 */
export function getPayments(): ReadyPayments | UnavailablePayments {
  if (cached) return cached;

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    cached = { ok: false, reason: "STRIPE_SECRET_KEY is not set (optional; only needed for the real Stripe test)." };
    console.info("[payments] Real Stripe test disabled: no STRIPE_SECRET_KEY. The documentation site works without it.");
    return cached;
  }

  try {
    cached = createPayments();
  } catch (error) {
    if (!isPaymentError(error)) throw error;
    cached = { ok: false, reason: error.message };
    console.warn(`[payments] Real Stripe test disabled: ${error.message}`);
  }
  return cached;
}

export interface StripeTestStatus {
  /** Real Checkout sessions can be created. */
  checkout: boolean;
  /** Real webhooks can be verified (a valid STRIPE_WEBHOOK_SECRET is set). */
  webhooks: boolean;
  /** Why checkout is unavailable (safe to display; contains no secrets). */
  reason: string | null;
}

/** Feature detection for the optional real Stripe test. Only booleans and a safe reason leave the server. */
export function getStripeTestStatus(): StripeTestStatus {
  const result = getPayments();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  const webhooks = result.ok && /^whsec_[0-9A-Za-z+/=_-]{16,}$/.test(webhookSecret) && !/dummy|placeholder/i.test(webhookSecret);
  return { checkout: result.ok, webhooks, reason: result.ok ? null : result.reason };
}
