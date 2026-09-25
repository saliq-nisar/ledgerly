import { PaymentConfigurationError, type PaymentError } from "../errors/errors.js";
import type { PaymentEnvironment } from "../types/public.js";

/**
 * Redirect URL handling. Success/cancel URLs come only from server code and
 * must resolve to the app's own origin or an explicitly allow-listed origin.
 * This rules out open redirects and `javascript:`/`data:` URLs.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseOrigin(value: string, environment: PaymentEnvironment, label: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new PaymentConfigurationError(`${label} is not a valid absolute URL (e.g. https://shop.example.com).`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new PaymentConfigurationError(`${label} must use http or https.`);
  }
  if (url.username || url.password) {
    throw new PaymentConfigurationError(`${label} must not contain credentials.`);
  }
  if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) {
    throw new PaymentConfigurationError(`${label} must be an origin only (scheme, host and optional port), without a path.`);
  }
  if (environment === "production" && url.protocol !== "https:") {
    throw new PaymentConfigurationError(`${label} must use https in production.`);
  }
  if (environment === "production" && LOCAL_HOSTS.has(url.hostname)) {
    throw new PaymentConfigurationError(`${label} points to localhost, which is not valid in production.`);
  }
  return url.origin;
}

export function validateAppUrl(value: string, environment: PaymentEnvironment, label: string): string {
  return parseOrigin(value, environment, label);
}

export function validateAllowedOrigins(
  value: unknown,
  environment: PaymentEnvironment,
  label: string,
): ReadonlySet<string> {
  if (value === undefined) return new Set();
  if (!Array.isArray(value) || value.length > 20) {
    throw new PaymentConfigurationError(`${label} must be an array of at most 20 origins.`);
  }
  return new Set(value.map((origin: unknown, i) => {
    if (typeof origin !== "string") throw new PaymentConfigurationError(`${label}[${i}] must be a string.`);
    return parseOrigin(origin, environment, `${label}[${i}]`);
  }));
}

export const DEFAULT_SUCCESS_PATH = "/payment/success?session_id={CHECKOUT_SESSION_ID}";
export const DEFAULT_CANCEL_PATH = "/payment/cancelled?product={PRODUCT_ID}";

export interface RedirectPolicy {
  readonly environment: PaymentEnvironment;
  readonly appOrigin: string | undefined;
  readonly allowedOrigins: ReadonlySet<string>;
}

/**
 * Validates a redirect target and returns its normalised template:
 * - relative same-origin paths ("/thanks?x=1"), or
 * - absolute URLs whose origin is appUrl or in `allowedRedirectOrigins`.
 * For success targets, `session_id={CHECKOUT_SESSION_ID}` is appended if missing.
 */
export function validateRedirectTarget(
  target: unknown,
  kind: "success" | "cancel",
  policy: RedirectPolicy,
  fail: (message: string) => PaymentError,
): string {
  if (
    typeof target !== "string" ||
    target.length === 0 ||
    target.length > 1024 ||
    target.includes("\\") ||
    /[\u0000- \u007f]/.test(target) ||
    target.startsWith("//")
  ) {
    throw fail(`must be a same-origin path starting with "/" or an allow-listed https URL.`);
  }

  const probe = target.replaceAll("{CHECKOUT_SESSION_ID}", "x").replaceAll("{PRODUCT_ID}", "x");
  if (target.startsWith("/")) {
    const probeOrigin = "https://app.invalid";
    if (new URL(probe, probeOrigin).origin !== probeOrigin) throw fail("must stay on the application's origin.");
  } else {
    let url: URL;
    try {
      url = new URL(probe);
    } catch {
      throw fail(`must be a same-origin path starting with "/" or an allow-listed https URL.`);
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") throw fail("must use https.");
    if (url.username || url.password) throw fail("must not contain credentials.");
    if (policy.environment === "production" && url.protocol !== "https:") throw fail("must use https in production.");
    if (url.origin !== policy.appOrigin && !policy.allowedOrigins.has(url.origin)) {
      throw fail(`points to an origin that is not appUrl or listed in security.allowedRedirectOrigins.`);
    }
  }

  if (kind === "success" && !target.includes("{CHECKOUT_SESSION_ID}")) {
    const hashIndex = target.indexOf("#");
    const base = hashIndex === -1 ? target : target.slice(0, hashIndex);
    const hash = hashIndex === -1 ? "" : target.slice(hashIndex);
    return `${base}${base.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}${hash}`;
  }
  return target;
}

/** Config-time wrapper that throws configuration errors. */
export function validateRedirectTemplate(target: unknown, kind: "success" | "cancel", policy: RedirectPolicy, label: string): string {
  return validateRedirectTarget(target, kind, policy, (message) => new PaymentConfigurationError(`${label} ${message}`));
}

/** Expands a validated template. Relative templates require appUrl. */
export function buildRedirectUrl(template: string, appOrigin: string | undefined, productId: string): string {
  const expanded = template.replaceAll("{PRODUCT_ID}", encodeURIComponent(productId));
  if (!expanded.startsWith("/")) return expanded;
  if (!appOrigin) {
    throw new PaymentConfigurationError(
      "appUrl is not set. Provide appUrl (or env APP_URL) so redirect URLs can be built from trusted configuration.",
    );
  }
  return `${appOrigin}${expanded}`;
}
