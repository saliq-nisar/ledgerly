# Changelog

All notable changes to this package are documented here. The project follows [Semantic Versioning](https://semver.org).

## 0.2.0 — unreleased

This release adds customization. Every addition is optional, and existing integrations keep working without changes.

### Added

- **Checkout options**, set client-wide (`checkout`), per product (`products.x.checkout`) or per call (`options`), with option-by-option inheritance:
  - `allowPromotionCodes`
  - `collectBillingAddress`
  - `collectShippingAddress`
  - `collectPhoneNumber`
  - `automaticTax`
  - `submitType`
  - `locale`
  - `createInvoice`
  - `customerCreation`
  - `consentCollection`
  - `customText`
  - `customFields`
  - `expiresInMinutes`
  - `mode`

  Every option is validated and mapped explicitly. Unknown options are rejected. `automaticTax`, `createInvoice` and `mode` can't be set per call.
- **Product fields:**
  - `images`
  - `active` (inactive products return `product_unavailable`)
  - `taxBehavior`
  - `taxCode`
  - `metadata`
  - `checkout`
  - `stripePriceId`, which is verified against the catalog price and currency before use

  Also added: `products.list({ activeOnly })`.
- **Metadata policy:** `metadata: { allowedKeys, maxKeys, maxValueLength }`. `allowedKeys` also narrows the TypeScript type.
- **Customer:** `customer: { email } | { id }`. `customerEmail` remains as an alias.
- **Redirects:**
  - top-level `urls`, as an alias of `checkout.successPath` and `checkout.cancelPath`
  - per-call `redirect`
  - `security.allowedRedirectOrigins`
- **Callbacks:**
  - `beforeCheckout`
  - `afterCheckout`
  - `onPaymentSucceeded`
  - `onPaymentFailed`
  - `onPaymentAttemptFailed`
  - `onCheckoutExpired`

  Also added: `rejectCheckout(message)`.
- **Storage:** top-level `storage` accepts either the atomic `WebhookEventStore` (`claim`/`release`) or the simpler `ProcessedEventStorage` (`hasProcessedEvent`/`markEventProcessed`). Storage failures return `webhook_storage_failed` (500).
- **Logging:** `logging: { logger, level }`.
- **Monitoring:**
  - `monitoring` hooks: `onCheckoutCreated`, `onWebhookReceived`, `onWebhookProcessed`
  - the existing `onRequest` and `onError`
- **Errors:**
  - `PaymentErrorCodes` constants
  - `errors.publicMessages` overrides
  - `payments.errors.describe(error)`
  - web handler `messages`
- **Web adapter:** `enrich` may now return `customer`, `options` and `redirect`.
- **New error codes:**
  - `product_unavailable`
  - `invalid_customer`
  - `invalid_checkout_options`
  - `invalid_redirect`
  - `checkout_rejected`
  - `webhook_storage_failed`

### Changed

- A success path without `{CHECKOUT_SESSION_ID}` now gets `session_id={CHECKOUT_SESSION_ID}` appended. Previously this was a configuration error.
- Unknown configuration keys, and unknown `checkout.create` input fields, now throw instead of being ignored.
- Metadata entries whose value is `undefined` are skipped. Previously they were rejected.
- `PaymentClient` and `CheckoutApi` take an optional second type parameter for metadata keys. It defaults to `string`, so `PaymentClient<P>` still compiles.

### Deprecated

- `hooks`: use `monitoring`.
- `onWebhook`: use `onWebhookProcessed`. Both still work.

## 0.1.0

Initial release.

- `createPaymentClient` with validated configuration: environments, key checks, URLs and products.
- `checkout.create`, `checkout.parse` and `checkout.retrieve`, with server-side pricing and idempotency.
- Webhook verification, typed handlers and pluggable deduplication.
- Typed errors, redacted logging and monitoring hooks.
- `@ledgerly/payments/web` handlers.
