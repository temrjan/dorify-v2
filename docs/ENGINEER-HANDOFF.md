# Engineer Handoff — Dorify v2

> Read this **first** in any new Engineer session per `docs/TEAM-CONSTITUTION.md` §0.6.
> Updated: **2026-05-10** (Session 5 close — Sprint 1 + Phase 4 hardening + audit deep batch 1 + production smoke test 4/5 blocks pass).

---

## ⚡ TL;DR

**Project:** Multi-tenant аптечный маркетплейс (Telegram Mini App). Миграция Express MVC v1 → NestJS DDD v2.
**State:** `idle`. Production v2 live на `api.dorify.uz` + `app.dorify.uz`. **БД содержит seed data** (1 pharmacy «Аптека Дорифай Демо», 1 PHARMACY_OWNER user `temrjan` Telegram ID 8503214095, 7 products всех статусов).
**Captain language:** русский, directive-style. Устаёт от ceremony. **Sequential strictly** — не запускать parallel tool calls.
**Last sessions shipped:**
- Session 2 (2026-05-08, 6 PR #5–#10): payment frontend flow, pharmacy CRUD, CI/bot/CORS fixes.
- Session 3 Day 1-2 (2026-05-09, 11 PR #12–#22): полный design pass v2.
- Session 3 Day 3 (2026-05-09, 2 PR #24–#25): закрытие 3 оставшихся ⏳ из POLISH_PLAN.
- Session 4 (2026-05-09, 6 PR #27–#32): pharmacy onboarding spec adapt + CI hardening + Sprint 0 PR-1/PR-2 + audit Phase 1 quick wins.
- **Session 5 (2026-05-10, 11 PR #34–#44):** Sprint 0 PR-3 closeout, full Sprint 1 Days 1-6 (bot welcome + wizard + admin DM + per-pharmacy cart + onboarding), audit deep batch 1 (Order race + Callback IP whitelist), Phase 4 (OFD validation + ReconcilePayments cron), 2 smoke fixes (#43 slug auto-derive, #44 verify DM web_app button), handoff docs.
**Production live:** v2 frontend готов, pharmacy onboarding **e2e verified in production** (bot welcome → wizard → admin DM → approval → owner получает Mini App с initData → onboarding checklist). 4 из 5 smoke blocks ✅, **Block 5 (buyer cart) pending**. Backend hardened: audit Phase 1 + 2 critical/high deep closed; Phase 4 на 6/7.
**Next session entry point:** Block 5 smoke (buyer cart с Multicard и manual contact для test pharmacy). Затем audit batch 2 (Idempotency-Key + Refresh tokens, нужен Redis client) либо Phase 4 final piece (Multicard adapter retry).

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

| Фаза | Что | Статус (2026-05-09) | Что осталось |
|---|---|---|---|
| 0 | Foundation (repo, pnpm, NestJS, Prisma, CI/CD) | ✅ 100% | — |
| 1 | IAM Module | ✅ ~99% | Admin creds в env ✓; ServiceTokenGuard ✓; admin verify/reject endpoints ✓ (PR #29); GET /pharmacy/:id public ✓ (PR #38); JwtAuthGuard wire — dead code (Phase 8) |
| 2 | Catalog Module | ✅ ~98% | `getMyProduct` endpoint ✓; status filter в DTO ✓; **master categories list** ✓ (PR #22) |
| 3 | Ordering Module | ✅ ~95% | Per-pharmacy cart с PENDING_MANUAL_CONTACT ✓ (PR #38); placeAtomically с row-level lock ✓ (PR #39 — fixed audit S-HIGH-4); OFD validation order-time ✓ (PR #40); admin order controller — TODO Tier 2/3 |
| 4 | Payment Module | ✅ ~95% | Frontend ✓; AES encryption ✓; MD5 sig ✓; CallbackIpGuard ✓ (PR #39 — audit S-CRIT-4); OFD validation ✓ (PR #40); ReconcilePayments cron ✓ (PR #41). **Остаётся:** Idempotency-Key + retry в Multicard adapter (audit batch 2 либо Phase 4 final) |
| 5 | Frontend | ✅ ~95% | Design pass v2 ✓; `/become-pharmacy` wizard ✓ (PR #36); per-pharmacy cart Pattern A ✓ (PR #38); `/inquiry/:pharmacyId` ✓ (PR #38); `/pharmacy/onboarding` checklist ✓ (PR #38); CheckoutPage simplified ✓ (PR #38). **Остаётся:** pharmacy orders list (Tier 2), pharmacy payment-settings UI, Admin SPA, i18n switcher (Day 7 backlog) |
| 6 | Bot + Notifications | ✅ ~90% | Welcome flow с UZ/RU + role choice ✓ (PR #35); admin DM approval ✓ (PR #37); per-pharmacy DM на manual contact orders ✓ (PR #38); ReconcilePayments cron emits events → bot DMs ✓ (PR #41) |
| 7 | Search (Avi) | ⚠️ ~30% | Qdrant→pgvector переход (Captain decision), Product события chain, frontend AI search UI |
| 8 | Audit + Security + Migrate | ⚠️ ~55% | Audit Phase 1 quick wins ✓ (PR #31); CI concurrency ✓ (PR #28); audit deep batch 1 ✓ (PR #39: Order race + Callback IP). **TODO:** миграция v1→v2, AuditInterceptor, rate limiting, **Idempotency-Key для placeOrder (Redis)**, **Refresh tokens (Redis)**, входной sanitization beyond Zod |

**Roadmap до cutover:** ~7-10 рабочих дней (Phase 4 closure + admin SPA + bot wizard + migration). Frontend design в основном завершён.

---

## Что отгружено в Session 2 (2026-05-08)

| PR | Содержание | Размер |
|---|---|---|
| #5 | `docs: ENGINEER-HANDOFF for cross-session continuity` | +259 LOC |
| #6 | `feat: frontend payment flow with Multicard checkout + status polling` | +235/-6 LOC |
| #7 | `ci: resilient deploy — reset --hard origin/main before docker build` | +6/-1 LOC |
| #8 | `feat: pharmacy products CRUD UI` | +1147/-28 LOC |
| #9 | `fix(bot): default WEBAPP_URL → app.dorify.uz (v2 frontend)` | +1/-1 LOC |
| #10 | `fix(api): default ALLOWED_ORIGINS → production TWA + admin domains` | +5/-2 LOC |
| #11 | `docs: session 2 handoff + design plan + Multicard reference` | +2991 LOC docs |

## Что отгружено в Session 3 (2026-05-09) — full design pass v2

| PR | Содержание | Размер |
|---|---|---|
| #12 | `feat(web): design foundation — theme tokens + base components` (Skeleton, EmptyState, Pill + 9 icons) | +234 LOC |
| #13 | `feat(web): redesign HomePage + BottomNav polish` (hero card, sticky search, skeleton cards, product card design, safe-area) | +162/-70 LOC |
| #14 | `chore(api): prisma seed for dev/staging` (idempotent seed: 1 pharmacy + 1 user + 7 products) | +213/-1 LOC |
| #15 | `feat(web): pharmacy pages design polish` (ProductsList chip filter, count badge, ProductForm sections, ProductCard shadow-card, status pills с иконками) | +356/-252 LOC |
| #16 | `fix(web): adaptive theme + cart/checkout safe-area padding` (AppRoot reactive appearance) | +58/-19 LOC |
| #17 | `feat(web): profile tab + theme toggle + tabbar bg unification` (zustand themeStore, ProfilePage, tab «Заказы»→«Профиль») | +152/-9 LOC |
| #18 | `fix(web): theme override applies to all surfaces (CSS vars + AppRoot)` (html data-attr override — был неполный) | +38/-2 LOC |
| #19 | `fix(web): theme override — set --tg-theme-* inline on body with !important` (final fix — body inline beats Telegram's body inline) | +53/-33 LOC |
| #20 | `fix(web): cart — inline summary+CTA вместо fixed bottom-bar` | +18/-20 LOC |
| #21 | `feat(web): cart items clickable — navigate to ProductPage on tap` | +22/-3 LOC |
| #22 | `feat(web): catalog rename + master categories list` (15 categories, single source) | +213/-83 LOC |
| #24 | `feat(web): design polish — OrdersPage, ProductPage, StatusBadge unify` (PR-1 buyer flow closeout) | +210/-88 LOC |
| #25 | `feat(web): design polish — CheckoutPage + PaymentResultPage` (PR-2 checkout flow closeout) | +237/-141 LOC |

## Что отгружено в Session 4 (2026-05-09) — pharmacy onboarding spec + Sprint 0 + audit

| PR | Содержание | Размер |
|---|---|---|
| #27 | `docs: pharmacy onboarding spec v1.1` (adapted из gidstroy под dorify auth/routing/Multicard) | +439 LOC |
| #28 | `ci: serialize deploys via concurrency group` (предотвращает orphan-container race из Session 3 incident #9) | +5 LOC |
| #29 | `feat(api): pharmacy admin endpoints + check-slug + ServiceTokenGuard` (Sprint 0 PR-1) | +305/-4 LOC |
| #30 | `docs: save Claude Code audit report` | +521 LOC docs |
| #31 | `fix(api): audit Phase 1 quick wins` (5 critical/high closed: hardcoded creds, Math.random, DomainError 500→400, InitData TTL 86400→300, getCurrentUser broken) | +143/-48 LOC |
| #32 | `feat(api): image upload module — StoragePort + local disk adapter` (Sprint 0 PR-2, sharp + magic bytes + path traversal hardening) | +713 LOC |

## Что отгружено в Session 5 (2026-05-10) — Sprint 1 + Phase 4 hardening

| PR | Содержание | Размер |
|---|---|---|
| #34 | `chore: Sprint 0 PR-3 — deps + logs scrub` (@grammyjs/conversations + slugify + react-i18next + sensitive headers redacted) | +166/-7 |
| #35 | `feat(bot): welcome flow + role choice (Sprint 1 Day 1)` (UZ/RU language picker, Buyer/Register choice, WebApp deep links) | +255/-68 |
| #36 | `feat(web): become-pharmacy wizard 4 steps (Day 2-4)` (slug live-check, logo upload via PR #32, multi-call orchestration) | +1037/-1 |
| #37 | `feat: admin DM approval flow (Day 5)` (PharmacyNotificationHandler + bot admin Composer, X-Service-Token wired) | +276/-8 |
| #38 | `feat: per-pharmacy cart Pattern A + manual contact + onboarding (Day 6)` (CartPage rewrite, CheckoutPage simplified, NEW InquiryPage + PharmacyOnboardingPage, Order PENDING_MANUAL_CONTACT, GET /pharmacy/:id) | +653/-131 |
| #39 | `fix(api): audit deep batch 1 — Order race transaction + Multicard callback IP whitelist` (placeAtomically с row-level lock, MulticardCallbackIpGuard, trust proxy) | +180/-24 |
| #40 | `fix(api): OFD order-time validation` (Phase 4 closure — reject orders missing IKPU/packageCode когда pharmacy has Multicard) | +23 |
| #41 | `feat(api): ReconcilePayments cron` (Phase 4 closure — @nestjs/schedule, 5min cron over PENDING > 10min, gateway query + atomic mark-paid) | +180 |
| #42 | `docs: Session 5 handoff` | +73 docs |
| #43 | `fix(web): wizard slug auto-derive` (smoke #1 — auto-derive только первый символ работал; SlugField теперь management state internally) | +35/-35 |
| #44 | `fix(api): pharmacy.verified DM uses web_app button` (smoke #2 — plain URL DM не injected initData → Mini App 401 → onboarding all-grey; теперь web_app button) | +21/-4 |

### Production env updates (Session 5)

| Когда | Что | Причина |
|---|---|---|
| Session 5 mid | `BOT_TOKEN` → `@DorifyBot` token | Production bot должен быть `@DorifyBot`, был `@temrjanbot` (мониторинг) |
| Session 5 mid | `WEBAPP_URL` → `https://app.dorify.uz` | Был `https://dorify.uz` (landing) — WebApp button открывал лендинг вместо Mini App |
| Session 4 | `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` ($-escaped) + `ADMIN_SERVICE_TOKEN` | Audit S-CRIT-1 fix |
| Session 5 | `ADMIN_CHAT_IDS=8503214095` (api .env) + `API_URL=https://api.dorify.uz/api/v1` (bot .env) | Sprint 1 Day 5 deploy coordination |

### Smoke test progress (Session 5 close)

End-to-end pharmacy onboarding **verified в production** by Captain across 5 blocks. Last block (buyer flow) — pending.

| Block | Что проверено | Status |
|---|---|---|
| **1** | Bot welcome — UZ/RU language picker, role choice, /language re-prompt | ✅ pass |
| **2** | Wizard 4 шага — slug auto-derive, slug live-check, logo upload (Caddy + magic bytes), multi-call orchestration, Submit success view | ✅ pass (после fix #43 для slug auto-derive) |
| **3** | Admin DM approval — admin gets DM с inline buttons, tap Одобрить → API call с X-Service-Token → owner получает DM | ✅ pass |
| **4** | Pharmacy panel + onboarding — verify DM web_app button, Mini App opens с initData, onboarding checklist «Дождитесь одобрения» зелёным, products list 200 OK | ✅ pass (после fix #44 для web_app button) |
| **5** | Buyer flow — Cart per-pharmacy блоки, Multicard checkout либо InquiryPage manual contact, seller получает DM с buyer phone | ⏳ pending |

### Production verified data

- **Test pharmacy 2** (admin-approved by Captain Session 5):
  - id: `03ad18f8-bd83-452c-bf83-89f84dc5d332`
  - name: «Тест Аптека 2», slug `test-apteka-2`
  - logo: `https://api.dorify.uz/uploads/logos/a14d3a46-487b-4e1d-857d-80e27ac409ee.webp` (200, image/webp, Cache-Control 1d)
  - isVerified=t, isActive=t

### Хроника Session 5

1. **Sprint 0 PR-3 закрыт** (#34, ~30 мин) — deps install + sensitive headers scrub в exception filter (audit P4.1). Подготовка к Sprint 1.

2. **Sprint 1 Day 1** (#35, ~1ч) — bot welcome flow с UZ/RU language picker + role choice [Buyer / Register pharmacy]. Простой TS-объект i18n без react-i18next overhead на bot side. Session middleware (in-memory) для lang persistence.

3. **Sprint 1 Day 2-4** (#36, 3 дня compressed в один sitting) — become-pharmacy wizard 4 шага. Multi-call orchestration: register → updateProfile → updatePaymentSettings (partial-state warnings вместо atomic transaction). Logo upload через PR #32 endpoint. Slug live-check с slugify lib. Skipped: i18n setup (Day 7 backlog), type selector (API extension scope creep).

4. **Sprint 1 Day 5** (#37, ~1ч) — admin DM approval. **Architecture decision: Option C** — backend → Telegram Bot API напрямую (uses BOT_TOKEN env). Bot обрабатывает callback_query через polling. PharmacyCreated/Verified/Rejected events emit handlers. Admin chat_id whitelist guard на bot side (defense-in-depth). Reject reason via session pendingRejectId + on('message:text') (no conversations plugin).

5. **Sprint 1 Day 6** (#38, ~2ч) — per-pharmacy cart Pattern A. CartPage rewrite: each pharmacy → собственный block с CTA `[💳 Оплатить]` либо `[💬 Отправить заявку]` based on hasPaymentSettings. CheckoutPage simplified — `?pharmacyId=` only. NEW InquiryPage `/inquiry/:pharmacyId` для manual contact orders. NEW PharmacyOnboardingPage `/pharmacy/onboarding` с 3-step checklist. Backend: Order.create принимает initialStatus, OrderingService определяет PENDING vs PENDING_MANUAL_CONTACT по pharmacy.hasMulticardCredentials, OrderCreatedEvent extended с status + contactPhone, OrderNotificationHandler branched messages. New endpoint GET /pharmacy/:id (public).

6. **Audit deep batch 1** (#39, ~1ч) — closes 2 audit findings:
   - **S-HIGH-4 Order race:** placeAtomically wraps decrement+create в Postgres tx с atomic conditional UPDATE WHERE stock >= qty (row-level lock, no FOR UPDATE needed). InsufficientStockError → tx rollback. OnOrderCreatedDecrementStock handler теперь noop logger.
   - **S-CRIT-4 Callback IP whitelist:** MulticardCallbackIpGuard validates request.ip против MULTICARD_CALLBACK_IPS (default 195.158.26.90). app.set('trust proxy', 1) для X-Forwarded-For через Caddy. IPv6-mapped IPv4 normalized.

7. **Phase 4 OFD validation** (#40, ~30 мин) — reject orders missing IKPU/packageCode когда pharmacy has Multicard. Skipped для PENDING_MANUAL_CONTACT (manual orders не идут через Multicard).

8. **Phase 4 ReconcilePayments cron** (#41, ~1ч) — recover from lost Multicard callbacks. @nestjs/schedule installed. Every 5 min over Payments PENDING > 10 min → query gateway → atomic markPaidAtomically (CAS) → emit PaymentConfirmedEvent. Cap 50 per tick. Edge cases handled: pharmacy creds gone, gateway query fails, concurrent callback arrival.

**Sprint 1 closed.** Pharmacy onboarding e2e в production. Phase 4 на 6/7. Audit на 7/9 critical+high closed.

### Sprint 1 + Phase 4 smoke-test plan (recommended ДО next session)

**Critical untested flow** — 7 PRs за один sitting → cumulative production behavior nigde не verified manually.

**Buyer / pharmacy owner e2e (15 мин):**
1. Open bot `@dorify` → `/start` → expect language picker [🇷🇺 Русский] [🇺🇿 O'zbek]
2. Tap «Русский» → greeting + role choice [🛒 Купить / 🏪 Зарегистрировать аптеку]
3. Tap «Зарегистрировать аптеку» → WebApp opens `/become-pharmacy`
4. Step 1: name «Test Pharmacy 2» → slug auto-derives → live-check shows ✓
5. Step 2: skip logo (либо upload — verify Caddy serves `https://api.dorify.uz/uploads/logos/<uuid>.webp`)
6. Step 3: skip Multicard (либо ввести test creds)
7. Step 4: agree → Submit → success view
8. **Captain (admin) получает DM**: «Новая заявка на регистрацию аптеки» + [✓ Одобрить] [✗ Отклонить]
9. Tap «Одобрить» → backend service-token call → owner получает DM «✓ Аптека одобрена»
10. Open Mini App `/pharmacy/onboarding` → checklist shows: Одобрено ✓ / Add products (нет) / Multicard (зависит от шага 6)
11. Add product → товар появляется в `app.dorify.uz/`
12. Buyer (user 2) → /start → Купить → add product to cart → tap «Оплатить» либо «Отправить заявку» (зависит от Multicard)

**Ключевые проверки:**
- BackButton работает на каждом step wizard
- Slug live-check responds в течение 1 sec
- Logo upload завершается без timeout
- Approval DM приходит в течение 5 sec
- Reject flow с reason работает (admin tap «Отклонить» → bot asks reason → submit → owner получает с reason)
- Per-pharmacy cart с 2 разными аптеками показывает 2 блока, каждый со своей CTA

### Хроника Session 4

1. **Pharmacy onboarding spec adapt** (PR #27): прочитал gidstroy 700-line spec, отфильтровал false positives (gidstroy не = dorify), переписал в 439 строк под dorify stack — Telegram auth (нет bcrypt+STORE_OWNER login), routing /pharmacy/* (single-user→1 pharmacy), service-token admin auth, Pattern A cart (per-pharmacy блоки + manual contact fallback), local disk storage с Hexagonal port abstraction, 5-6 days Sprint 1 estimate.

2. **CI hardening proactive** (PR #28): добавлен `concurrency: { group: deploy-main, cancel-in-progress: false }` — третий incident такого класса ловить не хотим в Sprint 0/1 multi-PR sequence.

3. **Sprint 0 PR-1** (PR #29): admin verify/reject + check-slug + service token guard + PharmacyVerified/Rejected events + fix orphan PharmacyCreatedEvent. 131 tests pass.

4. **Audit save** (PR #30): сохранён комплексный audit report от Claude Code в `docs/AUDIT_REPORT.md` с filtered false positives (auditor путал dorify с gidstroy в нескольких местах).

5. **Audit Phase 1 quick wins** (PR #31, ~2h): 5 критических/high findings закрыты:
   - **S-CRIT-1:** Hardcoded admin creds → ENV (`ADMIN_USERNAME` + bcrypt hash via Zod regex validate)
   - **S-CRIT-3:** `Math.random()` для IDs → centralized `generateId()` через `crypto.randomUUID()` (5+ файлов унифицированы)
   - **S-CRIT-5:** `DomainError` → HTTP 400 (было 500, masked validation errors). Bonus: 4xx logged at warn, 5xx at error.
   - **S-HIGH-1:** InitData TTL 24h → 5 min (replay window minimized).
   - **S-HIGH-5:** `getCurrentUser` empty strings fixed (TelegramAuthGuard теперь attaches firstName/lastName/username в request.user).
   - 134 tests pass (+3 для filter spec).

6. **Sprint 0 PR-2** (PR #32, awaiting merge): image upload module через `StoragePort` + `LocalDiskStorageAdapter`. Pipeline: file-type magic bytes → sharp resize 1200px max + WebP + EXIF strip → write to volume. Path traversal canonical resolve check в delete(). 140 tests pass (+6 для adapter spec).

### Хроника инцидентов / lessons

1. **Foundation first** (PR #12): theme extends + base components (Skeleton, EmptyState, Pill, IconCheck/X/Alert/Clock/Package/Store/Card/User/ChevronRight). Lucide-react **не добавлен** — расширили существующий `icons.tsx` (lucide-стиль уже был).

2. **Design pass main pages** (PR #13, #15): HomePage, ProductsListPage, ProductFormPage, PharmacyHomePage — все обновлены с shadow-card / rounded-card / status pills / EmptyState / Skeleton.

3. **Seed скрипт + execution** (PR #14): captain выполнил `docker compose exec -T dorify-backend npx ts-node prisma/seed.ts` через ssh. БД получила: pharmacy, user (Captain Telegram ID 8503214095), 7 products всех 5 статусов.

4. **Theme adaptive** (PR #16, #17, #18, #19): прошли через 4 итерации до правильного решения:
   - PR #16: `AppRoot appearance` reactive на Telegram colorScheme.
   - PR #17: profile tab с theme toggle (zustand persist), tabbar bg override.
   - PR #18 (incomplete): `html[data-theme-override]` CSS rules — не победил body inline от Telegram.
   - PR #19 (final): `body.style.setProperty(varName, value, 'important')` — inline+important beats Telegram inline.

5. **Cart UX iterations** (PR #20, #21): убрали sticky bottom bar (Captain hint «может скрол должен быть»), сделали inline summary+CTA. Cart items теперь clickable → /product/:id.

6. **Catalog rename + master categories** (PR #22): SearchPage визуально стал Catalog (tab label change, URL stable). 15 категорий в `shared/constants/categories.ts` — единый source для HomePage chips, CatalogPage grid, ProductForm select. Backend permissive.

7. **Day 3 design closeout** (PR #24, #25): закрыли 3 ⏳ из POLISH_PLAN.
   - PR #24: OrdersPage (count badge, SkeletonCard на loading, EmptyState с IconOrders, theme-aware divider), ProductPage (inline CTA per Cart lesson, IconPackage placeholder, ProductSkeleton, EmptyState на 404, Pill для «По рецепту»), StatusBadge → переписан через `Pill` (единый источник pill-стилей с ProductStatusBadge + иконки для всех статусов).
   - PR #25: CheckoutPage (section cards «Контакт» / «Способ получения» / «Ваш заказ», radio cards с иконками, **inline submit** с total в label вместо fixed bottom bar), PaymentResultPage (большая иконка в цветном кружке для всех состояний, унифицированный `ResultView` компонент, max-w-sm mx-auto для широких экранов).
   - **POLISH_PLAN status table — все blocks ✅, страницы 100% покрыты.**

### Хроника инцидентов / lessons

**Session 2:**

1. **CI deploy fail post-PR-#6 merge.** На сервере `/opt/dorify-v2/` имел ручные local-changes от прошлого SSH-вмешательства, `git pull` упал. Recovery: `git reset --hard origin/main && git clean -fd` → manual `docker compose build && up -d`. **Permanent fix:** PR #7 (resilient deploy в CI script).

2. **Bot указывал на v1.** Default `WEBAPP_URL=https://dorify.uz` (v1 landing) в `apps/bot/src/config/index.ts`. Captain заметил smoke-test'ом. **Fix:** PR #9 default → `https://app.dorify.uz`. Также: env_file для bot — `./apps/bot/.env`, **не** общий `/opt/dorify-v2/.env` (см. `docker-compose.yml:39`).

3. **CORS «Network Error» в browser.** Default `ALLOWED_ORIGINS='*'` несовместим с `credentials:true`. На сервере env содержал старый список без `app.dorify.uz`. **Fix env:** Engineer SSH-ом sed-нул env + `docker compose up -d --force-recreate dorify-backend` (`restart` НЕ перечитывает env_file). **Code fix:** PR #10 default → prod-домены явно.

**Session 3:**

4. **Theme override через CSS html-rules не работал.** PR #18 ставил `html[data-theme-override]` block с CSS vars override — но **Telegram WebApp injects `--tg-theme-*` vars inline на `<body>`**, и body's inline специфичнее html-attribute selector при var lookup. **Fix (PR #19):** в App.tsx useEffect ставит vars **inline на document.body** через `body.style.setProperty(varName, value, 'important')`. Inline+important перебивает Telegram's non-important inline.

5. **Sticky bottom bar — анти-pattern в TWA.** PR #16 оставил sticky bar на cart с `bottom: 4rem` (assumed TabBar height 64px). Captain видел перекрытие — TabBar на Android ~80px+ inc. safe-area. **Fix (PR #20):** убрали sticky bar, сделали inline summary+CTA после items. Контент scroll'ится, no magic numbers, работает на любой платформе. **Применять для всех buyer-CTAs.** Pharmacy ProductForm — sticky OK (длинная форма, нужен accessible save).

6. **`docker compose restart` не перечитывает env_file.** Captain после env-edit делал `restart` — изменение не применялось. **Fix:** `docker compose up -d --force-recreate <service>`.

7. **Production seed: ts-node в production image есть** (через `node_modules/.bin/ts-node` или `npx ts-node`). pnpm нет — image используется `node` runtime. **Команда:** `docker compose exec -T dorify-backend npx ts-node prisma/seed.ts`.

8. **Tabbar bg от @telegram-apps/telegram-ui не tied к theme vars.** CSS module hashed class содержит `Tabbar_wrapper`. **Override (PR #17):** `[class*="Tabbar_wrapper"] { background: var(--tg-theme-secondary-bg-color) !important; }` в `index.css`.

9. **Concurrent merges → CI deploy race с orphan containers.** Day 3: PR #24 и #25 merged через 16 секунд → два concurrent deploy job'a → второй упал на `Container dorify-bot Error response from daemon: Conflict. The container name "/03531ad5f8d6_dorify-bot" is already in use`. На сервере 3 orphan контейнера в `Created` state, running контейнеры — старые images. **Recovery:** SSH manually → `docker rm -f <orphan-ids>` → `docker compose build && up -d --force-recreate`. Затем `gh run rerun` для clean CI history. **Permanent fix:** PR #28 (Session 4) — `concurrency: { group: deploy-main, cancel-in-progress: false }` в deploy job. **Закрыто.**

**Session 4:**

10. **Required env var added без deploy coordination → 3-hour production crash loop.** PR #29 (Sprint 0 PR-1) добавил `ADMIN_SERVICE_TOKEN` как required env через Zod validation. CI auto-deploy задеплоил новый код, backend упал на boot (`Required: ADMIN_SERVICE_TOKEN`), `restart: unless-stopped` зациклил перезапуск. **Captain не получил alert** — frontend (`app.dorify.uz`) static, был up; bot up; только backend down. External health не проверялся ~3h до Session 4 продолжения. **Recovery:** SSH → append `ADMIN_SERVICE_TOKEN=<32-hex>` в `/opt/dorify-v2/.env` + `apps/bot/.env` (для Sprint 1 Day 4) → `docker compose up -d --force-recreate dorify-backend` → health 200. **Process lesson:** любой PR adding required env MUST включать deploy-time coordination в PR description. Альтернативно — env var optional с fallback default + warn at startup.

11. **bcrypt hash в Docker Compose `.env` нужен `$$` escape.** `ADMIN_PASSWORD_HASH=$2b$10$q9I12...` → compose интерпретировал `$q9I12...` как variable substitution → mangled value `$2b$10/MGH6` в контейнере → Zod regex отвергнет на boot после PR #31 merge. Fix в .env: replace `$` → `$$` (compose substitutes `$$` → `$` при passing to container). Documented в PR #31 + `apps/api/.env.example`. **Применять для любого env value содержащего `$` в Docker Compose env_file.**

12. **Audit auditor confused dorify с gidstroy.** `docs/AUDIT_REPORT.md` содержит ~30 findings, но 4 false positives (apps/admin missing, @dorify/web mismatch, ALLOWED_ORIGINS legacy, api fallback legacy) — N/A для dorify. Filtered в шапке документа.

13. **`file-type` v22 ESM-only → downgrade до v16 для CJS.** NestJS default tsconfig — `module: commonjs`. file-type v22 — pure ESM exports. Решение: pinned `file-type@16.5.4`. `sharp` — CJS, но default export не типизирован → используем `import sharp = require('sharp')` (TS import-equals) + `eslint-disable @typescript-eslint/no-require-imports` per-line.

### Производственные доступы (что точно сейчас работает)

- `https://api.dorify.uz/api/v1/health` → `{status:ok,service:dorify-api}`
- `https://app.dorify.uz/` → v2 HomePage: hero card «Dorify», sticky search, 16 chips («Все» + 15 категорий с emoji), grid product cards с shadow-card. **2 published товара** (Парацетамол + Витамин C от seed).
- `https://app.dorify.uz/search` (label «Каталог»): default = 2-col grid 15 категорий с emoji. Tap → filter products. Search input независим. «Популярные запросы» chips.
- `https://app.dorify.uz/cart`: clickable cart items → /product/:id. Inline summary+CTA в конце items (no fixed bar).
- `https://app.dorify.uz/profile`: user card (Тимур + @temrjan), theme toggle (Системная/Светлая/Тёмная — persist в localStorage), link «Мои заказы».
- `https://app.dorify.uz/pharmacy`: 4-card hub с иконками (только «Мои товары» active).
- `https://app.dorify.uz/pharmacy/products`: 7 seed-products со status pills (PUBLISHED/PENDING/REJECTED/DRAFT/HIDDEN). В browser → 401 (нужен Telegram initData).
- `https://app.dorify.uz/payment/result?orderId=...`: polling page.
- Telegram bot `@dorify` `/start` → кнопки → app.dorify.uz / app.dorify.uz/pharmacy.
- CORS: `app.dorify.uz`, `pharmacy.dorify.uz`, `admin.dorify.uz`.
- **Sprint 0 endpoints (Session 4):**
  - `GET /api/v1/pharmacy/check-slug?slug=...` (public, через TelegramAuthGuard) → `{available, suggestion?}`
  - `POST /api/v1/admin/pharmacies/:id/{verify,reject}` (header `X-Service-Token`)
  - `POST /api/v1/uploads/image?scope=logos|products` (multipart/form-data, 5 MB max) → `{url, bytes, format}`
- **Caddy config pending** для `/uploads/*` static serve. Volume `dorify_uploads` создан в docker-compose.yml; Caddy handler нужно добавить:
  ```
  handle /uploads/* {
    root * /var/lib/docker/volumes/dorify-v2_dorify_uploads/_data
    file_server
  }
  ```

### Seed data в production БД

- **Pharmacy:** «Аптека Дорифай Демо» (slug `dorify-demo`, isActive+isVerified, deliveryEnabled, deliveryPrice 15000).
- **User:** PHARMACY_OWNER, telegramId=8503214095 (Captain Тимур), username=temrjan.
- **Products:** 7 штук: Парацетамол 500мг (PUBLISHED), Витамин C 500мг (PUBLISHED), Ибупрофен 200мг (PENDING_MODERATION), Амоксициллин 500мг (REJECTED — moderationNote), Омега-3 1000мг (DRAFT), Кетопрофен гель / Магний B6 (HIDDEN).
- **Re-seed команда:** `ssh 7demo` → `docker compose -f /opt/dorify-v2/docker-compose.yml exec -T dorify-backend npx ts-node prisma/seed.ts` (idempotent — pharmacy/user upsert; products деletes+recreates).

### Известные функциональные ограничения

- Pharmacy panel в обычном браузере недоступен (нет Telegram initData → 401). Norm.
- Multi-pharmacy cart на checkout «degraded» — N invoices, не split. Решение — Multicard split-pivot, см. `docs/multicard-1/README.md`.
- Order panel для аптеки и Admin SPA отсутствуют.
- Backend categories permissive (любая string). UI master list только enforces UI workflow — direct API call может попасть arbitrary string.
- Multicard adapter без retry / Idempotency-Key / IP whitelist — Phase 4 closure pending.
- `apps/bot/.env` ≠ `/opt/dorify-v2/.env` — env-edits для бота нужны в первом файле; `restart` НЕ перечитывает env_file → `up -d --force-recreate`.
- **Audit Phase 1 deep findings (~7h)** — НЕ закрыты: Idempotency-Key для placeOrder (Redis), order placement transaction (`SELECT FOR UPDATE`), refresh token mechanism, payment IP whitelist (S-CRIT-4 — Phase 4 closure overlap).
- **Caddy `/uploads/*` static serve config** — pending Captain task на сервере (см. Производственные доступы).

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
- **`ADMIN_SERVICE_TOKEN`** (Session 4 PR #29) — 32+ chars hex, shared между api + bot. Required, validated Zod. **Generate:** `openssl rand -hex 32`. Хранится в password manager.
- **`ADMIN_USERNAME`** (Session 4 PR #31) — default `admin`, override в production желательно.
- **`ADMIN_PASSWORD_HASH`** (Session 4 PR #31) — bcrypt cost 10, ровно 60 chars в формате `$2[ayb]$NN$...`. **CRITICAL:** в `.env` `$` нужно escape как `$$` (compose interpolation). Хранится в password manager.
- `STORAGE_PATH` — default `/opt/dorify-v2/uploads` (Session 4 PR #32). Volume `dorify_uploads`.
- `STORAGE_BASE_URL` — default `https://api.dorify.uz/uploads`.
- `STORAGE_MAX_BYTES` — default 5_242_880 (5 MiB).
- `INIT_DATA_TTL_SECONDS` — default **300** (Session 4 PR #31, было 86400).

**Bot (`/opt/dorify-v2/apps/bot/.env`)** — read by `dorify-bot` контейнер:
- `BOT_TOKEN`
- `WEBAPP_URL` — после PR #9 default `https://app.dorify.uz`; явный override желателен.
- `HEALTH_PORT` — default 3002
- `ADMIN_CHAT_IDS` — comma-separated chat IDs для approval DM (Sprint 1 Day 4 wire pending)
- **`ADMIN_SERVICE_TOKEN`** (Session 4) — mirror of api .env value. Bot будет использовать для admin endpoint calls (Sprint 1 Day 4).

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
5. **Backend strict category enforcement** — backend сейчас permissive (любая string). UI master list — только UI enforcement. Если хочется strict — backend `category: z.enum(...)` + migration. Decide когда понадобится.
6. **Расширение master categories list** — 15 категорий покрывают MVP. Если pharmacy онбординг покажет gaps (новые типы товаров) — добавить через PR в `apps/web/src/shared/constants/categories.ts`.

## Captain decisions log (closed по 2026-05-09)

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
- Pharmacy products CRUD UI: free-form categories (был, теперь changed) → master list, nested routing, default-all status filter, confirm-dialog delete (PR #8)
- Multicard architectural model: pivot на platform-as-merchant + split (deferred до операционных ответов)
- **Session 3 closures:**
  - Design pass scope: всё buyer-facing (HomePage, Catalog, Cart, Profile) + Pharmacy panel. Sticky bar НЕ в Cart (inline scroll), но в ProductForm — оставить (длинная форма).
  - Theme toggle: native zustand persist + Telegram colorScheme fallback («Системная»). Override через body inline `setProperty(... !important)`.
  - Categories: hardcoded master list, single source `shared/constants/categories.ts` (Option A).
  - Tab «Заказы» → «Профиль». Orders доступен через ссылку в /profile.
  - Tab label «Поиск» → «Каталог». URL path `/search` оставлен (стабильность).

Все decisions — в `REVIEWER-LOG.md`.

---

## Priorities для cutover (после Session 3 design pass)

**Tier 1: Buyer может купить лекарство**
1. ✅ AES + real Multicard backend (PR #4)
2. ✅ Frontend payment flow (PR #6)
3. ⏳ **Phase 4 closure:** OFD order-time validation + reconciliation cron + IP whitelist guard + Idempotency-Key/retry в adapter (см. `docs/multicard-1/README.md` §8). **Сейчас самый блокирующий пункт перед prod-ready buyer flow.**

**Tier 2: Аптека может работать в v2**
4. ✅ Pharmacy panel — products CRUD UI (PR #8 + PR #15 polish)
5. ⏳ Pharmacy panel — payment-settings UI (Multicard credentials per-pharmacy)
6. ⏳ Pharmacy panel — orders list + profile edit
7. ⏳ Bot pharmacy registration wizard (Grammy conversations)

**Tier 3: Админ может работать**
8. ⏳ env-vars admin creds + JwtAuthGuard wire + Admin SPA (login, product moderation, pharmacy verify, orders/payments view)

**Tier 4: Cutover**
9. ⏳ Data migration script v1→v2 (extraction users / pharmacies / products / orders / payments + re-encrypt Multicard secrets)
10. ⏳ Параллельный запуск + smoke
11. ⏳ DNS switch + monitor 24h

**Frontend Polish (опциональное завершение Session 3 backlog):**
- ⏳ OrdersPage redesign (один из последних buyer-pages в старом стиле).
- ⏳ ProductPage review (детальная карточка товара — visual check).
- ⏳ Checkout / PaymentResult минорный polish (sticky bars работают, но visuals можно улучшить).

---

## ⏭ Next session — три вероятных направления

Session 3 закрыл дизайн-пасс v2 (см. PR #12-#22, marked в POLISH_PLAN.md). Captain в финале сессии: «обнови документацию, опиши где мы что впереди».

### Опция A — Phase 4 backend hardening (Multicard)

**Самый высокоприоритетный backend gap.** Без него реальный buyer flow не prod-ready на финансовом уровне.

Items (per `docs/multicard-1/README.md` §8):
- IP whitelist guard на `/payments/callback` — defense-in-depth.
- Idempotency-Key + Retry с exp backoff в `multicard.adapter.ts` — financial integrity.
- Amount validation в callback (callback.amount === payment.amount).
- ThrottlerModule skip для `/payments/callback` (Multicard burst).
- OFD order-time validation в ordering domain.
- Reconcile cron на PENDING > 10 min.
- Reuse existing PENDING payment (fix duplicate row pre-existing bug).

Estimate: ~6-8 часов (атомарные PR'ы).

### Опция B — Tier 2/3 продолжение

- **Tier 2 #6** Pharmacy panel — orders list (read-only ~1.5 дня).
- **Tier 2 #5** Pharmacy panel — payment-settings (Multicard creds form, ~1 день).
- **Tier 2 #7** Bot pharmacy registration wizard (Grammy conversations, ~2 дня).
- **Tier 3 #8** Admin SPA + JwtAuthGuard wire (~4 дня).

### Опция C — Design pass extension

OrdersPage / ProductPage / Checkout / PaymentResult — minor visual polish с применением foundation. ~3-4 часа.

### Опция D — Pause / Multicard reactivation

Если придут ответы от Multicard support (PDF inquiry на Captain's Desktop) — pivot к platform-as-merchant + split (см. `docs/multicard-1/README.md` §6).

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

**App entry / routing:**
- `src/main.tsx` — render `<App />` без AppRoot (вынесен в App.tsx после PR #16/#17).
- `src/app/App.tsx` — AppRoot reactive с Telegram colorScheme + theme override через body inline `setProperty(... !important)` (PR #19).
- `src/app/router.tsx` — routes: HomePage, ProductPage, SearchPage (=Catalog), CartPage, CheckoutPage, PaymentResultPage, OrdersPage, **ProfilePage** (PR #17), PharmacyPanelPage.
- `src/app/Layout.tsx` — bottom nav 4 tabs (Главная / **Каталог** / Корзина / **Профиль**), hidden на /pharmacy/* /checkout /product/* /payment/*.

**Buyer pages (Session 3 redesigned):**
- `src/features/home/ui/HomePage.tsx` — hero card, sticky search, chips («Все» + 15 master categories), skeleton cards, EmptyState (PR #13).
- `src/features/search/ui/SearchPage.tsx` — Catalog: 2-col grid категорий + search input + popular queries chips + EmptyState (PR #22).
- `src/features/cart/ui/CartPage.tsx` — clickable items → /product/:id, inline summary+CTA, no fixed bar (PR #20, #21).
- `src/features/checkout/ui/CheckoutPage.tsx` — single-pharmacy → paymentsApi.create → window.location → Multicard. Sticky bottom-bar (PR #6).
- `src/features/payment/ui/PaymentResultPage.tsx` — polling 2s, 60s timeout, UI states (PR #6).
- `src/features/profile/ui/ProfilePage.tsx` — user card + theme toggle + orders link (PR #17).
- `src/features/orders/ui/OrdersPage.tsx` — buyer orders (старый стиль, не redesigned).
- `src/features/product/ui/ProductPage.tsx` — детальная карточка (старый стиль).

**Pharmacy panel (Session 3 redesigned):**
- `src/features/pharmacy-panel/ui/PharmacyPanelPage.tsx` — Layout с nested Routes.
- `src/features/pharmacy-panel/ui/PharmacyHomePage.tsx` — 4-card hub с иконками (PR #15).
- `src/features/pharmacy-panel/ui/products/ProductsListPage.tsx` — chip filters, count badge, sticky search, EmptyState (PR #15).
- `src/features/pharmacy-panel/ui/products/ProductFormPage.tsx` — Section + Field components, sticky save bar (длинная форма), select для категорий (PR #15, #22).
- `src/features/pharmacy-panel/ui/products/components/{ProductCard,ProductStatusBadge}.tsx` — Pill-based status (PR #15).

**Shared (Session 3 new):**
- `src/shared/ui/Skeleton.tsx` — wrapper над animate-pulse + SkeletonCard preset (PR #12).
- `src/shared/ui/EmptyState.tsx` — slot icon/title/description/action (PR #12).
- `src/shared/ui/Pill.tsx` — multi-purpose chip 6 variants × 2 sizes (PR #12).
- `src/shared/ui/icons.tsx` — кастомные SVG в lucide-стиле (PR #12 — 9 новых).
- `src/shared/stores/themeStore.ts` — zustand persist для theme override (PR #17).
- `src/shared/constants/categories.ts` — master 15 категорий (PR #22).

**Theme / styles:**
- `src/index.css` — Tailwind + Telegram theme utilities + Tabbar bg override.
- `tailwind.config.ts` — extends: dorify success/warning/error, shadows scale, rounded-card/sheet (PR #12).

**API helpers / types:**
- `src/shared/api/{client,products,orders,payments,pharmacyProducts}.ts`
- `src/shared/types/index.ts`
- `src/vite-env.d.ts` — TelegramWebApp typings (openLink, platform, onEvent — PR #6, #16).

### Bot (`apps/bot/`)
- `src/config/index.ts` — Zod env (`WEBAPP_URL` default `https://app.dorify.uz` после PR #9)
- `src/keyboards/index.ts` — кнопки `mainMenuKeyboard` шлют на `${WEBAPP_URL}` и `${WEBAPP_URL}/pharmacy`
- `src/commands/index.ts` — /start, /help, callback queries

### CI/CD
- `.github/workflows/ci.yml` — lint+test+build job + deploy job (resilient pull после PR #7)

### Docs
- `docs/DORIFY_V2_DDD.md` — full design doc, 1525 строк, §10 phase plan.
- `docs/MULTICARD_API_DOCUMENTATION.md` — Multicard API reference.
- `docs/TEAM-CONSTITUTION.md` v1.3 — operating manual.
- `docs/ENGINEER-HANDOFF.md` — этот файл (Session 3 update).
- `docs/multicard-1/README.md` — Multicard integration context (1045 строк): API концепции, текущее состояние реализации, регрессии vs v1, архитектурный pivot, Phase 4 closure план, open questions.
- **`docs/design/POLISH_PLAN.md`** — план design pass (Session 3 finished — большинство blocks ✅).
- `REVIEWER-LOG.md` — Reviewer calibration + Captain decisions log.

### Outgoing artifacts
- `~/Desktop/marketplace-payment-inquiry.pdf` — generic 1-page A4 inquiry для Multicard / Click / Payme / Uzum support о split feature.

---

## On session start

```bash
# 1. Read state
cat .claude/workflow-state.json

# 2. Read this handoff
cat docs/ENGINEER-HANDOFF.md

# 3. If next-up = Phase 4 backend → читай docs/multicard-1/README.md §8
cat docs/multicard-1/README.md

# 4. If next-up = design polish → docs/design/POLISH_PLAN.md (большинство blocks done в Session 3)
cat docs/design/POLISH_PLAN.md

# 5. Read REVIEWER-LOG.md (Captain decisions)
cat REVIEWER-LOG.md

# 6. Skim TEAM-CONSTITUTION.md v1.3 if cold-start

# 7. Confirm to Captain: «контекст загружен, state X, next-up Y, готов»
```

---

*Качество > Скорость. Захендоффим грамотно — следующий Engineer стартует за 5 минут вместо 30.*
