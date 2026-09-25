import { TAX_RATE } from "@/config/products";
import type { OrderTotals, Product } from "@/types/payment";

/**
 * Display-only order totals for the checkout UI (client-safe, integer cents).
 * The amount actually charged is computed by the payment library on the
 * server from the product ID; nothing here is sent to the API.
 */
export function calculateTotals(product: Product, quantity: number): OrderTotals {
  const subtotal = product.price * quantity;
  const tax = Math.round(subtotal * TAX_RATE);
  return {
    unitPrice: product.price,
    quantity,
    subtotal,
    tax,
    total: subtotal + tax,
    currency: product.currency,
  };
}
