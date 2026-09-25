import { CodeBlock } from "@/components/docs/CodeBlock";
import { Chip, DocSection, Panel } from "@/components/docs/DocSection";
import { FlowDiagram } from "@/components/docs/FlowDiagram";
import { WebhookSimulation } from "@/components/docs/sections/Simulations";

const CALLBACKS = [
  { name: "beforeCheckout", when: "Before Stripe, after validation", event: "—", fail: "Checkout refused (checkout_rejected); no session" },
  { name: "afterCheckout", when: "After Stripe created the session", event: "—", fail: "Logged + onError; session still returned" },
  { name: "onPaymentSucceeded", when: "After webhook verification", event: "checkout.session.completed (paid) · checkout.session.async_payment_succeeded", fail: "500 → Stripe retries" },
  { name: "onPaymentFailed", when: "After webhook verification", event: "checkout.session.async_payment_failed", fail: "500 → Stripe retries" },
  { name: "onPaymentAttemptFailed", when: "After webhook verification", event: "payment_intent.payment_failed", fail: "500 → Stripe retries" },
  { name: "onCheckoutExpired", when: "After webhook verification", event: "checkout.session.expired", fail: "500 → Stripe retries" },
];

const RESPONSES = [
  { status: "200", meaning: "processed, ignored (no handler) or duplicate" },
  { status: "400", meaning: "missing/invalid signature, expired timestamp, malformed payload. Stripe won't retry." },
  { status: "413", meaning: "body larger than the limit (default 1 MiB)" },
  { status: "500", meaning: "handler or storage failure, or webhooks not configured. Stripe retries." },
];

export function WebhooksDocsSection() {
  return (
    <DocSection
      id="webhooks"
      eyebrow="Webhooks & events"
      title="Stripe's answer comes back as a verified, typed event"
      description="The library owns the dangerous parts: raw body, signature, replay window, parsing, deduplication and error mapping. Your application owns the business logic."
    >
      <WebhookSimulation />

      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Event flow">
          <FlowDiagram
            summary="The path of a payment event from the customer to your application."
            steps={[
              { title: "Customer", detail: "Completes payment on Stripe Checkout", icon: "customer", tone: "customer" },
              { title: "Stripe", tag: "checkout.session.completed", icon: "stripe", tone: "stripe" },
              { title: "Webhook endpoint", tag: "createWebhookHandler(payments)", icon: "api", tone: "app" },
              { title: "Signature verification", detail: "HMAC of raw bytes + Stripe-Signature + 300 s tolerance", icon: "shield", tone: "lib" },
              { title: "Event handling", detail: "storage dedupe → on() handlers → callbacks", icon: "library", tone: "lib" },
              { title: "Your application", tag: "onPaymentSucceeded(payment)", icon: "check", tone: "success" },
            ]}
            connectors={[
              { label: "pays", kind: "return" },
              { label: "signed POST", kind: "return" },
              { label: "raw body", kind: "return" },
              { label: "verified", kind: "return" },
              { label: "PaymentOutcome", kind: "return" },
            ]}
          />
        </Panel>
        <div className="min-w-0 space-y-4">
          <CodeBlock snippet="03-frameworks#webhooks" filename="subscribe to Stripe events" />
          <CodeBlock snippet="04-callbacks-storage#callbacks" wrapInClient filename="…or use normalized callbacks" />
        </div>
      </div>

      <div className="mt-12 overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="px-5 pt-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Callbacks: when they run and what happens if they throw
          </caption>
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th scope="col" className="px-5 py-3 font-medium">Callback</th>
              <th scope="col" className="px-5 py-3 font-medium">Runs</th>
              <th scope="col" className="px-5 py-3 font-medium">Triggered by</th>
              <th scope="col" className="px-5 py-3 font-medium">If it throws</th>
            </tr>
          </thead>
          <tbody>
            {CALLBACKS.map((c) => (
              <tr key={c.name} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                <th scope="row" className="px-5 py-3 font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300">{c.name}</th>
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{c.when}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{c.event}</td>
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{c.fail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-3">
          <h3 className="font-semibold text-slate-900 dark:text-white">Storage (deduplication)</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">Stripe may deliver an event more than once. Plug in your database; the library does the rest.</p>
          <CodeBlock snippet="04-callbacks-storage#storage" wrapInClient filename="storage" animate={false} />
        </div>
        <div className="min-w-0 space-y-3 lg:col-span-2">
          <h3 className="font-semibold text-slate-900 dark:text-white">Logging &amp; monitoring</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Works with any provider. Hooks receive only IDs, amounts, statuses, durations and error codes. Custom loggers never
            see secrets, because fields are redacted first.
          </p>
          <CodeBlock snippet="04-callbacks-storage#observability" wrapInClient filename="logging + monitoring" animate={false} />
        </div>
      </div>

      <Panel title="Webhook handler responses" className="mt-12">
        <ul className="grid gap-3 sm:grid-cols-2">
          {RESPONSES.map((r) => (
            <li key={r.status} className="flex gap-3 text-sm">
              <Chip tone={r.status === "200" ? "emerald" : r.status === "500" ? "amber" : "rose"}>{r.status}</Chip>
              <span className="text-slate-700 dark:text-slate-300">{r.meaning}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </DocSection>
  );
}
