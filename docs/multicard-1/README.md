# Multicard Integration — Context Dump

> **Назначение:** persistent-память сессии. Всё, что выяснили про Multicard
> в текущей сессии Claude (2026-05-08), плюс материал, переданный Captain.
> Если новая Engineer-сессия читает этот файл — она получает полный контекст
> без необходимости заново копать.
>
> **Статус:** Multicard-работа поставлена на паузу решением Captain
> 2026-05-08. Документ — для возврата в тему позже.

---

## 1. TL;DR

- Реализация Multicard в dorify-v2 уже есть на уровне MVP: `PR #4` (AES +
  real adapter) merged, `PR #6` (frontend payment flow) open.
- Текущая модель — **per-pharmacy merchant**: каждая аптека сама
  регистрируется в Multicard, имеет собственный `appId/storeId/secret`.
- На столе **архитектурный pivot** на **platform-as-merchant + split**:
  одна Multicard-регистрация платформы Dorify, аптеки регистрируют только
  банковские счета как `merchant_account`. Split-API Multicard позволяет
  один invoice с расщеплением на N получателей.
- Pivot **не заблокирован** ни одним unknown — все ключевые предположения
  подтвердились в docs.multicard.uz. Открытые вопросы — операционные
  (тариф, лимиты, sandbox split, partial refund активация).
- В одной сессии PDF-запрос подготовлен для Multicard / Click / Payme /
  Uzum support, лежит на Desktop: `marketplace-payment-inquiry.pdf`.

---

## 2. Источники

### 2.1 Локальные материалы

| Путь | Что |
|------|-----|
| `docs/MULTICARD_API_DOCUMENTATION.md` (untracked, 872 строк) | Snapshot официальной docs.multicard.uz, передан Captain. Покрывает auth, invoice, split, OFD, callbacks, refunds, holding, history. |
| `~/Workspace/projects/dorify/dorify-backend/src/services/multicard/` | v1 prod implementation — single-merchant per-pharmacy, без AES. |
| `/tmp/multicard-v1/` | Архитектурный reference (clone github.com/temrjan/multicard-v1). Marketplace-gateway с split-payments, готовый OFD builder, retry logic, security debt analysis. |
| `apps/api/src/modules/payment/` | v2 текущая реализация: PaymentGatewayPort, MulticardAdapter, PaymentService с race-fix, AES encryption. |

### 2.2 Внешние

- **docs.multicard.uz** — официальная документация. Sitemap содержит
  58 разделов, проиндексирован полностью.
- **github.com/temrjan/multicard-v1** — public repo, marketplace gateway
  reference (Captain's pet project / research).

### 2.3 Что Captain дал в этой сессии

1. Cайт docs.multicard.uz — для study.
2. github.com/temrjan/multicard-v1 — для clone и изучения.
3. Подтверждение что Multicard credentials (Dorify-platform) **есть**.
4. Упоминание dorify v1 + biotact как cross-confirm источников signature
   формулы.

---

## 3. Multicard API — концепции

### 3.1 Хосты

```
Sandbox:    https://dev-mesh.multicard.uz/
Production: https://mesh.multicard.uz/
```

### 3.2 Authentication

```
POST /auth
Body: { application_id, secret }
Response: { token }
```

Bearer-токен валиден 24 часа. Кэшировать на 23 часа per `application_id`.
Adapter `multicard.adapter.ts:129-161` уже это делает.

### 3.3 Invoice creation (наш основной flow)

```
POST /payment/invoice
Headers: Authorization: Bearer {token}
Body: {
  store_id,
  amount,            // в тийинах (1 сум = 100 тийин)
  invoice_id,        // partner-defined ID
  callback_url,
  ofd: [...],        // фискальные позиции
  return_url?,
  return_error_url?,
  lang?: 'ru' | 'uz' | 'en',
  ttl?,
  sms?,
  split?: [...]      // опционально, для split-payment
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uuid": "...",
    "checkout_url": "https://app.rhmt.uz/invoice/...",
    "short_link": "https://l.multicard.uz/...",
    "deeplink": "https://multicard.app/payments/checkout/..."
  }
}
```

**КРИТИЧНО:** `split[]` поддерживается прямо на этом endpoint'е. Не нужно
переключаться на токенизированный flow (`POST /payment` с `card.token`).

### 3.4 Split payments

```json
{
  "split": [
    {
      "type": "account",                            // обязательно
      "amount": 88000,                              // обязательно (в тийинах)
      "details": "Выплата Аптеке X по заказу #123", // обязательно
      "recipient": "5378f655-ae41-11ee-..."         // опционально
    }
  ]
}
```

**Правила:**
- `Σ split[].amount` НЕ ДОЛЖНО превышать `amount - commission_multicard`.
  Multicard сначала вычитает свою комиссию (~1.5-2%), оставшееся
  распределяет.
- Если `type=account` без `recipient` → деньги идут на наш платформенный
  merchant_account (default).
- Разница `amount - Σ split[].amount` остаётся на нашем merchant_account
  (комиссия платформы).

### 3.5 OFD (фискализация)

Каждая позиция:
```json
{
  "qty": 1,                          // обязательно
  "price": 60000000,                 // обязательно (в тийинах)
  "total": 60000000,                 // обязательно (qty * price)
  "mxik": "06401004002000000",       // ИКПУ из tasnif.soliq.uz
  "package_code": "1506113",         // упаковка из tasnif.soliq.uz
  "name": "Парацетамол 500мг x 10",  // обязательно (max 256)
  "vat": 12,                         // опционально (0 или 12)
  "tin": "307578794",                // опционально (ИНН продавца, 9-14 цифр)
  "mark": []                         // опционально (марки для маркируемых)
}
```

**КРИТИЧНО:** `tin` per-item опциональное и **поддерживает разные ИНН в
одном чеке**. Это ключ для marketplace fiscalization — каждая позиция
привязана к ИНН своей аптеки.

### 3.6 Callback success

POST на `callback_url` партнёра:
```json
{
  "store_id": 6,
  "amount": 100000,
  "invoice_id": "...",
  "uuid": "...",
  "billing_id": "...",
  "payment_time": "YYYY-mm-dd H:i:s",
  "phone": "998901234567",
  "card_pan": "8600****1293",
  "ps": "uzcard",                              // uzcard|humo|visa|mastercard|unionpay
  "card_token": "...",
  "receipt_url": "https://ofd.soliq.uz/...",
  "sign": "MD5(store_id + invoice_id + amount + secret)"
}
```

**КРИТИЧЕСКИЕ ОСОБЕННОСТИ:**

1. **Reverse при не-200 ответе.** Из docs:
   > "If partner returns non-200 status, payment is reversed and funds
   > returned to payer."

   Это значит наш callback handler **обязан** ответить 200 при любых
   обстоятельствах. Если БД упала — лучше залогировать и вернуть 200,
   чем чёрно отказать. Иначе деньги откатываются.

2. **Callback НЕ содержит split/clearing данных.** Callback подтверждает
   только факт оплаты клиента. Чтобы узнать когда деньги физически дошли
   аптекам — нужен отдельный `GET /payment/{uuid}` (поле `clearing` с
   `ClearingModel[]`).

3. **Идемпотентность по `uuid`.** Multicard может прислать один и тот же
   callback несколько раз (retry на наш timeout). Наш handler должен
   быть идемпотентным — повторный callback с тем же `uuid` возвращает
   success без повторной обработки. В v2 это решено через
   `markPaidAtomically` (race-fix).

4. **IP origin** — `195.158.26.90` (per docs section 10).

### 3.7 ClearingModel — отслеживание выплат на recipient

```
GET /payment/{uuid}
→ data.clearing[]: ClearingModel[]
```

Каждый `ClearingModel`:
```typescript
{
  id: number;
  merchant: MerchantModel;             // наш платформенный
  recipient_info: MerchantAccount;     // получатель split
  sender_info: MerchantAccount;        // мы (отправитель)
  purpose_code: string;
  amount: number;                      // тийины
  details: string;
  status: 'new' | 'sent' | 'done' | 'repeat' | 'postponed' | 'blocked' | 'revert' | 'canceled';
  payment_time: string;
  added_on: string;
  updated_on: string;
  receipt_url: string;                 // банковская квитанция
}
```

**Status enum:**
- `new` — clearing создан, ещё не отправлен.
- `sent` — отправлен в банк.
- `done` — выплата выполнена (деньги у получателя).
- `repeat` — нужна повторная попытка.
- `postponed` — отложен (банк закрыт / выходной).
- `blocked` — **заблокирован** (e.g. recipient.active = false).
- `revert` — отозван (refund).
- `canceled` — отменён.

### 3.8 MerchantAccount

```
GET /payment/merchant-account/{uuid}
→ data: MerchantAccount
```

```typescript
{
  id: number;
  uuid: string;                  // recipient в split[]
  tin: string;                   // ИНН компании
  official_name: string;
  mfo: string;                   // банковский МФО
  account_no: string;            // расчётный счёт
  address?: string;
  director?: string;
  director_pinfl?: string;
  vat_payer: boolean | null;
  is_commitent: boolean | null;  // комитент Multicard
  active: number;                // 1 = активен. 0 = выплаты НЕ ИДУТ.
  contract_no?: string;
  contract_date?: string;
  tax_contract_begin?: string;
  tax_contract_end?: string;
}
```

**КРИТИЧНО:** `active` flag. Если `active === 0` (или `false`) — Multicard
не будет выплачивать средства этому recipient'у. Onboarding-валидация
обязана проверять `active === 1` через `GET /payment/merchant-account/{uuid}`
ДО сохранения UUID в нашу БД.

Также при добавлении аптеки нужно сверять:
- `tin` matches заявленный аптекой
- `account_no` matches заявленный
- `active === 1`

Защита от типов опечаток и от попытки указать чужой счёт.

### 3.9 Refunds

#### Полный возврат
```
DELETE /payment/{uuid}
```
Откатывает всю транзакцию. Поведение для split-транзакции в docs не
описано (предполагаем — откат у всех recipients синхронно, нужно verify).

#### Частичный возврат
```
DELETE /payment/{uuid}/partial
Body: {
  refund_amount: int,        // в тийинах
  ofd: [...],                // новый фискальный чек
  card_pan?: string          // для платежей через приложения (Payme/Click/Uzum)
}
```

Из docs:
> "Для получения доступа к частичному возврату требуется настройка
> терминала со стороны Multicard."

Partial refund **не работает out-of-the-box** — требует активации в
Multicard support.

Поведение partial refund + split в docs **не описано** (открытый вопрос).

### 3.10 Holding

```
POST /payment/hold      — создать заявку
PATCH /payment/hold/{id}/confirm  — подтвердить (списать)
DELETE /payment/hold/{id}         — отменить
```

Поддерживает `split[]` в payload. Срок холда до 30 дней. Может пригодиться
для cash-on-delivery flow (списать только когда товар доставлен).

### 3.11 History endpoints

```
GET /payment/store/{store_id}/history          — реестр платежей
GET /payment/store/{store_id}/credit-history   — реестр выплат на карты
```

Нужны для reconciliation cron / админки.

### 3.12 Платёжные системы

`payment_system` для альтернативных каналов (Payme/Click/Uzum/...):
```
POST /payment
Body: { payment_system: 'payme' | 'click' | 'uzum' | ... }
```

Пока не наш приоритет (картный flow покрывает MVP).

---

## 4. Текущее состояние реализации в dorify-v2

### 4.1 Что уже сделано (commits до 2026-05-08)

#### `PR #4` (merged) — AES + real Multicard adapter

`apps/api/src/modules/payment/`:
- **`infrastructure/multicard/multicard.adapter.ts`** — реализация
  `PaymentGatewayPort`. Auth + cache, createInvoice, getInvoiceStatus,
  verifyCallbackSignature (timing-safe).
- **`application/payment.service.ts`** — orchestration:
  - `createInvoice(orderId, buyerId)` — создаёт Payment, вызывает adapter,
    сохраняет checkoutUrl.
  - `processCallback(callback)` — verify signature → атомарный
    `markPaidAtomically` → `PaymentConfirmedEvent`.
- **`application/event-handlers/on-payment-confirmed.handler.ts`** —
  слушает event, `order.confirm()`.
- **AES-256-GCM** в `core/crypto/encryption.service.ts` — шифрует
  `pharmacy.multicardSecret` at rest. ENCRYPTION_KEY env var.

#### `PR #6` (open, ждёт merge) — Frontend payment flow

- `apps/web/src/features/checkout/ui/CheckoutPage.tsx` — после
  `ordersApi.place` (single-pharmacy) вызывает `paymentsApi.create` →
  `window.location.href = checkoutUrl`. **Multi-pharmacy carts остаются
  на старом поведении (orders → /orders) — degraded path.**
- `apps/web/src/features/payment/ui/PaymentResultPage.tsx` — polling
  `/payments/order/:orderId` каждые 2с до 60с. UI states:
  pending/PAID/FAILED/timeout/error/missing-orderId.
- Backend: `WEB_URL` env, `returnUrl` в payload createInvoice
  (sanitized + encodeURIComponent), `getPaymentByOrder` теперь возвращает
  `null` явно (не undefined).

### 4.2 Архитектура (current — per-pharmacy merchant)

```
prisma/schema.prisma:
  Pharmacy:
    multicardAppId     String?
    multicardStoreId   String?
    multicardSecret    String?  // AES-encrypted "iv:authTag:ciphertext" base64
    paymentEnabled     Boolean

  Payment:
    pharmacyId   String  // 1:1 with one pharmacy
    orderId      String
    invoiceId    String  unique
    status       PaymentStatus
    checkoutUrl  String?
    amount       Decimal
```

В этой модели:
- Каждая аптека — самостоятельный Multicard merchant (свой application_id,
  secret, store_id).
- При checkout создаётся **один Payment per Order per Pharmacy**.
- Multi-pharmacy cart → N orders → N payments → N redirects (degraded).

### 4.3 Что v2 делает ЛУЧШЕ чем v1 dorify

| | v1 dorify | v2 |
|---|---|---|
| Шифрование секрета в БД | plaintext | **AES-256-GCM** ✓ |
| Signature compare | `===` | **timingSafeEqual** ✓ |
| Callback race | non-atomic | **markPaidAtomically** ✓ |
| Return URL | от клиента | **server-side** из env ✓ |
| OFD missing codes | silent zeros | **throw early** ✓ |
| Order confirmation | в той же tx | **DomainEvent → handler** (DDD) ✓ |
| Type safety | `Record<string, unknown>` | strong port/adapter ✓ |

### 4.4 Что v2 РЕГРЕССИРОВАЛ относительно v1

🔴 **Не имеет retry на Multicard fetch.** v1 имел `fetchWithRetry` с
exp backoff (3 попытки). v2 — single fetch. **Real prod gap.**

🔴 **Не передаёт `X-Idempotency-Key`.** v1 передавал `invoiceId` как
idempotency key. v2 — нет. Без него retry → второй invoice → double
charge potential. **Critical для финансов.**

⚠️ **Token response fallback.** v1 поддерживал и `data.token`, и
`data.data.token`. v2 — только `data.token`. Если Multicard поменяет
формат — v2 сломается.

⚠️ **Per-pharmacy `apiUrl`.** v1 поддерживал per-credentials override.
v2 — глобальный `MULTICARD_API_URL`. Не сможем mix sandbox + prod
аптек.

⚠️ **Invoice ID format.** v1: `ORD-YYYYMMDDHHmmSS-RANDOM6` (human-readable
для recon в Multicard dashboard). v2: cuid (`cm9xy3z4...`).

⚠️ **`order.paymentUrl` не сохраняется.** v1 копировал checkoutUrl в
order, v2 — только в payment. Усложняет «retry оплаты с /orders».

⚠️ **Throttler не исключает callback.** Global rate limit 100/min в
`app.module.ts`. Multicard может слать burst > 100/min → потеря
callbacks. **Real bug.**

🔴 **Pre-existing bug:** `paymentService.createInvoice` создаёт **второй
PENDING payment row** при retry (если existing не PAID). Без
idempotency-key Multicard также создаст второй invoice → потенциальное
double charging.

---

## 5. Reference: marketplace-multicard (multicard-v1) — что почерпнули

GitHub repo (cloned в `/tmp/multicard-v1/`) — Captain's pet project,
архитектурное research. **Не для прямого копирования**, но содержит
правильные паттерны:

### 5.1 Структура

```
src/
├── routes/         # cart, callback, checkout, product, vendor
├── services/
│   ├── payment/
│   │   ├── multicard.js     # adapter с retry, idempotency, request-id
│   │   └── provider.js      # абстракция (можно подменить)
│   └── marketplace/
│       └── order.js          # orchestration с split[] generation
├── utils/
│   ├── signature.js          # MD5 + HMAC-SHA256 ready
│   └── ofd.js                # buildOfd с TIN + VAT validation
├── middleware/   # auth, error, async
└── models/db.js  # SQLite schema
```

### 5.2 Что показал

1. **Native Multicard split** действительно работает — это не теория.
2. **OFD с `tin` per-item** — стандартный паттерн.
3. **Retry с jitter + retry-able status codes** (429, 500-504, ECONNABORTED).
4. **Idempotency-Key + Request-Id headers** — обязательны.
5. **Endpoint fallback** `/payment/invoice` → `/payment` на 404/405.
6. **Token response fallback** для робастности к API изменениям.
7. **Merchant account verification** через
   `GET /payment/merchant-account/{uuid}` при vendor onboarding.
8. **Amount validation в callback** (`callback.amount === order.amount`)
   как defense-in-depth.

### 5.3 Что в multicard-v1 хуже чем у нас (НЕ копировать)

Из его собственного `SECURITY_DEBT.md`:
- Plaintext JWT_SECRET fallback (мы делаем fail-fast).
- Plain string compare на signature (мы используем timingSafeEqual).
- Echo error.message клиенту (мы маскируем в production).
- Multicard response в БД без scrubbing (хранит PAN — у нас не делаем).

### 5.4 Lessons applicable к нашему v2

См. секцию **8. Phase 4 closure** ниже. Все эти fixes — independent
от архитектурного pivot.

---

## 6. Архитектурный pivot — Per-pharmacy → Platform-as-merchant + Split

### 6.1 Сравнение моделей

| Аспект | Model A (current) | Model B (pivot, recommended) |
|---|---|---|
| Multicard credentials | Per-pharmacy (appId/store/secret) | Platform-only (один комплект) |
| Encryption | AES для каждой `pharmacy.multicardSecret` | AES для одного env-var (или просто env с Vault) |
| Multi-pharmacy cart | N invoices, N redirects (degraded) | 1 invoice, 1 redirect (split) |
| OFD `tin` | один tin per pharmacy | разные tin в одном `ofd[]` |
| Pharmacy onboarding | KYC как полный merchant Multicard (тяжело) | KYC только banking account → `merchant_account_uuid` (легче) |
| Refund flow | Per-pharmacy invoice | Один invoice, partial refund per recipient |
| Платформенная комиссия | Manually invoice от аптеки | Auto-deducted из split (Multicard рассчитывает) |
| Деньги "проходят через" платформу | Нет (напрямую к аптеке) | Нет (Multicard разносит сам) |
| Юр. статус платформы | Marketplace без агентских функций | Marketplace + Multicard как клиринг |

### 6.2 Преимущества Model B

✅ **Один редирект** для cart любого размера.
✅ **Низкий барьер для аптек:** не нужна полная merchant-регистрация в
   Multicard, только привязка счёта-получателя.
✅ **Корректная фискализация:** OFD с `tin` каждой аптеки → каждая
   позиция чека привязана к её ИНН.
✅ **Платформенная комиссия автоматически** — Multicard вычисляет
   разницу `amount - Σ split[].amount`.
✅ **Платформа не держит чужих средств** — Multicard переводит
   recipients напрямую (нет статуса платёжного агента).

### 6.3 Цена pivot

- Schema migration (Pharmacy entity + Payment entity).
- Refactor payment.service.ts (~50% переписать).
- Refactor multicard.adapter.ts (`split[]` поддержка).
- Pharmacy onboarding flow (новый — verify через `GET merchant-account`).
- Frontend упрощение (убрать single-vs-multi pharmacy branch).
- Tests update.

**Estimate:** 4-5 дней.

### 6.4 Что НЕ меняется при pivot

- AES-256-GCM encryption — keep для платформенного secret.
- timingSafeEqual signature compare — keep.
- markPaidAtomically race-fix — расширить на cart-level.
- Hexagonal architecture (PaymentGatewayPort) — keep, port расширяется.
- TelegramAuthGuard / Throttler / общая infrastructure — keep.

### 6.5 Что блокирует pivot

Пока — **только операционные задачи Captain'а**:
1. Регистрация Dorify-platform в Multicard как merchant — **сделано** (creds есть).
2. Запросить у Multicard support подтверждение split-функции на нашем
   merchant — pending (PDF подготовлен, Captain отправит).
3. Юридическая консультация (постановление КМ № 885 от 26.12.2024 о
   маркетплейсах в УЗ) — pending.
4. Onboarding процедура для аптек (получение `merchant_account_uuid`) —
   нужно понять с Multicard как это делается технически и юридически.

---

## 7. Open questions to Multicard support

Подготовлен PDF:
`/Users/avangard/Desktop/marketplace-payment-inquiry.pdf`

Содержит:
- Описание сценария (marketplace + split).
- Главный вопрос: реализуема ли схема в нашем merchant'е.
- 7 уточнений: автоматическое распределение остатка, T+? clearing,
  лимит recipients, refund flow для split, partial refund активация,
  sandbox split, KYC для аптек.

PDF универсальный — подходит для отправки также в Click / Payme / Uzum
(если решим расширить platforms). Логика split не Multicard-specific.

---

## 8. Phase 4 closure (Tier 1 #3 per HANDOFF) — независимо от pivot

Эти fixes работают **в обеих моделях** (per-pharmacy или platform+split).
Их можно сделать без ожидания операционных вопросов.

### 8.1 IP whitelist на /payments/callback

**Проблема:** callback endpoint имеет `@Public()`. Любой может
обратиться к нему (signature защищает от forge, но IP whitelist —
defense-in-depth).

**Решение:**
- Env: `MULTICARD_CALLBACK_IPS` (default `'195.158.26.90'`,
  comma-separated, env-overridable).
- Custom guard `MulticardCallbackIpGuard` в
  `apps/api/src/modules/payment/infrastructure/guards/`.
- `@UseGuards(MulticardCallbackIpGuard)` на `@Post('callback')`.
- Корректное извлечение IP за Caddy (X-Forwarded-For + trust proxy в
  `main.ts`).
- Тесты: unit (allowed/blocked), e2e (mock callback с разными IP).

**Estimate:** ~30 LOC + tests.

### 8.2 Idempotency-Key + Retry в multicard.adapter

**Проблема:** см. секцию 4.4 — single fetch без idempotency.

**Решение:**
- Добавить `X-Idempotency-Key: invoiceId` header в createInvoice.
- Добавить `X-Request-Id: crypto.randomUUID()` для tracing.
- Реализовать `fetchWithRetry` с exp backoff + jitter:
  - 3 попытки.
  - Retry на статус-кодах 429, 500, 502, 503, 504.
  - Retry на `ECONNABORTED`, `ETIMEDOUT`, `ECONNRESET`, `EAI_AGAIN`,
    `ENETUNREACH`.
  - Не retry на 4xx (кроме 429).
  - Base delay 300ms, exp factor 2, + jitter 0-100ms.
- Token response fallback (`data.token ?? data.data?.token`).

**Estimate:** ~60 LOC.

### 8.3 Amount validation в callback

**Проблема:** callback verify подписи но не проверяет что `callback.amount`
равно `payment.amount`. Ошибка / атака может прийти как valid signature
с заниженной суммой.

**Решение:** в `processCallback` после signature verify добавить:
```ts
if (callback.amount !== payment.amount.toTiyin()) {
  this.logger.error(`Amount mismatch: ${callback.amount} vs ${expected}`);
  throw new BadRequestException('Amount mismatch');
}
```

**Estimate:** ~5 LOC.

### 8.4 Throttler skip для /payments/callback

**Проблема:** global ThrottlerModule (100/min) включает callback. Multicard
burst > 100/min → 429 → потеря callback'а → reverse платежа.

**Решение:** `@SkipThrottle()` на callback endpoint. Или конфиг ThrottlerModule
с пер-route override.

**Estimate:** ~3 LOC.

### 8.5 OFD validation в ordering domain

**Проблема:** сейчас OFD validation throw'ится в multicard.adapter (если
`mxik` или `package_code` отсутствуют). Это происходит ПОЗДНО — после order
create → invoice create → throw. UX плохой: пользователь думает «не
получилось оплатить», а на самом деле товар у аптеки кривой.

**Решение:** в `ordering` domain при `Order.create`:
```ts
if (pharmacy.hasMulticardCredentials()) {
  for (const item of orderItems) {
    if (!item.product.ikpu || !item.product.packageCode) {
      throw new DomainError(
        `Product ${item.product.name} missing OFD codes`
      );
    }
  }
}
```

Captain decision (REVIEWER-LOG Session 1) уже зафиксировал это поведение.

**Estimate:** ~30 LOC + тесты domain.

### 8.6 Reconcile cron на PENDING > 10 min

**Проблема:** если callback не дошёл (network blip, наш downtime),
PENDING Payment остаётся вечно. Нужно периодически проверять статус
через `getInvoiceStatus`.

**Решение:**
- Add deps: `@nestjs/schedule`.
- `ScheduleModule.forRoot()` в AppModule.
- `PaymentReconcileScheduler` в `payment/application/`:
  ```ts
  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcilePendingPayments() {
    const stalePayments = await this.paymentRepo.findStalePending(10);
    for (const payment of stalePayments) {
      const status = await this.gateway.getInvoiceStatus(...);
      if (status === 'PAID') {
        // emulate callback processing
      } else if (status === 'FAILED') {
        await this.paymentRepo.markFailed(payment.id);
      }
    }
  }
  ```

**Estimate:** ~150 LOC + tests.

### 8.7 Reuse existing PENDING payment

**Проблема:** см. секцию 4.4 — pre-existing bug: повторный `createInvoice`
для same orderId создаёт второй PENDING payment.

**Решение:**
```ts
const existing = await this.paymentRepo.findByOrderId(orderId);
if (existing?.isPaid()) return existing;
if (existing?.isPending()) {
  // вернуть существующий с тем же checkoutUrl
  return this.toResponse(existing);
}
// иначе создать новый
```

**Estimate:** ~10 LOC.

### 8.8 Bundle (предложение PRs)

| PR | Содержание | Effort | Priority |
|---|---|---|---|
| PR #7 | IP whitelist + Throttler skip | 1 час | security/correctness |
| PR #8 | Idempotency-Key + Retry + Amount validation | 4 часа | financial integrity |
| PR #9 | OFD validation в ordering | 4 часа | UX correctness |
| PR #10 | Reconcile cron | 1 день | hygiene |
| PR #11 | Reuse existing PENDING payment | 30 мин | financial integrity |

Можно сделать как 5 atomic PRs или bundle PR #7+#8+#11 (security/financial
core). Решает Captain.

---

## 9. План split-pivot (когда решим)

> Применяется только если Captain после Multicard support ответа
> подтверждает split-availability и согласен с операционными требованиями.

### 9.1 Schema changes

```sql
-- migration: pharmacy-multicard-pivot
ALTER TABLE pharmacy ADD COLUMN multicard_merchant_uuid VARCHAR(36);
ALTER TABLE pharmacy ADD COLUMN tin VARCHAR(14);
ALTER TABLE pharmacy ADD COLUMN commission_percent DECIMAL(5, 2) DEFAULT 5.00;

-- Удалять old credentials НЕ СРАЗУ — может быть переходный период
-- ALTER TABLE pharmacy DROP COLUMN multicard_app_id;
-- ALTER TABLE pharmacy DROP COLUMN multicard_store_id;
-- ALTER TABLE pharmacy DROP COLUMN multicard_secret;

-- Payment теперь связан с cart (N orders), не с одним order
CREATE TABLE cart_payment (
  id            UUID PRIMARY KEY,
  buyer_id      VARCHAR(36),
  amount        DECIMAL(15, 2),
  status        payment_status_enum,
  invoice_id    VARCHAR(255) UNIQUE,
  external_uuid VARCHAR(36),
  checkout_url  TEXT,
  return_url    TEXT,
  callback_url  TEXT,
  metadata      JSONB,
  paid_at       TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW()
);

ALTER TABLE order ADD COLUMN cart_payment_id UUID REFERENCES cart_payment(id);

-- legacy Payment table deprecated, сохраняем для history
```

### 9.2 Env changes

```env
# Add (platform-level)
MULTICARD_APPLICATION_ID=...
MULTICARD_SECRET=...        # AES-encrypted в .env? Or via secret manager
MULTICARD_STORE_ID=...

# Remove (per-pharmacy fields в БД больше не нужны)

# Existing keep
ENCRYPTION_KEY=...           # для AES платформенного secret
WEB_URL=https://app.dorify.uz
MULTICARD_API_URL=https://mesh.multicard.uz   # prod (default остаётся sandbox)
MULTICARD_CALLBACK_URL=...
MULTICARD_CALLBACK_IPS=195.158.26.90
PLATFORM_COMMISSION_PERCENT=5
```

### 9.3 Adapter changes

```typescript
// PaymentGatewayPort расширяется
interface CreateInvoiceParams {
  invoiceId: string;
  amount: number;
  description: string;
  callbackUrl: string;
  returnUrl?: string;
  items: OfdItem[];        // с tin per-item
  split?: SplitItem[];     // НОВОЕ
}

interface SplitItem {
  type: 'account';
  amount: number;          // tiyin
  details: string;
  recipient: string;       // merchant_account_uuid
}

// Adapter использует platform credentials, а не per-pharmacy
class MulticardAdapter {
  async createInvoice(params: CreateInvoiceParams) {
    // creds из global config, не из params
    const credentials = {
      appId: config.MULTICARD_APPLICATION_ID,
      secret: this.encryption.decrypt(config.MULTICARD_SECRET),
      storeId: config.MULTICARD_STORE_ID,
    };
    // ...
  }
}
```

### 9.4 Service changes

```typescript
class PaymentService {
  // Вместо createInvoice(orderId, buyerId)
  // → createCartPayment(cartItems, buyerId)
  async createCartPayment(cart: Cart, buyerId: string) {
    // 1. Group cart items by pharmacy
    const byPharmacy = groupBy(cart.items, 'pharmacyId');

    // 2. Create N orders (one per pharmacy)
    const orders = [];
    for (const [pharmacyId, items] of byPharmacy) {
      const order = await this.orderService.create({
        pharmacyId, buyerId, items, ...
      });
      orders.push(order);
    }

    // 3. Build OFD items с tin per item
    const ofd = cart.items.map(item => ({
      mxik: item.product.ikpu,
      package_code: item.product.packageCode,
      qty: item.quantity,
      price: item.product.price.toTiyin(),
      total: item.subtotal.toTiyin(),
      name: item.product.name,
      tin: item.pharmacy.tin,         // ← разные tin в одном ofd[]
      vat: 12,
    }));

    // 4. Build split[] per pharmacy
    const split = orders.map(order => {
      const pharmacy = order.pharmacy;
      const grossTiyin = order.totalAmount.toTiyin();
      const commissionTiyin = Math.round(
        grossTiyin * pharmacy.commissionPercent / 100
      );
      const netTiyin = grossTiyin - commissionTiyin;
      return {
        type: 'account' as const,
        recipient: pharmacy.multicardMerchantUuid,
        amount: netTiyin,
        details: `Выплата ${pharmacy.name} по заказу ${order.id}`,
      };
    });

    // 5. Create cart_payment
    const payment = await this.paymentRepo.create({
      buyerId,
      amount: cart.totalAmount,
      ...
    });

    // 6. Call Multicard
    const result = await this.gateway.createInvoice({
      invoiceId: payment.invoiceId,
      amount: cart.totalAmount.toTiyin(),
      callbackUrl: ...,
      returnUrl: `${config.WEB_URL}/payment/result?paymentId=${payment.id}`,
      items: ofd,
      split,
    });

    // 7. Link orders to payment, save checkout URL
    for (const order of orders) {
      await this.orderRepo.linkPayment(order.id, payment.id);
    }
    await this.paymentRepo.update(payment.id, {
      externalUuid: result.invoiceId,
      checkoutUrl: result.checkoutUrl,
    });

    return { paymentId: payment.id, checkoutUrl: result.checkoutUrl };
  }

  async processCallback(callback: CallbackData) {
    // verify signature → markPaidAtomically (cart-level) →
    // подтверждать ВСЕ orders связанные с этим payment →
    // emit PaymentConfirmedEvent per order
  }

  async getClearingStatus(paymentUuid: string) {
    // GET /payment/{uuid} → ClearingModel[]
    // Возвращает per-recipient статус выплат для админ панели
  }
}
```

### 9.5 Pharmacy onboarding flow (новый)

```typescript
async addPharmacyMerchantUuid(
  pharmacyId: string,
  merchantUuid: string,
) {
  // 1. Verify через Multicard
  const accountInfo = await this.gateway.getMerchantAccountInfo(merchantUuid);

  // 2. Sanity checks
  if (accountInfo.active !== 1) {
    throw new BadRequestException('Multicard account неактивен');
  }

  const pharmacy = await this.pharmacyRepo.findById(pharmacyId);
  if (accountInfo.tin !== pharmacy.tin) {
    throw new BadRequestException(
      `TIN mismatch: pharmacy ${pharmacy.tin} vs Multicard ${accountInfo.tin}`
    );
  }

  // 3. Сохраняем
  await this.pharmacyRepo.update(pharmacyId, {
    multicardMerchantUuid: merchantUuid,
    paymentEnabled: true,
  });
}
```

### 9.6 Frontend упрощение

`CheckoutPage.tsx` — убрать single-vs-multi-pharmacy branch:
```typescript
// БЫЛО (degraded multi-pharmacy)
if (isSinglePharmacy) {
  const payment = await paymentsApi.create(orderId);
  redirect(payment.checkoutUrl);
} else {
  // multi-pharmacy fallback to /orders без redirect
}

// СТАНЕТ (всегда single redirect)
const payment = await paymentsApi.createCart(cartItems);
redirect(payment.checkoutUrl);
```

### 9.7 Tests

- Unit: split[] generation correctness (sum, commission, recipient).
- Unit: OFD с разными tin per item.
- Integration: callback подтверждает все orders в cart.
- Integration: pharmacy onboarding с merchant_account verification.
- E2E: checkout с multi-pharmacy cart → один redirect → callback →
  все orders PAID.

### 9.8 Rollout strategy

Две стадии:
1. **Code merge** с feature flag `USE_PLATFORM_SPLIT`. Default = false
   (per-pharmacy). Schema добавляет новые поля, не удаляет старые.
2. **Pharmacy migration**: для каждой аптеки сохранить
   `multicardMerchantUuid`. Когда все аптеки готовы — flip flag → on.
3. **Cleanup**: удалить per-pharmacy fields из schema.

---

## 10. Open Captain decisions (Multicard-related)

| # | Решение | Status |
|---|---|---|
| 1 | Architecture: per-pharmacy vs platform+split | **Pivot** выбран Captain'ом |
| 2 | Сейчас pivot или паузу + Tier 2/3? | **Пауза** (2026-05-08) |
| 3 | Phase 4 closure (8.1-8.7) — bundle или split PRs? | Не решено |
| 4 | После pivot — feature flag rollout или big-bang? | Не решено |
| 5 | Pharmacy onboarding: panel UI или admin SQL? | Не решено |
| 6 | Refund admin UI — нужно или CLI достаточно? | Не решено |

---

## 11. Operational tasks (для Captain)

Чтобы pivot стартовал, Captain должен:

1. **Multicard support — отправить PDF inquiry.**
   `~/Desktop/marketplace-payment-inquiry.pdf`. Получить подтверждение
   split-доступности на платформенном merchant.

2. **Юр. consultation** про маркетплейс по постановлению КМ № 885 от
   26.12.2024. Вероятно ОК (split = не агентская схема), но verify.

3. **Procedure для pharmacy onboarding** — вместе с Multicard понять как
   аптеки получают `merchant_account_uuid`. Документы, сроки, цена.

4. **Решить: feature flag или big-bang.**

5. **Sandbox testing** — создать тестовую pharmacy с тестовым
   `merchant_account_uuid` в dev-mesh.

---

## 12. Ссылки и материалы

### 12.1 Документация
- [docs.multicard.uz](https://docs.multicard.uz/) — sitemap.xml содержит
  все 58 разделов.
- `docs/MULTICARD_API_DOCUMENTATION.md` — local snapshot (untracked).

### 12.2 Reference repos
- `~/Workspace/projects/dorify/dorify-backend/src/services/multicard/`
- `/tmp/multicard-v1/` (clone of github.com/temrjan/multicard-v1)

### 12.3 Code в dorify-v2 (точки внимания)
- `apps/api/src/modules/payment/infrastructure/multicard/multicard.adapter.ts`
- `apps/api/src/modules/payment/application/payment.service.ts`
- `apps/api/src/modules/payment/infrastructure/controllers/payment.controller.ts`
- `apps/api/src/core/crypto/encryption.service.ts`
- `apps/api/src/core/config/env.config.ts`
- `apps/web/src/features/checkout/ui/CheckoutPage.tsx`
- `apps/web/src/features/payment/ui/PaymentResultPage.tsx`
- `apps/web/src/shared/api/payments.ts`

### 12.4 Outgoing inquiry
- `~/Desktop/marketplace-payment-inquiry.pdf` — подготовлен для отправки
  в Multicard / Click / Payme / Uzum support. Generic формулировки,
  один лист A4.

---

## 13. Версии и история

| Дата | Что |
|---|---|
| 2026-05-07 | PR #4 merged (AES + real Multicard adapter). |
| 2026-05-07 | PR #5, #6 opened (handoff doc, frontend payment flow). |
| 2026-05-08 | Multicard research session — analysed dorify-v1, multicard-v1, docs.multicard.uz, prepared inquiry PDF. Captain поставил Multicard на паузу. |
| 2026-05-08 (late) | PR #5, #6, #8 merged. PR #7 (CI hardening), #9 (bot WEBAPP_URL → app.dorify.uz), #10 (CORS default → prod domains) merged. Server env updates: `WEBAPP_URL`, `ALLOWED_ORIGINS`. Captain pause to design pass — `docs/design/POLISH_PLAN.md`. |

---

*Документ обновляется когда Captain решает вернуться к Multicard.
Если структура устарела относительно кода — обновить раздел 4
("Текущее состояние") в первую очередь.*
