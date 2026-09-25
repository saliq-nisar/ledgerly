import { isPaymentError, type PaymentError } from "../errors/errors.js";
import { redactFields, type LogFields, type LogValue } from "../security/redact.js";
import type {
  CheckoutCreatedInfo,
  LogLevel,
  OperationInfo,
  PaymentEnvironment,
  PaymentHooks,
  PaymentLogger,
  PaymentOperation,
  WebhookInfo,
  WebhookReceivedInfo,
} from "../types/public.js";

/** JSON-lines console logger used by default in the "test" environment. */
export const consoleLogger: PaymentLogger = {
  debug: (message, fields) => console.debug(JSON.stringify({ level: "debug", message, ...fields })),
  info: (message, fields) => console.info(JSON.stringify({ level: "info", message, ...fields })),
  warn: (message, fields) => console.warn(JSON.stringify({ level: "warn", message, ...fields })),
  error: (message, fields) => console.error(JSON.stringify({ level: "error", message, ...fields })),
};

type Level = Exclude<LogLevel, "silent">;
const LEVEL_RANK: Readonly<Record<LogLevel, number>> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export interface ObserverOptions {
  logger: PaymentLogger | false | undefined;
  level: LogLevel;
  environment: PaymentEnvironment;
  hooks: readonly PaymentHooks[];
}

/**
 * Wraps the configured logger and monitoring hooks. Every field passes
 * through `redactFields` (custom loggers are never trusted), and failures
 * inside loggers/hooks are contained so they can't break a payment.
 */
export class Observer {
  private readonly logger: PaymentLogger | null;
  private readonly minRank: number;
  private readonly hooks: readonly PaymentHooks[];

  constructor(options: ObserverOptions) {
    this.logger =
      options.logger === false ? null : (options.logger ?? (options.environment === "test" ? consoleLogger : null));
    this.minRank = LEVEL_RANK[options.level];
    this.hooks = options.hooks;
  }

  log(level: Level, message: string, fields: Record<string, LogValue>): void {
    if (!this.logger || LEVEL_RANK[level] < this.minRank) return;
    const safe: LogFields = { library: "payments", timestamp: new Date().toISOString(), ...redactFields(fields) };
    try {
      if (level === "debug") this.logger.debug?.(message, safe);
      else this.logger[level](message, safe);
    } catch {
      // Logging must never affect payment processing.
    }
  }

  /** Fire-and-forget: hooks never block or fail the operation. */
  private emit(run: (hooks: PaymentHooks) => void | Promise<void>): void {
    for (const hooks of this.hooks) {
      try {
        void Promise.resolve(run(hooks)).catch(() => this.log("warn", "Monitoring hook rejected", {}));
      } catch {
        this.log("warn", "Monitoring hook threw", {});
      }
    }
  }

  checkoutCreated(info: CheckoutCreatedInfo): void {
    this.log("info", "Checkout session created", { ...info });
    this.emit((h) => h.onCheckoutCreated?.(info));
  }

  webhookReceived(info: WebhookReceivedInfo): void {
    this.emit((h) => h.onWebhookReceived?.(info));
  }

  webhook(info: WebhookInfo): void {
    this.log("info", "Webhook processed", { ...info });
    this.emit((h) => {
      h.onWebhookProcessed?.(info);
      return h.onWebhook?.(info);
    });
  }

  /** Reports an error that was handled internally (e.g. a failing afterCheckout callback). */
  handledError(error: PaymentError, info: OperationInfo): void {
    this.emit((h) => h.onError?.(error, info));
  }

  /** Times an operation and reports it to logs and hooks. */
  async instrument<T>(
    operation: PaymentOperation,
    requestId: string,
    run: () => Promise<{ value: T; stripeRequestId?: string | undefined }>,
  ): Promise<T> {
    const started = performance.now();
    try {
      const { value, stripeRequestId } = await run();
      const info: OperationInfo = {
        operation,
        requestId,
        durationMs: Math.round(performance.now() - started),
        outcome: "success",
        ...(stripeRequestId ? { stripeRequestId } : {}),
      };
      this.log("debug", "Payment operation succeeded", { ...info });
      this.emit((h) => h.onRequest?.(info));
      return value;
    } catch (thrown) {
      const error: PaymentError | null = isPaymentError(thrown) ? thrown.withRequestId(requestId) : null;
      const info: OperationInfo = {
        operation,
        requestId,
        durationMs: Math.round(performance.now() - started),
        outcome: "error",
        ...(error?.stripeRequestId ? { stripeRequestId: error.stripeRequestId } : {}),
        errorCode: error?.code ?? "internal_error",
      };
      const expected = error && error.statusCode < 500;
      this.log(expected ? "info" : "error", "Payment operation failed", {
        ...info,
        errorName: error?.name ?? (thrown instanceof Error ? thrown.name : typeof thrown),
        statusCode: error?.statusCode,
        causeType: error?.cause?.type,
        causeCode: error?.cause?.code,
        causeParam: error?.cause?.param,
      });
      this.emit((h) => h.onRequest?.(info));
      if (error) this.emit((h) => h.onError?.(error, info));
      throw thrown;
    }
  }
}
