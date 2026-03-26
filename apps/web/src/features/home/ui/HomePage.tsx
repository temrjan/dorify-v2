import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Input, Chip, Spinner, Card, Text } from '@telegram-apps/telegram-ui';
import { useState } from 'react';
import { productsApi } from '@shared/api/products';
import { PriceTag } from '@shared/ui/PriceTag';

const CATEGORIES = ['Все', 'Лекарства', 'Витамины', 'Косметика', 'БАД', 'Гигиена'];

export default function HomePage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('Все');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['products', category, search],
    queryFn: () => productsApi.list({
      category: category === 'Все' ? undefined : category,
      search: search || undefined,
      limit: 20,
    }),
  });

  return (
    <div className="min-h-screen">
      {/* Banner */}
      <div className="mx-4 mt-4 rounded-2xl bg-gradient-to-br from-dorify-primary-dark to-dorify-primary p-5 text-white">
        <Text className="text-white font-bold text-lg">Dorify</Text>
        <Text className="text-white/80 text-sm mt-1">
          Лекарства с доставкой из ближайших аптек
        </Text>
      </div>

      {/* Search */}
      <div className="px-4 mt-4">
        <Input
          placeholder="Поиск лекарств..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 px-4 mt-3 overflow-x-auto no-scrollbar">
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

      {/* Products */}
      <div className="px-4 mt-4 pb-4">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="m" />
          </div>
        ) : !data?.items.length ? (
          <div className="text-center py-10 text-tg-hint">
            Товары не найдены
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {data.items.map((product) => (
              <Card
                key={product.id}
                className="cursor-pointer"
                onClick={() => navigate(`/product/${product.id}`)}
              >
                <div className="p-3">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-32 object-cover rounded-xl mb-2"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-32 bg-dorify-primary-light rounded-xl mb-2 flex items-center justify-center text-3xl">
                      💊
                    </div>
                  )}
                  <Text className="text-sm font-medium line-clamp-2">
                    {product.name}
                  </Text>
                  {product.manufacturer && (
                    <Text className="text-xs text-tg-hint mt-0.5">
                      {product.manufacturer}
                    </Text>
                  )}
                  <div className="mt-2">
                    <PriceTag amount={product.price} className="text-sm" />
                  </div>
                  {!product.isAvailable && (
                    <span className="text-xs text-dorify-secondary font-medium">
                      Нет в наличии
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
