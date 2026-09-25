import type { ComponentType, SVGProps } from "react";

import {
  Alert as AlertIcon,
  Card,
  Chart,
  Code,
  Database,
  Globe,
  Lock,
  Server,
  Shield,
  Webhook,
  Zap,
} from "@/components/ui/icons";
import { Container } from "@/components/ui/layout";

const ITEMS: readonly { title: string; body: string; href: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { title: "Products", body: "Typed catalog, integer prices", href: "#products", icon: Database },
  { title: "Checkout", body: "One call → Stripe session", href: "#simulation", icon: Card },
  { title: "Customization", body: "Client → product → call", href: "#customization", icon: Code },
  { title: "Metadata", body: "Allow-lists & safety rules", href: "#playground", icon: Server },
  { title: "Redirects", body: "Same-origin, no open redirects", href: "#playground", icon: Globe },
  { title: "Webhooks", body: "Signature + replay window", href: "#webhooks", icon: Webhook },
  { title: "Callbacks", body: "onPaymentSucceeded & friends", href: "#webhooks", icon: Zap },
  { title: "Errors", body: "Typed, safe to display", href: "#errors", icon: AlertIcon },
  { title: "Security", body: "Browser sends 2 fields only", href: "#security", icon: Shield },
  { title: "Storage", body: "Plug in any database", href: "#webhooks", icon: Database },
  { title: "Logging", body: "Your logger, always redacted", href: "#webhooks", icon: Lock },
  { title: "Monitoring", body: "Provider-agnostic hooks", href: "#webhooks", icon: Chart },
];

export function WhatYouGet() {
  return (
    <section id="what-you-get" aria-labelledby="wyg-title" className="scroll-mt-32 border-y border-slate-200 bg-slate-50 py-16 sm:py-20 dark:border-slate-800 dark:bg-slate-900/40">
      <Container>
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">What you get</p>
        <h2 id="wyg-title" className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          A small API that covers the whole payment lifecycle
        </h2>
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {ITEMS.map(({ title, body, href, icon: Icon }, i) => (
            <li key={title}>
              <a
                href={href}
                className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-900/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/50"
              >
                {/* Tiny 2D illustration: a packet travelling into the feature's node. */}
                <span aria-hidden="true" className="relative flex h-10 items-center">
                  <span className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-500/20">
                    <span className="wyg-packet absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-indigo-500" style={{ animationDelay: `${(i % 6) * 0.35}s` }} />
                  </span>
                  <span className="ml-1 inline-flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-500/15 dark:text-indigo-300">
                    <Icon className="size-4" />
                  </span>
                </span>
                <span className="mt-3 font-semibold text-slate-900 dark:text-white">{title}</span>
                <span className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">{body}</span>
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
