import { apiClient } from './client';
import type { Pharmacy } from '@shared/types';

export const pharmaciesApi = {
  getById: (id: string) =>
    apiClient.get<Pharmacy>(`/pharmacy/${id}`).then((r) => r.data),
};
