/**
 * Multicard Payment Gateway API types.
 *
 * Reference: docs/MULTICARD_API_DOCUMENTATION.md (sourced from docs.multicard.uz).
 * All sums in tiyin (1 sum = 100 tiyin).
 */

export interface AuthRequest {
  application_id: string;
  secret: string;
}

export interface AuthResponse {
  token: string;
  role?: string;
  expiry?: string;
}

export interface MulticardOfdItem {
  qty: number;
  price: number;
  mxik: string;
  package_code: string;
  name: string;
  total?: number;
  vat?: number;
  tin?: string;
}

export interface CreateInvoiceRequest {
  store_id: string;
  amount: number;
  invoice_id: string;
  callback_url: string;
  ofd: MulticardOfdItem[];
  lang?: 'ru' | 'uz' | 'en';
  return_url?: string;
  return_error_url?: string;
  sms?: string;
}

export interface CreateInvoiceResponseData {
  uuid: string;
  store_id: number;
  amount: number;
  invoice_id: string;
  checkout_url: string;
  short_link?: string;
  deeplink?: string;
  added_on?: string;
}

export interface InvoiceStatusResponseData {
  uuid: string;
  store_id: number;
  amount: number;
  invoice_id: string;
  checkout_url?: string;
  payment?: {
    id: number;
    uuid: string;
    status: MulticardPaymentStatus;
    total_amount: number;
  };
}

export type MulticardPaymentStatus =
  | 'draft'
  | 'progress'
  | 'billing'
  | 'success'
  | 'error'
  | 'revert'
  | 'hold';

export interface MulticardSuccessResponse<T> {
  success: true;
  data: T;
}

export interface MulticardErrorResponse {
  success: false;
  error: {
    code: string;
    details: string;
  };
}

export type MulticardResponse<T> = MulticardSuccessResponse<T> | MulticardErrorResponse;

/**
 * Success callback payload (POST callback_url).
 * Reference: docs:269-281.
 */
export interface MulticardSuccessCallback {
  store_id: number;
  amount: number;
  invoice_id: string;
  billing_id: string;
  payment_time: string;
  phone?: string;
  card_pan?: string;
  ps?: string;
  card_token?: string;
  uuid: string;
  receipt_url?: string;
  sign: string;
}
