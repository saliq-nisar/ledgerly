import type { Product, ProductId } from "@/types/payment";

/**
 * Example catalog: demonstration values only.
 *
 * The same object documents the package on the website and, when Stripe test
 * keys are configured, is handed to @ledgerly/payments for the optional real
 * test (see src/lib/payments.ts). The library validates it and ignores the
 * UI-only fields (tagline, features, highlighted). The browser may import this
 * file to *display* prices, but the server never trusts a price from the
 * client: the checkout API accepts only a product ID and quantity.
 */
export const PRODUCT_CATALOG = {
  starter: {
    name: "Starter",
    tagline: "For side projects",
    description: "Everything you need to accept your first online payments.",
    price: 999,
    currency: "usd",
    highlighted: false,
    features: ["Hosted Stripe Checkout", "Card & wallet payments", "Email receipts"],
  },
  pro: {
    name: "Pro",
    tagline: "For growing teams",
    description: "Advanced payment tooling for products with real traction.",
    price: 1999,
    currency: "usd",
    highlighted: true,
    features: ["Everything in Starter", "Signed webhook events", "Payment analytics"],
  },
  business: {
    name: "Business",
    tagline: "For established companies",
    description: "Scale-ready payments with dedicated support and controls.",
    price: 4999,
    currency: "usd",
    highlighted: false,
    features: ["Everything in Pro", "Multiple team seats", "Custom fraud rules"],
  },
} as const satisfies Record<string, Omit<Product, "id">>;

export const PRODUCTS: readonly Product[] = (Object.keys(PRODUCT_CATALOG) as ProductId[]).map((id) => ({
  id,
  ...PRODUCT_CATALOG[id],
}));

export const DEFAULT_PRODUCT_ID: ProductId = "pro";

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10;

/**
 * Tax is intentionally not applied in this demo. In production, enable
 * Stripe Tax (`automaticTax`) rather than computing tax on the client.
 */
export const TAX_RATE = 0;

export function isProductId(value: unknown): value is ProductId {
  return typeof value === "string" && Object.hasOwn(PRODUCT_CATALOG, value);
}

export function getProduct(id: unknown): Product | undefined {
  return isProductId(id) ? PRODUCTS.find((p) => p.id === id) : undefined;
}
