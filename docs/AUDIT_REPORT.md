# Dorify v2 — Comprehensive Audit Report

**Date:** 2026-05-09
**Auditor:** Claude Code
**Scope:** Backend API, Frontend Web, Telegram Bot, Infrastructure, Security
**Branch:** `main`

> **Note:** Original title — «Dorify v2 (GidStroy)». Auditor periodically
> confused dorify-v2 с gidstroy (related project). False positives отмечены
> ниже:
>
> - **C-CRIT-1** (apps/admin missing) — N/A для dorify, директория не в CI
> - **C-CRIT-2** (Web Dockerfile package name mismatch) — N/A, `@dorify/web` correct
> - **S-MED-5** (ALLOWED_ORIGINS legacy) — N/A, dorify.uz это actual prod
> - **S-LOW-3** (api client legacy fallback) — N/A, dorify.uz это actual prod
> - **PharmacyCreatedEvent missing** — **уже fixed** в PR #29 (Sprint 0 PR-1)
>
> Остальные findings — relevant.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Security Audit](#2-security-audit)
3. [Architecture Review](#3-architecture-review)
4. [Code Review](#4-code-review--bugs--smells)
5. [Priority Action Plan](#5-priority-action-plan)

---

## 1. Executive Summary

Dorify v2 (GidStroy) is a multi-tenant construction marketplace built as a Telegram Mini App. The project demonstrates **solid DDD fundamentals** with rich domain entities, value objects, repository pattern, and domain events. However, there are **critical security vulnerabilities**, **module boundary violations**, and **data integrity risks** that must be addressed before production scaling.

| Area | Grade | Top Risks |
|------|-------|-----------|
| **Security** | 🔴 D+ | Hardcoded credentials, predictable IDs, missing JWT auth, no IP whitelist on callbacks |
| **Architecture** | 🟡 B | Good DDD entities, but cross-module repo imports violate bounded contexts |
| **Code Quality** | 🟡 B- | Clean controllers, but duplicated logic, missing transactions, no error boundaries |
| **Testability** | 🟠 C+ | Domain well tested; application/infra/E2E completely untested |
| **DevOps** | 🟠 C | Missing `apps/admin/`, legacy domain references, package name mismatch |

---

## 2. Security Audit

### 🔴 CRITICAL

#### **S-CRIT-1: Hardcoded Admin Credentials**
**File:** `apps/api/src/modules/iam/application/iam.service.ts:16-17`

```typescript
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('dorify2026!secure', 10);
```

**Impact:** Any attacker with repository access or a compromised backup can authenticate as admin. The password is trivially recoverable from source code.

**Fix:** Move credentials to environment variables or database.

---

#### **S-CRIT-2: Telegram Auth Guard Global, JWT Guard Unused**
**File:** `apps/api/src/modules/iam/iam.module.ts:20-21`

```typescript
{ provide: APP_GUARD, useClass: TelegramAuthGuard },
{ provide: APP_GUARD, useClass: RolesGuard },
```

**Impact:** `JwtAuthGuard` exists but is **not registered as a global guard**. All API endpoints rely solely on Telegram InitData authentication. Admin panel or third-party integrations cannot use JWT-based auth. The `RolesGuard` checks `user.role`, but `TelegramAuthGuard` populates `request.user` directly without JWT issuance.

**Fix:** Implement dual-mode authentication — Telegram InitData for Mini App users, JWT for admin panel and API consumers.

---

#### **S-CRIT-3: Predictable ID Generation via `Math.random()`**
**Files:** `iam.service.ts`, `telegram-auth.guard.ts`, `ordering.service.ts`, `payment.service.ts`, `catalog.service.ts`

```typescript
private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `c${timestamp}${random}`;
}
```

**Impact:** `Math.random()` is **not cryptographically secure**. IDs for users, orders, and payments are predictable, enabling:
- Enumeration of other users' orders (`/orders/:id`)
- Guessing payment IDs
- Predicting user IDs for phishing

**Fix:** Use `crypto.randomUUID()` or `@paralleldrive/cuid2`.

---

#### **S-CRIT-4: Payment Callback — No IP Whitelisting**
**File:** `apps/api/src/modules/payment/infrastructure/controllers/payment.controller.ts:22-38`

The `/payments/callback` endpoint is `@Public()` and open to the entire internet. While MD5 signature verification exists, there is **no IP address validation** against Multicard's server IPs.

**Impact:**
- Callback flooding attacks
- Timing attacks on signature verification
- Log pollution
- Potential replay attacks (no nonce check)

**Fix:** Add IP whitelist for known Multicard callback servers.

---

#### **S-CRIT-5: DomainError Returns 500 Internal Server Error**
**File:** `apps/api/src/core/filters/all-exceptions.filter.ts:52-56`

```typescript
return {
    status: 500,
    message: 'Internal server error',
    errors: undefined,
};
```

**Impact:** All `DomainError` exceptions (business rule violations like "insufficient stock", "invalid status transition") are returned as HTTP 500. This:
- Masks actual server errors from business validation errors
- Prevents frontend from showing meaningful error messages to users
- Violates HTTP semantics (500 = server fault, not client error)

**Fix:** Map `DomainError` to `400 Bad Request` with descriptive messages.

---

### 🟠 HIGH

#### **S-HIGH-1: InitData TTL = 24 Hours**
**File:** `apps/api/src/core/config/env.config.ts:24`

```typescript
INIT_DATA_TTL_SECONDS: z.coerce.number().default(86400),
```

**Impact:** Telegram `initData` is valid for 24 hours. If intercepted (via XSS, network sniffing on insecure WiFi, or compromised browser extension), it can be reused to impersonate the user for a full day. There is no revocation mechanism.

**Fix:** Reduce to 300 seconds (5 minutes). Use JWT for subsequent requests.

---

#### **S-HIGH-2: No Refresh Token Mechanism**
**File:** `apps/api/src/modules/iam/application/iam.service.ts:37-41`

JWT is issued with `expiresIn: 24h` but there is **no refresh token system**. If a token is compromised, the attacker has access for the full duration.

**Fix:** Implement refresh token rotation with Redis-backed revocation.

---

#### **S-HIGH-3: No Idempotency on Order Creation**
**File:** `apps/api/src/modules/ordering/application/ordering.service.ts:23-79`

The `placeOrder` endpoint does not accept or validate an idempotency key. A network timeout or accidental double-submit creates duplicate orders.

**Fix:** Add `Idempotency-Key` header support with Redis-based deduplication.

---

#### **S-HIGH-4: Race Condition in Order Placement**
**File:** `apps/api/src/modules/ordering/application/ordering.service.ts:23-79`

```typescript
const products = await this.productRepo.findByIds(productIds);
// ... stock validation ...
await this.orderRepo.save(order);
```

Stock validation and order creation are **not atomic**. Two concurrent requests can pass stock validation and create orders for the last available item.

**Fix:** Wrap in Prisma `$transaction` with `SELECT FOR UPDATE` on products.

---

#### **S-HIGH-5: `AuthController.getCurrentUser` Returns Empty Strings**
**File:** `apps/api/src/modules/iam/infrastructure/controllers/auth.controller.ts:14-23`

```typescript
return {
    user: {
        id: user.id,
        telegramId: '',      // ← EMPTY
        firstName: '',       // ← EMPTY
        role: user.role,
        pharmacyId: user.pharmacyId,
    },
};
```

**Impact:** `/auth/me` endpoint is broken — frontend cannot display user identity.

---

#### **S-HIGH-6: `UserRole` Leaked from Decorators into Domain**
**File:** `apps/api/src/modules/iam/domain/entities/user.entity.ts:5`

```typescript
import { UserRole } from '@common/decorators/roles.decorator';
```

`UserRole` is defined in the infrastructure layer (`@common/decorators`) but imported into the domain layer. This violates the dependency rule of Clean/Hexagonal Architecture.

---

#### **S-HIGH-7: `TenantContext` (Infrastructure) Used in Application Layer**
**File:** `apps/api/src/modules/catalog/application/catalog.service.ts:7`

`TenantContext` (which uses Node.js `AsyncLocalStorage`) is imported directly into application services. The application layer depends on infrastructure, violating the dependency rule.

**Fix:** Define a `TenantContext` port/interface in the application layer; provide the `AsyncLocalStorage` implementation in infrastructure.

---

### 🟡 MEDIUM

#### **S-MED-1: `expiresIn` Type Cast in JWT Signing**
**File:** `apps/api/src/modules/iam/application/iam.service.ts:37-41`

```typescript
{ expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
```

Type cast hides potential runtime errors if `JWT_EXPIRES_IN` is malformed.

---

#### **S-MED-2: No Algorithm Specified in JWT Sign/Verify**
JWT signing and verification do not explicitly specify `algorithm: 'HS256'`. While the default is HS256, this is a potential vector for algorithm confusion attacks.

---

#### **S-MED-3: Callback Returns 200 on All Cases Without Alerting**
While returning 200 to stop Multicard retries is correct, invalid signature attempts are only logged at `warn` level. There is no alerting or rate limiting on failed callbacks.

---

#### **S-MED-4: `OpenAiEmbeddingAdapter` Reads `process.env` Directly**
**File:** `apps/api/src/modules/search/infrastructure/openai-embedding.adapter.ts:14`

Violates the unified configuration approach (Zod schema in `env.config.ts`).

---

#### **S-MED-5: `ALLOWED_ORIGINS` Default Contains Legacy Domains**
**File:** `apps/api/src/core/config/env.config.ts:14-16`

```typescript
.default('https://app.dorify.uz,https://pharmacy.dorify.uz,https://admin.dorify.uz')
```

Legacy `dorify.uz` domains in the new `gidstroy.uz` project.

---

### 🟢 LOW

#### **S-LOW-1: `helmet()` Without CSP Configuration**
**File:** `apps/api/src/main.ts:12`

Default Helmet CSP may block Telegram Mini App embedding. Needs explicit `frame-ancestors` for `*.telegram.org`.

---

#### **S-LOW-2: No Input Sanitization Beyond Zod**
Zod validates format but does not sanitize against ReDoS, XSS payloads in string fields, or Unicode normalization attacks.

---

#### **S-LOW-3: Frontend `apiClient` Fallback to Legacy Domain**
**File:** `apps/web/src/shared/api/client.ts:3`

```typescript
const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.dorify.uz/api/v1';
```

---

## 3. Architecture Review

### 🔴 CRITICAL — Module Boundary Violations

**Direct Cross-Module Repository Imports:**

```
ordering  → catalog (PRODUCT_REPOSITORY)
payment   → ordering (ORDER_REPOSITORY)
payment   → iam (PHARMACY_REPOSITORY)
notification → iam (domain repos)
```

Modules communicate via direct repository imports instead of Domain Events. This violates Bounded Context boundaries and creates tight coupling.

**Fix:** Use Domain Events as the sole cross-context communication mechanism. For reads, implement Query Ports / Read Models.

---

### 🔴 CRITICAL — Missing Domain Event Emissions

| Event | Defined In | Should Be Emitted By | Status |
|-------|-----------|----------------------|--------|
| `ProductCreatedEvent` | `catalog/domain/events/index.ts` | `Product.create()` | **MISSING** |
| `StockDecrementedEvent` | `catalog/domain/events/index.ts` | `Product.decrementStock()` | **MISSING** |
| `StockRestoredEvent` | `catalog/domain/events/index.ts` | `Product.restoreStock()` | **MISSING** |

**Fix:** Add `this.addDomainEvent(...)` calls in entity methods.

---

### 🟠 HIGH — Application Layer Issues

#### **A-HIGH-1: `IamService` Contains Infrastructure Concerns**
JWT signing (`jsonwebtoken`) and bcrypt hashing live in the application service. These should be in infrastructure adapters (`AuthTokenService`, `PasswordHasher`).

---

#### **A-HIGH-2: `createPharmacy` Without Database Transaction**
**File:** `apps/api/src/modules/iam/application/iam.service.ts:49-82`

```typescript
await this.pharmacyRepo.save(pharmacy);
// If this fails, we have an orphan pharmacy
await this.userRepo.save(user);
```

**Fix:** Wrap in Prisma `$transaction`.

---

#### **A-HIGH-3: `Order.confirm()` Knows About Payment Status**
**File:** `apps/api/src/modules/ordering/domain/entities/order.entity.ts:122-135`

```typescript
this.props.paymentStatus = PaymentStatus.PAID;
```

The `Order` aggregate should not know about `PaymentStatus`. Cross-aggregate consistency should be event-driven.

---

### 🟡 MEDIUM — Data Integrity

#### **A-MED-1: `PrismaOrderRepository.save()` — Items Not Synced on Update**
The `items: { create: ... }` clause only handles creation. If an order is modified, items are not synchronized.

#### **A-MED-2: Soft Delete Declared but Unused**
`deletedAt` exists in Prisma schema for `Product` and `Pharmacy`, but repositories do not set this field.

#### **A-MED-3: `generateCuid()` Duplicated in 5+ Files**
Violation of DRY. Should be centralized behind an `IdGenerator` port in shared domain.

---

### 🟢 LOW

#### **A-LOW-1: `AuthController.getCurrentUser` Returns Empty Strings**
Endpoint is unfinished — hardcoded empty `telegramId` and `firstName`.

#### **A-LOW-2: `CatalogService.createProduct` Hardcodes Moderation Step**
```typescript
product.submitForModeration();
```

This workflow step is implicit in the application layer rather than being a domain invariant or configurable policy.

---

## 4. Code Review — Bugs & Smells

### 🔴 CRITICAL

#### **C-CRIT-1: `apps/admin` Directory Does Not Exist**
The CI/CD pipeline (`ci.yml`) and `Dockerfile.caddy` (Stage 2) attempt to build `apps/admin/`, but the directory does not exist in the repository. This will cause build failures.

#### **C-CRIT-2: Package Name Mismatch in Web Dockerfile**
**File:** `apps/web/Dockerfile`

```dockerfile
pnpm install --filter @dorify/web
```

Actual package name: `@gidstroy/web`. Build will fail.

---

### 🟠 HIGH

#### **C-HIGH-1: Frontend Cart Does Not Enforce Stock Limits**
**File:** `apps/web/src/shared/stores/cartStore.ts`

`addItem` does not check total cart quantity against `product.stock`. A user can add 5, leave, and add 5 more — cart holds 10 even if stock is 5.

#### **C-HIGH-2: Checkout `navigate()` Called During Render**
**File:** `apps/web/src/pages/checkout/CheckoutPage.tsx`

```typescript
if (cartIsEmpty) navigate('/cart');
```

Calling `navigate` during render is a React anti-pattern. Can cause infinite loops or race conditions. Should be in `useEffect`.

#### **C-HIGH-3: Search Debounce Missing on HomePage**
Every keystroke updates the `useQuery` key and fires an API request. `ProductsListPage` has debounce; `HomePage` and `SearchPage` do not.

---

### 🟡 MEDIUM

#### **C-MED-1: `DomainError` Mapped to HTTP 500**
Users see "Internal server error" instead of meaningful validation messages.

#### **C-MED-2: Payment Polling Logic Is Fragile**
**File:** `apps/web/src/pages/payment/PaymentResultPage.tsx`

`refetchInterval` depends on `Date.now() - pollingStarted`, but `pollingStarted` is a state variable that resets on remount.

#### **C-MED-3: No Global Error Boundary**
Any unhandled React error unmounts the entire Mini App.

#### **C-MED-4: Categories Hardcoded in Frontend**
Adding a category on the backend requires a frontend code change + redeploy.

#### **C-MED-5: `@twa-dev/sdk` Is a Dead Dependency**
Listed in `package.json` but never imported. All Telegram API access uses global `window.Telegram.WebApp`.

---

### 🟢 LOW

#### **C-LOW-1: No 404 / Catch-All Route**
Unknown routes fall through silently.

#### **C-LOW-2: `PhoneNumber` Prefill Only Sets `+998`**
Does not use actual Telegram user phone (not available in `initDataUnsafe.user`).

---

## 5. Priority Action Plan

### Phase 1 — Security (Immediate — Before Production)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 1.1 | Remove hardcoded admin credentials from source code | `iam.service.ts` | 30 min |
| 1.2 | Replace `Math.random()` with `crypto.randomUUID()` | 5 files | 30 min |
| 1.3 | Reduce `INIT_DATA_TTL_SECONDS` from 86400 to 300 | `env.config.ts` | 5 min |
| 1.4 | Implement dual-mode auth: Telegram InitData + JWT | `iam.module.ts`, guards | 4h |
| 1.5 | Add `DomainError` → 400 mapping in exception filter | `all-exceptions.filter.ts` | 30 min |
| 1.6 | Add IP whitelist to payment callback endpoint | `payment.controller.ts` | 1h |
| 1.7 | Wrap `placeOrder` in DB transaction with `FOR UPDATE` | `ordering.service.ts` | 2h |
| 1.8 | Add idempotency key support for order creation | `ordering.service.ts`, Redis | 4h |
| 1.9 | Add refresh token mechanism | `iam.service.ts`, Redis | 4h |

### Phase 2 — Architecture (Sprint 1)

| # | Task | Effort |
|---|------|--------|
| 2.1 | Move `UserRole` to domain layer (`iam/domain/enums/`) | 1h |
| 2.2 | Create `TenantContext` port/interface in application layer | 2h |
| 2.3 | Emit missing domain events from entity methods | 1h |
| 2.4 | Remove direct cross-module repository imports | 8h |
| 2.5 | Extract JWT/bcrypt to infrastructure adapters | 2h |
| 2.6 | Centralize `IdGenerator` behind shared domain port | 1h |
| 2.7 | Fix `Order.confirm()` — remove `paymentStatus` mutation | 1h |

### Phase 3 — Stability & DevOps (Sprint 2)

| # | Task | Effort |
|---|------|--------|
| 3.1 | Fix missing `apps/admin/` — create or remove from CI | 2h |
| 3.2 | Fix web Dockerfile package name (`@dorify/web` → `@gidstroy/web`) | 5 min |
| 3.3 | Add search debounce on HomePage | 30 min |
| 3.4 | Fix checkout `navigate()` — move to `useEffect` | 30 min |
| 3.5 | Add React global error boundary | 1h |
| 3.6 | Add application service tests with mocked repos | 16h |
| 3.7 | Add E2E tests for critical flow (place order → pay → confirm) | 8h |
| 3.8 | Clean up legacy `dorify` references across codebase | 2h |

---

## Appendix A: Cross-Module Dependency Map

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    IAM      │◄────│   Payment   │◄────│  Ordering   │
│  (users)    │     │  (invoices) │     │  (orders)   │
└──────┬──────┘     └─────────────┘     └──────┬──────┘
       ▲                                         │
       │                                         │
       │         ┌─────────────┐                │
       └─────────┤ Catalog     │◄───────────────┘
                 │ (products)  │   (direct repo import)
                 └─────────────┘
```

**All solid arrows represent direct repository imports that should be replaced with Domain Events.**

---

## Appendix B: Event Emission Status

| Event | Emitter | Status |
|-------|---------|--------|
| `OrderCreatedEvent` | `Order.create()` | ✅ Emitted |
| `OrderConfirmedEvent` | `Order.confirm()` | ✅ Emitted |
| `OrderCancelledEvent` | `Order.cancel()` | ✅ Emitted |
| `PaymentConfirmedEvent` | `PaymentService.processCallback()` | ✅ Emitted (manual) |
| `ProductCreatedEvent` | `Product.create()` | ❌ **MISSING** |
| `StockDecrementedEvent` | `Product.decrementStock()` | ❌ **MISSING** |
| `StockRestoredEvent` | `Product.restoreStock()` | ❌ **MISSING** |
| `PharmacyCreatedEvent` | `Pharmacy.create()` | ❌ **MISSING** |
| `UserRegisteredEvent` | `User.create()` | ❌ **MISSING** |

---

*Report generated by Claude Code. For questions or clarifications, consult the detailed findings above or run targeted code searches.*
