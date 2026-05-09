import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Input, Spinner, Text } from '@telegram-apps/telegram-ui';
import { productsApi } from '@shared/api/products';
import { PriceTag } from '@shared/ui/PriceTag';
import { EmptyState } from '@shared/ui/EmptyState';
import { IconPackage, IconSearch } from '@shared/ui/icons';
import { CATEGORIES } from '@shared/constants/categories';

const POPULAR_QUERIES = ['Парацетамол', 'Ибупрофен', 'Витамин D', 'Омега-3'];

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;
  const hasCategory = category !== null;

  const { data, isLoading } = useQuery({
    queryKey: ['catalog', trimmed, category],
    queryFn: () =>
      productsApi.list({
        search: hasQuery ? trimmed : undefined,
        category: category ?? undefined,
        limit: 30,
      }),
    enabled: hasQuery || hasCategory,
  });

  const showCategoryGrid = !hasQuery && !hasCategory;

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="relative">
        <IconSearch
          width={18}
          height={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-tg-hint pointer-events-none"
        />
        <Input
          placeholder="Поиск лекарств, витаминов..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length >= 2) {
              setCategory(null);
            }
          }}
          style={{ paddingLeft: 40 }}
        />
      </div>

      {/* Active category indicator */}
      {hasCategory && !hasQuery && (
        <div className="flex items-center justify-between mt-3 px-1">
          <Text className="text-sm font-medium">
            Категория: <span className="text-tg-link">{category}</span>
          </Text>
          <button
            type="button"
            onClick={() => setCategory(null)}
            className="text-xs text-dorify-error"
          >
            Сбросить
          </button>
        </div>
      )}

      {/* Category grid (default landing) */}
      {showCategoryGrid && (
        <>
          <Text className="text-xs uppercase tracking-wider text-tg-hint mt-5 mb-2 block px-1">
            Категории
          </Text>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => setCategory(cat.slug)}
                className="bg-tg-section rounded-card shadow-card p-3 flex items-center gap-3 transition active:scale-[0.98] text-left focus:outline-none focus:ring-2 focus:ring-dorify-primary"
              >
                <div className="text-2xl shrink-0" aria-hidden="true">{cat.emoji}</div>
                <div className="flex-1 text-sm font-medium leading-tight">{cat.slug}</div>
              </button>
            ))}
          </div>

          <Text className="text-xs uppercase tracking-wider text-tg-hint mt-6 mb-2 block px-1">
            Популярные запросы
          </Text>
          <div className="flex flex-wrap gap-2">
            {POPULAR_QUERIES.map((hint) => (
              <button
                key={hint}
                className="px-3 py-1.5 bg-dorify-primary-light text-dorify-primary-dark rounded-full text-sm"
                onClick={() => setQuery(hint)}
              >
                {hint}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Results */}
      {(hasQuery || hasCategory) && (
        <div className="mt-3">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner size="m" />
            </div>
          ) : !data?.items.length ? (
            <EmptyState
              icon={<IconPackage width={40} height={40} />}
              title={
                hasQuery
                  ? `Ничего не найдено по «${trimmed}»`
                  : 'В этой категории пока нет товаров'
              }
              description={
                hasQuery && hasCategory
                  ? 'Попробуйте изменить запрос или сбросить категорию.'
                  : undefined
              }
            />
          ) : (
            <div className="space-y-2">
              {data.items.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="w-full text-left bg-tg-section rounded-card shadow-card p-3 flex gap-3 cursor-pointer transition active:scale-[0.99]"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-tg-secondary flex items-center justify-center flex-shrink-0">
                      <IconPackage width={20} height={20} className="text-tg-hint" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <Text className="text-sm font-medium line-clamp-1">{product.name}</Text>
                    {product.manufacturer && (
                      <Text className="text-xs text-tg-hint truncate">{product.manufacturer}</Text>
                    )}
                    <PriceTag amount={product.price} className="text-sm mt-1 font-semibold" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
