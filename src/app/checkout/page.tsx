import type { Metadata } from "next";
import Link from "next/link";

import { CheckoutForm } from "@/components/payment/CheckoutForm";
import { PaymentStatus } from "@/components/payment/PaymentStatus";
import { ArrowLeft } from "@/components/ui/icons";
import { Container } from "@/components/ui/layout";
import { DEFAULT_PRODUCT_ID, getProduct, PRODUCTS } from "@/config/products";
import { getPayments } from "@/lib/payments";
import { cn, firstParam, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Checkout",
};

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const requestedId = firstParam((await searchParams).product);
  const product = getProduct(requestedId ?? DEFAULT_PRODUCT_ID);
  // Only a boolean crosses to the Client Component — never keys or the client itself.
  const stripeReady = getPayments().ok;

  return (
    <div className="bg-slate-50 py-10 sm:py-16 dark:bg-slate-950">
      <Container>
        <Link
          href="/#real-stripe-test"
          className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-400 dark:hover:text-indigo-400"
        >
          <ArrowLeft className="size-4" /> Back to plans
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Checkout
        </h1>

        <nav aria-label="Choose a plan" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {PRODUCTS.map((p) => {
              const selected = p.id === product?.id;
              return (
                <li key={p.id}>
                  <Link
                    href={`/checkout?product=${p.id}`}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
                      selected
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                    )}
                  >
                    {p.name}
                    <span className="text-slate-500 dark:text-slate-400">{formatCurrency(p.price, p.currency)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-8">
          {product ? (
            // Keyed so switching plans resets quantity and payment state.
            <CheckoutForm key={product.id} product={product} stripeReady={stripeReady} />
          ) : (
            <PaymentStatus variant="error" title="We couldn't find that plan">
              The plan in the link doesn&apos;t exist. Choose one of the plans above to continue.
            </PaymentStatus>
          )}
        </div>
      </Container>
    </div>
  );
}
