import libraryPackage from "@ledgerly/payments/package.json";

import { CopyButton } from "@/components/docs/CopyButton";
import { FlowDiagram } from "@/components/docs/FlowDiagram";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRight } from "@/components/ui/icons";
import { Container } from "@/components/ui/layout";

const INSTALL = `npm install ${libraryPackage.name}`;
const BADGES = [`v${libraryPackage.version}`, "TypeScript", "Stripe Checkout", "Server-side", "Framework-independent"];

export function HeroDocs() {
  return (
    <section id="overview" aria-labelledby="hero-title" className="relative scroll-mt-32 overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[34rem] w-[60rem] -translate-x-1/2 rounded-full bg-linear-to-br from-indigo-400/25 via-violet-400/15 to-sky-300/15 blur-3xl dark:from-indigo-600/20 dark:via-violet-600/10 dark:to-sky-500/10" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(148_163_184/0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgb(148_163_184/0.1)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
      </div>

      <Container className="grid items-center gap-12 pb-16 pt-14 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:pb-24">
        <div className="min-w-0 animate-fade-up">
          <ul className="flex flex-wrap gap-2" aria-label="Package facts">
            {BADGES.map((badge) => (
              <li
                key={badge}
                className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300"
              >
                {badge}
              </li>
            ))}
          </ul>
          <h1 id="hero-title" className="mt-6 font-mono text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
            <span className="bg-linear-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-sky-300">
              @ledgerly
            </span>
            /payments
          </h1>
          <p className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Secure, customizable Stripe Checkout for TypeScript applications.
          </p>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            Define products on your server, create checkouts with one call, and receive verified, typed webhooks. Prices,
            secrets and validation never reach the browser.
          </p>

          <div className="mt-7 flex max-w-xl items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 py-2 pl-4 pr-2 shadow-lg">
            <code className="min-w-0 truncate font-mono text-sm text-slate-200">
              <span className="select-none text-slate-500">$ </span>
              {INSTALL}
            </code>
            <CopyButton text={INSTALL} label="install command" />
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="#use-in-your-app" size="lg">
              Integrate it <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink href="#simulation" size="lg" variant="secondary">
              Play the payment flow
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Everything on this page works without Stripe credentials. A{" "}
            <a href="#real-stripe-test" className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">
              real Stripe test
            </a>{" "}
            is optional.
          </p>
        </div>

        <div className="min-w-0 rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-2xl shadow-indigo-900/10 backdrop-blur sm:p-6 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-black/30">
          <p className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Architecture
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal text-slate-500 dark:bg-slate-800">
              illustration
            </span>
          </p>
          <FlowDiagram
            summary="The architecture: your app calls @ledgerly/payments, which creates a Stripe Checkout session; Stripe sends a webhook that the library verifies before your app handles it."
            steps={[
              { title: "Your App", detail: "Next.js · Hono · Express · any Node server", icon: "app", tone: "app" },
              { title: "@ledgerly/payments", detail: "Products · validation · checkout · security", icon: "library", tone: "lib" },
              { title: "Stripe Checkout", detail: "Customer pays on Stripe's hosted page", icon: "stripe", tone: "stripe" },
              { title: "Webhook", detail: "Signed event, verified by the library", icon: "webhook", tone: "lib" },
              { title: "Your App", detail: "Typed callback: fulfil the order", icon: "check", tone: "success" },
            ]}
            connectors={[
              { label: "payments.checkout.create()" },
              { label: "redirect to Stripe" },
              { label: "checkout.session.completed", kind: "return" },
              { label: "onPaymentSucceeded(payment)", kind: "return" },
            ]}
          />
        </div>
      </Container>
    </section>
  );
}
