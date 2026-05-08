# Multicard Payment Gateway API

> Полная документация по интеграции с платежным шлюзом Multicard

---

## Содержание

1. [Введение](#1-введение)
2. [Авторизация](#2-авторизация)
3. [Оплата на платежной странице Multicard](#3-оплата-на-платежной-странице-multicard)
4. [Привязка карт (форма)](#4-привязка-карт-форма)
5. [Привязка карт (API)](#5-привязка-карт-api)
6. [Оплата на странице Партнера](#6-оплата-на-странице-партнера)
7. [Холдирование](#7-холдирование)
8. [Выплаты на карту (Payouts)](#8-выплаты-на-карту-payouts)
9. [Дополнительные методы](#9-дополнительные-методы)
10. [Справочники](#10-справочники)

---

## 1. Введение

### Среды

| Среда | URL |
|-------|-----|
| **Sandbox** (тестовая) | `https://dev-mesh.multicard.uz/` |
| **Production** (боевая) | `https://mesh.multicard.uz/` |

### Тестовые данные

| Номер карты | Срок действия | Статус |
|-------------|---------------|--------|
| `8600492998494476` | `2601` | Активна |
| `8600303655375959` | `2603` | Заблокирована |

**OTP-код для песочницы:** `112233`

### Формат ответов API

Все запросы и ответы в формате **JSON**.

**Успешный ответ:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Ответ с ошибкой:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_FIELDS",
    "details": "Поле store_id является обязательным"
  }
}
```

### Статусы платежей

| Статус | Описание |
|--------|----------|
| `draft` | Не подтверждена |
| `progress` | В процессе списания |
| `billing` | Отправка в биллинг |
| `success` | Успешно завершена |
| `error` | Ошибка |
| `revert` | Возврат средств |
| `hold` | Холдирование |

---

## 2. Авторизация

### Получение токена

**POST** `/auth`

Токен действителен **24 часа**. Рекомендуется кешировать токен, а не запрашивать новый перед каждым запросом.

**Заголовки:**
```
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "application_id": "rhmt_test",
  "secret": "Pw18axeBFo8V7NamKHXX"
}
```

**Успешный ответ (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "dev",
  "expiry": "2023-03-18 16:40:31"
}
```

**Ошибка (400):**
```json
{
  "errors": [{"message": [{"message": "Invalid Credentials"}]}]
}
```

### Использование токена

Все последующие запросы требуют заголовок:
```
Authorization: Bearer {token}
```
или
```
X-Access-Token: {token}
```

---

## 3. Оплата на платежной странице Multicard

### 3.1 Создание инвойса

**POST** `/payment/invoice`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `store_id` | string | Да | ID кассы от Multicard |
| `amount` | integer | Да | Сумма в тийинах |
| `invoice_id` | string | Да | ID заказа в системе партнера (макс. 255) |
| `callback_url` | string | Да | URL для callback-запроса |
| `ofd` | array | Да | Данные для фискального чека |
| `lang` | string | Нет | Язык: `ru`, `uz`, `en` |
| `return_url` | string | Нет | URL после успешной оплаты |
| `return_error_url` | string | Нет | URL после неудачной оплаты |
| `sms` | string | Нет | Номер телефона `998XXXXXXXXX` |

**Структура ofd (товары):**

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `qty` | integer | Да | Количество |
| `price` | integer | Да | Цена за единицу в тийинах |
| `mxik` | string | Да | ИКПУ из tasnif.soliq.uz |
| `package_code` | string | Да | Код упаковки |
| `name` | string | Да | Наименование товара |
| `total` | integer | Нет | Общая сумма |
| `vat` | integer | Нет | НДС (%) |
| `tin` | string | Нет | ИНН компании |

**Пример запроса:**
```json
{
  "store_id": "6",
  "amount": 500000,
  "invoice_id": "ORDER-123",
  "callback_url": "https://example.com/callback",
  "return_url": "https://example.com/success",
  "lang": "ru",
  "ofd": [
    {
      "qty": 1,
      "price": 500000,
      "mxik": "06401004002000000",
      "package_code": "1506113",
      "name": "Товар"
    }
  ]
}
```

**Успешный ответ (200):**
```json
{
  "success": true,
  "data": {
    "uuid": "f6339f31-6a09-11f0-9a1b-00505680eaf6",
    "store_id": 6,
    "amount": 500000,
    "invoice_id": "ORDER-123",
    "checkout_url": "https://app.rhmt.uz/invoice/f6339f31-6a09-11f0-9a1b-00505680eaf6",
    "short_link": "https://l.multicard.uz/1m1e12",
    "deeplink": "https://multicard.app/payments/checkout/...",
    "added_on": "2025-07-26 15:19:06"
  }
}
```

### 3.2 Получение информации об инвойсе

**GET** `/payment/invoice/{uuid}`

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "uuid": "527b7ead-b587-11f0-af7c-005056b4367d",
    "store_id": 123,
    "amount": 100000,
    "invoice_id": "ORDER-123",
    "checkout_url": "https://example.com/checkout",
    "payment": {
      "id": 1,
      "uuid": "uuid-value",
      "status": "success",
      "total_amount": 100000
    }
  }
}
```

### 3.3 Удаление (аннулирование) инвойса

**DELETE** `/payment/invoice/{uuid}`

Можно удалить только **неоплаченные** инвойсы.

**Успешный ответ:**
```json
{
  "success": true,
  "data": []
}
```

**Ошибка (платёж завершён):**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_FIELDS",
    "details": "Транзакция по инвойсу завершена. Запросите детали платежа"
  }
}
```

### 3.4 Быстрая оплата (PaymeGo, ClickPass и др.)

**PUT** `/payment/{uuid}/scanpay`

Поддерживаемые системы: Payme, Click, Uzum, Anorbank, Xazna

| Параметр | Тип | Описание |
|----------|-----|----------|
| `code` | string | Считанный код из приложения |

**Пример запроса:**
```json
{
  "code": "50512"
}
```

### 3.5 Callback (success)

Multicard отправляет POST-запрос на `callback_url` после успешной оплаты.

**IP отправителя:** `195.158.26.90`

| Параметр | Тип | Описание |
|----------|-----|----------|
| `store_id` | integer | ID кассы |
| `amount` | integer | Сумма в тийинах |
| `invoice_id` | string | ID заказа партнера |
| `billing_id` | string | ID транзакции в системе партнера |
| `payment_time` | string | Время платежа (YYYY-mm-dd H:i:s) |
| `phone` | string | Номер плательщика |
| `card_pan` | string | Маскированный номер карты |
| `ps` | string | Платёжная система |
| `card_token` | string | Токен карты |
| `uuid` | string | ID транзакции в Multicard |
| `receipt_url` | string | Ссылка на чек |
| `sign` | string | MD5: `{store_id}{invoice_id}{amount}{secret}` |

**Пример callback:**
```json
{
  "store_id": 6,
  "amount": 20000,
  "invoice_id": "2024864028760",
  "billing_id": "20241214242009869794410864028760",
  "payment_time": "2024-12-14 14:36:31",
  "phone": "998930601725",
  "card_pan": "860030******5959",
  "ps": "uzcard",
  "card_token": "6225f3c93f7a880142782fa4",
  "uuid": "e60d8ebc-b9fe-11ef-b159-005056b4367d",
  "sign": "553b4292b0f1d8e0e18e6daeb3af3761"
}
```

**Требуемый ответ:**
```
HTTP 200
{"success": true}
```

### 3.6 Callback (webhooks)

Webhook отправляется при изменении статуса платежа.

| Параметр | Тип | Описание |
|----------|-----|----------|
| `uuid` | string | ID транзакции в Multicard |
| `status` | string | Статус: draft, progress, success, error, revert, hold |
| `sign` | string | SHA1: `{uuid}{invoice_id}{amount}{secret}` |

**При ошибке:** запрос повторится до 5 раз.

---

## 4. Привязка карт (форма)

### 4.1 Получение ссылки на страницу привязки

**POST** `/payment/card/bind`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `redirect_url` | string | Да | URL после успешной привязки |
| `redirect_decline_url` | string | Да | URL при отмене/ошибке |
| `store_id` | integer | Да | ID кассы |
| `callback_url` | string | Да | Webhook при успешной привязке |
| `phone` | string | Да | Номер телефона `998XXXXXXXXX` |
| `pinfl` | string | Нет | ПИНФЛ клиента (14 символов) |

**Пример запроса:**
```json
{
  "redirect_url": "https://site.uz/success.html",
  "redirect_decline_url": "https://site.uz/decline.html",
  "store_id": 6,
  "callback_url": "https://site.uz/card-callback",
  "phone": "998901234567"
}
```

**Успешный ответ:**
```json
{
  "success": true,
  "data": {
    "session_id": "67f8dd24e9800",
    "form_url": "https://dev-checkout.multicard.uz/card/67f8dd24e9800"
  }
}
```

### 4.2 Callback привязки карты

| Параметр | Тип | Описание |
|----------|-----|----------|
| `payer_id` | string | session_id из ответа привязки |
| `card_pan` | string | Маскированный номер |
| `card_token` | string | Токен для платежей |
| `phone` | string | Номер телефона |
| `holder_name` | string | Имя держателя |
| `ps` | string | Платёжная система |
| `status` | string | active, draft, deleted |

### 4.3 Проверка состояния привязки

**GET** `/payment/card/bind/{session_id}`

Время действия session_id — **15 минут**.

### 4.4 Получение информации о карте по токену

**GET** `/payment/card/{card_token}`

### 4.5 Проверка принадлежности карты к ПИНФЛ

**POST** `/payment/card/check-pinfl`

```json
{
  "pan": "8600303655375959",
  "pinfl": "12345678901234"
}
```

**Ответ:**
- `data: true` — ПИНФЛ соответствует
- `data: false` — не соответствует
- `data: null` — неизвестно

### 4.6 Аннулирование токена карты

**DELETE** `/payment/card/{card_token}`

---

## 5. Привязка карт (API)

### 5.1 Добавление карты с помощью карточных данных

**POST** `/payment/card`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `pan` | string | Да | Номер карты (Uzcard/Humo) |
| `expiry` | string | Да | Срок действия (yymm) |
| `user_phone` | string | Да | Телефон `998XXXXXXXXX` |
| `cvc` | string | Нет | CVC код |
| `holder_name` | string | Нет | Имя владельца |
| `pinfl` | string | Нет | ПИНФЛ (14 символов) |

**Пример запроса:**
```json
{
  "pan": "8600303655375959",
  "expiry": "2603",
  "user_phone": "998901234567"
}
```

**Ответ (статус draft, требуется OTP):**
```json
{
  "success": true,
  "data": {
    "id": 55,
    "card_pan": "860030******5959",
    "card_token": "6225f3c93f7a110142782fa4",
    "ps": "uzcard",
    "status": "draft"
  }
}
```

**Коды ошибок:**

| Код | Описание |
|-----|----------|
| `ERROR_CARD_SMS` | На карте не подключено SMS |
| `ERROR_SMS_ALREADY_SENT` | SMS отправлено, повторить через 2 мин |
| `ERROR_CARD_NOT_FOUND` | Неверные данные карты |
| `CARD_NOT_SUPPORTED` | Карта не поддерживается |

### 5.2 Подтверждение привязки

**PUT** `/payment/card/{card_token}`

```json
{
  "otp": "112233"
}
```

**Ошибки:**
- `400` — Неверный OTP
- `423` — OTP истёк

---

## 6. Оплата на странице Партнера

### 6.1 Создание платежа по токену карты

**POST** `/payment`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `card.token` | string | Да | Токен карты |
| `amount` | integer | Да | Сумма в тийинах |
| `store_id` | integer | Да | ID кассы |
| `invoice_id` | string | Да | ID заказа |
| `callback_url` | string | Нет | URL для callback |
| `device_details.ip` | string | Нет | IP клиента |
| `device_details.user_agent` | string | Нет | User-Agent |
| `ofd` | array | Нет | Данные для фискализации |

**Пример:**
```json
{
  "card": {"token": "6225f3c93f7a880142782fa4"},
  "amount": 50000,
  "store_id": 6,
  "invoice_id": "test",
  "callback_url": "https://test.uz/callback",
  "device_details": {
    "ip": "177.14.322.11",
    "user_agent": "Mozilla/5.0..."
  }
}
```

### 6.2 Создание платежа с карточными данными

**POST** `/payment`

```json
{
  "card": {"pan": "8600313260861293", "expiry": "2602"},
  "amount": 50000,
  "store_id": 6,
  "invoice_id": "test"
}
```

### 6.3 Создание расщеплённого платежа (Split)

**POST** `/payment`

| Параметр | Тип | Описание |
|----------|-----|----------|
| `split[].type` | string | `account`, `wallet`, `card` |
| `split[].amount` | integer | Сумма |
| `split[].details` | string | Описание |
| `split[].recipient` | string | UUID реквизитов (для account) |

**Пример:**
```json
{
  "amount": 100000,
  "store_id": 6,
  "invoice_id": "test",
  "split": [
    {
      "type": "account",
      "recipient": "5378f655-ae41-11ee-97a8-005056b4367d",
      "amount": 88000,
      "details": "Оплата товаров по заказу #123"
    }
  ]
}
```

### 6.4 Создание платежа через Payme/Click/Uzum

**POST** `/payment`

| Параметр | Тип | Описание |
|----------|-----|----------|
| `payment_system` | string | payme, click, uzum, anorbank, alif, oson, xazna, beepul, trastpay, sbp |

**Пример:**
```json
{
  "payment_system": "payme",
  "amount": 50000,
  "store_id": 6,
  "invoice_id": "test"
}
```

**Ответ содержит `checkout_url` для перехода в приложение.**

### 6.5 Подтверждение платежа

**PUT** `/payment/{payment_uuid}`

| Параметр | Тип | Описание |
|----------|-----|----------|
| `otp` | string | Одноразовый пароль |
| `debit_available` | boolean | При true списывается доступная сумма |

```json
{
  "otp": "112233",
  "debit_available": false
}
```

### 6.6 Отправка фискальной ссылки

**PATCH** `/payment/{payment_uuid}/fiscal`

Используется когда фискализация на стороне партнера.

```json
{
  "url": "https://ofd.soliq.uz/..."
}
```

### 6.7 Отмена платежа (полный возврат)

**DELETE** `/payment/{uuid}`

### 6.8 Частичный возврат

**DELETE** `/payment/{uuid}/partial`

| Параметр | Тип | Описание |
|----------|-----|----------|
| `card_pan` | string | Полный номер карты (для платежей через приложения) |
| `refund_amount` | integer | Сумма возврата в тийинах |
| `ofd` | array | Данные для нового фискального чека |

```json
{
  "card_pan": "8600010000001234",
  "refund_amount": 22244100,
  "ofd": [
    {
      "name": "Бензин марки A80",
      "mxik": "02710001003000000",
      "package_code": "1282118",
      "price": 795000,
      "qty": 1,
      "total": 1605900
    }
  ]
}
```

### 6.9 Получение информации о платеже

**GET** `/payment/{uuid}`

---

## 7. Холдирование

Блокировка средств на карте без списания. Срок холда — до 30 дней.

### 7.1 Создание заявки на холдирование

**POST** `/payment/hold`

| Параметр | Тип | Описание |
|----------|-----|----------|
| `card.token` | string | Токен карты |
| `amount` | integer | Сумма в тийинах |
| `store_id` | integer | ID кассы |
| `invoice_id` | string | ID заказа |
| `expiry` | integer | Срок действия в минутах (1-43200) |
| `split` | array | Схема распределения (опционально) |

**Пример:**
```json
{
  "card": {"token": "6225f3c93f7a880142782fa4"},
  "amount": 10000000,
  "store_id": 15,
  "invoice_id": "18177",
  "expiry": 43200
}
```

**Ответ (статус draft):**
```json
{
  "success": true,
  "data": {
    "id": 753967,
    "status": "draft",
    "expiry": "2025-03-08 23:12:15"
  }
}
```

### 7.2 Подтверждение холдирования (блокировка средств)

**PUT** `/payment/hold/{payment_uuid}`

```json
{
  "otp": "112233"
}
```

**Статус становится `active`.**

### 7.3 Списание захолдированных средств

**PUT** `/payment/hold/{payment_uuid}/charge`

Можно списать меньше захолдированной суммы.

```json
{
  "amount": 100000
}
```

### 7.4 Получение информации о холдировании

**GET** `/payment/hold/{payment_uuid}`

### 7.5 Отмена холдирования (разблокировка)

**DELETE** `/payment/hold/{payment_uuid}`

Возвращает средства на карту клиента до истечения срока.

**Ошибка (холд не активен):**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_PAYMENT_APPLIED",
    "details": "Холд не активен"
  }
}
```

---

## 8. Выплаты на карту (Payouts)

### 8.1 Создание выплаты

**POST** `/payment/credit`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `card.pan` | string | Да* | Номер карты |
| `card.token` | string | Да* | Или токен карты |
| `amount` | integer | Да | Сумма в тийинах |
| `store_id` | string | Да | ID кассы |
| `invoice_id` | string | Да | ID операции |
| `confirmable` | boolean | Да | Требуется подтверждение |
| `device_details` | object | Да | IP и user_agent |
| `kyc_data` | object | Да** | KYC данные |

*Одно из двух: `pan` или `token`

**Обязательно для сумм свыше 10 млн сум

**Структура kyc_data:**
```json
{
  "last_name": "BOLTAYEV",
  "first_name": "ALISHER",
  "middle_name": "MUMINOVICH",
  "passport": "AD21234567",
  "pinfl": "31105892514010",
  "dob": "1989-05-11",
  "passport_expiry_date": "2025-11-17"
}
```

**Пример запроса:**
```json
{
  "card": {"pan": "8600303655375959"},
  "amount": 10000,
  "store_id": "6",
  "invoice_id": "112233",
  "confirmable": true,
  "device_details": {
    "ip": "182.19.100.10",
    "user_agent": "Mozilla/5.0..."
  }
}
```

### 8.2 Подтверждение выплаты

**PUT** `/payment/credit/{payment_uuid}`

```json
{
  "otp": "112233"
}
```

### 8.3 Получение информации о выплате

**GET** `/payment/credit/{payment_uuid}`

---

## 9. Дополнительные методы

### 9.1 Информация о приложении

**GET** `/payment/application`

Возвращает информацию о настройках приложения и балансе.

**Ключевые поля:**
- `wallet_sum` — баланс депозита в тийинах
- `wallet_overdraft` — лимит овердрафта
- `otp_length` — длина OTP

### 9.2 Реквизиты получателя

**GET** `/payment/merchant-account/{recipient}`

Возвращает банковские реквизиты для split-платежей.

### 9.3 Реестр проведённых платежей

**GET** `/payment/store/{store_id}/history`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `offset` | integer | Да | Смещение записей |
| `limit` | integer | Да | Количество записей |
| `start_date` | string | Да | Начало периода (YYYY-mm-dd H:i:s, GMT+5) |
| `end_date` | string | Да | Конец периода |
| `only_status` | string | Нет | Фильтр по статусу |

**Пример:**
```
GET /payment/store/6/history?offset=0&limit=100&start_date=2025-03-01%2000:00:00&end_date=2025-03-02%2000:00:00&only_status=success
```

### 9.4 История выплат на карты

**GET** `/payment/store/{store_id}/credit-history`

Параметры аналогичны реестру платежей.

---

## 10. Справочники

### Платёжные системы (`ps`)

| Код | Название |
|-----|----------|
| `uzcard` | UzCard |
| `humo` | Humo |
| `visa` | Visa |
| `mastercard` | MasterCard |
| `unionpay` | UnionPay |

### Платёжные приложения (`payment_system`)

| Код | Название |
|-----|----------|
| `payme` | Payme |
| `click` | Click |
| `uzum` | Uzum Bank |
| `anorbank` | Anor Bank |
| `alif` | Alif |
| `oson` | Oson |
| `xazna` | Xazna |
| `beepul` | Beepul |
| `trastpay` | TrastPay |
| `sbp` | СБП |

### Коды ошибок

| Код | Описание |
|-----|----------|
| `ERROR_FIELDS` | Ошибка валидации полей |
| `ERROR_CARD_NOT_FOUND` | Неверные данные карты |
| `ERROR_CARD_SMS` | На карте не подключено SMS |
| `ERROR_SMS_ALREADY_SENT` | SMS отправлено, ждите 2 мин |
| `CARD_NOT_SUPPORTED` | Карта не поддерживается |
| `ERROR_WRONG_OTP` | Неверный OTP |
| `ERROR_NOT_FOUND` | Объект не найден |
| `ERROR_ACCESS_DENIED` | Доступ запрещён |
| `ERROR_PAYMENT_APPLIED` | Платёж уже обработан |
| `ERROR_DEBIT_UNKNOWN` | Неизвестный результат списания |
| `ERROR_CALLBACK_TIMEOUT` | Таймаут callback |

### Важные замечания

1. **Все суммы в тийинах** (1 сум = 100 тийин)
2. **Временная зона** — GMT+5
3. **IP для callback** — `195.158.26.90`
4. **Формат телефона** — `998XXXXXXXXX` (12 цифр)
5. **Формат даты** — `YYYY-mm-dd H:i:s`
6. **Срок действия карты** — `yymm` (год-месяц)

---

> Документация сгенерирована на основе https://docs.multicard.uz/
