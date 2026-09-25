import { Chip, DocSection, Panel } from "@/components/docs/DocSection";
import { FlowDiagram } from "@/components/docs/FlowDiagram";
import { TamperDemo } from "@/components/docs/TamperDemo";
import { Check, Lock, Smartphone, Server } from "@/components/ui/icons";

const BROWSER = ["productId", "quantity"];
const SERVER = [
  "price",
  "currency",
  "Stripe secret key",
  "metadata policy",
  "checkout policy",
  "redirect URLs",
  "callbacks",
  "webhook verification",
];

export function SecurityDocsSection({ liveEnabled }: { liveEnabled: boolean }) {
  return (
    <DocSection
      id="security"
      eyebrow="Security"
      title="Your browser should never control the price"
      description="Every value either comes from the browser (two fields) or from your server. The library enforces this boundary at runtime, not just in the types."
      tinted
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <Smartphone className="size-5 text-slate-500" /> Browser may send
          </p>
          <ul className="mt-4 space-y-2">
            {BROWSER.map((item) => (
              <li key={item} className="flex items-center gap-2 font-mono text-sm text-slate-800 dark:text-slate-200">
                <Check className="size-4 text-emerald-600 dark:text-emerald-400" /> {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Anything else in the body is rejected with <Chip tone="rose">unexpected_field</Chip>.
          </p>
        </Panel>
        <Panel className="border-indigo-300 dark:border-indigo-500/40">
          <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <Server className="size-5 text-indigo-600 dark:text-indigo-400" /> Server decides
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {SERVER.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                <Lock className="size-4 shrink-0 text-indigo-600 dark:text-indigo-400" /> {item}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <h3 className="mt-16 text-xl font-semibold text-slate-900 dark:text-white">Security demonstration: valid vs. tampered request</h3>
      <div className="mt-6">
        <TamperDemo liveEnabled={liveEnabled} />
      </div>

      <h3 className="mt-16 text-xl font-semibold text-slate-900 dark:text-white">Price protection</h3>
      <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
        The browser never becomes the source of truth for price or currency. Even if it could pick a price, there is no
        field for it: the charge is always <em>catalog price × validated quantity</em>.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Attacker tries $0.01">
          <FlowDiagram
            summary="A request that tries to set the amount is blocked."
            compact
            steps={[
              { title: "Browser", tag: "amount: 0.01", icon: "browser", tone: "customer" },
              { title: "Validation", tag: "unexpected_field", icon: "shield", tone: "lib" },
              { title: "Blocked: 400", detail: "No session is created", icon: "blocked", tone: "danger" },
            ]}
            connectors={[{ label: "POST" }, { label: "rejected", kind: "blocked" }]}
          />
        </Panel>
        <Panel title="What actually gets charged">
          <FlowDiagram
            summary="The catalog price is what Stripe charges."
            compact
            steps={[
              { title: "Catalog price", tag: "pro · 1999 usd", icon: "db", tone: "lib" },
              { title: "Stripe Checkout", tag: "unit_amount: 1999", icon: "stripe", tone: "stripe" },
              { title: "$19.99 charged", icon: "check", tone: "success" },
            ]}
            connectors={[{ label: "server-side" }, { label: "customer pays" }]}
          />
        </Panel>
      </div>

    </DocSection>
  );
}
