import type { Metadata } from "next";

import { PaymentReceipt, ResultLayout } from "@/components/payment/PaymentResult";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRight } from "@/components/ui/icons";
import { DEFAULT_PRODUCT_ID, getProduct } from "@/config/products";
import { buildDemoSummary, loadPaymentSummary } from "@/lib/payment-summary";
import { firstParam } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Payment status",
  robots: { index: false },
};

const homeButton = (
  <ButtonLink href="/" variant="secondary" size="lg">
    Return to home
  </ButtonLink>
);

export default async function PaymentSuccessPage({ searchParams }: PageProps<"/payment/success">) {
  const params = await searchParams;
  const sessionId = firstParam(params.session_id);
  const isDemo = firstParam(params.demo) === "1";

  // Illustrative preview when Stripe isn't set up. Clearly labelled as demo data.
  if (!sessionId && isDemo) {
    const product = getProduct(firstParam(params.product)) ?? getProduct(DEFAULT_PRODUCT_ID)!;
    return (
      <ResultLayout
        tone="success"
        title="Payment successful"
        description={
          <>
            This is a <strong className="text-slate-900 dark:text-white">demo preview</strong> of the
            success page. Configure Stripe test keys to see real session data here.
          </>
        }
        actions={
          <>
            <ButtonLink href="/" size="lg">
              Return to home
            </ButtonLink>
            <ButtonLink href="/checkout" variant="secondary" size="lg">
              Go to checkout
            </ButtonLink>
          </>
        }
      >
        <PaymentReceipt summary={buildDemoSummary(product)} />
      </ResultLayout>
    );
  }

  if (!sessionId) {
    return (
      <ResultLayout
        tone="cancelled"
        title="No payment to show"
        description="This page shows the result of a checkout. Start a payment to see a confirmation here."
        actions={
          <>
            <ButtonLink href="/#real-stripe-test" size="lg">
              View plans <ArrowRight className="size-4" />
            </ButtonLink>
            {homeButton}
          </>
        }
      />
    );
  }

  const result = await loadPaymentSummary(sessionId);

  if (!result.ok && result.reason === "not_configured") {
    return (
      <ResultLayout
        tone="error"
        title="Can't verify this payment"
        description="Stripe isn't configured on the server, so the payment status can't be checked. Add Stripe test-mode keys and try again."
        actions={homeButton}
      />
    );
  }

  if (!result.ok) {
    const message =
      result.reason === "unavailable"
        ? "We couldn't reach Stripe to confirm your payment. If you completed checkout, your payment is safe — refresh this page in a moment."
        : "We couldn't find a payment matching this link. Please check the link or start a new checkout.";
    return (
      <ResultLayout
        tone="error"
        title="We couldn't confirm your payment"
        description={message}
        actions={
          <>
            <ButtonLink href="/checkout" size="lg">
              Go to checkout
            </ButtonLink>
            {homeButton}
          </>
        }
      />
    );
  }

  const { summary } = result;

  if (summary.status === "processing") {
    return (
      <ResultLayout
        tone="processing"
        title="Payment processing"
        description="Your order is placed and the payment is being processed. We'll confirm it as soon as Stripe notifies us."
        actions={homeButton}
      >
        <PaymentReceipt summary={summary} />
      </ResultLayout>
    );
  }

  if (summary.status === "unpaid" || summary.status === "expired") {
    return (
      <ResultLayout
        tone="error"
        title="Payment not completed"
        description="This checkout wasn't paid. No money was taken. You can try again whenever you're ready."
        actions={
          <>
            <ButtonLink href="/checkout" size="lg">
              Try again
            </ButtonLink>
            {homeButton}
          </>
        }
      />
    );
  }

  return (
    <ResultLayout
      tone="success"
      title="Payment successful"
      description="Thanks for your purchase! A receipt is on its way if you entered an email at checkout."
      actions={
        <>
          <ButtonLink href="/" size="lg">
            Return to home
          </ButtonLink>
          <ButtonLink href="/#real-stripe-test" variant="secondary" size="lg">
            View plans
          </ButtonLink>
        </>
      }
    >
      <PaymentReceipt summary={summary} />
    </ResultLayout>
  );
}
