import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PaymentAuthenticationError,
  PaymentConfigurationError,
  PaymentNetworkError,
  PaymentNotFoundError,
  PaymentProviderError,
  PaymentRateLimitError,
  PaymentValidationError,
  type OperationInfo,
} from "../src/index.js";
import { fakeSession, makeClient, stripeError, stripeJson, TEST_SECRET_KEY, WEBHOOK_SECRET } from "./helpers.js";

describe("checkout.create", () => {
  it("prices the session from the catalog and returns only id/url", async () => {
    const { payments, requests } = makeClient();
    const result = await payments.checkout.create({ productId: "pro", quantity: 3 });

    assert.deepEqual(Object.keys(result).sort(), ["expiresAt", "id", "requestId", "url"]);
    assert.equal(result.id, "cs_test_a1B2c3D4e5F6g7H8i9J0");
    assert.ok(result.url.startsWith("https://checkout.stripe.com/"));

    assert.equal(requests.length, 1);
    const { params, url, method } = requests[0]!;
    assert.equal(method, "POST");
    assert.equal(url.pathname, "/v1/checkout/sessions");
    assert.equal(params.get("mode"), "payment");
    assert.equal(params.get("line_items[0][price_data][unit_amount]"), "2999");
    assert.equal(params.get("line_items[0][price_data][currency]"), "usd");
    assert.equal(params.get("line_items[0][quantity]"), "3");
    assert.equal(params.get("metadata[productId]"), "pro");
    assert.equal(params.get("metadata[quantity]"), "3");
    assert.equal(params.get("success_url"), "https://shop.example.com/payment/success?session_id={CHECKOUT_SESSION_ID}");
    assert.equal(params.get("cancel_url"), "https://shop.example.com/payment/cancelled?product=pro");
  });

  it("validates input at runtime even when types are bypassed", async () => {
    const { payments, requests } = makeClient();
    const untyped: unknown[] = [
      { productId: "nope" },
      { productId: "pro", quantity: 0 },
      { productId: "pro", quantity: "2" },
      { productId: "pro", metadata: { cardNumber: "x" } },
      { productId: "pro", customerEmail: "not-an-email" },
      { productId: "pro", idempotencyKey: "short" },
      { productId: "pro", clientReferenceId: "has spaces" },
      null,
    ];
    for (const input of untyped) {
      await assert.rejects(payments.checkout.create(input as never), PaymentValidationError);
    }
    assert.equal(requests.length, 0, "invalid input must never reach Stripe");
  });

  it("rejects totals over Stripe's maximum", async () => {
    const { payments } = makeClient({
      products: { big: { name: "Big", price: 90_000_000, currency: "usd", maxQuantity: 5 } } as never,
    });
    await assert.rejects(payments.checkout.create({ productId: "big" as never, quantity: 2 }), (e: unknown) => e instanceof PaymentValidationError && e.code === "amount_too_large");
  });

  it("requires appUrl to build redirect URLs", async () => {
    const { payments } = makeClient({ appUrl: undefined });
    await assert.rejects(payments.checkout.create({ productId: "pro" }), PaymentConfigurationError);
  });

  it("forwards a caller-supplied idempotency key", async () => {
    const { payments, requests } = makeClient();
    await payments.checkout.create({ productId: "pro", idempotencyKey: "attempt-7f3a9c21" });
    assert.equal(requests[0]!.headers.get("idempotency-key"), "attempt-7f3a9c21");
  });

  it("maps Stripe idempotency conflicts to a 409 validation error", async () => {
    const { payments } = makeClient({}, () => stripeError(400, "idempotency_error"));
    await assert.rejects(
      payments.checkout.create({ productId: "pro", idempotencyKey: "attempt-7f3a9c21" }),
      (e: unknown) => e instanceof PaymentValidationError && e.code === "idempotency_conflict" && e.statusCode === 409,
    );
  });

  it("does not merge separate purchases: no key is derived from product/quantity", async () => {
    const { payments, requests } = makeClient();
    await payments.checkout.create({ productId: "pro" });
    await payments.checkout.create({ productId: "pro" });
    assert.equal(requests.length, 2);
    const keys = requests.map((r) => r.headers.get("idempotency-key"));
    assert.ok(keys.every((k) => k === null || k.startsWith("stripe-node-retry-")));
    assert.ok(keys[0] === null || keys[0] !== keys[1]);
  });

  it("retries transient failures with the same idempotency key (no duplicate session)", async () => {
    const { payments, requests } = makeClient({ network: { maxRetries: 1 } }, (_req, attempt) =>
      attempt === 1 ? stripeError(500, "api_error") : stripeJson(fakeSession()),
    );
    const result = await payments.checkout.create({ productId: "pro" });
    assert.equal(result.id, "cs_test_a1B2c3D4e5F6g7H8i9J0");
    assert.equal(requests.length, 2);
    const [first, second] = requests.map((r) => r.headers.get("idempotency-key"));
    assert.ok(first && first === second, "retry must reuse the idempotency key");
  });

  it("names the rejected Stripe parameter (never its value) for debugging", async () => {
    const { payments } = makeClient({}, () =>
      new Response(JSON.stringify({ error: { type: "invalid_request_error", param: "consent_collection[promotions]", message: "not available for buyer@example.com" } }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Request-Id": "req_p1" },
      }),
    );
    await assert.rejects(payments.checkout.create({ productId: "pro" }), (e: unknown) => {
      assert.ok(e instanceof PaymentProviderError);
      assert.match(e.message, /param: consent_collection\[promotions\]/);
      assert.equal(e.cause?.param, "consent_collection[promotions]");
      assert.ok(!JSON.stringify(e).includes("buyer@example.com") && !e.message.includes("not available"), "Stripe's message is not copied");
      return true;
    });
  });

  it("does not retry non-retryable errors", async () => {
    const { payments, requests } = makeClient({ network: { maxRetries: 2 } }, () => stripeError(400, "invalid_request_error", "parameter_invalid_integer"));
    await assert.rejects(payments.checkout.create({ productId: "pro" }), (e: unknown) => e instanceof PaymentProviderError && !e.retryable);
    assert.equal(requests.length, 1);
  });

  it("normalizes Stripe failures into typed errors", async () => {
    const cases: [Response, new (...args: never[]) => Error, boolean][] = [
      [stripeError(401, "invalid_request_error"), PaymentAuthenticationError, false],
      [stripeError(403, "invalid_request_error"), PaymentAuthenticationError, false],
      [stripeError(429, "rate_limit_error"), PaymentRateLimitError, true],
      [stripeError(500, "api_error"), PaymentProviderError, true],
    ];
    for (const [response, ErrorClass, retryable] of cases) {
      const { payments } = makeClient({}, () => response.clone());
      await assert.rejects(payments.checkout.create({ productId: "pro" }), (e: unknown) => {
        assert.ok(e instanceof ErrorClass, `expected ${ErrorClass.name}, got ${String(e)}`);
        assert.equal((e as PaymentProviderError).retryable, retryable);
        assert.equal((e as PaymentProviderError).stripeRequestId, "req_err456");
        return true;
      });
    }
  });

  it("maps network failures and timeouts to PaymentNetworkError", async () => {
    // Short timeout: the Stripe SDK keeps its timeout timer alive after a fetch rejection.
    const { payments } = makeClient({ network: { maxRetries: 0, timeoutMs: 1000 } }, () => {
      throw new TypeError("fetch failed");
    });
    await assert.rejects(payments.checkout.create({ productId: "pro" }), (e: unknown) => e instanceof PaymentNetworkError && e.retryable);
  });

  it("maps request timeouts to PaymentNetworkError", async () => {
    const { payments } = makeClient({ network: { maxRetries: 0, timeoutMs: 1000 } }, (req) =>
      // Behaves like a real fetch that never answers until aborted by the SDK's timeout.
      new Promise<Response>((_, reject) => req.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    );
    await assert.rejects(payments.checkout.create({ productId: "pro" }), (e: unknown) => e instanceof PaymentNetworkError);
  });

  it("fails safely if Stripe returns no redirect URL", async () => {
    const { payments } = makeClient({}, () => stripeJson(fakeSession({ url: null })));
    await assert.rejects(payments.checkout.create({ productId: "pro" }), PaymentProviderError);
  });

  it("reports operations to hooks with correlation IDs, and hook failures are contained", async () => {
    const seen: OperationInfo[] = [];
    const { payments } = makeClient({
      hooks: {
        onRequest: (info) => {
          seen.push(info);
          throw new Error("monitoring is down");
        },
        onError: async () => {
          throw new Error("also down");
        },
      },
    });
    await payments.checkout.create({ productId: "pro", requestId: "req-abc-123" });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(seen[0]?.operation, "checkout.create");
    assert.equal(seen[0]?.requestId, "req-abc-123");
    assert.equal(seen[0]?.stripeRequestId, "req_test123");
    assert.equal(seen[0]?.outcome, "success");
  });

  it("never leaks the secret key into errors or logs", async () => {
    const { payments, logs } = makeClient({}, () => stripeError(401, "invalid_request_error"));
    let caught: unknown;
    try {
      await payments.checkout.create({ productId: "pro" });
    } catch (error) {
      caught = error;
    }
    const surfaces = [String(caught), JSON.stringify(caught), (caught as Error).stack ?? "", JSON.stringify((caught as Error).cause), logs.text()];
    for (const text of surfaces) {
      assert.ok(!text.includes(TEST_SECRET_KEY), "secret key leaked");
      assert.ok(!text.includes(WEBHOOK_SECRET), "webhook secret leaked");
      assert.ok(!text.includes("Bearer"), "authorization header leaked");
    }
    assert.ok(logs.lines.some((l) => l.fields.errorCode === "authentication_failed"));
  });
});

describe("checkout.retrieve", () => {
  it("returns a trusted summary from Stripe", async () => {
    const { payments, requests } = makeClient();
    const summary = await payments.checkout.retrieve("cs_test_a1B2c3D4e5F6g7H8i9J0");
    assert.equal(summary.status, "paid");
    assert.equal(summary.product?.id, "pro");
    assert.equal(summary.amountTotal, 2999);
    assert.equal(summary.paymentIntentId, "pi_test_123");
    assert.deepEqual(summary.metadata, { orderId: "ord_1" });
    assert.equal(requests[0]!.method, "GET");
    assert.equal(requests[0]!.url.searchParams.get("expand[0]"), "line_items");
  });

  it("maps session states", async () => {
    const states: [Record<string, unknown>, string][] = [
      [{ payment_status: "unpaid", status: "complete" }, "processing"],
      [{ payment_status: "unpaid", status: "open" }, "unpaid"],
      [{ payment_status: "unpaid", status: "expired" }, "expired"],
      [{ payment_status: "no_payment_required", status: "complete" }, "paid"],
    ];
    for (const [overrides, status] of states) {
      const { payments } = makeClient({}, () => stripeJson(fakeSession(overrides)));
      assert.equal((await payments.checkout.retrieve("cs_test_a1B2c3D4e5F6g7H8i9J0")).status, status);
    }
  });

  it("rejects malformed or wrong-environment session IDs without calling Stripe", async () => {
    const { payments, requests } = makeClient();
    for (const id of ["", "cs_test_short", "pi_test_a1B2c3D4e5F6g7H8", "cs_live_a1B2c3D4e5F6g7H8i9J0", "cs_test_a1B2c3D4e5F6/../x", "cs_test_a1B2c3D4e5F6?x=1"]) {
      await assert.rejects(payments.checkout.retrieve(id), (e: unknown) => e instanceof PaymentValidationError && e.code === "invalid_session_id");
    }
    assert.equal(requests.length, 0);
  });

  it("maps missing sessions to PaymentNotFoundError", async () => {
    const { payments } = makeClient({}, () => stripeError(404, "invalid_request_error", "resource_missing"));
    await assert.rejects(payments.checkout.retrieve("cs_test_a1B2c3D4e5F6g7H8i9J0"), PaymentNotFoundError);
  });

  it("returns product null for sessions referencing unknown products", async () => {
    const { payments } = makeClient({}, () => stripeJson(fakeSession({ metadata: { productId: "__proto__" } })));
    const summary = await payments.checkout.retrieve("cs_test_a1B2c3D4e5F6g7H8i9J0");
    assert.equal(summary.product, null);
  });
});
