# @ledgerly/payments

Stripe Checkout and webhooks for Node.js servers.

**Simple by default. Powerful when needed. Secure by design.**

```ts
const payments = createPaymentClient({ products });
const { url } = await payments.checkout.create({ productId: "pro" });
```

Define your products and the library handles the rest. You never touch the Stripe SDK, price validation, signature verification or error mapping. As your needs grow, every part of Checkout, metadata, redirects, callbacks, storage, logging and monitoring can be configured. No option can move pricing, currency or redirect validation off the server.

> `@ledgerly/payments` is a placeholder package name. Rename it to your own npm scope before you publish.

**Contents**

1. [5-minute integration](#1-5-minute-integration)
2. [Requirements](#2-requirements)
3. [Products](#3-products)
4. [Checkout customization](#4-checkout-customization)
5. [Metadata](#5-metadata)
6. [Customer information](#6-customer-information)
7. [Redirects](#7-redirects)
8. [Callbacks](#8-callbacks)
9. [Webhooks and events](#9-webhooks-and-events)
10. [Storage](#10-storage)
11. [Logging](#11-logging)
12. [Monitoring](#12-monitoring)
13. [Error handling](#13-error-handling)
14. [Security boundaries](#14-security-boundaries)
15. [Advanced configuration reference](#15-advanced-configuration-reference)
16. [TypeScript](#16-typescript)
17. [Framework integration](#17-framework-integration)
18. [Production deployment](#18-production-deployment)

---

## 1. 5-minute integration

**1. Install.**

```bash
npm install @ledgerly/payments
```

**2. Add environment variables** (server only).

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_URL=https://shop.example.com
```

**3. Create the client** in a server-only module, for example `lib/payments.ts`:

```ts
import { createPaymentClient, defineProducts } from "@ledgerly/payments";

export const products = defineProducts({
  basic: { name: "Basic", price: 999, currency: "usd" },   // $9.99
  pro:   { name: "Pro",   price: 2999, currency: "usd" },  // $29.99
});

export const payments = createPaymentClient({ products });
```

**4. Add a checkout endpoint.** The browser POSTs `{ productId, quantity }` and gets back `{ id, url }`.

```ts
// app/api/checkout/route.ts (Next.js)
import { createCheckoutHandler } from "@ledgerly/payments/web";
import { payments } from "@/lib/payments";

export const POST = createCheckoutHandler(payments);
```

**5. Add a webhook endpoint.**

```ts
// app/api/webhook/route.ts
import { createWebhookHandler } from "@ledgerly/payments/web";
import { payments } from "@/lib/payments";

payments.webhooks.on("checkout.session.completed", async (event) => {
  // Fulfil the order. This event, not the success page, is the "paid" signal.
});

export const POST = createWebhookHandler(payments);
```

That's all. The success page receives `?session_id=…`; load the session with `payments.checkout.retrieve(sessionId)`.

Runnable, type-checked examples are in [`examples/`](examples):

- [minimal](examples/01-minimal.ts)
- [fully customized](examples/02-customized.ts)
- [frameworks](examples/03-frameworks.ts)

## 2. Requirements

- **Node.js ≥ 20.19**, or another server runtime with the Fetch API and Web Crypto. The package is server-only.
- **ESM package.** On Node ≥ 20.19 and ≥ 22.12, CommonJS code can still load it with `require()`.
- **One runtime dependency:** the official `stripe` SDK (`^22.6.2`). There is no React, no framework and no database driver. Your app never needs to install or import `stripe` itself.

## 3. Products

```ts
const products = defineProducts({
  pro: {
    name: "Professional",               // required
    price: 2999,                        // required, integer minor units (never 29.99)
    currency: "usd",                    // required, ISO 4217
    description: "For growing teams",
    images: ["https://cdn.example.com/pro.png"],   // up to 8, https only
    minQuantity: 1,
    maxQuantity: 50,
    active: true,                       // false = listed but not purchasable
    taxBehavior: "exclusive",           // "inclusive" | "exclusive" | "unspecified"
    taxCode: "txcd_10103001",
    metadata: { tier: "pro" },          // static, added to every session
    checkout: { allowPromotionCodes: true },  // product-level checkout options (§4)
  },
  enterprise: {
    name: "Enterprise",
    price: 99900,
    currency: "usd",
    stripePriceId: "price_1Abc…",       // use a Price created in the Dashboard
  },
});
```

- **`stripePriceId`:** before the first checkout, the library fetches the Price once per process and checks that it is active, one-time, and exactly equal to `price` and `currency`. If anything differs, checkout is refused with a configuration error. A price edited in the Dashboard can never silently charge a different amount than your code declares.
- **Inactive products** are rejected by both `parse` and `create` with `product_unavailable`. `payments.products.list({ activeOnly: true })` returns only purchasable products.
- **Extra fields are ignored.** You can add UI-only fields such as `tagline` and `features`, and keep a single catalog object for both your UI and your payments.
- **Subscriptions** are not supported yet. The catalog shape leaves room to add them later.

## 4. Checkout customization

Options are resolved in three levels. Each later level overrides the earlier one, option by option. `customText` and `consentCollection` merge key by key.

```text
client-wide  checkout: { … }            createPaymentClient
    ↓
per product  products.x.checkout: { … } defineProducts
    ↓
per call     options: { … }             payments.checkout.create
```

| Option | Stripe equivalent | Client | Product | Per call |
| --- | --- | :-: | :-: | :-: |
| `allowPromotionCodes` | `allow_promotion_codes` | ✓ | ✓ | ✓ |
| `collectBillingAddress` (`true` = required) | `billing_address_collection` | ✓ | ✓ | ✓ |
| `collectShippingAddress: { allowedCountries }` | `shipping_address_collection` | ✓ | ✓ | ✓ |
| `collectPhoneNumber` | `phone_number_collection` | ✓ | ✓ | ✓ |
| `submitType` (`pay` / `book` / `donate` / `auto`) | `submit_type` | ✓ | ✓ | ✓ |
| `locale` | `locale` | ✓ | ✓ | ✓ |
| `customerCreation` (`always` / `if_required`) | `customer_creation` | ✓ | ✓ | ✓ |
| `consentCollection: { termsOfService, promotions }` | `consent_collection` | ✓ | ✓ | ✓ |
| `customText: { submit, afterSubmit, shippingAddress, termsOfServiceAcceptance }` | `custom_text` | ✓ | ✓ | ✓ |
| `customFields` (≤ 3; text, numeric or dropdown) | `custom_fields` | ✓ | ✓ | ✓ |
| `expiresInMinutes` (30–1440) | `expires_at` | ✓ | ✓ | ✓ |
| `automaticTax` | `automatic_tax` | ✓ | ✓ | ✗ policy |
| `createInvoice` | `invoice_creation` | ✓ | ✓ | ✗ policy |
| `mode` (`"payment"` only) | `mode` | ✓ | ✓ | ✗ |

```ts
createPaymentClient({
  products,
  checkout: {
    allowPromotionCodes: true,
    collectBillingAddress: true,
    locale: "auto",
    customText: { submit: "Cancel any time." },
    customFields: [{ key: "company", label: "Company", type: "text", optional: true }],
  },
});

await payments.checkout.create({ productId: "pro", options: { locale: "fr" } });
```

**Guarantees for these options:**

- **Account prerequisites.** Some options need Stripe account setup. `automaticTax` needs Stripe Tax. `consentCollection.termsOfService` needs a Terms of Service URL in the Dashboard. `consentCollection.promotions` is only available in some countries. When a prerequisite is missing, Stripe rejects the request and the error names the rejected parameter (for example `param: consent_collection[promotions]`) plus the `stripeRequestId`. `false` values are omitted rather than sent, so disabling a feature never fails.
- Each option is validated and **mapped field by field**. Unknown options are rejected at every level, so typos never silently fail.
- Nothing is ever spread into the Stripe request. There is no `stripeOptions` escape hatch.
- Tax, invoicing and mode are business policy, so they can't vary per call.

## 5. Metadata

```ts
createPaymentClient({
  products,
  metadata: { allowedKeys: ["orderId", "userId"], maxKeys: 10, maxValueLength: 200 },
});

await payments.checkout.create({ productId: "pro", metadata: { orderId: "order_123", userId: "user_456" } });
```

- `allowedKeys` also narrows the TypeScript type. `metadata: { campaign: "x" }` becomes a compile error and is rejected at runtime.
- Session metadata is built from three sources: product `metadata`, then per-call `metadata`, then the library's reserved `productId` and `quantity`, which can't be overridden.
- Stripe uses the same metadata on the PaymentIntent.
- These are always rejected:
  - key names that look sensitive (`card`, `cvc`, `password`, `token`, `secret`, `ssn`, `iban`, `apiKey`, …)
  - values that look like card numbers or keys
  - control characters
  - non-string values
  - anything over the size limits

## 6. Customer information

```ts
await payments.checkout.create({
  productId: "pro",
  customer: { email: user.email },         // pre-fills the email field
  // customer: { id: "cus_…" },             // or reuse an existing Stripe Customer
  clientReferenceId: order.id,             // your reference, returned in webhooks
});
```

- Set only one of `email` and `id`; the other combinations are rejected.
- The older `customerEmail` field still works as an alias.
- `clientReferenceId` must come from **your server**, for example an order you just created. The web handler never takes it from the request body; use `enrich` (§17).

## 7. Redirects

```ts
createPaymentClient({
  products,
  urls: { success: "/orders/complete", cancel: "/pricing?cancelled={PRODUCT_ID}" },
  security: { allowedRedirectOrigins: ["https://account.example.com"] },  // optional
});

await payments.checkout.create({ productId: "pro", redirect: { success: "https://account.example.com/billing" } });
```

- If the success URL has no `{CHECKOUT_SESSION_ID}`, `session_id={CHECKOUT_SESSION_ID}` is appended automatically.
- `{PRODUCT_ID}` is URL-encoded.
- Targets must be either a same-origin path (`/…`) or an absolute URL whose origin is `appUrl` or listed in `security.allowedRedirectOrigins`. Allow-listed origins must use https in production.
- These are always rejected: `//evil.com`, `/\evil.com`, `javascript:`, `data:`, credentials in the URL, whitespace, and origins that aren't allow-listed.
- `checkout.successPath` and `checkout.cancelPath` still work as aliases of `urls`.

## 8. Callbacks

Callbacks are awaited and can affect the flow. Monitoring hooks (§12) cannot.

| Callback | When it runs | If it throws |
| --- | --- | --- |
| `beforeCheckout(ctx)` | After validation and pricing, **before Stripe**. | No session is created. `create()` throws `checkout_rejected`. Use `rejectCheckout("message")` to control the user-facing text and status. |
| `afterCheckout(ctx)` | **After Stripe** created the session, before `create()` resolves. | The error is logged and reported to `onError`, and the session is **still returned**. Failing here would invite a retry, which would create a duplicate session. |
| `onPaymentSucceeded(payment)` | **After webhook verification**, for `checkout.session.completed` with a paid status, or for `…async_payment_succeeded`. | The webhook responds 500, so Stripe retries. The callback must be idempotent. |
| `onPaymentFailed(payment)` | After verification: a delayed payment method failed (`…async_payment_failed`). | 500, Stripe retries |
| `onPaymentAttemptFailed(attempt)` | After verification: one attempt was declined (`payment_intent.payment_failed`). The customer may still retry. | 500, Stripe retries |
| `onCheckoutExpired(session)` | After verification: `checkout.session.expired` | 500, Stripe retries |

```ts
createPaymentClient({
  products,
  callbacks: {
    async beforeCheckout({ product, quantity }) {
      if (!(await inventory.available(product.id, quantity))) throw rejectCheckout("Sorry, that's sold out.");
    },
    async onPaymentSucceeded(payment) {
      await orders.markPaid(payment.clientReferenceId, payment.checkoutSessionId);
    },
  },
});
```

Payment callbacks receive a normalized, typed `PaymentOutcome`:

- `product`: your catalog entry
- `quantity`, `amountTotal`, `currency`
- `customerEmail`, `clientReferenceId`
- your metadata
- the event ID

You don't need to know Stripe's event shapes.

## 9. Webhooks and events

```ts
payments.webhooks.on("checkout.session.completed", async (event, { requestId }) => { … });
payments.webhooks.on("checkout.session.expired", async (event) => { … });
payments.webhooks.on("payment_intent.succeeded", async (event) => { … });
payments.webhooks.on("payment_intent.payment_failed", async (event) => { … });
```

Subscribe only to the events you need. Every Stripe event type is available and fully typed. Unhandled events are acknowledged as `ignored`.

`handle()` runs these steps in order:

1. It checks the raw body and the signature header.
2. It verifies the HMAC signature and the replay window (`webhooks.toleranceSeconds`, default 300).
3. It parses the event.
4. It emits `onWebhookReceived`.
5. It checks storage for duplicates.
6. It runs your `on()` handlers in registration order, then the matching callback.
7. It marks the event processed.
8. It emits `onWebhookProcessed`.

**The library handles:** the raw body, signature verification, replay window, parsing, deduplication (with storage) and error normalization.

**Your app handles:** business logic, fulfilment, database updates, emails and access provisioning.

Always pass the **raw** body, as a string or bytes, never parsed JSON. `createWebhookHandler` does this for you.

## 10. Storage

The library has no database of its own. You plug in persistence where it matters, which today means webhook deduplication. Both of these interfaces work:

```ts
// Preferred: an atomic claim (e.g. INSERT … ON CONFLICT DO NOTHING on event_id)
storage: {
  claim: async (eventId, eventType) => db.insertIgnore(eventId, eventType),  // → true if newly inserted
  release: async (eventId) => db.delete(eventId),                             // called if a handler fails
  complete: async (eventId) => db.markDone(eventId),                          // optional
}

// Simpler: check-then-mark (Redis, DynamoDB, …)
storage: {
  hasProcessedEvent: async (eventId) => redis.exists(`evt:${eventId}`) === 1,
  markEventProcessed: async (eventId) => { await redis.set(`evt:${eventId}`, "1", "EX", 604800); },
}
```

- With check-then-mark, the event is marked **only after** all handlers succeed. Two concurrent deliveries can both run, so prefer `claim` when you can.
- A storage failure returns `webhook_storage_failed` (HTTP 500), so Stripe retries.
- `createMemoryEventStore()` is for **development and tests only**.
- `webhooks.eventStore` still works as an alias of `storage`.

## 11. Logging

```ts
createPaymentClient({ products, logging: { logger: pino(), level: "info" } });
// or the original form: createPaymentClient({ products, logger: pino() })
```

- **Levels:** `debug`, `info` (the default), `warn`, `error` and `silent`.
- **Default logger:** JSON to the console in `test`; disabled in `production`.
- **Custom loggers are never trusted.** Every field is redacted before your logger sees it:
  - field names matching `secret|password|token|authorization|cookie|card|cvc|signature|api_key` are replaced with `[REDACTED]`
  - Stripe keys, webhook secrets, bearer tokens and card numbers are masked
  - request bodies, metadata values and raw Stripe payloads are never logged
- A logger that throws cannot break a payment.

## 12. Monitoring

```ts
createPaymentClient({
  products,
  monitoring: {
    onRequest: (info) => metrics.timing(`payments.${info.operation}`, info.durationMs),
    onError: (error, info) => Sentry.captureMessage(error.code, { extra: info }),
    onCheckoutCreated: (info) => analytics.track("checkout_created", info),
    onWebhookReceived: (info) => metrics.increment(`webhook.${info.eventType}`),
    onWebhookProcessed: (info) => metrics.increment(`webhook.${info.outcome}`),
  },
});
```

- Hooks work with any provider and are fire-and-forget. They are never awaited, and failures are contained.
- The payloads contain only IDs, amounts, statuses, durations and error codes.
- The older `hooks` option, including `onWebhook`, still works.

## 13. Error handling

Every error is a typed `PaymentError`. Each one has:

- `code`: stable
- `statusCode`: the suggested HTTP status
- `retryable`
- `publicMessage`: safe to show users
- `requestId` and `stripeRequestId`: for correlating logs

Codes are also available as constants, for example `PaymentErrorCodes.INVALID_PRODUCT` for `"invalid_product"`.

| Class | Codes |
| --- | --- |
| `PaymentConfigurationError` | `configuration_error` |
| `PaymentValidationError` | `invalid_request`, `invalid_product`, `product_unavailable`, `invalid_quantity`, `invalid_metadata`, `invalid_customer`, `invalid_checkout_options`, `invalid_redirect`, `invalid_session_id`, `invalid_idempotency_key`, `unexpected_field`, `amount_too_large`, `idempotency_conflict`, `checkout_rejected` |
| `PaymentAuthenticationError` | `authentication_failed` |
| `PaymentRateLimitError` | `rate_limited` |
| `PaymentNetworkError` | `network_error` |
| `PaymentNotFoundError` | `not_found` |
| `PaymentProviderError` | `provider_error` |
| `PaymentWebhookError` | `webhook_signature_missing`, `webhook_signature_invalid`, `webhook_payload_invalid`, `webhook_handler_failed`, `webhook_storage_failed` |

**Use your own copy.** There are three ways to replace the user-facing messages:

```ts
// 1. Client-wide overrides, used by payments.errors.describe() and the web handlers
createPaymentClient({ products, errors: { publicMessages: { invalid_quantity: "Pick 1–10 seats." } } });

// 2. Per web handler
createCheckoutHandler(payments, { messages: { rate_limited: "Slow down a little." } });

// 3. Map codes yourself
try {
  await payments.checkout.create(input);
} catch (error) {
  const { code, message, statusCode } = payments.errors.describe(error);  // safe for any thrown value
  return ui.showError(myCopy[code] ?? message);
}
```

`error.cause` is a sanitized summary and never the raw Stripe error.

## 14. Security boundaries

Every input falls into exactly one class:

| Class | What | Who may supply it |
| --- | --- | --- |
| **Client-safe** | `productId`, `quantity` | The browser. These are the only fields `checkout.parse` and `createCheckoutHandler` accept; anything else returns 400 `unexpected_field`. |
| **Server-only (per call)** | `customer`, `customerEmail`, `clientReferenceId`, `metadata`, `options`, `redirect`, `idempotencyKey`, `requestId` | Your server code, including `enrich` in the web handler. All of them are validated. None of them can change price, currency, quantity limits, redirect origins or metadata rules. |
| **Server-only (configuration)** | `secretKey`, `webhookSecret`, `environment`, `appUrl`, `products` (prices and currencies), client- and product-level `checkout`, `metadata` policy, `security`, `storage`, `callbacks`, `logging`, `monitoring`, `errors` | `createPaymentClient` only |
| **Internal-only** | The Stripe client, Stripe request parameters, reserved metadata keys (`productId`, `quantity`), idempotency on retries, signature verification, redaction | Nobody. These are not configurable and have no pass-through. |

**Invariants that no customization can break:**

- The amount charged is `catalog price × validated quantity`. A `stripePriceId` must match the catalog exactly.
- The currency always comes from the product.
- Redirects stay on `appUrl` or explicitly allow-listed origins.
- Metadata always passes the safety rules. Reserved keys can't be overridden.
- `checkout.create` rejects unknown input fields, so spreading a request body into it (`{ ...req.body }`) is refused rather than forwarded.
- Keys are checked against the environment: `test` requires `sk_test_` and `production` requires `sk_live_`.
- Webhooks are signature- and timestamp-verified before any handler, callback or storage call runs.
- Secrets never appear in errors, logs, hook payloads or HTTP responses.
- The package throws if it is loaded in a browser bundle (via the `browser` export condition).

**Still your responsibility:**

- rate limiting (see the `rateLimit` hook)
- authentication and authorization
- durable storage and fulfilment
- HTTPS
- secret management
- monitoring and alerting

## 15. Advanced configuration reference

```ts
createPaymentClient({
  products,                                   // required
  environment: "production",                  // default env PAYMENTS_ENVIRONMENT ?? "test"
  secretKey, webhookSecret,                   // default env STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
  appUrl: "https://shop.example.com",         // default env APP_URL
  urls: { success, cancel },                  // §7
  checkout: { ...options, quantity: { min: 1, max: 10 } },  // §4
  metadata: { allowedKeys, maxKeys, maxValueLength },         // §5
  security: { allowedRedirectOrigins },       // §7
  storage,                                    // §10
  callbacks: { beforeCheckout, afterCheckout, onPaymentSucceeded, onPaymentFailed, onPaymentAttemptFailed, onCheckoutExpired },
  webhooks: { toleranceSeconds: 300 },
  network: { maxRetries: 2, timeoutMs: 20_000 },
  logging: { logger, level },                 // §11
  monitoring: { onRequest, onError, onCheckoutCreated, onWebhookReceived, onWebhookProcessed },
  errors: { publicMessages },                 // §13
});
```

Every option is validated when you call `createPaymentClient`. Unknown keys at any level throw `PaymentConfigurationError`, and the message names the setting.

**Idempotency and retries**

- The Stripe SDK retries network errors, 409 and 5xx responses up to `network.maxRetries` times. Every retry reuses one idempotency key, so a retried request can't create a second session.
- Pass a per-attempt `idempotencyKey` so that your own retries are also safe.
- The library never derives a key from the product and quantity, so two legitimate purchases of the same item are never merged.

## 16. TypeScript

Everything is strictly typed. There is no `any` and no `Record<string, any>` in the public API:

- Product IDs are literal types.
- Metadata keys are limited to `allowedKeys`.
- Locales, countries, submit types and tax behavior are literal unions taken from Stripe's own definitions.
- Per-call `options` exclude the policy-only fields.
- Webhook handlers receive the exact event type.
- Callbacks receive typed contexts.

```ts
payments.checkout.create({ productId: "enterprize" });                     // ✗ unknown product
payments.checkout.create({ productId: "pro", options: { automaticTax: true } }); // ✗ policy-only
payments.checkout.create({ productId: "pro", options: { locale: "xx" } });  // ✗ not a Stripe locale
payments.checkout.create({ productId: "pro", amount: 1 });                  // ✗ no such field
```

The test suite compiles 11 assertions like these with `@ts-expect-error`, so a type regression fails the build.

## 17. Framework integration

`@ledgerly/payments/web` is built on the standard `Request`/`Response`, so it works directly in:

- Next.js route handlers
- Hono
- Remix / React Router
- SvelteKit
- Astro
- Bun and Deno
- Node 18+ fetch servers

For Express, use `payments.webhooks.handle(rawBody, signature)` with `express.raw()`; see [examples/03-frameworks.ts](examples/03-frameworks.ts).

```ts
createCheckoutHandler(payments, {
  rateLimit: (request) => limiter.check(request),         // your limiter
  allowedOrigins: ["https://shop.example.com"],           // default: appUrl
  enrich: async (request, { productId, quantity }) => {   // trusted server-side extras
    const user = await auth(request);
    return { customer: { email: user.email }, clientReferenceId: user.id, metadata: { userId: user.id } };
  },
  messages: { invalid_quantity: "Pick 1–10 seats." },
  maxBodyBytes: 1024,
  idempotencyHeader: "Idempotency-Key",
});
```

The checkout handler enforces, in order:

1. POST only
2. Origin allow-list
3. Your `rateLimit` hook
4. `application/json` content type
5. A streaming body limit
6. Strict JSON parsing
7. Only `productId` and `quantity` in the body

It then responds `{ id, url }` with `Cache-Control: no-store`.

The webhook handler responds as follows:

| Status | Meaning |
| --- | --- |
| 200 | processed, ignored or duplicate |
| 400 | bad signature or payload |
| 413 | body too large |
| 500 | handler or storage failure, or not configured, so Stripe retries |

**Frontend helpers** (for example a `<PaymentButton>` component) intentionally aren't part of this package, to keep it free of UI dependencies. A browser helper only needs to POST `{ productId, quantity }` and redirect to the returned `url`. If one is added, it will be a separate package such as `@ledgerly/payments-react` that contains no secret or Stripe logic.

## 18. Production deployment

- [ ] `PAYMENTS_ENVIRONMENT=production`, a live `sk_live_` key in a secrets manager, and `APP_URL` on https
- [ ] Webhook endpoint registered over HTTPS with its `whsec_` secret, subscribed to the events you handle
- [ ] Durable `storage` (atomic `claim` preferred), with fulfilment from `onPaymentSucceeded` or webhooks, never from the success page
- [ ] A per-attempt `idempotencyKey` from your UI
- [ ] Rate limiting in front of the checkout endpoint
- [ ] `logging` and `monitoring` wired up, with alerts on `webhook_handler_failed`, `webhook_storage_failed` and `authentication_failed`
- [ ] A Content Security Policy and security headers on your app
- [ ] Stripe Tax set up if you use `automaticTax`
- [ ] Terms of service URL set in the Dashboard if you use `consentCollection.termsOfService`

## Versioning

This package follows semantic versioning. The public API is exactly what `@ledgerly/payments` and `@ledgerly/payments/web` export; files under `dist/` are internal. See [CHANGELOG.md](CHANGELOG.md).
