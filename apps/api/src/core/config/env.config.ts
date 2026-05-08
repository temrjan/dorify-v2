import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379/5'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  BOT_TOKEN: z.string(),
  // Default — production TWA + admin domains. With `credentials: true` in
  // app.enableCors, '*' is invalid (browsers refuse). Override via env if
  // adding new origins; commit-time defaults must include every prod domain.
  ALLOWED_ORIGINS: z
    .string()
    .default('https://app.dorify.uz,https://pharmacy.dorify.uz,https://admin.dorify.uz')
    .transform((val) => val.split(',').map((s) => s.trim()).filter(Boolean)),
  MULTICARD_API_URL: z.string().url().default('https://dev-mesh.multicard.uz'),
  MULTICARD_CALLBACK_URL: z.string().url().optional(),
  WEB_URL: z.string().url().default('https://app.dorify.uz'),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes for AES-256)'),
  INIT_DATA_TTL_SECONDS: z.coerce.number().default(86400),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export const config = EnvSchema.parse(process.env);
