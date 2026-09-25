import { CodeBlock } from "@/components/docs/CodeBlock";
import { ConfigHierarchy } from "@/components/docs/ConfigHierarchy";
import { ConfigPlayground } from "@/components/docs/ConfigPlayground";
import { DocSection } from "@/components/docs/DocSection";

const HUB_CODE = `createPaymentClient({
  products,            // required
  environment: "test",
  checkout: { … },
  metadata: { … },
  urls: { … },
  security: { … },
  callbacks: { … },
  storage: { … },
  logging: { … },
  monitoring: { … },
  errors: { … },
});`;

const CARDS = [
  { key: "checkout", title: "Checkout", body: "Promotion codes, billing & shipping address, phone, tax, locale, custom text & fields, expiry." },
  { key: "metadata", title: "Metadata", body: "Allow-list keys (also narrows TypeScript), cap count and length. Card data and secrets are rejected." },
  { key: "urls", title: "Redirects", body: "Same-origin success/cancel paths; session_id is appended automatically." },
  { key: "callbacks", title: "Callbacks", body: "beforeCheckout veto, afterCheckout follow-up, and typed payment outcomes from verified webhooks." },
  { key: "storage", title: "Storage", body: "Plug in any database for webhook deduplication: claim/release or hasProcessedEvent/markEventProcessed." },
  { key: "logging", title: "Logging", body: "Bring your own logger and level. Fields are redacted before your logger sees them." },
  { key: "monitoring", title: "Monitoring", body: "Works with any provider: onRequest, onError, onCheckoutCreated, onWebhookReceived, onWebhookProcessed." },
  { key: "errors", title: "Errors", body: "Replace user-facing messages per error code; describe() returns a safe shape." },
  { key: "security", title: "Security", body: "Explicitly allow extra redirect origins. Everything else is enforced and not configurable." },
] as const;

export function CustomizationSection() {
  return (
    <DocSection
      id="customization"
      eyebrow="Customization"
      title="Customize the payment experience without rebuilding the payment system"
      description="Start with just products. Every other option is optional, fully typed, and validated at startup. Unknown options throw instead of being silently ignored."
    >
      {/* Hub: central configuration object with its sections around it */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(0,1.3fr)_1fr] lg:items-center">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {CARDS.slice(0, 5).map((card) => (
            <HubCard key={card.key} configKey={card.key} title={card.title} body={card.body} side="left" />
          ))}
        </ul>
        <CodeBlock code={HUB_CODE} filename="Every top-level option in v0.2.0" source="All keys shown exist in PaymentClientConfig; only products is required" />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {CARDS.slice(5).map((card) => (
            <HubCard key={card.key} configKey={card.key} title={card.title} body={card.body} side="right" />
          ))}
        </ul>
      </div>

      <div id="playground" className="mt-20 scroll-mt-32">
        <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Customization playground</h3>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
          Change options and watch the TypeScript and the architecture view update. Every control is a real v0.2.0 option with
          values the library accepts. This is a configuration simulation; no Stripe call is made.
        </p>
        <div className="mt-8">
          <ConfigPlayground />
        </div>
      </div>

      <div className="mt-20">
        <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Where each option can be set</h3>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
          Options flow from general to specific. Hover or focus a layer to see what it controls. Tax, invoicing and mode
          are business policy, so they can&apos;t vary per request.
        </p>
        <div className="mt-8">
          <ConfigHierarchy />
        </div>
      </div>

      <details className="group mt-16 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <summary className="cursor-pointer list-none rounded-2xl px-6 py-4 font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-white [&::-webkit-details-marker]:hidden">
          <span className="mr-2 inline-block transition-transform group-open:rotate-90">▸</span>
          See a fully customized production configuration
        </summary>
        <div className="grid gap-4 px-6 pb-6 lg:grid-cols-2">
          <CodeBlock snippet="02-customized#products" filename="products" animate={false} />
          <CodeBlock snippet="02-customized#per-call" filename="per-call customization" animate={false} />
          <CodeBlock snippet="02-customized#config" filename="createPaymentClient" animate={false} className="lg:col-span-2" />
        </div>
      </details>
    </DocSection>
  );
}

function HubCard({ title, body, configKey, side }: { title: string; body: string; configKey: string; side: "left" | "right" }) {
  return (
    <li className="group relative rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/50">
      <span
        aria-hidden="true"
        className={`hub-link absolute top-1/2 hidden h-0.5 w-4 bg-indigo-300 lg:block dark:bg-indigo-500/40 ${side === "left" ? "-right-4" : "-left-4"}`}
      />
      <p className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-900 dark:text-white">{title}</span>
        <code className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-xs text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{configKey}</code>
      </p>
      <p className="mt-1 text-sm leading-snug text-slate-600 dark:text-slate-400">{body}</p>
    </li>
  );
}
