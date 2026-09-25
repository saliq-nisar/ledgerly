// lib/payments.ts — one server-only module that owns the payment client.
// `#region` markers are used by the demo website to display these exact snippets.
// #region lib
import "server-only"; // optional in Next.js: fails the build if a Client Component imports this file
import { createPaymentClient, defineProducts } from "../../src/index.js";

export const products = defineProducts({
  pro: { name: "Pro", price: 1999, currency: "usd" },
});

export const payments = createPaymentClient({ products });

payments.webhooks.on("checkout.session.completed", async (event) => {
  // Fulfil the order. This event, not the success page, is the "paid" signal.
  void event;
});
// #endregion lib
