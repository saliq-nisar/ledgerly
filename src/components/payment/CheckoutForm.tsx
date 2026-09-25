"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { PaymentButton } from "@/components/payment/PaymentButton";
import { PaymentStatus } from "@/components/payment/PaymentStatus";
import { PaymentSummary } from "@/components/payment/PaymentSummary";
import { Card as CardIcon, Lock, Minus, Plus, Shield } from "@/components/ui/icons";
import { Card } from "@/components/ui/layout";
import { MAX_QUANTITY, MIN_QUANTITY } from "@/config/products";
import { calculateTotals } from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";
import { requestCheckoutSession, toCheckoutError, type CheckoutError } from "@/lib/checkout-client";
import type { PaymentState, Product } from "@/types/payment";

interface CheckoutFormProps {
  product: Product;
  /** Whether the server has a usable Stripe secret key. Only a boolean crosses the boundary. */
  stripeReady: boolean;
}

export function CheckoutForm({ product, stripeReady }: CheckoutFormProps) {
  const [quantity, setQuantity] = useState(MIN_QUANTITY);
  const [state, setState] = useState<PaymentState>("idle");
  const [error, setError] = useState<CheckoutError | null>(null);
  const inFlight = useRef(false);
  const quantityId = useId();

  const totals = calculateTotals(product, quantity);
  const totalLabel = formatCurrency(totals.total, totals.currency);
  const busy = state === "loading" || state === "processing";

  // If the user presses Back on Stripe's page, the browser may restore this page
  // from the back/forward cache still showing "Redirecting…". Reset it.
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

  async function handlePay() {
    // Ref guard blocks double clicks that land before React re-renders the disabled button.
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setState("loading");

    try {
      const url = await requestCheckoutSession({ productId: product.id, quantity });
      setState("processing");
      window.location.assign(url);
    } catch (err) {
      inFlight.current = false;
      setError(toCheckoutError(err));
      setState("error");
    }
  }

  function changeQuantity(next: number) {
    setQuantity(Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, next)));
    if (state === "error") {
      setState("idle");
      setError(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-8">
      {/* Order */}
      <Card className="p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Order summary</h2>
        <div className="mt-6 flex gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
          <div
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-500 text-xl font-bold text-white"
          >
            {product.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <p className="font-semibold text-slate-900 dark:text-white">{product.name} plan</p>
              <p className="font-semibold text-slate-900 dark:text-white">
                {formatCurrency(product.price, product.currency)}
              </p>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{product.description}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <label htmlFor={quantityId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Quantity
            <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
              Seats, {MIN_QUANTITY}–{MAX_QUANTITY}
            </span>
          </label>
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => changeQuantity(quantity - 1)}
              disabled={busy || quantity <= MIN_QUANTITY}
              aria-label="Decrease quantity"
              className="inline-flex size-10 items-center justify-center rounded-l-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Minus className="size-4" />
            </button>
            <input
              id={quantityId}
              type="number"
              inputMode="numeric"
              min={MIN_QUANTITY}
              max={MAX_QUANTITY}
              value={quantity}
              disabled={busy}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(value)) changeQuantity(value);
              }}
              className="h-10 w-12 border-x border-slate-200 bg-transparent text-center text-sm font-semibold [appearance:textfield] focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => changeQuantity(quantity + 1)}
              disabled={busy || quantity >= MAX_QUANTITY}
              aria-label="Increase quantity"
              className="inline-flex size-10 items-center justify-center rounded-r-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800" aria-live="polite">
          <PaymentSummary product={product} totals={totals} />
        </div>
      </Card>

      {/* Payment */}
      <Card className="flex flex-col p-6 sm:p-8 lg:self-start">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Payment</h2>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <Lock className="size-3.5" /> Secure checkout
          </span>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <CardIcon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Card, wallets & more</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Entered on Stripe&apos;s secure checkout page</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            You&apos;ll be redirected to Stripe Checkout to complete payment. Your card details go
            directly to Stripe and never touch this app&apos;s servers.
          </p>
          <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <span className="font-semibold">Test card:</span>{" "}
            <code className="font-mono">4242 4242 4242 4242</code> · any future date · any CVC
          </div>
        </div>

        {!stripeReady && (
          <PaymentStatus variant="info" title="Demo mode: Stripe keys not configured" className="mt-6">
            The app is using placeholder credentials, so checkout will return a friendly error.
            Add Stripe <strong>test-mode</strong> keys to <code className="font-mono">.env.local</code>{" "}
            to run real test payments, or{" "}
            <Link href={`/payment/success?demo=1&product=${product.id}`} className="font-semibold underline underline-offset-2">
              preview the success page
            </Link>{" "}
            with demo data.
          </PaymentStatus>
        )}

        {state === "error" && error && (
          <PaymentStatus variant="error" title="Payment could not be started" className="mt-6">
            {error.message}
            {error.code === "stripe_not_configured" && (
              <>
                {" "}
                <Link href={`/payment/success?demo=1&product=${product.id}`} className="font-semibold underline underline-offset-2">
                  Preview the success page (demo data)
                </Link>
              </>
            )}
          </PaymentStatus>
        )}

        <div className="mt-6">
          <PaymentButton state={state} amountLabel={totalLabel} onPay={handlePay} disabled={!stripeReady} disabledLabel={stripeReady ? undefined : "Real Stripe test unavailable"} />
          <p className="sr-only" role="status">
            {state === "loading" && "Creating a secure checkout session."}
            {state === "processing" && "Redirecting to Stripe Checkout."}
          </p>
        </div>

        <ul className="mt-6 space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <li className="flex items-center gap-2">
            <Shield className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Price is calculated on the server from the product ID
          </li>
          <li className="flex items-center gap-2">
            <Lock className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Card data is handled by Stripe, a PCI DSS Level 1 provider
          </li>
        </ul>
      </Card>
    </div>
  );
}
