process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.BOT_TOKEN = process.env.BOT_TOKEN ?? 'test-bot-token';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.ADMIN_SERVICE_TOKEN = process.env.ADMIN_SERVICE_TOKEN ?? 'test-admin-service-token-min-32-chars-ok';
// bcrypt hash of 'test-password' (cost 10) — for ADMIN_PASSWORD_HASH zod validation.
process.env.ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ?? '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
// Storage paths overridden per-test (see local-disk-storage.adapter.spec.ts).
// Default to OS tmp so that other tests / app boot don't write to root.
import { tmpdir } from 'os';
import { join } from 'path';
process.env.STORAGE_PATH = process.env.STORAGE_PATH ?? join(tmpdir(), 'dorify-test-storage');
process.env.STORAGE_BASE_URL = process.env.STORAGE_BASE_URL ?? 'http://test.local/uploads';
