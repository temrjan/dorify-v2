import { z } from 'zod';

export const SearchQuerySchema = z.object({
  q: z.string().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  pharmacyId: z.string().optional(),
  category: z.string().optional(),
});

export type SearchQueryDto = z.infer<typeof SearchQuerySchema>;

export interface SearchResultItem {
  id: string;
  name: string;
  description?: string;
  manufacturer?: string;
  category?: string;
  price: number;
  pharmacyId: string;
  imageUrl?: string;
  score: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
}
