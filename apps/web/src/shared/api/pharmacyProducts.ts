import { apiClient } from './client';
import type { Product, PaginatedResult, ProductStatus } from '@shared/types';

export interface PharmacyProductsListParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: ProductStatus;
}

export interface CreateProductPayload {
  name: string;
  description?: string;
  activeSubstance?: string;
  manufacturer?: string;
  barcode?: string;
  category?: string;
  price: number;
  imageUrl?: string;
  ikpu?: string;
  packageCode?: string;
  vat?: number;
  stock?: number;
  requiresPrescription?: boolean;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

export const pharmacyProductsApi = {
  list: (params?: PharmacyProductsListParams) =>
    apiClient
      .get<PaginatedResult<Product>>('/pharmacy/products', { params })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient
      .get<Product>(`/pharmacy/products/${encodeURIComponent(id)}`)
      .then((r) => r.data),

  create: (payload: CreateProductPayload) =>
    apiClient.post<Product>('/pharmacy/products', payload).then((r) => r.data),

  update: (id: string, payload: UpdateProductPayload) =>
    apiClient
      .put<Product>(`/pharmacy/products/${encodeURIComponent(id)}`, payload)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient
      .delete<void>(`/pharmacy/products/${encodeURIComponent(id)}`)
      .then(() => undefined),
};
