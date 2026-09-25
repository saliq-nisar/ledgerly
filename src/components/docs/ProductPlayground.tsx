"use client";

import { useState, type ReactNode } from "react";

import { Check, Minus, Plus, X } from "@/components/ui/icons";
import { MAX_QUANTITY, PRODUCTS } from "@/config/products";
import { cn, formatCurrency } from "@/lib/utils";
import type { ProductId } from "@/types/payment";

/**
 * Example catalog explorer. Mirrors what @ledgerly/payments does on the
 * server: the browser picks an ID and a quantity, the catalog decides the
 * price, and quantities outside the configured limits are rejected.
 */
export function ProductPlayground() {
  const [productId, setProductId] = useState<ProductId>("pro");
  const [quantity, setQuantity] = useState(1);
  const product = PRODUCTS.find((p) => p.id === productId)!;
  const valid = Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY;
  const total = product.price * quantity;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
          Example catalog · demonstration values
        </p>
        <div role="radiogroup" aria-label="Product" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {PRODUCTS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === productId}
              onClick={() => setProductId(p.id)}
              className={cn(
                "rounded-2xl border p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-indigo-500",
                p.id === productId
                  ? "border-indigo-500 bg-indigo-50 shadow-md dark:bg-indigo-500/10"
                  : "border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900",
              )}
            >
              <p className="font-semibold text-slate-900 dark:text-white">{p.name}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(p.price, p.currency)}</p>
              <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                {p.id}: {p.price} {p.currency}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <span id="pp-qty" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Quantity <span className="text-xs text-slate-500">(limit 1–{MAX_QUANTITY})</span>
          </span>
          <div className="flex items-center gap-1" role="group" aria-labelledby="pp-qty">
            <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((q) => q - 1)} className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:hover:bg-slate-800">
              <Minus className="size-4" />
            </button>
            <output aria-live="polite" className="w-10 text-center font-mono font-semibold">{quantity}</output>
            <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((q) => q + 1)} className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:hover:bg-slate-800">
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Try going above {MAX_QUANTITY} or below 1 to see the server-side rule.</p>
      </div>

      <div className="space-y-3" aria-live="polite">
        <Step label="Browser sends" tone="slate">
          <code className="font-mono text-sm">{`{ productId: "${productId}", quantity: ${quantity} }`}</code>
        </Step>
        <Step label="@ledgerly/payments resolves" tone={valid ? "indigo" : "rose"}>
          {valid ? (
            <p className="font-mono text-sm">
              {product.price} × {quantity} = <strong>{total}</strong> {product.currency}{" "}
              <span className="font-sans text-slate-500 dark:text-slate-400">(integer cents, from the catalog)</span>
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
              <X className="size-4" /> 400 invalid_quantity: “Quantity must be a whole number between 1 and {MAX_QUANTITY}.”
            </p>
          )}
        </Step>
        <Step label="Stripe Checkout charges" tone={valid ? "emerald" : "slate"}>
          {valid ? (
            <p className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
              <Check className="size-5 text-emerald-600" /> {formatCurrency(total, product.currency)}
            </p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">No session is created, so Stripe is never called.</p>
          )}
        </Step>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configuration preview. No Stripe request is made. The price in the browser is for display only; the server
          recomputes it.
        </p>
      </div>
    </div>
  );
}

function Step({ label, tone, children }: { label: string; tone: "slate" | "indigo" | "rose" | "emerald"; children: ReactNode }) {
  const border = { slate: "border-slate-200 dark:border-slate-800", indigo: "border-indigo-300 dark:border-indigo-500/50", rose: "border-rose-400 dark:border-rose-500/50", emerald: "border-emerald-400 dark:border-emerald-500/50" }[tone];
  return (
    <div className={cn("rounded-2xl border-2 bg-white p-4 transition-colors duration-300 dark:bg-slate-900", border)}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <div className="text-slate-900 dark:text-white">{children}</div>
    </div>
  );
}
