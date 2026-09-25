import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPaymentClient, PaymentConfigurationError } from "../src/index.js";
import { APP_URL, LIVE_SECRET_KEY, makeClientWith, PRODUCTS, TEST_SECRET_KEY, WEBHOOK_SECRET } from "./helpers.js";

function expectConfigError(fn: () => unknown, pattern: RegExp) {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof PaymentConfigurationError, `expected PaymentConfigurationError, got ${String(error)}`);
    assert.equal(error.code, "configuration_error");
    assert.match(error.message, pattern);
    // Messages must never echo credential values.
    for (const secret of [TEST_SECRET_KEY, LIVE_SECRET_KEY, WEBHOOK_SECRET]) {
      assert.ok(!error.message.includes(secret), "error message leaked a secret");
      assert.ok(!JSON.stringify(error).includes(secret), "serialized error leaked a secret");
    }
    return true;
  });
}

describe("configuration: secret key", () => {
  it("rejects a missing key with a clear message", () => {
    expectConfigError(() => makeClientWith({ products: PRODUCTS }), /STRIPE_SECRET_KEY\) is missing.*test-mode/);
  });

  it("reads STRIPE_SECRET_KEY from the provided env", () => {
    const client = makeClientWith({ products: PRODUCTS, env: { STRIPE_SECRET_KEY: TEST_SECRET_KEY } });
    assert.equal(client.environment, "test");
  });

  it("rejects placeholder keys", () => {
    expectConfigError(() => makeClientWith({ products: PRODUCTS, secretKey: "sk_test_dummy_key" }), /placeholder/);
  });

  it("rejects a publishable key used as secret", () => {
    expectConfigError(() => makeClientWith({ products: PRODUCTS, secretKey: "pk_test_51Abcdefghijklmnopqrstuvwx" }), /publishable/);
  });

  it("rejects malformed keys", () => {
    for (const key of ["sk_test_short", "sk_prod_51Abcdefghijklmnopqrstuvwx", "bearer abc", "sk_test_51Abc def ghijklmnopqrstu"]) {
      expectConfigError(() => makeClientWith({ products: PRODUCTS, secretKey: key }), /malformed/);
    }
  });

  it("rejects a live key in the test environment", () => {
    expectConfigError(() => makeClientWith({ products: PRODUCTS, secretKey: LIVE_SECRET_KEY }), /live-mode key but environment is "test"/);
  });

  it("rejects a test key in production", () => {
    expectConfigError(
      () => makeClientWith({ products: PRODUCTS, secretKey: TEST_SECRET_KEY, environment: "production" }),
      /test-mode key but environment is "production"/,
    );
  });

  it("accepts a live key in production with an https appUrl", () => {
    const client = makeClientWith({ products: PRODUCTS, secretKey: LIVE_SECRET_KEY, environment: "production", appUrl: APP_URL });
    assert.equal(client.environment, "production");
  });

  it("never infers production from the key; environment must be explicit", () => {
    expectConfigError(
      () => makeClientWith({ products: PRODUCTS, env: { STRIPE_SECRET_KEY: LIVE_SECRET_KEY } }),
      /live-mode key/,
    );
  });

  it("rejects unknown environment values", () => {
    expectConfigError(
      () => makeClientWith({ products: PRODUCTS, secretKey: TEST_SECRET_KEY, env: { PAYMENTS_ENVIRONMENT: "prod" } }),
      /environment must be/,
    );
  });
});

describe("configuration: webhook secret", () => {
  it("is optional (webhooks disabled until configured)", () => {
    const client = makeClientWith({ products: PRODUCTS, secretKey: TEST_SECRET_KEY });
    assert.throws(() => client.webhooks.constructEvent("{}", "t=1,v1=abc"), PaymentConfigurationError);
  });

  it("treats a placeholder webhook secret as disabled (checkout still works)", () => {
    const client = makeClientWith({ products: PRODUCTS, secretKey: TEST_SECRET_KEY, webhookSecret: "whsec_dummy_key" });
    expectConfigError(() => client.webhooks.constructEvent("{}", "t=1,v1=abc"), /placeholder/);
  });

  it("rejects malformed (non-placeholder) webhook secrets immediately", () => {
    expectConfigError(() => makeClientWith({ products: PRODUCTS, secretKey: TEST_SECRET_KEY, webhookSecret: "sk_test_abc" }), /whsec_/);
    expectConfigError(() => makeClientWith({ products: PRODUCTS, secretKey: TEST_SECRET_KEY, webhookSecret: "whsec_short" }), /malformed/);
  });
});

describe("configuration: appUrl and redirects", () => {
  const base = { products: PRODUCTS, secretKey: TEST_SECRET_KEY };

  it("rejects dangerous or malformed app URLs", () => {
    for (const appUrl of ["javascript:alert(1)", "data:text/html,x", "ftp://example.com", "not a url", "https://user:pass@example.com", "https://example.com/shop", "https://example.com/?x=1"]) {
      expectConfigError(() => makeClientWith({ ...base, appUrl }), /appUrl/);
    }
  });

  it("requires https (and no localhost) in production", () => {
    const prod = { products: PRODUCTS, secretKey: LIVE_SECRET_KEY, environment: "production" as const };
    expectConfigError(() => makeClientWith({ ...prod, appUrl: "http://shop.example.com" }), /https in production/);
    expectConfigError(() => makeClientWith({ ...prod, appUrl: "https://localhost:3000" }), /localhost/);
  });

  it("allows http://localhost in test", () => {
    const client = makeClientWith({ ...base, appUrl: "http://localhost:3000" });
    assert.equal(client.appUrl, "http://localhost:3000");
  });

  it("rejects off-origin redirect templates (open redirect protection)", () => {
    for (const successPath of ["//evil.com/?session_id={CHECKOUT_SESSION_ID}", "https://evil.com/{CHECKOUT_SESSION_ID}", "/\\evil.com/{CHECKOUT_SESSION_ID}", "javascript:alert(1)//{CHECKOUT_SESSION_ID}", "/ok {CHECKOUT_SESSION_ID}"]) {
      expectConfigError(() => makeClientWith({ ...base, appUrl: APP_URL, checkout: { successPath } }), /successPath/);
    }
  });

  // 0.2.0: a success path without {CHECKOUT_SESSION_ID} gets session_id appended
  // (previously a configuration error). Verified end-to-end in customization.test.ts.
  it("accepts a success path without {CHECKOUT_SESSION_ID} (session_id is appended)", () => {
    const client = makeClientWith({ ...base, checkout: { successPath: "/thanks" } });
    assert.equal(client.environment, "test");
  });
});

describe("configuration: products", () => {
  const base = { secretKey: TEST_SECRET_KEY };

  it("normalizes products and exposes typed lookups", () => {
    const client = makeClientWith({ ...base, products: PRODUCTS });
    const pro = client.products.get("pro");
    assert.equal(pro.currency, "usd");
    assert.equal(pro.price, 2999);
    assert.equal(client.products.list().length, 3);
    assert.ok(Object.isFrozen(pro));
  });

  it("rejects invalid catalogs", () => {
    const cases: [unknown, RegExp][] = [
      [{}, /at least one product/],
      [[], /plain object/],
      [{ "bad id!": { name: "x", price: 100, currency: "usd" } }, /product IDs/],
      [{ a: { name: "", price: 100, currency: "usd" } }, /name/],
      [{ a: { name: "A", price: 19.99, currency: "usd" } }, /positive integer/],
      [{ a: { name: "A", price: -100, currency: "usd" } }, /positive integer/],
      [{ a: { name: "A", price: "100", currency: "usd" } }, /positive integer/],
      [{ a: { name: "A", price: Number.MAX_SAFE_INTEGER + 1, currency: "usd" } }, /positive integer/],
      [{ a: { name: "A", price: 100_000_000, currency: "usd" } }, /maximum/],
      [{ a: { name: "A", price: 10, currency: "usd" } }, /minimum charge/],
      [{ a: { name: "A", price: 100, currency: "dollars" } }, /ISO 4217/],
      [{ a: { name: "A", price: 100, currency: "zzz" } }, /ISO 4217/],
      [{ a: { name: "A", price: 100, currency: "usd", maxQuantity: 0 } }, /maxQuantity/],
      [{ a: { name: "A", price: 100, currency: "usd", minQuantity: 5, maxQuantity: 2 } }, /minQuantity/],
    ];
    for (const [products, pattern] of cases) {
      // Deliberately untyped input: the library must validate at runtime.
      expectConfigError(() => createPaymentClient({ ...base, env: {}, logger: false, products: products as never }), pattern);
    }
  });

  it("ignores inherited properties and rejects __proto__ keys from JSON", () => {
    const hostile: unknown = JSON.parse('{"__proto__": {"name":"x","price":100,"currency":"usd"}}');
    expectConfigError(() => createPaymentClient({ ...base, env: {}, logger: false, products: hostile as never }), /product IDs/);
  });

  it("validates quantity defaults and network settings", () => {
    expectConfigError(() => makeClientWith({ ...base, products: PRODUCTS, checkout: { quantity: { min: 0 } } }), /quantity\.min/);
    expectConfigError(() => makeClientWith({ ...base, products: PRODUCTS, network: { maxRetries: 50 } }), /maxRetries/);
    expectConfigError(() => makeClientWith({ ...base, products: PRODUCTS, webhooks: { toleranceSeconds: 0 } }), /toleranceSeconds/);
  });
});

describe("configuration: browser guard", () => {
  it("refuses to run where window and document exist", () => {
    const g = globalThis as Record<string, unknown>;
    g.window = {};
    g.document = {};
    try {
      expectConfigError(() => makeClientWith({ products: PRODUCTS, secretKey: TEST_SECRET_KEY }), /server-only/);
    } finally {
      delete g.window;
      delete g.document;
    }
  });
});
