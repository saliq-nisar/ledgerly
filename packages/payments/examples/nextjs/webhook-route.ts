// app/api/webhook/route.ts
// #region route
import { createWebhookHandler } from "../../src/adapters/web.js";
import { payments } from "./payments.js";

// Reads the raw body, verifies the Stripe-Signature header, then runs your handlers.
export const POST = createWebhookHandler(payments);
// #endregion route
