import { apiClient } from './client';
import type { Pharmacy } from '@shared/types';

export interface PaymentSettings {
  /** Multicard application ID (public part of credentials). */
  multicardAppId?: string;
  /** Multicard store ID (public part of credentials). */
  multicardStoreId?: string;
  /** Masked — backend returns `****xxxx` либо undefined. Cleartext никогда не выходит из backend. */
  multicardSecret?: string;
}

export interface UpdatePaymentSettingsPayload {
  multicardAppId: string;
  multicardStoreId: string;
  multicardSecret: string;
}

export interface UpdateProfilePayload {
  name?: string;
  description?: string;
  address?: string;
  phone?: string;
  logo?: string;
  deliveryEnabled?: boolean;
  deliveryPrice?: number;
}

export const pharmaciesApi = {
  getById: (id: string) =>
    apiClient.get<Pharmacy>(`/pharmacy/${id}`).then((r) => r.data),

  getProfile: () =>
    apiClient.get<Pharmacy>('/pharmacy/profile').then((r) => r.data),

  updateProfile: (payload: UpdateProfilePayload) =>
    apiClient.put<Pharmacy>('/pharmacy/profile', payload).then((r) => r.data),

  getPaymentSettings: () =>
    apiClient.get<PaymentSettings>('/pharmacy/payment-settings').then((r) => r.data),

  updatePaymentSettings: (payload: UpdatePaymentSettingsPayload) =>
    apiClient.put<PaymentSettings>('/pharmacy/payment-settings', payload).then((r) => r.data),
};
