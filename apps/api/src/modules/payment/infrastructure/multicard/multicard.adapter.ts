import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type { PaymentGatewayPort, CreateInvoiceParams, CreateInvoiceResult, CallbackData } from '../../domain/ports/payment-gateway.port';

@Injectable()
export class MulticardAdapter implements PaymentGatewayPort {
  private readonly logger = new Logger(MulticardAdapter.name);

  async createInvoice(
    _credentials: { appId: string; storeId: string; secret: string },
    params: CreateInvoiceParams,
  ): Promise<CreateInvoiceResult> {
    // TODO: Implement actual Multicard API call
    // For now, return mock data for development
    this.logger.log(`[MOCK] Creating invoice: ${params.invoiceId}, amount: ${params.amount}`);

    return {
      invoiceId: params.invoiceId,
      checkoutUrl: `https://checkout.multicard.uz/pay/${params.invoiceId}`,
    };
  }

  verifyCallbackSignature(secret: string, callback: CallbackData): boolean {
    // Multicard MD5 signature verification
    // sign = MD5(invoice_id + transaction_id + status + amount + secret)
    const dataString = `${callback.invoiceId}${callback.transactionId}${callback.status}${callback.amount}${secret}`;
    const expectedSign = createHash('md5').update(dataString).digest('hex');

    return expectedSign === callback.sign;
  }
}
