export interface CreateInvoiceParams {
  invoiceId: string;
  amount: number;
  description: string;
  callbackUrl: string;
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

export interface CallbackData {
  invoiceId: string;
  transactionId: string;
  status: string;
  amount: number;
  cardPan?: string;
  receiptUrl?: string;
  sign: string;
}

export interface PaymentGatewayPort {
  createInvoice(
    credentials: { appId: string; storeId: string; secret: string },
    params: CreateInvoiceParams,
  ): Promise<CreateInvoiceResult>;

  verifyCallbackSignature(
    secret: string,
    callback: CallbackData,
  ): boolean;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
