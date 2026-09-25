import "server-only";

import type { RateLimitResult } from "@ledgerly/payments/web";

/**
 * DEMO-ONLY rate limiter: a fixed window per client IP, kept in process
 * memory. It resets on restart, isn't shared between instances, and trusts
 * the X-Forwarded-For header, so it is NOT suitable for production. Use your
 * hosting platform's rate limiting, an API gateway, or a shared store instead.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const MAX_TRACKED_CLIENTS = 5_000;

const windows = new Map<string, { start: number; count: number }>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function demoRateLimit(request: Request): RateLimitResult {
  const now = Date.now();
  const key = clientKey(request);
  const current = windows.get(key);

  if (!current || now - current.start >= WINDOW_MS) {
    if (windows.size >= MAX_TRACKED_CLIENTS) windows.clear();
    windows.set(key, { start: now, count: 1 });
    return { allowed: true };
  }

  current.count += 1;
  if (current.count > MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: Math.ceil((current.start + WINDOW_MS - now) / 1000) };
  }
  return { allowed: true };
}
