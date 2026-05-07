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

  private async authenticate(credentials: PaymentGatewayCredentials): Promise<string> {
    const cached = this.tokenCache.get(credentials.appId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const response = await fetch(`${this.baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        application_id: credentials.appId,
        secret: credentials.secret,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Multicard auth failed: ${response.status} ${text}`);
      throw new Error(`Multicard auth failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as AuthResponse;
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
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const text = await response.text();
    let parsed: T;
    try {
      parsed = text ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      throw new Error(`Multicard ${method} ${path}: non-JSON response (HTTP ${response.status})`);
    }

    if (!response.ok) {
      this.logger.error(`Multicard ${method} ${path}: HTTP ${response.status} ${text}`);
      throw new Error(`Multicard ${method} ${path}: HTTP ${response.status}`);
    }

    return parsed;
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
