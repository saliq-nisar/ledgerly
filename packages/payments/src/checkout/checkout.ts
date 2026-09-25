import type Stripe from "stripe";

import {
  isPaymentError,
  PaymentConfigurationError,
  PaymentError,
  PaymentProviderError,
  PaymentValidationError,
} from "../errors/errors.js";
import { normalizeStripeError } from "../errors/normalize.js";
import { multiplyAmount } from "../money/money.js";
import type { Observer } from "../observability/observability.js";
import type { ProductRegistry } from "../products/products.js";
import { buildRedirectUrl, validateRedirectTarget, type RedirectPolicy } from "../security/urls.js";
import type {
  CheckoutCreateInput,
  CheckoutOptions,
  CheckoutPaymentStatus,
  CheckoutRequest,
  CheckoutSessionResult,
  CheckoutSummary,
  PaymentCallbacks,
  PaymentEnvironment,
  Product,
  ProductCatalog,
  ProductId,
} from "../types/public.js";
import {
  parseCheckoutBody,
  RESERVED_METADATA_KEYS,
  resolveRequestId,
  validateClientReference,
  validateCustomer,
  validateIdempotencyKey,
  validateMetadata,
  validateQuantity,
  type ResolvedMetadataPolicy,
} from "../validation/validation.js";
import { mergeCheckoutOptions, toStripeSessionParams, validateCheckoutOptions } from "./options.js";

export interface CheckoutDependencies<P extends ProductCatalog> {
  stripe: () => Stripe;
  products: ProductRegistry<P>;
  observer: Observer;
  environment: PaymentEnvironment;
  redirects: RedirectPolicy;
  successPath: string;
  cancelPath: string;
  clientOptions: Readonly<CheckoutOptions>;
  metadataPolicy: ResolvedMetadataPolicy;
  callbacks: PaymentCallbacks<ProductId<P>>;
}

const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{10,250}$/;

/** Every field `checkout.create` understands. Anything else is rejected, never forwarded. */
const CREATE_INPUT_KEYS: ReadonlySet<string> = new Set([
  "productId",
  "quantity",
  "idempotencyKey",
  "customerEmail",
  "customer",
  "clientReferenceId",
  "metadata",
  "options",
  "redirect",
  "requestId",
]);

export interface CheckoutApi<P extends ProductCatalog, M extends string = string> {
  /**
   * Validates an untrusted request body (e.g. from `await request.json()`).
   * Accepts only `{ productId, quantity? }`; anything else is rejected.
   */
  parse(body: unknown): CheckoutRequest<ProductId<P>>;
  /** Creates a Stripe-hosted Checkout Session. The price always comes from the catalog. */
  create(input: CheckoutCreateInput<ProductId<P>, M>): Promise<CheckoutSessionResult>;
  /** Fetches a session from Stripe. Use for the success page — never trust query parameters. */
  retrieve(sessionId: string, options?: { requestId?: string }): Promise<CheckoutSummary<ProductId<P>>>;
}

function toSummaryStatus(session: Stripe.Checkout.Session): CheckoutPaymentStatus {
  if (session.payment_status === "paid" || session.payment_status === "no_payment_required") return "paid";
  if (session.status === "expired") return "expired";
  // Complete but unpaid happens with delayed payment methods (e.g. bank debits).
  if (session.status === "complete") return "processing";
  return "unpaid";
}

function redirectError(message: string): PaymentValidationError {
  return new PaymentValidationError({
    code: "invalid_redirect",
    message: `redirect ${message}`,
    publicMessage: "Invalid checkout request.",
    field: "redirect",
  });
}

export function createCheckoutApi<P extends ProductCatalog, M extends string = string>(
  deps: CheckoutDependencies<P>,
): CheckoutApi<P, M> {
  const { products, observer, callbacks } = deps;
  /** stripePriceId → verification in flight or done. Failed verifications are evicted so they can be retried. */
  const verifiedPrices = new Map<string, Promise<void>>();

  function parse(body: unknown): CheckoutRequest<ProductId<P>> {
    const raw = parseCheckoutBody(body);
    const product = products.require(raw.productId);
    return { productId: product.id, quantity: validateQuantity(raw.quantity, product) };
  }

  /** Confirms a Dashboard-managed Price matches the catalog before charging with it. */
  function verifyStripePrice(product: Product<ProductId<P>>, priceId: string): Promise<void> {
    let pending = verifiedPrices.get(priceId);
    if (!pending) {
      pending = (async () => {
        let price: Stripe.Price;
        try {
          price = await deps.stripe().prices.retrieve(priceId);
        } catch (error) {
          throw normalizeStripeError(error);
        }
        const problems: string[] = [];
        if (!price.active) problems.push("is not active");
        if (price.type !== "one_time") problems.push("is not a one-time price");
        if (price.currency !== product.currency) problems.push(`currency ${price.currency} ≠ catalog ${product.currency}`);
        if (price.unit_amount !== product.price) problems.push(`amount ${String(price.unit_amount)} ≠ catalog ${product.price}`);
        if (problems.length > 0) {
          throw new PaymentConfigurationError(
            `products["${product.id}"].stripePriceId ${problems.join(", ")}. Checkout refused to avoid charging a different amount than configured.`,
          );
        }
      })();
      verifiedPrices.set(priceId, pending);
      pending.catch(() => verifiedPrices.delete(priceId));
    }
    return pending;
  }

  async function create(input: CheckoutCreateInput<ProductId<P>, M>): Promise<CheckoutSessionResult> {
    const requestId = resolveRequestId(input?.requestId);
    return observer.instrument("checkout.create", requestId, async () => {
      if (typeof input !== "object" || input === null || Array.isArray(input)) {
        throw new PaymentValidationError({ code: "invalid_request", message: "Checkout input must be an object." });
      }
      for (const key of Object.keys(input)) {
        if (!CREATE_INPUT_KEYS.has(key)) {
          throw new PaymentValidationError({
            code: "unexpected_field",
            message: `checkout.create does not accept "${key.slice(0, 40)}". Prices, currency and Stripe parameters come from server configuration.`,
            publicMessage: "Invalid checkout request.",
            field: key.slice(0, 40),
          });
        }
      }

      // 1. Validate every field at runtime even though the types already constrain them.
      const product = products.require(input.productId);
      const quantity = validateQuantity(input.quantity ?? 1, product);
      const amountTotal = multiplyAmount(product.price, quantity);
      const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
      const customer = validateCustomer(input.customer, input.customerEmail);
      const clientReferenceId = validateClientReference(input.clientReferenceId);
      const callMetadata = validateMetadata(input.metadata, deps.metadataPolicy);
      const appMetadata = { ...product.metadata, ...callMetadata };
      if (Object.keys(appMetadata).length > deps.metadataPolicy.maxKeys) {
        throw new PaymentValidationError({
          code: "invalid_metadata",
          message: `Product and call metadata together exceed ${deps.metadataPolicy.maxKeys} keys.`,
          field: "metadata",
        });
      }
      const metadata = { ...appMetadata, productId: product.id, quantity: String(quantity) };

      // 2. Resolve options: client-wide → product → this call.
      const requestOptions = validateCheckoutOptions(input.options, "request", "options");
      const options = mergeCheckoutOptions(deps.clientOptions, products.checkoutOptions(product.id), requestOptions);
      if (customer.id && options.customerCreation !== undefined) {
        throw new PaymentValidationError({
          code: "invalid_checkout_options",
          message: "customerCreation can't be combined with an existing customer.id.",
          field: "options",
        });
      }

      // 3. Resolve redirect URLs (same origin rules as configuration).
      if (input.redirect !== undefined && (typeof input.redirect !== "object" || input.redirect === null)) {
        throw redirectError("must be an object.");
      }
      const redirectInput: Record<string, unknown> = { ...(input.redirect ?? {}) };
      for (const key of Object.keys(redirectInput)) if (key !== "success" && key !== "cancel") throw redirectError(`has unsupported property "${key.slice(0, 40)}".`);
      const successTemplate =
        redirectInput.success === undefined
          ? deps.successPath
          : validateRedirectTarget(redirectInput.success, "success", deps.redirects, (m) => redirectError(`.success ${m}`));
      const cancelTemplate =
        redirectInput.cancel === undefined
          ? deps.cancelPath
          : validateRedirectTarget(redirectInput.cancel, "cancel", deps.redirects, (m) => redirectError(`.cancel ${m}`));
      const successUrl = buildRedirectUrl(successTemplate, deps.redirects.appOrigin, product.id);
      const cancelUrl = buildRedirectUrl(cancelTemplate, deps.redirects.appOrigin, product.id);

      // 4. Dashboard-managed prices must match the catalog exactly.
      if (product.stripePriceId) await verifyStripePrice(product, product.stripePriceId);

      const context = Object.freeze({
        requestId,
        product,
        quantity,
        amountTotal,
        currency: product.currency,
        customer: Object.freeze({ ...customer }),
        clientReferenceId,
        metadata: Object.freeze({ ...appMetadata }),
      });

      // 5. Application veto (inventory, eligibility…). Any throw stops here: no session is created.
      if (callbacks.beforeCheckout) {
        try {
          await callbacks.beforeCheckout(context);
        } catch (error) {
          if (isPaymentError(error)) throw error;
          throw new PaymentValidationError({
            code: "checkout_rejected",
            message: "callbacks.beforeCheckout threw; checkout was not created.",
            publicMessage: "This purchase can't be completed right now.",
            statusCode: 422,
            cause: { source: "handler", type: error instanceof Error ? error.name : typeof error },
          });
        }
      }

      // 6. Build Stripe parameters field by field. No input object is ever spread in.
      const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = product.stripePriceId
        ? { price: product.stripePriceId, quantity }
        : {
            quantity,
            price_data: {
              currency: product.currency,
              unit_amount: product.price,
              ...(product.taxBehavior ? { tax_behavior: product.taxBehavior } : {}),
              product_data: {
                name: product.name,
                ...(product.description ? { description: product.description } : {}),
                ...(product.images.length > 0 ? { images: [...product.images] } : {}),
                ...(product.taxCode ? { tax_code: product.taxCode } : {}),
              },
            },
          };
      const params: Stripe.Checkout.SessionCreateParams = {
        ...toStripeSessionParams(options),
        mode: "payment",
        line_items: [lineItem],
        metadata,
        payment_intent_data: { metadata },
        success_url: successUrl,
        cancel_url: cancelUrl,
        ...(customer.email ? { customer_email: customer.email } : {}),
        ...(customer.id ? { customer: customer.id } : {}),
        ...(clientReferenceId ? { client_reference_id: clientReferenceId } : {}),
      };

      let session: Stripe.Response<Stripe.Checkout.Session>;
      try {
        // Without an explicit key, the Stripe SDK attaches its own idempotency
        // key to its automatic retries, so a retried request can't create a
        // second session.
        session = await deps.stripe().checkout.sessions.create(params, idempotencyKey ? { idempotencyKey } : undefined);
      } catch (error) {
        throw normalizeStripeError(error);
      }

      const stripeRequestId = session.lastResponse?.requestId;
      if (!session.url) {
        throw new PaymentProviderError("Stripe returned a Checkout Session without a redirect URL.", {
          cause: { source: "stripe", ...(stripeRequestId ? { stripeRequestId } : {}) },
        });
      }
      const adjustable = options.automaticTax || options.allowPromotionCodes || product.taxBehavior === "exclusive";
      if (!adjustable && session.amount_total !== null && session.amount_total !== amountTotal) {
        observer.log("warn", "Checkout amount differs from catalog total", {
          requestId,
          sessionId: session.id,
          expected: amountTotal,
          actual: session.amount_total,
        });
      }

      const result: CheckoutSessionResult = Object.freeze({
        id: session.id,
        url: session.url,
        expiresAt: new Date(session.expires_at * 1000),
        requestId,
      });
      observer.checkoutCreated({
        requestId,
        sessionId: session.id,
        productId: product.id,
        quantity,
        amountTotal,
        currency: product.currency,
      });

      // 7. Application follow-up. Failures are reported, never thrown: the
      // session exists, and an error here would invite a duplicate retry.
      if (callbacks.afterCheckout) {
        try {
          await callbacks.afterCheckout(Object.freeze({ ...context, session: result }));
        } catch (error) {
          const reported =
            error instanceof PaymentError
              ? error
              : new PaymentProviderError("callbacks.afterCheckout failed after the session was created.", {
                  cause: { source: "handler", type: error instanceof Error ? error.name : typeof error },
                });
          observer.log("error", "afterCheckout callback failed; session was still returned", {
            requestId,
            sessionId: session.id,
            errorName: reported.name,
          });
          observer.handledError(reported, {
            operation: "checkout.create",
            requestId,
            durationMs: 0,
            outcome: "error",
            errorCode: reported.code,
          });
        }
      }

      return { value: result, stripeRequestId };
    });
  }

  async function retrieve(sessionId: string, options?: { requestId?: string }): Promise<CheckoutSummary<ProductId<P>>> {
    const requestId = resolveRequestId(options?.requestId);
    return observer.instrument("checkout.retrieve", requestId, async () => {
      const match = typeof sessionId === "string" ? SESSION_ID_PATTERN.exec(sessionId) : null;
      const expectedMode = deps.environment === "production" ? "live" : "test";
      if (!match || match[1] !== expectedMode) {
        throw new PaymentValidationError({
          code: "invalid_session_id",
          message: `Invalid Checkout Session ID for the ${deps.environment} environment.`,
          publicMessage: "We couldn't find a payment matching this link.",
          field: "sessionId",
        });
      }

      let session: Stripe.Response<Stripe.Checkout.Session>;
      try {
        session = await deps.stripe().checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
      } catch (error) {
        throw normalizeStripeError(error);
      }

      const product = products.get(session.metadata?.productId) ?? null;
      const lineItem = session.line_items?.data[0];
      const quantityFromMetadata = Number.parseInt(session.metadata?.quantity ?? "", 10);
      const metadata: Record<string, string> = {};
      for (const [key, value] of Object.entries(session.metadata ?? {})) {
        if (!RESERVED_METADATA_KEYS.has(key)) metadata[key] = value;
      }

      const summary: CheckoutSummary<ProductId<P>> = {
        id: session.id,
        status: toSummaryStatus(session),
        product,
        quantity: lineItem?.quantity ?? (Number.isSafeInteger(quantityFromMetadata) ? quantityFromMetadata : 1),
        amountTotal: session.amount_total ?? 0,
        currency: session.currency ?? product?.currency ?? "usd",
        paymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
        customerEmail: session.customer_details?.email ?? null,
        clientReferenceId: session.client_reference_id ?? null,
        createdAt: new Date(session.created * 1000),
        metadata,
      };
      return { value: summary, stripeRequestId: session.lastResponse?.requestId };
    });
  }

  return { parse, create, retrieve };
}
