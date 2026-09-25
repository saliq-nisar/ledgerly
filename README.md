# Ledgerly: Stripe payments library and reference app

This repository contains two things:

| Path | What it is |
| --- | --- |
| [`packages/payments`](packages/payments) | **`@ledgerly/payments`**: a reusable, framework-independent Stripe Checkout and webhooks library for Node.js servers. It is typed, tested, and publishable to npm. **[Library docs →](packages/payments/README.md)** |
| `src/` | **Documentation site + reference app** (Next.js 16): interactive docs, architecture simulations, playgrounds, framework examples, and an **optional** real Stripe test (checkout, success and cancel pages, signed webhook endpoint). |

```text
Next.js app (UI, routes)  ──►  @ledgerly/payments  ──►  stripe SDK  ──►  Stripe
```

> **No environment variables required.** `npm install && npm run dev` gives you the complete documentation site, including every diagram, playground and simulation. Stripe credentials are **optional** and only enable the real Stripe test. Simulations are always labelled as simulations and never claim a real payment. When keys are set, the default `test` environment only accepts `sk_test_` keys; live keys need `PAYMENTS_ENVIRONMENT=production`.

---

## The demo website is the documentation

Opening `http://localhost:3000` shows interactive documentation for the library. It covers the architecture, installation, a quick start, customization (including a live configuration playground), security (including a real tampered request sent to the API), webhooks, framework examples, the package structure, and a real test payment.

**Code on the site can't drift from the library.** Every code sample is extracted from the type-checked files in `packages/payments/examples/` using `// #region name` markers:

- `scripts/extract-snippets.mjs` generates `src/content/snippets.generated.ts`. It runs automatically before `dev`, `build` and `typecheck`, and you can run it yourself with `npm run snippets`.
- The examples are compiled by the library's `typecheck` and `test` scripts, so a sample that stops compiling fails the build.

## 1. Project overview

| Route | Purpose |
| --- | --- |
| `/` | Landing page: hero, features, animated **How It Works**, pricing, security, FAQ |
| `/checkout?product=<id>` | Order summary, quantity and totals, plus the Pay button that starts Stripe Checkout |
| `/payment/success?session_id=…` | Fetches the session from Stripe through the library and shows a verified receipt |
| `/payment/success?demo=1` | Preview filled with data clearly labelled **demo data** (no Stripe call) |
| `/payment/cancelled?product=<id>` | Cancelled state with *Try again* and *Return home* |
| `POST /api/stripe/create-checkout-session` | `createCheckoutHandler` from the library |
| `POST /api/stripe/webhook` | `createWebhookHandler` from the library |

## 2. Tech stack

- **Library:** TypeScript (strict, ESM), with one runtime dependency: the official `stripe` SDK. Tests use Node's built-in `node:test`.
- **App:** Next.js 16 (App Router), React 19, Tailwind CSS v4, `server-only`.
- **Tooling:** npm workspaces. Node.js **≥ 20.19**.

## 3. Installation

```bash
npm install    # installs the app and links the workspace package
npm run dev    # http://localhost:3000, no configuration needed
```

Optional, only for the real Stripe test: `cp .env.example .env.local` and fill in your test-mode keys (§5).

## 4. Environment variables (all optional)

Without any of these, the site builds and runs normally: every docs page, diagram and simulation works, and the real Stripe test shows **"Real Stripe test unavailable"**. No server errors are thrown and the Stripe client is never created.

| Variable | Enables | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Real test Checkout | `sk_test_…`. Server only. Never use a `NEXT_PUBLIC_` prefix for secrets. |
| `STRIPE_WEBHOOK_SECRET` | Real webhooks | `whsec_…` from `stripe listen`. Without it, real checkout still works; the webhook route answers 503. |
| `APP_URL` | Redirect origin | Defaults to `http://localhost:3000`. Must be https in production. |
| `PAYMENTS_ENVIRONMENT` | — | `test` (default) or `production`. Never inferred from the key. |

Feature detection lives in `src/lib/payments.ts` (`getStripeTestStatus()`). Only booleans and a secret-free reason reach the page.

## 5. Optional: enable the real Stripe test

1. In the Stripe Dashboard, switch to **Test mode** and open **Developers → API keys**.
2. Run `cp .env.example .env.local` and put the keys in **`.env.local`**, which is git-ignored. Never put them in `.env.example` or source code.
3. For webhooks, run `stripe listen` (see §8) and copy the printed `whsec_…` value.
4. Restart the app.

## 6. Running the application

```bash
npm run dev          # builds the library, then starts http://localhost:3000
npm run build        # builds the library, then runs next build
npm run start
npm run lint
npm run typecheck    # app + library
npm test             # library test suite
npm run test:bundle  # after build: scans client bundles for secrets / server code
```

## 7. Testing payments

1. Open `/#pricing`, choose a plan, set a quantity and click **Pay**.
2. On Stripe Checkout, pay with **`4242 4242 4242 4242`**, any future expiry date and any CVC.
3. You land on `/payment/success`. The page fetches the session from Stripe on the server and shows "Verified with Stripe".
4. Use Stripe's back link instead to land on `/payment/cancelled`.

Other test cards: `4000 0000 0000 0002` (declined) and `4000 0025 0000 3155` (3D Secure). More at <https://docs.stripe.com/testing>.

## 8. Webhook setup

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook   # prints whsec_… → STRIPE_WEBHOOK_SECRET
stripe trigger checkout.session.completed
```

Handlers are registered in [`src/lib/payments.ts`](src/lib/payments.ts). Deduplication uses the library's **in-memory** store in this demo. That is fine for one process, but production needs a database-backed `WebhookEventStore` (see the library docs).

For deployed apps, add an HTTPS endpoint in the Dashboard and subscribe to these events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

## 9. Architecture

```text
packages/payments/src/          ← reusable library (no React / Next.js / UI imports)
  client/        createPaymentClient: config validation, lazy Stripe SDK
  checkout/      create / parse / retrieve
  webhook/       constructEvent / on / handle, memory event store
  products/      catalog validation and lookup
  validation/    quantity, metadata, idempotency key, request-body rules
  security/      key checks, redirect URL rules, redaction
  money/         integer minor-unit arithmetic, currency rules
  errors/        typed error hierarchy + Stripe error normalisation
  observability/ redacted logging and monitoring hooks
  adapters/web   Fetch-API handlers (the "/web" subpath)
  browser.ts     thrown when the package is imported under the "browser" condition

src/                            ← reference app
  config/products.ts            one catalog object for the UI and the library
  lib/payments.ts               server-only: the app's single integration point
  lib/payment-summary.ts        maps library results to receipt UI data
  lib/rate-limit.ts             DEMO-ONLY in-memory rate limiter
  lib/pricing.ts                display-only totals for the checkout UI
  app/api/stripe/*/route.ts     two short route files that delegate to library handlers
  proxy.ts                      per-request nonce CSP
```

Stripe is isolated entirely inside the library. The app never imports `stripe` and never sees the secret key. The checkout page passes Client Components only a `stripeReady` boolean.

## 10. Payment flow

```text
Browser: POST { productId, quantity }          ← no amount, price, currency or URLs
  └► createCheckoutHandler: method, origin, rate limit, content-type, 1 KiB limit, JSON, allowed fields
      └► checkout.create: product lookup, quantity rules, integer total, trusted redirect URLs
          └► Stripe Checkout Session (SDK retries reuse one idempotency key) → { id, url }
Browser → checkout.stripe.com (card entry; card data never touches this app)
  ├► success → /payment/success?session_id=…  → checkout.retrieve (trusted data from Stripe)
  ├► cancel  → /payment/cancelled
  └► webhook → createWebhookHandler: raw body → signature + timestamp → dedupe → handlers
```

The success page is for the customer's benefit only. **Orders must be fulfilled from the webhook**, never because someone visited `/payment/success`.

## 11. Security considerations

**Library.** See the [library docs](packages/payments/README.md#security-model). Summary:

- Only the product ID and quantity come from the client. Unknown fields are rejected.
- Integer money arithmetic.
- Strict key and environment checks.
- Webhook signature, raw-body and replay-window verification.
- Same-origin redirect URLs only.
- Body size and content-type limits, and an Origin allowlist.
- Errors and logs are redacted.

**App.**

- `src/lib/payments.ts` imports `server-only`, and the library itself throws under the `browser` condition.
- `npm run test:bundle` scans the built client files for key patterns, secret environment variable names, the Stripe SDK and the library.
- `src/proxy.ts` sets a per-request **nonce CSP**: `script-src 'nonce-…' 'strict-dynamic'`, `connect-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`. Stripe Checkout is a top-level navigation, which the CSP doesn't block.
- `next.config.ts` adds these headers, plus HSTS in production:
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `X-Frame-Options: DENY`
  - `Cross-Origin-Opener-Policy`
  - `Permissions-Policy`
- **CSRF:** the app has no cookies or sessions, so there is no ambient authority to abuse. The checkout endpoint also requires `application/json`, which forces a CORS preflight, and rejects foreign `Origin` headers. A CSRF token would add nothing here.
- **Rate limiting:** `src/lib/rate-limit.ts` is **demo-only**. It lives in process memory and trusts `X-Forwarded-For`. Replace it with platform or gateway rate limiting in production.

This is a reference implementation. It is not a claim that any deployment built from it is secure.

## 12. Production considerations

- `PAYMENTS_ENVIRONMENT=production` and live keys in a secrets manager. HTTPS everywhere.
- A durable `WebhookEventStore`, plus an orders table that is fulfilled idempotently from webhooks.
- Real rate limiting, authentication (if purchases belong to users) and monitoring through the library's `hooks`.
- Stripe Tax if required. The demo shows tax as "not applied".
- The full checklist is in the [library docs](packages/payments/README.md#production-checklist).

---

### Accessibility notes

- Semantic landmarks, a skip link, visible focus rings and labelled controls.
- `role="alert"` for errors, and polite status updates for payment progress.
- The How It Works animation:
  - starts only when it is scrolled into view
  - can be paused and stepped through
  - doesn't autoplay under `prefers-reduced-motion`
  - has a screen-reader text summary
