import { Code, Globe, Zap } from "@/components/ui/icons";
import { Container } from "@/components/ui/layout";

const CARDS = [
  {
    icon: Globe,
    title: "Your application",
    body: "Your business logic stays in your application: accounts, orders, fulfilment, emails.",
    owns: ["UI & routes", "Order database", "Fulfilment"],
    tone: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    icon: Code,
    title: "@ledgerly/payments",
    body: "Pricing, checkout configuration, validation, security and webhook handling are centralized in the payment library.",
    owns: ["Product catalog & prices", "Validation & policies", "Signature verification"],
    tone: "bg-indigo-600 text-white",
  },
  {
    icon: Zap,
    title: "Stripe",
    body: "Stripe handles payment processing and the hosted Checkout page where customers enter card details.",
    owns: ["Hosted Checkout", "Card processing", "Signed events"],
    tone: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  },
];

export function WhatIs() {
  return (
    <section aria-labelledby="what-title" className="border-y border-slate-200 bg-slate-50 py-16 sm:py-20 dark:border-slate-800 dark:bg-slate-900/40">
      <Container>
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">What is this?</p>
          <h2 id="what-title" className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            A thin, secure layer between your app and Stripe
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            You call a few typed functions. The library turns them into validated Stripe requests and turns Stripe&apos;s
            signed events back into typed callbacks.
          </p>
        </div>

        <ol className="mt-12 grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
          {CARDS.map(({ icon: Icon, title, body, owns, tone }, i) => (
            <li key={title} className="contents">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <span className={`inline-flex size-11 items-center justify-center rounded-xl ${tone}`}>
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {owns.map((item) => (
                    <li key={item} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              {i < CARDS.length - 1 && (
                <div aria-hidden="true" className="flex items-center justify-center py-1 lg:px-1 lg:py-0">
                  <span className="link-line relative block h-8 w-0.5 overflow-hidden rounded-full bg-indigo-200 lg:h-0.5 lg:w-10 dark:bg-indigo-500/30" />
                </div>
              )}
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
