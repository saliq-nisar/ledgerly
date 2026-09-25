import { PaymentConfigurationError, PaymentValidationError } from "../errors/errors.js";
import { normalizeCurrency, validateUnitPrice } from "../money/money.js";
import { validateCheckoutOptions } from "../checkout/options.js";
import type { CheckoutOptions, Product, ProductCatalog, ProductId } from "../types/public.js";
import { DEFAULT_METADATA_POLICY, validateMetadata, type ResolvedMetadataPolicy } from "../validation/validation.js";

const PRODUCT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const PRICE_ID_PATTERN = /^price_[A-Za-z0-9]{8,64}$/;
const TAX_CODE_PATTERN = /^txcd_\d{8}$/;

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
const HARD_MAX_QUANTITY = 999;

export interface QuantityDefaults {
  min: number;
  max: number;
}

function validateLimit(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > HARD_MAX_QUANTITY) {
    throw new PaymentConfigurationError(`${label} must be an integer between 1 and ${HARD_MAX_QUANTITY}.`);
  }
  return value;
}

export function resolveQuantityDefaults(input: { min?: number; max?: number } | undefined): QuantityDefaults {
  const min = validateLimit(input?.min ?? 1, "checkout.quantity.min");
  const max = validateLimit(input?.max ?? 10, "checkout.quantity.max");
  if (min > max) throw new PaymentConfigurationError("checkout.quantity.min must not exceed checkout.quantity.max.");
  return { min, max };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export interface ProductsApi<P extends ProductCatalog> {
  /** Returns the product for a known ID. */
  get(id: ProductId<P>): Product<ProductId<P>>;
  /** Returns undefined for unknown or untrusted IDs (safe with any input). */
  get(id: unknown): Product<ProductId<P>> | undefined;
  /** Type guard for untrusted input. */
  has(id: unknown): id is ProductId<P>;
  /** All products, or only purchasable ones with `{ activeOnly: true }`. */
  list(options?: { activeOnly?: boolean }): Product<ProductId<P>>[];
}

/**
 * Validates and freezes the catalog. Lookups use a Map, so IDs such as
 * "__proto__" or "toString" can never resolve to inherited properties.
 */
export class ProductRegistry<P extends ProductCatalog> implements ProductsApi<P> {
  private readonly byId: ReadonlyMap<string, Product<ProductId<P>>>;

  private readonly optionsById: ReadonlyMap<string, Readonly<CheckoutOptions>>;

  constructor(catalog: P, quantity: QuantityDefaults, metadataPolicy: ResolvedMetadataPolicy = DEFAULT_METADATA_POLICY) {
    if (!isPlainObject(catalog)) throw new PaymentConfigurationError("products must be a plain object keyed by product ID.");
    const entries = Object.keys(catalog);
    if (entries.length === 0) throw new PaymentConfigurationError("products must define at least one product.");

    const map = new Map<string, Product<ProductId<P>>>();
    const options = new Map<string, Readonly<CheckoutOptions>>();
    for (const id of entries) {
      const label = `products["${id.slice(0, 64)}"]`;
      if (!PRODUCT_ID_PATTERN.test(id)) {
        throw new PaymentConfigurationError(
          `${label}: product IDs must be 1–64 characters of letters, digits, "-" or "_", starting with a letter or digit.`,
        );
      }
      const definition: unknown = catalog[id];
      if (!isPlainObject(definition)) throw new PaymentConfigurationError(`${label} must be an object.`);

      const name = definition.name;
      if (typeof name !== "string" || name.trim().length === 0 || name.length > 250) {
        throw new PaymentConfigurationError(`${label}.name must be a non-empty string (max 250 characters).`);
      }
      const description = definition.description;
      if (description !== undefined && (typeof description !== "string" || description.length > 1000)) {
        throw new PaymentConfigurationError(`${label}.description must be a string (max 1000 characters).`);
      }
      const currency = normalizeCurrency(definition.currency, label);
      const price = validateUnitPrice(definition.price, currency, label);
      const minQuantity =
        definition.minQuantity === undefined ? quantity.min : validateLimit(definition.minQuantity, `${label}.minQuantity`);
      const maxQuantity =
        definition.maxQuantity === undefined ? quantity.max : validateLimit(definition.maxQuantity, `${label}.maxQuantity`);
      if (minQuantity > maxQuantity) {
        throw new PaymentConfigurationError(`${label}.minQuantity must not exceed maxQuantity.`);
      }

      const fail = (message: string) => new PaymentConfigurationError(`${label}: ${message}`);

      const active = definition.active === undefined ? true : definition.active;
      if (typeof active !== "boolean") throw fail("active must be a boolean.");

      const images = definition.images ?? [];
      if (!Array.isArray(images) || images.length > 8) throw fail("images must be an array of at most 8 URLs.");
      for (const image of images) {
        if (typeof image !== "string" || image.length > 2048 || !isHttpsUrl(image)) throw fail("images must be https URLs (max 2048 characters).");
      }

      const taxBehavior = definition.taxBehavior;
      if (taxBehavior !== undefined && taxBehavior !== "inclusive" && taxBehavior !== "exclusive" && taxBehavior !== "unspecified") {
        throw fail('taxBehavior must be "inclusive", "exclusive" or "unspecified".');
      }
      const taxCode = definition.taxCode;
      if (taxCode !== undefined && (typeof taxCode !== "string" || !TAX_CODE_PATTERN.test(taxCode))) {
        throw fail('taxCode must be a Stripe tax code such as "txcd_10103001".');
      }

      const stripePriceId = definition.stripePriceId;
      if (stripePriceId !== undefined) {
        if (typeof stripePriceId !== "string" || !PRICE_ID_PATTERN.test(stripePriceId)) throw fail("stripePriceId must be a Stripe Price ID (price_…).");
        if (images.length > 0 || taxCode !== undefined || taxBehavior !== undefined || description !== undefined) {
          throw fail("images, description, taxCode and taxBehavior belong to the Stripe Price/Product when stripePriceId is used; remove them here.");
        }
      }

      const metadata = Object.freeze(
        validateMetadata(definition.metadata, metadataPolicy, { enforceAllowedKeys: false, fail: (m) => fail(m) }),
      );
      options.set(id, validateCheckoutOptions(definition.checkout, "product", `${label}.checkout`));

      map.set(
        id,
        Object.freeze({
          id: id as ProductId<P>,
          name: name.trim(),
          description: typeof description === "string" ? description.trim() || undefined : undefined,
          price,
          currency,
          minQuantity,
          maxQuantity,
          active,
          images: Object.freeze([...(images as string[])]),
          taxBehavior,
          taxCode,
          stripePriceId,
          metadata,
        }),
      );
    }
    this.optionsById = options;
    this.byId = map;
  }

  /** Type guard for untrusted input. */
  has(id: unknown): id is ProductId<P> {
    return typeof id === "string" && this.byId.has(id);
  }

  get(id: ProductId<P>): Product<ProductId<P>>;
  get(id: unknown): Product<ProductId<P>> | undefined;
  get(id: unknown): Product<ProductId<P>> | undefined {
    return typeof id === "string" ? this.byId.get(id) : undefined;
  }

  list(options?: { activeOnly?: boolean }): Product<ProductId<P>>[] {
    const all = [...this.byId.values()];
    return options?.activeOnly ? all.filter((p) => p.active) : all;
  }

  /** @internal Product-level checkout options. */
  checkoutOptions(id: string): Readonly<CheckoutOptions> {
    return this.optionsById.get(id) ?? {};
  }

  /** @internal Like `get`, but throws for unknown or inactive products. */
  require(id: unknown): Product<ProductId<P>> {
    const product = this.get(id);
    if (product && !product.active) {
      throw new PaymentValidationError({
        code: "product_unavailable",
        message: "This product is not currently available.",
        field: "productId",
      });
    }
    if (!product) {
      throw new PaymentValidationError({
        code: "invalid_product",
        message: "Unknown product.",
        field: "productId",
      });
    }
    return product;
  }
}
