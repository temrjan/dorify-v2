import { z } from 'zod';

export const CreatePaymentSchema = z.object({
  orderId: z.string().min(1),
});

export type CreatePaymentDto = z.infer<typeof CreatePaymentSchema>;

export const MulticardCallbackSchema = z.object({
  invoice_id: z.string(),
  transaction_id: z.string(),
  status: z.string(),
  amount: z.number(),
  card_pan: z.string().optional(),
  receipt_url: z.string().optional(),
  sign: z.string(),
});

export type MulticardCallbackDto = z.infer<typeof MulticardCallbackSchema>;

export interface PaymentResponse {
  id: string;
  orderId: string;
  status: string;
  amount: number;
  checkoutUrl?: string;
  receiptUrl?: string;
  paidAt?: string;
  createdAt: string;
}
