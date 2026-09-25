"use client";

import { useState, type ReactNode } from "react";

import { CopyButton } from "@/components/docs/CopyButton";
import { Check } from "@/components/ui/icons";
import { highlightTs, TOKEN_CLASS } from "@/lib/highlight";
import { cn } from "@/lib/utils";

/**
 * Configuration simulation. Every control maps to an option that exists in
 * @ledgerly/payments v0.2.0 (CheckoutOptions, MetadataPolicy, urls,
 * callbacks, logging, monitoring) with only values the library accepts.
 * Nothing is executed and no Stripe request is made.
 */

const LOCALES = ["auto", "en", "fr", "de", "es", "ja", "pt-BR"] as const;
const SUBMIT_TYPES = ["pay", "book", "donate", "auto"] as const;
const COUNTRIES = ["US", "CA", "GB", "DE", "FR"] as const;
const SUCCESS_PATHS = ["(default)", "/orders/complete", "/thanks"] as const;
const LOG_LEVELS = ["(default: info)", "debug", "warn", "error", "silent"] as const;
const METADATA_KEYS = ["orderId", "customerType", "userId"] as const;
const SAMPLE_VALUES: Record<(typeof METADATA_KEYS)[number], string> = { orderId: "order_123", customerType: "business", userId: "user_456" };
const CALLBACKS = {
  beforeCheckout: "async beforeCheckout({ product, quantity }) { /* check inventory */ },",
  onPaymentSucceeded: "async onPaymentSucceeded(payment) { /* fulfil the order */ },",
  onCheckoutExpired: "async onCheckoutExpired(session) { /* release reserved stock */ },",
} as const;
const HOOKS = {
  onError: "onError: (error, info) => { /* report error.code */ },",
  onCheckoutCreated: "onCheckoutCreated: (info) => { /* analytics */ },",
  onWebhookProcessed: "onWebhookProcessed: (info) => { /* metrics */ },",
} as const;

type Toggle = "allowPromotionCodes" | "collectBillingAddress" | "collectPhoneNumber" | "automaticTax" | "shipping" | "perCallLocale";

interface State extends Record<Toggle, boolean> {
  countries: string[];
  locale: (typeof LOCALES)[number];
  submitType: (typeof SUBMIT_TYPES)[number];
  submitText: string;
  metadataKeys: string[];
  successPath: (typeof SUCCESS_PATHS)[number];
  callbacks: string[];
  logLevel: (typeof LOG_LEVELS)[number];
  hooks: string[];
}

const INITIAL: State = {
  allowPromotionCodes: true,
  collectBillingAddress: true,
  collectPhoneNumber: false,
  automaticTax: false,
  shipping: false,
  perCallLocale: false,
  countries: ["US", "CA"],
  locale: "auto",
  submitType: "pay",
  submitText: "",
  metadataKeys: ["orderId"],
  successPath: "(default)",
  callbacks: ["onPaymentSucceeded"],
  logLevel: "(default: info)",
  hooks: [],
};

function generate(s: State): string {
  const checkout: string[] = [];
  if (s.allowPromotionCodes) checkout.push("allowPromotionCodes: true,");
  if (s.collectBillingAddress) checkout.push("collectBillingAddress: true,");
  if (s.collectPhoneNumber) checkout.push("collectPhoneNumber: true,");
  if (s.shipping && s.countries.length > 0) checkout.push(`collectShippingAddress: { allowedCountries: [${s.countries.map((c) => JSON.stringify(c)).join(", ")}] },`);
  if (s.automaticTax) checkout.push("automaticTax: true, // requires Stripe Tax");
  checkout.push(`locale: ${JSON.stringify(s.locale)},`);
  if (s.submitType !== "pay") checkout.push(`submitType: ${JSON.stringify(s.submitType)},`);
  if (s.submitText.trim()) checkout.push(`customText: { submit: ${JSON.stringify(s.submitText.trim())} },`);

  const lines = ["const payments = createPaymentClient({", "  products,"];
  lines.push("  checkout: {", ...checkout.map((l) => `    ${l}`), "  },");
  if (s.metadataKeys.length) lines.push(`  metadata: { allowedKeys: [${s.metadataKeys.map((k) => JSON.stringify(k)).join(", ")}] },`);
  if (s.successPath !== "(default)") lines.push(`  urls: { success: ${JSON.stringify(s.successPath)} }, // session_id is appended automatically`);
  if (s.callbacks.length) lines.push("  callbacks: {", ...s.callbacks.map((c) => `    ${CALLBACKS[c as keyof typeof CALLBACKS]}`), "  },");
  if (s.logLevel !== "(default: info)") lines.push(`  logging: { level: ${JSON.stringify(s.logLevel)} },`);
  if (s.hooks.length) lines.push("  monitoring: {", ...s.hooks.map((h) => `    ${HOOKS[h as keyof typeof HOOKS]}`), "  },");
  lines.push("});", "", "await payments.checkout.create({", '  productId: "pro",');
  if (s.metadataKeys.length) lines.push(`  metadata: { ${s.metadataKeys.map((k) => `${k}: ${JSON.stringify(SAMPLE_VALUES[k as keyof typeof SAMPLE_VALUES])}`).join(", ")} },`);
  if (s.perCallLocale) lines.push('  options: { locale: "fr" }, // overrides the client-wide locale for this call');
  lines.push("});");
  return lines.join("\n");
}

export function ConfigPlayground() {
  const [state, setState] = useState<State>(INITIAL);
  const code = generate(state);
  const set = <K extends keyof State>(key: K, value: State[K]) => setState((s) => ({ ...s, [key]: value }));
  const toggleIn = (key: "countries" | "metadataKeys" | "callbacks" | "hooks", value: string) =>
    setState((s) => ({ ...s, [key]: s[key].includes(value) ? s[key].filter((v) => v !== value) : [...s[key], value] }));

  const checkbox = (key: Toggle, label: string, hint?: string) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <input type="checkbox" checked={state[key]} onChange={(e) => set(key, e.target.checked)} className="mt-1 size-4 accent-indigo-600" />
      <span>
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
        {hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
      </span>
    </label>
  );
  const chips = (key: "countries" | "metadataKeys" | "callbacks" | "hooks", values: readonly string[], label: string) => (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {values.map((v) => (
        <label key={v} className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 font-mono text-xs dark:border-slate-700">
          <input type="checkbox" checked={state[key].includes(v)} onChange={() => toggleIn(key, v)} className="accent-indigo-600" />
          {v}
        </label>
      ))}
    </div>
  );
  const select = <K extends "locale" | "submitType" | "successPath" | "logLevel">(key: K, label: string, options: readonly State[K][]) => (
    <label className="text-sm">
      <span className="mb-1 block font-medium text-slate-800 dark:text-slate-200">{label}</span>
      <select value={state[key]} onChange={(e) => set(key, e.target.value as State[K])} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950">
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );

  const checkoutFeatures = [
    state.allowPromotionCodes && "Promotion Codes",
    state.collectBillingAddress && "Billing Address",
    state.collectPhoneNumber && "Phone Number",
    state.shipping && state.countries.length > 0 && `Shipping (${state.countries.join(", ")})`,
    state.automaticTax && "Automatic Tax",
    state.submitText.trim() && "Custom Text",
    `Locale: ${state.perCallLocale ? "fr (per call)" : state.locale}`,
    `Button: ${state.submitType}`,
  ].filter(Boolean) as string[];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <form aria-label="Payment client options" className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" onSubmit={(e) => e.preventDefault()}>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Checkout</legend>
          {checkbox("allowPromotionCodes", "Allow promotion codes")}
          {checkbox("collectBillingAddress", "Collect billing address", "Always required instead of only when needed")}
          {checkbox("collectPhoneNumber", "Collect phone number")}
          {checkbox("shipping", "Collect shipping address")}
          {state.shipping && <div className="ml-9">{chips("countries", COUNTRIES, "Allowed shipping countries")}</div>}
          {checkbox("automaticTax", "Automatic tax", "Policy option: client-wide or per product only")}
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          {select("locale", "Locale", LOCALES)}
          {select("submitType", "Submit button", SUBMIT_TYPES)}
          <label className="col-span-2 text-sm">
            <span className="mb-1 block font-medium text-slate-800 dark:text-slate-200">Text by pay button</span>
            <input value={state.submitText} maxLength={120} onChange={(e) => set("submitText", e.target.value)} placeholder="Optional" className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950" />
          </label>
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Metadata allowed keys</legend>
          {chips("metadataKeys", METADATA_KEYS, "Metadata allowed keys")}
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          {select("successPath", "Success redirect", SUCCESS_PATHS)}
          {select("logLevel", "Logging level", LOG_LEVELS)}
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Callbacks</legend>
          {chips("callbacks", Object.keys(CALLBACKS), "Callbacks")}
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Monitoring hooks</legend>
          {chips("hooks", Object.keys(HOOKS), "Monitoring hooks")}
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Per call</legend>
          {checkbox("perCallLocale", "Override locale for one checkout", "options: { locale } on checkout.create()")}
        </fieldset>
      </form>

      <div className="min-w-0 space-y-4">
        <figure className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
          <figcaption className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <span className="font-mono text-xs text-slate-400">lib/payments.ts — live preview</span>
            <CopyButton text={code} label="generated configuration" />
          </figcaption>
          <pre aria-live="polite" className="max-h-[26rem] overflow-auto px-4 py-4 text-[13px] leading-6 sm:px-5">
            <code className="font-mono">
              {highlightTs(code).map((line, i) => (
                <span key={i} className="block min-h-6">
                  {line.map((t, j) => <span key={j} className={TOKEN_CLASS[t.kind]}>{t.text}</span>)}
                </span>
              ))}
            </code>
          </pre>
        </figure>

        {/* Architecture view that reacts to the configuration */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Effective configuration · simulation</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Node title="Stripe Checkout" tone="sky">
              {checkoutFeatures.map((f) => <Feature key={f}>{f}</Feature>)}
            </Node>
            <Node title="Redirects" tone="violet">
              <Feature>success → {state.successPath === "(default)" ? "/payment/success" : state.successPath}?session_id=…</Feature>
              <Feature>same-origin only</Feature>
            </Node>
            <Node title="Metadata" tone="indigo">
              {state.metadataKeys.length ? state.metadataKeys.map((k) => <Feature key={k}>{k}</Feature>) : <Feature muted>any safe key (no allow-list)</Feature>}
              <Feature>+ productId, quantity (reserved)</Feature>
            </Node>
            <Node title="Your callbacks & observability" tone="emerald">
              {state.callbacks.map((c) => <Feature key={c}>{c}</Feature>)}
              {state.hooks.map((h) => <Feature key={h}>{h}</Feature>)}
              <Feature>logging: {state.logLevel === "(default: info)" ? "info" : state.logLevel} (redacted)</Feature>
            </Node>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Configuration simulation, not a Stripe API call. Options are validated when you call{" "}
            <code className="font-mono">createPaymentClient</code>; unknown options throw.
          </p>
        </div>
      </div>
    </div>
  );
}

function Node({ title, tone, children }: { title: string; tone: "sky" | "violet" | "indigo" | "emerald"; children: ReactNode }) {
  const tones = {
    sky: "border-sky-300 dark:border-sky-500/40",
    violet: "border-violet-300 dark:border-violet-500/40",
    indigo: "border-indigo-300 dark:border-indigo-500/40",
    emerald: "border-emerald-300 dark:border-emerald-500/40",
  };
  return (
    <div className={cn("rounded-xl border-2 p-3", tones[tone])}>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
      <ul className="mt-2 space-y-1">{children}</ul>
    </div>
  );
}

function Feature({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <li className={cn("flex items-center gap-1.5 text-xs animate-fade-up", muted ? "text-slate-500" : "text-slate-700 dark:text-slate-300")}>
      <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}
