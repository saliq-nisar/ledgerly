"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { usePrefersReducedMotion } from "@/components/docs/useReducedMotion";

/**
 * Sets data-reveal="pending" | "in" on a wrapper so CSS can animate children
 * once they scroll into view. Without JavaScript (or with reduced motion)
 * content is simply visible — nothing is ever hidden permanently.
 */
export function InView({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const [state, setState] = useState<"pending" | "in">("pending");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setState("in");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-reveal={reduced ? "in" : state} className={className}>
      {children}
    </div>
  );
}

/** Hook variant for components that animate while visible. */
export function useInView<T extends Element>(rootMargin = "-10% 0px -10% 0px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { rootMargin });
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);
  return { ref, inView };
}
