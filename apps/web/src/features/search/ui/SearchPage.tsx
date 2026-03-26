import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Input, Spinner, Text } from '@telegram-apps/telegram-ui';
import { productsApi } from '@shared/api/products';
import { PriceTag } from '@shared/ui/PriceTag';

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: () => productsApi.list({ search: query, limit: 30 }),
    enabled: query.length >= 2,
  });

  return (
    <div className="px-4 pt-4 pb-4">
      <Input
        placeholder="Поиск лекарств, витаминов..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {query.length < 2 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-tg-hint">
          <span className="text-4xl mb-3">🔍</span>
          <Text>Введите название лекарства</Text>
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {['Парацетамол', 'Ибупрофен', 'Витамин D', 'Омега-3'].map((hint) => (
              <button
                key={hint}
                className="px-3 py-1.5 bg-dorify-primary-light text-dorify-primary-dark rounded-full text-sm"
                onClick={() => setQuery(hint)}
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size="m" />
        </div>
      ) : !data?.items.length ? (
        <div className="text-center py-10 text-tg-hint">
          Ничего не найдено по "{query}"
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {data.items.map((product) => (
            <div
              key={product.id}
              className="bg-tg-section rounded-xl p-3 flex gap-3 cursor-pointer active:opacity-70"
              onClick={() => navigate(`/product/${product.id}`)}
            >
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-dorify-primary-light flex items-center justify-center text-xl flex-shrink-0">
                  💊
                </div>
              )}
              <div className="flex-1 min-w-0">
                <Text className="text-sm font-medium line-clamp-1">{product.name}</Text>
                {product.manufacturer && (
                  <Text className="text-xs text-tg-hint">{product.manufacturer}</Text>
                )}
                <PriceTag amount={product.price} className="text-sm mt-1" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
