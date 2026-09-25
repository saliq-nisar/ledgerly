import Link from "next/link";

import { LogoMark } from "@/components/ui/icons";
import { Container } from "@/components/ui/layout";

const COLUMNS = [
  {
    title: "Library",
    links: [
      { href: "/#use-in-your-app", label: "Install" },
      { href: "/#products", label: "Products" },
      { href: "/#customization", label: "Customization" },
      { href: "/#api", label: "API concepts" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/#simulation", label: "Payment flow simulation" },
      { href: "/#security", label: "Security" },
      { href: "/#webhooks", label: "Webhooks" },
      { href: "/#frameworks", label: "Frameworks" },
    ],
  },
  {
    title: "Demo",
    links: [
      { href: "/#real-stripe-test", label: "Real Stripe test (optional)" },
      { href: "/checkout", label: "Checkout" },
      { href: "/payment/success?demo=1", label: "Success (demo preview)" },
      { href: "/payment/cancelled", label: "Cancelled" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500">
            <LogoMark className="size-7" />
            Ledgerly
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Interactive documentation and live demo for @ledgerly/payments, a secure TypeScript layer over Stripe Checkout. Test mode only.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{col.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="rounded text-sm text-slate-600 transition-colors hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-400 dark:hover:text-indigo-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <div className="border-t border-slate-200 dark:border-slate-800">
        <Container className="flex flex-col gap-2 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-500">
          <p>© {new Date().getFullYear()} Ledgerly Demo. For educational purposes.</p>
          <p>Payments powered by Stripe in test mode. Not affiliated with Stripe, Inc.</p>
        </Container>
      </div>
    </footer>
  );
}
