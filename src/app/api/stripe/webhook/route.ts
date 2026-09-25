import { getPayments } from "@/lib/payments";

/**
 * Stripe webhook endpoint. The library handler reads the raw body, verifies
 * the Stripe-Signature header, deduplicates, and dispatches to the handlers
 * registered in src/lib/payments.ts.
 */
export async function POST(request: Request) {
  const payments = getPayments();
  if (!payments.ok) {
    // The real Stripe test is optional. 503 = not configured on this server (Stripe retries later).
    return Response.json(
      { error: { code: "stripe_test_unavailable", message: "Real Stripe testing is not configured on this server." } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return payments.webhookHandler(request);
}
