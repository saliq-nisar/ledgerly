import { Plus } from "@/components/ui/icons";
import { Container, SectionHeading } from "@/components/ui/layout";

const FAQS = [
  {
    q: "Do I need to install or import the Stripe SDK?",
    a: "No. Install @ledgerly/payments only. The official stripe package is its single runtime dependency and is used internally; your application never creates a Stripe client or touches the secret key directly.",
  },
  {
    q: "Does it only work with Next.js?",
    a: "No. The core has no framework dependency. The /web handlers use standard Request/Response (Next.js, Hono, Remix, SvelteKit, Astro, Bun, Deno), and Express works through payments.webhooks.handle().",
  },
  {
    q: "Will I be charged real money?",
    a: "No. The demo runs with PAYMENTS_ENVIRONMENT=test, where the library only accepts sk_test_ keys, and test mode never moves real money. Out of the box it ships with placeholder keys, so checkout stays disabled until you add your own test-mode credentials.",
  },
  {
    q: "Which card should I use for testing?",
    a: "Use 4242 4242 4242 4242 with any future expiry date, any 3-digit CVC and any postal code. Stripe documents more test cards for declines, 3D Secure and other scenarios.",
  },
  {
    q: "Why does the browser only send a product ID?",
    a: "If the browser could send an amount, anyone could edit the request and pay $0.01. The server looks up the price from its own catalog, so the amount charged is always what you configured.",
  },
  {
    q: "Is the success page enough to confirm a payment?",
    a: "No. Customers can close the tab before the redirect, and URLs can be visited directly. Fulfil orders from the signed checkout.session.completed webhook; the success page is only for the customer's benefit.",
  },
  {
    q: "Does this app store card details?",
    a: "Never. Card details are entered on Stripe's hosted checkout page and go directly to Stripe. The app only sees Stripe IDs and payment status.",
  },
  {
    q: "What do I need to change for production?",
    a: "Set PAYMENTS_ENVIRONMENT=production with a live key from a secrets manager, use an https APP_URL, register an HTTPS webhook endpoint, plug in durable storage for webhook deduplication, fulfil orders idempotently from webhooks, and add rate limiting and monitoring. The library README has the full checklist.",
  },
] as const;

export function FAQ() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-32 bg-slate-50 py-20 sm:py-28 dark:bg-slate-900/40"
    >
      <Container className="max-w-3xl">
        <SectionHeading id="faq-title" eyebrow="FAQ" title="Frequently asked questions" />
        <div className="mt-12 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-6 py-5 font-medium text-slate-900 transition-colors hover:text-indigo-600 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 dark:text-white dark:hover:text-indigo-400 [&::-webkit-details-marker]:hidden">
                {q}
                <Plus className="size-5 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-45" />
              </summary>
              <p className="px-6 pb-5 leading-relaxed text-slate-600 dark:text-slate-400">{a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
