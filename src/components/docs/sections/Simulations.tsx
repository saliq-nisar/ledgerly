import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocSection } from "@/components/docs/DocSection";
import { Simulator, type SimStep } from "@/components/docs/Simulator";
import { StripeCheckoutIllustration } from "@/components/docs/sections/QuickStart";

/* ----------------------------------------------------------- payment flow */

const FRONTEND_FETCH = `// Your frontend: no payment library, no secrets in the browser
const res = await fetch("/api/checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ productId: "pro", quantity: 1 }),
});
const { url } = await res.json();`;

const REQUEST_BODY = `POST /api/checkout
Content-Type: application/json

{ "productId": "pro", "quantity": 1 }   // the only two fields accepted`;

const PARSE = `// Inside createCheckoutHandler (you can also call it yourself):
const input = payments.checkout.parse(body);
// → { productId: "pro", quantity: 1 }
// Any other field (amount, price, currency, …) throws unexpected_field.`;

const REDIRECT = `// Your frontend, after the API responds { id, url }
window.location.assign(url); // https://checkout.stripe.com/c/pay/cs_test_…`;

const HANDLE = `// Inside createWebhookHandler: raw bytes, never parsed JSON
const result = await payments.webhooks.handle(
  rawBody,
  request.headers.get("stripe-signature"),
);
// → { eventId, eventType, outcome: "processed" | "ignored" | "duplicate" }`;

const EVENT = `// Sent by Stripe (abridged), signed with your webhook secret
POST /api/webhook
Stripe-Signature: t=1727…,v1=5257a8…

{ "id": "evt_…", "type": "checkout.session.completed",
  "data": { "object": { "id": "cs_test_…", "payment_status": "paid",
    "metadata": { "productId": "pro", "quantity": "1" } } } }`;

const PAYMENT_STEPS: readonly SimStep[] = [
  { title: "Customer clicks Pay", actor: "Browser", detail: "Your UI shows Pay $19.99 for the Pro plan. The browser knows the price only for display.", icon: "customer", tone: "customer" },
  { title: "Browser sends productId + quantity", actor: "Browser → your API", detail: "Only two fields cross the network. No amount, currency or Stripe parameters.", tag: '{ productId: "pro", quantity: 1 }', icon: "browser", tone: "customer" },
  { title: "Application API receives request", actor: "Your server", detail: "A one-line route built with createCheckoutHandler checks method, origin, content type and body size.", icon: "api", tone: "app" },
  { title: "@ledgerly/payments validates request", actor: "Library", detail: "Unknown fields are rejected, the product must exist and be active, and the quantity must be within limits.", tag: "payments.checkout.parse(body)", icon: "shield", tone: "lib" },
  { title: "Price resolved from server configuration", actor: "Library", detail: "1999 × 1 = 1999 cents, from your catalog, in integer arithmetic.", tag: "catalog → 1999 usd", icon: "db", tone: "lib" },
  { title: "Checkout Session created", actor: "Library → Stripe API", detail: "Explicit Stripe parameters; the secret key is used only here, on the server.", tag: "payments.checkout.create()", icon: "library", tone: "lib" },
  { title: "Customer goes to Stripe Checkout", actor: "Browser", detail: "The API returns { id, url } and the browser redirects to Stripe's hosted page.", icon: "stripe", tone: "stripe" },
  { title: "Customer completes payment", actor: "Stripe", detail: "Card details go directly to Stripe and never touch your servers.", icon: "card", tone: "stripe" },
  { title: "Stripe sends webhook", actor: "Stripe → your API", detail: "A signed checkout.session.completed event is POSTed to your webhook route.", tag: "checkout.session.completed", icon: "webhook", tone: "stripe" },
  { title: "Webhook signature verified", actor: "Library", detail: "HMAC over the exact raw bytes plus a 5-minute replay window. Forged or modified events stop here.", icon: "lock", tone: "lib" },
  { title: "Application callback executes", actor: "Your code", detail: "onPaymentSucceeded receives a typed, normalized PaymentOutcome.", tag: "onPaymentSucceeded(payment)", icon: "app", tone: "app" },
  { title: "Order / payment completed", actor: "Your code", detail: "You fulfil the order. The success page shows the status fetched from Stripe.", icon: "check", tone: "success" },
];

export function PaymentFlowSimulation() {
  const panels = [
    <CodeBlock key="1" code={FRONTEND_FETCH} filename="your frontend" animate={false} source="Plain fetch(); the library never runs in the browser" />,
    <CodeBlock key="2" code={REQUEST_BODY} language="shell" filename="HTTP request" animate={false} source="What actually crosses the network" />,
    <CodeBlock key="3" snippet="nextjs/checkout-route#route" filename="app/api/checkout/route.ts" animate={false} />,
    <CodeBlock key="4" code={PARSE} filename="validation" animate={false} source="Public API: payments.checkout.parse()" />,
    <CodeBlock key="5" snippet="01-minimal#setup" filename="lib/payments.ts" animate={false} />,
    <CodeBlock key="6" snippet="01-minimal#checkout" filename="checkout" animate={false} />,
    <CodeBlock key="7" code={REDIRECT} filename="your frontend" animate={false} source="Redirect to the URL returned by the API" />,
    <StripeCheckoutIllustration key="8" />,
    <CodeBlock key="9" snippet="nextjs/webhook-route#route" filename="app/api/webhook/route.ts" animate={false} />,
    <CodeBlock key="10" code={HANDLE} filename="verification" animate={false} source="Public API: payments.webhooks.handle()" />,
    <CodeBlock key="11" snippet="04-callbacks-storage#callbacks" wrapInClient filename="lib/payments.ts" animate={false} />,
    <CodeBlock key="12" snippet="01-minimal#retrieve" filename="success page" animate={false} />,
  ];
  return (
    <DocSection
      id="simulation"
      eyebrow="Interactive demo"
      title="Watch one payment travel through your app"
      description="Press play to step through all twelve stages of a real integration. Each step shows the code that runs at that moment. No Stripe keys are needed: this is an animation of the documented flow."
      tinted
    >
      <Simulator
        steps={PAYMENT_STEPS}
        panels={panels}
        playLabel="Play Payment Flow"
        disclaimer="Interactive architecture simulation. No real payment is being processed."
        completeDetail="The customer paid, Stripe notified your server, the signature was verified, and your callback fulfilled the order."
      />
    </DocSection>
  );
}

/* ---------------------------------------------------------------- webhook */

const WEBHOOK_STEPS: readonly SimStep[] = [
  { title: "Stripe", actor: "Stripe", detail: "A payment completes on Stripe Checkout.", icon: "stripe", tone: "stripe" },
  { title: "checkout.session.completed", actor: "Signed event", detail: "Stripe POSTs the event with a Stripe-Signature header.", tag: "checkout.session.completed", icon: "webhook", tone: "stripe" },
  { title: "Webhook endpoint", actor: "Your route", detail: "createWebhookHandler reads the raw body (1 MiB limit) and the signature header.", icon: "api", tone: "app" },
  { title: "Signature verification", actor: "Library", detail: "Invalid, modified or replayed events get a 400, and none of your code runs.", icon: "lock", tone: "lib" },
  { title: "@ledgerly/payments", actor: "Library", detail: "Storage skips duplicates, then your on() handlers run, then the matching callback.", icon: "library", tone: "lib" },
  { title: "onPaymentSucceeded", actor: "Your callback", detail: "A typed PaymentOutcome: product, quantity, amount, currency, email, clientReferenceId, metadata.", tag: "onPaymentSucceeded(payment)", icon: "app", tone: "app" },
  { title: "Your application", actor: "Your code", detail: "Fulfil the order; the endpoint answers 200 and Stripe stops retrying.", icon: "check", tone: "success" },
];

export function WebhookSimulation() {
  const panels = [
    <CodeBlock key="1" code={EVENT} language="shell" filename="incoming request" animate={false} source="Illustrative event" />,
    <CodeBlock key="2" code={EVENT} language="shell" filename="incoming request" animate={false} source="Illustrative event" />,
    <CodeBlock key="3" snippet="nextjs/webhook-route#route" filename="app/api/webhook/route.ts" animate={false} />,
    <CodeBlock key="4" code={HANDLE} filename="verification" animate={false} source="Public API: payments.webhooks.handle()" />,
    <CodeBlock key="5" snippet="04-callbacks-storage#storage" wrapInClient filename="storage (deduplication)" animate={false} />,
    <CodeBlock key="6" snippet="04-callbacks-storage#callbacks" wrapInClient filename="lib/payments.ts" animate={false} />,
    <CodeBlock key="7" snippet="03-frameworks#webhooks" filename="or: raw typed events" animate={false} />,
  ];
  return (
    <Simulator
      steps={WEBHOOK_STEPS}
      panels={panels}
      playLabel="Simulate Webhook"
      disclaimer="Simulated event. No Stripe request was sent."
      completeDetail="The event was verified and deduplicated, and onPaymentSucceeded ran exactly once."
      stepMs={1100}
    />
  );
}
