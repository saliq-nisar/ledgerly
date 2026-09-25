import "server-only";

import { isPaymentError, PaymentNotFoundError, PaymentValidationError } from "@ledgerly/payments";

import { getPayments } from "@/lib/payments";
import type { PaymentSummaryData, Product } from "@/types/payment";

export type SummaryResult =
  | { ok: true; summary: PaymentSummaryData }
  | { ok: false; reason: "not_configured" | "not_found" | "unavailable" };

/**
 * Loads the payment for the success page straight from Stripe (via the
 * library). Query parameters other than the session ID are never trusted.
 */
export async function loadPaymentSummary(sessionId: string): Promise<SummaryResult> {
  const payments = getPayments();
  if (!payments.ok) return { ok: false, reason: "not_configured" };

  try {
    const session = await payments.payments.checkout.retrieve(sessionId);
    return {
      ok: true,
      summary: {
        status: session.status,
        isDemo: false,
        productName: session.product?.name ?? "Unknown product",
        quantity: session.quantity,
        amountTotal: session.amountTotal,
        currency: session.currency,
        checkoutSessionId: session.id,
        paymentIntentId: session.paymentIntentId,
        customerEmail: session.customerEmail,
        createdAt: session.createdAt,
      },
    };
  } catch (error) {
    if (error instanceof PaymentNotFoundError || error instanceof PaymentValidationError) {
      return { ok: false, reason: "not_found" };
    }
    if (isPaymentError(error)) return { ok: false, reason: "unavailable" };
    throw error;
  }
}

/** Clearly-labelled illustrative data for previewing the success page without Stripe. */
export function buildDemoSummary(product: Product): PaymentSummaryData {
  return {
    status: "paid",
    isDemo: true,
    productName: product.name,
    quantity: 1,
    amountTotal: product.price,
    currency: product.currency,
    checkoutSessionId: "DEMO — no Stripe session was created",
    paymentIntentId: null,
    customerEmail: null,
    createdAt: new Date(),
  };
}
