# Engineer Handoff — Dorify v2

> Read this **first** in any new Engineer session per `docs/TEAM-CONSTITUTION.md` §0.6.
> Updated: **2026-05-14** (Session 7 close — Kimi K2.6 audit Tier B closed 5/5; audit critical+high closed 16/16 closable).

---

## ⚡ TL;DR

**Project:** Multi-tenant аптечный маркетплейс (Telegram Mini App). Миграция Express MVC v1 → NestJS DDD v2.
**State:** `idle`. Production v2 live на `api.dorify.uz` + `app.dorify.uz` (main=`f84a373`). Health endpoint теперь возвращает `{status:'ok', service:'dorify-api', db:'up', timestamp}` — реальный DB ping (S-HIGH-12). **БД содержит seed data** (1 pharmacy «Аптека Дорифай Демо», 1 PHARMACY_OWNER user `temrjan` Telegram ID 8503214095, 7 products всех статусов) + миграция `add_payment_reconcile_index` применена.
**Captain language:** русский, directive-style. Устаёт от ceremony. **Sequential strictly** — не запускать parallel tool calls.
**Last sessions shipped:**
- Session 2 (2026-05-08, 6 PR #5–#10): payment frontend flow, pharmacy CRUD, CI/bot/CORS fixes.
- Session 3 (2026-05-09, 13 PR #12–#25): полный design pass v2.
- Session 4 (2026-05-09, 6 PR #27–#32): pharmacy onboarding spec + CI hardening + Sprint 0 + audit Phase 1.
- Session 5 (2026-05-10, 13 PR #34–#46): Sprint 1 e2e + Phase 4 hardening 7/7 + audit deep batch 1.
- Session 6 (2026-05-11, 11 PR #48–#58): Phase 1 seller-side + Phase 2 customer notifications + Kimi audit Tier A (3 critical IDOR + 1 high + 1 medium).
- **Session 7 (2026-05-14, 5 PR #59–#63):** **Kimi K2.6 audit Tier B полностью closed** — PublicPharmacyResponse DTO split (S-CRIT-9), createPharmacy `$transaction` + createWithOwnerPromotion repo method (S-CRIT-10 + S-MED-6), stock restore atomic increment (S-HIGH-8), Health DB ping с 2s timeout (S-HIGH-12), Payment reconcile composite index (S-MED-9 + migration applied + EXPLAIN verified). **14 новых unit tests (189 total), все 4 gates green per PR, /typescript-review + /security-review каждому PR.**
**Production live:** pharmacy full e2e работает (Session 6 features) + audit critical+high закрыты 16/16 closable findings. **Все 5 Kimi critical findings closed.** Tier B PRs ushered through full split-mode pipeline: /codex → intake → plan → /selfcheck (12 findings) → /check (8 findings) → Captain approve → 5 atomic PRs sequential → каждому /typescript-review + /security-review → CI green → merge → post-deploy verify (включая SSH-проверку миграции через `prisma migrate status` + `EXPLAIN ANALYZE`).
**Next session entry point:** Phase 3 bot UX polish (~30 мин — pendingRejectAt timeout + friendly admin race), либо Phase 7 Search/Avi (~5-7 дней, pgvector + AI search), либо Tier C backlog (S-HIGH-9 outbox pattern, S-HIGH-11 bot persistent session, payment.failed flow, и т.д.), либо buyer-side smoke test (Block 5, ~15 мин — still pending с Session 5). Captain's call.

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

## Solo split-mode workflow — skills + перепроверка

Engineer работает соло (no separate Reviewer agent), но имитирует двойную проверку через skills. Per Captain calibration 2026-05-10 — после Session 5 «много шипанули без review» — этот pipeline становится default для **non-trivial PR**.

### 12-step pipeline

| # | Шаг | Skill | Когда обязательно |
|---|---|---|---|
| 1 | INTAKE — read state.json + git status + relevant files (Tier 1 cite) | — | always |
| 2 | Plan body — files / scope / not-in-scope / acceptance gates / risks / open Q | — | always для non-trivial |
| 3 | **`/selfcheck`** — критика своего же plan (4 категории: correctness / completeness / efficiency / practicality, ≥3 findings/cat) | `/selfcheck` | если ≥100 LOC либо security/payment vector |
| 4 | **`/check`** — adversarial review плана (≥5 findings, banned weasel words) | `/check` | если ≥100 LOC |
| 5 | Captain approve word — explicit «давай» / «одобрено» / «go» | — | Iron Law #4 |
| 6 | Coding с Tier 1 probes (read existing patterns ДО написания) | `/codex` + `/typescript` | always pre-code |
| 7 | **`/typescript-review`** — pre-commit code review (4 категории: correctness / performance / security / readability) | `/typescript-review` | always для TS PR |
| 8 | **`/security-review`** — auth / payment / upload / secrets / public endpoints | `/security-review` | mandatory если затронут security vector |
| 9 | Branch + commit + push (explicit `git add path1 path2`, **не** `-A`) | — | Iron Law #6 |
| 10 | PR + CI green gate | — | Iron Law #5 |
| 11 | Captain merge approve («мердж готов» либо явное) | — | Iron Law #6 |
| 12 | **`/verify`** — post-deploy Tier 1 (curl health + endpoint + DB state если migration) | `/verify` | always после merge to main |

### Когда можно срезать

**Micro-chores** (≤10 LOC, no logic, no security vector):
- Skip /selfcheck + /check
- Apply /codex + /typescript-review still
- Captain explicit override needed: «начинай реализацию» либо «без ревьюера»

**Doc-only PRs:**
- Skip /selfcheck + /check + /typescript-review
- Apply /verify if affects deployment либо CI

### Anti-patterns

- ❌ `git add -A` либо `git add .` → подхватит .env / temp / Captain's local files. Always explicit paths.
- ❌ Skip `/security-review` потому что «sure all OK» — security findings catch what mental review misses.
- ❌ Multiple PRs в close-succession без verify intermediate state — Session 4 incident #9 (orphan containers race).
- ❌ Force push without Captain approval — Iron Law #6.
- ❌ `restart` для env reload — нужен `up -d --force-recreate` (env_file changes ignored on restart).

### Skills таблица

| Skill | Что делает | Mandatory для |
|---|---|---|
| `/codex` | Loads architecture / nestjs / typescript standards | Любой coding session start |
| `/typescript` | TS-specific CORE.md (interfaces / types / discriminated unions) | Pre-code на TS |
| `/selfcheck` | Self-criticism своего plan / decision | Non-trivial либо surprise approach |
| `/check` | Adversarial plan review с ≥5 findings | Non-trivial PR (≥100 LOC) |
| `/typescript-review` | Pre-commit code review для TS | Любой TS code PR |
| `/security-review` | OWASP-style review | Auth / payment / upload / secrets / public endpoint |
| `/review` | Cross-cutting bundle | Multi-language либо multi-module diff (200+ LOC) |
| `/verify` | Post-deploy smoke check | После merge to main |

### Honest self-review про Session 5

Я (Engineer) в Session 5 **shipped 13 PR без следования полному split-mode** — большинство fixes малые либо continuations, но 4 крупных (#36 wizard 1037 LOC, #38 cart Pattern A 653 LOC, #39 audit batch 1 180 LOC, #41 cron 180 LOC) **должны были иметь /check + /security-review**. Я полагался на mental checklist что ловит ~80% issues но не 100%.

**Block 5 smoke pending** — это пример риска: 4 PRs не пройдены через formal /security-review, и smoke test уже found 2 bugs (#43 slug auto-derive React state, #44 plain URL DM не injecting initData). Real production behavior НЕ был verified до того момента.

**Lesson для следующей сессии:** non-trivial PR обязан проходить через **минимум /codex + /typescript-review + /security-review (если security vector)**. /selfcheck + /check рекомендуются но не блокируют merge для коротких decisions.

---

## Project state — phases (per `docs/DORIFY_V2_DDD.md` §10)

| Фаза | Что | Статус (2026-05-09) | Что осталось |
|---|---|---|---|
| 0 | Foundation (repo, pnpm, NestJS, Prisma, CI/CD) | ✅ 100% | — |
| 1 | IAM Module | ✅ ~99% | Admin creds в env ✓; ServiceTokenGuard ✓; admin verify/reject endpoints ✓ (PR #29); GET /pharmacy/:id public ✓ (PR #38); JwtAuthGuard wire — dead code (Phase 8) |
| 2 | Catalog Module | ✅ ~98% | `getMyProduct` endpoint ✓; status filter в DTO ✓; **master categories list** ✓ (PR #22) |
| 3 | Ordering Module | ✅ ~95% | Per-pharmacy cart с PENDING_MANUAL_CONTACT ✓ (PR #38); placeAtomically с row-level lock ✓ (PR #39 — fixed audit S-HIGH-4); OFD validation order-time ✓ (PR #40); admin order controller — TODO Tier 2/3 |
| 4 | Payment Module | ✅ ~99% (7/7) | Frontend ✓; AES encryption ✓; MD5 sig ✓; CallbackIpGuard ✓ (PR #39); OFD validation ✓ (PR #40); ReconcilePayments cron ✓ (PR #41); **Multicard adapter retry ✓** (PR #46 — exp backoff + jitter). Phase 4 **closed.** Backlog: Idempotency-Key для placeOrder (Redis) — отдельный audit S-HIGH-3 |
| 5 | Frontend | ✅ ~95% | Design pass v2 ✓; `/become-pharmacy` wizard ✓ (PR #36); per-pharmacy cart Pattern A ✓ (PR #38); `/inquiry/:pharmacyId` ✓ (PR #38); `/pharmacy/onboarding` checklist ✓ (PR #38); CheckoutPage simplified ✓ (PR #38). **Остаётся:** pharmacy orders list (Tier 2), pharmacy payment-settings UI, Admin SPA, i18n switcher (Day 7 backlog) |
| 6 | Bot + Notifications | ✅ ~90% | Welcome flow с UZ/RU + role choice ✓ (PR #35); admin DM approval ✓ (PR #37); per-pharmacy DM на manual contact orders ✓ (PR #38); ReconcilePayments cron emits events → bot DMs ✓ (PR #41) |
| 7 | Search (Avi) | ⚠️ ~30% | Qdrant→pgvector переход (Captain decision), Product события chain, frontend AI search UI |
| 8 | Audit + Security + Migrate | ⚠️ ~60% | Audit Phase 1 quick wins ✓ (PR #31); CI concurrency ✓ (PR #28); audit deep batch 1 ✓ (PR #39); 9/12 critical+high closed (см. `docs/AUDIT_REPORT.md`). **TODO:** Idempotency-Key для placeOrder (Redis); Refresh tokens (Redis); UserRole в domain layer (architectural ~1h); TenantContext port (~2h); миграция v1→v2; AuditInterceptor; rate limiting; input sanitization beyond Zod |

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

## Что отгружено в Session 7 (2026-05-14) — Kimi audit Tier B closed 5/5

5 PRs за день (#59-#63). Production main=`f84a373`. **Audit critical+high closed 16/16 closable findings.**

| PR | Severity | Содержание | Размер |
|---|---|---|---|
| #59 | CRITICAL→HIGH | `fix(api): split PublicPharmacyResponse — close S-CRIT-9 PII leak` (отдельный `PublicPharmacyResponse` DTO без address/phone/license; `getPharmacyById` returns public projection; owner-side endpoints сохраняют full; 3 unit tests — первый iam application service spec) | +116/-3 |
| #60 | CRITICAL | `fix(api): atomic createPharmacy — close S-CRIT-10 + S-MED-6` (новый `PharmacyRepository.createWithOwnerPromotion` через `prisma.$transaction`; P2002 catch → ConflictException 409; parallel pre-flight checks через `Promise.all`; NotFoundException на missing user; events emit ПОСЛЕ commit; 5 unit tests) | +172/-17 |
| #61 | HIGH | `fix(api): atomic stock restore on cancel — close S-HIGH-8` (новый `ProductRepository.restoreStockAtomic` mirror placeAtomically pattern; OnOrderCancelledRestoreStock упрощён до 1 repo call; soft-delete safety via `deletedAt: null`; 3 unit tests) | +102/-11 |
| #62 | HIGH | `fix(api): real DB ping in /health — close S-HIGH-12` (Promise.race с 2s timeout vs `prisma.$queryRaw \`SELECT 1\``; try/catch/finally с clearTimeout cleanup; 503 ServiceUnavailableException на failure; CI deploy gate fast-fail на dead DB; 3 unit tests включая fake-timer на 2s cap) | +88/-2 |
| #63 | MEDIUM | `fix(api): add Payment reconcile index — close S-MED-9` (composite `@@index([status, provider, createdAt])` для reconcile cron query; migration `add_payment_reconcile_index`; **applied на production verified via SSH `prisma migrate status` + `EXPLAIN ANALYZE` confirmed `Index Scan` на reconcile query**) | +9 |

### Tier B audit closure summary

| Finding | Pre-Session 7 | Post-Session 7 |
|---|---|---|
| S-CRIT-9 Public pharmacy PII leak | open | ✅ #59 |
| S-CRIT-10 createPharmacy orphan | open | ✅ #60 (rollback закрывает orphan) |
| S-MED-6 Banned user orphan | open | ✅ #60 (через tx rollback automatically) |
| S-HIGH-8 Stock restore race | open | ✅ #61 |
| S-HIGH-12 Health false-green | open | ✅ #62 |
| S-MED-9 Payment reconcile index | open | ✅ #63 |

**Все Kimi K2.6 critical findings closed.** Remaining backlog — Tier C medium architectural items (S-HIGH-9 outbox, S-HIGH-11 bot persistent session) + low tech-debt (S-LOW-1 i18n bootstrap, etc.).

### Tests added Session 7

- `apps/api/src/modules/iam/__tests__/iam.service.spec.ts` (new): 7 tests (3 getPharmacyById public projection + 4 createPharmacy atomic) — первый iam application service spec.
- `apps/api/src/modules/ordering/__tests__/on-order-cancelled.handler.spec.ts` (new): 3 tests на atomic restore.
- `apps/api/src/__tests__/health.controller.spec.ts` (new): 3 tests включая fake-timer 2s cap.

Total backend tests: **189** (was 175 — 14 new + 1 expand). Frontend tests: still none.

### Process refinements Session 7

1. **Split-mode pipeline followed cleanly:** /codex bootstrap → intake probes → план с per-fix breakdown → /selfcheck (12 findings) → /check (8 findings) → Captain approve word → 5 atomic PRs sequential. Каждый PR прошёл /typescript-review + /security-review до commit.
2. **Major план correction в /check:** S-CRIT-10 misdiagnosed как concurrent-POST race; schema.prisma probe (Pharmacy.ownerId @unique + Pharmacy.slug @unique) показал что concurrent уже защищён DB level. Real угроза = partial-failure orphan. План simplified от 50 LOC до 30 LOC.
3. **Repository-level `prisma.$transaction`:** Captain выбрал `createWithOwnerPromotion` в `PrismaPharmacyRepository` (infrastructure, где Prisma legitimate) vs service-level inject. DDD-чисто, signatures save() не трогаются.
4. **Migration verification protocol:** post-deploy SSH на 7demo → `docker exec dorify-backend npx prisma migrate status` (confirmed «Database schema is up to date!») + `EXPLAIN` query showed `Index Scan using Payment_status_provider_createdAt_idx`. Pattern для будущих миграций.
5. **Docs through PR flow:** в отличие от Session 6 (direct-push docs commit b3098ca), Session 7 docs commit через PR — следуем Session 5 pattern.

### Хроника Session 7

1. **Cold-start intake** (~30 мин) — Captain «работаем с этим проектом соло. Изучи документы, мемори, определи где остановились. Сравни документацию и реальную обстановку.» Engineer прочитал ENGINEER-HANDOFF.md, state.json, recent commits, проверил production health → подтвердил всё совпадает с docs. Создал memory file `dorify-v2-progress.md` + обновил `MEMORY.md` index.

2. **Captain options check** (~5 мин) — показал 4 опции для Session 7 (Tier B / smoke / Phase 3 / Phase 7). Captain выбрал **Tier B (Recommended)**.

3. **/codex bootstrap** (~5 мин) — стандарты architecture, ddd, nestjs, postgresql, testing загружены.

4. **Intake + plan + reviews** (~45 мин) — probed pharmacy/iam/ordering/catalog/health files. План с 5 atomic PRs (LOC estimates, tests, risks). /selfcheck выявил 12 findings (4 categories) — план refined. /check (adversarial) выявил 8 findings — important corrections (S-CRIT-10 misdiagnosed, isBanned check redundant, P2002 catch missing, $queryRaw нет per-query timeout). Captain выбрал 3 решения: repo-level tx, single Payment index, all 5 atomic.

5. **Captain approve word + 5 sequential PRs** (~4 часа) — каждый PR: branch → code → tests → 4 local gates → /typescript-review (apply findings) → /security-review (clean) → commit → push → CI green → Captain «мердж готов» → squash merge → sync main → watch deploy → verify production. Tests went 175 → 186/186 across all 5 PRs, +14 new.

6. **Migration verification (PR #63)** (~10 мин) — Captain «проверь миграцию применилась». SSH 7demo → `docker compose exec dorify-backend npx prisma migrate status` → «Database schema is up to date!». `docker exec postgres psql ... \d "Payment"` показал новый `Payment_status_provider_createdAt_idx`. `EXPLAIN` reconcile query → `Index Scan using Payment_status_provider_createdAt_idx`. Confirmation. **Note:** Postgres контейнер на 7demo называется просто `postgres` (pgvector image), не часть dorify compose stack — host shared между проектами (aqllify-db, ledger-ai-postgres, postgres).

7. **Session close** — Captain «обнови документацию и закрой сессию». Handoff + AUDIT_REPORT + state.json + memory обновлены. Docs committed через PR (Session 5 pattern).

## Что отгружено в Session 6 (2026-05-11) — Phase 1 seller-side + Phase 2 customer notifications + Kimi audit Tier A

11 PRs за день (#48-#58). Production main=`ff5c517`.

### Group 1 — UX fixes (Day start)
| PR | Содержание | Размер |
|---|---|---|
| #48 | `fix(web): wizard logo upload UX — dashed border + явный CTA` (drop-zone visual, IconImage, aria-label) | +23/-7 |
| #49 | `fix(bot): set chat menu button programmatically — Menu → Mini App` (BotFather override через bot.api.setChatMenuButton) | +10 |

### Group 2 — Phase 1 seller-side полностью closed (orders end-to-end working)
| PR | Содержание | Размер |
|---|---|---|
| #50 | `feat: pharmacy orders page — full seller-side flow end-to-end` (state machine extension READY→DELIVERED pickup shortcut, ListPharmacyOrdersSchema status filter, PharmacyOrdersPage с chip filter, OrderDetailSheet с status-aware actions per (status, deliveryType), optimistic mutations с retry: 0) | +689/-20 |
| #51 | `feat(web): pharmacy payment-settings UI — Multicard creds после регистрации` (sentinel-undefined pattern, type=password + autoComplete=off, hub card red dot indicator) | +296/-1 |
| #52 | `feat(web): pharmacy profile edit page — закрытие seller-side flow` (LogoUpload reuse с disabled prop, phone error specifics, full Pharmacy.profile editor) | +345/-6 |

### Group 3 — Phase 2 customer-side closed
| PR | Содержание | Размер |
|---|---|---|
| #53 | `feat(api): buyer notifications + HTML escape + Order phone sanitize` (OrderStatusChangedEvent + new @OnEvent('order.statusChanged') handler, escapeHtml() helper применён ко всем DM templates, PhoneNumber.create() sanitize в OrderingService.placeOrder, removed frontend telHref workaround) | +188/-29 |

### Group 4 — Kimi K2.6 audit Tier A (5 atomic per-fix PRs)

Kimi K2.6 (Chinese model, Captain's subscription) провёл независимый audit. Все 5 critical findings верифицированы и закрыты атомарными PR'ами.

| PR | Severity | Содержание | Размер |
|---|---|---|---|
| #54 | CRITICAL | `fix(api): close InitData future-date replay bypass (S-CRIT-6)` (isAuthDateValid pure helper с clock skew tolerance + 6 unit tests) | +58/-2 |
| #55 | CRITICAL | `fix(api): close order GET IDOR (S-CRIT-7) — ownership check` (buyer либо pharmacy owner check + 6 unit tests, впервые application service test pattern) | +112/-3 |
| #56 | CRITICAL | `fix(api): close payment-by-order IDOR (S-CRIT-8) — ownership check` (mirror getPaymentStatus pattern, ordersApi.getByOrder dead code в frontend → zero impact, 4 unit tests) | +131/-3 |
| #57 | HIGH | `fix(api): Multicard callback amount cross-check (S-HIGH-10 defense-in-depth)` (explicit tiyin↔sum conversion check после signature verify, 4 new processCallback tests + 4 existing IDOR) | +146/-11 |
| #58 | MEDIUM | `chore: add .dockerignore — prevent env/git/secrets leak in build context` (S-MED-11) | +61 |

### Kimi audit findings statistics

**Total findings reported:** 5 critical, 6 high, 8 medium, 6 low.
**Closed Session 6:** 3 critical (S-CRIT-6/7/8) + 1 high (S-HIGH-10) + 1 medium (S-MED-11) = 5 PRs.
**Verified as already closed:** All 10 Appendix A safe patterns (HTML escape, phone sanitize, AES-256-GCM, etc) — confirms prior session work correct.
**Tier B pending (next session):** S-CRIT-9, S-CRIT-10+S-MED-6, S-HIGH-8, S-HIGH-12, S-MED-9 — see «Next session» section.
**Tier C backlog:** S-HIGH-9 outbox pattern, S-HIGH-11 bot persistent session, S-HIGH-13 upload throttle, S-MED-4/5 payment.failed events, S-MED-7 phone +998 alignment, S-MED-8 bot multi-pharmacy reject, S-MED-10 swagger wiring, S-LOW-*.

### Tests добавлены в Session 6

- `apps/api/src/modules/iam/__tests__/telegram-auth.guard.spec.ts` (new): 6 tests для `isAuthDateValid` pure helper.
- `apps/api/src/modules/ordering/__tests__/ordering.service.spec.ts` (new): 6 tests для `getOrder` ownership. **Первый application service test в проекте.**
- `apps/api/src/modules/payment/__tests__/payment.service.spec.ts` (new): 8 tests (4 IDOR + 4 processCallback amount cross-check).
- `apps/api/src/modules/ordering/__tests__/domain.spec.ts`: +2 tests для `OrderStatusChangedEvent`.

Total backend tests **39** (27 ordering + 6 iam guard + 8 payment + others). Frontend tests: still none.

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

### Хроника Session 6

1. **Bootstrap** — Captain просил cold-start: «определи что сделано, есть документ хэндофф, определи план работы на сегодня». Engineer прочитал handoff + state.json, верифицировал что PR #45/#46/#47 merged (локальный ref был stale без fetch). Чёткое разделение: **Phase 1 (seller-side gaps)** + **Phase 2 (customer notifications)** + опционально **Phase 3 (bot polish)**.

2. **UX fixes (~2h, PRs #48-#49)** — logo upload UX fix (dashed border drop-zone, IconImage, aria-label) + bot menu button programmatic config (setChatMenuButton, перебивает любую BotFather settings при запуске).

3. **Phase 1 seller-side (~6h, PRs #50-#52)** — серьёзный pivot во время /check Task #10 backend: Engineer обнаружил что `PharmacyOrderController` + `OrderingService.listPharmacyOrders` **уже реализованы** в prior session (Task #10 был noop). Поэтому Task #11 расширился: backend status filter + state machine extension READY→DELIVERED (pickup shortcut) + frontend orders page с chip filter + OrderDetailSheet с status-aware actions per (status, deliveryType). Captain pushback во время /selfcheck: «не ищи быстрых побед» → Engineer пересмотрел scope, перекинул из read-only list к полноценным state-machine actions. PR #51 + #52 — payment-settings + profile edit, оба используют existing backend endpoints, frontend-only.

4. **Phase 2 customer-side (~2h, PR #53)** — закрытие customer-experience gap. До этого pharmacy переводила статусы через UI → buyer ничего не знал. Added: OrderStatusChangedEvent emit из Order.updateStatus(), new @OnEvent handler с deliveryType-aware messaging (PICKUP «выдан» vs DELIVERY «доставлен»), HTML escape во всех DM templates (закрывает hidden injection vector через Telegram parse_mode='HTML'), phone sanitize at DTO boundary через PhoneNumber.create() в OrderingService.placeOrder. Frontend telHref() workaround removed — phone теперь always clean from backend.

5. **Side-step: gidstroy advisory cross-check** — Captain pasted 12-point Kimi-style advisory из параллельного проекта gidstroy. Engineer верифицировал каждый пункт против actual code (НЕ trust на веру), нашёл что: 7 confirmed (HTML inject, DM logging, pendingReject timeout, race admin, advisory #5 stale [Task #11+#12 уже shipped today], banner field, frontend tests missing, telegram-ui peer mismatch React 19, BOT_TOKEN duplicate env, frontend access guard, spec login note). 1 неверный (#7 buyer PharmacyPage uses mock — в dorify-v2 такой страницы вообще нет, gidstroy-specific). Captain попросил «независимо где можно улучшить» — Engineer добавил свои findings: HTML injection broader scope (не только reject reason), buyer status DMs absent, phone sanitize, state machine SSOT через 4 файла, audit batch 2 outstanding, OrderStatus narrowing в shared/types. Captain согласился с приоритизацией Phase 1 → Phase 2 → Phase 3.

6. **Kimi K2.6 full audit (~3h, PRs #54-#58)** — Captain прислал полный Kimi K2.6 audit report (5 critical, 6 high, 8 medium, 6 low) + Appendix A (10 verified safe patterns). Engineer перепроверил каждый critical/high против actual code, **все 5 critical confirmed**:
   - S-CRIT-6 InitData future-date bypass (line 78 `now - authDate > ttl` дает negative при future authDate → always passes)
   - S-CRIT-7 Order GET IDOR (getOrder без ownership check)
   - S-CRIT-8 Payment-by-order IDOR (mirrors S-CRIT-7)
   - S-CRIT-9 Public pharmacy endpoint PII (license/address/phone leak) — **severity overstated, я бы дал HIGH**
   - S-CRIT-10 Pharmacy registration race condition (no transaction wrapping createPharmacy + promoteToOwner)

   Self-correction during planning: первоначально Engineer предложил «single security batch PR» — Captain попросил «перепровери на ошибки». Engineer честно нашёл 5 пробелов в собственном плане (atomic per-fix PRs > big batch, tests must be included, smoke risk warnings missing, ordering matters). Pivoted на **5 atomic per-fix PRs** для Tier A. Сделал #54-#58 sequentially, каждый <150 LOC с tests.

   **Honest признание (committed в state.json)**: Engineer **пропустил S-CRIT-7 и S-CRIT-8** во время Phase 1+2 /security-review skill runs — фокусировался на новых mutations и multi-tenant scope, не probed existing GET endpoints. Mea culpa pattern — security review skill нужно дополнить «scan all existing GET handlers с :id parameter».

7. **Application service test precedent** — Session 6 ввела впервые в codebase application-level service tests (3 spec файла: telegram-auth.guard, ordering.service, payment.service). Lightweight pattern: `new Service(...)` с `jest.fn()` mocks, без NestJS Test module overhead. 20 новых tests суммарно. Удобный pattern для следующих sprints.

### Хроника Session 5

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

## ⏭ Next session (Session 8) — entry point

**Captain в финале Session 7:** «обнови документацию и закрой сессию». **Все Kimi K2.6 critical+high closable findings closed (16/16).** Остаются Tier C backlog medium-architectural items + low tech-debt + неполный buyer smoke. Phase 7 Search/Avi всё ещё untackled.

### Опция A — Phase 3 bot UX polish (~30 мин, 1 PR)

Self-contained backlog item, легко close'нуть в начале сессии:
- `pendingRejectAt` timestamp в bot session + 5-min auto-clear (gidstroy advisory #3 + Kimi S-MED-8 overlap)
- Friendly «Уже обработано другим админом» вместо raw DomainError text (gidstroy advisory #4 + Kimi race fix)

### Опция B — Phase 7 Search/Avi (~5-7 дней, многоэтапный sprint)

Qdrant→pgvector переход (Captain decision на pgvector closed), Product events chain, AI search UI. Самый крупный остающийся feature scope.

### Опция C (Recommended after Tier B) — Tier C backlog architectural

Medium-size architectural items:
- **S-HIGH-9 Outbox pattern** — In-memory EventEmitter crash silence. Либо outbox table в DB либо Redis Streams. **Multi-day work** — proper design ceremony нужен.
- **S-HIGH-11 Bot persistent session** — Redis либо Prisma session store. **Medium work** (~1 day).
- **S-HIGH-13 Upload throttling** — ThrottlerModule + per-user quota. **Small** (~2 hours).
- **S-MED-4 + S-MED-5 payment.failed flow** — markPaymentFailed wire + buyer notification handler.
- **S-MED-7 Phone format alignment** — UZ-only enforce либо international parity между frontend/backend.
- **S-MED-10 Swagger wiring** — SwaggerModule.setup() behind admin guard.
- **S-LOW-1 i18n bootstrap** — react-i18next setup, всё UI strings в ключах.

### Опция D — Buyer-side smoke (~15 мин)

Session 5 Block 5 (buyer flow) **до сих pending**. Captain не приоритизировал ни в Session 6, ни в Session 7. Может пройти сейчас за 15 мин с новыми статусами + buyer DMs + новый PublicPharmacyResponse + atomic stock restore. Хорошая verification что вся Tier B работа реально не сломала flow.

### Опция E — Migration v1→v2 (~1 неделя)

`docs/DORIFY_V2_DDD.md §10` Phase 8 — данные production v1. Полностью untackled, но критично перед cutover. Скрипт extraction users / pharmacies / products / orders / payments + re-encrypt Multicard secrets.

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
