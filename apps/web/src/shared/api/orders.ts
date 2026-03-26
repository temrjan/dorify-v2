import { apiClient } from './client';
import type { Order, PaginatedResult } from '@shared/types';

export const ordersApi = {
  place: (data: {
    pharmacyId: string;
    items: Array<{ productId: string; quantity: number }>;
    deliveryType: string;
    contactPhone: string;
    deliveryAddress?: string;
    comment?: string;
  }) => apiClient.post<Order>('/orders', data).then((r) => r.data),

  list: (params?: { page?: number; limit?: number }) =>
    apiClient.get<PaginatedResult<Order>>('/orders', { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Order>(`/orders/${id}`).then((r) => r.data),

  cancel: (id: string) =>
    apiClient.post<Order>(`/orders/${id}/cancel`).then((r) => r.data),
};
