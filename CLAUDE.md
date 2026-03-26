# Dorify v2

Multi-tenant pharmacy marketplace. NestJS + DDD + Hexagonal Architecture.

## Stack

- **Backend:** NestJS 11 + Prisma 6 + PostgreSQL 17 + Redis 7
- **Frontend:** React 19 + Vite + Tailwind (Telegram Mini App)
- **Bot:** Grammy (Telegram Bot)
- **Architecture:** Modular Monolith + DDD + Hexagonal (Ports & Adapters)
- **Monorepo:** pnpm workspaces

## Standards

Read before coding: `ddd.md` + `nestjs.md` + `typescript.md` from DevDocs/standards/

## Commands

```bash
pnpm install              # Install all deps
pnpm dev                  # Dev mode (all apps)
pnpm build                # Build all
pnpm test                 # Run all tests
pnpm lint                 # Lint all

# API specific
cd apps/api
pnpm prisma:generate      # Generate Prisma client
pnpm prisma:migrate       # Run migrations
pnpm test                 # Unit tests
pnpm test:e2e             # E2E tests
```

## Docker (dev)

```bash
docker compose -f docker-compose.dev.yml up -d   # Start PG + Redis
docker compose up --build                         # Start all services
```

## Architecture

```
apps/api/src/
├── core/          # Global: config, DB, auth, filters, interceptors
├── common/        # Reusable: decorators, pipes, DTOs
├── shared/        # DDD: BaseEntity, AggregateRoot, ValueObject, TenantContext
└── modules/       # Bounded Contexts: iam, catalog, ordering, payment, search, notification
    └── [context]/
        ├── domain/           # Entities, VOs, Events, Repository interfaces
        ├── application/      # Commands, Queries, Event handlers, DTOs
        └── infrastructure/   # Prisma repos, Controllers, External adapters
```
