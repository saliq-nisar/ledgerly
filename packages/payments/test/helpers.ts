import Stripe from "stripe";

import {
  createPaymentClientInternal,
  type PaymentClient,
} from "../src/client/create-client.js";
import type { LogFields } from "../src/security/redact.js";
import type { PaymentClientConfig, PaymentLogger, ProductCatalog } from "../src/types/public.js";

// Fake, format-valid keys. Assembled at runtime so the source never holds a
// contiguous Stripe-key-shaped literal that secret scanners would flag.
const fakeSecretKey = (mode: "test" | "live") => `sk_${mode}_` + "FakeFixtureKeyNotARealSecret0000";
export const TEST_SECRET_KEY = fakeSecretKey("test");
export const LIVE_SECRET_KEY = fakeSecretKey("live");
export const WEBHOOK_SECRET = "whsec_testSigningSecretAbcdefghijklmnop";
export const APP_URL = "https://shop.example.com";

export const PRODUCTS = {
  basic: { name: "Basic", price: 999, currency: "usd", description: "Starter plan" },
  pro: { name: "Professional", price: 2999, currency: "USD" },
  bulk: { name: "Bulk", price: 5000, currency: "eur", maxQuantity: 100 },
} as const;

/* ------------------------------------------------------------- fake Stripe */

export interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  params: URLSearchParams;
  signal: AbortSignal | undefined;
}

export type Responder = (request: RecordedRequest, attempt: number) => Response | Promise<Response>;

export function stripeJson(body: unknown, status = 200, requestId = "req_test123"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Request-Id": requestId },
  });
}

export function stripeError(status: number, type: string, code?: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: { type, ...(code ? { code } : {}), message: `mock ${type}` } }), {
    status,
    headers: { "Content-Type": "application/json", "Request-Id": "req_err456", ...extraHeaders },
  });
}

export function fakeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_test_a1B2c3D4e5F6g7H8i9J0",
    object: "checkout.session",
    url: "https://checkout.stripe.com/c/pay/cs_test_a1B2c3D4e5F6g7H8i9J0",
    expires_at: 1_900_000_000,
    created: 1_800_000_000,
    amount_total: 2999,
    currency: "usd",
    payment_status: "paid",
    status: "complete",
    payment_intent: "pi_test_123",
    client_reference_id: null,
    customer_details: { email: "buyer@example.com" },
    metadata: { productId: "pro", quantity: "1", orderId: "ord_1" },
    line_items: { object: "list", data: [{ quantity: 1, description: "Professional" }] },
    ...overrides,
  };
}

export function createFakeStripe(responder: Responder): { requests: RecordedRequest[]; httpClient: Stripe.HttpClient } {
  const requests: RecordedRequest[] = [];
  const fetchFn = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const body = typeof init?.body === "string" ? init.body : "";
    const request: RecordedRequest = {
      method: init?.method ?? "GET",
      url,
      headers: new Headers(init?.headers),
      params: new URLSearchParams(init?.method === "GET" ? url.search : body),
      signal: init?.signal ?? undefined,
    };
    requests.push(request);
    return responder(request, requests.length);
  };
  return { requests, httpClient: Stripe.createFetchHttpClient(fetchFn as typeof fetch) };
}

/* ------------------------------------------------------------------ logger */

export function captureLogger() {
  const lines: { level: string; message: string; fields: LogFields }[] = [];
  const push = (level: string) => (message: string, fields: LogFields) => lines.push({ level, message, fields });
  const logger: PaymentLogger = { debug: push("debug"), info: push("info"), warn: push("warn"), error: push("error") };
  return { lines, logger, text: () => JSON.stringify(lines) };
}

/* ------------------------------------------------------------------ client */

type TestConfig = Partial<PaymentClientConfig<typeof PRODUCTS>>;

export function makeClient(
  overrides: TestConfig = {},
  responder: Responder = () => stripeJson(fakeSession()),
): { payments: PaymentClient<typeof PRODUCTS>; requests: RecordedRequest[]; logs: ReturnType<typeof captureLogger> } {
  const fake = createFakeStripe(responder);
  const logs = captureLogger();
  const payments = createPaymentClientInternal(
    {
      products: PRODUCTS,
      secretKey: TEST_SECRET_KEY,
      webhookSecret: WEBHOOK_SECRET,
      appUrl: APP_URL,
      env: {},
      logger: logs.logger,
      ...overrides,
      // Short SDK timeout: some Stripe SDK error paths leave their timeout timer armed,
      // which would otherwise keep the test process alive for the full default.
      network: { maxRetries: 0, timeoutMs: 2000, ...overrides.network },
    },
    { httpClient: fake.httpClient },
  );
  return { payments, requests: fake.requests, logs };
}

export function makeClientWith<P extends ProductCatalog>(config: PaymentClientConfig<P>) {
  return createPaymentClientInternal({ env: {}, logger: false, ...config });
}

/** Signs a payload exactly like Stripe does. */
export function signPayload(payload: string, secret = WEBHOOK_SECRET, timestamp?: number): string {
  const stripe = new Stripe(TEST_SECRET_KEY);
  return stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    ...(timestamp !== undefined ? { timestamp } : {}),
  });
}

export function eventPayload(type: string, object: Record<string, unknown> = {}, id = "evt_test_1"): string {
  return JSON.stringify({
    id,
    object: "event",
    type,
    api_version: "2025-01-01",
    created: 1_800_000_000,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: { object: { id: "cs_test_x", object: "checkout.session", ...object } },
  });
}

/** Deterministic PRNG for property/fuzz tests (mulberry32). */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generates arbitrary JSON-ish values, including hostile shapes. */
export function randomValue(rand: () => number, depth = 0): unknown {
  const pick = Math.floor(rand() * 16);
  const specials: unknown[] = [
    0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 2, 1e308, -0, "", "1", "__proto__",
    "constructor", "toString", null, undefined, true, false, [], {}, "pro ", "PRO", "pro\u0000", "../pro",
  ];
  switch (pick) {
    case 0: case 1: case 2: return specials[Math.floor(rand() * specials.length)];
    case 3: return Math.floor(rand() * 2e6) - 1e6;
    case 4: return rand() * 1000 - 500;
    case 5: return String.fromCharCode(...Array.from({ length: Math.floor(rand() * 20) }, () => Math.floor(rand() * 0xffff)));
    case 6: return Math.floor(rand() * 20);
    case 7: {
      if (depth > 2) return null;
      return Array.from({ length: Math.floor(rand() * 4) }, () => randomValue(rand, depth + 1));
    }
    default: {
      if (depth > 2) return {};
      const obj: Record<string, unknown> = {};
      const keys = ["productId", "quantity", "amount", "price", "currency", "__proto__", "constructor", "x"];
      for (let i = 0; i < Math.floor(rand() * 4); i++) {
        obj[keys[Math.floor(rand() * keys.length)]!] = randomValue(rand, depth + 1);
      }
      return obj;
    }
  }
}

/** Client with arbitrary products/config plus a fake Stripe and captured logs. */
export function makeCustomClient<const P extends ProductCatalog, const M extends string = string>(
  config: PaymentClientConfig<P, M>,
  responder: Responder = () => stripeJson(fakeSession()),
) {
  const fake = createFakeStripe(responder);
  const logs = captureLogger();
  const payments = createPaymentClientInternal<P, M>(
    {
      secretKey: TEST_SECRET_KEY,
      webhookSecret: WEBHOOK_SECRET,
      appUrl: APP_URL,
      env: {},
      ...(config.logger === undefined && config.logging === undefined ? { logger: logs.logger } : {}),
      ...config,
      network: { maxRetries: 0, timeoutMs: 2000, ...config.network },
    },
    { httpClient: fake.httpClient },
  );
  return { payments, requests: fake.requests, logs };
}
