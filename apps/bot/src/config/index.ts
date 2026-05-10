import { z } from 'zod';

const EnvSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  WEBAPP_URL: z.string().url().default('https://app.dorify.uz'),
  API_URL: z.string().url().default('https://api.dorify.uz/api/v1'),
  HEALTH_PORT: z.coerce.number().default(3002),
  ADMIN_CHAT_IDS: z
    .string()
    .default('')
    .transform((val) => val.split(',').filter(Boolean).map(Number)),
  // Service token для admin endpoint calls (POST /admin/pharmacies/:id/{verify,reject}).
  // Mirror of api's ADMIN_SERVICE_TOKEN. Bot шлёт в X-Service-Token header.
  ADMIN_SERVICE_TOKEN: z.string().min(32, 'ADMIN_SERVICE_TOKEN must be ≥32 chars'),
});

export const config = EnvSchema.parse(process.env);
