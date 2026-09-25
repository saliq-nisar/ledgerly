import { ResultLayout } from "@/components/payment/PaymentResult";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <ResultLayout
      tone="cancelled"
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
      actions={
        <ButtonLink href="/" size="lg">
          Return home
        </ButtonLink>
      }
    />
  );
}
