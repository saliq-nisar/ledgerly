import Link from "next/link";

import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocSection } from "@/components/docs/DocSection";
import { LiveTestPayment } from "@/components/docs/LiveTestPayment";
import { buttonClasses } from "@/components/ui/button";
import { Check, X } from "@/components/ui/icons";
import { getProduct, PRODUCTS } from "@/config/products";
import { cn, formatCurrency } from "@/lib/utils";

/** Only booleans and a safe, secret-free reason are passed in from the server. */
export interface RealStripeStatus {
  checkout: boolean;
  webhooks: boolean;
  reason: string | null;
}

const SETUP = `# Optional: only needed for the real Stripe test
cp .env.example .env.local
# then set your Stripe TEST-MODE secret key in .env.local:
#   STRIPE_SECRET_KEY=sk_test_...
# and, to receive webhooks locally:
#   stripe listen --forward-to localhost:3000/api/stripe/webhook
#   STRIPE_WEBHOOK_SECRET=whsec_...
npm run dev`;

export function TestPaymentSection({ status }: { status: RealStripeStatus }) {
  const featured = getProduct("pro")!;
  return (
    <DocSection
      id="real-stripe-test"
      eyebrow="Optional · Real Stripe test"
      title={status.checkout ? "Try a real Stripe test payment" : "Real Stripe test (optional)"}
      description={
        status.checkout
          ? "Stripe test keys are configured on this server, so this runs the real flow: this demo's API route calls @ledgerly/payments, and you land on Stripe's actual hosted Checkout. Test mode never moves real money."
          : "Everything above works without credentials. To also create real test-mode Checkout Sessions, add your own Stripe test keys. Until then, real checkout is disabled; nothing on this page is broken."
      }
      tinted
    >
      <ul className="mb-8 flex flex-wrap gap-3" aria-label="Real Stripe test availability">
        <StatusPill ok={status.checkout} label="Real Checkout" />
        <StatusPill ok={status.webhooks} label="Real webhooks" />
        <StatusPill ok label="Documentation & simulations" />
      </ul>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
        <LiveTestPayment product={featured} stripeReady={status.checkout} />
        {status.checkout ? (
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Or choose any example plan</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">The checkout page adds quantity and an order summary, and uses the same API.</p>
            <ul className="mt-5 grid gap-3">
              {PRODUCTS.map((product) => (
                <li
                  key={product.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-900",
                    product.highlighted ? "border-indigo-400 dark:border-indigo-500/60" : "border-slate-200 dark:border-slate-800",
                  )}
                >
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {product.name} <span className="font-normal text-slate-500 dark:text-slate-400">· {formatCurrency(product.price, product.currency)}</span>
                  </p>
                  <Link href={`/checkout?product=${product.id}`} className={buttonClasses(product.highlighted ? "primary" : "secondary", "md", "shrink-0")}>
                    Choose {product.name}
                  </Link>
                </li>
              ))}
            </ul>
            {!status.webhooks && (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                Webhooks aren&apos;t configured (no valid STRIPE_WEBHOOK_SECRET), so payments work and the success page
                verifies them with Stripe, but webhook events aren&apos;t received.
              </p>
            )}
          </div>
        ) : (
          <div className="min-w-0 space-y-4">
            <CodeBlock code={SETUP} language="shell" filename="enable the real test (optional)" animate={false} source="Values stay server-side in .env.local, which is git-ignored" />
            {status.reason && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Why it&apos;s off: </span>
                {status.reason}
              </p>
            )}
          </div>
        )}
      </div>
    </DocSection>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
        ok
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
      )}
    >
      {ok ? <Check className="size-4" /> : <X className="size-4" />}
      {label}: {ok ? "available" : "unavailable"}
    </li>
  );
}
