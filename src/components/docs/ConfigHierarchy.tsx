"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";

const LAYERS = [
  {
    id: "client",
    name: "Client-wide",
    where: "createPaymentClient({ checkout: { … } })",
    allows: "Every checkout option, plus quantity limits and default success/cancel paths.",
    note: "The defaults for every product and every call.",
  },
  {
    id: "product",
    name: "Product",
    where: "defineProducts({ pro: { checkout: { … } } })",
    allows: "Every checkout option. Overrides the client-wide value option by option.",
    note: "Example: allow promotion codes only on the Pro plan.",
  },
  {
    id: "call",
    name: "Checkout request",
    where: "payments.checkout.create({ options: { … } })",
    allows: "Every checkout option except the policy-controlled ones: automaticTax, createInvoice and mode.",
    note: "Always server-side code. The browser can't send options.",
    policy: ["automaticTax", "createInvoice", "mode"],
  },
  {
    id: "effective",
    name: "Effective configuration",
    where: "merged inside the library",
    allows: "Later levels win option by option; customText and consentCollection merge key by key.",
    note: "Price, currency, quantity limits, redirect origins and metadata rules are never part of this merge.",
  },
  {
    id: "stripe",
    name: "Stripe Checkout Session",
    where: "stripe.checkout.sessions.create(…)",
    allows: "Only the explicitly mapped parameters, plus catalog price, currency, validated quantity and reserved metadata.",
    note: "Nothing is ever spread from your input into the Stripe request.",
  },
] as const;

export function ConfigHierarchy() {
  const [active, setActive] = useState<string>("call");
  const id = useId();
  const current = LAYERS.find((l) => l.id === active) ?? LAYERS[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <ol className="min-w-0 space-y-2" aria-label="Configuration layers, from most general to Stripe">
        {LAYERS.map((layer, i) => (
          <li key={layer.id}>
            <button
              type="button"
              aria-pressed={layer.id === active}
              aria-describedby={`${id}-detail`}
              onMouseEnter={() => setActive(layer.id)}
              onFocus={() => setActive(layer.id)}
              onClick={() => setActive(layer.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 focus-visible:outline-2 focus-visible:outline-indigo-500",
                layer.id === active
                  ? "border-indigo-500 bg-indigo-50 shadow-md dark:bg-indigo-500/10"
                  : "border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900",
              )}
              style={{ marginLeft: `${Math.min(i, 3) * 0.75}rem`, width: `calc(100% - ${Math.min(i, 3) * 0.75}rem)` }}
            >
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 font-mono text-xs font-bold text-white dark:bg-slate-700">{i + 1}</span>
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900 dark:text-white">{layer.name}</span>
                <code className="block truncate font-mono text-xs text-slate-500 dark:text-slate-400">{layer.where}</code>
              </span>
            </button>
            {i < LAYERS.length - 1 && <span aria-hidden="true" className="ml-7 block h-2 w-0.5 bg-slate-300 dark:bg-slate-700" />}
          </li>
        ))}
      </ol>

      <div id={`${id}-detail`} aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-36 lg:self-start dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{current.name}</p>
        <code className="mt-2 block break-words font-mono text-sm text-slate-900 dark:text-white">{current.where}</code>
        <p className="mt-4 text-slate-700 dark:text-slate-300">{current.allows}</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{current.note}</p>
        {"policy" in current && (
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold">Policy-controlled (rejected per call):</p>
            <p className="mt-1 font-mono text-xs">{current.policy.join(" · ")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
