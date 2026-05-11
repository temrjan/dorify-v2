import { z } from 'zod';
import { PaginationSchema } from '@common/dto/pagination.dto';

export const PlaceOrderSchema = z.object({
  pharmacyId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1, 'Order must have at least one item'),
  deliveryType: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  deliveryAddress: z.string().max(500).optional(),
  contactPhone: z.string().min(9).max(15),
  comment: z.string().max(1000).optional(),
});

export type PlaceOrderDto = z.infer<typeof PlaceOrderSchema>;

const ORDER_STATUS_VALUES = [
  'PENDING',
  'PENDING_MANUAL_CONTACT',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DELIVERING',
  'DELIVERED',
  'CANCELLED',
] as const;

export const ListPharmacyOrdersSchema = PaginationSchema.extend({
  status: z.enum(ORDER_STATUS_VALUES).optional(),
});

export type ListPharmacyOrdersDto = z.infer<typeof ListPharmacyOrdersSchema>;

// Cancel requires non-empty reason (audit trail). Forward transitions don't
// need reason. Refinement enforces server-side, не only client-side.
export const UpdateOrderStatusSchema = z
  .object({
    status: z.enum(['CONFIRMED', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED', 'CANCELLED']),
    reason: z.string().max(500).optional(),
  })
  .refine(
    (data) => data.status !== 'CANCELLED' || (typeof data.reason === 'string' && data.reason.trim().length > 0),
    { message: 'Reason is required when cancelling', path: ['reason'] },
  );

export type UpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusSchema>;

export interface OrderResponse {
  id: string;
  pharmacyId: string;
  buyerId: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  deliveryType: string;
  deliveryAddress?: string;
  contactPhone: string;
  comment?: string;
  items: OrderItemResponse[];
  createdAt: string;
}

export interface OrderItemResponse {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  priceAtTime: number;
  subtotal: number;
}
