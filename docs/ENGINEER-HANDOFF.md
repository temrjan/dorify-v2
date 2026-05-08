# Engineer Handoff — Dorify v2

> Read this **first** in any new Engineer session per `docs/TEAM-CONSTITUTION.md` §0.6.
> Updated: 2026-05-08.
>
> **Note:** ссылки на `docs/TEAM-CONSTITUTION.md`, `docs/MULTICARD_API_DOCUMENTATION.md` и `REVIEWER-LOG.md` могут быть untracked в этом коммите — будут добавлены отдельным PR.

---

## TL;DR

**Project:** Multi-tenant аптечный маркетплейс (Telegram Mini App). Миграция Express MVC v1 → NestJS DDD v2.
**State:** `idle`. Production v2 впервые задеплоен 2026-05-07. На 7demo prod-БД пустая.
**Just shipped:** AES-256-GCM encryption + real Multicard adapter (PR #4).
**Next concrete deliverable:** Phase 4 closure — OFD order-time validation + reconciliation cron + IP whitelist callback guard + JwtAuthGuard wire.
**Captain language:** русский. Выдаёт directive-style. Устаёт от ceremony — сам triggers `/selfcheck` если нужна перепроверка.

---

## Iron Laws (выписка из конституции, обязательная для Engineer)

1. **Read `.claude/workflow-state.json` каждый turn.**
2. **No code в `planning` state.** Перед edit prod files — переход в `coding`.
3. **No commit до review clean.** Locally — все 4 gates green.
4. **Approved plan required для `planning → coding`.** Captain explicit approve word ("давай" / "начинай" / "go" / "одобрено").
5. **CI red blocks ship.** При post-merge red — investigate first.
6. **No destructive remote ops без Head approval.** push --force, branch -D, prod data — только с явным «да».
7. **Sequential tool calls only.** Никогда parallel в одном assistant message. Captain explicit override only.

Полная конституция — `docs/TEAM-CONSTITUTION.md` v1.3.

---

## Operating mode (как работать с Captain)

### Tone
- Output язык — русский (Captain's preference).
- Default mode — **simple** (1-2 строки + аналогия + action). Full mode только на security/financial/architectural/explicit «разверни».
- **Запрещены:** «выглядит хорошо», «должно работать», «также», «при этом», эмодзи, восклицательные.
- Сложные термины — простыми словами с аналогиями. Captain ценит «объясни как для бабушки».

### Decision space
- **COMPLY** — clear directive в scope.
- **ASK** — trade-off, scope ambiguity, design choice 2+ phases.
- **DECIDE** — implementation details (naming, formatting, tool choice).
- **DISSENT** — четыре строки: claim / evidence / confidence / what would change my mind. Когда Reviewer's claim contradicts probe или Reviewer drifts в authoring code.

### Captain's known preferences (feedback)
- **Не делай ceremony над micro-chores** (≤10 LOC, no logic). Per Captain explicit override 2026-05-07: «начинай реализацию» — выполнить за один turn без plan-check.
- **Reviewer plan-check для non-trivial PRs** (≥100 LOC, security, payment) — стандартно. Captain может override словом «без ревьюера».
- **Перед push на security-critical diff — `/security-review` skill mandatory** (per Captain directive 2026-05-07).
- **Перед кодом — `/codex` skill** для bootstrap стандартов (workspace CLAUDE.md правило).
- **Atomic commits, conventional prefixes**, Co-Authored-By trailer ОБЯЗАТЕЛЕН.
- **Branch + PR flow для non-trivial.** Direct push в main допустим только с explicit Captain approve.

---

## Project state — phases (per `docs/DORIFY_V2_DDD.md` §10)

| Фаза | Что | Статус (2026-05-08) | Что осталось |
|---|---|---|---|
| 0 | Foundation (repo, pnpm, NestJS, Prisma, CI/CD) | ✅ 100% | — |
| 1 | IAM Module | ⚠️ ~95% | JwtAuthGuard wire (dead code сейчас), admin creds в env вместо hardcode |
| 2 | Catalog Module | ✅ ~95% | StockDomainService — поведение в Product, можно оставить |
| 3 | Ordering Module | ⚠️ ~90% | Admin order controller отсутствует |
| 4 | Payment Module | ⚠️ ~70% | OFD order-time validation, ReconcilePayments cron, CallbackIpGuard, integration tests |
| 5 | Frontend | ⚠️ ~30% | Pharmacy panel (заглушка), `/payment/success` page + polling, i18n, admin SPA |
| 6 | Bot + Notifications | ⚠️ ~50% | Pharmacy registration wizard (Grammy conversations), API↔bot integration |
| 7 | Search (Avi) | ⚠️ ~30% | Qdrant→pgvector переход (Captain decision), Product события chain (Product не AggregateRoot), frontend AI search UI |
| 8 | Audit + Security + Migrate | ⚠️ ~10% | AuditInterceptor, rate limiting, input sanitization, **AES encryption ✅ done**, миграция v1→v2, parallel run, DNS cutover |

**Roadmap до cutover:** ~12-15 рабочих дней (per моя [Tier 1-4 priorities](#priorities-для-cutover)).

---

## Что недавно сделано (последняя сессия 2026-05-07)

5 PR смерджено в один день (с нуля до live в проде):

1. **PR #1** `chore: remove unused @nestjs/cqrs dep + REVIEWER-LOG.md baseline` — cleanup chore.
2. **PR #2** `fix: allow pnpm 10 build scripts + harden CI deploy` — `pnpm.onlyBuiltDependencies` config + `set -e` в CI deploy script.
3. **PR #3** `fix: pin Dockerfile pnpm to v10` — Dockerfile использовал `pnpm@latest` (=11), config field не подхватывался. Pin v10 решило.
4. **PR #4** `feat: AES-256-GCM encryption + real Multicard adapter` — основной feature.

**Production v2 впервые live** на `https://api.dorify.uz/api/v1/health`.

**Incident в этот же день:** ENCRYPTION_KEY env var на сервере не был set до merge → backend crashed в restart loop → 502 на api.dorify.uz. Captain manually добавил ключ в prod `.env` через ssh + `docker compose up -d` → восстановлено.

**Lesson:** action items до merge ENFORCEABLE — не просто listing в PR description. В будущем — фиксить fail-soft fallback ИЛИ blocking pre-merge check на server-side env-vars.

---

## Critical environment

### Production server (7demo)
- SSH alias: `ssh 7demo` (host/port/user/key — в Captain's password manager под «Dorify v2 — 7demo SSH»; в `~/.ssh/config` локально).
- Project path, DB name, Caddy routes — публичные домены: `api.dorify.uz`, `app.dorify.uz`, `dorify.uz`, `admin.dorify.uz`. Конкретные пути/имена БД — в password manager.

**ВАЖНО:** SSH только для логов / диагностики / config-edit. **НЕ ПРАВИТЬ КОД на сервере** — workspace rule. Code только через `git push → CI → CD`.

### Production env vars (на сервере, `.env`)
Названия переменных (значения — в Captain's password manager / GitHub Secrets):
- `DATABASE_URL` — postgres connection
- `JWT_SECRET` — 32+ chars
- `BOT_TOKEN` — Telegram bot
- **`ENCRYPTION_KEY`** — 64 hex chars (32 bytes), set 2026-05-07. **ПОТЕРЯ = unrecoverable secrets.** Хранится в password manager под именем «Dorify v2 — ENCRYPTION_KEY (production)».
- `MULTICARD_API_URL` — default sandbox; для prod merchant-а override на prod URL.
- `MULTICARD_CALLBACK_URL` — opt., default `https://api.dorify.uz/api/v1/payments/callback`.

### Local toolchain
```
nvm use 22                          # Node 22.22.2
corepack prepare pnpm@10 --activate # pnpm 10.33.4 (matches CI)
pnpm install
pnpm --filter @dorify/api prisma:generate
```

---

## Pipeline (workspace rule, без исключений)

```
Локально → git push → CI (lint+test+build) → CD (SSH deploy) → 7demo Production
```

**Iron Law #5:** CI red blocks ship. CI deploy script — `.github/workflows/ci.yml` lines 74-95.

После merge в `main` — auto deploy. Health check `wget -qO- http://localhost:3001/api/v1/health` обязателен.

---

## Skills usage map (project-specific)

| Когда | Skill | Why |
|---|---|---|
| Перед написанием кода | `/codex` | Bootstrap стандартов (`~/Codex/standards/`). Workspace rule. |
| Перед commit/push на security/crypto/payment-critical diff | `/security-review` | Captain directive 2026-05-07. Mandatory для AES, Multicard, auth. |
| После своего предложения, plan, recommendation | `/selfcheck` | Self-critique через 4 категории. Captain triggers explicitly когда нужна перепроверка. |
| Если diff содержит TS код в production paths | `/typescript-review` или `/review` | Cross-cutting review перед commit. |
| Adversarial review плана | `/check` | Pre-implementation review плана. |

Codex стандарты в `~/Codex/standards/`:
- `architecture.md`, `ddd.md`, `nestjs.md` — главные для backend.
- `typescript.md`, `react.md`, `telegram-miniapp.md` — для frontend.
- `pipeline.md`, `devops.md` — для CI/CD.
- `postgresql.md` — для миграций.
- `testing.md` — для unit/integration tests.

---

## Open decisions (Captain's pending)

1. **4.7 frontend payment flow** — deferred. Когда дойдёт до Tier 2 — спроси «redirect Multicard checkout vs embedded?»
2. **Admin SPA** — строить заново vs адаптировать v1. Зависит от приоритета Tier 3.
3. **Pharmacy registration mechanism** — Bot wizard (Grammy conversations) основной канал. Web-based registration через Telegram Mini App — открытый.
4. **Migration v1→v2** — extraction скрипт для users / pharmacies / products / orders / payments + re-encrypt Multicard secrets под новый ENCRYPTION_KEY. План на отдельный sprint в Phase 8.

## Captain decisions log (закрыто на 2026-05-07)

- pgvector (vs Qdrant) — vector store
- service-per-module (vs CQRS) — pattern (не используется `@nestjs/cqrs`, удалён)
- env-vars + JWT wire (vs AdminUser table) — admin auth
- cron-only reconciliation (вариант a)
- AES-256-GCM, key из env — encryption
- OFD optional на Product, validation at order time когда Multicard active
- Multicard signature `MD5(store_id + invoice_id + amount + secret)`, primary source `docs/MULTICARD_API_DOCUMENTATION.md:281`
- Multicard sandbox `dev-mesh.multicard.uz` для CI/dev, prod `mesh.multicard.uz`
- Multicard callback IP whitelist `195.158.26.90` (canonical), env `MULTICARD_CALLBACK_IPS`-overridable

Все decisions — в `REVIEWER-LOG.md` Session 1 как Tier 1 anchor.

---

## Priorities для cutover

**Tier 1: Buyer может купить лекарство (3-4 дня)**
1. ✅ AES + real Multicard backend (PR #4)
2. ⏳ **Frontend `/payment/success` page + polling статуса оплаты** ← **ближайший deliverable**
3. ⏳ OFD order-time validation + reconciliation cron + IP whitelist (объединённый PR)

**Tier 2: Аптека может работать в v2 (5-7 дней)**
4. Pharmacy panel — products CRUD UI (~3 дня, sales-blocking)
5. Pharmacy panel — payment-settings UI (Multicard credentials)
6. Pharmacy panel — orders list + profile edit
7. Bot pharmacy registration wizard (Grammy conversations)

**Tier 3: Админ может работать (3-4 дня)**
8. env-vars admin creds + JwtAuthGuard wire + Admin SPA (login, product moderation, pharmacy verify, orders/payments view)

**Tier 4: Cutover (3 дня)**
9. Data migration script v1→v2 (users / pharmacies / products / orders / payments + re-encrypt Multicard secrets)
10. Параллельный запуск + smoke
11. DNS switch + monitor 24h

---

## Next concrete action (Tier 1 #2 / #3)

Captain предложил Tier 1 #1 завершён. Следующая логичная задача:

**Option A — Tier 1 #2 (frontend payment success page)** ~1 день. Без него backend payment в вакууме, пользователь не может завершить оплату в UI. Зависимость: backend Multicard real (✓ готов).

**Option B — Tier 1 #3 (Phase 4 closure: OFD validation + reconciliation cron + IP whitelist + JWT wire)** ~1-2 дня. Backend-only, не блокирует пользователя на surface, но необходим до cutover. Зависимость: AES + Multicard real (✓ готов).

Recommend **Option B** первым — closure Phase 4 одним блоком, frontend Tier 1 #2 — после.

---

## Files & paths reference

### Backend (`apps/api/`)
- `src/main.ts` — bootstrap, `/api/v1` global prefix
- `src/app.module.ts` — root module
- `src/core/` — config, database, crypto, filters, interceptors
- `src/core/crypto/encryption.service.ts` — AES-256-GCM (use through `@Inject(EncryptionService)`)
- `src/core/config/env.config.ts` — Zod-validated env
- `src/modules/{iam,catalog,ordering,payment,search,notification}/` — bounded contexts
- `src/modules/payment/infrastructure/multicard/multicard.adapter.ts` — реальная HTTP интеграция
- `src/shared/domain/` — BaseEntity, AggregateRoot, ValueObject, DomainEvent, DomainError
- `src/shared/infrastructure/tenant/tenant.context.ts` — AsyncLocalStorage tenant scoping
- `prisma/schema.prisma` — schema (postgres17 + pgvector planned)
- `test/jest-setup.ts` — env vars для tests

### Frontend (`apps/web/`)
- React 19 + Vite + Tailwind + tanstack-query + Zustand
- `src/features/checkout/ui/CheckoutPage.tsx` — нужно integration с `/payment/success`
- `src/features/pharmacy-panel/ui/PharmacyPanelPage.tsx` — заглушка, ждёт Tier 2

### Bot (`apps/bot/`)
- Grammy — minimal с /start /help. Pharmacy wizard ожидается в Tier 2.

### Docs
- `docs/DORIFY_V2_DDD.md` — full design doc, 1525 строк, §10 phase plan
- `docs/MULTICARD_API_DOCUMENTATION.md` — Multicard API reference (line 281 — signature формула)
- `docs/TEAM-CONSTITUTION.md` v1.3 — operating manual
- `docs/ENGINEER-HANDOFF.md` — этот файл
- `REVIEWER-LOG.md` — Reviewer calibration + Captain decisions log

---

## On session start

```bash
# 1. Read state
cat .claude/workflow-state.json

# 2. Read this handoff (this file)

# 3. Read REVIEWER-LOG.md (Captain decisions + Reviewer calibration)
cat REVIEWER-LOG.md

# 4. Skim TEAM-CONSTITUTION.md v1.3 if cold-start

# 5. Confirm to Captain: «контекст загружен, state X, next-up Y, готов»
```

---

*Качество > Скорость. Захендоффим грамотно — следующий Engineer стартует за 5 минут вместо 30.*
