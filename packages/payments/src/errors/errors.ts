/**
 * Library error hierarchy. Every error thrown by the public API is a
 * `PaymentError` subclass with a stable `code`.
 *
 * - `message` is written for developers and never contains secrets.
 * - `publicMessage` is safe to show to end users / return from an API.
 * - `cause` (when present) is a sanitized summary, never the raw Stripe error,
 *   so logging an error object can't leak request payloads or headers.
 */

/**
 * Stable machine-readable error codes. Map these to your own UI copy rather
 * than displaying library messages. Also available as `PaymentErrorCodes.X`.
 */
export const PaymentErrorCodes = {
  // configuration
  CONFIGURATION_ERROR: "configuration_error",
  // validation
  INVALID_REQUEST: "invalid_request",
  INVALID_PRODUCT: "invalid_product",
  PRODUCT_UNAVAILABLE: "product_unavailable",
  INVALID_QUANTITY: "invalid_quantity",
  INVALID_METADATA: "invalid_metadata",
  INVALID_CUSTOMER: "invalid_customer",
  INVALID_CHECKOUT_OPTIONS: "invalid_checkout_options",
  INVALID_REDIRECT: "invalid_redirect",
  INVALID_SESSION_ID: "invalid_session_id",
  INVALID_IDEMPOTENCY_KEY: "invalid_idempotency_key",
  UNEXPECTED_FIELD: "unexpected_field",
  AMOUNT_TOO_LARGE: "amount_too_large",
  IDEMPOTENCY_CONFLICT: "idempotency_conflict",
  CHECKOUT_REJECTED: "checkout_rejected",
  // http adapter
  METHOD_NOT_ALLOWED: "method_not_allowed",
  UNSUPPORTED_MEDIA_TYPE: "unsupported_media_type",
  PAYLOAD_TOO_LARGE: "payload_too_large",
  FORBIDDEN_ORIGIN: "forbidden_origin",
  RATE_LIMITED: "rate_limited",
  // provider
  AUTHENTICATION_FAILED: "authentication_failed",
  NETWORK_ERROR: "network_error",
  NOT_FOUND: "not_found",
  PROVIDER_ERROR: "provider_error",
  // webhooks
  WEBHOOK_SIGNATURE_MISSING: "webhook_signature_missing",
  WEBHOOK_SIGNATURE_INVALID: "webhook_signature_invalid",
  WEBHOOK_PAYLOAD_INVALID: "webhook_payload_invalid",
  WEBHOOK_HANDLER_FAILED: "webhook_handler_failed",
  WEBHOOK_STORAGE_FAILED: "webhook_storage_failed",
} as const;

export type PaymentErrorCode = (typeof PaymentErrorCodes)[keyof typeof PaymentErrorCodes];

/** Sanitized description of an underlying failure. Contains no payloads. */
export interface PaymentErrorCause {
  readonly source: "stripe" | "network" | "handler" | "storage" | "internal";
  readonly type?: string;
  readonly code?: string;
  /** Name of the Stripe parameter that was rejected (never its value). */
  readonly param?: string;
  readonly statusCode?: number;
  readonly stripeRequestId?: string;
}

export interface PaymentErrorOptions {
  code: PaymentErrorCode;
  message: string;
  publicMessage?: string;
  statusCode?: number;
  retryable?: boolean;
  field?: string;
  cause?: PaymentErrorCause;
  requestId?: string;
  stripeRequestId?: string;
}

const DEFAULT_PUBLIC_MESSAGE = "Something went wrong while processing the payment. Please try again.";

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  /** Message safe to show to end users. */
  readonly publicMessage: string;
  /** Suggested HTTP status for an API response. */
  readonly statusCode: number;
  /** True if repeating the same operation later may succeed. */
  readonly retryable: boolean;
  /** Input field that failed validation, if any. */
  readonly field: string | undefined;
  readonly requestId: string | undefined;
  readonly stripeRequestId: string | undefined;
  declare readonly cause: PaymentErrorCause | undefined;

  constructor(options: PaymentErrorOptions) {
    super(options.message, options.cause ? { cause: options.cause } : undefined);
    // Explicit names: `new.target.name` is mangled by minifying bundlers.
    this.name = "PaymentError";
    this.code = options.code;
    this.publicMessage = options.publicMessage ?? DEFAULT_PUBLIC_MESSAGE;
    this.statusCode = options.statusCode ?? 500;
    this.retryable = options.retryable ?? false;
    this.field = options.field;
    this.requestId = options.requestId;
    this.stripeRequestId = options.stripeRequestId ?? options.cause?.stripeRequestId;
  }

  /** Returns a copy of this error annotated with a correlation ID. */
  withRequestId(requestId: string): this {
    if (this.requestId) return this;
    Object.defineProperty(this, "requestId", { value: requestId });
    return this;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      retryable: this.retryable,
      field: this.field,
      requestId: this.requestId,
      stripeRequestId: this.stripeRequestId,
    };
  }
}

/** Invalid or unsafe library configuration (keys, URLs, products). Fix the code/env. */
export class PaymentConfigurationError extends PaymentError {
  constructor(message: string) {
    super({
      code: "configuration_error",
      message: `Stripe configuration error: ${message}`,
      publicMessage: "Payments are temporarily unavailable.",
      statusCode: 500,
    });
    this.name = "PaymentConfigurationError";
  }
}

/** Input rejected before reaching Stripe (or rejected by Stripe as a conflict). */
export class PaymentValidationError extends PaymentError {
  constructor(options: Omit<PaymentErrorOptions, "statusCode" | "retryable"> & { statusCode?: number }) {
    super({
      ...options,
      publicMessage: options.publicMessage ?? options.message,
      statusCode: options.statusCode ?? 400,
      retryable: false,
    });
    this.name = "PaymentValidationError";
  }
}

/** Stripe rejected the API key (invalid, revoked, or lacking permissions). */
export class PaymentAuthenticationError extends PaymentError {
  constructor(cause: PaymentErrorCause) {
    super({
      code: "authentication_failed",
      message: "Stripe rejected the API credentials. Check the secret key and its permissions.",
      publicMessage: "Payments are temporarily unavailable.",
      statusCode: 500,
      cause,
    });
    this.name = "PaymentAuthenticationError";
  }
}

export class PaymentRateLimitError extends PaymentError {
  constructor(cause?: PaymentErrorCause, message = "Too many requests were sent to Stripe.") {
    super({
      code: "rate_limited",
      message,
      publicMessage: "Too many requests. Please wait a moment and try again.",
      statusCode: 429,
      retryable: true,
      ...(cause ? { cause } : {}),
    });
    this.name = "PaymentRateLimitError";
  }
}

/** Could not reach Stripe (DNS, TLS, timeout, connection reset). */
export class PaymentNetworkError extends PaymentError {
  constructor(cause: PaymentErrorCause) {
    super({
      code: "network_error",
      message: "Could not reach Stripe (network error or timeout).",
      publicMessage: "We couldn't reach the payment provider. Please try again in a moment.",
      statusCode: 503,
      retryable: true,
      cause,
    });
    this.name = "PaymentNetworkError";
  }
}

export class PaymentNotFoundError extends PaymentError {
  constructor(message: string, cause?: PaymentErrorCause) {
    super({
      code: "not_found",
      message,
      publicMessage: "We couldn't find that payment.",
      statusCode: 404,
      ...(cause ? { cause } : {}),
    });
    this.name = "PaymentNotFoundError";
  }
}

/** Any other Stripe-side failure. `retryable` reflects whether Stripe suggests retrying. */
export class PaymentProviderError extends PaymentError {
  constructor(message: string, options: { cause?: PaymentErrorCause; retryable?: boolean } = {}) {
    super({
      code: "provider_error",
      message,
      publicMessage: "We couldn't reach the payment provider. Please try again in a moment.",
      statusCode: 502,
      retryable: options.retryable ?? false,
      ...(options.cause ? { cause: options.cause } : {}),
    });
    this.name = "PaymentProviderError";
  }
}

export class PaymentWebhookError extends PaymentError {
  constructor(
    code: Extract<
      PaymentErrorCode,
      | "webhook_signature_missing"
      | "webhook_signature_invalid"
      | "webhook_payload_invalid"
      | "webhook_handler_failed"
      | "webhook_storage_failed"
    >,
    message: string,
    cause?: PaymentErrorCause,
  ) {
    const handlerFailure = code === "webhook_handler_failed" || code === "webhook_storage_failed";
    super({
      code,
      message,
      publicMessage: handlerFailure ? "Webhook processing failed." : "Invalid webhook request.",
      // 5xx makes Stripe retry delivery; 4xx tells it the request itself is bad.
      statusCode: handlerFailure ? 500 : 400,
      retryable: handlerFailure,
      ...(cause ? { cause } : {}),
    });
    this.name = "PaymentWebhookError";
  }
}

export function isPaymentError(value: unknown): value is PaymentError {
  return value instanceof PaymentError;
}

/**
 * Throw from `callbacks.beforeCheckout` to refuse a purchase with a message
 * that is safe to show the customer (e.g. "This item is out of stock.").
 */
export function rejectCheckout(publicMessage: string, options: { statusCode?: 400 | 403 | 409 | 422 } = {}): PaymentValidationError {
  const message = typeof publicMessage === "string" && publicMessage.trim() ? publicMessage.trim().slice(0, 300) : "This purchase can't be completed.";
  return new PaymentValidationError({
    code: "checkout_rejected",
    message: `Checkout rejected by application: ${message}`,
    publicMessage: message,
    statusCode: options.statusCode ?? 422,
  });
}
