// Framework integration. The /web handlers use standard Request/Response.
// `#region` markers are used by the demo website to display these exact snippets.
import { createCheckoutHandler, createWebhookHandler } from "../src/adapters/web.js";
import { isPaymentError, PaymentErrorCodes, rejectCheckout } from "../src/index.js";
import { payments } from "./01-minimal.js";

/* Next.js App Router: see examples/nextjs/ for the two route files. */

/* ------------------------------------------------------------------ Hono */

// Minimal shape of a Hono app, so this example type-checks without the dependency.
declare const app: {
  post(path: string, handler: (c: { req: { raw: Request } }) => Response | Promise<Response>): void;
};

// #region hono
const checkout = createCheckoutHandler(payments);
const webhook = createWebhookHandler(payments);

app.post("/api/checkout", (c) => checkout(c.req.raw));
app.post("/api/webhook", (c) => webhook(c.req.raw));
// #endregion hono

/* --------------------------------------------------------------- Express */

interface ExpressLikeRequest { body: Buffer; headers: Record<string, string | string[] | undefined> }
interface ExpressLikeResponse { status(code: number): ExpressLikeResponse; json(body: unknown): void }

// #region express
// app.post("/api/webhook", express.raw({ type: "application/json" }), expressWebhook)
export async function expressWebhook(req: ExpressLikeRequest, res: ExpressLikeResponse) {
  try {
    const signature = req.headers["stripe-signature"];
    const result = await payments.webhooks.handle(
      req.body, // raw Buffer, never parsed JSON
      typeof signature === "string" ? signature : undefined,
    );
    res.status(200).json({ received: true, outcome: result.outcome });
  } catch (error) {
    const info = payments.errors.describe(error);
    res.status(info.statusCode).json({ error: { code: info.code, message: info.message } });
  }
}
// #endregion express

/* ------------------------------------------------------- Webhook events */

// #region webhooks
// Subscribe only to the events you need; each handler gets the exact Stripe event type.
payments.webhooks.on("checkout.session.completed", async (event) => {
  if (event.data.object.payment_status === "paid") {
    // fulfil the order
  }
});

payments.webhooks.on("checkout.session.expired", async () => {
  // release reserved inventory
});
// #endregion webhooks

/* ---------------------------------------------------------------- Errors */

declare const ui: { showError(message: string): void };
declare const input: Parameters<typeof payments.checkout.create>[0];

export async function errorsExample() {
  // #region errors
  try {
    await payments.checkout.create(input);
  } catch (error) {
    const { code, message, statusCode, retryable } = payments.errors.describe(error);
    // e.g. { code: "invalid_product", message: "Unknown product.", statusCode: 400, retryable: false }

    if (code === PaymentErrorCodes.INVALID_QUANTITY) ui.showError("Please pick 1–10 seats.");
    else ui.showError(message); // always safe to show; never contains internals
    void statusCode;
    void retryable;
  }
  // #endregion errors
}

export function describeForUi(error: unknown) {
  return isPaymentError(error) ? error.code : "internal_error";
}

export const inventoryCheck = () => rejectCheckout("Sorry, that's sold out.");
