# Dorify v2 — Architectural Design Document
## Мультитенантный маркетплейс аптек на DDD

> **Версия:** 1.0
> **Дата:** 2026-03-26
> **Стек:** NestJS 11 + Prisma 6 + PostgreSQL 17 + React 19 + Grammy
> **Архитектура:** Modular Monolith + DDD + Hexagonal (Ports & Adapters)

---

## 1. БИЗНЕС-КОНТЕКСТ

### 1.1 Что такое Dorify

Dorify — мультитенантный маркетплейс аптек (Telegram Mini App). Модель **гипермаркета**: платформа объединяет множество аптек, каждая со своими товарами, платежами (Multicard), фискальными чеками (OFD).

### 1.2 Ключевые бизнес-требования

| # | Требование |
|---|---|
| 1 | Множество аптек на одной платформе с полной изоляцией данных |
| 2 | Per-pharmacy Multicard credentials (каждая аптека получает оплату на свой счёт) |
| 3 | OFD фискализация с реальными IKPU/MXIK кодами |
| 4 | Модерация товаров перед публикацией |
| 5 | Управление остатками (stock) с защитой от перепродажи |
| 6 | AI-поиск по каталогу (семантический) |
| 7 | Telegram Mini App для покупателей |
| 8 | Telegram Bot для уведомлений и регистрации аптек |
| 9 | Подписки аптек (FREE / OPTIMA / PRIME) — будущее |

### 1.3 Почему DDD

Dorify v1 — классический MVC с бизнес-логикой в роутах. При масштабировании до десятков аптек это приводит к:
- Отсутствию изоляции тенантов (аудит v1: admin видит все данные)
- Дублированию логики (3 копии ORDER_STATUS_MAP)
- Невозможности тестировать бизнес-логику без БД
- Сломанной авторизации (admin-token-* без валидации)

DDD решает эти проблемы через:
- **Bounded Contexts** = чёткие границы модулей
- **Entities с поведением** = бизнес-правила в домене, а не в роутах
- **Repository Pattern** = тестируемость без БД
- **Domain Events** = слабая связанность между модулями

---

## 2. СТРАТЕГИЧЕСКИЙ ДИЗАЙН (Strategic Design)

### 2.1 Bounded Contexts

```
┌─────────────────────────────────────────────────────────────┐
│                        DORIFY v2                            │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │   IAM    │  │ CATALOG  │  │ ORDERING │  │  PAYMENT  │  │
│  │          │  │          │  │          │  │           │  │
│  │ User     │  │ Product  │  │ Order    │  │ Payment   │  │
│  │ Pharmacy │  │ Category │  │ OrderItem│  │ Invoice   │  │
│  │ Auth     │  │ Stock    │  │ Cart     │  │ Multicard │  │
│  │ Tenant   │  │ Moderate │  │          │  │ OFD       │  │
│  └─────┬────┘  └─────┬────┘  └────┬─────┘  └─────┬─────┘  │
│        │             │            │               │         │
│  ┌─────┴─────────────┴────────────┴───────────────┴─────┐  │
│  │                   SHARED KERNEL                       │  │
│  │  TenantContext, DomainEvents, BaseEntity, Money VO    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────┐  ┌──────────────┐                            │
│  │  SEARCH  │  │ NOTIFICATION │                            │
│  │  (AI)    │  │  (Telegram)  │                            │
│  └──────────┘  └──────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Context Map (связи между контекстами)

```
IAM ──[upstream]──> CATALOG      (Pharmacy ID используется для scoping товаров)
IAM ──[upstream]──> ORDERING     (User ID для заказов, Pharmacy ID для tenant)
CATALOG ──[upstream]──> ORDERING (Product data копируется в OrderItem при заказе)
ORDERING ──[events]──> PAYMENT   (OrderCreated → CreateInvoice)
PAYMENT ──[events]──> ORDERING   (PaymentConfirmed → ConfirmOrder)
ORDERING ──[events]──> CATALOG   (OrderCreated → DecrementStock, OrderCancelled → RestoreStock)
ORDERING ──[events]──> NOTIFICATION (OrderStatusChanged → NotifyUser)
PAYMENT ──[events]──> NOTIFICATION (PaymentFailed → NotifyPharmacy)
```

### 2.3 Ubiquitous Language (Единый язык)

| Термин | Определение |
|--------|-------------|
| **Tenant** | Аптека (организация), зарегистрированная на платформе |
| **Pharmacy** | = Tenant. Юр. лицо с лицензией, Multicard credentials, товарами |
| **PharmacyOwner** | Пользователь с ролью PHARMACY_OWNER, управляющий конкретной аптекой |
| **Buyer** | Покупатель (пользователь с ролью USER) |
| **Product** | Товар в каталоге аптеки. Проходит модерацию. |
| **Order** | Заказ покупателя в конкретной аптеке |
| **Invoice** | Счёт на оплату в Multicard |
| **Payment** | Факт оплаты (подтверждённый callback от Multicard) |
| **OFD** | Фискальный чек (обязателен по закону Узбекистана) |
| **IKPU/MXIK** | Идентификатор товара для OFD (Единый электронный каталог) |
| **Stock** | Остаток товара. Декрементируется при заказе, восстанавливается при отмене |
| **Moderation** | Проверка товара перед публикацией (DRAFT → PENDING → PUBLISHED/REJECTED) |

---

## 3. ТАКТИЧЕСКИЙ ДИЗАЙН (Tactical Design)

### 3.1 Технологический стек

| Компонент | Технология | Почему |
|-----------|-----------|--------|
| **Backend** | NestJS 11 | Модули, DI, Guards, Interceptors — инфраструктура для DDD |
| **ORM** | Prisma 6 | Type-safe queries, миграции. Оборачивается в Repository |
| **DB** | PostgreSQL 17 | pgvector для AI search, надёжность |
| **Cache** | Redis 7 | Сессии, кэш, rate limiting |
| **Frontend** | React 19 + Vite + Tailwind | Telegram Mini App |
| **Bot** | Grammy 1.x | Telegram Bot API |
| **AI Search** | OpenAI Embeddings + pgvector | Семантический поиск по каталогу |
| **Monorepo** | pnpm workspaces | Простой, без overhead Turborepo |
| **CI/CD** | GitHub Actions | Lint → Test → Build → Deploy |
| **Deploy** | Docker Compose | На 7demo сервере |

### 3.2 Выбор NestJS + Prisma (обоснование)

**Почему NestJS, а не Express?**
- Express v1 показал: без DI и модулей бизнес-логика утекает в роуты
- NestJS Module = Bounded Context (1:1 маппинг)
- Guards = авторизация на уровне декораторов
- Interceptors = TenantContext, AuditLog, Response transform
- @nestjs/cqrs = готовый EventBus для Domain Events

**Почему Prisma, а не TypeORM/MikroORM?**
- Prisma уже знакома по v1 — нулевая кривая обучения
- Type-safe: генерирует типы из схемы
- Ограничение (нет entity classes) решается Repository Pattern:
  - Prisma model → маппинг → Domain Entity (чистый TS class)
  - Domain Entity → маппинг → Prisma create/update data

---

## 4. СТРУКТУРА ПРОЕКТА

```
dorify-v2/
├── package.json                     # pnpm workspace root
├── pnpm-workspace.yaml
├── docker-compose.yml
├── docker-compose.dev.yml
├── .github/
│   └── workflows/
│       ├── ci.yml                   # Lint + Test + Build
│       └── deploy.yml               # SSH deploy
│
├── apps/
│   ├── api/                         # NestJS Backend
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   │
│   │   │   ├── modules/
│   │   │   │   ├── iam/             # Identity & Access Management
│   │   │   │   │   ├── iam.module.ts
│   │   │   │   │   ├── domain/
│   │   │   │   │   │   ├── entities/
│   │   │   │   │   │   │   ├── user.entity.ts
│   │   │   │   │   │   │   └── pharmacy.entity.ts
│   │   │   │   │   │   ├── value-objects/
│   │   │   │   │   │   │   ├── telegram-id.vo.ts
│   │   │   │   │   │   │   ├── phone-number.vo.ts
│   │   │   │   │   │   │   └── user-role.vo.ts
│   │   │   │   │   │   ├── events/
│   │   │   │   │   │   │   ├── user-registered.event.ts
│   │   │   │   │   │   │   └── pharmacy-verified.event.ts
│   │   │   │   │   │   └── repositories/
│   │   │   │   │   │       ├── user.repository.ts        # Interface (Port)
│   │   │   │   │   │       └── pharmacy.repository.ts    # Interface (Port)
│   │   │   │   │   ├── application/
│   │   │   │   │   │   ├── commands/
│   │   │   │   │   │   │   ├── register-user.command.ts
│   │   │   │   │   │   │   ├── register-user.handler.ts
│   │   │   │   │   │   │   ├── create-pharmacy.command.ts
│   │   │   │   │   │   │   └── create-pharmacy.handler.ts
│   │   │   │   │   │   ├── queries/
│   │   │   │   │   │   │   ├── get-user.query.ts
│   │   │   │   │   │   │   └── get-pharmacy.query.ts
│   │   │   │   │   │   └── dto/
│   │   │   │   │   │       ├── register-user.dto.ts
│   │   │   │   │   │       └── create-pharmacy.dto.ts
│   │   │   │   │   └── infrastructure/
│   │   │   │   │       ├── persistence/
│   │   │   │   │       │   ├── prisma-user.repository.ts    # Adapter
│   │   │   │   │       │   ├── prisma-pharmacy.repository.ts
│   │   │   │   │       │   └── mappers/
│   │   │   │   │       │       ├── user.mapper.ts
│   │   │   │   │       │       └── pharmacy.mapper.ts
│   │   │   │   │       ├── guards/
│   │   │   │   │       │   ├── telegram-auth.guard.ts
│   │   │   │   │       │   ├── jwt-auth.guard.ts
│   │   │   │   │       │   └── roles.guard.ts
│   │   │   │   │       └── controllers/
│   │   │   │   │           ├── auth.controller.ts
│   │   │   │   │           └── pharmacy.controller.ts
│   │   │   │   │
│   │   │   │   ├── catalog/          # Product Catalog
│   │   │   │   │   ├── catalog.module.ts
│   │   │   │   │   ├── domain/
│   │   │   │   │   │   ├── entities/
│   │   │   │   │   │   │   └── product.entity.ts
│   │   │   │   │   │   ├── value-objects/
│   │   │   │   │   │   │   ├── money.vo.ts
│   │   │   │   │   │   │   ├── ikpu.vo.ts
│   │   │   │   │   │   │   └── product-status.vo.ts
│   │   │   │   │   │   ├── events/
│   │   │   │   │   │   │   ├── product-created.event.ts
│   │   │   │   │   │   │   └── stock-decremented.event.ts
│   │   │   │   │   │   ├── services/
│   │   │   │   │   │   │   └── stock.domain-service.ts
│   │   │   │   │   │   └── repositories/
│   │   │   │   │   │       └── product.repository.ts
│   │   │   │   │   ├── application/
│   │   │   │   │   │   ├── commands/
│   │   │   │   │   │   │   ├── create-product.handler.ts
│   │   │   │   │   │   │   ├── update-product.handler.ts
│   │   │   │   │   │   │   ├── moderate-product.handler.ts
│   │   │   │   │   │   │   └── decrement-stock.handler.ts
│   │   │   │   │   │   ├── queries/
│   │   │   │   │   │   │   ├── list-products.handler.ts
│   │   │   │   │   │   │   └── get-product.handler.ts
│   │   │   │   │   │   └── dto/
│   │   │   │   │   └── infrastructure/
│   │   │   │   │       ├── persistence/
│   │   │   │   │       │   ├── prisma-product.repository.ts
│   │   │   │   │       │   └── mappers/
│   │   │   │   │       │       └── product.mapper.ts
│   │   │   │   │       └── controllers/
│   │   │   │   │           ├── product.controller.ts
│   │   │   │   │           └── admin-product.controller.ts
│   │   │   │   │
│   │   │   │   ├── ordering/         # Orders
│   │   │   │   │   ├── ordering.module.ts
│   │   │   │   │   ├── domain/
│   │   │   │   │   │   ├── entities/
│   │   │   │   │   │   │   ├── order.entity.ts          # Aggregate Root
│   │   │   │   │   │   │   └── order-item.entity.ts
│   │   │   │   │   │   ├── value-objects/
│   │   │   │   │   │   │   └── order-status.vo.ts
│   │   │   │   │   │   ├── events/
│   │   │   │   │   │   │   ├── order-created.event.ts
│   │   │   │   │   │   │   ├── order-confirmed.event.ts
│   │   │   │   │   │   │   └── order-cancelled.event.ts
│   │   │   │   │   │   └── repositories/
│   │   │   │   │   │       └── order.repository.ts
│   │   │   │   │   ├── application/
│   │   │   │   │   │   ├── commands/
│   │   │   │   │   │   │   ├── place-order.handler.ts
│   │   │   │   │   │   │   ├── cancel-order.handler.ts
│   │   │   │   │   │   │   └── update-order-status.handler.ts
│   │   │   │   │   │   ├── queries/
│   │   │   │   │   │   │   ├── get-order.handler.ts
│   │   │   │   │   │   │   └── list-orders.handler.ts
│   │   │   │   │   │   ├── event-handlers/
│   │   │   │   │   │   │   └── on-payment-confirmed.handler.ts
│   │   │   │   │   │   └── dto/
│   │   │   │   │   └── infrastructure/
│   │   │   │   │       ├── persistence/
│   │   │   │   │       └── controllers/
│   │   │   │   │           ├── order.controller.ts
│   │   │   │   │           └── admin-order.controller.ts
│   │   │   │   │
│   │   │   │   ├── payment/          # Payments + OFD
│   │   │   │   │   ├── payment.module.ts
│   │   │   │   │   ├── domain/
│   │   │   │   │   │   ├── entities/
│   │   │   │   │   │   │   └── payment.entity.ts
│   │   │   │   │   │   ├── value-objects/
│   │   │   │   │   │   │   ├── payment-status.vo.ts
│   │   │   │   │   │   │   ├── multicard-credentials.vo.ts
│   │   │   │   │   │   │   └── ofd-item.vo.ts
│   │   │   │   │   │   ├── events/
│   │   │   │   │   │   │   ├── payment-confirmed.event.ts
│   │   │   │   │   │   │   └── payment-failed.event.ts
│   │   │   │   │   │   └── repositories/
│   │   │   │   │   │       └── payment.repository.ts
│   │   │   │   │   ├── application/
│   │   │   │   │   │   ├── commands/
│   │   │   │   │   │   │   ├── create-invoice.handler.ts
│   │   │   │   │   │   │   └── process-callback.handler.ts
│   │   │   │   │   │   ├── queries/
│   │   │   │   │   │   │   └── get-payment-status.handler.ts
│   │   │   │   │   │   └── event-handlers/
│   │   │   │   │   │       └── on-order-created.handler.ts
│   │   │   │   │   └── infrastructure/
│   │   │   │   │       ├── multicard/
│   │   │   │   │       │   ├── multicard.adapter.ts
│   │   │   │   │       │   └── multicard.types.ts
│   │   │   │   │       ├── persistence/
│   │   │   │   │       └── controllers/
│   │   │   │   │           └── payment.controller.ts
│   │   │   │   │
│   │   │   │   ├── search/           # AI Search (Avi)
│   │   │   │   │   ├── search.module.ts
│   │   │   │   │   ├── domain/
│   │   │   │   │   ├── application/
│   │   │   │   │   └── infrastructure/
│   │   │   │   │       ├── openai/
│   │   │   │   │       └── controllers/
│   │   │   │   │
│   │   │   │   └── notification/     # Telegram Notifications
│   │   │   │       ├── notification.module.ts
│   │   │   │       ├── application/
│   │   │   │       │   └── event-handlers/
│   │   │   │       │       ├── on-order-status-changed.ts
│   │   │   │       │       └── on-payment-confirmed.ts
│   │   │   │       └── infrastructure/
│   │   │   │           └── telegram.adapter.ts
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── domain/
│   │   │       │   ├── base.entity.ts
│   │   │       │   ├── aggregate-root.ts
│   │   │       │   ├── value-object.ts
│   │   │       │   ├── domain-event.ts
│   │   │       │   └── repository.interface.ts
│   │   │       ├── infrastructure/
│   │   │       │   ├── database/
│   │   │       │   │   ├── prisma.service.ts
│   │   │       │   │   └── prisma.module.ts
│   │   │       │   ├── tenant/
│   │   │       │   │   ├── tenant.context.ts          # AsyncLocalStorage
│   │   │       │   │   ├── tenant.interceptor.ts      # Sets tenant from auth
│   │   │       │   │   └── tenant.module.ts
│   │   │       │   ├── event-bus/
│   │   │       │   │   └── event-bus.module.ts
│   │   │       │   └── audit/
│   │   │       │       ├── audit.interceptor.ts
│   │   │       │       └── audit.service.ts
│   │   │       ├── guards/
│   │   │       │   └── tenant.guard.ts                # Ensures pharmacyId present
│   │   │       └── decorators/
│   │   │           ├── current-user.decorator.ts
│   │   │           ├── current-tenant.decorator.ts
│   │   │           └── roles.decorator.ts
│   │   │
│   │   └── test/
│   │       ├── unit/                # Domain tests (no DB)
│   │       ├── integration/         # Module tests (with DB)
│   │       └── e2e/                 # API tests
│   │
│   ├── web/                         # React Frontend (Marketplace + Pharmacy Panel)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── app/
│   │   │   │   ├── router.tsx
│   │   │   │   ├── providers.tsx
│   │   │   │   └── layouts/
│   │   │   ├── features/            # Feature-Sliced Design
│   │   │   │   ├── home/
│   │   │   │   ├── product/
│   │   │   │   ├── cart/
│   │   │   │   ├── checkout/
│   │   │   │   ├── orders/
│   │   │   │   ├── search/
│   │   │   │   ├── pharmacy-panel/
│   │   │   │   └── admin/
│   │   │   ├── shared/
│   │   │   │   ├── api/             # API client + typed endpoints
│   │   │   │   ├── ui/              # Shared UI components
│   │   │   │   ├── stores/          # Zustand stores
│   │   │   │   ├── hooks/
│   │   │   │   └── lib/             # Utilities
│   │   │   └── i18n/                # Русский + Узбекский
│   │   └── test/
│   │
│   └── bot/                         # Grammy Telegram Bot
│       ├── package.json
│       ├── src/
│       │   ├── main.ts
│       │   ├── bot.ts
│       │   ├── commands/
│       │   ├── conversations/
│       │   ├── keyboards/
│       │   ├── services/
│       │   └── config/
│       └── test/
│
└── packages/                        # Shared packages (optional)
    └── shared-types/                # Types shared between api/web/bot
        ├── package.json
        └── src/
            └── index.ts
```

---

## 5. DOMAIN LAYER — Примеры кода

### 5.1 Base Classes (Shared Kernel)

```typescript
// shared/domain/value-object.ts
export abstract class ValueObject<T> {
  protected readonly props: T;

  protected constructor(props: T) {
    this.props = Object.freeze(props);
  }

  equals(other: ValueObject<T>): boolean {
    if (!other) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}

// shared/domain/base.entity.ts
export abstract class BaseEntity<T> {
  protected readonly id: string;
  protected props: T;

  protected constructor(id: string, props: T) {
    this.id = id;
    this.props = props;
  }

  getId(): string {
    return this.id;
  }

  equals(other: BaseEntity<T>): boolean {
    if (!other) return false;
    return this.id === other.getId();
  }
}

// shared/domain/aggregate-root.ts
import type { DomainEvent } from './domain-event';

export abstract class AggregateRoot<T> extends BaseEntity<T> {
  private domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  getDomainEvents(): DomainEvent[] {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents = [];
  }
}

// shared/domain/domain-event.ts
export abstract class DomainEvent {
  readonly occurredAt: Date;
  abstract readonly eventName: string;

  protected constructor() {
    this.occurredAt = new Date();
  }
}
```

### 5.2 Value Objects

```typescript
// modules/catalog/domain/value-objects/money.vo.ts
export class Money extends ValueObject<{ amount: number; currency: string }> {
  private constructor(amount: number, currency: string) {
    super({ amount, currency });
  }

  static create(amount: number, currency: string = 'UZS'): Money {
    if (amount < 0) {
      throw new DomainError('Money amount cannot be negative');
    }
    // UZS не имеет дробной части
    if (currency === 'UZS' && !Number.isInteger(amount)) {
      throw new DomainError('UZS amount must be integer');
    }
    return new Money(amount, currency);
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.create(this.amount + other.amount, this.currency);
  }

  multiply(quantity: number): Money {
    return Money.create(Math.round(this.amount * quantity), this.currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new DomainError(`Cannot operate on different currencies: ${this.currency} vs ${other.currency}`);
    }
  }
}

// modules/catalog/domain/value-objects/ikpu.vo.ts
export class Ikpu extends ValueObject<{ code: string }> {
  private static readonly VALID_PATTERN = /^\d{17}$/;

  private constructor(code: string) {
    super({ code });
  }

  static create(code: string): Ikpu {
    if (!Ikpu.VALID_PATTERN.test(code)) {
      throw new DomainError(`Invalid IKPU code: ${code}. Must be 17 digits.`);
    }
    if (code === '00000000000000000') {
      throw new DomainError('Default IKPU code is not allowed. Provide a real IKPU.');
    }
    return new Ikpu(code);
  }

  get code(): string {
    return this.props.code;
  }
}

// modules/iam/domain/value-objects/telegram-id.vo.ts
export class TelegramId extends ValueObject<{ value: number }> {
  private constructor(value: number) {
    super({ value });
  }

  static create(value: number): TelegramId {
    if (!Number.isInteger(value) || value <= 0) {
      throw new DomainError('TelegramId must be a positive integer');
    }
    return new TelegramId(value);
  }

  get value(): number {
    return this.props.value;
  }
}
```

### 5.3 Entities & Aggregates

```typescript
// modules/ordering/domain/entities/order.entity.ts (Aggregate Root)
import type { OrderItem } from './order-item.entity';
import type { Money } from '../../catalog/domain/value-objects/money.vo';
import { OrderCreatedEvent } from '../events/order-created.event';
import { OrderCancelledEvent } from '../events/order-cancelled.event';

interface OrderProps {
  pharmacyId: string;
  buyerId: string;
  items: OrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: Money;
  deliveryAddress: string;
  contactPhone: string;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Order extends AggregateRoot<OrderProps> {
  private constructor(id: string, props: OrderProps) {
    super(id, props);
  }

  // Factory method — единственный способ создать Order
  static create(params: {
    id: string;
    pharmacyId: string;
    buyerId: string;
    items: OrderItem[];
    deliveryAddress: string;
    contactPhone: string;
    comment?: string;
  }): Order {
    if (params.items.length === 0) {
      throw new DomainError('Order must have at least one item');
    }

    const totalAmount = params.items.reduce(
      (sum, item) => sum.add(item.getSubtotal()),
      Money.create(0),
    );

    const order = new Order(params.id, {
      pharmacyId: params.pharmacyId,
      buyerId: params.buyerId,
      items: params.items,
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      totalAmount,
      deliveryAddress: params.deliveryAddress,
      contactPhone: params.contactPhone,
      comment: params.comment,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    order.addDomainEvent(new OrderCreatedEvent({
      orderId: order.id,
      pharmacyId: params.pharmacyId,
      buyerId: params.buyerId,
      items: params.items.map((item) => ({
        productId: item.getProductId(),
        quantity: item.getQuantity(),
      })),
      totalAmount: totalAmount.amount,
    }));

    return order;
  }

  // Бизнес-методы с правилами
  confirm(): void {
    if (this.props.status !== OrderStatus.PENDING) {
      throw new DomainError(`Cannot confirm order in status ${this.props.status}`);
    }
    this.props.status = OrderStatus.CONFIRMED;
    this.props.paymentStatus = PaymentStatus.PAID;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new OrderConfirmedEvent({
      orderId: this.id,
      pharmacyId: this.props.pharmacyId,
    }));
  }

  cancel(reason?: string): void {
    const cancellableStatuses = [OrderStatus.PENDING, OrderStatus.CONFIRMED];
    if (!cancellableStatuses.includes(this.props.status)) {
      throw new DomainError(`Cannot cancel order in status ${this.props.status}`);
    }

    this.props.status = OrderStatus.CANCELLED;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new OrderCancelledEvent({
      orderId: this.id,
      pharmacyId: this.props.pharmacyId,
      items: this.props.items.map((item) => ({
        productId: item.getProductId(),
        quantity: item.getQuantity(),
      })),
      reason,
    }));
  }

  updateStatus(newStatus: OrderStatus): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.READY],
      [OrderStatus.READY]: [OrderStatus.DELIVERING],
      [OrderStatus.DELIVERING]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    const allowed = validTransitions[this.props.status];
    if (!allowed?.includes(newStatus)) {
      throw new DomainError(
        `Invalid status transition: ${this.props.status} → ${newStatus}`,
      );
    }

    this.props.status = newStatus;
    this.props.updatedAt = new Date();
  }

  // Getters (read-only)
  get pharmacyId(): string { return this.props.pharmacyId; }
  get buyerId(): string { return this.props.buyerId; }
  get status(): OrderStatus { return this.props.status; }
  get totalAmount(): Money { return this.props.totalAmount; }
  get items(): readonly OrderItem[] { return this.props.items; }
}
```

### 5.4 Repository (Port + Adapter)

```typescript
// modules/ordering/domain/repositories/order.repository.ts (PORT — interface)
export interface OrderRepository {
  findById(id: string): Promise<Order | undefined>;
  findByBuyerId(buyerId: string, pagination: Pagination): Promise<PaginatedResult<Order>>;
  findByPharmacyId(pharmacyId: string, pagination: Pagination): Promise<PaginatedResult<Order>>;
  save(order: Order): Promise<void>;
}

// Символ для NestJS DI
export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
```

```typescript
// modules/ordering/infrastructure/persistence/prisma-order.repository.ts (ADAPTER)
import { Injectable } from '@nestjs/common';
import type { OrderRepository } from '../../domain/repositories/order.repository';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { OrderMapper } from './mappers/order.mapper';

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Order | undefined> {
    const record = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    return record ? OrderMapper.toDomain(record) : undefined;
  }

  async save(order: Order): Promise<void> {
    const data = OrderMapper.toPersistence(order);

    await this.prisma.$transaction(async (tx) => {
      await tx.order.upsert({
        where: { id: order.getId() },
        create: data,
        update: data,
      });
    });
  }
}
```

### 5.5 Command Handler (Application Layer)

```typescript
// modules/ordering/application/commands/place-order.handler.ts
import { CommandHandler, EventBus } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PlaceOrderCommand } from './place-order.command';
import { ORDER_REPOSITORY } from '../../domain/repositories/order.repository';
import type { OrderRepository } from '../../domain/repositories/order.repository';
import { PRODUCT_REPOSITORY } from '../../../catalog/domain/repositories/product.repository';
import type { ProductRepository } from '../../../catalog/domain/repositories/product.repository';

@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements ICommandHandler<PlaceOrderCommand> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepo: OrderRepository,
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: ProductRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: PlaceOrderCommand): Promise<string> {
    // 1. Загрузить товары и проверить доступность
    const products = await this.productRepo.findByIds(command.items.map((i) => i.productId));

    for (const item of command.items) {
      const product = products.find((p) => p.getId() === item.productId);
      if (!product) {
        throw new NotFoundError(`Product ${item.productId} not found`);
      }
      if (!product.isAvailable()) {
        throw new DomainError(`Product ${product.getName()} is not available`);
      }
      if (!product.hasEnoughStock(item.quantity)) {
        throw new DomainError(`Insufficient stock for ${product.getName()}`);
      }
    }

    // 2. Создать OrderItems
    const orderItems = command.items.map((item) => {
      const product = products.find((p) => p.getId() === item.productId)!;
      return OrderItem.create({
        productId: product.getId(),
        productName: product.getName(),
        quantity: item.quantity,
        priceAtTime: product.getPrice(),
      });
    });

    // 3. Создать Order (Aggregate Root)
    const order = Order.create({
      id: generateCuid(),
      pharmacyId: command.pharmacyId,
      buyerId: command.buyerId,
      items: orderItems,
      deliveryAddress: command.deliveryAddress,
      contactPhone: command.contactPhone,
      comment: command.comment,
    });

    // 4. Сохранить
    await this.orderRepo.save(order);

    // 5. Опубликовать Domain Events (OrderCreated → DecrementStock, CreateInvoice)
    const events = order.getDomainEvents();
    order.clearDomainEvents();
    for (const event of events) {
      this.eventBus.publish(event);
    }

    return order.getId();
  }
}
```

### 5.6 Event Handler (Cross-Context Communication)

```typescript
// modules/catalog/application/event-handlers/on-order-created.handler.ts
import { EventsHandler } from '@nestjs/cqrs';
import type { IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { OrderCreatedEvent } from '../../../ordering/domain/events/order-created.event';
import { PRODUCT_REPOSITORY } from '../../domain/repositories/product.repository';
import type { ProductRepository } from '../../domain/repositories/product.repository';

@EventsHandler(OrderCreatedEvent)
export class OnOrderCreatedDecrementStock implements IEventHandler<OrderCreatedEvent> {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: ProductRepository,
  ) {}

  async handle(event: OrderCreatedEvent): Promise<void> {
    for (const item of event.items) {
      const product = await this.productRepo.findById(item.productId);
      if (product) {
        product.decrementStock(item.quantity);
        await this.productRepo.save(product);
      }
    }
  }
}
```

---

## 6. МУЛЬТИТЕНАНТ — Архитектура

### 6.1 Подход: Row-Level Isolation + Middleware

```
Request → TelegramAuthGuard → TenantInterceptor → Controller → Service → Repository
                                      │
                                      ▼
                              AsyncLocalStorage
                              { pharmacyId: 'xxx' }
                                      │
                                      ▼
                              Repository.findAll()
                              WHERE pharmacy_id = 'xxx'  ← автоматически
```

### 6.2 TenantContext

```typescript
// shared/infrastructure/tenant/tenant.context.ts
import { AsyncLocalStorage } from 'async_hooks';

interface TenantStore {
  pharmacyId: string;
  userId: string;
  userRole: UserRole;
}

export class TenantContext {
  private static storage = new AsyncLocalStorage<TenantStore>();

  static run<T>(store: TenantStore, callback: () => T): T {
    return TenantContext.storage.run(store, callback);
  }

  static getPharmacyId(): string | undefined {
    return TenantContext.storage.getStore()?.pharmacyId;
  }

  static getUserId(): string {
    const userId = TenantContext.storage.getStore()?.userId;
    if (!userId) throw new Error('TenantContext: userId not set');
    return userId;
  }

  static requirePharmacyId(): string {
    const pharmacyId = TenantContext.getPharmacyId();
    if (!pharmacyId) throw new ForbiddenError('Pharmacy context required');
    return pharmacyId;
  }
}
```

### 6.3 TenantInterceptor

```typescript
// shared/infrastructure/tenant/tenant.interceptor.ts
import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { TenantContext } from './tenant.context';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Set by AuthGuard

    const store = {
      userId: user.id,
      userRole: user.role,
      pharmacyId: user.pharmacyId, // For PHARMACY_OWNER
    };

    return new Observable((subscriber) => {
      TenantContext.run(store, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
```

### 6.4 Tenant-Scoped Repository

```typescript
// modules/catalog/infrastructure/persistence/prisma-product.repository.ts
@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: Pagination): Promise<PaginatedResult<Product>> {
    const pharmacyId = TenantContext.requirePharmacyId();

    const [records, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { pharmacyId },    // Автоматическая фильтрация по тенанту
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where: { pharmacyId } }),
    ]);

    return {
      items: records.map(ProductMapper.toDomain),
      total,
      ...pagination,
    };
  }
}
```

### 6.5 Роли и доступ

| Роль | Видит | Scope |
|------|-------|-------|
| **USER (Buyer)** | Опубликованные товары всех аптек, свои заказы | Global (catalog), Own (orders) |
| **PHARMACY_OWNER** | Свои товары, заказы своей аптеки, свои настройки | Scoped by pharmacyId |
| **ADMIN** | Всё (модерация, аналитика) | Global — но через JWT auth, не через сломанный token |

---

## 7. АВТОРИЗАЦИЯ

### 7.1 Стратегии

```typescript
// Покупатели и владельцы аптек — Telegram initData
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const initData = request.headers['x-telegram-initdata'];

    if (!initData) throw new UnauthorizedError('Missing Telegram initData');

    // Валидация HMAC подписи
    const validated = validateTelegramInitData(initData, this.botToken);
    if (!validated) throw new UnauthorizedError('Invalid Telegram initData');

    // Проверка TTL (configurable, default 24h)
    if (isExpired(validated, this.config.INIT_DATA_TTL_SECONDS)) {
      throw new UnauthorizedError('Telegram initData expired');
    }

    request.user = await this.userService.findOrCreate(validated.user);
    return true;
  }
}

// Админы — JWT (bcrypt + access/refresh tokens)
@Injectable()
export class JwtAuthGuard implements CanActivate {
  // Standard JWT validation with bcrypt password hashing
  // Refresh token rotation
  // Rate limiting on login endpoint
}
```

---

## 8. ПЛАТЕЖИ (Multicard + OFD)

### 8.1 Payment Flow (исправленный)

```
1. Buyer → POST /orders          → PlaceOrderHandler
                                      → Order.create() → OrderCreatedEvent

2. OrderCreatedEvent → OnOrderCreated → DecrementStock (Catalog)
                     → OnOrderCreated → CreateInvoice (Payment)

3. CreateInvoiceHandler:
   a. Load pharmacy Multicard credentials
   b. Validate IKPU for each item (NO default zeros)
   c. Create Payment entity (status: PENDING)
   d. Call Multicard API (with idempotency key)
   e. If OK → save checkoutUrl
   f. If FAIL → Payment.markFailed()

4. Buyer pays via Multicard checkout page

5. Multicard → POST /payments/callback
   ProcessCallbackHandler:
   a. Verify MD5 signature (per-pharmacy secret)
   b. BEGIN TRANSACTION:
      - Find payment WHERE invoiceId = ? AND status != 'PAID'  ← fix race condition
      - If no rows → already processed, return OK
      - Update payment (PAID, receipt data)
      - Publish PaymentConfirmedEvent
   c. COMMIT

6. PaymentConfirmedEvent → OnPaymentConfirmed → Order.confirm()
                         → OnPaymentConfirmed → NotifyBuyer
                         → OnPaymentConfirmed → NotifyPharmacy
```

### 8.2 Исправления vs v1

| Проблема v1 | Решение v2 |
|---|---|
| Race condition (check вне транзакции) | `WHERE status != 'PAID'` внутри транзакции |
| Default IKPU `00000000000000000` | Ikpu Value Object с валидацией, блокирует нули |
| VAT 0 исключается | Явная отправка `vat: 0` для zero-rated |
| No IP whitelist on callback | NestJS Guard с IP whitelist для Multicard |
| No stock management | Domain Events: OrderCreated → DecrementStock |
| Payment status leak | Ownership check через `buyerId` в query handler |
| Credentials в plaintext | Encrypted at rest (AES-256), masked в API response |
| No reconciliation | Cron job: проверка pending payments через `getInvoiceStatus` |
| CASCADE delete payments | `onDelete: Restrict` на Pharmacy → Payment |

---

## 9. DATABASE SCHEMA v2

### 9.1 Ключевые изменения vs v1

```prisma
// Все денежные поля — единый Decimal(15,2)
// Все tenant-scoped таблицы — обязательный pharmacyId с FK
// Soft delete на критических таблицах
// Недостающие индексы добавлены

model Pharmacy {
  id                 String    @id @default(cuid())
  ownerId            String    @unique
  owner              User      @relation(fields: [ownerId], references: [id], onDelete: Restrict)

  name               String
  slug               String    @unique
  description        String?
  address            String
  phone              String
  license            String?
  logo               String?

  // Multicard — encrypted at rest
  multicardAppId     String?
  multicardStoreId   String?
  multicardSecret    String?   // AES-256 encrypted

  isActive           Boolean   @default(false)
  isVerified         Boolean   @default(false)
  subscriptionPlan   SubscriptionPlan @default(FREE)

  // Soft delete
  deletedAt          DateTime?

  products           Product[]
  orders             Order[]
  payments           Payment[]

  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  @@index([slug])
  @@index([isActive, isVerified])
}

model Product {
  id                 String    @id @default(cuid())
  pharmacyId         String
  pharmacy           Pharmacy  @relation(fields: [pharmacyId], references: [id], onDelete: Restrict)

  name               String
  description        String?
  activeSubstance    String?
  manufacturer       String?
  price              Decimal   @db.Decimal(15, 2)  // Единый precision
  imageUrl           String?

  // OFD
  ikpu               String?   // Validated 17-digit code
  packageCode        String?
  vat                Int?      // Explicit 0 allowed

  // Stock
  stock              Int       @default(0)
  isAvailable        Boolean   @default(true)
  requiresPrescription Boolean @default(false)

  // Moderation
  status             ProductStatus @default(DRAFT)
  moderatedBy        String?
  moderatedAt        DateTime?
  moderationNote     String?

  // Soft delete
  deletedAt          DateTime?

  orderItems         OrderItem[]

  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  @@index([pharmacyId, status])
  @@index([pharmacyId, isAvailable])
  @@index([name])                    // Для text search
  @@index([activeSubstance])
  @@index([status, createdAt])       // Для модерации
}

model Order {
  id                 String    @id @default(cuid())
  pharmacyId         String
  pharmacy           Pharmacy  @relation(fields: [pharmacyId], references: [id], onDelete: Restrict)
  buyerId            String
  buyer              User      @relation(fields: [buyerId], references: [id], onDelete: Restrict)

  status             OrderStatus     @default(PENDING)
  paymentStatus      PaymentStatus   @default(PENDING)
  totalAmount        Decimal         @db.Decimal(15, 2)  // Единый precision

  deliveryType       DeliveryType    @default(PICKUP)
  deliveryAddress    String?
  contactPhone       String
  comment            String?

  items              OrderItem[]
  payments           Payment[]

  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  @@index([buyerId, createdAt])
  @@index([pharmacyId, status])
  @@index([paymentStatus])
  @@index([createdAt])               // Для аналитики
}

model Payment {
  id                 String    @id @default(cuid())
  orderId            String
  order              Order     @relation(fields: [orderId], references: [id], onDelete: Restrict)
  pharmacyId         String
  pharmacy           Pharmacy  @relation(fields: [pharmacyId], references: [id], onDelete: Restrict)

  provider           PaymentProvider @default(MULTICARD)
  status             PaymentStatus   @default(PENDING)
  amount             Decimal         @db.Decimal(15, 2)

  // Multicard data
  invoiceId          String?   @unique
  checkoutUrl        String?

  // Confirmation data
  transactionId      String?
  cardPan            String?
  receiptUrl         String?

  paidAt             DateTime?

  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  @@index([invoiceId])
  @@index([pharmacyId, status])
  @@index([orderId])
}
```

---

## 10. ПЛАН РЕАЛИЗАЦИИ

### Фаза 0: Foundation (1 день)

- [ ] Создать репо `temrjan/dorify-v2`
- [ ] Настроить pnpm workspace
- [ ] Scaffold NestJS app (`nest new`)
- [ ] Prisma schema (миграция из v1 + исправления)
- [ ] Shared Kernel: BaseEntity, AggregateRoot, ValueObject, DomainEvent
- [ ] PrismaModule, ConfigModule
- [ ] Docker Compose (dev)
- [ ] ESLint + Prettier
- [ ] CI: lint + type-check

### Фаза 1: IAM Module (2-3 дня)

- [ ] Domain: User entity, Pharmacy entity
- [ ] Value Objects: TelegramId, PhoneNumber, UserRole
- [ ] Infrastructure: TelegramAuthGuard (HMAC validation)
- [ ] Infrastructure: JwtAuthGuard (bcrypt + JWT для админов)
- [ ] TenantContext (AsyncLocalStorage) + TenantInterceptor
- [ ] RolesGuard + @Roles() decorator
- [ ] Controllers: POST /auth/telegram, POST /auth/admin/login
- [ ] Controllers: GET/PUT /pharmacy/profile, POST /pharmacy/register
- [ ] Tests: auth guards, tenant context, pharmacy registration

### Фаза 2: Catalog Module (2-3 дня)

- [ ] Domain: Product entity с поведением (publish, reject, decrementStock, restoreStock)
- [ ] Value Objects: Money, Ikpu, ProductStatus
- [ ] Domain Service: StockDomainService
- [ ] Application: CreateProduct, UpdateProduct, ModerateProduct commands
- [ ] Application: ListProducts, GetProduct, SearchProducts queries
- [ ] Infrastructure: PrismaProductRepository (tenant-scoped)
- [ ] Controllers: pharmacy owner CRUD + admin moderation + public listing
- [ ] Zod validation на все DTO
- [ ] Tests: Product entity (business rules), stock management

### Фаза 3: Ordering Module (3-4 дня)

- [ ] Domain: Order (AggregateRoot) + OrderItem entity
- [ ] Value Objects: OrderStatus (с матрицей переходов)
- [ ] Domain Events: OrderCreated, OrderConfirmed, OrderCancelled
- [ ] Application: PlaceOrder (проверка stock → создание → события)
- [ ] Application: CancelOrder (проверка статуса → отмена → RestoreStock event)
- [ ] Application: UpdateOrderStatus (матрица переходов)
- [ ] Event Handlers: OrderCreated → DecrementStock (cross-context)
- [ ] Event Handlers: OrderCancelled → RestoreStock
- [ ] Controllers: buyer (place, cancel, list), pharmacy owner (list, update status), admin
- [ ] Tests: Order aggregate (state machine), PlaceOrder handler

### Фаза 4: Payment Module (3-4 дня)

- [ ] Domain: Payment entity
- [ ] Value Objects: PaymentStatus, MulticardCredentials, OfdItem
- [ ] Application: CreateInvoice (on OrderCreated event)
- [ ] Application: ProcessCallback (race-condition-safe, inside transaction)
- [ ] Application: ReconcilePayments (cron — check pending via getInvoiceStatus)
- [ ] Infrastructure: MulticardAdapter (API client, token cache)
- [ ] Infrastructure: CallbackIpGuard (whitelist Multicard IPs)
- [ ] Controllers: POST /payments/create, POST /payments/callback, GET /payments/status
- [ ] Pharmacy settings: GET/PUT /pharmacy/payment-settings (masked secret)
- [ ] Event Handlers: PaymentConfirmed → Order.confirm()
- [ ] OFD: validate IKPU, explicit VAT 0
- [ ] Tests: callback processing, idempotency, race conditions

### Фаза 5: Frontend (3-4 дня)

- [ ] Единый стиль: Tailwind (убрать CSS Modules, inline styles)
- [ ] Типизация: убрать все `any`, typed API client
- [ ] Loading/Error states на всех страницах (особенно HomePage)
- [ ] i18n: русский + узбекский
- [ ] Cart store — без изменений (работает хорошо)
- [ ] Pharmacy panel: отдельный `GET /pharmacy/products/:id` вместо fetch-all
- [ ] Response interceptor: error toast, auth expiration
- [ ] Убрать закоммиченные .js/.js.map артефакты
- [ ] .gitignore обновить
- [ ] Тесты: cart store, checkout flow

### Фаза 6: Bot + Notifications (1-2 дня)

- [ ] Grammy bot: register commands, bot.catch() error handler
- [ ] Conversations: pharmacy registration wizard (working, not dead code)
- [ ] Notification module: подписка на Domain Events
  - OrderStatusChanged → Telegram message to buyer
  - PaymentConfirmed → Telegram message to pharmacy owner
  - NewOrder → Telegram message to pharmacy owner
- [ ] Bot health check: HTTP endpoint вместо `pgrep`
- [ ] CI/CD: include bot in build + deploy

### Фаза 7: Search & AI (1-2 дня)

- [ ] Миграция Avi search module из v1
- [ ] NestJS модуль: SearchModule
- [ ] OpenAI Embeddings + pgvector
- [ ] Conversation history

### Фаза 8: Audit + Security + Migrate (2-3 дня)

- [ ] AuditInterceptor: логировать все изменения (используя существующую AuditLog модель)
- [ ] Rate limiting: configurable, per-endpoint
- [ ] Input sanitization (XSS prevention)
- [ ] Multicard secret encryption (AES-256)
- [ ] Data migration script: v1 → v2
  - Users, Pharmacies, Products — direct migration
  - Orders, Payments — archive and migrate (financial data!)
  - Multicard credentials — re-encrypt
- [ ] Параллельный запуск v1 + v2
- [ ] DNS переключение

### Итого: ~18-24 рабочих дня

---

## 11. ТЕСТИРОВАНИЕ

### 11.1 Стратегия

| Уровень | Что тестируем | Coverage Target | Инструмент |
|---------|---------------|-----------------|------------|
| **Unit** | Domain entities, VOs, domain services | 90%+ | Jest |
| **Integration** | Command/Query handlers, repositories | 80%+ | Jest + TestContainers |
| **E2E** | API endpoints (happy + error) | 75%+ | Supertest |
| **Contract** | Multicard API integration | — | Jest + nock |

### 11.2 Пример: Domain Unit Test (без БД)

```typescript
// test/unit/ordering/order.entity.spec.ts
describe('Order', () => {
  it('should create order with correct total', () => {
    const items = [
      OrderItem.create({
        productId: 'prod-1',
        productName: 'Парацетамол',
        quantity: 2,
        priceAtTime: Money.create(15000),
      }),
      OrderItem.create({
        productId: 'prod-2',
        productName: 'Ибупрофен',
        quantity: 1,
        priceAtTime: Money.create(25000),
      }),
    ];

    const order = Order.create({
      id: 'order-1',
      pharmacyId: 'pharmacy-1',
      buyerId: 'user-1',
      items,
      deliveryAddress: 'ул. Навои 1',
      contactPhone: '+998901234567',
    });

    expect(order.totalAmount.amount).toBe(55000); // 15000*2 + 25000
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.getDomainEvents()).toHaveLength(1);
    expect(order.getDomainEvents()[0]).toBeInstanceOf(OrderCreatedEvent);
  });

  it('should not allow cancelling delivered order', () => {
    const order = createTestOrder(); // helper
    order.confirm();
    order.updateStatus(OrderStatus.PREPARING);
    order.updateStatus(OrderStatus.READY);
    order.updateStatus(OrderStatus.DELIVERING);
    order.updateStatus(OrderStatus.DELIVERED);

    expect(() => order.cancel()).toThrow('Cannot cancel order in status DELIVERED');
  });

  it('should enforce valid status transitions', () => {
    const order = createTestOrder();

    expect(() => order.updateStatus(OrderStatus.DELIVERED)).toThrow(
      'Invalid status transition: PENDING → DELIVERED',
    );
  });
});
```

---

## 12. ДЕПЛОЙ

### 12.1 Docker Compose (Production)

```yaml
services:
  dorify-api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql://dorify_user:${DB_PASSWORD}@postgres:5432/dorify_v2_db
      - REDIS_URL=redis://redis:6379/5
      - BOT_TOKEN=${BOT_TOKEN}
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    security_opt: [no-new-privileges:true]
    mem_limit: 256m
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://localhost:3001/health']
      interval: 30s
    networks: [proxy, internal]

  dorify-web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    security_opt: [no-new-privileges:true]
    mem_limit: 30m
    networks: [proxy]

  dorify-bot:
    build:
      context: ./apps/bot
      dockerfile: Dockerfile
    security_opt: [no-new-privileges:true]
    mem_limit: 80m
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://localhost:3002/health']
      interval: 30s
    networks: [internal]
```

### 12.2 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile

      # ALL packages
      - run: pnpm -r run lint
      - run: pnpm -r run type-check
      - run: pnpm -r run test
      - run: pnpm -r run build

  deploy:
    needs: lint-and-test
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy via SSH
        run: |
          ssh 7demo "cd /opt/dorify-v2 && \
            git pull origin main && \
            docker compose build && \
            docker compose up -d && \
            sleep 5 && \
            docker compose ps && \
            curl -sf http://localhost:3001/health || exit 1"
```

---

## 13. МИГРАЦИЯ v1 → v2

### 13.1 Стратегия: Parallel Run

```
Неделя 1-3: Разработка v2
Неделя 4:   Параллельный запуск v1 + v2 (read-only v2)
Неделя 5:   Миграция данных, переключение DNS
```

### 13.2 Скрипт миграции

```
1. pg_dump dorify_db → dorify_v1_backup.sql
2. CREATE DATABASE dorify_v2_db
3. Prisma migrate deploy (создать таблицы v2)
4. INSERT INTO ... SELECT FROM ... (users, pharmacies, products)
5. Migrate orders + payments (financial data — обязательно сохранить!)
6. Re-encrypt Multicard secrets
7. Verify counts match
8. Switch Caddy routes to v2 containers
9. Monitor 24h
10. Decomission v1
```

---

## 14. ОШИБКИ ПРЕДЫДУЩЕГО ПЛАНА (самопроверка)

| # | Ошибка в v1 плане | Исправление в этом документе |
|---|---|---|
| 1 | "DDD пока не нужен" — неверная оценка | DDD нужен: мультитенант, per-pharmacy payments, OFD, модерация = реальная доменная сложность |
| 2 | Фазы "фикс v1" бессмысленны если пишем v2 | Plan = v2 с нуля. V1 фиксы не нужны |
| 3 | "Service Layer" без конкретики | Чёткое разделение: Domain Services vs Application Services vs Infrastructure |
| 4 | Не учтена миграция данных | Фаза 8 включает migration script + parallel run |
| 5 | Не продуман tenant scoping | TenantContext + AsyncLocalStorage + Repository auto-filtering |
| 6 | Тестирование упомянуто вскользь | Конкретная стратегия: unit (domain), integration (handlers), e2e (API) |
| 7 | NestJS не рассматривался | Обоснованный выбор NestJS + Prisma с trade-off анализом |

---

*Качество > Скорость. Этот документ — фундамент для Dorify v2.*
