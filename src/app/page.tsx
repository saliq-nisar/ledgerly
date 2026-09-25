import { DocsNav } from "@/components/docs/DocsNav";
import { ApiConceptsSection } from "@/components/docs/sections/ApiConcepts";
import { CustomizationSection } from "@/components/docs/sections/Customization";
import { ErrorsSection } from "@/components/docs/sections/ErrorsSection";
import { FrameworksSection } from "@/components/docs/sections/Frameworks";
import { HeroDocs } from "@/components/docs/sections/HeroDocs";
import { ProductsSection } from "@/components/docs/sections/ProductsSection";
import { InstallSection, QuickStartSection } from "@/components/docs/sections/QuickStart";
import { SecurityDocsSection } from "@/components/docs/sections/SecurityDocs";
import { PaymentFlowSimulation } from "@/components/docs/sections/Simulations";
import { TestPaymentSection } from "@/components/docs/sections/TestPayment";
import { UnderTheHood } from "@/components/docs/sections/UnderTheHood";
import { WebhooksDocsSection } from "@/components/docs/sections/WebhooksDocs";
import { WhatIs } from "@/components/docs/sections/WhatIs";
import { WhatYouGet } from "@/components/docs/sections/WhatYouGet";
import { FAQ } from "@/components/sections/FAQ";
import { getStripeTestStatus } from "@/lib/payments";

/**
 * Interactive documentation for @ledgerly/payments. Works with no environment
 * variables; the real Stripe test is feature-detected and optional.
 * A Server Component: only animated/interactive islands are Client Components.
 */
export default function HomePage() {
  // Only booleans and a secret-free reason cross to the client.
  const status = getStripeTestStatus();

  return (
    <>
      <DocsNav />
      <HeroDocs />
      <WhatIs />
      <WhatYouGet />
      <InstallSection />
      <QuickStartSection />
      <PaymentFlowSimulation />
      <UnderTheHood />
      <ProductsSection />
      <CustomizationSection />
      <SecurityDocsSection liveEnabled={status.checkout} />
      <WebhooksDocsSection />
      <ErrorsSection />
      <FrameworksSection />
      <TestPaymentSection status={status} />
      <ApiConceptsSection />
      <FAQ />
    </>
  );
}
