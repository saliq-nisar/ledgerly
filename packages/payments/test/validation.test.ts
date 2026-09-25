import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PaymentError, PaymentValidationError } from "../src/index.js";
import { multiplyAmount } from "../src/money/money.js";
import { redactFields, redactString } from "../src/security/redact.js";
import { validateMetadata } from "../src/validation/validation.js";
import { makeClient, prng, randomValue } from "./helpers.js";

const { payments } = makeClient();

function expectValidation(fn: () => unknown, code: string) {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof PaymentValidationError, `expected PaymentValidationError, got ${String(error)}`);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, 400);
    return true;
  });
}

describe("checkout.parse: products", () => {
  it("accepts a known product and defaults quantity to 1", () => {
    assert.deepEqual(payments.checkout.parse({ productId: "pro" }), { productId: "pro", quantity: 1 });
  });

  it("rejects unknown, tampered and prototype product IDs", () => {
    for (const productId of ["enterprise", "PRO", "pro ", " pro", "pro\u0000", "__proto__", "constructor", "toString", "hasOwnProperty", "", 1, null, true, ["pro"], { id: "pro" }]) {
      expectValidation(() => payments.checkout.parse({ productId }), "invalid_product");
    }
  });

  it("products.get/has are safe with any input", () => {
    for (const id of ["__proto__", "constructor", "valueOf", {}, null, undefined, 42]) {
      assert.equal(payments.products.get(id), undefined);
      assert.equal(payments.products.has(id), false);
    }
  });
});

describe("checkout.parse: quantity", () => {
  it("accepts integers within limits", () => {
    assert.equal(payments.checkout.parse({ productId: "pro", quantity: 1 }).quantity, 1);
    assert.equal(payments.checkout.parse({ productId: "pro", quantity: 10 }).quantity, 10);
    assert.equal(payments.checkout.parse({ productId: "bulk", quantity: 100 }).quantity, 100);
  });

  it("rejects everything else", () => {
    const bad: unknown[] = [0, -1, 11, 1.5, 0.1, NaN, Infinity, -Infinity, 1e21, Number.MAX_SAFE_INTEGER + 1, "1", "", null, true, [], {}, [1]];
    for (const quantity of bad) {
      expectValidation(() => payments.checkout.parse({ productId: "pro", quantity }), "invalid_quantity");
    }
  });

  it("honours per-product limits", () => {
    expectValidation(() => payments.checkout.parse({ productId: "bulk", quantity: 101 }), "invalid_quantity");
  });
});

describe("checkout.parse: body shape", () => {
  it("rejects client attempts to set price, amount or currency", () => {
    for (const field of ["amount", "price", "unit_amount", "currency", "success_url", "metadata"]) {
      expectValidation(() => payments.checkout.parse({ productId: "pro", quantity: 1, [field]: 1 }), "unexpected_field");
    }
  });

  it("rejects __proto__ smuggled via JSON", () => {
    const body: unknown = JSON.parse('{"productId":"pro","__proto__":{"amount":1}}');
    expectValidation(() => payments.checkout.parse(body), "unexpected_field");
  });

  it("rejects non-object bodies", () => {
    for (const body of [null, undefined, "pro", 1, [], [{ productId: "pro" }]]) {
      expectValidation(() => payments.checkout.parse(body), "invalid_request");
    }
  });
});

describe("property: arbitrary input never escapes validation", () => {
  it("parse either returns a valid request or throws PaymentValidationError", () => {
    const rand = prng(1337);
    for (let i = 0; i < 5000; i++) {
      const body = randomValue(rand);
      try {
        const parsed = payments.checkout.parse(body);
        assert.ok(payments.products.has(parsed.productId));
        const product = payments.products.get(parsed.productId);
        assert.ok(Number.isSafeInteger(parsed.quantity));
        assert.ok(parsed.quantity >= product.minQuantity && parsed.quantity <= product.maxQuantity);
      } catch (error) {
        assert.ok(error instanceof PaymentValidationError, `unexpected ${String(error)} for ${JSON.stringify(body)}`);
      }
    }
  });

  it("random JSON strings parsed then validated fail safely", () => {
    const rand = prng(42);
    const alphabet = '{}[]":,0123456789.-eproductIdquantity_ __';
    for (let i = 0; i < 3000; i++) {
      const text = Array.from({ length: Math.floor(rand() * 60) }, () => alphabet[Math.floor(rand() * alphabet.length)]).join("");
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        continue;
      }
      try {
        payments.checkout.parse(body);
      } catch (error) {
        assert.ok(error instanceof PaymentError);
      }
    }
  });
});

describe("metadata", () => {
  it("accepts reasonable server metadata", () => {
    assert.deepEqual(validateMetadata({ orderId: "ord_123", plan_source: "pricing-page" }), { orderId: "ord_123", plan_source: "pricing-page" });
  });

  it("rejects reserved, sensitive, oversized or malformed metadata", () => {
    const cases: unknown[] = [
      { productId: "x" },
      { quantity: "99" },
      { cardNumber: "x" },
      { cvc: "123" },
      { password: "x" },
      { apiKey: "x" },
      { note: "4242 4242 4242 4242" },
      { note: "key sk_test_abc" },
      { note: "x".repeat(501) },
      { "bad key": "x" },
      { n: 1 },
      Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, "v"])),
      [],
      "x",
      new Map(),
    ];
    for (const metadata of cases) {
      assert.throws(() => validateMetadata(metadata), (e: unknown) => e instanceof PaymentValidationError && e.code === "invalid_metadata");
    }
  });

  it("property: random metadata never passes with non-string values", () => {
    const rand = prng(7);
    for (let i = 0; i < 2000; i++) {
      const value = randomValue(rand);
      try {
        const out = validateMetadata(value);
        for (const v of Object.values(out)) assert.equal(typeof v, "string");
      } catch (error) {
        assert.ok(error instanceof PaymentValidationError);
      }
    }
  });
});

describe("money", () => {
  it("multiplies integer minor units exactly", () => {
    assert.equal(multiplyAmount(2999, 3), 8997);
    assert.equal(multiplyAmount(1, 1), 1);
  });

  it("rejects totals above Stripe's limit or unsafe integers", () => {
    assert.throws(() => multiplyAmount(99_999_999, 2), (e: unknown) => e instanceof PaymentValidationError && e.code === "amount_too_large");
    assert.throws(() => multiplyAmount(Number.MAX_SAFE_INTEGER, 2), PaymentValidationError);
  });
});

describe("redaction", () => {
  it("masks secrets and card numbers in strings", () => {
    const out = redactString("key sk_test_51Abcdef and whsec_abc123 card 4242 4242 4242 4242 Bearer abc.def");
    assert.ok(!/sk_test_51|whsec_abc|4242 4242|Bearer abc/.test(out), out);
  });

  it("drops sensitive field names", () => {
    const out = redactFields({ authorization: "x", stripeSignature: "y", cookie: "z", eventId: "evt_1" });
    assert.deepEqual(out, { authorization: "[REDACTED]", stripeSignature: "[REDACTED]", cookie: "[REDACTED]", eventId: "evt_1" });
  });
});

describe("errors", () => {
  it("have stable names that survive minification", async () => {
    const errors = await import("../src/errors/errors.js");
    const instances = [
      new errors.PaymentConfigurationError("x"),
      new errors.PaymentValidationError({ code: "invalid_request", message: "x" }),
      new errors.PaymentAuthenticationError({ source: "stripe" }),
      new errors.PaymentRateLimitError(),
      new errors.PaymentNetworkError({ source: "network" }),
      new errors.PaymentNotFoundError("x"),
      new errors.PaymentProviderError("x"),
      new errors.PaymentWebhookError("webhook_signature_invalid", "x"),
    ];
    for (const error of instances) {
      assert.equal(error.name, error.constructor.name);
      assert.ok(error instanceof PaymentError);
      assert.equal(JSON.parse(JSON.stringify(error)).name, error.name);
    }
  });
});
