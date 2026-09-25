"use client";

import { useEffect, useState } from "react";

import { useInView } from "@/components/docs/InView";
import { usePrefersReducedMotion } from "@/components/docs/useReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Grouped pipeline: each group (e.g. "@ledgerly/payments") lists ordered
 * sub-steps that light up one after another. Used for "under the hood".
 */

export interface PipelineGroup {
  title: string;
  caption?: string;
  tone: "app" | "lib" | "stripe" | "success";
  steps?: readonly { label: string; detail: string; code?: string }[];
  /** Label on the arrow leading to the next group. */
  next?: string;
}

const TONE = {
  app: "border-violet-300 dark:border-violet-500/40",
  lib: "border-indigo-400 dark:border-indigo-500/60",
  stripe: "border-sky-300 dark:border-sky-500/40",
  success: "border-emerald-300 dark:border-emerald-500/50",
} as const;

const HEADER = {
  app: "bg-violet-50 text-violet-800 dark:bg-violet-500/10 dark:text-violet-200",
  lib: "bg-indigo-600 text-white",
  stripe: "bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200",
  success: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200",
} as const;

export function Pipeline({ groups, summary, stepMs = 700 }: { groups: readonly PipelineGroup[]; summary: string; stepMs?: number }) {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  // Flatten to one timeline: every group header and every sub-step is a tick.
  const ticks = groups.flatMap((g, gi) => [{ gi, si: -1 }, ...(g.steps ?? []).map((_, si) => ({ gi, si }))]);
  const [tick, setTick] = useState(0);
  const last = ticks.length - 1;

  useEffect(() => {
    if (reduced || !inView) return;
    const timer = window.setTimeout(() => setTick((t) => (t >= last ? 0 : t + 1)), tick >= last ? 3000 : stepMs);
    return () => window.clearTimeout(timer);
  }, [tick, inView, reduced, last, stepMs]);

  const current = reduced ? ticks[last]! : ticks[tick]!;
  const reached = (gi: number, si: number) => reduced || gi < current.gi || (gi === current.gi && si <= current.si);

  return (
    <div ref={ref}>
      <div className="sr-only">
        <p>{summary}</p>
        <ol>
          {groups.map((g) => (
            <li key={g.title}>
              {g.title}
              {g.caption ? ` — ${g.caption}` : ""}
              {g.steps && (
                <ol>
                  {g.steps.map((s) => (
                    <li key={s.label}>
                      {s.label}: {s.detail}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      </div>

      <ol aria-hidden="true" className="space-y-0">
        {groups.map((group, gi) => {
          const groupReached = reached(gi, -1);
          return (
            <li key={group.title}>
              <div className={cn("overflow-hidden rounded-2xl border-2 bg-white transition-opacity duration-500 dark:bg-slate-900", TONE[group.tone], !groupReached && "opacity-50")}>
                <div className={cn("flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5", HEADER[group.tone])}>
                  <p className="font-semibold">{group.title}</p>
                  {group.caption && <p className="text-xs opacity-80">{group.caption}</p>}
                </div>
                {group.steps && (
                  <ol className="grid gap-px bg-slate-100 sm:grid-cols-2 dark:bg-slate-800">
                    {group.steps.map((step, si) => {
                      const done = reached(gi, si);
                      const active = !reduced && current.gi === gi && current.si === si;
                      return (
                        <li
                          key={step.label}
                          className={cn(
                            "flex gap-3 bg-white px-4 py-3 transition-colors duration-300 dark:bg-slate-900",
                            active && "bg-indigo-50 dark:bg-indigo-500/10",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold transition-colors duration-300",
                              done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
                              active && "bg-indigo-600 ring-4 ring-indigo-500/20",
                            )}
                          >
                            {done && !active ? "✓" : si + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{step.label}</p>
                            <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">{step.detail}</p>
                            {step.code && <code className="mt-1 inline-block font-mono text-[11px] text-indigo-600 dark:text-indigo-300">{step.code}</code>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
              {gi < groups.length - 1 && (
                <div className="flex items-center gap-3 py-2 pl-8">
                  <span className="relative block h-8 w-0.5 rounded-full bg-indigo-200 dark:bg-indigo-500/30">
                    {!reduced && current.gi === gi + 1 && current.si === -1 && (
                      <span key={tick} className="flow-dot absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20" style={{ animationDuration: `${stepMs}ms` }} />
                    )}
                  </span>
                  {group.next && <span className="font-mono text-xs text-slate-500 dark:text-slate-400">↓ {group.next}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
