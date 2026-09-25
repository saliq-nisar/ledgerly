import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocSection } from "@/components/docs/DocSection";
import { ProductPlayground } from "@/components/docs/ProductPlayground";

export function ProductsSection() {
  return (
    <DocSection
      id="products"
      eyebrow="Products"
      title="Your catalog is the only source of prices"
      description="Define products once on the server. The browser picks a product and a quantity; the library resolves the price. The values below are an example catalog. No Stripe Products or Price IDs are required."
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-4">
          <CodeBlock snippet="01-minimal#setup" filename="lib/payments.ts (example catalog)" />
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Prices are integers in the smallest currency unit (1999 = $19.99). Currency codes, Stripe&apos;s minimum amounts and
            quantity limits are validated when the client is created. Products can also carry images, tax settings, metadata,
            per-product checkout options, an <code className="font-mono text-xs">active</code> flag, or a Dashboard-managed{" "}
            <code className="font-mono text-xs">stripePriceId</code>, which is verified against the catalog price before use.
          </p>
        </div>
        <ProductPlayground />
      </div>
    </DocSection>
  );
}
