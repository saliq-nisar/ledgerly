import libraryPackage from "@ledgerly/payments/package.json";

import { CodeBlock } from "@/components/docs/CodeBlock";
import { Chip, DocSection, Panel, StepRow } from "@/components/docs/DocSection";
import { FlowDiagram } from "@/components/docs/FlowDiagram";
import { JourneyTimeline } from "@/components/docs/JourneyTimeline";
import { Check, Lock, X } from "@/components/ui/icons";

const ENV_FILE = `# .env.local — server-side only, never committed
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_URL=http://localhost:3000`;

export function InstallSection() {
  const nodeRange = libraryPackage.engines.node;
  return (
    <DocSection
      id="use-in-your-app"
      eyebrow="Use it in your app · Step 1"
      title="Use @ledgerly/payments in your application"
      description={
        <>
          Start by installing one package. The official Stripe SDK comes with it as its only runtime dependency, so your application never
          installs or imports <code className="font-mono text-base">stripe</code> itself.
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <CodeBlock language="shell" code={`npm install ${libraryPackage.name}`} filename="terminal" source="Installs the library and its one dependency (stripe)" />
          <CodeBlock language="shell" code={ENV_FILE} filename=".env.local" source="Only STRIPE_SECRET_KEY is required; webhooks need STRIPE_WEBHOOK_SECRET, checkout needs APP_URL" />
        </div>
        <Panel title="Requirements">
          <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
            {[
              ["Runtime", <>Node.js <code className="font-mono">{nodeRange}</code> (or any server runtime with Fetch + Web Crypto)</>],
              ["Module format", <>ESM; <code className="font-mono">require()</code> works on Node ≥ 20.19 / ≥ 22.12</>],
              ["Runs on", "The server only. Importing it in browser code throws on purpose."],
              ["Dependencies", <><code className="font-mono">stripe</code> only. No React, framework or database.</>],
              ["Environment", <><code className="font-mono">PAYMENTS_ENVIRONMENT</code> defaults to <code className="font-mono">test</code>, which only accepts <code className="font-mono">sk_test_</code> keys</>],
            ].map(([label, value]) => (
              <li key={String(label)} className="flex gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  <span className="font-semibold text-slate-900 dark:text-white">{label}: </span>
                  {value}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </DocSection>
  );
}

export function QuickStartSection() {
  return (
    <DocSection
      id="quick-start"
      eyebrow="Use it in your app · Steps 2–5"
      title="From products to a paid order in four snippets"
      description="Each snippet below is extracted from the library's type-checked examples, so it compiles against the real API."
      tinted
    >
      <div className="space-y-20">
        <StepRow
          step="02"
          title="Define products and create the client"
          code={<CodeBlock snippet="01-minimal#setup" filename="lib/payments.ts" />}
          visual={
            <Panel title="The price lives on the server">
              <FlowDiagram
                summary="How a product definition becomes the trusted price used at checkout."
                steps={[
                  { title: "Product definition", tag: 'pro: { price: 1999, currency: "usd" }', icon: "db", tone: "app" },
                  { title: "Validated catalog", detail: "Integer cents, ISO currency, Stripe minimums, quantity limits", icon: "shield", tone: "lib" },
                  { title: "Trusted price", tag: "$19.99 × quantity", icon: "lock", tone: "lib" },
                  { title: "Stripe Checkout", detail: "Charged exactly what your code declares", icon: "stripe", tone: "stripe" },
                ]}
                connectors={[{ label: "createPaymentClient()" }, { label: "lookup by productId" }, { label: "line_items" }]}
              />
            </Panel>
          }
        >
          <p>
            <code className="font-mono text-sm">defineProducts</code> keeps product IDs as literal types, and{" "}
            <code className="font-mono text-sm">createPaymentClient</code> validates everything immediately: keys, currency
            codes, integer prices and Stripe&apos;s minimums. Mistakes fail at startup, not at checkout.
          </p>
        </StepRow>

        <StepRow
          step="03"
          title="Create a checkout from your API"
          code={
            <>
              <CodeBlock snippet="nextjs/checkout-route#route" filename="app/api/checkout/route.ts" />
              <CodeBlock snippet="01-minimal#checkout" filename="…or call it directly" />
            </>
          }
          visual={
            <div className="space-y-4">
              <Panel title="Customer clicks “Pay $19.99”">
                <FlowDiagram
                  summary="What happens when the customer clicks pay."
                  steps={[
                    { title: "Browser", tag: '{ productId: "pro", quantity: 1 }', icon: "browser", tone: "customer" },
                    { title: "Your API", tag: "POST /api/checkout", icon: "api", tone: "app" },
                    { title: "payments.checkout.create()", detail: "Validates, prices and builds the session", icon: "library", tone: "lib" },
                    { title: "Stripe Checkout Session", tag: "{ id, url }", icon: "stripe", tone: "stripe" },
                    { title: "Stripe-hosted page", detail: "window.location.assign(url)", icon: "card", tone: "stripe" },
                  ]}
                  connectors={[{ label: "fetch()" }, { label: "server-side" }, { label: "secret key used here only" }, { label: "redirect" }]}
                />
              </Panel>
              <Panel title="The browser never controls">
                <ul className="grid grid-cols-2 gap-2 text-sm">
                  {["amount", "currency", "Stripe secret key", "checkout configuration", "redirect URLs", "metadata"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <X className="size-4 shrink-0 text-rose-500" /> {item}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          }
        >
          <p>
            The browser sends only a product ID and quantity. <code className="font-mono text-sm">createCheckoutHandler</code>{" "}
            wraps <code className="font-mono text-sm">payments.checkout.create()</code> in a standard{" "}
            <code className="font-mono text-sm">Request → Response</code> handler with method, origin, content-type and
            body-size checks, and responds <code className="font-mono text-sm">{"{ id, url }"}</code>.
          </p>
        </StepRow>

        <StepRow
          step="04"
          title="Receive verified webhooks"
          code={
            <>
              <CodeBlock snippet="nextjs/webhook-route#route" filename="app/api/webhook/route.ts" />
              <CodeBlock snippet="03-frameworks#webhooks" filename="lib/payments.ts" />
            </>
          }
          visual={
            <Panel title="Stripe → your code, across a security boundary">
              <FlowDiagram
                summary="How a Stripe event reaches your code."
                steps={[
                  { title: "Stripe", tag: "checkout.session.completed", icon: "stripe", tone: "stripe" },
                  { title: "Webhook endpoint", tag: "POST /api/webhook", icon: "api", tone: "app" },
                  { title: "Signature verification", detail: "Raw body + Stripe-Signature + timestamp. Forged or replayed events stop here.", icon: "shield", tone: "lib" },
                  { title: "@ledgerly/payments", detail: "Dedupe (storage), then dispatch", icon: "library", tone: "lib" },
                  { title: "Your callback", tag: "payments.webhooks.on(…)", icon: "app", tone: "app" },
                  { title: "Order fulfilled", icon: "check", tone: "success" },
                ]}
                connectors={[
                  { label: "signed POST", kind: "return" },
                  { label: "raw bytes", kind: "return" },
                  { label: "verified event", kind: "return" },
                  { label: "typed event", kind: "return" },
                  { label: "your business logic", kind: "return" },
                ]}
              />
            </Panel>
          }
        >
          <p>
            Fulfil orders from webhooks, not from the success page: customers can close the tab before the redirect.
            Handlers receive the exact, fully typed Stripe event and run only after the signature is verified.
          </p>
        </StepRow>

        <StepRow
          step="05"
          title="Show the result on your success page"
          code={<CodeBlock snippet="01-minimal#retrieve" filename="app/payment/success/page.tsx" />}
          visual={
            <Panel title="Never trust query parameters">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                The success URL only carries <Chip>session_id</Chip>. <code className="font-mono text-xs">retrieve()</code>{" "}
                checks its format for your environment and fetches the real status and amount from Stripe, so{" "}
                <Chip tone="rose">?amount=1&amp;status=paid</Chip> has no effect.
              </p>
              <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <Lock className="size-4" /> This demo&apos;s success page works exactly this way.
              </p>
            </Panel>
          }
        >
          <p>Stripe redirects to your success URL with the session ID appended automatically.</p>
        </StepRow>
      </div>

      <div className="mt-24">
        <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">From install to payment</h3>
        <p className="mt-2 text-slate-600 dark:text-slate-400">The whole journey in six steps. Select a step to see its code and what happens.</p>
        <JourneyTimeline
          className="mt-8"
          steps={[
            {
              id: "install",
              title: "Install",
              summary: "Install the payment package into your server-side application.",
              panel: <CodeBlock language="shell" code={`npm install ${libraryPackage.name}`} filename="terminal" animate={false} />,
            },
            {
              id: "configure",
              title: "Configure",
              summary: "Declare products and create one client. Configuration is validated immediately.",
              panel: <CodeBlock snippet="01-minimal#setup" filename="lib/payments.ts" animate={false} />,
            },
            {
              id: "checkout",
              title: "Create Checkout",
              summary: "Your API turns { productId, quantity } into a Stripe Checkout Session and returns its URL.",
              panel: <CodeBlock snippet="nextjs/checkout-route#route" filename="app/api/checkout/route.ts" animate={false} />,
            },
            {
              id: "pay",
              title: "Customer Pays",
              summary: "The customer enters card details on Stripe's hosted page, which your servers never see.",
              panel: <StripeCheckoutIllustration />,
            },
            {
              id: "webhook",
              title: "Stripe Webhook",
              summary: "Stripe sends a signed event; the library verifies the signature and replay window before anything runs.",
              panel: <CodeBlock snippet="nextjs/webhook-route#route" filename="app/api/webhook/route.ts" animate={false} />,
            },
            {
              id: "handle",
              title: "Application Handles Payment",
              summary: "Your callback receives a verified, typed payment outcome and fulfils the order.",
              panel: <CodeBlock snippet="04-callbacks-storage#callbacks" wrapInClient filename="lib/payments.ts" animate={false} />,
            },
          ]}
        />
      </div>
    </DocSection>
  );
}

/** Clearly-labelled illustration of Stripe's hosted page (not a working form). */
export function StripeCheckoutIllustration() {
  return (
    <figure className="mx-auto max-w-sm">
      <div aria-hidden="true" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono">checkout.stripe.com</span>
          <Lock className="size-3.5 text-emerald-600" />
        </div>
        <p className="mt-4 text-sm text-slate-500">Pro</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">$19.99</p>
        <div className="mt-4 space-y-2">
          <div className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300">4242 4242 4242 4242</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-500 dark:border-slate-700">12 / 34</div>
            <div className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-500 dark:border-slate-700">123</div>
          </div>
        </div>
        <div className="mt-4 flex h-10 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white animate-press">Pay $19.99</div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
        Illustration of Stripe&apos;s hosted page. Try the real one in <a className="font-medium text-indigo-600 underline dark:text-indigo-400" href="#real-stripe-test">Real Stripe test</a> (optional).
      </figcaption>
    </figure>
  );
}
