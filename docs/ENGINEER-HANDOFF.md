# Engineer Handoff — Dorify v2

> Read this **first** in any new Engineer session per `docs/TEAM-CONSTITUTION.md` §0.6.
> Updated: **2026-05-08** (Session 2).

---

## ⚡ TL;DR

**Project:** Multi-tenant аптечный маркетплейс (Telegram Mini App). Миграция Express MVC v1 → NestJS DDD v2.
**State:** `idle`. Production v2 live на `api.dorify.uz` + `app.dorify.uz`. БД пустая (нет seed data).
**Captain language:** русский, directive-style. Устаёт от ceremony.
**Last session shipped:** 6 PR (#5–#10) — frontend payment flow, pharmacy products CRUD, CI hardening, bot+CORS hot-fixes.
**Pause taken:** 2026-05-08. **Next session: DESIGN PASS** — UI polish (см. `docs/design/POLISH_PLAN.md`).

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
- **Запрещены:** «выглядит хорошо», «должно работать», «также», «при этом», эмодзи в outputs, восклицательные.
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
- **SSH на сервер — для логов / диагностики / config-edit (env files).** **НЕ для editing код.** В этой сессии Captain explicitly разрешил Engineer SSH-ить для env edits + docker compose ops при ops issues.

---

## Project state — phases (per `docs/DORIFY_V2_DDD.md` §10)

| Фаза | Что | Статус (2026-05-08) | Что осталось |
|---|---|---|---|
| 0 | Foundation (repo, pnpm, NestJS, Prisma, CI/CD) | ✅ 100% | — |
| 1 | IAM Module | ⚠️ ~95% | JwtAuthGuard wire (пока dead code), admin creds в env |
| 2 | Catalog Module | ✅ ~98% | + `getMyProduct` endpoint (PR #8) ✓; status filter в DTO ✓ |
| 3 | Ordering Module | ⚠️ ~90% | Admin order controller отсутствует |
| 4 | Payment Module | ⚠️ ~85% | Frontend payment flow ✓ (PR #6); WEB_URL env ✓; OFD order-time validation, ReconcilePayments cron, CallbackIpGuard, Idempotency-Key + retry в adapter — **остаются** |
| 5 | Frontend | ⚠️ ~60% | Pharmacy products CRUD ✓ (PR #8); `/payment/result` polling ✓ (PR #6); **UI polish ⏳ next session**; pharmacy orders list, payment-settings, profile — TODO; Admin SPA — TODO |
| 6 | Bot + Notifications | ⚠️ ~50% | WEBAPP_URL default fix ✓ (PR #9); pharmacy registration wizard — TODO |
| 7 | Search (Avi) | ⚠️ ~30% | Qdrant→pgvector переход (Captain decision), Product события chain, frontend AI search UI |
| 8 | Audit + Security + Migrate | ⚠️ ~15% | AES encryption ✓; CI resilient deploy ✓ (PR #7); CORS prod-default ✓ (PR #10); миграция v1→v2 — TODO; AuditInterceptor, rate limiting, input sanitization — TODO |

**Roadmap до cutover:** ~10-13 рабочих дней (после design pass + Phase 4 closure + admin SPA + migration).

---

## Что отгружено в этой сессии (Session 2 — 2026-05-08)

| PR | Содержание | Размер |
|---|---|---|
| #5 | `docs: ENGINEER-HANDOFF for cross-session continuity` | +259 LOC |
| #6 | `feat: frontend payment flow with Multicard checkout + status polling` | +235/-6 LOC |
| #7 | `ci: resilient deploy — reset --hard origin/main before docker build` | +6/-1 LOC |
| #8 | `feat: pharmacy products CRUD UI` | +1147/-28 LOC |
| #9 | `fix(bot): default WEBAPP_URL → app.dorify.uz (v2 frontend)` | +1/-1 LOC |
| #10 | `fix(api): default ALLOWED_ORIGINS → production TWA + admin domains` | +5/-2 LOC |

### Хроника инцидентов

1. **CI deploy fail post-PR-#6 merge.** На сервере `/opt/dorify-v2/` имел ручные local-changes от прошлого SSH-вмешательства, `git pull` упал. Recovery: `git reset --hard origin/main && git clean -fd` → manual `docker compose build && up -d`. **Permanent fix:** PR #7 (resilient deploy в CI script).

2. **Bot указывал на v1.** Default `WEBAPP_URL=https://dorify.uz` (v1 landing) в `apps/bot/src/config/index.ts`. Captain заметил smoke-test'ом. **Fix:** PR #9 default → `https://app.dorify.uz`. Также: env _file для bot — `./apps/bot/.env`, **не** общий `/opt/dorify-v2/.env` (см. `docker-compose.yml:39`).

3. **CORS «Network Error» в browser.** Default `ALLOWED_ORIGINS='*'` несовместим с `credentials:true`. На сервере env содержал старый список без `app.dorify.uz`. **Fix env:** Engineer SSH-ом sed-нул env + `docker compose up -d --force-recreate dorify-backend` (`restart` НЕ перечитывает env_file). **Code fix:** PR #10 default → prod-домены явно.

### Производственные доступы (что точно сейчас работает)

- `https://api.dorify.uz/api/v1/health` → `{status:ok,service:dorify-api}`
- `https://app.dorify.uz/` → v2 TWA (HomePage с banner Dorify, search, chips категорий, grid товаров — пустой т.к. БД пустая)
- `https://app.dorify.uz/pharmacy` → 4-card hub
- `https://app.dorify.uz/pharmacy/products` → list page (требует Telegram WebApp + pharmacy_owner в БД, в browser возвращает 401 — норма)
- `https://app.dorify.uz/payment/result?orderId=...` → polling page
- Telegram bot `/start` → кнопки «Открыть маркетплейс» / «Панель аптеки» открывают app.dorify.uz
- CORS allowed origins: `app.dorify.uz`, `pharmacy.dorify.uz`, `admin.dorify.uz`

### Известные функциональные ограничения

- БД пустая. Нет товаров, аптек, юзеров. Smoke test реального flow требует seed.
- Pharmacy panel в обычном браузере недоступен (нет Telegram initData → 401).
- Multi-pharmacy cart на checkout «degraded» — N invoices, не split. Решение — Multicard split-pivot, см. `docs/multicard-1/README.md`.
- Order panel для аптеки и Admin SPA отсутствуют.
- `apps/bot/.env` ≠ `/opt/dorify-v2/.env` — env-edits для бота нужны в первом файле, контейнер требует force-recreate (не restart).

---

## Critical environment

### Production server (7demo)
- SSH alias: `ssh 7demo` (host/port/user/key — в Captain's password manager под «Dorify v2 — 7demo SSH»; в `~/.ssh/config` локально).
- **Engineer может SSH-ить** для логов / docker-ops / env edits. **НЕ для editing кода** — это через git push only.

### Production env vars

**Backend (`/opt/dorify-v2/.env`)** — read by `dorify-backend` контейнер:
- `DATABASE_URL` — postgres connection
- `JWT_SECRET` — 32+ chars
- `BOT_TOKEN` — Telegram bot token (тот же что в `apps/bot/.env`)
- **`ENCRYPTION_KEY`** — 64 hex chars (32 bytes), set 2026-05-07. **ПОТЕРЯ = unrecoverable secrets.** Хранится в password manager.
- `MULTICARD_API_URL` — default sandbox; для prod merchant-а override на prod URL.
- `MULTICARD_CALLBACK_URL` — opt., default `https://api.dorify.uz/api/v1/payments/callback`.
- `WEB_URL` — default `https://app.dorify.uz` (PR #6); фронт-домен куда возвращается user после Multicard checkout.
- `ALLOWED_ORIGINS` — после PR #10 default включает app/pharmacy/admin .dorify.uz; env override опционален.

**Bot (`/opt/dorify-v2/apps/bot/.env`)** — read by `dorify-bot` контейнер:
- `BOT_TOKEN`
- `WEBAPP_URL` — после PR #9 default `https://app.dorify.uz`; явный override желателен.
- `HEALTH_PORT` — default 3002
- `ADMIN_CHAT_IDS`

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

**Iron Law #5:** CI red blocks ship.

CI deploy script (`.github/workflows/ci.yml:74-95`) после PR #7 устойчив к accidental SSH-edits на сервере: `git fetch + reset --hard origin/main + git clean -fd` перед docker build.

После merge в `main` — auto deploy. Health check `wget -qO- http://localhost:3001/api/v1/health` обязателен.

**Ловушка:** `docker compose restart` НЕ перечитывает `env_file`. После env-edit на сервере → `docker compose up -d --force-recreate <service>`.

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

1. **Multicard architectural pivot** — per-pharmacy merchant (current) vs platform-as-merchant + split. Captain выбрал pivot 2026-05-08, **поставил Multicard на паузу** до получения операционных ответов от Multicard support (PDF inquiry на `~/Desktop/marketplace-payment-inquiry.pdf`). См. `docs/multicard-1/README.md`.
2. **Admin SPA** — строить заново vs адаптировать v1.
3. **Pharmacy registration mechanism** — Bot wizard (Grammy conversations) основной канал. Web-based registration через TMA — открытый.
4. **Migration v1→v2** — extraction скрипт. План на отдельный sprint в Phase 8.
5. **Seed data для production** — нужен для real smoke testing. Manual SQL vs proper seed script vs migration v1→v2 — не решено.

## Captain decisions log (closed по 2026-05-08)

- pgvector (vs Qdrant) — vector store
- service-per-module (vs CQRS) — pattern (`@nestjs/cqrs` удалён)
- env-vars + JWT wire (vs AdminUser table) — admin auth
- cron-only reconciliation
- AES-256-GCM, key из env — encryption (PR #4)
- OFD optional на Product, validation at order time когда Multicard active
- Multicard signature `MD5(store_id + invoice_id + amount + secret)` — primary source `docs/MULTICARD_API_DOCUMENTATION.md:281`
- Multicard sandbox `dev-mesh.multicard.uz` для dev, prod `mesh.multicard.uz`
- Multicard callback IP whitelist `195.158.26.90` (canonical), env-overridable
- Frontend payment flow: redirect Multicard checkout (PR #6) — embedded НЕ выбрали
- Pharmacy products CRUD UI: free-form categories с datalist, nested routing, default-all status filter, confirm-dialog delete (PR #8)
- Multicard architectural model: pivot на platform-as-merchant + split (deferred до операционных ответов)

Все decisions — в `REVIEWER-LOG.md`.

---

## Priorities для cutover (после design pass)

**Tier 1: Buyer может купить лекарство**
1. ✅ AES + real Multicard backend (PR #4)
2. ✅ Frontend payment flow (PR #6)
3. ⏳ **Phase 4 closure:** OFD order-time validation + reconciliation cron + IP whitelist guard + Idempotency-Key/retry в adapter (см. `docs/multicard-1/README.md` §8)

**Tier 2: Аптека может работать в v2**
4. ✅ Pharmacy panel — products CRUD UI (PR #8)
5. ⏳ Pharmacy panel — payment-settings UI (Multicard credentials)
6. ⏳ Pharmacy panel — orders list + profile edit
7. ⏳ Bot pharmacy registration wizard (Grammy conversations)

**Tier 3: Админ может работать**
8. ⏳ env-vars admin creds + JwtAuthGuard wire + Admin SPA

**Tier 4: Cutover**
9. ⏳ Data migration script v1→v2
10. ⏳ Параллельный запуск + smoke
11. ⏳ DNS switch + monitor 24h

---

## ⏭ Next session — DESIGN PASS

Captain explicit (2026-05-08, end of session 2):
> «Пауза. Изучи всю документацию ... начнем с дизайна.»

Полный план + scope: **`docs/design/POLISH_PLAN.md`**.

Краткое summary:
- Pages to redesign: HomePage, ProductsListPage, ProductFormPage, PharmacyHomePage, PaymentResultPage, CheckoutPage.
- Components: cards с shadows + hover, status pills с иконками, skeletons вместо Spinner, empty-states с illustration tone.
- Bottom navigation: иконки SF Symbols-style (сейчас есть базовые иконки, можно улучшить).
- Color/typography hierarchy + spacing rhythm.
- НЕ trogать: telegram-ui core (используем как base), backend logic.
- Estimate: ~2-3 дня на качественный pass.

После design pass — снова открыты Tier 1 #3 (Phase 4 closure), Tier 2 #5/#6/#7, Tier 3 #8.

---

## Files & paths reference

### Backend (`apps/api/`)
- `src/main.ts` — bootstrap, CORS (origin: config.ALLOWED_ORIGINS), `/api/v1` global prefix, helmet
- `src/app.module.ts` — root module, ThrottlerModule (100/min globally — может конфликтовать с Multicard callback burst, см. `docs/multicard-1/README.md` §8.4)
- `src/core/config/env.config.ts` — Zod-validated env (после PR #10 ALLOWED_ORIGINS default явный)
- `src/core/crypto/encryption.service.ts` — AES-256-GCM
- `src/modules/{iam,catalog,ordering,payment,search,notification}/` — bounded contexts
- `src/modules/payment/infrastructure/multicard/multicard.adapter.ts` — Multicard HTTP интеграция (без retry/idempotency-key — см. multicard-1 README)
- `src/modules/payment/application/payment.service.ts` — createInvoice + processCallback (race-fix через markPaidAtomically)
- `src/modules/catalog/application/catalog.service.ts` — Pharmacy CRUD; `getMyProduct` (PR #8)
- `src/modules/catalog/infrastructure/controllers/product.controller.ts` — Public/Pharmacy/Admin controllers
- `src/shared/infrastructure/tenant/tenant.context.ts` — AsyncLocalStorage tenant scoping
- `prisma/schema.prisma` — schema

### Frontend (`apps/web/`)
- `src/app/router.tsx` — routes (HomePage, ProductPage, SearchPage, CartPage, CheckoutPage, **PaymentResultPage** (PR #6), OrdersPage, PharmacyPanelPage)
- `src/app/Layout.tsx` — Layout с bottom nav (Главная/Поиск/Корзина/Заказы)
- `src/features/checkout/ui/CheckoutPage.tsx` — single-pharmacy → paymentsApi.create → window.location → Multicard
- `src/features/payment/ui/PaymentResultPage.tsx` — polling 2s, 60s timeout, UI states
- `src/features/pharmacy-panel/ui/PharmacyPanelPage.tsx` — Layout с nested Routes (PR #8)
- `src/features/pharmacy-panel/ui/PharmacyHomePage.tsx` — 4-card hub (PR #8)
- `src/features/pharmacy-panel/ui/products/ProductsListPage.tsx` — list + filters + delete confirm (PR #8)
- `src/features/pharmacy-panel/ui/products/ProductFormPage.tsx` — loader + inner form, OFD accordion (PR #8)
- `src/features/pharmacy-panel/ui/products/components/{ProductCard,ProductStatusBadge}.tsx` (PR #8)
- `src/shared/api/{client,products,orders,payments,pharmacyProducts}.ts` — API helpers
- `src/shared/types/index.ts` — Product (с moderationNote, packageCode после PR #8)
- `src/vite-env.d.ts` — TelegramWebApp typings (включая openLink после PR #6)

### Bot (`apps/bot/`)
- `src/config/index.ts` — Zod env (`WEBAPP_URL` default `https://app.dorify.uz` после PR #9)
- `src/keyboards/index.ts` — кнопки `mainMenuKeyboard` шлют на `${WEBAPP_URL}` и `${WEBAPP_URL}/pharmacy`
- `src/commands/index.ts` — /start, /help, callback queries

### CI/CD
- `.github/workflows/ci.yml` — lint+test+build job + deploy job (resilient pull после PR #7)

### Docs
- `docs/DORIFY_V2_DDD.md` — full design doc, 1525 строк, §10 phase plan
- `docs/MULTICARD_API_DOCUMENTATION.md` — Multicard API reference
- `docs/TEAM-CONSTITUTION.md` v1.3 — operating manual
- `docs/ENGINEER-HANDOFF.md` — этот файл
- `docs/multicard-1/README.md` — Multicard integration context (1045 строк): API концепции, текущее состояние реализации, регрессии vs v1, архитектурный pivot, Phase 4 closure план, open questions
- **`docs/design/POLISH_PLAN.md`** — план design pass для следующей сессии
- `REVIEWER-LOG.md` — Reviewer calibration + Captain decisions log

### Outgoing artifacts
- `~/Desktop/marketplace-payment-inquiry.pdf` — generic 1-page A4 inquiry для Multicard / Click / Payme / Uzum support о split feature.

---

## On session start

```bash
# 1. Read state
cat .claude/workflow-state.json

# 2. Read this handoff
cat docs/ENGINEER-HANDOFF.md

# 3. If next-up = design pass → читай docs/design/POLISH_PLAN.md
cat docs/design/POLISH_PLAN.md

# 4. If next-up = Multicard → читай docs/multicard-1/README.md
cat docs/multicard-1/README.md

# 5. Read REVIEWER-LOG.md (Captain decisions)
cat REVIEWER-LOG.md

# 6. Skim TEAM-CONSTITUTION.md v1.3 if cold-start

# 7. Confirm to Captain: «контекст загружен, state X, next-up Y, готов»
```

---

*Качество > Скорость. Захендоффим грамотно — следующий Engineer стартует за 5 минут вместо 30.*
