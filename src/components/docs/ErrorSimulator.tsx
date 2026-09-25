"use client";

import { useState } from "react";

import { highlightTs, TOKEN_CLASS } from "@/lib/highlight";
import { cn } from "@/lib/utils";

/**
 * Shows what `payments.errors.describe(error)` returns for common mistakes.
 * The values below are the library's real outputs (v0.2.0), asserted by
 * packages/payments/test/docs-errors.test.ts so they can't drift.
 */
const SCENARIOS = [
  {
    id: "product",
    label: "Invalid Product",
    constant: "PaymentErrorCodes.INVALID_PRODUCT",
    input: `payments.checkout.parse({ productId: "enterprise" })`,
    result: { code: "invalid_product", message: "Unknown product.", statusCode: 400, retryable: false },
  },
  {
    id: "quantity",
    label: "Invalid Quantity",
    constant: "PaymentErrorCodes.INVALID_QUANTITY",
    input: `payments.checkout.parse({ productId: "pro", quantity: 0 })`,
    result: { code: "invalid_quantity", message: "Quantity must be a whole number between 1 and 10.", statusCode: 400, retryable: false },
  },
  {
    id: "field",
    label: "Unexpected Field",
    constant: "PaymentErrorCodes.UNEXPECTED_FIELD",
    input: `payments.checkout.parse({ productId: "pro", amount: 1 })`,
    result: { code: "unexpected_field", message: "Invalid checkout request.", statusCode: 400, retryable: false },
  },
  {
    id: "redirect",
    label: "Invalid Redirect",
    constant: "PaymentErrorCodes.INVALID_REDIRECT",
    input: `await payments.checkout.create({
  productId: "pro",
  redirect: { success: "https://evil.example/steal" },
})`,
    result: { code: "invalid_redirect", message: "Invalid checkout request.", statusCode: 400, retryable: false },
  },
  {
    id: "metadata",
    label: "Invalid Metadata",
    constant: "PaymentErrorCodes.INVALID_METADATA",
    input: `await payments.checkout.create({
  productId: "pro",
  metadata: { cardNumber: "4242" },
})`,
    result: {
      code: "invalid_metadata",
      message: 'metadata key "cardNumber" looks sensitive. Never store credentials or card data in Stripe metadata.',
      statusCode: 400,
      retryable: false,
    },
  },
] as const;

function Code({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-[13px] leading-6">
      <code className="font-mono">
        {highlightTs(code).map((line, i) => (
          <span key={i} className="block">
            {line.map((t, j) => <span key={j} className={TOKEN_CLASS[t.kind]}>{t.text}</span>)}
          </span>
        ))}
      </code>
    </pre>
  );
}

export function ErrorSimulator() {
  const [selected, setSelected] = useState<(typeof SCENARIOS)[number]["id"]>("product");
  const scenario = SCENARIOS.find((s) => s.id === selected)!;
  const { result } = scenario;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div role="radiogroup" aria-label="Error scenario" className="grid gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={s.id === selected}
            onClick={() => setSelected(s.id)}
            className={cn(
              "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500",
              s.id === selected
                ? "border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200"
                : "border-slate-200 bg-white text-slate-700 hover:border-rose-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
            )}
          >
            {s.label}
            <code className="font-mono text-xs opacity-70">{s.result.code}</code>
          </button>
        ))}
      </div>

      <div key={scenario.id} className="min-w-0 space-y-4 animate-fade-up" aria-live="polite">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Your server code</p>
          <Code code={scenario.input} />
        </div>
        <div className="rounded-2xl border-2 border-rose-300 bg-white p-5 dark:border-rose-500/40 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            payments.errors.describe(error)
          </p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 font-mono text-sm">
            <dt className="text-slate-500">code</dt>
            <dd className="break-words text-slate-900 dark:text-white">&quot;{result.code}&quot;</dd>
            <dt className="text-slate-500">message</dt>
            <dd className="break-words text-slate-900 dark:text-white">&quot;{result.message}&quot;</dd>
            <dt className="text-slate-500">statusCode</dt>
            <dd className="text-slate-900 dark:text-white">{result.statusCode}</dd>
            <dt className="text-slate-500">retryable</dt>
            <dd className="text-slate-900 dark:text-white">{String(result.retryable)}</dd>
          </dl>
          <p className="mt-4 text-xs text-slate-600 dark:text-slate-400">
            Constant: <code className="font-mono">{scenario.constant}</code>. Errors are thrown before Stripe is contacted,
            and messages never include secrets or internals. Simulation of the library&apos;s documented output.
          </p>
        </div>
      </div>
    </div>
  );
}
