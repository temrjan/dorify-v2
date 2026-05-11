import { apiClient } from './client';
import type { Order, OrderStatus, PaginatedResult } from '@shared/types';

export const pharmacyOrdersApi = {
  list: (params: { page?: number; limit?: number; status?: OrderStatus }) =>
    apiClient
      .get<PaginatedResult<Order>>('/pharmacy/orders', { params })
      .then((r) => r.data),

  updateStatus: (id: string, status: OrderStatus, reason?: string) =>
    apiClient
      .put<Order>(`/pharmacy/orders/${id}/status`, { status, reason })
      .then((r) => r.data),

  cancel: (id: string, reason: string) =>
    apiClient
      .put<Order>(`/pharmacy/orders/${id}/status`, { status: 'CANCELLED', reason })
      .then((r) => r.data),
};
