"use client";

import { useEffect, useRef, useState } from "react";

import { Check } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** Copies text to the clipboard. The code is never executed. */
export function CopyButton({ text, label = "code", className }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400",
          className,
        )}
      >
        {state === "copied" ? <Check className="size-3.5 text-emerald-400" /> : <CopyIcon />}
        {state === "copied" ? "Copied!" : state === "failed" ? "Copy failed" : "Copy"}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied" ? `${label} copied to clipboard` : state === "failed" ? "Copy failed" : ""}
      </span>
    </>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-3.5" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
    </svg>
  );
}
