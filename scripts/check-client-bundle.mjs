// Scans the browser bundles produced by `next build` for anything that must
// stay server-side: Stripe secret/webhook keys, their env var names, the
// Stripe Node SDK, and the payment library. Exits non-zero on any finding.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), ".next", "static");
const envValues = [process.env.STRIPE_SECRET_KEY, process.env.STRIPE_WEBHOOK_SECRET].filter(
  (v) => typeof v === "string" && v.length >= 12,
);

const checks = [
  { name: "Stripe secret key", pattern: /\b(sk|rk)_(test|live)_[0-9A-Za-z]{8,}/ },
  { name: "webhook signing secret", pattern: /\bwhsec_[0-9A-Za-z]{8,}/ },
  { name: "STRIPE_SECRET_KEY reference", pattern: /STRIPE_SECRET_KEY/ },
  { name: "STRIPE_WEBHOOK_SECRET reference", pattern: /STRIPE_WEBHOOK_SECRET/ },
  { name: "Stripe Node SDK", pattern: /api\.stripe\.com|stripe-node/ },
  // The docs site legitimately *mentions* "@ledgerly/payments" and "createPaymentClient"
  // in client-rendered text, so detect the library's runtime code instead: strings that
  // only exist inside its implementation.
  { name: "payment library code", pattern: /Stripe configuration error: |Checkout rejected by application|is server-only and cannot be imported in browser code/ },
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.(js|css|html|json|txt|map)$/.test(entry)) yield path;
  }
}

let files = 0;
const findings = [];
try {
  for (const file of walk(root)) {
    files++;
    const text = readFileSync(file, "utf8");
    for (const { name, pattern } of checks) if (pattern.test(text)) findings.push(`${name} in ${file}`);
    for (const value of envValues) if (text.includes(value)) findings.push(`configured secret value in ${file}`);
  }
} catch (error) {
  console.error(`Could not scan ${root}. Run \`npm run build\` first.`, error.message);
  process.exit(2);
}

if (findings.length > 0) {
  console.error(`✖ Client bundle check failed:\n  ${findings.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ Scanned ${files} client files: no secrets, secret env names, Stripe SDK or payment library found.`);
