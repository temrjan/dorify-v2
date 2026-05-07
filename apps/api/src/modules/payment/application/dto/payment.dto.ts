import { z } from 'zod';

export const CreatePaymentSchema = z.object({
  orderId: z.string().min(1),
});

export type CreatePaymentDto = z.infer<typeof CreatePaymentSchema>;

/**
 * Multicard success callback (POST callback_url).
 * Reference: docs/MULTICARD_API_DOCUMENTATION.md:269-281.
 */
export const MulticardCallbackSchema = z.object({
  store_id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  amount: z.number().int().nonnegative(),
  invoice_id: z.string().min(1),
  uuid: z.string().min(1),
  billing_id: z.string().optional(),
  payment_time: z.string().optional(),
  phone: z.string().optional(),
  card_pan: z.string().optional(),
  ps: z.string().optional(),
  card_token: z.string().optional(),
  receipt_url: z.string().optional(),
  sign: z.string().regex(/^[0-9a-fA-F]{32}$/, 'sign must be 32 hex chars (MD5)'),
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
