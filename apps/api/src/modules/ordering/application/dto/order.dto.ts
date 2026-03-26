import { z } from 'zod';

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

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED', 'CANCELLED']),
  reason: z.string().max(500).optional(),
});

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
