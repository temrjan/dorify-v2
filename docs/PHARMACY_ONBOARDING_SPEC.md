---
type: feature-spec
status: completed
created: 2026-05-09
updated: 2026-05-10
author: Engineer (Session 3 Day 3)
version: 1.1
based-on: gidstroy/docs/vendor-onboarding-spec.md (адаптировано под dorify-v2 stack)
---

# Pharmacy Onboarding — спецификация и план реализации

> **STATUS: ✅ DONE (Session 5, 2026-05-10).** Sprint 0 + Sprint 1 Days 1-6 shipped в production.
> Документ остаётся как исторический reference что было реализовано. Implementation:
> - PR #29 (Sprint 0 PR-1): admin endpoints + ServiceTokenGuard
> - PR #32 (Sprint 0 PR-2): image upload module
> - PR #34 (Sprint 0 PR-3): deps + logs scrub
> - PR #35 (Day 1): bot welcome flow с UZ/RU
> - PR #36 (Days 2-4): become-pharmacy wizard 4 шага
> - PR #37 (Day 5): admin DM approval flow
> - PR #38 (Day 6): per-pharmacy cart Pattern A + InquiryPage + onboarding checklist
> - PR #43, #44: smoke fixes (slug auto-derive, verify DM web_app button)
>
> **Production-verified** через Captain smoke test 4/5 blocks. Block 5 (buyer flow) — pending для следующей сессии.

## TL;DR

Self-service регистрация аптеки в Dorify v2 через Telegram-бота без участия developer'а. Владелец аптеки запускает бот → выбирает язык + роль → заполняет 4-шаговый wizard в Mini App → ждёт одобрения от админа в Telegram → получает доступ к существующей pharmacy panel `/pharmacy/*`. **Sprint 0 (3 PR, ~1.5 дня) + Sprint 1 (5-6 дней).** Adapted из gidstroy spec — выпадает password/login flow (используем существующий TelegramAuthGuard) и slug-based routing (single-user → 1 pharmacy через `User.pharmacy` relation в Prisma).

---

## 1. Цель + бизнес-контекст

### Что решаем

`POST /api/v1/pharmacy/register` endpoint существует и работает (`apps/api/src/modules/iam/infrastructure/controllers/pharmacy.controller.ts:21`). Но customer-facing pipeline отсутствует:

- Mini App не имеет route «Стать аптекой»
- Bot имеет только покупательский `/start` с main menu
- Admin endpoint для verify/reject (`Pharmacy.isVerified`) отсутствует
- Многоязычность не реализована (UZ/RU)
- Slug auto-generation отсутствует (сейчас manual через seed)
- Admin DM approval flow отсутствует — pharmacy create silently goes to `isActive=false, isVerified=false`
- Image upload infrastructure отсутствует (schema хранит URL strings, multer/storage не настроены)

Per ENGINEER-HANDOFF Phase 6 ~50%: «pharmacy registration wizard — TODO».

### Зачем сейчас

Без self-service:
- Каждая регистрация = manual SSH seed либо developer endpoint hit
- Не масштабируется к 10+ аптекам
- Production seed (PR #14) — placeholder, не product flow

### Что НЕ решаем (out-of-scope)

- Системная админ-панель для ADMIN роли — отдельный sprint (`admin.dorify.uz`)
- Phase 4 closure (Multicard hardening: OFD validation, ReconcilePayments cron, IP guard, retry) — параллельный backend backlog
- AI search frontend (Phase 7 ~30%) — отдельный sprint
- Order panel для аптеки + admin SPA — Tier 2/3 backlog
- Migration старых seeded pharmacies — uses те же endpoint'ы, миграция тривиальна
- Полный перевод покупательской части на UZ/RU — Day 6 optional, иначе следующий sprint
- Multi-user-per-pharmacy ownership — оставляем 1:1 schema lock (`Pharmacy.ownerId @unique`)

---

## 2. User journey

1. **Бот /start** → если `User.languageCode == null` → бот спрашивает «O'zbek / Русский». Save в БД.

2. **Role choice** — две inline кнопки:
   - 🛒 «Купить лекарства» → deep link на `app.dorify.uz/`
   - 🏪 «Зарегистрировать аптеку» → deep link на `app.dorify.uz/become-pharmacy`

3. **Wizard 4 шага** (Mini App):
   - **Шаг 1 (обязательно):** Название, URL аптеки (slug auto-translit с возможностью править, live-check), телефон, тип (PHARMACY / DISTRIBUTOR / MANUFACTURER), адрес, лицензия (опц.)
   - **Шаг 2 (опционально):** Описание, **логотип (image upload, optional)**, доставка (вкл/выкл, цена)
   - **Шаг 3 (опционально):** Multicard credentials (APP_ID + Store ID + Secret) с warning «без Multicard — заказы приходят как заявка, продавец сам связывается с покупателем». Manual contact = **запланированный fallback**, не lesser tier.
   - **Шаг 4:** Превью карточки + согласие с правилами + кнопка «Создать»

4. **Admin DM** — backend создаёт `Pharmacy` (isActive=false, isVerified=false) → emit `PharmacyCreatedEvent`. Bot DM в `ADMIN_CHAT_IDS` с inline `[Одобрить][Отклонить]`.

5. **Owner notification** — после approve: «✓ Аптека одобрена. Откройте панель». После reject: «✗ Заявка отклонена. Причина: <reason>».

6. **Onboarding checklist** в panel: «1. Добавьте товары / 2. Подключите Multicard (опц.)». Когда первый PUBLISHED товар появляется — pharmacy виден покупателям.

---

## 3. Архитектурные решения

### Auth — НЕ копируем gidstroy bcrypt flow

dorify auth использует Telegram initData через `TelegramAuthGuard` (`apps/api/src/modules/iam/infrastructure/guards/telegram-auth.guard.ts`). PHARMACY_OWNER скоупится по `User.role`. Pharmacy panel открывается из бота → initData валидируется → role check.

**Нет необходимости в:**
- bcrypt + `User.passwordHash`
- Отдельный `POST /auth/store/login`
- JWT с storeId claim

### Routing

| URL | Статус | Что |
|---|---|---|
| `app.dorify.uz/` | existing | Покупательский Mini App |
| `app.dorify.uz/become-pharmacy` | **NEW** | 4-шаговый wizard |
| `app.dorify.uz/pharmacy/*` | existing | Pharmacy panel (PharmacyPanelPage с sub-routing) |
| `app.dorify.uz/pharmacy/onboarding` | **NEW** | Onboarding checklist (post-first-login) |
| `app.dorify.uz/inquiry/:pharmacyId` | **NEW** (опционально) | Lite confirmation form для manual contact orders |

### Cart Pattern A — per-pharmacy блоки

Корзина groupируется по аптекам. **Каждая аптека = свой атомарный блок с собственной кнопкой checkout.**

```
┌─ Корзина ─────────────────────────┐
│  Итого по корзине: 70 000 сум     │
│                                   │
│  🏪 Аптека Дорифай Демо           │
│  ├─ Парацетамол × 2     50 000    │
│  ├─ Витамин C × 1       25 000    │
│  ├─ Сумма: 25 000 сум             │
│  └─ [💳 Оплатить · 25 000 сум]    │
│                                   │
│  🏪 Аптека «Здоровье»             │
│  ├─ Ибупрофен × 1       45 000    │
│  ├─ Сумма: 45 000 сум             │
│  └─ [💬 Отправить заявку · 45 000]│
│                                   │
└───────────────────────────────────┘
```

**Почему Pattern A (per-pharmacy block) принят:**
- Multicard API физически не поддерживает split (per ENGINEER-HANDOFF: «Multi-pharmacy cart degraded — N invoices, не split»)
- Простая ментальная модель: 3 аптеки = 3 отдельных оплаты, как 3 разных магазина в торговом центре
- Атомарная транзакция per pharmacy → простой код, no failure-recovery middleware

**Refinements:**
1. **Сумма в label кнопки** — `[💳 Оплатить · 25 000 сум]` либо `[💬 Отправить заявку · 45 000 сум]`. Buyer видит сумму до tap'а.
2. **Confirmation step для manual contact** — после tap'а «Отправить заявку» → короткая форма (телефон, удобное время связи, комментарий) → потом Order create. Inline modal либо `/inquiry/:pharmacyId` lite-page.
3. **Per-pharmacy total + grand total** — оба видны в корзине.
4. **Multicard failure recovery** — items аптеки **остаются в корзине** до confirmed `paid` callback. Cart cleared только после явного успеха.
5. **Возврат в Cart** после оплаты одной аптеки (с remaining items других аптек), не на `/orders`. User решает: завершить остальное либо оставить на потом.

### Manual contact как валидный fallback

Если у pharmacy `multicardAppId == null` → buyer видит кнопку «💬 Отправить заявку». При tap:
1. Confirmation form (phone, time, comment)
2. Backend создаёт `Order` со статусом `PENDING_MANUAL_CONTACT` (новый OrderStatus enum value)
3. Bot DM продавцу в Telegram: order summary + buyer phone + buttons `[Принять][Отказать]`
4. Buyer видит toast «Заявка отправлена, продавец свяжется» + Order в `/orders`

**Это запланированный flow, не workaround.** Соответствует местной практике рынка (UZ): онлайн-каталог → продавец перезванивает.

### Языки (UZ/RU)

- **Bot:** при первом /start запрашивает UZ/RU → `User.languageCode` (поле уже в schema). Default detection из Telegram `language_code` (`uz` → UZ, иначе RU). `/language` команда для смены.
- **Mini App + pharmacy panel:** `react-i18next` + JSON dictionaries. Переключатель в Profile (рядом с theme toggle).
- **Vendor wizard первым.** Покупательская часть локализуется опционально в Day 6.

### Slug — visible buyer-facing identifier

Buyer видит slug (например, share-link на pharmacy) → нужен UI для выбора + live-check.

- Поле в форме: «**URL вашей аптеки**»
- Auto-translit из названия через `slugify` lib (RU/UZ cyrillic → latin)
- Override на manual — only `[a-z0-9-]+`
- Live uniqueness check: `GET /api/v1/pharmacy/check-slug?slug=...` → `{available, suggestion?}`
- Превью URL под полем

### Admin auth — service token

`POST /admin/pharmacies/:id/verify` и `/reject` принимают **service token** в `X-Service-Token` header.

- ENV var `ADMIN_SERVICE_TOKEN=<random-32-bytes-hex>` в backend env (новая)
- Bot хранит тот же token в `apps/bot/.env` → шлёт в header при callback handler invoke API
- Backend validation: `crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(config.ADMIN_SERVICE_TOKEN))` против timing attacks
- ~10 LOC, без JWT infrastructure
- Future-proof: будущая admin SPA выпускает свои JWT отдельно через `JwtAuthGuard` (existing dead code wire-up — Phase 8 backlog), service token остаётся для bot-to-api communication

### Storage — local volume + StorageService port (Hexagonal)

**Сейчас:** schema хранит `Pharmacy.logo String?` + `Product.imageUrl String?` как URL. Upload infrastructure отсутствует.

**Decision:** local docker volume на VPS + Caddy serve + sharp resize pipeline + StoragePort abstraction → swap на R2 / Yandex Object Storage позже без code change в domain layer.

| Часть | Что |
|---|---|
| Backend module | `apps/api/src/shared/infrastructure/storage/` — `StoragePort` interface + `LocalDiskStorageAdapter` |
| Endpoint | `POST /api/v1/uploads/image` (multer + magic bytes validation + sharp resize + write to disk) |
| Storage path | `/opt/dorify-v2/uploads/<entity>/<entity-id>/<size>.webp` (mounted volume in docker-compose) |
| Image processing | sharp — 3 размера (thumb 200px, card 600px, full 1200px) + WebP + EXIF strip |
| Serve | Caddy `handle /uploads/* { root * /opt/dorify-v2/uploads }` либо backend serve через @nestjs/serve-static |
| Web | FormData multipart upload, progress, preview |

**Ссылка:** [Kris1027/nestjs-ecommerce-api](https://github.com/Kris1027/nestjs-ecommerce-api) — близкий стек (NestJS 11 + Prisma + Cloudinary), reference для multer + buffer-based upload.

**Limits:** 5 MB max per file, allowed MIME `image/jpeg|png|webp` validated по magic bytes (file-type lib либо magic-bytes.js).

---

## 4. Stack additions

| Dep | Где | Зачем |
|---|---|---|
| `@grammyjs/conversations` | apps/bot | Multi-step wizards (language picker, role choice, admin approval callback) |
| `slugify` | apps/web | Auto-translit RU/UZ cyrillic → latin |
| `react-i18next` + `i18next-browser-languagedetector` | apps/web | UZ/RU dictionaries + Telegram language_code detection |
| `multer` + `@types/multer` | apps/api | Multipart upload handler |
| `sharp` | apps/api | Image resize + WebP conversion + EXIF strip |
| `file-type` | apps/api | Magic bytes validation для security |

**Что НЕ нужно** (vs gidstroy spec): `bcrypt`, `@types/bcrypt`, `@telegram-apps/sdk-react`. Existing `@telegram-apps/telegram-ui` v2 + `@twa-dev/sdk` v7 работают coherent.

---

## 5. Реализация

### Sprint 0 (~1.5 дня, 3 PR)

#### PR-1: `feat(api): pharmacy onboarding schema + admin endpoints` (~2 ч)

Scope:
- Migration: `OrderStatus.PENDING_MANUAL_CONTACT` enum value (только enum, без полей)
- `GET /api/v1/pharmacy/check-slug?slug=...` — public endpoint (slugify-aware uniqueness). Idempotent read (GET correct vs gidstroy's POST typo).
- `POST /api/v1/admin/pharmacies/:id/verify` (service token guard) → `Pharmacy.verify()` domain method → `isVerified=true, isActive=true`
- `POST /api/v1/admin/pharmacies/:id/reject` (body `{reason}`) → `isActive=false` + emit `PharmacyRejectedEvent`
- Domain events: `PharmacyCreatedEvent` (existing — verify wired), `PharmacyVerifiedEvent`, `PharmacyRejectedEvent`
- New guard: `ServiceTokenGuard` (validates `X-Service-Token` header через `timingSafeEqual`)

**Drop:** `Pharmacy.email` field — нет use case (auth Telegram-based, recovery не нужен, email-уведомлений нет).

Acceptance: type-check + lint + tests + migration applies cleanly. `/security-review` mandatory на admin endpoints + ServiceTokenGuard.

#### PR-2: `feat(api): image upload module (storage port + local adapter)` (~3-4 ч)

Scope:
- `apps/api/src/shared/domain/storage/storage.port.ts` — `StoragePort` interface (`upload(buffer, mime, entity, entityId): Promise<{url, sizes}>`, `delete(url): Promise<void>`)
- `apps/api/src/shared/infrastructure/storage/local-disk-storage.adapter.ts` — implementation (multer + sharp + write to volume)
- `apps/api/src/modules/uploads/` (новый module) — UploadsController с `POST /uploads/image` (FileInterceptor + magic bytes via `file-type` + 5 MB limit)
- Docker-compose.yml: добавить volume `- dorify_uploads:/opt/dorify-v2/uploads` для backend service
- Caddy config — `/uploads/*` static serve (либо via NestJS serve-static)

Acceptance: unit test (upload `.html` с поддельным `image/png` mimetype → 400), integration test (real PNG → returns URL + 3 sizes available).

Skills: `/codex` → `/typescript` → `/check` → code → `/typescript-review` → `/security-review` (file upload — mandatory) → CI → Head merge → `/verify`.

#### PR-3: `chore: deps + logs scrub hardening + ADMIN_SERVICE_TOKEN env` (~30 мин)

Scope:
- `pnpm --filter @dorify/bot add @grammyjs/conversations`
- `pnpm --filter @dorify/web add slugify react-i18next i18next-browser-languagedetector`
- `pnpm --filter @dorify/api add multer @types/multer sharp file-type`
- `apps/api/src/core/filters/all-exceptions.filter.ts` — `scrubHeaders()` private method redacting `authorization`, `x-telegram-initdata`, `cookie`, `x-api-key`, `x-service-token` перед `logger.error()`
- ENV: `ADMIN_SERVICE_TOKEN` в `apps/api/.env.example` + `apps/bot/.env.example` (random 32 bytes hex generation hint в docs)
- Verify `ADMIN_CHAT_IDS` env var configured в `/opt/dorify-v2/apps/bot/.env`

Acceptance: dependencies installed, lockfile updated, grep prod logs after deploy → 0 matches на scrubbed headers.

### Sprint 1 (5-6 дней, по PR в день, split mode)

#### Day 1: `feat(bot): welcome flow with language picker + role choice`

Scope (apps/bot):
- `apps/bot/src/flows/welcome.ts` — Composer с `@grammyjs/conversations`:
  - `/start`: если `User.languageCode == null` → ask UZ/RU → save через bot's API client
  - role choice: 2 inline buttons «Купить» / «Зарегистрировать аптеку»
  - «Купить» → reply с `WebApp` button на `app.dorify.uz/`
  - «Зарегистрировать» → reply с `WebApp` button на `app.dorify.uz/become-pharmacy`
- `/language` команда — switch UZ/RU
- i18n словари: `apps/bot/src/i18n/{uz,ru}.ts`

Skills: `/codex` → `/typescript` → `/check` → code → `/typescript-review` → push → CI → Head merge → `/verify`.

#### Day 2-4: `feat(web): become-pharmacy wizard (4 steps)` (3 дня honestly)

Scope (apps/web):
- New feature `apps/web/src/features/become-pharmacy/`
- 4-шаговый wizard на `@telegram-apps/telegram-ui`:
  - **Step 1**: name + slug live-check (debounced 500ms) + phone + type radio + address + license
  - **Step 2**: description + **logo upload (FormData → POST /uploads/image, optional)** + delivery toggle/price
  - **Step 3**: Multicard creds (опц.) с warning «без Multicard — заказы приходят как заявка через Telegram»
  - **Step 4**: preview pharmacy card + agree to terms checkbox + Submit
- API call `POST /api/v1/pharmacy/register` (existing) с full payload (logo URL из Step 2 upload response)
- Slug live-check — debounced fetch к `GET /api/v1/pharmacy/check-slug`
- i18n setup: `react-i18next` + initial UZ/RU dictionaries для wizard
- Skeleton/EmptyState (existing components) + Pill для validation errors

Skills: `/codex` → `/typescript` → `/check` → code → `/typescript-review` → `/security-review` (file upload + form input sanitization) → `/review` (multi-module: web + uses uploads from PR-2) → CI → Head merge → `/verify`.

#### Day 5: `feat(api+bot): admin verify/reject + bot DM approval flow`

Scope (apps/api + apps/bot):
- Notification module extension: `apps/api/src/modules/notification/application/event-handlers/on-pharmacy-events.handler.ts` — listen `PharmacyCreatedEvent` → call bot DM service
- Bot DM в `ADMIN_CHAT_IDS` с inline `[Одобрить][Отклонить]`, payload `{pharmacyId}` в callback_data
- Bot callback handler → API call с `X-Service-Token` header (from PR-3 env) → `POST /admin/pharmacies/:id/verify` либо `/reject`
- Bot DM owner после verify/reject: «✓ Одобрено» либо «✗ Отклонено: <reason>» + кнопка «Открыть панель» (deep link на `/pharmacy`)

Skills: `/codex` → `/typescript` → `/check` → code → `/typescript-review` → `/security-review` (mandatory — service token flow + admin role) → CI → Head merge → `/verify`.

#### Day 6: `feat(web+api): per-pharmacy cart + manual contact + onboarding checklist`

Scope (apps/web + apps/api):
- **CartPage rewrite** (`apps/web/src/features/cart/ui/CartPage.tsx`):
  - Per-pharmacy блоки (header с pharmacy.name + items + per-pharmacy total + CTA)
  - Conditional CTA: `pharmacy.hasMulticardCredentials` → `[💳 Оплатить · ${total} сум]` else `[💬 Отправить заявку · ${total} сум]`
  - Grand total сверху корзины
- **CheckoutPage упрощается** (`apps/web/src/features/checkout/ui/CheckoutPage.tsx`):
  - Принимает `?pharmacyId=...` query param — обрабатывает только items одной аптеки
  - Multi-pharmacy loop logic убирается
  - Existing Multicard flow (PR #6) сохраняется per-pharmacy
- **InquiryPage NEW** (`apps/web/src/features/inquiry/ui/InquiryPage.tsx`):
  - Route `/inquiry/:pharmacyId`
  - Confirmation form: phone (default из Telegram user.phone), preferred call time, comment
  - Submit → Backend creates Order с status `PENDING_MANUAL_CONTACT` → toast «Заявка отправлена, продавец свяжется» → navigate back to `/cart`
- Backend `OrderingService.createOrder` — определять initial status: Multicard configured → `PENDING`, иначе → `PENDING_MANUAL_CONTACT`
- `Order.updateStatus()` domain method — добавить allowed transitions для `PENDING_MANUAL_CONTACT → CONFIRMED | CANCELLED`
- Notification module: bot DM продавцу при `OrderCreatedEvent` где status=`PENDING_MANUAL_CONTACT` (с item summary + buyer phone + buttons `[Принять][Отказать]`)
- **Onboarding checklist screen** `apps/web/src/features/pharmacy-panel/ui/PharmacyOnboardingPage.tsx` — checklist (3 пункта: Multicard / товары / готово). Auto-redirect post-first-login если incomplete.

Skills: `/codex` → `/typescript` → `/check` → code → `/typescript-review` → `/security-review` (payment branching + manual contact validation) → `/review` (multi-module) → CI → Head merge → `/verify`.

#### Day 7 (optional): `feat: i18n switcher in Profile + buyer-side localization`

Scope:
- Profile language toggle (рядом с theme toggle в `apps/web/src/features/profile/ui/ProfilePage.tsx`)
- Buyer-side localization: HomePage / SearchPage (Catalog) / CartPage strings → i18next (UZ/RU)
- Если scope не помещается — отдельный sprint.

---

## 6. Acceptance criteria

### End-to-end e2e путь passes:

1. Новый user `/start` → бот спрашивает язык
2. Выбирает язык → save в `User.languageCode`
3. Бот: «Купить / Зарегистрировать аптеку» buttons
4. Tap «Зарегистрировать» → Mini App `become-pharmacy`
5. Заполняет 4 шага wizard (с slug live-check + phone UZ format + опциональный logo upload) → Submit
6. Backend: `Pharmacy` create (isActive=false, isVerified=false) → emit `PharmacyCreatedEvent`
7. Bot DM админам с `[Одобрить][Отклонить]`
8. Админ tap «Одобрить» → callback → `POST /admin/pharmacies/:id/verify` (service token) → `isVerified=true, isActive=true`
9. Owner получает в боте: «✓ Аптека одобрена» + кнопка «Открыть панель»
10. Open Mini App → `/pharmacy/onboarding` → checklist
11. Создаёт первый PUBLISHED товар (через existing `/pharmacy/products/new` PR #8) с image upload → товар виден в `app.dorify.uz/` каталоге
12. Покупатель: tap product → add to cart → видит per-pharmacy блок с CTA
13. **Если pharmacy с Multicard** → tap «💳 Оплатить» → Multicard checkout (existing flow PR #6)
14. **Если без Multicard** → tap «💬 Отправить заявку» → InquiryPage → confirmation form → submit → Order `PENDING_MANUAL_CONTACT` → bot DM продавцу с order summary + buyer phone → buyer видит toast + back to cart с remaining items
15. Продавец в боте видит: «Новая заявка от <buyer>: <items> на <amount> сум» + buttons `[Принять][Отказать]`

### Security:
- File uploads validated по magic bytes (`file-type` lib) — Sprint 0 PR-2
- Logs scrub `authorization` / `x-telegram-initdata` / `cookie` / `x-api-key` / `x-service-token` (PR-3)
- Admin endpoints require `ServiceTokenGuard` (timing-safe equal)
- Existing `TelegramAuthGuard` validates initData freshness (`INIT_DATA_TTL_SECONDS=86400`)
- Multicard credentials encryption уже на месте (PR #4 — AES-256-GCM с `ENCRYPTION_KEY`)
- Image uploads — 5 MB max, MIME whitelist, EXIF stripped, sharp pipeline catches malformed images

### CI green — все 4 build steps + new unit + integration tests pass

### `/verify` Tier 1 post-deploy:
- `curl https://api.dorify.uz/api/v1/health` → 200 ok
- `curl -I https://app.dorify.uz/become-pharmacy` → 200
- Bot smoke `/start` → language picker shows
- DB check: `SELECT count(*) FROM "Pharmacy" WHERE "isActive"=false` — pending pharmacies visible

---

## 7. Risks + mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Migration fails (PR-1) | CI deploy red | Low-risk (1 enum value), rollback `prisma migrate resolve --rolled-back` |
| Storage volume fills disk | Backend out-of-disk → 500 errors | sharp resize + WebP keeps files small. Periodic cleanup cron для orphan uploads (no DB ref). Disk monitoring через VPS provider. |
| Image upload abused (DoS / large files / malicious) | Backend resource exhaustion | 5 MB hard limit + magic bytes + rate limit (10/min/user через existing throttler) + sharp catches malformed |
| `@grammyjs/conversations` breaks existing `/start` | Bot down | Test локально перед PR, fallback custom state machine, feature flag |
| Slug live-check race | Slug conflict at create-time | Backend creates с unique constraint; UI catches 409 → shows «Slug taken, suggested: foo-2» |
| Per-pharmacy cart UX confusion | Buyer не понимает manual flow | Clear UI группировка + разные button labels («💳 Оплатить» vs «💬 Отправить заявку»), confirmation step с описанием «продавец свяжется» |
| Admin DM misconfigured | Approval flow silent fail | Log на bot startup: «Admin notification targets: <ids>», fail-safe error если chat не найден, warning в /verify |
| Service token leaked | Anyone может verify pharmacies | Rotation procedure: gen new token → restart api+bot. Token не в logs (scrubbed). Future: rotate via secret-management tool. |
| Concurrent merges → CI deploy race (Session 3 incident #9) | CI red, prod containers stuck | **Quick fix backlog** (~5 LOC): добавить `concurrency: { group: deploy-main, cancel-in-progress: false }` в `.github/workflows/ci.yml`. **Рекомендую сделать перед стартом этого sprint'а** — много PR в close succession ожидается. |
| Multi-module Sprint 1 PRs | Sycophancy в `/check`, missed BLOCKING | Split mode mandatory, `/selfcheck` перед каждым plan body |

---

## 8. Что НЕ берём из gidstroy spec

| gidstroy item | Почему не нужно в dorify |
|---|---|
| bcrypt + `User.passwordHash` | TelegramAuthGuard достаточен — initData identifies user |
| `POST /auth/store/login` | Нет отдельного password flow |
| `/store/<slug>/*` path routing | Single user → 1 pharmacy через `User.pharmacy` relation |
| `@telegram-apps/sdk-react` v3 hybrid | Existing telegram-ui v2 + @twa-dev/sdk v7 работает |
| `bcrypt @types/bcrypt` deps | См. выше |
| Sprint 1 Day 5 STORE_OWNER login | Не нужен |
| `Pharmacy.email` field | Auth Telegram-based, recovery не нужен, email-уведомлений нет |
| Phase 2 freeze (Multicard encryption) | Уже сделано в dorify (PR #4 — AES-256-GCM, format `iv:authTag:ciphertext`) |

---

## 9. Sprint timeline визуализация

```
Sprint 0 (~1.5 дня, 3 PR)
├── PR-1: schema migration (PENDING_MANUAL_CONTACT) + admin endpoints + check-slug + ServiceTokenGuard  [~2 ч]
├── PR-2: image upload module (StoragePort + LocalDiskAdapter + multer + sharp)                          [~3-4 ч]
└── PR-3: deps install + logs scrub + ADMIN_SERVICE_TOKEN env                                            [~30 мин]

Sprint 1 (5-6 дней, split mode)
├── Day 1: bot welcome flow (language + role choice)
├── Day 2-4: become-pharmacy wizard (4 шага, 3 дня honestly с image upload integration)
├── Day 5: admin verify/reject + bot DM approval flow (service token wired)
├── Day 6: per-pharmacy cart Pattern A + InquiryPage + manual contact + onboarding checklist
└── Day 7 (optional): i18n switcher + buyer-side localization

Total: 6-8 working days → production-ready pharmacy onboarding
```

---

## 10. Open decisions baked into v1.1

Captain decisions logged 2026-05-09 (Session 3 Day 3):

1. ✅ Multi-project: gidstroy-only, dorify-only — никакого shared package
2. ✅ Single-pharmacy lock: 1:1 (`Pharmacy.ownerId @unique`) — multi-pharmacy ownership = отдельный sprint
3. ✅ Admin auth: service token (`X-Service-Token` header + `timingSafeEqual`)
4. ✅ Storage: local volume + StoragePort abstraction (R2/Yandex swap позже)
5. ✅ Logo: optional в wizard
6. ✅ Slug: visible buyer-facing → live-check + UI поле
7. ✅ Manual contact: запланированный fallback, не workaround
8. ✅ Cart Pattern A: per-pharmacy блоки с собственными кнопками (общий checkout flow + разные labels)
9. ✅ Cart refinements: сумма в label, confirmation step для manual, per-pharmacy + grand total, recovery после Multicard fail, return to cart после оплаты
10. ✅ Day 2-3 → Day 2-4 (3 дня honestly)
11. ✅ Drop `Pharmacy.email` field
12. ✅ Self-service registration from bot (НЕ admin invitation)

---

## 11. Связанные документы

- `docs/DORIFY_V2_DDD.md` — phase plan (§10), domain events
- `docs/ENGINEER-HANDOFF.md` — current state, env vars, incidents (incident #9 — CI race hardening backlog)
- `apps/api/prisma/schema.prisma` — existing Pharmacy/User/Order models
- `apps/api/src/modules/iam/infrastructure/controllers/pharmacy.controller.ts` — existing register endpoint
- `apps/bot/src/config/index.ts` — `ADMIN_CHAT_IDS` env wiring
- `apps/web/src/shared/stores/cartStore.ts` — `selectItemsByPharmacy` selector
- gidstroy `vendor-onboarding-spec.md` — original spec source
- [Kris1027/nestjs-ecommerce-api](https://github.com/Kris1027/nestjs-ecommerce-api) — reference upload pattern (NestJS 11 + Prisma)

---

*Документ v1.1 — adapted из gidstroy vendor-onboarding-spec.md под dorify-v2 stack с Captain decisions от 2026-05-09. Готов к Sprint 0 PR-1 после approve.*
