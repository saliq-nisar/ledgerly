/**
 * Last line of defence for anything that is logged or handed to a hook:
 * sensitive field names are dropped and secret-looking values are masked.
 */

export type LogValue = string | number | boolean | null | undefined;
export type LogFields = Readonly<Record<string, LogValue>>;

const SENSITIVE_KEY = /secret|password|passwd|token|authorization|cookie|card|cvc|cvv|pan\b|api[_-]?key|signature/i;

const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  /\b(sk|rk)_(test|live)_[0-9A-Za-z]+/g,
  /\bwhsec_[0-9A-Za-z+/=_-]+/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  // 13–19 digit runs (optionally spaced/dashed) may be card numbers.
  /\b(?:\d[ -]?){12,18}\d\b/g,
];

const MAX_VALUE_LENGTH = 500;

export function redactString(value: string): string {
  let out = value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value;
  for (const pattern of SECRET_VALUE_PATTERNS) out = out.replace(pattern, "[REDACTED]");
  return out;
}

export function redactFields(fields: Record<string, LogValue>): Record<string, LogValue> {
  const out: Record<string, LogValue> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (SENSITIVE_KEY.test(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = typeof value === "string" ? redactString(value) : value;
  }
  return out;
}
