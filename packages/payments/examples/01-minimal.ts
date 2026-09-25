// Minimal integration: products + env vars (STRIPE_SECRET_KEY, APP_URL).
// In your app, import from "@ledgerly/payments" instead of "../src/index.js".
// `#region` markers are used by the demo website to display these exact snippets.

// #region setup
import { createPaymentClient, defineProducts } from "../src/index.js";

export const products = defineProducts({
  starter: { name: "Starter", price: 999, currency: "usd" }, //  $9.99
  pro: { name: "Pro", price: 1999, currency: "usd" }, // $19.99
  business: { name: "Business", price: 4999, currency: "usd" }, // $49.99
});

export const payments = createPaymentClient({ products });
// #endregion setup

export async function startCheckout() {
  // #region checkout
  const session = await payments.checkout.create({
    productId: "pro",
    quantity: 1,
  });
  // → { id: "cs_test_…", url: "https://checkout.stripe.com/…", expiresAt, requestId }
  // #endregion checkout
  return session.url; // redirect the customer here
}

export async function successPage(sessionId: string) {
  // #region retrieve
  const payment = await payments.checkout.retrieve(sessionId);
  // payment.status: "paid" | "processing" | "unpaid" | "expired"
  // #endregion retrieve
  return payment;
}
