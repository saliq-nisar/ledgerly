import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCheckoutHandler, createWebhookHandler } from "../src/adapters/web.js";
import { createMemoryEventStore } from "../src/index.js";
import { APP_URL, eventPayload, makeClient, signPayload, stripeError, TEST_SECRET_KEY, WEBHOOK_SECRET } from "./helpers.js";

function post(body: string | null, headers: Record<string, string> = { "Content-Type": "application/json" }, method = "POST") {
  return new Request("https://shop.example.com/api/checkout", { method, body, headers });
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  assert.ok(!text.includes(TEST_SECRET_KEY) && !text.includes(WEBHOOK_SECRET), "response leaked a secret");
  return JSON.parse(text) as Record<string, unknown>;
}

describe("createCheckoutHandler", () => {
  it("creates a session and returns only { id, url }", async () => {
    const { payments, requests } = makeClient();
    const handler = createCheckoutHandler(payments);
    const response = await handler(post(JSON.stringify({ productId: "basic", quantity: 2 })));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.ok(response.headers.get("x-request-id"));
    const body = await readJson(response);
    assert.deepEqual(Object.keys(body).sort(), ["id", "url"]);
    assert.equal(requests[0]!.params.get("line_items[0][price_data][unit_amount]"), "999");
  });

  it("rejects wrong methods, content types, oversized and malformed bodies", async () => {
    const { payments, requests } = makeClient();
    const handler = createCheckoutHandler(payments);

    const get = await handler(new Request("https://shop.example.com/api/checkout"));
    assert.equal(get.status, 405);
    assert.equal(get.headers.get("allow"), "POST");

    assert.equal((await handler(post('{"productId":"pro"}', { "Content-Type": "text/plain" }))).status, 415);
    assert.equal((await handler(post('{"productId":"pro"}', {}))).status, 415);

    const big = JSON.stringify({ productId: "pro", pad: "x".repeat(5000) });
    assert.equal((await handler(post(big))).status, 413);

    // Streamed body without Content-Length must also be capped.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 10; i++) controller.enqueue(new Uint8Array(512).fill(32));
        controller.close();
      },
    });
    const streamed = new Request("https://shop.example.com/api/checkout", {
      method: "POST",
      body: stream,
      headers: { "Content-Type": "application/json" },
      duplex: "half",
    } as RequestInit);
    assert.equal((await handler(streamed)).status, 413);

    for (const bad of ["{", "", "null", "[]", '"pro"', "￾￿"]) {
      assert.equal((await handler(post(bad))).status, 400, `body ${JSON.stringify(bad)}`);
    }
    assert.equal(requests.length, 0);
  });

  it("rejects client-supplied prices and unknown fields", async () => {
    const { payments, requests } = makeClient();
    const handler = createCheckoutHandler(payments);
    const response = await handler(post(JSON.stringify({ productId: "pro", quantity: 1, amount: 1 })));
    assert.equal(response.status, 400);
    const body = await readJson(response);
    assert.equal((body.error as Record<string, unknown>).code, "unexpected_field");
    assert.equal(requests.length, 0);
  });

  it("blocks cross-origin browser requests by default", async () => {
    const { payments } = makeClient();
    const handler = createCheckoutHandler(payments);
    const evil = await handler(post('{"productId":"pro"}', { "Content-Type": "application/json", Origin: "https://evil.example" }));
    assert.equal(evil.status, 403);
    const same = await handler(post('{"productId":"pro"}', { "Content-Type": "application/json", Origin: APP_URL }));
    assert.equal(same.status, 200);
  });

  it("applies the rate limit hook with Retry-After", async () => {
    const { payments, requests } = makeClient();
    const handler = createCheckoutHandler(payments, { rateLimit: () => ({ allowed: false, retryAfterSeconds: 30 }) });
    const response = await handler(post('{"productId":"pro"}'));
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "30");
    assert.equal(requests.length, 0);
  });

  it("forwards the Idempotency-Key header and validates it", async () => {
    const { payments, requests } = makeClient();
    const handler = createCheckoutHandler(payments);
    await handler(post('{"productId":"pro"}', { "Content-Type": "application/json", "Idempotency-Key": "checkout-4f1c2b7a" }));
    assert.equal(requests[0]!.headers.get("idempotency-key"), "checkout-4f1c2b7a");
    const bad = await handler(post('{"productId":"pro"}', { "Content-Type": "application/json", "Idempotency-Key": "bad key" }));
    assert.equal(bad.status, 400);
  });

  it("adds trusted server-side fields via enrich", async () => {
    const { payments, requests } = makeClient();
    const handler = createCheckoutHandler(payments, { enrich: () => ({ clientReferenceId: "user_42", metadata: { userId: "42" } }) });
    await handler(post('{"productId":"pro"}'));
    assert.equal(requests[0]!.params.get("client_reference_id"), "user_42");
    assert.equal(requests[0]!.params.get("metadata[userId]"), "42");
  });

  it("returns generic messages for provider failures", async () => {
    const { payments } = makeClient({}, () => stripeError(401, "invalid_request_error"));
    const response = await createCheckoutHandler(payments)(post('{"productId":"pro"}'));
    assert.equal(response.status, 500);
    const body = await readJson(response);
    const error = body.error as Record<string, unknown>;
    assert.equal(error.code, "authentication_failed");
    assert.equal(error.message, "Payments are temporarily unavailable.");
  });
});

describe("createWebhookHandler", () => {
  function webhookRequest(payload: string | Uint8Array, signature?: string) {
    return new Request("https://shop.example.com/api/webhook", {
      method: "POST",
      body: payload,
      headers: signature ? { "Stripe-Signature": signature, "Content-Type": "application/json" } : {},
    });
  }

  it("verifies the raw body byte-for-byte (unicode and whitespace preserved)", async () => {
    const { payments } = makeClient();
    let seen = "";
    payments.webhooks.on("checkout.session.completed", (event) => {
      seen = event.data.object.customer_details?.name ?? "";
    });
    const payload = `  ${eventPayload("checkout.session.completed", { customer_details: { name: "Zoë 😀 Müller" } })}\n`;
    const response = await createWebhookHandler(payments)(webhookRequest(payload, signPayload(payload)));
    assert.equal(response.status, 200);
    assert.deepEqual(await readJson(response), { received: true, outcome: "processed" });
    assert.equal(seen, "Zoë 😀 Müller");
  });

  it("returns 400 for bad signatures, missing signatures and modified payloads", async () => {
    const { payments } = makeClient();
    const handler = createWebhookHandler(payments);
    const payload = eventPayload("checkout.session.completed");
    assert.equal((await handler(webhookRequest(payload))).status, 400);
    assert.equal((await handler(webhookRequest(payload, "t=1,v1=deadbeef"))).status, 400);
    assert.equal((await handler(webhookRequest(payload.replace("evt_test_1", "evt_evil"), signPayload(payload)))).status, 400);
  });

  it("returns 500 on handler failure so Stripe retries, 200 duplicate afterwards", async () => {
    const { payments } = makeClient({ webhooks: { eventStore: createMemoryEventStore() } });
    let fail = true;
    payments.webhooks.on("checkout.session.completed", () => {
      if (fail) throw new Error("boom");
    });
    const handler = createWebhookHandler(payments);
    const payload = eventPayload("checkout.session.completed", {}, "evt_retry");
    assert.equal((await handler(webhookRequest(payload, signPayload(payload)))).status, 500);
    fail = false;
    assert.deepEqual(await readJson(await handler(webhookRequest(payload, signPayload(payload)))), { received: true, outcome: "processed" });
    assert.deepEqual(await readJson(await handler(webhookRequest(payload, signPayload(payload)))), { received: true, outcome: "duplicate" });
  });

  it("rejects oversized webhook bodies and non-POST methods", async () => {
    const { payments } = makeClient();
    const handler = createWebhookHandler(payments, { maxBodyBytes: 100 });
    const payload = eventPayload("checkout.session.completed");
    assert.equal((await handler(webhookRequest(payload, signPayload(payload)))).status, 413);
    assert.equal((await handler(new Request("https://shop.example.com/api/webhook"))).status, 405);
  });

  it("returns 500 when webhooks are not configured", async () => {
    const { payments } = makeClient({ webhookSecret: undefined });
    const payload = eventPayload("checkout.session.completed");
    const response = await createWebhookHandler(payments)(webhookRequest(payload, signPayload(payload)));
    assert.equal(response.status, 500);
  });
});
