import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocSection } from "@/components/docs/DocSection";
import { Tabs } from "@/components/docs/Tabs";

// Same imports as packages/payments/examples/03-frameworks.ts (after the published-path rewrite).
const FRAMEWORK_IMPORTS = `import { createCheckoutHandler, createWebhookHandler } from "@ledgerly/payments/web";
import { payments } from "./payments";`;

export function FrameworksSection() {
  return (
    <DocSection
      id="frameworks"
      eyebrow="Frameworks"
      title="Use the same payment library with your backend"
      description={
        <>
          <code className="font-mono text-base">@ledgerly/payments/web</code> handlers take a standard{" "}
          <code className="font-mono text-base">Request</code> and return a <code className="font-mono text-base">Response</code>.
          They work in Next.js, Hono, Remix, SvelteKit, Astro, Bun and Deno. With Express, call{" "}
          <code className="font-mono text-base">payments.webhooks.handle()</code> directly.
        </>
      }
      tinted
    >
      <Tabs
        label="Framework"
        tabs={[
          {
            id: "nextjs",
            label: "Next.js",
            panel: (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <CodeBlock snippet="nextjs/payments#lib" filename="lib/payments.ts" animate={false} className="lg:row-span-2" />
                <CodeBlock snippet="nextjs/checkout-route#route" filename="app/api/checkout/route.ts" animate={false} />
                <CodeBlock snippet="nextjs/webhook-route#route" filename="app/api/webhook/route.ts" animate={false} />
              </div>
            ),
          },
          {
            id: "hono",
            label: "Hono",
            panel: <CodeBlock snippet="03-frameworks#hono" prefix={FRAMEWORK_IMPORTS} filename="src/index.ts" animate={false} />,
          },
          {
            id: "express",
            label: "Express",
            panel: <CodeBlock snippet="03-frameworks#express" prefix={'import { payments } from "./payments";'} filename="webhook.ts" animate={false} />,
          },
        ]}
      />
      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        This demo site is itself a Next.js integration: its routes in <code className="font-mono">src/app/api/stripe/</code> delegate to the
        same handlers.
      </p>
    </DocSection>
  );
}
