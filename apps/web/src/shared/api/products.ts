import { apiClient } from './client';
import type { Product, PaginatedResult } from '@shared/types';

export const productsApi = {
  list: (params?: { page?: number; limit?: number; search?: string; category?: string }) =>
    apiClient.get<PaginatedResult<Product>>('/products', { params }).then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Product>(`/products/${id}`).then((r) => r.data),
};
