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
  // Telegram initData TTL — default 5 min (300 s). Audit S-HIGH-1: prior
  // 24h window meant intercepted initData (XSS/network-sniffing) usable for
  // a full day. Telegram clients refresh initData on each WebApp open;
  // 5 min covers session active use.
  INIT_DATA_TTL_SECONDS: z.coerce.number().default(300),
  // Service token for bot → admin endpoints (verify/reject pharmacy).
  // Generate via `openssl rand -hex 32` and share between api + bot env.
  ADMIN_SERVICE_TOKEN: z.string().min(32, 'ADMIN_SERVICE_TOKEN must be ≥32 chars'),
  // Admin login credentials — было hardcoded в iam.service.ts (audit
  // S-CRIT-1). bcrypt-hashed password (cost ≥10). Generate hash:
  //   node -e "console.log(require('bcryptjs').hashSync('mypass', 10))"
  ADMIN_USERNAME: z.string().min(1).default('admin'),
  ADMIN_PASSWORD_HASH: z
    .string()
    .regex(/^\$2[ayb]\$\d{2}\$.{53}$/, 'ADMIN_PASSWORD_HASH must be a bcrypt hash'),
  // Storage paths for image uploads. Default — local volume mounted in
  // docker-compose.yml; swap to S3-compatible adapter позже.
  STORAGE_PATH: z.string().default('/opt/dorify-v2/uploads'),
  STORAGE_BASE_URL: z.string().url().default('https://api.dorify.uz/uploads'),
  STORAGE_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export const config = EnvSchema.parse(process.env);
