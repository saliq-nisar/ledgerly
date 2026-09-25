import Stripe from "stripe";

import {
  PaymentAuthenticationError,
  PaymentError,
  PaymentNetworkError,
  PaymentNotFoundError,
  PaymentProviderError,
  PaymentRateLimitError,
  PaymentValidationError,
  type PaymentErrorCause,
} from "./errors.js";

/**
 * Maps any error thrown while talking to Stripe onto the stable library error
 * hierarchy. Only non-sensitive diagnostic fields are carried over.
 */
export function normalizeStripeError(error: unknown): PaymentError {
  if (error instanceof PaymentError) return error;

  if (error instanceof Stripe.errors.StripeError) {
    const cause: PaymentErrorCause = {
      source: "stripe",
      type: error.type,
      ...(error.code ? { code: error.code } : {}),
      // Parameter *names* are safe and essential for debugging; values are never copied.
      ...(error.param && /^[A-Za-z0-9_[\]]{1,200}$/.test(error.param) ? { param: error.param } : {}),
      ...(error.statusCode ? { statusCode: error.statusCode } : {}),
      ...(error.requestId ? { stripeRequestId: error.requestId } : {}),
    };

    if (error instanceof Stripe.errors.StripeConnectionError) return new PaymentNetworkError(cause);
    if (
      error instanceof Stripe.errors.StripeAuthenticationError ||
      error instanceof Stripe.errors.StripePermissionError
    ) {
      return new PaymentAuthenticationError(cause);
    }
    if (error instanceof Stripe.errors.StripeRateLimitError) return new PaymentRateLimitError(cause);
    if (error instanceof Stripe.errors.StripeIdempotencyError) {
      return new PaymentValidationError({
        code: "idempotency_conflict",
        message:
          "This idempotency key was already used with different parameters. Use a new key for a new operation.",
        publicMessage: "This request conflicts with a previous one. Please refresh and try again.",
        statusCode: 409,
        cause,
      });
    }
    if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") {
      return new PaymentNotFoundError("The requested Stripe object does not exist.", cause);
    }
    if (error instanceof Stripe.errors.StripeAPIError) {
      return new PaymentProviderError("Stripe returned a server error.", { cause, retryable: true });
    }
    // Invalid requests from this library indicate a bug or an account setting
    // problem; retrying the same request won't help.
    return new PaymentProviderError(
      `Stripe rejected the request (${error.type}${error.code ? `: ${error.code}` : ""}${cause.param ? `; param: ${cause.param}` : ""}). ` +
        "Check the option in your configuration and any account settings it requires (see stripeRequestId in the Stripe Dashboard logs).", {
      cause,
      retryable: (error.statusCode ?? 0) >= 500,
    });
  }

  return new PaymentProviderError("Unexpected error while calling Stripe.", {
    cause: { source: "internal", type: error instanceof Error ? error.name : typeof error },
  });
}
