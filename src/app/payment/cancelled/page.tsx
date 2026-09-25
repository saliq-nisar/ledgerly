import type { Metadata } from "next";

import { ResultLayout } from "@/components/payment/PaymentResult";
import { ButtonLink } from "@/components/ui/button";
import { Refresh } from "@/components/ui/icons";
import { getProduct } from "@/config/products";
import { firstParam } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Payment cancelled",
  robots: { index: false },
};

export default async function PaymentCancelledPage({ searchParams }: PageProps<"/payment/cancelled">) {
  const product = getProduct(firstParam((await searchParams).product));
  const retryHref = product ? `/checkout?product=${product.id}` : "/checkout";

  return (
    <ResultLayout
      tone="cancelled"
      title="Payment cancelled"
      description={
        <>
          You left checkout before completing your payment
          {product ? ` for the ${product.name} plan` : ""}.{" "}
          <strong className="text-slate-900 dark:text-white">You have not been charged.</strong> Your
          card details weren&apos;t saved, and you can pick up where you left off at any time.
        </>
      }
      actions={
        <>
          <ButtonLink href={retryHref} size="lg">
            <Refresh className="size-4" /> Try again
          </ButtonLink>
          <ButtonLink href="/" variant="secondary" size="lg">
            Return home
          </ButtonLink>
        </>
      }
    />
  );
}
