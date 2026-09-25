/**
 * @ledgerly/payments — public API.
 *
 * Everything exported here is covered by semantic versioning. Modules not
 * re-exported from this file (or from "@ledgerly/payments/web") are internal.
 */

import { createPaymentClientInternal, type PaymentClient } from "./client/create-client.js";
import type { PaymentClientConfig, ProductCatalog } from "./types/public.js";

/**
 * Creates a server-side payment client. Configuration is validated
 * immediately; invalid keys, URLs or products throw PaymentConfigurationError.
 *
 * @example
 * const payments = createPaymentClient({
 *   products: { pro: { name: "Pro", price: 2999, currency: "usd" } },
 * });
 * const { url } = await payments.checkout.create({ productId: "pro" });
 */
export function createPaymentClient<const P extends ProductCatalog, const M extends string = string>(
  config: PaymentClientConfig<P, M>,
): PaymentClient<P, M> {
  return createPaymentClientInternal(config);
}

/** Identity helper that preserves literal product IDs when the catalog is declared separately. */
export function defineProducts<const P extends ProductCatalog>(products: P): P {
  return products;
}

export { createMemoryEventStore } from "./webhook/memory-store.js";

export {
  isPaymentError,
  PaymentErrorCodes,
  rejectCheckout,
  PaymentAuthenticationError,
  PaymentConfigurationError,
  PaymentError,
  PaymentNetworkError,
  PaymentNotFoundError,
  PaymentProviderError,
  PaymentRateLimitError,
  PaymentValidationError,
  PaymentWebhookError,
} from "./errors/errors.js";
export type { PaymentErrorCause, PaymentErrorCode } from "./errors/errors.js";

export type { PaymentClient } from "./client/create-client.js";
export type { ProductsApi } from "./products/products.js";
export type { CheckoutApi } from "./checkout/checkout.js";
export type { WebhooksApi } from "./webhook/webhooks.js";
export type { LogFields, LogValue } from "./security/redact.js";
export type * from "./types/public.js";
