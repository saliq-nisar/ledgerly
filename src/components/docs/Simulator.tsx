"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

import type { FlowIcon, FlowTone } from "@/components/docs/FlowDiagram";
import { usePrefersReducedMotion } from "@/components/docs/useReducedMotion";
import {
  Alert,
  Card,
  Check,
  Code,
  Database,
  Globe,
  Lock,
  Network,
  Play,
  Refresh,
  Server,
  Shield,
  Smartphone,
  User,
  Webhook,
  X,
  Zap,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * Button-driven, clearly-labelled simulation of a flow. Nothing here talks to
 * Stripe or the server: it only animates the documented sequence and shows the
 * real library code for each step (server-rendered panels passed in as props).
 */

const ICONS = {
  app: Globe, browser: Smartphone, customer: User, api: Server, library: Code, stripe: Zap, network: Network,
  webhook: Webhook, shield: Shield, lock: Lock, check: Check, blocked: X, alert: Alert, db: Database, card: Card,
} as const satisfies Record<FlowIcon, unknown>;

const TONE: Record<FlowTone, string> = {
  app: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  lib: "bg-indigo-600 text-white",
  stripe: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  customer: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  success: "bg-emerald-500 text-white",
  danger: "bg-rose-500 text-white",
  neutral: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};

export interface SimStep {
  title: string;
  detail: string;
  /** Who performs the step, shown as a small label. */
  actor?: string;
  tag?: string;
  icon: FlowIcon;
  tone: FlowTone;
}

interface SimulatorProps {
  steps: readonly SimStep[];
  /** Optional per-step panels (e.g. the real code for that step). Index-aligned with steps. */
  panels?: readonly ReactNode[];
  playLabel: string;
  /** Always-visible disclaimer, e.g. "no real payment is being processed". */
  disclaimer: string;
  completeTitle?: string;
  completeDetail?: string;
  stepMs?: number;
}

export function Simulator({
  steps,
  panels,
  playLabel,
  disclaimer,
  completeTitle = "Simulation Complete",
  completeDetail,
  stepMs = 1400,
}: SimulatorProps) {
  const reduced = usePrefersReducedMotion();
  const [current, setCurrent] = useState(-1); // -1 = not started
  const [playing, setPlaying] = useState(false);
  const last = steps.length - 1;
  const done = current === last && !playing;
  const id = useId();

  useEffect(() => {
    if (!playing || current >= last) return;
    const timer = window.setTimeout(() => {
      const next = current + 1;
      setCurrent(next);
      if (next >= last) setPlaying(false);
    }, current < 0 ? 150 : stepMs);
    return () => window.clearTimeout(timer);
  }, [playing, current, last, stepMs]);

  function play() {
    if (reduced) {
      // No animation: show the completed flow; every step stays inspectable.
      setCurrent(last);
      setPlaying(false);
      return;
    }
    setCurrent(-1);
    setPlaying(true);
  }

  const shown = current < 0 ? 0 : current;
  const step = steps[shown]!;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
        <p className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
          <span className="rounded-md bg-amber-200 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900 dark:bg-amber-500/25 dark:text-amber-200">
            Simulation
          </span>
          {disclaimer}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={play}
            disabled={playing}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60"
          >
            <Play className="size-4" /> {current >= 0 && !playing ? "Replay" : playLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setCurrent((c) => Math.min(c + 1, last));
            }}
            disabled={current >= last}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Next step
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setCurrent(-1);
            }}
            aria-label="Reset simulation"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <Refresh className="size-4" />
          </button>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {current < 0 ? "" : done ? `${completeTitle}. ${completeDetail ?? ""}` : `Step ${current + 1} of ${steps.length}: ${steps[current]?.title}`}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <ol className="border-b border-slate-200 p-4 sm:p-5 lg:border-b-0 lg:border-r dark:border-slate-800" aria-label="Simulation steps">
          {steps.map((s, i) => {
            const Icon = ICONS[s.icon];
            const reached = current >= i;
            const active = current === i;
            return (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setCurrent(i);
                  }}
                  aria-current={active ? "step" : undefined}
                  aria-controls={`${id}-panel`}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl px-2 py-1.5 text-left transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-indigo-500",
                    active ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                  )}
                >
                  <span
                    className={cn(
                      "relative mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-300",
                      reached ? TONE[s.tone] : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
                    )}
                  >
                    {active && playing && <span aria-hidden="true" className="absolute inset-0 rounded-lg bg-indigo-400/30 animate-ripple" />}
                    <Icon className="relative size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-sm font-medium", reached ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400")}>
                      <span className="mr-1.5 font-mono text-xs text-slate-400">{String(i + 1).padStart(2, "0")}</span>
                      {s.title}
                    </span>
                    {s.actor && <span className="block text-[11px] text-slate-500 dark:text-slate-400">{s.actor}</span>}
                  </span>
                </button>
                {i < last && (
                  <span aria-hidden="true" className="relative ml-[1.35rem] block h-2.5 w-0.5 bg-slate-200 dark:bg-slate-700">
                    {playing && current === i + 1 && (
                      <span key={current} className="flow-dot absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500" style={{ animationDuration: "400ms" }} />
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <div id={`${id}-panel`} className="min-w-0 p-4 sm:p-6">
          {done ? (
            <div className="animate-fade-up rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50 p-5 dark:border-emerald-500/50 dark:bg-emerald-500/10">
              <p className="flex items-center gap-2 text-lg font-bold text-emerald-800 dark:text-emerald-300">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="size-4" />
                </span>
                {completeTitle}
              </p>
              {completeDetail && <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-200">{completeDetail}</p>}
              <p className="mt-3 text-xs font-medium text-emerald-800/80 dark:text-emerald-300/80">
                Simulated. No Stripe request was sent and no money moved. Select any step to review its code.
              </p>
            </div>
          ) : (
            <div key={shown} className="animate-fade-up">
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Step {shown + 1} of {steps.length}
                {step.actor ? ` · ${step.actor}` : ""}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{step.detail}</p>
              {step.tag && (
                <code className="mt-2 inline-block rounded bg-slate-100 px-2 py-1 font-mono text-xs text-indigo-700 dark:bg-slate-800 dark:text-indigo-300">
                  {step.tag}
                </code>
              )}
              {panels?.[shown] && <div className="mt-4">{panels[shown]}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
