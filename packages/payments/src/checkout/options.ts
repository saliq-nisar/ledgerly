import type Stripe from "stripe";

import { PaymentConfigurationError, PaymentValidationError, type PaymentError } from "../errors/errors.js";
import type { CheckoutCustomField, CheckoutOptions, ShippingCountry } from "../types/public.js";

/**
 * Checkout options: runtime validation, level-by-level merging, and an
 * explicit field-by-field mapping to Stripe parameters. Unknown keys are
 * rejected — nothing is ever spread into the Stripe request.
 */

export type OptionsLevel = "client" | "product" | "request";

const ALL_KEYS = [
  "mode",
  "allowPromotionCodes",
  "collectBillingAddress",
  "collectShippingAddress",
  "collectPhoneNumber",
  "automaticTax",
  "submitType",
  "locale",
  "createInvoice",
  "customerCreation",
  "consentCollection",
  "customText",
  "customFields",
  "expiresInMinutes",
] as const satisfies readonly (keyof CheckoutOptions)[];

/** Options that describe business policy and therefore can't vary per call. */
const POLICY_ONLY_KEYS: ReadonlySet<string> = new Set(["mode", "automaticTax", "createInvoice"]);

/** Keys on the client-wide `checkout` object that aren't Checkout options. */
const CLIENT_EXTRA_KEYS: ReadonlySet<string> = new Set(["successPath", "cancelPath", "quantity"]);

const SUBMIT_TYPES: ReadonlySet<string> = new Set(["auto", "pay", "book", "donate"]);
const LOCALE_PATTERN = /^(auto|[a-z]{2,3}(-[A-Za-z0-9]{2,3})?)$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const CUSTOM_FIELD_KEY = /^[A-Za-z0-9]{1,200}$/;
const DROPDOWN_VALUE = /^[A-Za-z0-9]{1,100}$/;
// Printable text; newlines allowed, other control characters not.
const SAFE_TEXT = /^[^\u0000-\u0009\u000b-\u001f\u007f]*$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export interface Validator {
  fail(message: string): PaymentError;
}

/** Config-time problems are configuration errors; per-call problems are validation errors. */
export function validatorFor(level: OptionsLevel, label: string): Validator {
  return {
    fail: (message) =>
      level === "request"
        ? new PaymentValidationError({
            code: "invalid_checkout_options",
            message: `${label}: ${message}`,
            publicMessage: "Invalid checkout request.",
            field: "options",
          })
        : new PaymentConfigurationError(`${label}: ${message}`),
  };
}

function text(value: unknown, max: number, name: string, v: Validator): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max || !SAFE_TEXT.test(value)) {
    throw v.fail(`${name} must be non-empty text of at most ${max} characters.`);
  }
  return value;
}

function bool(value: unknown, name: string, v: Validator): boolean {
  if (typeof value !== "boolean") throw v.fail(`${name} must be a boolean.`);
  return value;
}

function lengthLimit(value: unknown, name: string, v: Validator): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 255) {
    throw v.fail(`${name} must be an integer between 1 and 255.`);
  }
  return value;
}

function validateCustomFields(value: unknown, v: Validator): CheckoutCustomField[] {
  if (!Array.isArray(value) || value.length > 3) throw v.fail("customFields must be an array of at most 3 fields.");
  const keys = new Set<string>();
  return value.map((raw: unknown, i): CheckoutCustomField => {
    const name = `customFields[${i}]`;
    if (!isPlainObject(raw)) throw v.fail(`${name} must be an object.`);
    const allowed = new Set(["key", "label", "type", "optional", "minLength", "maxLength", "options"]);
    for (const k of Object.keys(raw)) if (!allowed.has(k)) throw v.fail(`${name} has unsupported property "${k.slice(0, 40)}".`);
    if (typeof raw.key !== "string" || !CUSTOM_FIELD_KEY.test(raw.key)) throw v.fail(`${name}.key must be 1–200 letters or digits.`);
    if (keys.has(raw.key)) throw v.fail(`${name}.key "${raw.key}" is duplicated.`);
    keys.add(raw.key);
    const label = text(raw.label, 50, `${name}.label`, v);
    const optional = raw.optional === undefined ? undefined : bool(raw.optional, `${name}.optional`, v);
    const base = { key: raw.key, label, ...(optional !== undefined ? { optional } : {}) };

    if (raw.type === "dropdown") {
      if (!Array.isArray(raw.options) || raw.options.length === 0 || raw.options.length > 200) {
        throw v.fail(`${name}.options must list 1–200 choices.`);
      }
      const options = raw.options.map((o: unknown, j) => {
        if (!isPlainObject(o) || typeof o.value !== "string" || !DROPDOWN_VALUE.test(o.value)) {
          throw v.fail(`${name}.options[${j}].value must be 1–100 letters or digits.`);
        }
        return { label: text(o.label, 100, `${name}.options[${j}].label`, v), value: o.value };
      });
      if (raw.minLength !== undefined || raw.maxLength !== undefined) throw v.fail(`${name}: length limits apply only to text/numeric fields.`);
      return { ...base, type: "dropdown", options };
    }
    if (raw.type === "text" || raw.type === "numeric") {
      if (raw.options !== undefined) throw v.fail(`${name}.options is only valid for dropdown fields.`);
      const minLength = lengthLimit(raw.minLength, `${name}.minLength`, v);
      const maxLength = lengthLimit(raw.maxLength, `${name}.maxLength`, v);
      if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
        throw v.fail(`${name}.minLength must not exceed maxLength.`);
      }
      return {
        ...base,
        type: raw.type,
        ...(minLength !== undefined ? { minLength } : {}),
        ...(maxLength !== undefined ? { maxLength } : {}),
      };
    }
    throw v.fail(`${name}.type must be "text", "numeric" or "dropdown".`);
  });
}

/** Mutable working copy used while validating. */
type Draft = { -readonly [K in keyof CheckoutOptions]?: CheckoutOptions[K] };

/**
 * Validates options for one level. Returns a frozen, normalised copy.
 * At the client level, `successPath`/`cancelPath`/`quantity` are skipped (validated elsewhere).
 */
export function validateCheckoutOptions(input: unknown, level: OptionsLevel, label: string): Readonly<CheckoutOptions> {
  const v = validatorFor(level, label);
  if (input === undefined) return Object.freeze({});
  if (!isPlainObject(input)) throw v.fail("must be an object.");

  const out: Draft = {};
  for (const key of Object.keys(input)) {
    if (level === "client" && CLIENT_EXTRA_KEYS.has(key)) continue;
    if (!(ALL_KEYS as readonly string[]).includes(key)) throw v.fail(`unsupported option "${key.slice(0, 40)}".`);
    if (level === "request" && POLICY_ONLY_KEYS.has(key)) {
      throw v.fail(`"${key}" is business policy and can only be set client-wide or per product.`);
    }
    const value = input[key];
    if (value === undefined) continue;

    switch (key) {
      case "mode":
        if (value !== "payment") throw v.fail('mode must be "payment" (one-time payments).');
        out.mode = "payment";
        break;
      case "allowPromotionCodes":
      case "collectBillingAddress":
      case "collectPhoneNumber":
      case "automaticTax":
      case "createInvoice":
        out[key] = bool(value, key, v);
        break;
      case "collectShippingAddress": {
        if (value === false) {
          out.collectShippingAddress = false;
          break;
        }
        if (!isPlainObject(value) || !Array.isArray(value.allowedCountries)) {
          throw v.fail("collectShippingAddress must be false or { allowedCountries: [...] }.");
        }
        const countries = value.allowedCountries;
        if (countries.length === 0 || countries.length > 250 || !countries.every((c) => typeof c === "string" && COUNTRY_PATTERN.test(c))) {
          throw v.fail("collectShippingAddress.allowedCountries must list 1–250 ISO country codes (e.g. \"US\").");
        }
        // Format-checked here; Stripe validates the exact country list.
        out.collectShippingAddress = { allowedCountries: [...new Set(countries as ShippingCountry[])] };
        break;
      }
      case "submitType":
        if (typeof value !== "string" || !SUBMIT_TYPES.has(value)) throw v.fail('submitType must be "auto", "pay", "book" or "donate".');
        out.submitType = value as CheckoutOptions["submitType"];
        break;
      case "locale":
        if (typeof value !== "string" || !LOCALE_PATTERN.test(value)) throw v.fail('locale must be "auto" or a Stripe locale such as "en" or "fr-CA".');
        out.locale = value as CheckoutOptions["locale"];
        break;
      case "customerCreation":
        if (value !== "always" && value !== "if_required") throw v.fail('customerCreation must be "always" or "if_required".');
        out.customerCreation = value;
        break;
      case "consentCollection": {
        if (!isPlainObject(value)) throw v.fail("consentCollection must be an object.");
        const consent: { termsOfService?: boolean; promotions?: boolean } = {};
        for (const k of Object.keys(value)) {
          if (k !== "termsOfService" && k !== "promotions") throw v.fail(`consentCollection has unsupported property "${k.slice(0, 40)}".`);
          if (value[k] !== undefined) consent[k] = bool(value[k], `consentCollection.${k}`, v);
        }
        out.consentCollection = consent;
        break;
      }
      case "customText": {
        if (!isPlainObject(value)) throw v.fail("customText must be an object.");
        const custom: { submit?: string; afterSubmit?: string; shippingAddress?: string; termsOfServiceAcceptance?: string } = {};
        for (const k of Object.keys(value)) {
          if (k !== "submit" && k !== "afterSubmit" && k !== "shippingAddress" && k !== "termsOfServiceAcceptance") {
            throw v.fail(`customText has unsupported property "${k.slice(0, 40)}".`);
          }
          if (value[k] !== undefined) custom[k] = text(value[k], 1200, `customText.${k}`, v);
        }
        out.customText = custom;
        break;
      }
      case "customFields":
        out.customFields = validateCustomFields(value, v);
        break;
      case "expiresInMinutes":
        if (typeof value !== "number" || !Number.isInteger(value) || value < 30 || value > 1440) {
          throw v.fail("expiresInMinutes must be an integer between 30 and 1440.");
        }
        out.expiresInMinutes = value;
        break;
    }
  }
  return Object.freeze(out);
}

/** client → product → request, option by option (nested text/consent objects merge per key). */
export function mergeCheckoutOptions(...levels: readonly Readonly<CheckoutOptions>[]): Readonly<CheckoutOptions> {
  const merged: Draft = {};
  for (const level of levels) {
    for (const key of ALL_KEYS) {
      const value = level[key];
      if (value === undefined) continue;
      if (key === "customText" || key === "consentCollection") {
        merged[key] = { ...(merged[key] as object | undefined), ...(value as object) } as never;
      } else {
        merged[key] = value as never;
      }
    }
  }
  return merged;
}

/** Explicit mapping to Stripe parameters. Only the fields listed here can ever reach Stripe. */
export function toStripeSessionParams(
  options: Readonly<CheckoutOptions>,
  now: number = Date.now(),
): Partial<Stripe.Checkout.SessionCreateParams> {
  const params: Partial<Stripe.Checkout.SessionCreateParams> = {
    submit_type: options.submitType ?? "pay",
  };
  if (options.allowPromotionCodes !== undefined) params.allow_promotion_codes = options.allowPromotionCodes;
  if (options.collectBillingAddress !== undefined) {
    params.billing_address_collection = options.collectBillingAddress ? "required" : "auto";
  }
  if (options.collectShippingAddress) {
    params.shipping_address_collection = { allowed_countries: [...options.collectShippingAddress.allowedCountries] };
  }
  if (options.collectPhoneNumber !== undefined) params.phone_number_collection = { enabled: options.collectPhoneNumber };
  if (options.automaticTax !== undefined) params.automatic_tax = { enabled: options.automaticTax };
  if (options.locale !== undefined) params.locale = options.locale;
  if (options.createInvoice !== undefined) params.invoice_creation = { enabled: options.createInvoice };
  if (options.customerCreation !== undefined) params.customer_creation = options.customerCreation;
  if (options.consentCollection) {
    const consent: Stripe.Checkout.SessionCreateParams.ConsentCollection = {};
    // `false` is Stripe's default, so it's omitted: sending an explicit "none"
    // fails on accounts where the feature is unavailable (e.g. by country).
    if (options.consentCollection.termsOfService) consent.terms_of_service = "required";
    if (options.consentCollection.promotions) consent.promotions = "auto";
    if (Object.keys(consent).length > 0) params.consent_collection = consent;
  }
  if (options.customText) {
    const t = options.customText;
    const custom: Stripe.Checkout.SessionCreateParams.CustomText = {};
    if (t.submit) custom.submit = { message: t.submit };
    if (t.afterSubmit) custom.after_submit = { message: t.afterSubmit };
    if (t.shippingAddress) custom.shipping_address = { message: t.shippingAddress };
    if (t.termsOfServiceAcceptance) custom.terms_of_service_acceptance = { message: t.termsOfServiceAcceptance };
    if (Object.keys(custom).length > 0) params.custom_text = custom;
  }
  if (options.customFields && options.customFields.length > 0) {
    params.custom_fields = options.customFields.map((field): Stripe.Checkout.SessionCreateParams.CustomField => {
      const base = {
        key: field.key,
        label: { type: "custom" as const, custom: field.label },
        ...(field.optional !== undefined ? { optional: field.optional } : {}),
      };
      if (field.type === "dropdown") {
        return { ...base, type: "dropdown", dropdown: { options: field.options.map((o) => ({ label: o.label, value: o.value })) } };
      }
      const limits = {
        ...(field.minLength !== undefined ? { minimum_length: field.minLength } : {}),
        ...(field.maxLength !== undefined ? { maximum_length: field.maxLength } : {}),
      };
      return field.type === "text" ? { ...base, type: "text", text: limits } : { ...base, type: "numeric", numeric: limits };
    });
  }
  if (options.expiresInMinutes !== undefined) {
    params.expires_at = Math.floor(now / 1000) + options.expiresInMinutes * 60;
  }
  return params;
}
