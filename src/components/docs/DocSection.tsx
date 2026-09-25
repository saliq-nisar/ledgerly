import type { ReactNode } from "react";

import { Container } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

interface DocSectionProps {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  tinted?: boolean;
  className?: string;
}

/** Section shell shared by all documentation sections (anchors clear both sticky bars). */
export function DocSection({ id, eyebrow, title, description, children, tinted, className }: DocSectionProps) {
  const headingId = `${id ?? eyebrow.toLowerCase().replace(/\W+/g, "-")}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("scroll-mt-32 py-16 sm:py-24", tinted && "bg-slate-50 dark:bg-slate-900/40", className)}
    >
      <Container>
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{eyebrow}</p>
          <h2 id={headingId} className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            {title}
          </h2>
          {description && <div className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">{description}</div>}
        </div>
        <div className="mt-12">{children}</div>
      </Container>
    </section>
  );
}

/** Numbered step with explanation + code on one side and a visual on the other. */
export function StepRow({
  step,
  title,
  children,
  code,
  visual,
}: {
  step: string;
  title: string;
  children: ReactNode;
  code: ReactNode;
  visual: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-10">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-indigo-600 font-mono text-sm font-bold text-white">
            {step}
          </span>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <div className="mt-3 space-y-3 leading-relaxed text-slate-600 dark:text-slate-400">{children}</div>
        <div className="mt-5 space-y-4">{code}</div>
      </div>
      <div className="min-w-0 lg:pt-12">{visual}</div>
    </div>
  );
}

export function Panel({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900", className)}>
      {title && <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>}
      {children}
    </div>
  );
}

export function Chip({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "indigo" | "emerald" | "rose" | "amber" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    amber: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  } as const;
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs", tones[tone])}>{children}</span>;
}
