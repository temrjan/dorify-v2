import { z } from 'zod';

const EnvSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  WEBAPP_URL: z.string().url().default('https://dorify.uz'),
  HEALTH_PORT: z.coerce.number().default(3002),
  ADMIN_CHAT_IDS: z
    .string()
    .default('')
    .transform((val) => val.split(',').filter(Boolean).map(Number)),
});

export const config = EnvSchema.parse(process.env);
