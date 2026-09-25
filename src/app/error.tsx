"use client";

import { ResultLayout } from "@/components/payment/PaymentResult";
import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ResultLayout
      tone="error"
      title="Something went wrong"
      description="An unexpected error occurred. No payment was made as a result of this error."
      actions={
        <>
          <Button size="lg" onClick={reset}>
            Try again
          </Button>
          <ButtonLink href="/" variant="secondary" size="lg">
            Return home
          </ButtonLink>
        </>
      }
    />
  );
}
