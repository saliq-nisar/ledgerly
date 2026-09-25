import { getPayments } from "@/lib/payments";
import type { ApiErrorResponse } from "@/types/payment";

/**
 * POST { productId, quantity } → { id, url }
 *
 * All validation, pricing, Stripe calls, body limits, origin checks and error
 * mapping happen in the library's checkout handler.
 */
export async function POST(request: Request) {
  const payments = getPayments();
  if (!payments.ok) {
    return Response.json(
      {
        error: {
          code: "stripe_not_configured",
          message: "Real Stripe testing is not configured on this server. The documentation and simulations work without it.",
        },
      } satisfies ApiErrorResponse,
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return payments.checkoutHandler(request);
}
