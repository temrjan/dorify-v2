import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379/5'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  BOT_TOKEN: z.string(),
  ALLOWED_ORIGINS: z
    .string()
    .default('*')
    .transform((val) => (val === '*' ? '*' : val.split(',').map((s) => s.trim()))),
  MULTICARD_CALLBACK_URL: z.string().url().optional(),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  INIT_DATA_TTL_SECONDS: z.coerce.number().default(86400),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export const config = EnvSchema.parse(process.env);
