import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input, Chip, Text } from '@telegram-apps/telegram-ui';
import { productsApi } from '@shared/api/products';
import { PriceTag } from '@shared/ui/PriceTag';
import { SkeletonCard } from '@shared/ui/Skeleton';
import { EmptyState } from '@shared/ui/EmptyState';
import { IconSearch, IconPackage } from '@shared/ui/icons';
import type { Product } from '@shared/types';

const CATEGORIES = ['Все', 'Лекарства', 'Витамины', 'Косметика', 'БАД', 'Гигиена'];
const SKELETON_COUNT = 6;

export default function HomePage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('Все');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['products', category, search],
    queryFn: () =>
      productsApi.list({
        category: category === 'Все' ? undefined : category,
        search: search || undefined,
        limit: 20,
      }),
  });

  const items = data?.items ?? [];

  return (
    <div className="min-h-screen pb-4">
      {/* Hero */}
      <div className="px-4 pt-4">
        <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-dorify-primary-dark to-dorify-primary p-5 text-white shadow-card">
          <div
            aria-hidden="true"
            className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-8 -left-4 h-24 w-24 rounded-full bg-white/10 blur-xl"
          />
          <div className="relative">
            <Text className="!text-white !font-bold !text-xl block">Dorify</Text>
            <Text className="!text-white/85 !text-sm mt-1 block">
              Лекарства с доставкой из ближайших аптек
            </Text>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="sticky top-0 z-10 bg-tg-secondary px-4 pt-3 pb-2">
        <div className="relative">
          <IconSearch
            width={18}
            height={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-tg-hint pointer-events-none"
          />
          <Input
            placeholder="Поиск лекарств..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 px-4 pt-2 overflow-x-auto no-scrollbar">
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            mode={category === cat ? 'elevated' : 'mono'}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </Chip>
        ))}
      </div>

      {/* Body */}
      <div className="px-4 mt-4">
        {isLoading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {isError && (
          <EmptyState
            icon={<IconPackage width={48} height={48} />}
            title="Не удалось загрузить"
            description="Проверьте соединение и попробуйте ещё раз."
            action={
              <button
                type="button"
                onClick={() => refetch()}
                className="px-5 py-2.5 rounded-full bg-dorify-primary text-white text-sm font-medium active:opacity-80"
              >
                Повторить
              </button>
            }
          />
        )}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={<IconPackage width={48} height={48} />}
            title="Товары не найдены"
            description={
              search || category !== 'Все'
                ? 'По вашему запросу ничего не нашли. Попробуйте изменить фильтры.'
                : 'Каталог пока пуст. Скоро появятся первые товары.'
            }
            action={
              search || category !== 'Все' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCategory('Все');
                  }}
                  className="px-5 py-2.5 rounded-full bg-dorify-primary text-white text-sm font-medium active:opacity-80"
                >
                  Сбросить фильтры
                </button>
              ) : undefined
            }
          />
        )}

        {!isLoading && items.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => navigate(`/product/${product.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

function ProductCard({ product, onClick }: ProductCardProps) {
  const unavailable = !product.isAvailable || product.stock === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-tg-section rounded-card shadow-card p-3 transition active:scale-[0.98] ${
        unavailable ? 'opacity-60' : ''
      }`}
    >
      <div className="relative w-full aspect-square mb-2">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover rounded-lg"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full rounded-lg bg-dorify-primary-light flex items-center justify-center">
            <IconPackage width={32} height={32} className="text-dorify-primary" />
          </div>
        )}
        {unavailable && (
          <span className="absolute top-1.5 left-1.5 bg-tg-bg/95 text-tg-hint text-[10px] font-medium px-2 py-0.5 rounded-full">
            Нет в наличии
          </span>
        )}
      </div>
      <div className="text-sm font-medium line-clamp-2 leading-tight min-h-[2.5em]">
        {product.name}
      </div>
      {product.manufacturer && (
        <div className="text-xs text-tg-hint mt-0.5 line-clamp-1">{product.manufacturer}</div>
      )}
      <div className="mt-2">
        <PriceTag amount={product.price} className="text-sm font-semibold" />
      </div>
    </button>
  );
}
