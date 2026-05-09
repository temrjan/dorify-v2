process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.BOT_TOKEN = process.env.BOT_TOKEN ?? 'test-bot-token';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.ADMIN_SERVICE_TOKEN = process.env.ADMIN_SERVICE_TOKEN ?? 'test-admin-service-token-min-32-chars-ok';
// bcrypt hash of 'test-password' (cost 10) — for ADMIN_PASSWORD_HASH zod validation.
process.env.ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ?? '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
