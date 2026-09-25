/**
 * Demo UI types. Safe to import from both Server and Client Components —
 * nothing here touches secrets or the payment library.
 */

export type ProductId = "starter" | "pro" | "business";

export interface Product {
  id: ProductId;
  name: string;
  tagline: string;
  description: string;
  /** Price per unit in the smallest currency unit (cents). */
  price: number;
  currency: "usd";
  features: readonly string[];
  highlighted: boolean;
}

/** UI lifecycle of a payment attempt. */
export type PaymentState = "idle" | "loading" | "processing" | "success" | "error" | "cancelled";

/** Body accepted by POST /api/stripe/create-checkout-session. Note: no amount field. */
export interface CreateCheckoutSessionRequest {
  productId: ProductId;
  quantity: number;
}

export interface CreateCheckoutSessionSuccess {
  id: string;
  url: string;
}

/** Error body returned by the API routes (library codes plus the demo's `stripe_not_configured`). */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export interface OrderTotals {
  unitPrice: number;
  quantity: number;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
}

/** Normalised view of a payment for the result pages. */
export interface PaymentSummaryData {
  status: "paid" | "processing" | "unpaid" | "expired";
  /** True when the data is illustrative and did not come from Stripe. */
  isDemo: boolean;
  productName: string;
  quantity: number;
  amountTotal: number;
  currency: string;
  checkoutSessionId: string;
  paymentIntentId: string | null;
  customerEmail: string | null;
  createdAt: Date;
}
