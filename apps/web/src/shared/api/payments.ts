import { apiClient } from './client';
import type { Payment } from '@shared/types';

export const paymentsApi = {
  create: (orderId: string) =>
    apiClient.post<Payment>('/payments/create', { orderId }).then((r) => r.data),

  getByOrder: (orderId: string) =>
    apiClient
      .get<Payment | null>(`/payments/order/${encodeURIComponent(orderId)}`)
      .then((r) => r.data ?? undefined),

  getStatus: (paymentId: string) =>
    apiClient
      .get<Payment>(`/payments/status/${encodeURIComponent(paymentId)}`)
      .then((r) => r.data),
};
