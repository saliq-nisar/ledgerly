/**
 * @ledgerly/payments/web — ready-made HTTP handlers built on the standard
 * Fetch API `Request`/`Response`. Works as-is in Next.js route handlers,
 * Remix/React Router, Hono, SvelteKit, Astro, Bun, Deno and Node 18+ servers.
 */

import type { PaymentClient } from "../client/create-client.js";
import { PaymentError, PaymentValidationError, type PaymentErrorCode } from "../errors/errors.js";
import type { CheckoutCreateInput, CheckoutRequest, ProductCatalog, ProductId, PublicErrorInfo } from "../types/public.js";
import { resolveRequestId } from "../validation/validation.js";

export interface RateLimitResult {
  allowed: boolean;
  /** Sent as the Retry-After header when the request is rejected. */
  retryAfterSeconds?: number;
}

/** Server-derived fields `enrich` may add. The browser can never set these. */
export type CheckoutEnrichment<P extends ProductCatalog, M extends string = string> = Pick<
  CheckoutCreateInput<ProductId<P>, M>,
  "metadata" | "customerEmail" | "customer" | "clientReferenceId" | "options" | "redirect"
>;

export interface CheckoutHandlerOptions<P extends ProductCatalog, M extends string = string> {
  /** Maximum accepted body size. Default 1024 bytes (a checkout request is ~50 bytes). */
  maxBodyBytes?: number;
  /**
   * Your rate limiter (per IP, user, …). The library does not ship a
   * production rate limiter; use your platform/API gateway or a shared store.
   */
  rateLimit?: (request: Request) => RateLimitResult | Promise<RateLimitResult>;
  /**
   * Origins allowed to call this endpoint from a browser. Requests carrying a
   * different Origin header are rejected with 403. Default: the client's appUrl.
   * Pass [] to disable the check (e.g. for server-to-server callers only).
   */
  allowedOrigins?: readonly string[];
  /** Header carrying an optional client-generated idempotency key. Default "Idempotency-Key"; false disables. */
  idempotencyHeader?: string | false;
  /**
   * Adds trusted, server-derived fields (e.g. the signed-in user's ID as
   * clientReferenceId, their email, per-request checkout options). Never copy
   * values from the request body here. Throw (e.g. `rejectCheckout`) to refuse.
   */
  enrich?: (
    request: Request,
    input: CheckoutRequest<ProductId<P>>,
  ) => CheckoutEnrichment<P, M> | Promise<CheckoutEnrichment<P, M>>;
  /** Per-handler overrides of user-facing error messages (on top of the client's `errors.publicMessages`). */
  messages?: Partial<Readonly<Record<PaymentErrorCode, string>>>;
}

export interface WebhookHandlerOptions {
  /** Maximum accepted body size. Default 1 MiB. */
  maxBodyBytes?: number;
}

type Describe = (error: unknown) => PublicErrorInfo;

const BASE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

function json(body: unknown, status: number, requestId: string, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, "X-Request-Id": requestId, ...extra },
  });
}

function httpError(
  code: "method_not_allowed" | "unsupported_media_type" | "payload_too_large" | "invalid_request" | "forbidden_origin" | "rate_limited",
  message: string,
  statusCode: number,
): PaymentValidationError {
  return new PaymentValidationError({ code, message, statusCode });
}

/** Converts any error into a safe JSON response. Internal details are never included. */
function errorResponse(
  describe: Describe,
  error: unknown,
  requestId: string,
  messages: Partial<Readonly<Record<string, string>>> = {},
  extraHeaders: Record<string, string> = {},
): Response {
  const info = describe(error);
  return json(
    { error: { code: info.code, message: messages[info.code] ?? info.message, requestId } },
    info.statusCode,
    requestId,
    extraHeaders,
  );
}

/** Reads the body as raw bytes, enforcing a hard size limit while streaming. */
async function readBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    throw httpError("payload_too_large", "Request body is too large.", 413);
  }
  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw httpError("payload_too_large", "Request body is too large.", 413);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function requireMethod(request: Request, method: "POST"): void {
  if (request.method !== method) throw httpError("method_not_allowed", "Method not allowed.", 405);
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * POST handler that turns `{ productId, quantity? }` into a Stripe Checkout
 * Session and responds with `{ id, url }`.
 */
export function createCheckoutHandler<P extends ProductCatalog, M extends string = string>(
  payments: PaymentClient<P, M>,
  options: CheckoutHandlerOptions<P, M> = {},
): (request: Request) => Promise<Response> {
  const describe: Describe = (error) => payments.errors.describe(error);
  const messages = options.messages ?? {};
  const maxBodyBytes = options.maxBodyBytes ?? 1024;
  const idempotencyHeader = options.idempotencyHeader ?? "Idempotency-Key";
  const allowedOrigins = options.allowedOrigins?.map(normalizeOrigin).filter((o): o is string => o !== null);

  return async function checkoutHandler(request: Request): Promise<Response> {
    const requestId = resolveRequestId(request.headers.get("x-request-id"));
    try {
      requireMethod(request, "POST");

      const origin = request.headers.get("origin");
      if (origin !== null) {
        const allowed = allowedOrigins ?? (payments.appUrl ? [payments.appUrl] : []);
        if (allowed.length > 0 && !allowed.includes(origin)) {
          throw httpError("forbidden_origin", "Cross-origin requests are not allowed.", 403);
        }
      }

      if (options.rateLimit) {
        const verdict = await options.rateLimit(request);
        if (!verdict.allowed) {
          const retryAfter = Math.max(1, Math.ceil(verdict.retryAfterSeconds ?? 60));
          return errorResponse(describe, httpError("rate_limited", "Too many requests. Please wait a moment and try again.", 429), requestId, messages, {
            "Retry-After": String(retryAfter),
          });
        }
      }

      const contentType = request.headers.get("content-type") ?? "";
      if (!/^application\/json(\s*;|$)/i.test(contentType)) {
        throw httpError("unsupported_media_type", "Content-Type must be application/json.", 415);
      }

      const bytes = await readBody(request, maxBodyBytes);
      let body: unknown;
      try {
        body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      } catch {
        throw httpError("invalid_request", "Request body must be valid JSON.", 400);
      }

      const input = payments.checkout.parse(body);
      const idempotencyKey = idempotencyHeader ? (request.headers.get(idempotencyHeader) ?? undefined) : undefined;
      const extra: CheckoutEnrichment<P, M> = options.enrich ? await options.enrich(request, input) : {};

      // Only the named, server-derived fields are forwarded; checkout.create validates each one.
      const session = await payments.checkout.create({
        productId: input.productId,
        quantity: input.quantity,
        requestId,
        ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
        ...(extra.metadata !== undefined ? { metadata: extra.metadata } : {}),
        ...(extra.customerEmail !== undefined ? { customerEmail: extra.customerEmail } : {}),
        ...(extra.customer !== undefined ? { customer: extra.customer } : {}),
        ...(extra.clientReferenceId !== undefined ? { clientReferenceId: extra.clientReferenceId } : {}),
        ...(extra.options !== undefined ? { options: extra.options } : {}),
        ...(extra.redirect !== undefined ? { redirect: extra.redirect } : {}),
      });
      return json({ id: session.id, url: session.url }, 200, requestId);
    } catch (error) {
      return errorResponse(describe, error, requestId, messages, error instanceof PaymentError && error.code === "method_not_allowed" ? { Allow: "POST" } : {});
    }
  };
}

/**
 * POST handler for Stripe webhooks. Reads the raw body (required for signature
 * verification), then delegates to `payments.webhooks.handle`.
 *
 * Responses: 200 processed/ignored/duplicate · 400 bad signature or payload
 * (Stripe won't retry) · 500 handler failure or misconfiguration (Stripe retries).
 */
export function createWebhookHandler<P extends ProductCatalog, M extends string = string>(
  payments: PaymentClient<P, M>,
  options: WebhookHandlerOptions = {},
): (request: Request) => Promise<Response> {
  const describe: Describe = (error) => payments.errors.describe(error);
  const maxBodyBytes = options.maxBodyBytes ?? 1024 * 1024;

  return async function webhookHandler(request: Request): Promise<Response> {
    const requestId = resolveRequestId(request.headers.get("x-request-id"));
    try {
      requireMethod(request, "POST");
      const payload = await readBody(request, maxBodyBytes);
      const result = await payments.webhooks.handle(payload, request.headers.get("stripe-signature"), { requestId });
      return json({ received: true, outcome: result.outcome }, 200, requestId);
    } catch (error) {
      return errorResponse(describe, error, requestId, {}, error instanceof PaymentError && error.code === "method_not_allowed" ? { Allow: "POST" } : {});
    }
  };
}
