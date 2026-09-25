import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PaymentErrorCodes } from "../src/index.js";
import { makeCustomClient } from "./helpers.js";

/**
 * The documentation site's error simulator shows these exact values. This
 * test fails if the library's real output changes, so the docs can't drift.
 */
describe("documented error outputs (payments.errors.describe)", () => {
  const { payments } = makeCustomClient({
    products: { pro: { name: "Pro", price: 1999, currency: "usd" } },
  });

  function describeSync(fn: () => unknown) {
    try {
      fn();
    } catch (error) {
      return payments.errors.describe(error);
    }
    assert.fail("expected an error");
  }

  async function describeAsync(promise: Promise<unknown>) {
    try {
      await promise;
    } catch (error) {
      return payments.errors.describe(error);
    }
    assert.fail("expected an error");
  }

  it("Invalid Product", () => {
    assert.deepEqual(describeSync(() => payments.checkout.parse({ productId: "enterprise" })), {
      code: PaymentErrorCodes.INVALID_PRODUCT,
      message: "Unknown product.",
      statusCode: 400,
      retryable: false,
    });
  });

  it("Invalid Quantity", () => {
    assert.deepEqual(describeSync(() => payments.checkout.parse({ productId: "pro", quantity: 0 })), {
      code: PaymentErrorCodes.INVALID_QUANTITY,
      message: "Quantity must be a whole number between 1 and 10.",
      statusCode: 400,
      retryable: false,
    });
  });

  it("Unexpected Field", () => {
    assert.deepEqual(describeSync(() => payments.checkout.parse({ productId: "pro", amount: 1 })), {
      code: PaymentErrorCodes.UNEXPECTED_FIELD,
      message: "Invalid checkout request.",
      statusCode: 400,
      retryable: false,
    });
  });

  it("Invalid Redirect", async () => {
    assert.deepEqual(await describeAsync(payments.checkout.create({ productId: "pro", redirect: { success: "https://evil.example/steal" } })), {
      code: PaymentErrorCodes.INVALID_REDIRECT,
      message: "Invalid checkout request.",
      statusCode: 400,
      retryable: false,
    });
  });

  it("Invalid Metadata", async () => {
    assert.deepEqual(await describeAsync(payments.checkout.create({ productId: "pro", metadata: { cardNumber: "4242" } })), {
      code: PaymentErrorCodes.INVALID_METADATA,
      message: 'metadata key "cardNumber" looks sensitive. Never store credentials or card data in Stripe metadata.',
      statusCode: 400,
      retryable: false,
    });
  });
});
