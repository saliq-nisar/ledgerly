import type { ReactNode } from "react";

import { Alert, AnimatedCheck, Clock, X } from "@/components/ui/icons";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import type { PaymentSummaryData } from "@/types/payment";

type ResultTone = "success" | "processing" | "error" | "cancelled";

const toneRing: Record<ResultTone, string> = {
  success: "bg-emerald-500 shadow-emerald-500/30",
  processing: "bg-sky-500 shadow-sky-500/30",
  error: "bg-rose-500 shadow-rose-500/30",
  cancelled: "bg-amber-500 shadow-amber-500/30",
};

/** Large animated status icon used at the top of result pages. */
export function ResultIcon({ tone }: { tone: ResultTone }) {
  return (
    <div aria-hidden="true" className="relative mx-auto size-20">
      {tone === "success" && (
        <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ripple" />
      )}
      <span
        className={cn(
          "relative flex size-20 items-center justify-center rounded-full text-white shadow-xl animate-ring-pop",
          toneRing[tone],
        )}
      >
        {tone === "success" && <AnimatedCheck className="size-10" />}
        {tone === "processing" && <Clock className="size-10" />}
        {tone === "error" && <Alert className="size-10" />}
        {tone === "cancelled" && <X className="size-10" />}
      </span>
    </div>
  );
}

interface ResultLayoutProps {
  tone: ResultTone;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  actions: ReactNode;
}

export function ResultLayout({ tone, title, description, children, actions }: ResultLayoutProps) {
  return (
    <div className="relative overflow-hidden py-16 sm:py-24">
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1/2 top-0 -z-10 h-80 w-[48rem] -translate-x-1/2 rounded-full blur-3xl",
          tone === "success" && "bg-emerald-300/25 dark:bg-emerald-600/15",
          tone === "processing" && "bg-sky-300/25 dark:bg-sky-600/15",
          tone === "error" && "bg-rose-300/25 dark:bg-rose-600/15",
          tone === "cancelled" && "bg-amber-300/25 dark:bg-amber-600/15",
        )}
      />
      <div className="mx-auto w-full max-w-xl px-4 text-center">
        <ResultIcon tone={tone} />
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white animate-fade-up">
          {title}
        </h1>
        <div className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">{description}</div>
        {children && <div className="mt-10 text-left">{children}</div>}
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">{actions}</div>
      </div>
    </div>
  );
}

/** Receipt-style breakdown of a payment. */
export function PaymentReceipt({ summary }: { summary: PaymentSummaryData }) {
  const rows: { label: string; value: ReactNode; mono?: boolean }[] = [
    { label: "Product", value: `${summary.productName} plan × ${summary.quantity}` },
    { label: "Amount", value: formatCurrency(summary.amountTotal, summary.currency) },
    { label: "Date", value: formatDateTime(summary.createdAt) },
    { label: summary.isDemo ? "Reference" : "Checkout Session", value: summary.checkoutSessionId, mono: true },
  ];
  if (summary.paymentIntentId) {
    rows.push({ label: "Payment reference", value: summary.paymentIntentId, mono: true });
  }
  if (summary.customerEmail) {
    rows.push({ label: "Receipt email", value: summary.customerEmail });
  }

  return (
    <section
      aria-labelledby="receipt-title"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="receipt-title" className="font-semibold text-slate-900 dark:text-white">
          Payment summary
        </h2>
        {summary.isDemo ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            Demo data
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            Verified with Stripe
          </span>
        )}
      </div>
      <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
            <dt className="shrink-0 text-slate-500 dark:text-slate-400">{row.label}</dt>
            <dd
              className={cn(
                "min-w-0 break-all font-medium text-slate-900 sm:text-right dark:text-white",
                row.mono && "font-mono text-xs",
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {summary.isDemo && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          Illustrative preview only. No Stripe session or payment was created, so there is no real
          transaction reference.
        </p>
      )}
    </section>
  );
}
