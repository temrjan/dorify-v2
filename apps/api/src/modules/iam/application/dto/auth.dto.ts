import { z } from 'zod';

export const AdminLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
});

export type AdminLoginDto = z.infer<typeof AdminLoginSchema>;

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    role: string;
    firstName: string;
    pharmacyId?: string;
  };
}

export interface TelegramAuthResponse {
  user: {
    id: string;
    telegramId: string;
    firstName: string;
    lastName?: string;
    role: string;
    pharmacyId?: string;
  };
}
