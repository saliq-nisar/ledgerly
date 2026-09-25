"use client";

import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "@/components/docs/useReducedMotion";
import { Check, Spinner, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const REQUESTS = {
  valid: { label: "Valid request", body: { productId: "pro", quantity: 1 } },
  attack: { label: "Attacker request", body: { productId: "pro", quantity: 1, amount: 1, currency: "usd" } },
} as const;

type Mode = keyof typeof REQUESTS;
type Live = { state: "idle" } | { state: "sending" } | { state: "done"; status: number; body: string } | { state: "error" };

/**
 * Security simulation: a valid request is allowed, a tampered one is blocked
 * with the library's real error code. When real Stripe testing is enabled, the
 * same request can optionally be sent to this demo's actual API.
 */
export function TamperDemo({ liveEnabled }: { liveEnabled: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [mode, setMode] = useState<Mode>("attack");
  const [stage, setStage] = useState(0); // 0 idle · 1 sent · 2 validating · 3 verdict
  const [live, setLive] = useState<Live>({ state: "idle" });

  useEffect(() => {
    if (stage === 0 || stage >= 3) return;
    const timer = window.setTimeout(() => setStage((s) => s + 1), 800);
    return () => window.clearTimeout(timer);
  }, [stage]);

  function send(next: Mode) {
    setMode(next);
    setLive({ state: "idle" });
    setStage(reduced ? 3 : 1);
  }

  async function sendLive() {
    setLive({ state: "sending" });
    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(REQUESTS.attack.body),
      });
      const text = await response.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // keep raw text
      }
      setLive({ state: "done", status: response.status, body: pretty });
    } catch {
      setLive({ state: "error" });
    }
  }

  const blocked = mode === "attack";
  const verdict = stage >= 3;
  const body = REQUESTS[mode].body;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
        <p className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
          <span className="rounded-md bg-amber-200 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide dark:bg-amber-500/25">Simulation</span>
          Shows the library&apos;s real validation result. Nothing is sent.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => send("valid")} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-emerald-500/40 dark:bg-slate-900 dark:text-emerald-300">
            Send valid request
          </button>
          <button type="button" onClick={() => send("attack")} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500">
            Simulate attacker
          </button>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {verdict
          ? blocked
            ? "Blocked: 400 unexpected_field. The amount and currency fields are rejected before Stripe is contacted."
            : "Allowed: the request contains only productId and quantity."
          : ""}
      </p>

      <div aria-hidden="true" className="grid gap-3 p-5 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
        <div className={cn("rounded-xl border p-3 transition-colors duration-500", blocked ? "border-rose-300 dark:border-rose-500/50" : "border-emerald-300 dark:border-emerald-500/50")}>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Browser sends</p>
          <pre className="mt-2 overflow-x-auto font-mono text-xs leading-5 text-slate-800 dark:text-slate-200">
            {"{\n"}
            {Object.entries(body).map(([k, v]) => {
              const bad = k === "amount" || k === "currency";
              return (
                <span key={k} className={cn("block pl-3", bad && "rounded bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300")}>
                  {k}: {JSON.stringify(v)},
                </span>
              );
            })}
            {"}"}
          </pre>
        </div>
        <Arrow active={stage >= 1} blocked={false} reduced={reduced} animKey={`${mode}-1-${stage}`} />
        <div className={cn("rounded-xl border p-3 transition-all duration-500", stage >= 2 ? "border-indigo-400 dark:border-indigo-500/60" : "border-slate-200 opacity-60 dark:border-slate-800")}>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">@ledgerly/payments</p>
          <p className="mt-2 font-mono text-xs text-slate-700 dark:text-slate-300">checkout.parse(body)</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Allowed fields: productId, quantity</p>
        </div>
        <Arrow active={stage >= 3} blocked={blocked} reduced={reduced} animKey={`${mode}-2-${stage}`} />
        <div
          className={cn(
            "rounded-xl border-2 p-3 transition-all duration-500",
            !verdict && "border-slate-200 opacity-50 dark:border-slate-800",
            verdict && blocked && "border-rose-500 bg-rose-50 dark:bg-rose-500/10",
            verdict && !blocked && "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
          )}
        >
          {!verdict ? (
            <p className="text-sm text-slate-500">Waiting…</p>
          ) : blocked ? (
            <>
              <p className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                <span className={cn("inline-flex size-6 items-center justify-center rounded-full bg-rose-500 text-white", !reduced && "animate-ring-pop")}>
                  <X className="size-3.5" />
                </span>
                BLOCKED
              </p>
              <p className="mt-1 font-mono text-xs text-rose-700 dark:text-rose-300">400 · unexpected_field</p>
              <p className="mt-1 font-mono text-[11px] text-rose-700/80 dark:text-rose-300/80">Unexpected field &quot;amount&quot;. Only productId and quantity are accepted.</p>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                <span className={cn("inline-flex size-6 items-center justify-center rounded-full bg-emerald-500 text-white", !reduced && "animate-ring-pop")}>
                  <Check className="size-3.5" />
                </span>
                Allowed
              </p>
              <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">Price 1999 usd comes from the catalog, not the browser.</p>
            </>
          )}
        </div>
      </div>
      {stage === 0 && <p className="px-5 pb-4 text-sm text-slate-500 dark:text-slate-400">Choose a request above to run the simulation.</p>}

      <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
        {liveEnabled ? (
          <>
            <button
              type="button"
              onClick={sendLive}
              disabled={live.state === "sending"}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60 dark:bg-white dark:text-slate-900"
            >
              {live.state === "sending" && <Spinner className="size-4" />}
              Also send the attacker request to the real API
            </button>
            <span className="ml-3 text-xs text-slate-500 dark:text-slate-400">Optional real check (Stripe test mode is configured). The response is shown verbatim.</span>
            <div aria-live="polite">
              {live.state === "done" && (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                  <p className="border-b border-white/10 px-4 py-2 font-mono text-xs text-slate-400">HTTP {live.status}</p>
                  <pre className="overflow-x-auto px-4 py-3 font-mono text-xs leading-5 text-emerald-300">{live.body}</pre>
                </div>
              )}
              {live.state === "error" && <p className="mt-3 text-sm text-rose-600">Network error.</p>}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real API check unavailable: Stripe test keys aren&apos;t configured on this server (optional). The simulation above
            shows the same result, which the library&apos;s test suite verifies.
          </p>
        )}
      </div>
    </div>
  );
}

function Arrow({ active, animKey, blocked, reduced }: { active: boolean; animKey: string; blocked: boolean; reduced: boolean }) {
  return (
    <div className="flex justify-center md:w-12" aria-hidden="true">
      <span className={cn("relative block h-6 w-0.5 rounded-full md:h-0.5 md:w-full", active ? (blocked ? "bg-rose-400" : "bg-indigo-400") : "bg-slate-200 dark:bg-slate-700")}>
        {active && !reduced && (
          <span key={animKey} className={cn("flow-dot flow-dot-md absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full", blocked ? "bg-rose-500" : "bg-indigo-500")} style={{ animationDuration: "700ms" }} />
        )}
      </span>
    </div>
  );
}
