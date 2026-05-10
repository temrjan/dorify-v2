import { Injectable, Logger } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { config } from '@core/config/env.config';
import type {
  PaymentGatewayPort,
  PaymentGatewayCredentials,
  CreateInvoiceParams,
  CreateInvoiceResult,
  CallbackData,
  InvoiceStatusResult,
  GatewayInvoiceStatus,
} from '../../domain/ports/payment-gateway.port';
import type {
  AuthResponse,
  CreateInvoiceRequest,
  CreateInvoiceResponseData,
  InvoiceStatusResponseData,
  MulticardOfdItem,
  MulticardPaymentStatus,
  MulticardResponse,
} from './multicard.types';

const TOKEN_TTL_MS = 23 * 60 * 60 * 1000;
const TIYIN_PER_SUM = 100;

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 200;

interface CachedToken {
  token: string;
  expiresAt: number;
}

const STATUS_MAP: Record<MulticardPaymentStatus, GatewayInvoiceStatus> = {
  draft: 'PENDING',
  progress: 'PENDING',
  billing: 'PENDING',
  success: 'PAID',
  error: 'FAILED',
  revert: 'REFUNDED',
  hold: 'PENDING',
};

/**
 * Transient HTTP error from Multicard — retryable. Captures status code
 * для retry decision. Non-2xx с 5xx либо 408/429 = retryable; иначе non-retryable.
 */
class MulticardHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'MulticardHttpError';
  }

  isRetryable(): boolean {
    return this.status >= 500 || this.status === 408 || this.status === 429;
  }
}

/**
 * Network-level failure (DNS, connect refused, socket reset). Retryable.
 */
class MulticardNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MulticardNetworkError';
  }
}

@Injectable()
export class MulticardAdapter implements PaymentGatewayPort {
  private readonly logger = new Logger(MulticardAdapter.name);
  private readonly tokenCache = new Map<string, CachedToken>();

  /** Visible for tests. */
  protected get baseUrl(): string {
    return config.MULTICARD_API_URL.replace(/\/+$/, '');
  }

  async createInvoice(
    credentials: PaymentGatewayCredentials,
    params: CreateInvoiceParams,
  ): Promise<CreateInvoiceResult> {
    const token = await this.authenticate(credentials);
    const body: CreateInvoiceRequest = {
      store_id: credentials.storeId,
      amount: this.sumToTiyin(params.amount),
      invoice_id: params.invoiceId,
      callback_url: params.callbackUrl,
      lang: 'ru',
      ofd: params.items.map((item) => this.toOfdItem(item)),
      ...(params.returnUrl ? { return_url: params.returnUrl } : {}),
    };

    // Multicard uses `invoice_id` as natural idempotency key — re-posting
    // same invoice_id returns the existing invoice OR a clean error.
    // Our Payment.invoiceId @unique constraint also prevents local duplicates.
    // → safe to retry transient failures on createInvoice.
    const response = await this.fetchJson<MulticardResponse<CreateInvoiceResponseData>>(
      'POST',
      '/payment/invoice',
      token,
      body,
    );

    if (!response.success) {
      this.logger.error(
        `Multicard createInvoice failed: ${response.error.code} ${response.error.details}`,
      );
      throw new Error(`Multicard createInvoice: ${response.error.details}`);
    }

    return {
      invoiceId: response.data.uuid,
      checkoutUrl: response.data.checkout_url,
    };
  }

  async getInvoiceStatus(
    credentials: PaymentGatewayCredentials,
    invoiceUuid: string,
  ): Promise<InvoiceStatusResult> {
    const token = await this.authenticate(credentials);
    const response = await this.fetchJson<MulticardResponse<InvoiceStatusResponseData>>(
      'GET',
      `/payment/invoice/${encodeURIComponent(invoiceUuid)}`,
      token,
    );

    if (!response.success) {
      throw new Error(`Multicard getInvoiceStatus: ${response.error.details}`);
    }

    const multicardStatus = response.data.payment?.status ?? 'draft';
    return {
      invoiceId: response.data.uuid,
      status: STATUS_MAP[multicardStatus],
      amount: this.tiyinToSum(response.data.amount),
    };
  }

  /**
   * Verify success callback MD5 signature.
   *
   * Formula per docs/MULTICARD_API_DOCUMENTATION.md:281:
   *   sign = MD5(store_id + invoice_id + amount + secret)
   *
   * Constant-time comparison via crypto.timingSafeEqual to prevent
   * timing-attack on signature verification.
   */
  verifyCallbackSignature(secret: string, callback: CallbackData): boolean {
    const expected = createHash('md5')
      .update(`${callback.storeId}${callback.invoiceId}${callback.amount}${secret}`)
      .digest('hex');
    const provided = (callback.sign ?? '').toLowerCase();
    if (expected.length !== provided.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  }

  /**
   * Retry helper — exponential backoff с jitter. Retries on:
   * - MulticardHttpError 5xx / 408 / 429
   * - MulticardNetworkError (fetch threw — DNS, connect refused)
   *
   * Не retries:
   * - HTTP 4xx (auth bad, validation fail) — won't succeed on retry
   * - JSON parse errors (broken response — retry probably same)
   * - Business errors (response.success=false) — caller decides
   */
  private async withRetry<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const retryable =
          (err instanceof MulticardHttpError && err.isRetryable()) ||
          err instanceof MulticardNetworkError;
        if (!retryable || attempt === RETRY_MAX_ATTEMPTS) {
          throw err;
        }
        const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 100;
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Multicard ${operation} attempt ${attempt}/${RETRY_MAX_ATTEMPTS} failed (${reason}); retrying in ${Math.round(delayMs)}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw lastError;
  }

  private async authenticate(credentials: PaymentGatewayCredentials): Promise<string> {
    const cached = this.tokenCache.get(credentials.appId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const data = await this.withRetry('auth', async () => {
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            application_id: credentials.appId,
            secret: credentials.secret,
          }),
        });
      } catch (err) {
        throw new MulticardNetworkError(
          `auth network error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (!response.ok) {
        const text = await response.text();
        throw new MulticardHttpError(response.status, `auth HTTP ${response.status} ${text}`);
      }

      return (await response.json()) as AuthResponse;
    });

    if (!data.token) {
      throw new Error('Multicard auth response missing token');
    }

    this.tokenCache.set(credentials.appId, {
      token: data.token,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    });

    return data.token;
  }

  private async fetchJson<T>(
    method: 'GET' | 'POST',
    path: string,
    token: string,
    body?: unknown,
  ): Promise<T> {
    return this.withRetry(`${method} ${path}`, async () => {
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
      } catch (err) {
        throw new MulticardNetworkError(
          `${method} ${path} network error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const text = await response.text();

      if (!response.ok) {
        // 5xx / 408 / 429 — retryable; 4xx — not (will throw без retry).
        throw new MulticardHttpError(response.status, `${method} ${path} HTTP ${response.status} ${text}`);
      }

      try {
        return text ? (JSON.parse(text) as T) : ({} as T);
      } catch {
        // JSON parse failure — non-retryable (server returned malformed
        // response which won't fix on retry).
        throw new Error(`Multicard ${method} ${path}: non-JSON response (HTTP ${response.status})`);
      }
    });
  }

  private sumToTiyin(amountInSum: number): number {
    return Math.round(amountInSum * TIYIN_PER_SUM);
  }

  private tiyinToSum(amountInTiyin: number): number {
    return Math.round(amountInTiyin / TIYIN_PER_SUM);
  }

  private toOfdItem(item: CreateInvoiceParams['items'][number]): MulticardOfdItem {
    if (!item.ikpu || !item.packageCode) {
      throw new Error(
        `Multicard OFD: item "${item.name}" missing required mxik or package_code`,
      );
    }
    const priceTiyin = this.sumToTiyin(item.price);
    return {
      qty: item.quantity,
      price: priceTiyin,
      mxik: item.ikpu,
      package_code: item.packageCode,
      name: item.name,
      total: priceTiyin * item.quantity,
      ...(typeof item.vat === 'number' ? { vat: item.vat } : {}),
    };
  }
}
