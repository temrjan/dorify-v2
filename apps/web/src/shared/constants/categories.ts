/**
 * Master список категорий товаров.
 *
 * UI-only enforcement: backend (`category: z.string().max(100)`) принимает
 * любую строку. Pharmacy через UI выбирает только из этого списка, что
 * предотвращает fragmentation. Если в БД попадёт значение вне списка
 * (legacy / direct API call) — отобразится в карточке товара, но не
 * совпадёт с filter chips → товар не виден через category filter.
 *
 * Чтобы расширить — добавь сюда новую запись + commit. Авто-deploy
 * подхватит на всех trex поверхностях (HomePage chips, CatalogPage grid,
 * ProductFormPage select).
 *
 * Учтены seed-категории из apps/api/prisma/seed.ts:
 * Жаропонижающие, Витамины, Антибиотики, Обезболивающие, БАД.
 */

export interface CategoryDef {
  /** Slug = label в БД (хранится в Product.category as-is). */
  slug: string;
  /** Отображаемый emoji-icon для chips / grid. */
  emoji: string;
}

export const CATEGORIES: readonly CategoryDef[] = [
  // Терапевтические группы
  { slug: 'Антибиотики', emoji: '💊' },
  { slug: 'Обезболивающие', emoji: '🩹' },
  { slug: 'Жаропонижающие', emoji: '🌡️' },
  { slug: 'Противовирусные', emoji: '🦠' },
  { slug: 'Сердечно-сосудистые', emoji: '❤️' },
  { slug: 'Желудочно-кишечные', emoji: '🍽️' },
  { slug: 'Аллергия', emoji: '🤧' },

  // Профилактика и витамины
  { slug: 'Витамины', emoji: '🍊' },
  { slug: 'БАД', emoji: '🥬' },
  { slug: 'Иммуностимуляторы', emoji: '🛡️' },

  // Уход и косметика
  { slug: 'Косметика', emoji: '💄' },
  { slug: 'Гигиена', emoji: '🧼' },
  { slug: 'Уход за кожей', emoji: '🧴' },

  // Прочее
  { slug: 'Медицинские изделия', emoji: '🩺' },
  { slug: 'Другое', emoji: '📦' },
] as const;

/** UI-only filter option (не сохраняется в БД). */
export const ALL_CATEGORIES_OPTION = 'Все' as const;
