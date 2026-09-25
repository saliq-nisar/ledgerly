"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";

export interface PackageModule {
  name: string;
  summary: string;
  detail: string;
  files: readonly string[];
}

/** Clickable tree of the package's real src/ modules. */
export function PackageExplorer({ modules }: { modules: readonly PackageModule[] }) {
  const [selected, setSelected] = useState(modules[0]!.name);
  const id = useId();
  const current = modules.find((m) => m.name === selected) ?? modules[0]!;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-sm">
        <p className="text-slate-300">@ledgerly/payments/src</p>
        <ul className="mt-1" aria-label="Package modules">
          {modules.map((m, i) => (
            <li key={m.name}>
              <button
                type="button"
                aria-pressed={m.name === selected}
                aria-controls={`${id}-detail`}
                onClick={() => setSelected(m.name)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left focus-visible:outline-2 focus-visible:outline-indigo-400",
                  m.name === selected ? "bg-indigo-500/20 text-white" : "text-slate-400 hover:text-white",
                )}
              >
                <span aria-hidden="true" className="text-slate-600">{i === modules.length - 1 ? "└──" : "├──"}</span>
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div id={`${id}-detail`} aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <p className="font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400">src/{current.name}</p>
        <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{current.summary}</p>
        <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-400">{current.detail}</p>
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {current.files.map((f) => (
            <li key={f} className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
