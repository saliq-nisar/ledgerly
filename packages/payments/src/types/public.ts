import type Stripe from "stripe";

import type { PaymentError, PaymentErrorCode } from "../errors/errors.js";
import type { LogFields } from "../security/redact.js";

/* ------------------------------------------------------------------ Config */

/**
 * "test" requires test-mode keys (sk_test_/rk_test_); "production" requires
 * live keys. The library never infers or switches this for you.
 */
export type PaymentEnvironment = "test" | "production";

/** Keeps only the literal members of a Stripe union (drops its open `string & {}` escape hatch). */
type Literal<T> = T extends string ? (string extends T ? never : T) : never;

/** Stripe Checkout locales. */
export type CheckoutLocale = Literal<Stripe.Checkout.SessionCreateParams.Locale>;
/** ISO 3166-1 alpha-2 countries Stripe accepts for shipping. */
export type ShippingCountry = Literal<Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry>;
export type CheckoutSubmitType = "auto" | "pay" | "book" | "donate";
export type TaxBehavior = "inclusive" | "exclusive" | "unspecified";

export interface CheckoutCustomText {
  /** Shown next to the pay button. Max 1200 characters. */
  readonly submit?: string;
  /** Shown after the payment is submitted. */
  readonly afterSubmit?: string;
  readonly shippingAddress?: string;
  readonly termsOfServiceAcceptance?: string;
}

interface CustomFieldBase {
  /** Alphanumeric key returned on the session (max 200). */
  readonly key: string;
  /** Label shown to the customer (max 50). */
  readonly label: string;
  readonly optional?: boolean;
}

/** An extra input shown on Stripe Checkout (max 3 per session). */
export type CheckoutCustomField =
  | (CustomFieldBase & { readonly type: "text" | "numeric"; readonly minLength?: number; readonly maxLength?: number })
  | (CustomFieldBase & {
      readonly type: "dropdown";
      readonly options: readonly { readonly label: string; readonly value: string }[];
    });

/**
 * Checkout behaviour. Every option is validated and mapped explicitly to a
 * Stripe parameter; nothing here can affect price, currency, quantity limits,
 * redirect origins or metadata rules.
 *
 * Levels: client-wide `checkout` → per-product `checkout` → per-call `options`
 * (later levels override earlier ones, option by option).
 */
export interface CheckoutOptions {
  /** Only one-time payments are supported today. */
  readonly mode?: "payment";
  /** Show a promotion code field. */
  readonly allowPromotionCodes?: boolean;
  /** true = always collect a billing address; false = only when required (Stripe "auto"). */
  readonly collectBillingAddress?: boolean;
  /** Collect a shipping address restricted to these countries, or false to disable. */
  readonly collectShippingAddress?: false | { readonly allowedCountries: readonly ShippingCountry[] };
  readonly collectPhoneNumber?: boolean;
  /** Stripe Tax (requires Stripe Tax to be set up on the account). */
  readonly automaticTax?: boolean;
  /** Pay-button wording. Default "pay". */
  readonly submitType?: CheckoutSubmitType;
  readonly locale?: CheckoutLocale;
  /** Generate a post-payment invoice. */
  readonly createInvoice?: boolean;
  /** Create a Stripe Customer object: always, or only if required. */
  readonly customerCreation?: "always" | "if_required";
  readonly consentCollection?: {
    /** Require acceptance of the terms of service configured in the Dashboard. */
    readonly termsOfService?: boolean;
    /** Ask for promotional-email consent (where allowed). */
    readonly promotions?: boolean;
  };
  readonly customText?: CheckoutCustomText;
  readonly customFields?: readonly CheckoutCustomField[];
  /** Session lifetime, 30–1440 minutes. Default: Stripe's 24 hours. */
  readonly expiresInMinutes?: number;
}

/**
 * Options that may vary per checkout call (always from server code).
 * Tax, invoicing and mode are business policy and can only be set client-wide
 * or per product.
 */
export type CheckoutRequestOptions = Omit<CheckoutOptions, "mode" | "automaticTax" | "createInvoice">;

/** A product the server is willing to sell. Prices are integers in minor units. */
export interface ProductDefinition {
  /** Display name shown on Stripe Checkout. */
  readonly name: string;
  /** Unit price in the currency's smallest unit (e.g. 2999 = $29.99). */
  readonly price: number;
  /** ISO 4217 code, e.g. "usd". Normalised to lowercase. */
  readonly currency: string;
  readonly description?: string;
  /** Per-product quantity limits (default: client-wide `checkout.quantity`). */
  readonly minQuantity?: number;
  readonly maxQuantity?: number;
  /** false = listed but not purchasable. Default true. */
  readonly active?: boolean;
  /** Up to 8 https image URLs shown on Checkout. */
  readonly images?: readonly string[];
  readonly taxBehavior?: TaxBehavior;
  /** Stripe tax code, e.g. "txcd_10103001". */
  readonly taxCode?: string;
  /**
   * Use a Price created in the Stripe Dashboard instead of an inline price.
   * The library verifies (once per process) that it is active, one-time, and
   * matches `price` and `currency` exactly; otherwise checkout is refused.
   */
  readonly stripePriceId?: string;
  /** Static metadata added to every session for this product. */
  readonly metadata?: Readonly<Record<string, string>>;
  /** Product-level checkout behaviour (overrides client-wide options). */
  readonly checkout?: CheckoutOptions;
}

/** Product catalog keyed by product ID. Extra fields on each entry are ignored. */
export type ProductCatalog = Readonly<Record<string, ProductDefinition>>;

export type ProductId<P extends ProductCatalog> = Extract<keyof P, string>;

/** Normalised, validated product as seen by the library. */
export interface Product<Id extends string = string> {
  readonly id: Id;
  readonly name: string;
  readonly description: string | undefined;
  readonly price: number;
  readonly currency: string;
  readonly minQuantity: number;
  readonly maxQuantity: number;
  readonly active: boolean;
  readonly images: readonly string[];
  readonly taxBehavior: TaxBehavior | undefined;
  readonly taxCode: string | undefined;
  readonly stripePriceId: string | undefined;
  readonly metadata: Readonly<Record<string, string>>;
}

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

/**
 * Any logger works (console, pino, winston…). The library redacts every field
 * before calling it, so even an untrusted logger never receives secrets.
 */
export interface PaymentLogger {
  debug?(message: string, fields: LogFields): void;
  info(message: string, fields: LogFields): void;
  warn(message: string, fields: LogFields): void;
  error(message: string, fields: LogFields): void;
}

export type PaymentOperation =
  | "checkout.create"
  | "checkout.retrieve"
  | "webhooks.constructEvent"
  | "webhooks.handle";

/** Safe, secret-free description of a completed operation. */
export interface OperationInfo {
  readonly operation: PaymentOperation;
  readonly requestId: string;
  readonly durationMs: number;
  readonly outcome: "success" | "error";
  readonly stripeRequestId?: string;
  readonly errorCode?: string;
}

export interface WebhookInfo {
  readonly requestId: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly outcome: WebhookOutcome;
  readonly durationMs: number;
}

export interface WebhookReceivedInfo {
  readonly requestId: string;
  readonly eventId: string;
  readonly eventType: string;
}

export interface CheckoutCreatedInfo {
  readonly requestId: string;
  readonly sessionId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly amountTotal: number;
  readonly currency: string;
}

/**
 * Provider-agnostic monitoring hooks (Sentry, Datadog, OpenTelemetry, …).
 * Fire-and-forget: they run after the fact, are never awaited, and a failing
 * hook can't affect a payment.
 */
export interface PaymentHooks {
  onRequest?(info: OperationInfo): void | Promise<void>;
  onError?(error: PaymentError, info: OperationInfo): void | Promise<void>;
  onCheckoutCreated?(info: CheckoutCreatedInfo): void | Promise<void>;
  /** A webhook passed signature verification. */
  onWebhookReceived?(info: WebhookReceivedInfo): void | Promise<void>;
  /** A webhook finished (processed, ignored or duplicate). */
  onWebhookProcessed?(info: WebhookInfo): void | Promise<void>;
  /** @deprecated Alias of onWebhookProcessed. */
  onWebhook?(info: WebhookInfo): void | Promise<void>;
}

/**
 * Durable deduplication for webhook events using an atomic claim.
 * Implement with a unique constraint on the event ID.
 */
export interface WebhookEventStore {
  /** Atomically record the event as in-progress. Return false if it was already claimed. */
  claim(eventId: string, eventType: string): Promise<boolean>;
  /** Called after all handlers succeeded. */
  complete?(eventId: string): Promise<void>;
  /** Called when a handler failed, so Stripe's retry can process the event again. */
  release(eventId: string): Promise<void>;
}

/**
 * Simpler check-then-mark deduplication. The event is marked only after all
 * handlers succeed. Concurrent deliveries of the same event may both run, so
 * handlers must still be idempotent; prefer WebhookEventStore when you can.
 */
export interface ProcessedEventStorage {
  hasProcessedEvent(eventId: string): Promise<boolean>;
  markEventProcessed(eventId: string, eventType: string): Promise<void>;
}

export type PaymentStorage = WebhookEventStore | ProcessedEventStorage;

/* ------------------------------------------------------------- Callbacks */

export interface CheckoutCustomer {
  /** Pre-fills and locks the email field on Checkout. */
  readonly email?: string;
  /** Existing Stripe Customer (cus_…). Mutually exclusive with email. */
  readonly id?: string;
}

/** Runs after validation and pricing, before Stripe is called. Throw to refuse the checkout. */
export interface BeforeCheckoutContext<Id extends string = string> {
  readonly requestId: string;
  readonly product: Product<Id>;
  readonly quantity: number;
  readonly amountTotal: number;
  readonly currency: string;
  readonly customer: CheckoutCustomer;
  readonly clientReferenceId: string | undefined;
  readonly metadata: Readonly<Record<string, string>>;
}

/** Runs after Stripe created the session, before `create()` returns. */
export interface AfterCheckoutContext<Id extends string = string> extends BeforeCheckoutContext<Id> {
  readonly session: CheckoutSessionResult;
}

/** Normalised payment outcome delivered from verified webhooks. */
export interface PaymentOutcome<Id extends string = string> {
  readonly eventId: string;
  readonly checkoutSessionId: string;
  readonly paymentIntentId: string | null;
  /** Product from your catalog, or null if the session references an unknown product. */
  readonly product: Product<Id> | null;
  readonly quantity: number;
  readonly amountTotal: number;
  readonly currency: string;
  readonly customerEmail: string | null;
  readonly clientReferenceId: string | null;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface PaymentAttemptFailure<Id extends string = string> {
  readonly eventId: string;
  readonly paymentIntentId: string;
  readonly product: Product<Id> | null;
  readonly amount: number;
  readonly currency: string;
  readonly declineCode: string | null;
  readonly errorCode: string | null;
}

/**
 * Application callbacks. Unlike monitoring hooks, these are awaited and can
 * affect the flow; see each callback for its failure semantics.
 */
export interface PaymentCallbacks<Id extends string = string> {
  /**
   * Before Stripe. Throw (ideally `rejectCheckout("…")`) to refuse the purchase,
   * e.g. out of stock or not eligible. No session is created.
   */
  beforeCheckout?(context: BeforeCheckoutContext<Id>): void | Promise<void>;
  /**
   * After Stripe, before `create()` resolves. Errors are logged and reported to
   * `onError` but NOT thrown: the session already exists, and failing here
   * would invite a retry that creates a duplicate session.
   */
  afterCheckout?(context: AfterCheckoutContext<Id>): void | Promise<void>;
  /**
   * After webhook verification: payment confirmed (checkout.session.completed
   * with a paid status, or checkout.session.async_payment_succeeded).
   * Throwing → webhook responds 500 → Stripe retries. Must be idempotent.
   */
  onPaymentSucceeded?(payment: PaymentOutcome<Id>, context: WebhookContext): void | Promise<void>;
  /** After webhook verification: a delayed payment method failed (checkout.session.async_payment_failed). */
  onPaymentFailed?(payment: PaymentOutcome<Id>, context: WebhookContext): void | Promise<void>;
  /** After webhook verification: one payment attempt was declined (payment_intent.payment_failed). The customer may still retry. */
  onPaymentAttemptFailed?(attempt: PaymentAttemptFailure<Id>, context: WebhookContext): void | Promise<void>;
  /** After webhook verification: the session expired unpaid (checkout.session.expired). */
  onCheckoutExpired?(session: PaymentOutcome<Id>, context: WebhookContext): void | Promise<void>;
}

/* ------------------------------------------------------------------ Client */

export interface MetadataPolicy<M extends string = string> {
  /** Restricts per-call metadata to these keys (also narrows the TypeScript type). */
  readonly allowedKeys?: readonly M[];
  /** Max application keys per session, 1–40. Default 20. */
  readonly maxKeys?: number;
  /** Max value length, 1–500. Default 500. */
  readonly maxValueLength?: number;
}

export interface RedirectPaths {
  /** Same-origin path or allow-listed absolute URL. `session_id={CHECKOUT_SESSION_ID}` is appended if absent. */
  readonly success?: string;
  /** Same-origin path or allow-listed absolute URL; may contain {PRODUCT_ID}. */
  readonly cancel?: string;
}

export interface PaymentClientConfig<P extends ProductCatalog, M extends string = string> {
  /** Products the server sells. The only source of prices. */
  products: P;
  /** Stripe secret key. Default: env STRIPE_SECRET_KEY. */
  secretKey?: string;
  /** Webhook signing secret. Default: env STRIPE_WEBHOOK_SECRET. Optional if you don't receive webhooks. */
  webhookSecret?: string;
  /** Default: env PAYMENTS_ENVIRONMENT, otherwise "test". */
  environment?: PaymentEnvironment;
  /** Public origin used for redirect URLs, e.g. https://shop.example.com. Default: env APP_URL. */
  appUrl?: string;
  /** Redirect targets (alias of checkout.successPath / checkout.cancelPath). */
  urls?: RedirectPaths;
  checkout?: CheckoutOptions & {
    /** Default "/payment/success?session_id={CHECKOUT_SESSION_ID}". */
    successPath?: string;
    /** Default "/payment/cancelled?product={PRODUCT_ID}". */
    cancelPath?: string;
    /** Default quantity limits for all products. Default { min: 1, max: 10 }. */
    quantity?: { min?: number; max?: number };
  };
  metadata?: MetadataPolicy<M>;
  security?: {
    /**
     * Extra origins that redirect URLs may point to (e.g. a separate
     * marketing domain). Default: only appUrl. Must be https in production.
     */
    allowedRedirectOrigins?: readonly string[];
  };
  webhooks?: {
    /** Max age of a webhook signature timestamp. Default 300 seconds. */
    toleranceSeconds?: number;
    /** Enables automatic duplicate-event protection. */
    eventStore?: WebhookEventStore;
  };
  /** Persistence adapters (currently: webhook event deduplication). Same as webhooks.eventStore. */
  storage?: PaymentStorage;
  callbacks?: PaymentCallbacks<ProductId<P>>;
  network?: {
    /** Automatic retries for safe failures, always with an idempotency key. Default 2 (max 5). */
    maxRetries?: number;
    /** Per-request timeout. Default 20000 ms. */
    timeoutMs?: number;
  };
  /** Structured logger. Default: console in "test", disabled in "production". Pass false to disable. */
  logger?: PaymentLogger | false;
  logging?: {
    logger?: PaymentLogger | false;
    /** Minimum level passed to the logger. Default "info". */
    level?: LogLevel;
  };
  /** Monitoring hooks. */
  monitoring?: PaymentHooks;
  /** @deprecated Use `monitoring`. Still supported. */
  hooks?: PaymentHooks;
  errors?: {
    /** Replace the default user-facing message for specific error codes. */
    publicMessages?: Partial<Readonly<Record<PaymentErrorCode, string>>>;
  };
  /** Environment source for defaults. Default: process.env. */
  env?: Readonly<Record<string, string | undefined>>;
}

/* ---------------------------------------------------------------- Checkout */

/** Untrusted checkout request after validation (what a browser may send). */
export interface CheckoutRequest<Id extends string = string> {
  readonly productId: Id;
  readonly quantity: number;
}

/** Metadata accepted per call: any keys, or only `metadata.allowedKeys` when configured. */
export type MetadataInput<M extends string> = string extends M
  ? Readonly<Record<string, string>>
  : Readonly<{ [K in M]?: string }>;

export interface CheckoutCreateInput<Id extends string = string, M extends string = string> {
  productId: Id;
  /** Default 1. Validated at runtime against the product's limits. */
  quantity?: number;
  /**
   * Makes retries of the *same* purchase attempt safe. Use one key per attempt
   * (e.g. generated when the checkout page loads). Omit it and the library
   * still protects its own network retries; it never derives keys from the
   * product/quantity, so separate purchases are never merged.
   */
  idempotencyKey?: string;
  /** Pre-fills the email field on Checkout. Alias of `customer.email`. */
  customerEmail?: string;
  customer?: CheckoutCustomer;
  /** Your own reference (e.g. order ID), returned on the session and in webhooks. Must come from server code. */
  clientReferenceId?: string;
  /** Server-side metadata. Sensitive-looking keys/values are rejected. */
  metadata?: MetadataInput<M>;
  /** Per-call checkout behaviour (overrides product and client-wide options). */
  options?: CheckoutRequestOptions;
  /** Per-call redirect targets; same origin rules as `urls`. */
  redirect?: RedirectPaths;
  /** Correlation ID for logs and hooks. Generated if omitted. */
  requestId?: string;
}

export interface CheckoutSessionResult {
  /** Checkout Session ID (cs_…). */
  readonly id: string;
  /** Stripe-hosted page to redirect the customer to. */
  readonly url: string;
  readonly expiresAt: Date;
  readonly requestId: string;
}

export type CheckoutPaymentStatus = "paid" | "processing" | "unpaid" | "expired";

/** Trusted view of a Checkout Session, fetched from Stripe. */
export interface CheckoutSummary<Id extends string = string> {
  readonly id: string;
  readonly status: CheckoutPaymentStatus;
  /** Product from your catalog, or null if the session references an unknown product. */
  readonly product: Product<Id> | null;
  readonly quantity: number;
  readonly amountTotal: number;
  readonly currency: string;
  readonly paymentIntentId: string | null;
  readonly customerEmail: string | null;
  readonly clientReferenceId: string | null;
  readonly createdAt: Date;
  /** Your metadata (library-reserved keys removed). */
  readonly metadata: Readonly<Record<string, string>>;
}

/* ---------------------------------------------------------------- Webhooks */

export type PaymentEvent = Stripe.Event;
export type PaymentEventType = Stripe.Event["type"];
export type PaymentEventOf<T extends PaymentEventType> = Extract<Stripe.Event, { type: T }>;

export interface WebhookContext {
  readonly requestId: string;
}

export type WebhookHandler<T extends PaymentEventType> = (
  event: PaymentEventOf<T>,
  context: WebhookContext,
) => void | Promise<void>;

export type WebhookOutcome = "processed" | "ignored" | "duplicate";

export interface WebhookResult {
  readonly eventId: string;
  readonly eventType: string;
  readonly outcome: WebhookOutcome;
}

export type WebhookPayload = string | Uint8Array;

/** Safe, user-facing description of any error (see `payments.errors.describe`). */
export interface PublicErrorInfo {
  readonly code: string;
  readonly message: string;
  readonly statusCode: number;
  readonly retryable: boolean;
}
