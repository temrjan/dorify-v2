/**
 * Payment Gateway port (domain interface).
 * Adapters: Multicard (current), future providers.
 *
 * All sums in this interface are in domain currency units (UZS).
 * Adapters convert to provider-specific units (e.g. tiyin) internally.
 */

export interface PaymentGatewayCredentials {
  appId: string;
  storeId: string;
  /** Plaintext secret (decrypted before passing to adapter). */
  secret: string;
}

export interface CreateInvoiceParams {
  invoiceId: string;
  amount: number;
  description: string;
  callbackUrl: string;
  returnUrl?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    ikpu?: string;
    packageCode?: string;
    vat?: number;
  }>;
}

export interface CreateInvoiceResult {
  invoiceId: string;
  checkoutUrl: string;
}

export type GatewayInvoiceStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface InvoiceStatusResult {
  invoiceId: string;
  status: GatewayInvoiceStatus;
  amount: number;
}

export interface CallbackData {
  storeId: string;
  invoiceId: string;
  amount: number;
  uuid: string;
  billingId?: string;
  cardPan?: string;
  receiptUrl?: string;
  sign: string;
}

export interface PaymentGatewayPort {
  createInvoice(
    credentials: PaymentGatewayCredentials,
    params: CreateInvoiceParams,
  ): Promise<CreateInvoiceResult>;

  getInvoiceStatus(
    credentials: PaymentGatewayCredentials,
    invoiceId: string,
  ): Promise<InvoiceStatusResult>;

  verifyCallbackSignature(secret: string, callback: CallbackData): boolean;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
