import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCheckoutHandler, createWebhookHandler } from "../src/adapters/web.js";
import {
  createPaymentClient,
  defineProducts,
  PaymentConfigurationError,
  PaymentErrorCodes,
  PaymentValidationError,
  PaymentWebhookError,
  rejectCheckout,
  type BeforeCheckoutContext,
  type CheckoutCreatedInfo,
  type PaymentAttemptFailure,
  type PaymentOutcome,
  type ProcessedEventStorage,
  type ProductId,
  type WebhookInfo,
  type WebhookReceivedInfo,
  type WebhooksApi,
} from "../src/index.js";
import {
  APP_URL,
  eventPayload,
  fakeSession,
  LIVE_SECRET_KEY,
  makeCustomClient,
  prng,
  randomValue,
  signPayload,
  stripeJson,
  TEST_SECRET_KEY,
  WEBHOOK_SECRET,
  type RecordedRequest,
} from "./helpers.js";

const CATALOG = defineProducts({
  basic: { name: "Basic", description: "Basic plan", price: 999, currency: "usd" },
  pro: {
    name: "Professional",
    price: 2999,
    currency: "usd",
    images: ["https://cdn.example.com/pro.png"],
    taxBehavior: "exclusive",
    taxCode: "txcd_10103001",
    metadata: { tier: "pro" },
    checkout: { allowPromotionCodes: true, customText: { submit: "Pro plan terms apply." } },
  },
  retired: { name: "Retired", price: 500, currency: "usd", active: false },
});

const SESSION_ID = "cs_test_a1B2c3D4e5F6g7H8i9J0";

function params(requests: RecordedRequest[]): URLSearchParams {
  const last = requests.findLast((r) => r.url.pathname === "/v1/checkout/sessions");
  assert.ok(last, "expected a checkout session request");
  return last.params;
}

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (e: unknown) => {
    assert.ok(e instanceof Error && "code" in e, `expected PaymentError, got ${String(e)}`);
    assert.equal((e as { code: string }).code, code);
    return true;
  });
}

/* ------------------------------------------------------ backwards compat */

describe("backwards compatibility", () => {
  it("the original minimal integration still works unchanged", async () => {
    const products = defineProducts({ test_product: { name: "Test Product", price: 1999, currency: "usd" } });
    const payments = createPaymentClient({
      environment: "test",
      products,
      secretKey: TEST_SECRET_KEY,
      appUrl: APP_URL,
      env: {},
      logger: false,
    });
    const id: ProductId<typeof products> = "test_product";
    assert.equal(payments.products.get(id).price, 1999);
    assert.equal(typeof createCheckoutHandler(payments), "function");
    assert.equal(typeof createWebhookHandler(payments), "function");
  });

  it("defaults are unchanged: submit_type=pay, no optional Stripe params", async () => {
    const { payments, requests } = makeCustomClient({ products: CATALOG });
    await payments.checkout.create({ productId: "basic" });
    const p = params(requests);
    assert.equal(p.get("submit_type"), "pay");
    for (const key of ["allow_promotion_codes", "billing_address_collection", "locale", "automatic_tax[enabled]", "expires_at", "customer_email"]) {
      assert.equal(p.get(key), null, `${key} should not be sent by default`);
    }
    assert.equal(p.get("success_url"), `${APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`);
  });
});

/* ------------------------------------------------------ checkout options */

describe("checkout options", () => {
  it("maps every client-wide option explicitly to Stripe parameters", async () => {
    const { payments, requests } = makeCustomClient({
      products: CATALOG,
      checkout: {
        mode: "payment",
        allowPromotionCodes: true,
        collectBillingAddress: true,
        collectShippingAddress: { allowedCountries: ["US", "CA", "US"] },
        collectPhoneNumber: true,
        automaticTax: true,
        submitType: "donate",
        locale: "fr-CA",
        createInvoice: true,
        customerCreation: "always",
        consentCollection: { termsOfService: true, promotions: false },
        customText: { submit: "Thanks!", afterSubmit: "We'll email you." },
        customFields: [
          { key: "company", label: "Company", type: "text", optional: true, maxLength: 80 },
          { key: "size", label: "Team size", type: "dropdown", options: [{ label: "1-10", value: "small" }, { label: "11+", value: "large" }] },
        ],
        expiresInMinutes: 45,
      },
    });
    const before = Math.floor(Date.now() / 1000);
    await payments.checkout.create({ productId: "basic" });
    const p = params(requests);
    assert.equal(p.get("mode"), "payment");
    assert.equal(p.get("allow_promotion_codes"), "true");
    assert.equal(p.get("billing_address_collection"), "required");
    assert.deepEqual(p.getAll("shipping_address_collection[allowed_countries][]").length || [p.get("shipping_address_collection[allowed_countries][0]"), p.get("shipping_address_collection[allowed_countries][1]")].filter(Boolean).length, 2);
    assert.equal(p.get("phone_number_collection[enabled]"), "true");
    assert.equal(p.get("automatic_tax[enabled]"), "true");
    assert.equal(p.get("submit_type"), "donate");
    assert.equal(p.get("locale"), "fr-CA");
    assert.equal(p.get("invoice_creation[enabled]"), "true");
    assert.equal(p.get("customer_creation"), "always");
    assert.equal(p.get("consent_collection[terms_of_service]"), "required");
    assert.equal(p.get("consent_collection[promotions]"), null, "false is Stripe's default and is omitted");
    assert.equal(p.get("custom_text[submit][message]"), "Thanks!");
    assert.equal(p.get("custom_text[after_submit][message]"), "We'll email you.");
    assert.equal(p.get("custom_fields[0][key]"), "company");
    assert.equal(p.get("custom_fields[0][label][custom]"), "Company");
    assert.equal(p.get("custom_fields[0][text][maximum_length]"), "80");
    assert.equal(p.get("custom_fields[1][dropdown][options][1][value]"), "large");
    const expiresAt = Number(p.get("expires_at"));
    assert.ok(expiresAt >= before + 45 * 60 && expiresAt <= before + 45 * 60 + 5);
  });

  it("inherits client → product → call, option by option", async () => {
    const { payments, requests } = makeCustomClient({
      products: CATALOG,
      checkout: { locale: "de", allowPromotionCodes: false, customText: { afterSubmit: "global after" } },
    });

    await payments.checkout.create({ productId: "basic" });
    assert.equal(params(requests).get("allow_promotion_codes"), "false");
    assert.equal(params(requests).get("locale"), "de");

    await payments.checkout.create({ productId: "pro" });
    let p = params(requests);
    assert.equal(p.get("allow_promotion_codes"), "true", "product overrides client");
    assert.equal(p.get("custom_text[submit][message]"), "Pro plan terms apply.");
    assert.equal(p.get("custom_text[after_submit][message]"), "global after", "nested text merges per key");

    await payments.checkout.create({ productId: "pro", options: { allowPromotionCodes: false, locale: "ja" } });
    p = params(requests);
    assert.equal(p.get("allow_promotion_codes"), "false", "call overrides product");
    assert.equal(p.get("locale"), "ja");
  });

  it("maps product presentation and tax settings", async () => {
    const { payments, requests } = makeCustomClient({ products: CATALOG });
    await payments.checkout.create({ productId: "pro" });
    const p = params(requests);
    assert.equal(p.get("line_items[0][price_data][product_data][images][0]"), "https://cdn.example.com/pro.png");
    assert.equal(p.get("line_items[0][price_data][product_data][tax_code]"), "txcd_10103001");
    assert.equal(p.get("line_items[0][price_data][tax_behavior]"), "exclusive");
    assert.equal(p.get("metadata[tier]"), "pro");
  });

  it("rejects business-policy options per call", async () => {
    const { payments, requests } = makeCustomClient({ products: CATALOG });
    for (const options of [{ automaticTax: false }, { createInvoice: true }, { mode: "payment" }]) {
      await rejectsWith(payments.checkout.create({ productId: "basic", options: options as never }), "invalid_checkout_options");
    }
    assert.equal(requests.length, 0);
  });

  it("rejects unknown or malformed options at every level", async () => {
    const bad: unknown[] = [
      { allowPromoCodes: true },
      { unit_amount: 1 },
      { stripeOptions: { anything: true } },
      { locale: "not a locale" },
      { submitType: "subscribe" },
      { collectShippingAddress: { allowedCountries: ["us"] } },
      { collectShippingAddress: { allowedCountries: [] } },
      { collectShippingAddress: true },
      { customText: { submit: "bad\u0000text" } },
      { customText: { submit: "x".repeat(1201) } },
      { customText: { footer: "x" } },
      { customFields: [{ key: "a", label: "A", type: "text" }, { key: "b", label: "B", type: "text" }, { key: "c", label: "C", type: "text" }, { key: "d", label: "D", type: "text" }] },
      { customFields: [{ key: "a", label: "A", type: "text" }, { key: "a", label: "A2", type: "text" }] },
      { customFields: [{ key: "bad-key", label: "A", type: "text" }] },
      { customFields: [{ key: "a", label: "A", type: "dropdown", options: [] }] },
      { customFields: [{ key: "a", label: "A", type: "text", minLength: 10, maxLength: 5 }] },
      { customFields: [{ key: "a", label: "A", type: "file" }] },
      { expiresInMinutes: 10 },
      { expiresInMinutes: 2000 },
      { consentCollection: { termsOfService: "yes" } },
      { allowPromotionCodes: "true" },
      { customerCreation: "never" },
    ];
    for (const options of bad) {
      assert.throws(
        () => makeCustomClient({ products: CATALOG, checkout: options as never }),
        PaymentConfigurationError,
        `client-level ${JSON.stringify(options)}`,
      );
      assert.throws(
        () => makeCustomClient({ products: { a: { name: "A", price: 100, currency: "usd", checkout: options as never } } }),
        PaymentConfigurationError,
        `product-level ${JSON.stringify(options)}`,
      );
    }
    const { payments, requests } = makeCustomClient({ products: CATALOG });
    for (const options of bad) {
      await assert.rejects(payments.checkout.create({ productId: "basic", options: options as never }), PaymentValidationError);
    }
    assert.equal(requests.length, 0);
  });

  it("property: random option objects are either valid or rejected with a PaymentError", async () => {
    const rand = prng(99);
    const { payments } = makeCustomClient({ products: CATALOG });
    for (let i = 0; i < 1500; i++) {
      const options = randomValue(rand);
      try {
        await payments.checkout.create({ productId: "basic", options: options as never });
      } catch (error) {
        assert.ok(error instanceof PaymentValidationError, `unexpected ${String(error)}`);
      }
    }
  });
});

/* --------------------------------------------- security: no override escapes */

describe("customization cannot bypass security", () => {
  it("checkout.create rejects Stripe parameters and price/currency fields", async () => {
    const { payments, requests } = makeCustomClient({ products: CATALOG });
    const attempts: Record<string, unknown>[] = [
      { amount: 1 },
      { price: 1 },
      { currency: "jpy" },
      { unit_amount: 1 },
      { line_items: [{ price_data: { unit_amount: 1 } }] },
      { success_url: "https://evil.example" },
      { stripeOptions: { mode: "setup" } },
      { mode: "setup" },
    ];
    for (const extra of attempts) {
      await rejectsWith(payments.checkout.create({ productId: "pro", ...extra } as never), "unexpected_field");
    }
    // Even a whole request body spread in by mistake is refused.
    const body: unknown = JSON.parse('{"productId":"pro","quantity":1,"amount":1,"currency":"usd"}');
    await rejectsWith(payments.checkout.create(body as never), "unexpected_field");
    assert.equal(requests.length, 0);
  });

  it("per-call options never change price, currency or quantity limits", async () => {
    const { payments, requests } = makeCustomClient({ products: CATALOG });
    await payments.checkout.create({ productId: "basic", quantity: 2, options: { allowPromotionCodes: true, locale: "auto" } });
    const p = params(requests);
    assert.equal(p.get("line_items[0][price_data][unit_amount]"), "999");
    assert.equal(p.get("line_items[0][price_data][currency]"), "usd");
    assert.equal(p.get("line_items[0][quantity]"), "2");
    await rejectsWith(payments.checkout.create({ productId: "basic", quantity: 11, options: {} }), "invalid_quantity");
  });

  it("the browser still can only send productId and quantity", async () => {
    const { payments, requests } = makeCustomClient({ products: CATALOG });
    const handler = createCheckoutHandler(payments);
    for (const extra of ['"options":{"allowPromotionCodes":true}', '"metadata":{"orderId":"1"}', '"redirect":{"success":"/x"}', '"customer":{"email":"a@b.co"}', '"clientReferenceId":"order_1"']) {
      const response = await handler(
        new Request(`${APP_URL}/api/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: `{"productId":"pro",${extra}}` }),
      );
      assert.equal(response.status, 400, extra);
    }
    assert.equal(requests.length, 0);
  });

  it("inactive products can't be bought via parse or create", async () => {
    const { payments, requests } = makeCustomClient({ products: CATALOG });
    assert.throws(() => payments.checkout.parse({ productId: "retired" }), (e: unknown) => e instanceof PaymentValidationError && e.code === "product_unavailable");
    await rejectsWith(payments.checkout.create({ productId: "retired" }), "product_unavailable");
    assert.equal(requests.length, 0);
    assert.deepEqual(payments.products.list({ activeOnly: true }).map((p) => p.id), ["basic", "pro"]);
    assert.equal(payments.products.list().length, 3);
  });

  it("rejects unknown top-level and nested configuration keys", () => {
    for (const config of [{ stripeOptions: {} }, { security: { disableValidation: true } }, { urls: { success: "/s", evil: "/x" } }, { webhooks: { skipSignature: true } }, { logging: { redact: false } }, { monitoring: { onEverything: () => {} } }, { callbacks: { onAnything: () => {} } }, { metadata: { allowAll: true } }]) {
      assert.throws(() => makeCustomClient({ products: CATALOG, ...(config as object) }), PaymentConfigurationError, JSON.stringify(config));
    }
  });

  it("rejects unsafe product configuration", () => {
    const bad: unknown[] = [
      { images: ["http://insecure.example/a.png"] },
      { images: ["javascript:alert(1)"] },
      { images: Array.from({ length: 9 }, () => "https://cdn.example.com/a.png") },
      { taxBehavior: "sometimes" },
      { taxCode: "tax_1" },
      { stripePriceId: "prod_123" },
      { stripePriceId: "price_abcdefgh123", images: ["https://cdn.example.com/a.png"] },
      { active: "yes" },
      { metadata: { cardNumber: "x" } },
      { metadata: { note: "4242 4242 4242 4242" } },
      { metadata: { productId: "other" } },
    ];
    for (const extra of bad) {
      assert.throws(
        () => makeCustomClient({ products: { a: { name: "A", price: 100, currency: "usd", ...(extra as object) } } as never }),
        PaymentConfigurationError,
        JSON.stringify(extra),
      );
    }
  });
});

/* ---------------------------------------------------------------- metadata */

describe("metadata policy", () => {
  const products = defineProducts({ item: { name: "Item", price: 1000, currency: "usd", metadata: { sku: "IT-1" } } });

  it("enforces allowedKeys at runtime (and in types)", async () => {
    const { payments, requests } = makeCustomClient({ products, metadata: { allowedKeys: ["orderId", "userId"] } });
    await payments.checkout.create({ productId: "item", metadata: { orderId: "order_123", userId: "user_456" } });
    const p = params(requests);
    assert.equal(p.get("metadata[orderId]"), "order_123");
    assert.equal(p.get("metadata[sku]"), "IT-1", "product metadata is merged");
    assert.equal(p.get("payment_intent_data[metadata][userId]"), "user_456");

    // @ts-expect-error "campaign" is not an allowed metadata key
    await rejectsWith(payments.checkout.create({ productId: "item", metadata: { campaign: "x" } }), "invalid_metadata");
  });

  it("enforces size limits, reserved keys and sensitive-value rules", async () => {
    const { payments } = makeCustomClient({ products, metadata: { maxKeys: 2, maxValueLength: 10 } });
    await rejectsWith(payments.checkout.create({ productId: "item", metadata: { a: "1", b: "2" } }), "invalid_metadata"); // + product sku = 3
    await rejectsWith(payments.checkout.create({ productId: "item", metadata: { a: "x".repeat(11) } }), "invalid_metadata");
    await rejectsWith(payments.checkout.create({ productId: "item", metadata: { productId: "other" } }), "invalid_metadata");
    await rejectsWith(payments.checkout.create({ productId: "item", metadata: { quantity: "999" } }), "invalid_metadata");
    await rejectsWith(payments.checkout.create({ productId: "item", metadata: { token: "x" } }), "invalid_metadata");
    await rejectsWith(payments.checkout.create({ productId: "item", metadata: { a: "line\u0007" } }), "invalid_metadata");
  });

  it("validates the policy itself", () => {
    for (const metadata of [{ maxKeys: 0 }, { maxKeys: 41 }, { maxValueLength: 501 }, { allowedKeys: [] }, { allowedKeys: ["password"] }, { allowedKeys: ["productId"] }, { allowedKeys: ["bad key"] }]) {
      assert.throws(() => makeCustomClient({ products, metadata: metadata as never }), PaymentConfigurationError, JSON.stringify(metadata));
    }
  });
});

/* ---------------------------------------------------------------- customer */

describe("customer information", () => {
  it("supports email, existing customer ID and the legacy customerEmail alias", async () => {
    const { payments, requests } = makeCustomClient({ products: CATALOG });
    await payments.checkout.create({ productId: "basic", customer: { email: "buyer@example.com" } });
    assert.equal(params(requests).get("customer_email"), "buyer@example.com");
    await payments.checkout.create({ productId: "basic", customer: { id: "cus_Abcdefgh1234" } });
    assert.equal(params(requests).get("customer"), "cus_Abcdefgh1234");
    await payments.checkout.create({ productId: "basic", customerEmail: "legacy@example.com" });
    assert.equal(params(requests).get("customer_email"), "legacy@example.com");
  });

  it("rejects conflicting or malformed customer data", async () => {
    const { payments } = makeCustomClient({ products: CATALOG });
    await rejectsWith(payments.checkout.create({ productId: "basic", customer: { email: "a@example.com", id: "cus_Abcdefgh1234" } }), "invalid_customer");
    await rejectsWith(payments.checkout.create({ productId: "basic", customer: { id: "acct_123" } }), "invalid_customer");
    await rejectsWith(payments.checkout.create({ productId: "basic", customerEmail: "a@example.com", customer: { email: "b@example.com" } }), "invalid_customer");
    await rejectsWith(payments.checkout.create({ productId: "basic", customer: { email: "a@example.com", name: "x" } as never }), "invalid_customer");
    await rejectsWith(
      payments.checkout.create({ productId: "basic", customer: { id: "cus_Abcdefgh1234" }, options: { customerCreation: "always" } }),
      "invalid_checkout_options",
    );
  });
});

/* --------------------------------------------------------------- redirects */

describe("redirects", () => {
  it("supports the urls alias and appends session_id automatically", async () => {
    const { payments, requests } = makeCustomClient({ products: CATALOG, urls: { success: "/orders/done#top", cancel: "/cart" } });
    await payments.checkout.create({ productId: "basic" });
    assert.equal(params(requests).get("success_url"), `${APP_URL}/orders/done?session_id={CHECKOUT_SESSION_ID}#top`);
    assert.equal(params(requests).get("cancel_url"), `${APP_URL}/cart`);
  });

  it("allows per-call redirects on the app origin", async () => {
    const { payments, requests } = makeCustomClient({ products: CATALOG });
    await payments.checkout.create({ productId: "pro", redirect: { success: "/orders/success?ref=1", cancel: "/checkout/cancelled?p={PRODUCT_ID}" } });
    assert.equal(params(requests).get("success_url"), `${APP_URL}/orders/success?ref=1&session_id={CHECKOUT_SESSION_ID}`);
    assert.equal(params(requests).get("cancel_url"), `${APP_URL}/checkout/cancelled?p=pro`);
  });

  it("blocks open redirects unless the origin is explicitly allow-listed", async () => {
    const { payments, requests } = makeCustomClient({ products: CATALOG, security: { allowedRedirectOrigins: ["https://account.example.com"] } });
    for (const target of ["https://evil.example/x", "//evil.example/x", "/\\evil.example", "javascript:alert(1)", "data:text/html,x", "https://user:pw@account.example.com/x", "/ spaced", "http://account.example.com.evil.example/"]) {
      await rejectsWith(payments.checkout.create({ productId: "basic", redirect: { success: target } }), "invalid_redirect");
    }
    await rejectsWith(payments.checkout.create({ productId: "basic", redirect: { evil: "/x" } as never }), "invalid_redirect");
    assert.equal(requests.length, 0);

    await payments.checkout.create({ productId: "basic", redirect: { success: "https://account.example.com/thanks" } });
    assert.equal(params(requests).get("success_url"), "https://account.example.com/thanks?session_id={CHECKOUT_SESSION_ID}");
  });

  it("property: accepted redirects always stay on allowed origins", async () => {
    const rand = prng(2024);
    const pieces = ["/", "//", "\\", "https://", "http://", "evil.example", "account.example.com", "@", ":", "?", "#", "{PRODUCT_ID}", "%2F", ".", "javascript:", " "];
    const { payments, requests } = makeCustomClient({ products: CATALOG, security: { allowedRedirectOrigins: ["https://account.example.com"] } });
    for (let i = 0; i < 1500; i++) {
      const target = Array.from({ length: 1 + Math.floor(rand() * 6) }, () => pieces[Math.floor(rand() * pieces.length)]).join("");
      try {
        await payments.checkout.create({ productId: "basic", redirect: { cancel: target } });
      } catch (error) {
        assert.ok(error instanceof PaymentValidationError, String(error));
        continue;
      }
      const origin = new URL(params(requests).get("cancel_url")!.replaceAll("{CHECKOUT_SESSION_ID}", "x")).origin;
      assert.ok(origin === APP_URL || origin === "https://account.example.com", `${target} → ${origin}`);
    }
  });

  it("validates redirect configuration", () => {
    assert.throws(() => makeCustomClient({ products: CATALOG, urls: { success: "/a" }, checkout: { successPath: "/b" } }), PaymentConfigurationError);
    assert.throws(() => makeCustomClient({ products: CATALOG, urls: { success: "https://evil.example/" } }), PaymentConfigurationError);
    assert.throws(() => makeCustomClient({ products: CATALOG, security: { allowedRedirectOrigins: ["https://ok.example/path"] } }), PaymentConfigurationError);
    assert.throws(
      () =>
        makeCustomClient({
          products: CATALOG,
          environment: "production",
          secretKey: LIVE_SECRET_KEY,
          security: { allowedRedirectOrigins: ["http://insecure.example"] },
        }),
      PaymentConfigurationError,
    );
  });
});

/* ------------------------------------------------------ Stripe Price IDs */

describe("pre-created Stripe Prices", () => {
  const products = defineProducts({ dash: { name: "Dash", price: 2999, currency: "usd", stripePriceId: "price_1AbcdefGhijkl" } });

  function responder(price: Record<string, unknown>) {
    return (req: RecordedRequest) =>
      req.url.pathname.startsWith("/v1/prices/")
        ? stripeJson({ id: "price_1AbcdefGhijkl", object: "price", active: true, type: "one_time", currency: "usd", unit_amount: 2999, ...price })
        : stripeJson(fakeSession());
  }

  it("verifies the Price once, then charges with it", async () => {
    const { payments, requests } = makeCustomClient({ products }, responder({}));
    await payments.checkout.create({ productId: "dash" });
    await payments.checkout.create({ productId: "dash", quantity: 2 });
    assert.equal(requests.filter((r) => r.url.pathname.startsWith("/v1/prices/")).length, 1, "verification is cached");
    const p = params(requests);
    assert.equal(p.get("line_items[0][price]"), "price_1AbcdefGhijkl");
    assert.equal(p.get("line_items[0][quantity]"), "2");
    assert.equal(p.get("line_items[0][price_data][unit_amount]"), null);
  });

  it("refuses checkout when the Stripe Price disagrees with the catalog", async () => {
    for (const mismatch of [{ unit_amount: 100 }, { currency: "eur" }, { active: false }, { type: "recurring" }]) {
      const { payments, requests } = makeCustomClient({ products }, responder(mismatch));
      await rejectsWith(payments.checkout.create({ productId: "dash" }), "configuration_error");
      assert.equal(requests.filter((r) => r.url.pathname === "/v1/checkout/sessions").length, 0, JSON.stringify(mismatch));
    }
  });
});

/* ---------------------------------------------------------- checkout hooks */

describe("beforeCheckout / afterCheckout", () => {
  it("beforeCheckout sees the validated order and can refuse it before Stripe", async () => {
    const seen: BeforeCheckoutContext<"basic" | "pro" | "retired">[] = [];
    const { payments, requests } = makeCustomClient({
      products: CATALOG,
      callbacks: {
        beforeCheckout: (ctx) => {
          seen.push(ctx);
          if (ctx.quantity > 2) throw rejectCheckout("Only 2 left in stock.", { statusCode: 409 });
        },
      },
    });
    await payments.checkout.create({ productId: "pro", quantity: 2, clientReferenceId: "order_1", metadata: { orderId: "order_1" } });
    assert.equal(seen[0]?.amountTotal, 5998);
    assert.equal(seen[0]?.product.id, "pro");
    assert.deepEqual({ ...seen[0]?.metadata }, { tier: "pro", orderId: "order_1" });
    assert.ok(Object.isFrozen(seen[0]));

    await assert.rejects(payments.checkout.create({ productId: "pro", quantity: 3 }), (e: unknown) => {
      assert.ok(e instanceof PaymentValidationError);
      assert.equal(e.code, "checkout_rejected");
      assert.equal(e.statusCode, 409);
      assert.equal(e.publicMessage, "Only 2 left in stock.");
      return true;
    });
    assert.equal(requests.length, 1, "rejected checkout never reaches Stripe");
  });

  it("unexpected beforeCheckout errors become a generic checkout_rejected", async () => {
    const { payments, requests } = makeCustomClient({
      products: CATALOG,
      callbacks: {
        beforeCheckout: () => {
          throw new Error(`db password=${TEST_SECRET_KEY}`);
        },
      },
    });
    await assert.rejects(payments.checkout.create({ productId: "basic" }), (e: unknown) => {
      assert.ok(e instanceof PaymentValidationError && e.code === "checkout_rejected");
      assert.ok(!JSON.stringify(e).includes(TEST_SECRET_KEY) && !e.message.includes("password"));
      return true;
    });
    assert.equal(requests.length, 0);
  });

  it("afterCheckout failures never fail the call (no duplicate retries) and are reported", async () => {
    const errors: string[] = [];
    let after = 0;
    const { payments, requests, logs } = makeCustomClient({
      products: CATALOG,
      callbacks: {
        afterCheckout: async (ctx) => {
          after++;
          assert.equal(ctx.session.id, SESSION_ID);
          throw new Error("orders table unavailable");
        },
      },
      monitoring: { onError: (error) => void errors.push(error.code) },
    });
    const result = await payments.checkout.create({ productId: "basic" });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(result.id, SESSION_ID);
    assert.equal(after, 1);
    assert.equal(requests.length, 1);
    assert.deepEqual(errors, ["provider_error"]);
    assert.ok(logs.lines.some((l) => l.message.includes("afterCheckout")));
  });
});

/* ------------------------------------------------ webhook callbacks/events */

describe("payment callbacks from verified webhooks", () => {
  function deliver(payments: { webhooks: WebhooksApi }, type: string, object: Record<string, unknown>, id = `evt_${type}`) {
    const payload = eventPayload(type, object, id);
    return payments.webhooks.handle(payload, signPayload(payload));
  }

  it("maps Stripe events to onPaymentSucceeded / Failed / AttemptFailed / CheckoutExpired", async () => {
    const got: string[] = [];
    let succeeded: PaymentOutcome | undefined;
    let attempt: PaymentAttemptFailure | undefined;
    const { payments } = makeCustomClient({
      products: CATALOG,
      callbacks: {
        onPaymentSucceeded: (p) => {
          got.push(`succeeded:${p.eventId}`);
          succeeded = p;
        },
        onPaymentFailed: (p) => void got.push(`failed:${p.eventId}`),
        onPaymentAttemptFailed: (a) => {
          got.push(`attempt:${a.eventId}`);
          attempt = a;
        },
        onCheckoutExpired: (p) => void got.push(`expired:${p.eventId}`),
      },
    });
    const session = { id: SESSION_ID, payment_intent: "pi_1", amount_total: 5998, currency: "usd", client_reference_id: "order_9", metadata: { productId: "pro", quantity: "2", orderId: "order_9" } };

    await deliver(payments, "checkout.session.completed", { ...session, payment_status: "paid" }, "evt_paid");
    await deliver(payments, "checkout.session.completed", { ...session, payment_status: "unpaid" }, "evt_delayed");
    await deliver(payments, "checkout.session.async_payment_succeeded", session, "evt_async_ok");
    await deliver(payments, "checkout.session.async_payment_failed", session, "evt_async_fail");
    await deliver(payments, "checkout.session.expired", session, "evt_expired");
    const pi = eventPayload("payment_intent.payment_failed", {}, "evt_decline").replace(
      '"object":"checkout.session"',
      '"object":"payment_intent","amount":2999,"currency":"usd","metadata":{"productId":"pro"},"last_payment_error":{"code":"card_declined","decline_code":"insufficient_funds"}',
    );
    await payments.webhooks.handle(pi, signPayload(pi));

    assert.deepEqual(got, ["succeeded:evt_paid", "succeeded:evt_async_ok", "failed:evt_async_fail", "expired:evt_expired", "attempt:evt_decline"]);
    assert.equal(succeeded?.product?.id, "pro");
    assert.equal(succeeded?.quantity, 2);
    assert.equal(succeeded?.clientReferenceId, "order_9");
    assert.deepEqual({ ...succeeded?.metadata }, { orderId: "order_9" });
    assert.equal(attempt?.declineCode, "insufficient_funds");
  });

  it("callback failures → 500 (Stripe retries), and on() handlers keep working alongside", async () => {
    let fail = true;
    const order: string[] = [];
    const { payments } = makeCustomClient({
      products: CATALOG,
      callbacks: {
        onPaymentSucceeded: () => {
          order.push("callback");
          if (fail) throw new Error("fulfilment down");
        },
      },
      storage: createProcessedStorage().storage,
    });
    payments.webhooks.on("checkout.session.completed", () => void order.push("on"));
    const handler = createWebhookHandler(payments);
    const payload = eventPayload("checkout.session.completed", { payment_status: "paid", metadata: { productId: "pro" } }, "evt_retry_cb");
    const req = () => new Request(`${APP_URL}/wh`, { method: "POST", body: payload, headers: { "Stripe-Signature": signPayload(payload) } });

    assert.equal((await handler(req())).status, 500);
    fail = false;
    assert.equal((await handler(req())).status, 200);
    assert.deepEqual(order, ["on", "callback", "on", "callback"]);
  });
});

/* ----------------------------------------------------------------- storage */

function createProcessedStorage(options: { failHas?: boolean; failMark?: boolean } = {}) {
  const processed = new Set<string>();
  const storage: ProcessedEventStorage = {
    async hasProcessedEvent(id) {
      if (options.failHas) throw new Error("redis down");
      return processed.has(id);
    },
    async markEventProcessed(id) {
      if (options.failMark) throw new Error("redis down");
      processed.add(id);
    },
  };
  return { storage, processed };
}

describe("storage adapters", () => {
  const payload = eventPayload("checkout.session.completed", { payment_status: "paid" }, "evt_store");

  it("hasProcessedEvent/markEventProcessed deduplicates and marks only after success", async () => {
    const { storage, processed } = createProcessedStorage();
    let calls = 0;
    const { payments } = makeCustomClient({ products: CATALOG, storage });
    payments.webhooks.on("checkout.session.completed", () => {
      calls++;
      if (calls === 1) throw new Error("first attempt fails");
    });
    await assert.rejects(payments.webhooks.handle(payload, signPayload(payload)), PaymentWebhookError);
    assert.equal(processed.size, 0, "not marked after failure");
    assert.equal((await payments.webhooks.handle(payload, signPayload(payload))).outcome, "processed");
    assert.equal((await payments.webhooks.handle(payload, signPayload(payload))).outcome, "duplicate");
    assert.equal(calls, 2);
  });

  it("storage failures become webhook_storage_failed (500, retryable) without leaking details", async () => {
    for (const failure of [{ failHas: true }, { failMark: true }]) {
      const { payments } = makeCustomClient({ products: CATALOG, storage: createProcessedStorage(failure).storage });
      payments.webhooks.on("checkout.session.completed", () => {});
      await assert.rejects(payments.webhooks.handle(payload, signPayload(payload)), (e: unknown) => {
        assert.ok(e instanceof PaymentWebhookError);
        assert.equal(e.code, "webhook_storage_failed");
        assert.equal(e.statusCode, 500);
        assert.ok(e.retryable);
        assert.ok(!JSON.stringify(e).includes("redis"));
        return true;
      });
    }
  });

  it("validates storage configuration", () => {
    assert.throws(() => makeCustomClient({ products: CATALOG, storage: { save: async () => {} } as never }), PaymentConfigurationError);
    assert.throws(
      () => makeCustomClient({ products: CATALOG, storage: createProcessedStorage().storage, webhooks: { eventStore: { claim: async () => true, release: async () => {} } } }),
      PaymentConfigurationError,
    );
  });
});

/* ---------------------------------------------------- monitoring & logging */

describe("monitoring and logging", () => {
  it("emits provider-neutral hooks; legacy `hooks` still works alongside `monitoring`", async () => {
    const created: CheckoutCreatedInfo[] = [];
    const received: WebhookReceivedInfo[] = [];
    const processed: WebhookInfo[] = [];
    const legacy: WebhookInfo[] = [];
    const { payments } = makeCustomClient({
      products: CATALOG,
      monitoring: {
        onCheckoutCreated: (i) => void created.push(i),
        onWebhookReceived: (i) => void received.push(i),
        onWebhookProcessed: (i) => {
          processed.push(i);
          throw new Error("monitoring outage");
        },
      },
      hooks: { onWebhook: (i) => void legacy.push(i) },
    });
    await payments.checkout.create({ productId: "pro", quantity: 2 });
    const payload = eventPayload("customer.created", {}, "evt_mon");
    await payments.webhooks.handle(payload, signPayload(payload));
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual({ ...created[0], requestId: "" }, { requestId: "", sessionId: SESSION_ID, productId: "pro", quantity: 2, amountTotal: 5998, currency: "usd" });
    assert.equal(received[0]?.eventId, "evt_mon");
    assert.equal(processed[0]?.outcome, "ignored");
    assert.equal(legacy[0]?.eventId, "evt_mon");
  });

  it("filters by level and survives a throwing logger", async () => {
    const lines: string[] = [];
    const { payments } = makeCustomClient({
      products: CATALOG,
      logging: {
        level: "warn",
        logger: {
          info: (m) => void lines.push(`info:${m}`),
          warn: (m) => void lines.push(`warn:${m}`),
          error: () => {
            throw new Error("logger crashed");
          },
        },
      },
    });
    await payments.checkout.create({ productId: "basic" });
    assert.ok(!lines.some((l) => l.startsWith("info:")), "info filtered out");
    // error logger throws during a failed operation; the operation's own error still surfaces normally.
    const bad = makeCustomClient({ products: CATALOG, logging: { logger: { info() {}, warn() {}, error() { throw new Error("x"); } } } }, () =>
      new Response('{"error":{"type":"api_error"}}', { status: 500, headers: { "Content-Type": "application/json" } }),
    );
    await rejectsWith(bad.payments.checkout.create({ productId: "basic" }), "provider_error");
  });

  it("never hands secrets to a custom logger or hook, whatever happens", async () => {
    const seen: unknown[] = [];
    const record = (...args: unknown[]) => void seen.push(args);
    const { payments } = makeCustomClient(
      {
        products: CATALOG,
        logging: { level: "debug", logger: { debug: record, info: record, warn: record, error: record } },
        monitoring: { onRequest: record, onError: record, onCheckoutCreated: record, onWebhookReceived: record, onWebhookProcessed: record },
        callbacks: { afterCheckout: () => { throw new Error(WEBHOOK_SECRET); } },
      },
      (_r, attempt) => (attempt === 2 ? new Response('{"error":{"type":"invalid_request_error"}}', { status: 401, headers: { "Content-Type": "application/json" } }) : stripeJson(fakeSession())),
    );
    await payments.checkout.create({ productId: "basic", metadata: { orderId: "o_1" } });
    await payments.checkout.create({ productId: "basic" }).catch(() => {});
    const payload = eventPayload("checkout.session.completed");
    await payments.webhooks.handle(payload, signPayload(payload)).catch(() => {});
    await payments.webhooks.handle(payload, "t=1,v1=bad").catch(() => {});
    await new Promise((r) => setTimeout(r, 0));
    const text = JSON.stringify(seen);
    assert.ok(seen.length > 5);
    for (const secret of [TEST_SECRET_KEY, WEBHOOK_SECRET, "Bearer", "stripe-signature"]) assert.ok(!text.includes(secret), `leaked ${secret}`);
  });
});

/* ------------------------------------------------------------------ errors */

describe("error customization", () => {
  it("exposes stable codes and lets apps override public messages", async () => {
    assert.equal(PaymentErrorCodes.INVALID_PRODUCT, "invalid_product");
    assert.equal(PaymentErrorCodes.WEBHOOK_SIGNATURE_INVALID, "webhook_signature_invalid");
    const { payments } = makeCustomClient({ products: CATALOG, errors: { publicMessages: { invalid_product: "That plan isn't available." } } });
    let caught: unknown;
    try {
      payments.checkout.parse({ productId: "nope" });
    } catch (error) {
      caught = error;
    }
    assert.deepEqual(payments.errors.describe(caught), { code: "invalid_product", message: "That plan isn't available.", statusCode: 400, retryable: false });
    assert.deepEqual(payments.errors.describe(new Error("internal detail")), { code: "internal_error", message: "Something went wrong. Please try again.", statusCode: 500, retryable: false });

    const handler = createCheckoutHandler(payments, { messages: { invalid_quantity: "Pick 1–10 seats." } });
    const post = (body: string) => handler(new Request(`${APP_URL}/c`, { method: "POST", headers: { "Content-Type": "application/json" }, body }));
    assert.equal(((await (await post('{"productId":"nope"}')).json()) as { error: { message: string } }).error.message, "That plan isn't available.");
    assert.equal(((await (await post('{"productId":"pro","quantity":0}')).json()) as { error: { message: string } }).error.message, "Pick 1–10 seats.");
  });

  it("rejects unknown codes in publicMessages", () => {
    assert.throws(() => makeCustomClient({ products: CATALOG, errors: { publicMessages: { not_a_code: "x" } as never } }), PaymentConfigurationError);
  });
});

/* ------------------------------------------------------ web adapter enrich */

describe("web adapter enrich", () => {
  it("forwards server-derived customer, options, redirect and metadata", async () => {
    const { payments, requests } = makeCustomClient({ products: CATALOG, metadata: { allowedKeys: ["userId"] } });
    const handler = createCheckoutHandler(payments, {
      enrich: () => ({
        customer: { email: "signed-in@example.com" },
        clientReferenceId: "user_42",
        metadata: { userId: "42" },
        options: { locale: "es" },
        redirect: { success: "/account/billing" },
      }),
    });
    const response = await handler(new Request(`${APP_URL}/c`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"productId":"basic"}' }));
    assert.equal(response.status, 200);
    const p = params(requests);
    assert.equal(p.get("customer_email"), "signed-in@example.com");
    assert.equal(p.get("locale"), "es");
    assert.equal(p.get("metadata[userId]"), "42");
    assert.equal(p.get("success_url"), `${APP_URL}/account/billing?session_id={CHECKOUT_SESSION_ID}`);
  });
});

/* ----------------------------------------------------- compile-time checks */

// These lines are type-checked by `tsc` (npm test compiles before running) and
// never executed. Each @ts-expect-error proves an invalid option fails to compile.
export function typeChecks() {
  const typed = createPaymentClient({ products: CATALOG, metadata: { allowedKeys: ["orderId"] }, logger: false, env: {}, secretKey: TEST_SECRET_KEY });
  void typed.checkout.create({ productId: "pro", metadata: { orderId: "1" }, options: { locale: "fr", submitType: "book" } });
  // @ts-expect-error unknown product
  void typed.checkout.create({ productId: "enterprise" });
  // @ts-expect-error metadata key not in allowedKeys
  void typed.checkout.create({ productId: "pro", metadata: { userId: "1" } });
  // @ts-expect-error tax policy can't be set per call
  void typed.checkout.create({ productId: "pro", options: { automaticTax: true } });
  // @ts-expect-error unsupported locale
  void typed.checkout.create({ productId: "pro", options: { locale: "xx-YY" } });
  // @ts-expect-error unsupported submit type
  void typed.checkout.create({ productId: "pro", options: { submitType: "subscribe" } });
  // @ts-expect-error unknown option
  void typed.checkout.create({ productId: "pro", options: { allowPromoCodes: true } });
  // @ts-expect-error price can never be passed
  void typed.checkout.create({ productId: "pro", amount: 1 });
  // @ts-expect-error lowercase country codes are invalid
  createPaymentClient({ products: CATALOG, checkout: { collectShippingAddress: { allowedCountries: ["us"] } } });
  // @ts-expect-error unknown top-level option
  createPaymentClient({ products: CATALOG, stripeOptions: {} });
  // @ts-expect-error wrong tax behaviour on a product
  defineProducts({ a: { name: "A", price: 100, currency: "usd", taxBehavior: "sometimes" } });
}
