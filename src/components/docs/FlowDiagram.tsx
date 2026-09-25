"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";

import { useInView } from "@/components/docs/InView";
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
 * Generic, educational step diagram: nodes light up in order and a dot travels
 * along each connector. Serializable props so Server Components can use it.
 * The visual is aria-hidden; an ordered list provides the text equivalent.
 */

const ICONS = {
  app: Globe,
  browser: Smartphone,
  customer: User,
  api: Server,
  library: Code,
  stripe: Zap,
  network: Network,
  webhook: Webhook,
  shield: Shield,
  lock: Lock,
  check: Check,
  blocked: X,
  alert: Alert,
  db: Database,
  card: Card,
} satisfies Record<string, ComponentType<SVGProps<SVGSVGElement>>>;

export type FlowIcon = keyof typeof ICONS;
export type FlowTone = "app" | "lib" | "stripe" | "customer" | "success" | "danger" | "neutral";

export interface FlowStep {
  title: string;
  detail?: string;
  /** Monospace chip, e.g. a function or event name. */
  tag?: string;
  icon?: FlowIcon;
  tone?: FlowTone;
}

export interface FlowConnector {
  label?: string;
  /** "return" draws the connector in the response colour. */
  kind?: "request" | "return" | "blocked";
}

interface FlowDiagramProps {
  steps: readonly FlowStep[];
  connectors?: readonly FlowConnector[];
  /** Text shown to screen readers before the ordered list. */
  summary: string;
  layout?: "vertical" | "horizontal";
  intervalMs?: number;
  /** Hold time on the final step before looping. */
  holdMs?: number;
  className?: string;
  compact?: boolean;
}

const TONE: Record<FlowTone, { ring: string; icon: string; reached: string }> = {
  app: { ring: "border-violet-400", icon: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300", reached: "border-violet-300 dark:border-violet-500/50" },
  lib: { ring: "border-indigo-500", icon: "bg-indigo-600 text-white", reached: "border-indigo-300 dark:border-indigo-500/60" },
  stripe: { ring: "border-sky-400", icon: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300", reached: "border-sky-300 dark:border-sky-500/50" },
  customer: { ring: "border-slate-400", icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", reached: "border-slate-300 dark:border-slate-600" },
  success: { ring: "border-emerald-500", icon: "bg-emerald-500 text-white", reached: "border-emerald-300 dark:border-emerald-500/60" },
  danger: { ring: "border-rose-500", icon: "bg-rose-500 text-white", reached: "border-rose-300 dark:border-rose-500/60" },
  neutral: { ring: "border-slate-400", icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", reached: "border-slate-300 dark:border-slate-600" },
};

export function FlowDiagram({
  steps,
  connectors = [],
  summary,
  layout = "vertical",
  intervalMs = 1300,
  holdMs = 2600,
  className,
  compact = false,
}: FlowDiagramProps) {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [active, setActive] = useState(0);
  const last = steps.length - 1;

  useEffect(() => {
    if (reduced || !inView) return;
    const timer = window.setTimeout(() => setActive((a) => (a >= last ? 0 : a + 1)), active >= last ? holdMs : intervalMs);
    return () => window.clearTimeout(timer);
  }, [active, inView, reduced, last, intervalMs, holdMs]);

  const shown = reduced ? last : active;
  const horizontal = layout === "horizontal";

  return (
    <div ref={ref} className={className}>
      <div className="sr-only">
        <p>{summary}</p>
        <ol>
          {steps.map((step, i) => (
            <li key={i}>
              {step.title}
              {step.tag ? ` (${step.tag})` : ""}
              {step.detail ? `: ${step.detail}` : ""}
              {connectors[i]?.label ? `. Then: ${connectors[i]?.label}` : ""}
            </li>
          ))}
        </ol>
      </div>

      <div aria-hidden="true" className={cn("flex", horizontal ? "flex-col lg:flex-row lg:items-stretch" : "flex-col")}>
        {steps.map((step, i) => {
          const tone = TONE[step.tone ?? "neutral"];
          const Icon = step.icon ? ICONS[step.icon] : null;
          const reached = i <= shown;
          const current = i === shown && !reduced;
          const connector = connectors[i];
          return (
            <div key={i} className={cn("flex", horizontal ? "flex-col lg:min-w-0 lg:flex-1 lg:flex-row lg:items-center" : "flex-col")}>
              <div
                className={cn(
                  "relative flex items-center gap-3 rounded-xl border bg-white transition-all duration-500 dark:bg-slate-900",
                  compact ? "px-3 py-2" : "px-3.5 py-2.5",
                  horizontal && "lg:min-w-0 lg:flex-1 lg:flex-col lg:items-start lg:gap-2",
                  reached ? tone.reached : "border-slate-200 opacity-60 dark:border-slate-800",
                  current && cn(tone.ring, "shadow-lg shadow-indigo-500/10 ring-4 ring-indigo-500/10"),
                )}
              >
                {Icon && (
                  <span className={cn("relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-500", reached ? tone.icon : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500")}>
                    {current && <span className="absolute inset-0 rounded-lg bg-indigo-400/30 animate-ripple" />}
                    <Icon className="relative size-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className={cn("font-semibold text-slate-900 dark:text-white", compact ? "text-xs" : "text-sm")}>{step.title}</p>
                  {step.tag && (
                    <code className="mt-0.5 inline-block max-w-full truncate rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-indigo-700 dark:bg-slate-800 dark:text-indigo-300">
                      {step.tag}
                    </code>
                  )}
                  {step.detail && !compact && <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">{step.detail}</p>}
                </div>
              </div>

              {i < last && (
                <Connector
                  horizontal={horizontal}
                  label={connector?.label}
                  kind={connector?.kind ?? "request"}
                  active={!reduced && shown === i + 1}
                  reached={i + 1 <= shown}
                  animKey={`${i}-${shown}`}
                  durationMs={Math.min(intervalMs * 0.8, 1100)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Connector({
  horizontal,
  label,
  kind,
  active,
  reached,
  animKey,
  durationMs,
}: {
  horizontal: boolean;
  label?: string;
  kind: "request" | "return" | "blocked";
  active: boolean;
  reached: boolean;
  animKey: string;
  durationMs: number;
}) {
  const colour = kind === "return" ? "bg-emerald-500" : kind === "blocked" ? "bg-rose-500" : "bg-indigo-500";
  const faded = kind === "return" ? "bg-emerald-300 dark:bg-emerald-500/40" : kind === "blocked" ? "bg-rose-300 dark:bg-rose-500/40" : "bg-indigo-300 dark:bg-indigo-500/40";
  return (
    <div className={cn("relative flex items-center gap-2 py-1 pl-7", horizontal && "lg:flex-col lg:justify-center lg:py-0 lg:pl-0 lg:px-1")}>
      <div className={cn("relative h-7 w-0.5 rounded-full transition-colors duration-500", horizontal && "lg:h-0.5 lg:w-8", reached ? faded : "bg-slate-200 dark:bg-slate-700")}>
        {active && (
          <span
            key={animKey}
            className={cn("flow-dot absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-indigo-500/20", colour, horizontal && "flow-dot-responsive")}
            style={{ animationDuration: `${durationMs}ms` }}
          />
        )}
      </div>
      {label && (
        <span
          className={cn(
            "font-mono text-[11px] transition-colors duration-500",
            horizontal && "lg:hidden",
            kind === "blocked" ? "text-rose-600 dark:text-rose-400" : kind === "return" ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400",
            active && "font-semibold",
          )}
        >
          {kind === "return" ? "↑ " : "↓ "}
          {label}
        </span>
      )}
    </div>
  );
}
