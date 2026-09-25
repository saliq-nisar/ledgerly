import { Pipeline, type PipelineGroup } from "@/components/docs/Pipeline";
import { Container } from "@/components/ui/layout";

/**
 * Mirrors the actual order of operations in packages/payments/src/checkout/checkout.ts
 * and packages/payments/src/webhook/webhooks.ts.
 */
const GROUPS: readonly PipelineGroup[] = [
  { title: "Browser", caption: "POST { productId, quantity }", tone: "app", next: "only two fields leave the browser" },
  {
    title: "Your API route",
    caption: "createCheckoutHandler(payments)",
    tone: "app",
    steps: [
      { label: "HTTP checks", detail: "POST only, same-origin, your rate limit, JSON, 1 KiB body cap" },
      { label: "Parse request", detail: "Only productId and quantity are accepted", code: "payments.checkout.parse(body)" },
    ],
    next: "payments.checkout.create()",
  },
  {
    title: "@ledgerly/payments",
    caption: "server-side, before Stripe is called",
    tone: "lib",
    steps: [
      { label: "Reject unknown fields", detail: "amount, price, currency, Stripe params → unexpected_field" },
      { label: "Resolve product", detail: "Must exist in your catalog and be active" },
      { label: "Validate quantity", detail: "Whole number within the product's min/max" },
      { label: "Resolve price", detail: "Catalog price × quantity, integer cents, overflow-checked" },
      { label: "Validate metadata", detail: "Allowed keys, size limits, no card data or secrets" },
      { label: "Apply checkout configuration", detail: "client-wide → product → per-call options" },
      { label: "Validate redirects", detail: "appUrl or allow-listed origins only" },
      { label: "beforeCheckout callback", detail: "Your veto point (inventory, eligibility)" },
      { label: "Create Stripe session", detail: "Explicit parameters, idempotent retries", code: "checkout.sessions.create" },
    ],
    next: "{ id, url } → customer redirected",
  },
  { title: "Stripe", caption: "Hosted Checkout · card processing · signed event", tone: "stripe", next: "POST /api/webhook (Stripe-Signature)" },
  {
    title: "@ledgerly/payments — webhook",
    caption: "createWebhookHandler(payments)",
    tone: "lib",
    steps: [
      { label: "Verify signature", detail: "HMAC over the exact raw body + 5-minute replay window" },
      { label: "Process event", detail: "Parsed only after verification; onWebhookReceived fires" },
      { label: "Storage", detail: "Duplicate deliveries are skipped (claim / hasProcessedEvent)" },
      { label: "Callbacks", detail: "Your on() handlers, then onPaymentSucceeded & friends" },
      { label: "Monitoring", detail: "onWebhookProcessed with outcome and duration (redacted)" },
    ],
    next: "verified, typed event",
  },
  { title: "Your application", caption: "Fulfil the order, send the email, grant access", tone: "success" },
];

export function UnderTheHood() {
  return (
    <div className="border-t border-slate-200 py-16 sm:py-24 dark:border-slate-800">
      <Container>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="lg:sticky lg:top-36 lg:self-start">
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Under the hood</p>
            <h3 id="under-the-hood" className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Every check, in the order the library runs it
            </h3>
            <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-400">
              This is the real sequence inside <code className="font-mono text-sm">checkout.create()</code> and{" "}
              <code className="font-mono text-sm">webhooks.handle()</code>. Any failed step stops the flow with a typed
              error before Stripe is called (or before your handlers run).
            </p>
          </div>
          <Pipeline groups={GROUPS} summary="Checkout and webhook processing steps inside @ledgerly/payments." />
        </div>
      </Container>
    </div>
  );
}
