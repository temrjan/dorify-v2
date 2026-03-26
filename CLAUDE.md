# Dorify v2

Multi-tenant pharmacy marketplace. NestJS + DDD + Hexagonal Architecture.

## Stack

- **Backend:** NestJS 11 + Prisma 6 + PostgreSQL 17 + Redis 7
- **Frontend:** React 19 + Vite + Tailwind (Telegram Mini App)
- **Bot:** Grammy (Telegram Bot)
- **Architecture:** Modular Monolith + DDD + Hexagonal (Ports & Adapters)
- **Monorepo:** pnpm workspaces
- **Validation:** Zod (НЕ class-validator)
- **CI/CD:** GitHub Actions → SSH deploy to 7demo

## Standards — читать ПЕРЕД кодом

| Стек | Файлы из DevDocs/standards/ |
|------|----------------------------|
| DDD | `ddd.md` |
| NestJS | `nestjs.md` |
| TypeScript | `typescript.md` |
| PostgreSQL | `postgresql.md` |
| Docker/Deploy | `devops.md` |
| Tests | `testing.md` |

## Architecture Rules

### Dependency Rule (Hexagonal)
```
Infrastructure → Application → Domain
Domain НЕ зависит ни от чего (чистый TypeScript)
```

### Module Structure (каждый Bounded Context)
```
modules/[context]/
├── domain/           # Entities, VOs, Events, Repo interfaces — 0 зависимостей
├── application/      # Commands, Queries, Event handlers — зависит от domain
└── infrastructure/   # Prisma repos, Controllers — зависит от domain + application
```

### Bounded Contexts
1. `iam/` — User, Pharmacy, Auth, Tenant scoping
2. `catalog/` — Product, Stock, Moderation
3. `ordering/` — Order (Aggregate Root), OrderItem, state machine
4. `payment/` — Multicard per-pharmacy, OFD, callbacks
5. `search/` — AI semantic search (Avi)
6. `notification/` — Telegram messages via Domain Events

## Coding Rules

- **Тонкие контроллеры** — parse input → call service → return result. Ноль бизнес-логики.
- **Domain entities с поведением** — `order.confirm()`, `product.decrementStock()`, не анемичные модели
- **Value Objects** для доменных типов — Money, Ikpu, PhoneNumber, TelegramId
- **Repository Pattern** — interface в domain/, реализация (Prisma) в infrastructure/
- **Mapper** — Prisma model ↔ Domain entity. НЕ использовать Prisma types в domain layer.
- **Domain Events** — для cross-context: OrderCreated → DecrementStock, PaymentConfirmed → ConfirmOrder
- **TenantContext** — AsyncLocalStorage. Repository автоматически фильтрует по pharmacyId.
- **Zod schemas** — единый source of truth. `z.infer<typeof Schema>` для типов DTO.
- **Named exports only** — никаких default exports
- **Strict TypeScript** — no `any`, noUnusedLocals, noUnusedParameters
- **Constructor injection** — никакого property injection
- **Единый PrismaClient** — через PrismaService из DI. НЕ создавать new PrismaClient().
- **HTTP exceptions** из сервисов — NotFoundException, ConflictException и т.д.
- **Тесты вместе с кодом** — domain unit tests БЕЗ БД, application tests с mock repo

## Multi-tenancy

- Покупатели (USER): видят опубликованные товары всех аптек, свои заказы
- Аптеки (PHARMACY_OWNER): видят только свои данные (scoped by pharmacyId)
- Админы (ADMIN): видят всё, но через JWT auth (НЕ через prefix-token)

## Payment Rules

- Per-pharmacy Multicard credentials (encrypted AES-256)
- Callback: verify MD5 signature → `WHERE status != 'PAID'` внутри транзакции (race-fix)
- IKPU/MXIK: обязательная валидация, дефолтные нули запрещены
- VAT 0: отправлять явно (не исключать)
- Payment records: onDelete Restrict (нельзя каскадно удалять)

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

## Docker

```bash
docker compose -f docker-compose.dev.yml up -d   # Dev: PG + Redis
docker compose up --build                         # Prod: all services
```

## Server (7demo)

- Host: `ssh 7demo` (62.169.20.2:9281)
- Path: `/opt/dorify-v2/`
- DB: `dorify_v2_db` (dorify_user)
- Redis: DB 5
- Caddy: routes будут настроены при деплое

## Design Doc

Полная архитектура, Prisma schema, примеры кода, план фаз:
`docs/DORIFY_V2_DDD.md`
