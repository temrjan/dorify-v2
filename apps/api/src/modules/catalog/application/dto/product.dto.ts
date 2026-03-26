import { z } from 'zod';

export const CreateProductSchema = z.object({
  name: z.string().min(2).max(300),
  description: z.string().max(5000).optional(),
  activeSubstance: z.string().max(300).optional(),
  manufacturer: z.string().max(300).optional(),
  barcode: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  price: z.number().positive(),
  imageUrl: z.string().url().optional(),
  ikpu: z.string().regex(/^\d{17}$/, 'IKPU must be 17 digits').optional(),
  packageCode: z.string().max(20).optional(),
  vat: z.number().int().min(0).max(100).optional(),
  stock: z.number().int().nonnegative().default(0),
  requiresPrescription: z.boolean().default(false),
});

export type CreateProductDto = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = z.object({
  name: z.string().min(2).max(300).optional(),
  description: z.string().max(5000).optional(),
  activeSubstance: z.string().max(300).optional(),
  manufacturer: z.string().max(300).optional(),
  barcode: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  price: z.number().positive().optional(),
  imageUrl: z.string().url().optional(),
  ikpu: z.string().regex(/^\d{17}$/).optional(),
  packageCode: z.string().max(20).optional(),
  vat: z.number().int().min(0).max(100).optional(),
  stock: z.number().int().nonnegative().optional(),
  requiresPrescription: z.boolean().optional(),
});

export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;

export const ModerateProductSchema = z.object({
  action: z.enum(['publish', 'reject']),
  note: z.string().max(1000).optional(),
});

export type ModerateProductDto = z.infer<typeof ModerateProductSchema>;

export const ProductFiltersSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ProductFiltersDto = z.infer<typeof ProductFiltersSchema>;

export interface ProductResponse {
  id: string;
  pharmacyId: string;
  name: string;
  description?: string;
  activeSubstance?: string;
  manufacturer?: string;
  barcode?: string;
  category?: string;
  price: number;
  imageUrl?: string;
  ikpu?: string;
  vat?: number;
  stock: number;
  isAvailable: boolean;
  requiresPrescription: boolean;
  status: string;
  createdAt: string;
}
