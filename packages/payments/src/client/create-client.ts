import Stripe from "stripe";

import { createCheckoutApi, type CheckoutApi } from "../checkout/checkout.js";
import { validateCheckoutOptions } from "../checkout/options.js";
import { isPaymentError, PaymentConfigurationError, PaymentErrorCodes, type PaymentErrorCode } from "../errors/errors.js";
import { Observer } from "../observability/observability.js";
import { ProductRegistry, resolveQuantityDefaults, type ProductsApi } from "../products/products.js";
import { validateSecretKey, validateWebhookSecret } from "../security/keys.js";
import {
  DEFAULT_CANCEL_PATH,
  DEFAULT_SUCCESS_PATH,
  validateAllowedOrigins,
  validateAppUrl,
  validateRedirectTemplate,
  type RedirectPolicy,
} from "../security/urls.js";
import type {
  LogLevel,
  PaymentClientConfig,
  PaymentEnvironment,
  PaymentHooks,
  ProductCatalog,
  ProductId,
  PublicErrorInfo,
} from "../types/public.js";
import { resolveMetadataPolicy } from "../validation/validation.js";
import { callbackHandlers, validateCallbacks } from "../webhook/outcomes.js";
import { toEventGate } from "../webhook/storage.js";
import { createWebhooksApi, type WebhooksApi } from "../webhook/webhooks.js";

export const LIBRARY_NAME = "@ledgerly/payments";
export const LIBRARY_VERSION = "0.2.0";

export interface PaymentClient<P extends ProductCatalog, M extends string = string> {
  readonly environment: PaymentEnvironment;
  /** Validated public origin used for redirect URLs, if configured. */
  readonly appUrl: string | undefined;
  readonly products: ProductsApi<P>;
  readonly checkout: CheckoutApi<P, M>;
  readonly webhooks: WebhooksApi;
  readonly errors: {
    /**
     * Safe description of any thrown value for API responses and UI: stable
     * code, user-facing message (your `errors.publicMessages` override or the
     * library default), HTTP status and retryability. Never includes internals.
     */
    describe(error: unknown): PublicErrorInfo;
  };
}

/** Internal-only dependencies (tests inject a fake HTTP client here). */
export interface InternalDependencies {
  httpClient?: Stripe.HttpClient;
}

function readEnv(config: { env?: Readonly<Record<string, string | undefined>> }): Readonly<Record<string, string | undefined>> {
  if (config.env) return config.env;
  return typeof process !== "undefined" && process.env ? process.env : {};
}

function resolveEnvironment(value: unknown): PaymentEnvironment {
  if (value === undefined || value === "") return "test";
  if (value === "test" || value === "production") return value;
  throw new PaymentConfigurationError(`environment must be "test" or "production".`);
}

const CONFIG_KEYS: ReadonlySet<string> = new Set([
  "products", "secretKey", "webhookSecret", "environment", "appUrl", "urls", "checkout", "metadata", "security",
  "webhooks", "storage", "callbacks", "network", "logger", "logging", "monitoring", "hooks", "errors", "env",
]);
const LOG_LEVELS: ReadonlySet<string> = new Set(["debug", "info", "warn", "error", "silent"]);
const KNOWN_CODES: ReadonlySet<string> = new Set(Object.values(PaymentErrorCodes));

function assertKeys(value: unknown, allowed: readonly string[], label: string): void {
  if (value === undefined) return;
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new PaymentConfigurationError(`${label} must be an object.`);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new PaymentConfigurationError(`${label} has unsupported option "${key.slice(0, 40)}".`);
  }
}

function resolvePublicMessages(value: unknown): ReadonlyMap<string, string> {
  assertKeys(value, ["publicMessages"], "errors");
  const messages: unknown = value === undefined ? undefined : Reflect.get(value as object, "publicMessages");
  const map = new Map<string, string>();
  if (messages === undefined) return map;
  if (typeof messages !== "object" || messages === null) throw new PaymentConfigurationError("errors.publicMessages must be an object.");
  for (const [code, message] of Object.entries(messages)) {
    if (!KNOWN_CODES.has(code)) throw new PaymentConfigurationError(`errors.publicMessages: unknown error code "${code.slice(0, 40)}".`);
    if (typeof message !== "string" || message.trim().length === 0 || message.length > 300) {
      throw new PaymentConfigurationError(`errors.publicMessages.${code} must be 1–300 characters.`);
    }
    map.set(code, message);
  }
  return map;
}

function resolveNumber(value: unknown, fallback: number, min: number, max: number, label: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new PaymentConfigurationError(`${label} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export function createPaymentClientInternal<const P extends ProductCatalog, const M extends string = string>(
  config: PaymentClientConfig<P, M>,
  internal: InternalDependencies = {},
): PaymentClient<P, M> {
  if (typeof config !== "object" || config === null) {
    throw new PaymentConfigurationError("createPaymentClient requires a configuration object.");
  }
  for (const key of Object.keys(config)) {
    // Unknown options are rejected rather than ignored, so typos never silently disable a setting.
    if (!CONFIG_KEYS.has(key)) throw new PaymentConfigurationError(`unsupported option "${key.slice(0, 40)}".`);
  }
  // A secret key must never be loaded in a browser. (The package's "browser"
  // export condition already fails the import; this catches unusual bundlers.)
  if ("window" in globalThis && "document" in globalThis) {
    throw new PaymentConfigurationError("The payment client is server-only and must not run in a browser.");
  }

  const env = readEnv(config);
  const environment = resolveEnvironment(config.environment ?? env.PAYMENTS_ENVIRONMENT);
  const secretKey = validateSecretKey(config.secretKey ?? env.STRIPE_SECRET_KEY, environment, "secretKey (STRIPE_SECRET_KEY)");
  const webhookSecretLabel = "webhookSecret (STRIPE_WEBHOOK_SECRET)";
  const webhook = validateWebhookSecret(config.webhookSecret ?? env.STRIPE_WEBHOOK_SECRET, webhookSecretLabel);
  const appUrlInput = config.appUrl ?? env.APP_URL;
  const appUrl = appUrlInput ? validateAppUrl(appUrlInput, environment, "appUrl (APP_URL)") : undefined;

  assertKeys(config.security, ["allowedRedirectOrigins"], "security");
  assertKeys(config.urls, ["success", "cancel"], "urls");
  const redirects: RedirectPolicy = {
    environment,
    appOrigin: appUrl,
    allowedOrigins: validateAllowedOrigins(config.security?.allowedRedirectOrigins, environment, "security.allowedRedirectOrigins"),
  };
  if (config.urls?.success !== undefined && config.checkout?.successPath !== undefined) {
    throw new PaymentConfigurationError("Set either urls.success or checkout.successPath, not both.");
  }
  if (config.urls?.cancel !== undefined && config.checkout?.cancelPath !== undefined) {
    throw new PaymentConfigurationError("Set either urls.cancel or checkout.cancelPath, not both.");
  }
  const successPath = validateRedirectTemplate(
    config.urls?.success ?? config.checkout?.successPath ?? DEFAULT_SUCCESS_PATH,
    "success",
    redirects,
    config.urls?.success !== undefined ? "urls.success" : "checkout.successPath",
  );
  const cancelPath = validateRedirectTemplate(
    config.urls?.cancel ?? config.checkout?.cancelPath ?? DEFAULT_CANCEL_PATH,
    "cancel",
    redirects,
    config.urls?.cancel !== undefined ? "urls.cancel" : "checkout.cancelPath",
  );

  const clientOptions = validateCheckoutOptions(config.checkout, "client", "checkout");
  const metadataPolicy = resolveMetadataPolicy(config.metadata);
  const products = new ProductRegistry(config.products, resolveQuantityDefaults(config.checkout?.quantity), metadataPolicy);
  const callbacks = validateCallbacks<ProductId<P>>(config.callbacks);
  const maxRetries = resolveNumber(config.network?.maxRetries, 2, 0, 5, "network.maxRetries");
  const timeoutMs = resolveNumber(config.network?.timeoutMs, 20_000, 1_000, 120_000, "network.timeoutMs");
  const toleranceSeconds = resolveNumber(config.webhooks?.toleranceSeconds, 300, 1, 600, "webhooks.toleranceSeconds");
  assertKeys(config.webhooks, ["toleranceSeconds", "eventStore"], "webhooks");

  if (config.storage !== undefined && config.webhooks?.eventStore !== undefined) {
    throw new PaymentConfigurationError("Set either storage or webhooks.eventStore, not both.");
  }
  const storage = toEventGate(config.storage ?? config.webhooks?.eventStore, config.storage ? "storage" : "webhooks.eventStore");

  assertKeys(config.logging, ["logger", "level"], "logging");
  if (config.logging?.logger !== undefined && config.logger !== undefined) {
    throw new PaymentConfigurationError("Set either logger or logging.logger, not both.");
  }
  const level: LogLevel = config.logging?.level ?? "info";
  if (!LOG_LEVELS.has(level)) throw new PaymentConfigurationError('logging.level must be "debug", "info", "warn", "error" or "silent".');
  const hookSets: PaymentHooks[] = [];
  for (const [label, hooks] of [["monitoring", config.monitoring], ["hooks", config.hooks]] as const) {
    assertKeys(hooks, ["onRequest", "onError", "onCheckoutCreated", "onWebhookReceived", "onWebhookProcessed", "onWebhook"], label);
    if (hooks) {
      for (const [name, fn] of Object.entries(hooks)) {
        if (fn !== undefined && typeof fn !== "function") throw new PaymentConfigurationError(`${label}.${name} must be a function.`);
      }
      hookSets.push(hooks);
    }
  }
  const observer = new Observer({ logger: config.logging?.logger ?? config.logger, level, environment, hooks: hookSets });
  if (webhook.status === "placeholder") {
    observer.log("warn", `${webhookSecretLabel} is a placeholder; webhook verification is disabled until a real signing secret is set.`, {});
  }
  const publicMessages = resolvePublicMessages(config.errors);

  // The Stripe SDK is created lazily on first use, never at import time.
  let stripe: Stripe | null = null;
  const getStripe = (): Stripe => {
    stripe ??= new Stripe(secretKey, {
      maxNetworkRetries: maxRetries,
      timeout: timeoutMs,
      telemetry: false,
      appInfo: { name: LIBRARY_NAME, version: LIBRARY_VERSION },
      ...(internal.httpClient ? { httpClient: internal.httpClient } : {}),
    });
    return stripe;
  };

  function describe(error: unknown): PublicErrorInfo {
    if (!isPaymentError(error)) {
      return { code: "internal_error", message: "Something went wrong. Please try again.", statusCode: 500, retryable: false };
    }
    const code: PaymentErrorCode = error.code;
    return {
      code,
      message: publicMessages.get(code) ?? error.publicMessage,
      statusCode: error.statusCode,
      retryable: error.retryable,
    };
  }

  return Object.freeze({
    environment,
    appUrl,
    products: Object.freeze(products),
    checkout: Object.freeze(
      createCheckoutApi<P, M>({
        stripe: getStripe,
        products,
        observer,
        environment,
        redirects,
        successPath,
        cancelPath,
        clientOptions,
        metadataPolicy,
        callbacks,
      }),
    ),
    webhooks: Object.freeze(
      createWebhooksApi({
        stripe: getStripe,
        secret: webhook.secret,
        secretStatus: webhook.status,
        toleranceSeconds,
        storage,
        callbackHandlers: callbackHandlers(callbacks, products),
        observer,
      }),
    ),
    errors: Object.freeze({ describe }),
  });
}
