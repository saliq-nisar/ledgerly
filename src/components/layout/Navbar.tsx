"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { ThemeToggle } from "@/components/layout/theme";
import { buttonClasses } from "@/components/ui/button";
import { LogoMark, Menu, X } from "@/components/ui/icons";
import { Container } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/#use-in-your-app", label: "Integrate" },
  { href: "/#simulation", label: "Simulation" },
  { href: "/#customization", label: "Customize" },
  { href: "/#security", label: "Security" },
  { href: "/#api", label: "API" },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const pathname = usePathname();

  // Close the mobile menu after navigation or when Escape is pressed.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-lg dark:border-slate-800/70 dark:bg-slate-950/80">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500"
        >
          <LogoMark className="size-8" />
          <span className="text-lg">Ledgerly</span>
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            Demo
          </span>
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <span className="hidden sm:block">
            <Link href="/#use-in-your-app" className={buttonClasses("primary", "md", "whitespace-nowrap")}>
              Get started
            </Link>
          </span>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </Container>

      <nav
        id={menuId}
        aria-label="Mobile"
        className={cn("border-t border-slate-200 md:hidden dark:border-slate-800", !open && "hidden")}
      >
        <Container className="py-3">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <Link href="/#use-in-your-app" onClick={() => setOpen(false)} className={buttonClasses("primary", "lg", "w-full")}>
                Get started
              </Link>
            </li>
          </ul>
        </Container>
      </nav>
    </header>
  );
}
