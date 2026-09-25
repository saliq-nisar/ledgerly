"use client";

import { useEffect, useRef, useState } from "react";

import { PaymentStatus } from "@/components/payment/PaymentStatus";
import { Lock, Spinner } from "@/components/ui/icons";
import { requestCheckoutSession, toCheckoutError, type CheckoutError } from "@/lib/checkout-client";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types/payment";

/**
 * Real test payment: calls this app's checkout endpoint (which uses
 * @ledgerly/payments on the server) and redirects to Stripe Checkout.
 */
export function LiveTestPayment({ product, stripeReady }: { product: Product; stripeReady: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "redirecting" | "error">("idle");
  const [error, setError] = useState<CheckoutError | null>(null);
  const inFlight = useRef(false);
  const price = formatCurrency(product.price, product.currency);

  // Reset if the page is restored from the back/forward cache after visiting Stripe.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        inFlight.current = false;
        setState("idle");
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  async function open() {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setState("loading");
    try {
      const url = await requestCheckoutSession({ productId: product.id, quantity: 1 });
      setState("redirecting");
      window.location.assign(url);
    } catch (err) {
      inFlight.current = false;
      setError(toCheckoutError(err));
      setState("error");
    }
  }

  const busy = state === "loading" || state === "redirecting";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-indigo-900/5 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
          Test mode
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <Lock className="size-3.5" /> Stripe-hosted
        </span>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Product</dt>
          <dd className="font-semibold text-slate-900 dark:text-white">{product.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Price</dt>
          <dd className="font-semibold text-slate-900 dark:text-white">{price}</dd>
        </div>
      </dl>
      <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        Card <code className="font-mono">4242 4242 4242 4242</code> · any future date · any CVC. No real money moves in test mode.
      </p>

            {state === "error" && error && (
        <PaymentStatus variant="error" title="Checkout could not be opened" className="mt-4">
          {error.message} <span className="font-mono text-xs opacity-70">({error.code})</span>
        </PaymentStatus>
      )}

      <button
        type="button"
        onClick={open}
        disabled={busy || !stripeReady}
        aria-busy={busy}
        className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:-translate-y-0.5 hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
      >
        {busy ? <Spinner className="size-5" /> : stripeReady ? <Lock className="size-4" /> : null}
        {!stripeReady ? "Real Stripe test unavailable" : state === "loading" ? "Creating session..." : state === "redirecting" ? "Redirecting to Stripe..." : "Open Stripe Checkout"}
      </button>
      <p className="sr-only" role="status">
        {state === "loading" && "Creating a secure checkout session."}
        {state === "redirecting" && "Redirecting to Stripe Checkout."}
      </p>
      <p className="mt-3 text-center font-mono text-[11px] text-slate-500 dark:text-slate-400">
        {`POST /api/stripe/create-checkout-session { productId: "${product.id}", quantity: 1 }`}
      </p>
    </div>
  );
}
