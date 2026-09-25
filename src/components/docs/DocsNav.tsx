"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export const DOC_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "what-you-get", label: "What you get" },
  { id: "use-in-your-app", label: "Integrate" },
  { id: "simulation", label: "Simulation" },
  { id: "products", label: "Products" },
  { id: "customization", label: "Customization" },
  { id: "security", label: "Security" },
  { id: "webhooks", label: "Webhooks" },
  { id: "errors", label: "Errors" },
  { id: "frameworks", label: "Frameworks" },
  { id: "real-stripe-test", label: "Real Stripe test" },
  { id: "api", label: "API" },
] as const;

/** Sticky section navigation with scroll-spy highlighting. */
export function DocsNav() {
  const [active, setActive] = useState<string>(DOC_SECTIONS[0].id);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    // Active = the last section whose top has scrolled past a reading line just
    // below the two sticky bars. Throttled to one check per animation frame.
    const READING_LINE = 160;
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string = DOC_SECTIONS[0].id;
      for (const section of DOC_SECTIONS) {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top <= READING_LINE) current = section.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // Keep the active link visible in the horizontally scrolling bar.
  useEffect(() => {
    const link = listRef.current?.querySelector<HTMLAnchorElement>(`a[href="#${active}"]`);
    const list = listRef.current;
    if (link && list) {
      const left = link.offsetLeft - list.clientWidth / 2 + link.clientWidth / 2;
      list.scrollTo({ left, behavior: "smooth" });
    }
  }, [active]);

  return (
    <nav
      aria-label="Documentation sections"
      className="sticky top-16 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-lg dark:border-slate-800/70 dark:bg-slate-950/85"
    >
      <ul ref={listRef} className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8 [scrollbar-width:none]">
        {DOC_SECTIONS.map((section) => {
          const isActive = section.id === active;
          return (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "block rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500",
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
                )}
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
