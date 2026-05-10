import { apiClient } from '@shared/api/client';
import type { Pharmacy } from '@shared/types';

export interface RegisterPharmacyPayload {
  name: string;
  slug: string;
  phone: string;
  address: string;
  license?: string;
}

export interface UpdatePharmacyProfilePayload {
  description?: string;
  logo?: string;
  deliveryEnabled?: boolean;
  deliveryPrice?: number;
}

export interface UpdatePaymentSettingsPayload {
  multicardAppId: string;
  multicardStoreId: string;
  multicardSecret: string;
}

export interface SlugAvailability {
  available: boolean;
  suggestion?: string;
}

export interface ImageUploadResponse {
  url: string;
  bytes: number;
  format: string;
}

export const becomePharmacyApi = {
  checkSlug: (slug: string) =>
    apiClient
      .get<SlugAvailability>('/pharmacy/check-slug', { params: { slug } })
      .then((r) => r.data),

  register: (payload: RegisterPharmacyPayload) =>
    apiClient.post<Pharmacy>('/pharmacy/register', payload).then((r) => r.data),

  updateProfile: (payload: UpdatePharmacyProfilePayload) =>
    apiClient.put<Pharmacy>('/pharmacy/profile', payload).then((r) => r.data),

  updatePaymentSettings: (payload: UpdatePaymentSettingsPayload) =>
    apiClient.put('/pharmacy/payment-settings', payload).then((r) => r.data),

  uploadLogo: async (file: File): Promise<ImageUploadResponse> => {
    const form = new FormData();
    form.append('file', file);
    const response = await apiClient.post<ImageUploadResponse>(
      '/uploads/image?scope=logos',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },
};
