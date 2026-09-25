"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { InView } from "@/components/docs/InView";
import { cn } from "@/lib/utils";

export interface JourneyStep {
  id: string;
  title: string;
  summary: string;
  /** Server-rendered code or visual. */
  panel: ReactNode;
}

/**
 * Vertical step list (tabs pattern with vertical orientation). Steps fade in
 * when scrolled into view; selecting one reveals its code + explanation.
 */
export function JourneyTimeline({ steps, className }: { steps: readonly JourneyStep[]; className?: string }) {
  const [selected, setSelected] = useState(0);
  const baseId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const step = steps[selected]!;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: steps.length - 1 };
    const target = keys[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = (target + steps.length) % steps.length;
    setSelected(next);
    refs.current[next]?.focus();
  }

  return (
    <div className={cn("grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]", className)}>
      <InView className="reveal-lines">
        <div role="tablist" aria-orientation="vertical" aria-label="Integration steps" className="relative">
          <span aria-hidden="true" className="absolute bottom-6 left-[1.35rem] top-6 w-0.5 bg-slate-200 dark:bg-slate-800" />
          <span
            aria-hidden="true"
            className="absolute bottom-6 left-[1.35rem] top-6 w-0.5 origin-top bg-indigo-500 transition-transform duration-500"
            style={{ transform: `scaleY(${selected / Math.max(steps.length - 1, 1)})` }}
          />
          {steps.map((s, i) => (
            <button
              key={s.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${s.id}`}
              aria-selected={i === selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={i === selected ? 0 : -1}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className="code-line relative flex w-full items-center gap-4 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:bg-slate-800/60"
              style={{ ["--i" as string]: i * 2 }}
            >
              <span
                className={cn(
                  "relative z-10 inline-flex size-9 shrink-0 items-center justify-center rounded-full border-2 font-mono text-xs font-bold transition-colors",
                  i < selected && "border-indigo-500 bg-indigo-500 text-white",
                  i === selected && "border-indigo-600 bg-white text-indigo-600 ring-4 ring-indigo-500/20 dark:bg-slate-950 dark:text-indigo-300",
                  i > selected && "border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={cn("font-semibold", i === selected ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400")}>{s.title}</span>
            </button>
          ))}
        </div>
      </InView>

      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${step.id}`}
        className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <p className="font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          {String(selected + 1).padStart(2, "0")} — {step.title}
        </p>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{step.summary}</p>
        <div key={step.id} className="mt-5 animate-fade-up">
          {step.panel}
        </div>
      </div>
    </div>
  );
}
