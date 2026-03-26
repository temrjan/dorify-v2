# Dorify v2

Multi-tenant pharmacy marketplace (Telegram Mini App).

## Architecture

- **Backend:** NestJS 11 + DDD + Hexagonal Architecture
- **Database:** PostgreSQL 17 + Prisma 6
- **Frontend:** React 19 + Vite + Tailwind
- **Bot:** Grammy (Telegram)
- **Payments:** Multicard (per-pharmacy credentials)

## Getting Started

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d
cd apps/api && cp .env.example .env
pnpm prisma:migrate
pnpm dev
```
