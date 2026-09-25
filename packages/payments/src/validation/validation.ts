import { PaymentConfigurationError, PaymentValidationError, type PaymentError } from "../errors/errors.js";
import type { Product } from "../types/public.js";

/**
 * Runtime validation for everything that may originate outside the server's
 * own code. TypeScript types are never trusted at runtime.
 */

export function validateQuantity(value: unknown, product: Product): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < product.minQuantity ||
    value > product.maxQuantity
  ) {
    throw new PaymentValidationError({
      code: "invalid_quantity",
      message: `Quantity must be a whole number between ${product.minQuantity} and ${product.maxQuantity}.`,
      field: "quantity",
    });
  }
  return value;
}

const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7e]{8,255}$/;

export function validateIdempotencyKey(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new PaymentValidationError({
      code: "invalid_idempotency_key",
      message: "Idempotency key must be 8–255 printable ASCII characters without spaces.",
      field: "idempotencyKey",
    });
  }
  return value;
}

const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9.-]{1,189}\.[A-Za-z]{2,63}$/;

export function validateEmail(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 254 || !EMAIL_PATTERN.test(value)) {
    throw new PaymentValidationError({ code: "invalid_request", message: "Invalid customer email.", field: "customerEmail" });
  }
  return value;
}

const REFERENCE_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

export function validateClientReference(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !REFERENCE_PATTERN.test(value)) {
    throw new PaymentValidationError({
      code: "invalid_request",
      message: "clientReferenceId must be 1–200 letters, digits, '-' or '_'.",
      field: "clientReferenceId",
    });
  }
  return value;
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/** Returns a safe correlation ID: the given one if well-formed, otherwise a new UUID. */
export function resolveRequestId(value: unknown): string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value) ? value : crypto.randomUUID();
}

/* ---------------------------------------------------------------- Metadata */

function metadataError(message: string): PaymentValidationError {
  return new PaymentValidationError({ code: "invalid_metadata", message, field: "metadata" });
}

/** Keys the library writes itself; applications can't override them. */
export const RESERVED_METADATA_KEYS: ReadonlySet<string> = new Set(["productId", "quantity"]);

const METADATA_KEY_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const SENSITIVE_METADATA_KEY =
  /card|cvc|cvv|pan$|password|passwd|secret|token|ssn|social|iban|account[_-]?number|routing|pin$|api[_-]?key/i;
const SENSITIVE_METADATA_VALUE = [/\b(?:\d[ -]?){12,18}\d\b/, /\b(sk|rk)_(test|live)_/, /\bwhsec_/, /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/];

/** Resolved, validated metadata rules. */
export interface ResolvedMetadataPolicy {
  readonly allowedKeys: ReadonlySet<string> | null;
  readonly maxKeys: number;
  readonly maxValueLength: number;
}

export const DEFAULT_METADATA_POLICY: ResolvedMetadataPolicy = Object.freeze({ allowedKeys: null, maxKeys: 20, maxValueLength: 500 });

function checkMetadataKey(key: string, fail: (message: string) => PaymentError): void {
  if (!METADATA_KEY_PATTERN.test(key)) throw fail("metadata keys must be 1–40 letters, digits, '-' or '_'.");
  if (RESERVED_METADATA_KEYS.has(key)) throw fail(`metadata key "${key}" is reserved by the payment library.`);
  if (SENSITIVE_METADATA_KEY.test(key)) {
    throw fail(`metadata key "${key}" looks sensitive. Never store credentials or card data in Stripe metadata.`);
  }
}

/** Validates the client-wide metadata policy (configuration errors). */
export function resolveMetadataPolicy(input: unknown): ResolvedMetadataPolicy {
  if (input === undefined) return DEFAULT_METADATA_POLICY;
  const fail = (message: string) => new PaymentConfigurationError(`metadata: ${message}`);
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw fail("must be an object.");
  for (const key of Object.keys(input)) {
    if (key !== "allowedKeys" && key !== "maxKeys" && key !== "maxValueLength") throw fail(`unsupported option "${key.slice(0, 40)}".`);
  }
  const allowedKeys: unknown = Reflect.get(input, "allowedKeys");
  const maxKeys: unknown = Reflect.get(input, "maxKeys") ?? 20;
  const maxValueLength: unknown = Reflect.get(input, "maxValueLength") ?? 500;
  if (typeof maxKeys !== "number" || !Number.isInteger(maxKeys) || maxKeys < 1 || maxKeys > 40) {
    throw fail("maxKeys must be an integer between 1 and 40 (Stripe allows 50; the library reserves some).");
  }
  if (typeof maxValueLength !== "number" || !Number.isInteger(maxValueLength) || maxValueLength < 1 || maxValueLength > 500) {
    throw fail("maxValueLength must be an integer between 1 and 500.");
  }
  let keys: Set<string> | null = null;
  if (allowedKeys !== undefined) {
    if (!Array.isArray(allowedKeys) || allowedKeys.length === 0 || allowedKeys.length > 40) {
      throw fail("allowedKeys must list 1–40 keys.");
    }
    keys = new Set();
    for (const key of allowedKeys) {
      if (typeof key !== "string") throw fail("allowedKeys must contain strings.");
      checkMetadataKey(key, (message) => fail(`allowedKeys: ${message}`));
      keys.add(key);
    }
  }
  return Object.freeze({ allowedKeys: keys, maxKeys, maxValueLength });
}

/**
 * Validates metadata. `enforceAllowedKeys` applies the allow-list (per-call
 * metadata); static product metadata only gets the safety rules.
 */
export function validateMetadata(
  value: unknown,
  policy: ResolvedMetadataPolicy = DEFAULT_METADATA_POLICY,
  options: { enforceAllowedKeys?: boolean; fail?: (message: string) => PaymentError } = {},
): Record<string, string> {
  const fail = options.fail ?? metadataError;
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw fail("metadata must be an object of string values.");
  }
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw fail("metadata must be a plain object.");

  const entries = Object.entries(value).filter(([, raw]) => raw !== undefined);
  if (entries.length > policy.maxKeys) throw fail(`metadata may contain at most ${policy.maxKeys} keys.`);

  const out: Record<string, string> = {};
  for (const [key, raw] of entries) {
    checkMetadataKey(key, fail);
    if (options.enforceAllowedKeys !== false && policy.allowedKeys && !policy.allowedKeys.has(key)) {
      throw fail(`metadata key "${key}" is not in metadata.allowedKeys.`);
    }
    if (typeof raw !== "string" || raw.length > policy.maxValueLength) {
      throw fail(`metadata values must be strings of at most ${policy.maxValueLength} characters.`);
    }
    if (SENSITIVE_METADATA_VALUE.some((pattern) => pattern.test(raw))) {
      throw fail(`metadata value for "${key}" looks like a card number, secret or contains control characters.`);
    }
    out[key] = raw;
  }
  return out;
}

/* ---------------------------------------------------------------- Customer */

const CUSTOMER_ID_PATTERN = /^cus_[A-Za-z0-9]{8,64}$/;

export interface ResolvedCustomer {
  readonly email?: string;
  readonly id?: string;
}

/** Merges the legacy `customerEmail` field with `customer` and validates both. */
export function validateCustomer(customer: unknown, legacyEmail: unknown): ResolvedCustomer {
  const fail = (message: string) =>
    new PaymentValidationError({ code: "invalid_customer", message, publicMessage: "Invalid customer details.", field: "customer" });
  if (customer !== undefined && (typeof customer !== "object" || customer === null || Array.isArray(customer))) {
    throw fail("customer must be an object.");
  }
  if (customer) {
    for (const key of Object.keys(customer)) if (key !== "email" && key !== "id") throw fail(`customer has unsupported property "${key.slice(0, 40)}".`);
  }
  const nestedEmail: unknown = customer ? Reflect.get(customer, "email") : undefined;
  const id: unknown = customer ? Reflect.get(customer, "id") : undefined;
  if (nestedEmail !== undefined && legacyEmail !== undefined && nestedEmail !== legacyEmail) {
    throw fail("customerEmail and customer.email disagree.");
  }
  const email = validateEmail(nestedEmail ?? legacyEmail);
  if (id !== undefined && (typeof id !== "string" || !CUSTOMER_ID_PATTERN.test(id))) throw fail("customer.id must be a Stripe customer ID (cus_…).");
  if (email && id) throw fail("Provide either customer.email or customer.id, not both (Stripe uses the customer's saved email).");
  return { ...(email ? { email } : {}), ...(typeof id === "string" ? { id } : {}) };
}

/* --------------------------------------------------- Untrusted request body */

const ALLOWED_REQUEST_FIELDS: ReadonlySet<string> = new Set(["productId", "quantity"]);

/**
 * Validates a checkout request coming from a browser. Only `productId` and
 * `quantity` are accepted; any other field (e.g. `amount`, `price`, `currency`)
 * is rejected, so clients can never influence what is charged.
 */
export function parseCheckoutBody(body: unknown): { productId: unknown; quantity: unknown } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new PaymentValidationError({ code: "invalid_request", message: "Request body must be a JSON object." });
  }
  for (const key of Object.keys(body)) {
    if (!ALLOWED_REQUEST_FIELDS.has(key)) {
      throw new PaymentValidationError({
        code: "unexpected_field",
        message: `Unexpected field "${key.slice(0, 40)}". Only productId and quantity are accepted.`,
        publicMessage: "Invalid checkout request.",
        field: key.slice(0, 40),
      });
    }
  }
  return {
    productId: Reflect.get(body, "productId"),
    // A missing quantity explicitly means 1; null, strings etc. are rejected later.
    quantity: Object.hasOwn(body, "quantity") ? Reflect.get(body, "quantity") : 1,
  };
}
