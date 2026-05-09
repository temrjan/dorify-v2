# Design Pass — UI Polish Plan

> Создан 2026-05-08 в финале Session 2.
> **Session 3 (2026-05-09): большая часть scope выполнена** — см. ✅ маркеры
> ниже. PR #12-#22 закрыли foundation, HomePage, BottomNav, pharmacy pages,
> theme system, profile, cart, catalog. Что осталось — отмечено ⏳.

## Status (Session 3 close)

| Block | Status |
|---|---|
| Component library (Skeleton/EmptyState/Pill + extended icons) | ✅ PR #12 |
| HomePage redesign | ✅ PR #13 |
| BottomNav polish | ✅ PR #13, #17 |
| Pharmacy pages (PharmacyHomePage, ProductsListPage, ProductFormPage, ProductCard, ProductStatusBadge) | ✅ PR #15 |
| Theme adaptive + override (toggle, persist) | ✅ PR #16, #17, #19 |
| Profile tab | ✅ PR #17 |
| Cart redesign + clickable items | ✅ PR #20, #21 |
| Catalog rename + master categories | ✅ PR #22 |
| TabBar bg unification | ✅ PR #17, #19 |
| iOS safe-area handling | ✅ PR #16, #17 |
| Seed для visual smoke | ✅ PR #14 |
| OrdersPage redesign | ⏳ pending (старый стиль) |
| ProductPage review | ⏳ pending (старый стиль) |
| Checkout / PaymentResult minor polish | ⏳ pending (sticky bars work, visuals OK) |

---

## ⚡ TL;DR

- **Scope:** все pharmacy-relevant pages + buyer flow (HomePage, Cart, Checkout, PaymentResult). Visual + interaction polish.
- **Out of scope:** новая бизнес-функциональность, новые routes, изменения backend, перепаковка зависимостей, замена UI library.
- **Constraints:** на base — `@telegram-apps/telegram-ui` 2.x; theme variables — Telegram color scheme (light/dark auto). Не ломать responsive — TWA узкий (375-430px width на mobile).
- **Estimate:** 2-3 рабочих дня (один coherent PR or split на 2-3).

---

## Что Captain видит сейчас (baseline)

См. screenshots в Session 2 транскрипте 2026-05-08:

- HomePage: gradient banner Dorify, search input, chips категорий, grid товаров (пустой). Visually OK но «плоский».
- SearchPage: input + magnifier emoji + suggestion chips. Чистый, не выделяющийся.
- ProductsListPage (pharmacy): header «Мои товары» + кнопка «+ Добавить» + search + status dropdown + список карточек. Довольно скудно с empty state «Не удалось загрузить».
- ProductFormPage: dark inputs на светлом фоне, плотно сжатые поля без секций.
- Bottom navigation: 4 tab'a с базовыми иконками. Active tab — highlighted blue, others — gray.

Captain feedback: **«дизайн нормальный сделать»** — request на качественный pass, не косметику.

---

## Принципы

1. **Telegram-нативный feel.** Pages должны выглядеть как первоклассный Telegram WebApp, а не сайт-в-iframe. Использовать Telegram theme vars, иконки в Telegram-стиле.
2. **Hierarchy через spacing + size**, не через цвет. Telegram users привыкли к minimal UI.
3. **Status communication** — каждое async состояние (loading/empty/error/timeout) имеет дизайн-ответ.
4. **Action affordances** — primary actions visually weighty, secondary subdued, destructive — explicit (red + confirm dialog).
5. **Mobile-first.** 375-430px wide. Single-column. Thumb-reachable bottom-aligned CTAs.

---

## Tasks per page

### 1. HomePage (`apps/web/src/features/home/ui/HomePage.tsx`)

**Сейчас:** `bg-gradient-to-br from-dorify-primary-dark to-dorify-primary` rounded-2xl banner + Input + chips + grid Card'ов с emoji-fallback.

**Pass:**
- Banner: hero card с **subtle pattern** (или illustration), не плоский gradient. Заголовок «Dorify» с описанием на 1-2 строки.
- Search bar: sticky под header при scroll. С magnifier icon left, clear (×) right когда есть text.
- Chips «Все/Лекарства/...»: horizontal scroll, активная — filled, остальные — outline. Без double-tap zoom (touch-action: manipulation).
- Product grid:
  - Skeleton cards (4-6 штук) пока loading вместо плоского Spinner.
  - Card design: white bg, rounded-xl, shadow-sm, image w-full aspect-square sm rounded-lg, name (max 2 строки), price prominent, manufacturer subdued. Tap → product page.
  - Out-of-stock: opacity 0.6 + ribbon «Нет в наличии».
- Empty state «Товары не найдены»: иконка / 💊 emoji centered, text «Ничего не нашли», CTA «Сбросить фильтры» если есть filter.

### 2. SearchPage (`apps/web/src/features/search/ui/SearchPage.tsx`)

**Сейчас:** input + magnifier emoji + 4 suggestion chip'а.

**Pass:**
- Input с прикреплённой иконкой левее.
- Suggestion chips: переименовать в «Популярные запросы» с подзаголовком.
- Recent searches (если есть Zustand store для них) — выше suggestions.
- Real-time search results с skeleton.
- Empty state — иллюстрация (magnifying glass) + «Ничего не найдено», без emoji.

### 3. CartPage (`apps/web/src/features/cart/ui/CartPage.tsx`)

**Сейчас:** список карточек товаров с +/-/× и сумма.

**Pass:**
- Empty state: иллюстрация корзины, CTA «Перейти к покупкам» → HomePage.
- Group by pharmacy с разделителями + название аптеки + ИНН (после Multicard pivot).
- Sticky bottom: total + «Оформить» button.
- Swipe-to-delete на карточке (или ×-button с confirm).
- Quantity stepper: больше тачабельный (44×44px).

### 4. CheckoutPage (`apps/web/src/features/checkout/ui/CheckoutPage.tsx`)

**Сейчас:** контактные данные input (телефон), delivery type buttons, summary, fixed-bottom submit.

**Pass:**
- Section dividers: «Контакт» / «Доставка» / «Заказ» как card-секции с заголовками.
- Delivery type — proper radio cards (не plain buttons), с иконками.
- Address input анимированно появляется при выборе DELIVERY.
- Summary: item count + total + commission breakdown (после Multicard split).
- Submit button: full-width, sticky bottom с safe-area-inset для iOS.
- Loading state submit: button disabled + Spinner внутри.

### 5. PaymentResultPage (`apps/web/src/features/payment/ui/PaymentResultPage.tsx`)

**Сейчас:** Spinner + «Подтверждаем оплату...» / success / failed / timeout.

**Pass:**
- Pending: animated progress dots или Spinner с описательным текстом + estimated time.
- Success: green checkmark animation + «Оплата прошла» + receipt link prominent.
- Failed: red X + «Не удалось» + retry CTA + поддержка ссылка.
- Timeout: clock icon + «Платёж обрабатывается» + manual recheck button.
- BackButton wired на /orders (уже есть).

### 6. PharmacyHomePage (`apps/web/src/features/pharmacy-panel/ui/PharmacyHomePage.tsx`)

**Сейчас:** 4 plain card с заголовком + описанием. Disabled — opacity 50%.

**Pass:**
- Каждая card имеет **icon left** (📦 для товаров, 🛒 заказов, 💳 оплаты, 🏪 профиля — но без emoji, лучше SVG иконки).
- Disabled: tag «Скоро» в углу + reduced opacity.
- Hover/active: shadow-md elevation + slight scale.
- Optional: pharmacy stats card сверху («15 товаров, 3 на модерации, 2 ожидают оплаты»).

### 7. ProductsListPage (`apps/web/src/features/pharmacy-panel/ui/products/ProductsListPage.tsx`)

**Сейчас:** header + search + status dropdown + product cards + pagination + confirm dialog.

**Pass:**
- Header: title + count badge («Мои товары · 12») + sticky-on-scroll.
- Filter row: search left, status pill-dropdown right (не full-width select).
- Status dropdown как **chip carousel** (как на HomePage) вместо dropdown — быстрее тач.
- Product cards: improved layout (image left, body right, status pill top-right, kebab menu вместо ×).
- Empty state: illustration + CTA «Добавить первый товар» (уже есть).
- Pagination: «Загрузить ещё» button или infinite scroll вместо prev/next кнопок.
- Toast: better positioning (bottom, не top), green/red bg appropriate.

### 8. ProductFormPage (`apps/web/src/features/pharmacy-panel/ui/products/ProductFormPage.tsx`)

**Сейчас:** plain stack полей с labels, OFD accordion, fixed-bottom submit.

**Pass:**
- Section cards: «Основное» (name+price+description+category) / «Характеристики» (active substance, manufacturer, barcode, stock) / «Изображение» (URL + preview) / «OFD» (collapsible, как сейчас).
- Sticky preview панель сверху — миниатюра товара как будет выглядеть на HomePage.
- Image preview: drop zone (даже без upload — иллюстрация места).
- Form errors: inline под полем + summary banner на top если errors > 1.
- Save button: «Сохранить и опубликовать», secondary — «Сохранить как черновик».

### 9. Bottom Navigation (`apps/web/src/app/Layout.tsx`)

**Сейчас:** 4 tab'а с базовыми иконками (видны как 3-line, magnifier, cart, box).

**Pass:**
- Modern outlined → filled icon когда активный.
- Lebels на 1 строке, без обрезки.
- Hidden на pharmacy-panel routes (там свой context).
- Safe area inset bottom для iOS.

---

## Component library additions

Создать `apps/web/src/shared/ui/`:

- `SkeletonCard.tsx` — placeholder для loading product card.
- `EmptyState.tsx` — generic empty с slot для icon/illustration + title + description + optional CTA.
- `Pill.tsx` — multi-purpose pill (status, count, tag).
- `Toast.tsx` — single toast component (вместо inline в ProductsListPage).
- `IconButton.tsx` — touch-friendly 44×44 icon button с aria-label.
- `BottomSheet.tsx` — для confirm dialogs, replace inline overlay в ProductsListPage.

Иконки:
- Использовать [lucide-react](https://lucide.dev/) (lightweight tree-shakable) или Telegram Icons из `@telegram-apps/telegram-ui` если они есть.
- Decision: prefer существующие telegram-ui icons если covers, иначе lucide-react (~3KB per icon).

---

## Theme

`apps/web/src/index.css` или `tailwind.config.js`:

- **Telegram CSS vars**: использовать `var(--tg-theme-bg-color)`, `var(--tg-theme-text-color)`, `var(--tg-theme-hint-color)` через Tailwind tokens.
- **Brand accent**: `dorify-primary` оставить (gradient banner). Добавить `dorify-success`, `dorify-warning`, `dorify-error` для status pills.
- **Typography scale**: разделение `display` (banner), `title` (page header), `body`, `caption`. Сейчас всё через Tailwind text-{size}.
- **Spacing rhythm**: 4px base, 8 / 12 / 16 / 24 / 32 / 48px scale.
- **Shadows**: `sm` для cards, `md` для elevation hover, `lg` для bottom sheets.

---

## Что НЕ trogать

- `@telegram-apps/telegram-ui` core components (Button, Input, Spinner, Text). Использовать as base, кастомизировать через wrapper.
- Backend logic — без изменений.
- Existing routes / API endpoints — без изменений.
- Zustand stores (cart) — без изменений.
- Project standards (named exports rule pending follow-up PR).

---

## Quality gates

- 4 gates green: api+web type-check, lint, tests, build.
- `/typescript-review` skill на diff (PR ≥100 LOC).
- Manual smoke в TWA — visual regression check (compare before/after screenshots).
- Lighthouse audit мобильный (баланс UX score).

---

## Captain decisions нужны (для plan-check)

1. **Иконки library:** `@telegram-apps/telegram-ui` icons если хватает, или добавить lucide-react?
2. **One PR vs split?** Один coherent (~2 дня) — easier review-bundle. Split (2-3) — atomic per page section. Recommend split.
3. **Telegram theme integration:** активно использовать Telegram CSS vars (light/dark auto) или фикснуть свой brand theme (force light/dark)?
4. **Skeleton complexity:** simple grey blocks или shimmer animation (немного больше CSS)?

---

## Estimate breakdown

| Кусок | Время |
|---|---|
| Component library (Skeleton, EmptyState, Pill, Toast, BottomSheet) | 4 часа |
| HomePage redesign | 4 часа |
| ProductsListPage + ProductCard polish | 3 часа |
| ProductFormPage sections + sticky preview | 4 часа |
| PharmacyHomePage cards с иконками | 1 час |
| CheckoutPage section cards + delivery radio | 2 часа |
| PaymentResultPage states polish | 2 часа |
| SearchPage + CartPage minor | 2 часа |
| BottomNav иконки + safe-area | 1 час |
| Theme tokens + spacing scale | 2 часа |
| Manual smoke + iteration | 3 часа |
| **Total** | **~28 часов = 3 рабочих дня** |

---

## Reference inspiration

Хорошо сделанные Telegram Mini Apps как референс:
- @wallet (Telegram Wallet) — minimal navigation, иконки + cards.
- @durov_dance (gallery TWA) — typography hierarchy.
- DurgerKing (TWA demo) — bottom navigation pattern.

Внешние:
- iOS HIG cards / lists — spacing rhythm.
- Stripe Connect onboarding flow — section forms на mobile.

---

## On session start (для design pass)

```bash
# 1. State + handoff
cat .claude/workflow-state.json
cat docs/ENGINEER-HANDOFF.md

# 2. Этот план
cat docs/design/POLISH_PLAN.md

# 3. /codex skill для bootstrap react/typescript/telegram-miniapp standards
# 4. Спросить Captain: «4 plan-check decisions выше — какие?»
# 5. После approve plan'а — переход planning → coding (Iron Law #4)
```

Recommended sequence:
1. Component library first (foundation).
2. HomePage + bottom nav (most visible to buyer).
3. Pharmacy panel pages (Captain's primary smoke target).
4. Checkout + Payment result (less frequent но critical UX).
5. Polish + smoke.

---

*Дизайн-пасс — это не cosmetics. Это разница между «работает» и «приятно пользоваться».*
