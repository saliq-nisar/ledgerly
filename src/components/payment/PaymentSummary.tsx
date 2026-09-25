import { formatCurrency } from "@/lib/utils";
import type { OrderTotals, Product } from "@/types/payment";

interface PaymentSummaryProps {
  product: Product;
  totals: OrderTotals;
}

/** Read-only order breakdown. Display only — the server recalculates the charge. */
export function PaymentSummary({ product, totals }: PaymentSummaryProps) {
  const fmt = (amount: number) => formatCurrency(amount, totals.currency);

  return (
    <dl className="space-y-3 text-sm">
      <Row label="Product" value={`${product.name} plan`} />
      <Row label="Unit price" value={fmt(totals.unitPrice)} />
      <Row label="Quantity" value={String(totals.quantity)} />
      <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
        <Row label="Subtotal" value={fmt(totals.subtotal)} />
      </div>
      <Row
        label="Tax"
        value={totals.tax > 0 ? fmt(totals.tax) : "Not applied (demo)"}
        muted={totals.tax === 0}
      />
      <div className="flex items-baseline justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
        <dt className="text-base font-semibold text-slate-900 dark:text-white">Total due</dt>
        <dd className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{fmt(totals.total)}</dd>
      </div>
    </dl>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={muted ? "text-slate-400 dark:text-slate-500" : "font-medium text-slate-900 dark:text-white"}>
        {value}
      </dd>
    </div>
  );
}
