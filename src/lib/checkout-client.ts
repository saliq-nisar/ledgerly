import type { ApiErrorResponse, CreateCheckoutSessionRequest, CreateCheckoutSessionSuccess } from "@/types/payment";

/**
 * Browser-side call to this app's checkout endpoint. Sends only
 * { productId, quantity } and returns the Stripe Checkout URL. Contains no
 * secrets and no payment library code (the library is server-only).
 */

/** API error codes plus client-side transport failures. */
export type ClientErrorCode = string;

export class CheckoutRequestError extends Error {
  constructor(
    public readonly code: ClientErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CheckoutRequestError";
  }
}

export interface CheckoutError {
  code: ClientErrorCode;
  message: string;
}

const REQUEST_TIMEOUT_MS = 20_000;

function isApiError(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiErrorResponse).error?.message === "string"
  );
}

function isSessionSuccess(value: unknown): value is CreateCheckoutSessionSuccess {
  if (typeof value !== "object" || value === null || !("url" in value) || typeof value.url !== "string") return false;
  // Defence in depth: only ever navigate to an https URL (never javascript:, data:, http:).
  try {
    return new URL(value.url).protocol === "https:";
  } catch {
    return false;
  }
}

export async function requestCheckoutSession(payload: CreateCheckoutSessionRequest): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    throw timedOut
      ? new CheckoutRequestError("timeout", "The request took too long. Please check your connection and try again.")
      : new CheckoutRequestError("network_error", "We couldn't reach the server. Please check your connection and try again.");
  } finally {
    window.clearTimeout(timeout);
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw isApiError(data)
      ? new CheckoutRequestError(data.error.code, data.error.message)
      : new CheckoutRequestError("internal_error", "Something went wrong. Please try again.");
  }
  if (!isSessionSuccess(data)) {
    throw new CheckoutRequestError("internal_error", "Unexpected response from the server.");
  }
  return data.url;
}

export function toCheckoutError(error: unknown): CheckoutError {
  if (error instanceof CheckoutRequestError) {
    return { code: error.code, message: error.message };
  }
  return { code: "internal_error", message: "Something went wrong. Please try again." };
}
