import { z } from 'zod';

export const CreatePharmacySchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  address: z.string().min(5).max(500),
  phone: z.string().min(9).max(15),
  license: z.string().optional(),
});

export type CreatePharmacyDto = z.infer<typeof CreatePharmacySchema>;

export const UpdatePharmacySchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional(),
  address: z.string().min(5).max(500).optional(),
  phone: z.string().min(9).max(15).optional(),
  logo: z.string().url().optional(),
  deliveryEnabled: z.boolean().optional(),
  deliveryPrice: z.number().nonnegative().optional(),
});

export type UpdatePharmacyDto = z.infer<typeof UpdatePharmacySchema>;

export const UpdatePaymentSettingsSchema = z.object({
  multicardAppId: z.string().min(1),
  multicardStoreId: z.string().min(1),
  multicardSecret: z.string().min(1),
});

export type UpdatePaymentSettingsDto = z.infer<typeof UpdatePaymentSettingsSchema>;

export interface PharmacyResponse {
  id: string;
  name: string;
  slug: string;
  description?: string;
  address: string;
  phone: string;
  license?: string;
  logo?: string;
  isActive: boolean;
  isVerified: boolean;
  deliveryEnabled: boolean;
  deliveryPrice?: number;
  hasPaymentSettings: boolean;
  createdAt: string;
}

export interface PaymentSettingsResponse {
  multicardAppId?: string;
  multicardStoreId?: string;
  multicardSecret?: string; // Masked: ****xxxx
}
