import { CodeBlock } from "@/components/docs/CodeBlock";
import { Chip, DocSection, Panel } from "@/components/docs/DocSection";
import { ErrorSimulator } from "@/components/docs/ErrorSimulator";

export function ErrorsSection() {
  return (
    <DocSection
      id="errors"
      eyebrow="Error handling"
      title="Every failure becomes a safe, typed error"
      description="Pick a mistake to see exactly what the library reports. The values shown are the library's real output for v0.2.0, and a test in the package pins them."
    >
      <ErrorSimulator />
      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <CodeBlock snippet="03-frameworks#errors" filename="error handling" />
        <div className="space-y-4">
          <Panel title="Map codes to your own UI">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <code className="font-mono text-xs">payments.errors.describe(error)</code> works on any thrown value and
              returns <Chip>{"{ code, message, statusCode, retryable }"}</Chip>. Compare codes with{" "}
              <Chip tone="indigo">PaymentErrorCodes.*</Chip>, or replace messages with <Chip>errors.publicMessages</Chip>.
            </p>
          </Panel>
          <Panel title="Typed error classes">
            <p className="flex flex-wrap gap-1.5">
              {["PaymentConfigurationError", "PaymentValidationError", "PaymentAuthenticationError", "PaymentRateLimitError", "PaymentNetworkError", "PaymentNotFoundError", "PaymentProviderError", "PaymentWebhookError"].map((name) => (
                <Chip key={name}>{name}</Chip>
              ))}
            </p>
          </Panel>
        </div>
      </div>
    </DocSection>
  );
}
