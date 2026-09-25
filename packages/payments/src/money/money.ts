import { PaymentConfigurationError, PaymentValidationError } from "../errors/errors.js";

/**
 * Money is always an integer number of minor units (cents). No floating-point
 * arithmetic is used anywhere in the library.
 */

/** Stripe's maximum charge amount (8 digits in minor units). */
export const MAX_AMOUNT = 99_999_999;

/**
 * Stripe minimum charge amounts for common currencies (minor units).
 * Unlisted currencies are only checked for being positive; Stripe enforces the rest.
 */
const MINIMUM_AMOUNTS: Readonly<Record<string, number>> = {
  usd: 50, eur: 50, gbp: 30, cad: 50, aud: 50, nzd: 50, chf: 50, jpy: 50,
  sgd: 50, hkd: 400, mxn: 1000, dkk: 250, nok: 300, sek: 300,
};

let knownCurrencies: ReadonlySet<string> | null = null;

function isKnownCurrency(code: string): boolean {
  if (!knownCurrencies) {
    try {
      knownCurrencies = new Set(Intl.supportedValuesOf("currency").map((c) => c.toLowerCase()));
    } catch {
      knownCurrencies = new Set();
    }
  }
  // If the runtime can't list currencies, fall back to the format check only.
  return knownCurrencies.size === 0 || knownCurrencies.has(code);
}

export function normalizeCurrency(value: unknown, label: string): string {
  if (typeof value !== "string") throw new PaymentConfigurationError(`${label} currency must be a string.`);
  const code = value.trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(code) || !isKnownCurrency(code)) {
    throw new PaymentConfigurationError(`${label} currency "${value.slice(0, 10)}" is not a valid ISO 4217 code.`);
  }
  return code;
}

export function validateUnitPrice(price: unknown, currency: string, label: string): number {
  if (typeof price !== "number" || !Number.isSafeInteger(price) || price <= 0) {
    throw new PaymentConfigurationError(
      `${label} price must be a positive integer in minor units (e.g. 2999 for 29.99), got ${typeof price === "number" ? price : typeof price}.`,
    );
  }
  if (price > MAX_AMOUNT) {
    throw new PaymentConfigurationError(`${label} price exceeds Stripe's maximum amount (${MAX_AMOUNT}).`);
  }
  const minimum = MINIMUM_AMOUNTS[currency];
  if (minimum !== undefined && price < minimum) {
    throw new PaymentConfigurationError(
      `${label} price ${price} is below Stripe's minimum charge for ${currency.toUpperCase()} (${minimum}).`,
    );
  }
  return price;
}

/** unitAmount × quantity with overflow and Stripe-limit checks. */
export function multiplyAmount(unitAmount: number, quantity: number): number {
  const total = unitAmount * quantity;
  if (!Number.isSafeInteger(total) || total > MAX_AMOUNT) {
    throw new PaymentValidationError({
      code: "amount_too_large",
      message: `Order total exceeds the maximum allowed amount (${MAX_AMOUNT} minor units).`,
      publicMessage: "This order is too large to process. Reduce the quantity and try again.",
      field: "quantity",
    });
  }
  return total;
}
