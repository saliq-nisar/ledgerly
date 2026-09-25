import { PaymentConfigurationError } from "../errors/errors.js";
import type { PaymentEnvironment } from "../types/public.js";

/**
 * Credential validation. Error messages describe *what* is wrong and name the
 * setting, but never echo the value (not even partially).
 */

const PLACEHOLDER_PATTERN = /dummy|placeholder|your[_-]|xxx|example|changeme|replace[_-]?me|<|>/i;
const SECRET_KEY_PATTERN = /^(sk|rk)_(test|live)_[0-9A-Za-z]{16,247}$/;
const WEBHOOK_SECRET_PATTERN = /^whsec_[0-9A-Za-z+/=_-]{16,250}$/;

export function validateSecretKey(value: string | undefined, environment: PaymentEnvironment, label: string): string {
  const key = value?.trim();
  const mode = environment === "production" ? "live" : "test";

  if (!key) {
    throw new PaymentConfigurationError(
      `${label} is missing. Add a Stripe ${mode}-mode secret key (sk_${mode}_…) to your environment.`,
    );
  }
  if (PLACEHOLDER_PATTERN.test(key)) {
    throw new PaymentConfigurationError(
      `${label} is a placeholder value. Replace it with a Stripe ${mode}-mode secret key from the Stripe Dashboard.`,
    );
  }
  if (key.startsWith("pk_")) {
    throw new PaymentConfigurationError(
      `${label} contains a publishable key (pk_…). Use the secret key (sk_${mode}_…) on the server.`,
    );
  }
  const match = SECRET_KEY_PATTERN.exec(key);
  if (!match) {
    throw new PaymentConfigurationError(`${label} is malformed. Expected a key starting with sk_${mode}_ or rk_${mode}_.`);
  }
  const keyMode = match[2];
  if (keyMode === "live" && environment === "test") {
    throw new PaymentConfigurationError(
      `${label} is a live-mode key but environment is "test". Use a test key, or set environment: "production" deliberately.`,
    );
  }
  if (keyMode === "test" && environment === "production") {
    throw new PaymentConfigurationError(
      `${label} is a test-mode key but environment is "production". Production requires a live key (sk_live_…).`,
    );
  }
  return key;
}

export type WebhookSecretResult =
  | { status: "ok"; secret: string }
  | { status: "missing" | "placeholder"; secret: undefined };

/**
 * A missing or placeholder webhook secret disables webhook verification (every
 * webhook call then fails with a configuration error) but lets checkout run.
 * A value that looks real but is malformed is treated as a mistake and fails fast.
 */
export function validateWebhookSecret(value: string | undefined, label: string): WebhookSecretResult {
  const secret = value?.trim();
  if (!secret) return { status: "missing", secret: undefined };
  if (PLACEHOLDER_PATTERN.test(secret)) return { status: "placeholder", secret: undefined };
  if (!WEBHOOK_SECRET_PATTERN.test(secret)) {
    throw new PaymentConfigurationError(`${label} is malformed. Webhook signing secrets start with whsec_.`);
  }
  return { status: "ok", secret };
}
