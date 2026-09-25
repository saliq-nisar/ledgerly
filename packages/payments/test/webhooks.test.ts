import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMemoryEventStore, PaymentWebhookError, type WebhookInfo } from "../src/index.js";
import { eventPayload, makeClient, signPayload, WEBHOOK_SECRET } from "./helpers.js";

function expectWebhookError(fn: () => unknown, code: string) {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof PaymentWebhookError, `expected PaymentWebhookError, got ${String(error)}`);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, 400);
    assert.ok(!JSON.stringify(error).includes(WEBHOOK_SECRET));
    assert.ok(!error.message.includes(WEBHOOK_SECRET));
    return true;
  });
}

describe("webhooks.constructEvent", () => {
  const { payments } = makeClient();
  const payload = eventPayload("checkout.session.completed", { payment_status: "paid", amount_total: 2999 });

  it("accepts a valid signature (string and raw bytes)", () => {
    const signature = signPayload(payload);
    assert.equal(payments.webhooks.constructEvent(payload, signature).id, "evt_test_1");
    assert.equal(payments.webhooks.constructEvent(new TextEncoder().encode(payload), signature).type, "checkout.session.completed");
  });

  it("rejects a signature made with the wrong secret", () => {
    expectWebhookError(() => payments.webhooks.constructEvent(payload, signPayload(payload, "whsec_someOtherSecret1234567890")), "webhook_signature_invalid");
  });

  it("rejects a modified payload", () => {
    const signature = signPayload(payload);
    expectWebhookError(() => payments.webhooks.constructEvent(payload.replace("2999", "1"), signature), "webhook_signature_invalid");
    // Re-serialising (e.g. JSON.parse + JSON.stringify) also breaks the signature.
    expectWebhookError(() => payments.webhooks.constructEvent(JSON.stringify(JSON.parse(payload), null, 2), signature), "webhook_signature_invalid");
  });

  it("rejects a missing or empty signature", () => {
    for (const signature of [undefined, null, "", "   "]) {
      expectWebhookError(() => payments.webhooks.constructEvent(payload, signature), "webhook_signature_missing");
    }
  });

  it("rejects a garbage signature header", () => {
    expectWebhookError(() => payments.webhooks.constructEvent(payload, "t=abc,v1=zzz"), "webhook_signature_invalid");
  });

  it("rejects replayed events outside the timestamp tolerance", () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    expectWebhookError(() => payments.webhooks.constructEvent(payload, signPayload(payload, WEBHOOK_SECRET, old)), "webhook_signature_invalid");
  });

  it("rejects malformed payloads even when correctly signed", () => {
    const garbage = "{not json";
    expectWebhookError(() => payments.webhooks.constructEvent(garbage, signPayload(garbage)), "webhook_payload_invalid");
    const notEvent = JSON.stringify({ hello: "world" });
    expectWebhookError(() => payments.webhooks.constructEvent(notEvent, signPayload(notEvent)), "webhook_payload_invalid");
  });

  it("rejects parsed objects and empty bodies (raw body required)", () => {
    const parsed: unknown = JSON.parse(payload);
    expectWebhookError(() => payments.webhooks.constructEvent(parsed as never, signPayload(payload)), "webhook_payload_invalid");
    expectWebhookError(() => payments.webhooks.constructEvent("", signPayload("")), "webhook_payload_invalid");
  });
});

describe("webhooks.handle", () => {
  const completed = eventPayload("checkout.session.completed", { payment_status: "paid" }, "evt_dup_1");

  it("dispatches to typed handlers", async () => {
    const { payments } = makeClient();
    const received: string[] = [];
    payments.webhooks.on("checkout.session.completed", (event, ctx) => {
      received.push(`${event.data.object.payment_status}:${ctx.requestId}`);
    });
    const result = await payments.webhooks.handle(completed, signPayload(completed), { requestId: "rq-1" });
    assert.deepEqual(result, { eventId: "evt_dup_1", eventType: "checkout.session.completed", outcome: "processed" });
    assert.deepEqual(received, ["paid:rq-1"]);
  });

  it("ignores unsupported event types", async () => {
    const { payments } = makeClient();
    const payload = eventPayload("customer.created", {}, "evt_other");
    const result = await payments.webhooks.handle(payload, signPayload(payload));
    assert.equal(result.outcome, "ignored");
  });

  it("skips duplicate deliveries when an event store is configured", async () => {
    const { payments } = makeClient({ webhooks: { eventStore: createMemoryEventStore() } });
    let calls = 0;
    payments.webhooks.on("checkout.session.completed", () => {
      calls++;
    });
    const first = await payments.webhooks.handle(completed, signPayload(completed));
    const second = await payments.webhooks.handle(completed, signPayload(completed));
    assert.equal(first.outcome, "processed");
    assert.equal(second.outcome, "duplicate");
    assert.equal(calls, 1);
  });

  it("without a store, duplicates are delivered again (handlers must be idempotent)", async () => {
    const { payments } = makeClient();
    let calls = 0;
    payments.webhooks.on("checkout.session.completed", () => {
      calls++;
    });
    await payments.webhooks.handle(completed, signPayload(completed));
    await payments.webhooks.handle(completed, signPayload(completed));
    assert.equal(calls, 2);
  });

  it("releases the claim when a handler fails so Stripe's retry is processed", async () => {
    const { payments, logs } = makeClient({ webhooks: { eventStore: createMemoryEventStore() } });
    let attempts = 0;
    payments.webhooks.on("checkout.session.completed", () => {
      attempts++;
      if (attempts === 1) throw new Error(`database down (${WEBHOOK_SECRET})`);
    });
    await assert.rejects(payments.webhooks.handle(completed, signPayload(completed)), (e: unknown) => {
      assert.ok(e instanceof PaymentWebhookError);
      assert.equal(e.code, "webhook_handler_failed");
      assert.equal(e.statusCode, 500);
      assert.ok(!JSON.stringify(e).includes("database down"), "handler error details must not leak");
      return true;
    });
    const retry = await payments.webhooks.handle(completed, signPayload(completed));
    assert.equal(retry.outcome, "processed");
    assert.equal(attempts, 2);
    assert.ok(!logs.text().includes(WEBHOOK_SECRET));
  });

  it("supports unsubscribing and multiple handlers", async () => {
    const { payments } = makeClient();
    const calls: string[] = [];
    const off = payments.webhooks.on("payment_intent.succeeded", () => {
      calls.push("a");
    });
    payments.webhooks.on("payment_intent.succeeded", () => {
      calls.push("b");
    });
    off();
    const payload = eventPayload("payment_intent.succeeded", {}, "evt_pi");
    await payments.webhooks.handle(payload, signPayload(payload));
    assert.deepEqual(calls, ["b"]);
  });

  it("reports webhook outcomes to the onWebhook hook", async () => {
    const seen: WebhookInfo[] = [];
    const { payments } = makeClient({ hooks: { onWebhook: (info) => void seen.push(info) } });
    payments.webhooks.on("checkout.session.completed", () => {});
    await payments.webhooks.handle(completed, signPayload(completed));
    assert.equal(seen[0]?.eventId, "evt_dup_1");
    assert.equal(seen[0]?.outcome, "processed");
  });
});
