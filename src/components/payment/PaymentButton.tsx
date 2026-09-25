"use client";

import { Button } from "@/components/ui/button";
import { Lock, Spinner } from "@/components/ui/icons";
import type { PaymentState } from "@/types/payment";

interface PaymentButtonProps {
  state: PaymentState;
  amountLabel: string;
  onPay: () => void;
  disabled?: boolean;
  /** Label shown while disabled for a reason other than an in-flight request. */
  disabledLabel?: string;
}

const BUSY_LABELS: Partial<Record<PaymentState, string>> = {
  loading: "Processing...",
  processing: "Redirecting to Stripe...",
};

/** Pay button that locks itself while a request is in flight to prevent double submission. */
export function PaymentButton({ state, amountLabel, onPay, disabled, disabledLabel }: PaymentButtonProps) {
  const busyLabel = BUSY_LABELS[state];
  const busy = Boolean(busyLabel);

  return (
    <Button
      size="lg"
      className="w-full"
      onClick={onPay}
      disabled={disabled || busy}
      aria-busy={busy}
    >
      {busy ? <Spinner className="size-5" /> : <Lock className="size-4" />}
      {busyLabel ?? (disabled && disabledLabel ? disabledLabel : state === "error" ? `Try again · ${amountLabel}` : `Pay ${amountLabel}`)}
    </Button>
  );
}
