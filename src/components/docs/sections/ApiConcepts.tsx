import { DocSection } from "@/components/docs/DocSection";
import { PackageExplorer, type PackageModule } from "@/components/docs/PackageExplorer";

/** Mirrors packages/payments/src exactly (verified against the file tree). */
const MODULES: readonly PackageModule[] = [
  { name: "client", summary: "createPaymentClient", detail: "Validates the whole configuration at startup (keys vs environment, URLs, products, options, callbacks, storage, logging) and wires the other modules together. The Stripe SDK is created lazily on first use.", files: ["create-client.ts"] },
  { name: "checkout", summary: "checkout.create / parse / retrieve", detail: "Turns a validated request into an explicit Stripe Checkout Session. options.ts validates checkout options, merges client → product → call, and maps each one field by field to Stripe parameters.", files: ["checkout.ts", "options.ts"] },
  { name: "products", summary: "The trusted catalog", detail: "Validates every product (integer price, ISO currency, Stripe minimums, quantity limits, images, tax, stripePriceId) and serves lookups from a Map, so IDs like \"__proto__\" can never resolve.", files: ["products.ts"] },
  { name: "validation", summary: "Runtime input rules", detail: "Quantity, metadata policy, customer, idempotency key, client reference and request-body rules. It never trusts TypeScript types at runtime.", files: ["validation.ts"] },
  { name: "money", summary: "Integer money", detail: "Minor-unit arithmetic with overflow and Stripe maximum-amount checks, currency normalisation and minimum charge amounts. No floating point.", files: ["money.ts"] },
  { name: "security", summary: "Keys, redirects, redaction", detail: "Secret-key and environment checks, placeholder detection, the redirect-origin policy that prevents open redirects, and redaction of anything that reaches a logger or hook.", files: ["keys.ts", "urls.ts", "redact.ts"] },
  { name: "webhook", summary: "webhooks.constructEvent / on / handle", detail: "Signature and replay-window verification over the raw body, typed handlers, storage adapters for deduplication, and the mapping from Stripe events to onPaymentSucceeded and the other callbacks.", files: ["webhooks.ts", "storage.ts", "outcomes.ts", "memory-store.ts"] },
  { name: "errors", summary: "Typed, normalized errors", detail: "PaymentError subclasses with stable codes (PaymentErrorCodes), safe public messages and sanitized causes. normalize.ts maps every Stripe SDK error onto them.", files: ["errors.ts", "normalize.ts"] },
  { name: "observability", summary: "Logging & monitoring", detail: "Level-filtered logging and fire-and-forget monitoring hooks. Failures inside your logger or hooks can never break a payment.", files: ["observability.ts"] },
  { name: "adapters", summary: "@ledgerly/payments/web", detail: "createCheckoutHandler and createWebhookHandler: standard Request → Response handlers with method, origin, content-type, body-size and rate-limit checks.", files: ["web.ts"] },
  { name: "types", summary: "Public TypeScript types", detail: "Configuration, products, checkout options, callbacks, storage, hooks and event types. Literal unions come from Stripe's own definitions.", files: ["public.ts"] },
];

const API = [
  { name: "createPaymentClient(config)", from: "@ledgerly/payments", does: "Creates the validated, server-only client" },
  { name: "defineProducts(products)", from: "@ledgerly/payments", does: "Declares the catalog with literal product IDs" },
  { name: "payments.checkout.create(input)", from: "client", does: "Creates a Checkout Session → { id, url, expiresAt, requestId }" },
  { name: "payments.checkout.parse(body)", from: "client", does: "Validates an untrusted body: only productId and quantity" },
  { name: "payments.checkout.retrieve(sessionId)", from: "client", does: "Trusted session status for success pages" },
  { name: "payments.webhooks.on(type, handler)", from: "client", does: "Typed handler for one Stripe event type" },
  { name: "payments.webhooks.handle(raw, signature)", from: "client", does: "Verify, dedupe, dispatch → { outcome }" },
  { name: "payments.webhooks.constructEvent(raw, signature)", from: "client", does: "Signature verification only" },
  { name: "payments.products.get / has / list", from: "client", does: "Catalog lookups, safe with any input" },
  { name: "payments.errors.describe(error)", from: "client", does: "{ code, message, statusCode, retryable } for any thrown value" },
  { name: "createCheckoutHandler(payments, options?)", from: "@ledgerly/payments/web", does: "POST handler for checkout" },
  { name: "createWebhookHandler(payments, options?)", from: "@ledgerly/payments/web", does: "POST handler for Stripe webhooks" },
  { name: "PaymentErrorCodes · isPaymentError · rejectCheckout", from: "@ledgerly/payments", does: "Error constants, type guard, and a way to refuse a purchase" },
  { name: "createMemoryEventStore()", from: "@ledgerly/payments", does: "In-memory dedupe store for development/tests only" },
];

export function ApiConceptsSection() {
  return (
    <DocSection
      id="api"
      eyebrow="API concepts"
      title="A small public API over a carefully layered package"
      description="Everything exported from @ledgerly/payments and @ledgerly/payments/web is covered by semantic versioning. Everything else is internal."
    >
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">Public API of @ledgerly/payments v0.2.0</caption>
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th scope="col" className="px-5 py-3 font-medium">API</th>
              <th scope="col" className="px-5 py-3 font-medium">From</th>
              <th scope="col" className="px-5 py-3 font-medium">What it does</th>
            </tr>
          </thead>
          <tbody>
            {API.map((row) => (
              <tr key={row.name} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                <th scope="row" className="px-5 py-2.5 font-mono text-xs font-semibold text-slate-900 dark:text-white">{row.name}</th>
                <td className="px-5 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{row.from}</td>
                <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300">{row.does}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-16 text-xl font-semibold text-slate-900 dark:text-white">Package structure</h3>
      <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">The real modules inside the package. Select one to see what it&apos;s responsible for.</p>
      <div className="mt-6">
        <PackageExplorer modules={MODULES} />
      </div>
    </DocSection>
  );
}
