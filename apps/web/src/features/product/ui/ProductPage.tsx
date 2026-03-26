import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Spinner, Text } from '@telegram-apps/telegram-ui';
import { useState, useEffect } from 'react';
import { productsApi } from '@shared/api/products';
import { useCartStore } from '@shared/stores/cartStore';
import { PriceTag } from '@shared/ui/PriceTag';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.getById(id!),
    enabled: !!id,
  });

  // BackButton
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.BackButton.show();
    const handler = () => navigate(-1);
    tg?.BackButton.onClick(handler);
    return () => {
      tg?.BackButton.offClick(handler);
      tg?.BackButton.hide();
    };
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="m" />
      </div>
    );
  }

  if (!product) {
    return <div className="text-center py-20 text-tg-hint">Товар не найден</div>;
  }

  const handleAdd = () => {
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="pb-24">
      {/* Image */}
      {product.imageUrl ? (
        <img src={product.imageUrl} alt={product.name} className="w-full h-64 object-cover" />
      ) : (
        <div className="w-full h-64 bg-dorify-primary-light flex items-center justify-center text-6xl">
          💊
        </div>
      )}

      <div className="p-4">
        {/* Name & Price */}
        <Text className="text-xl font-bold">{product.name}</Text>
        <div className="mt-2">
          <PriceTag amount={product.price} className="text-xl" />
        </div>

        {/* Meta */}
        {product.manufacturer && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-tg-hint text-sm">Производитель:</span>
            <span className="text-sm">{product.manufacturer}</span>
          </div>
        )}
        {product.activeSubstance && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-tg-hint text-sm">Действующее вещество:</span>
            <span className="text-sm">{product.activeSubstance}</span>
          </div>
        )}
        {product.requiresPrescription && (
          <div className="mt-2 px-3 py-1.5 bg-dorify-secondary-light text-dorify-secondary rounded-lg text-xs font-medium inline-block">
            По рецепту
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="mt-4">
            <Text className="text-tg-hint text-sm font-medium mb-1">Описание</Text>
            <Text className="text-sm">{product.description}</Text>
          </div>
        )}

        {/* Stock */}
        <div className="mt-4 text-sm text-tg-hint">
          {product.isAvailable ? `В наличии: ${product.stock} шт` : 'Нет в наличии'}
        </div>

        {/* Quantity + Add to cart */}
        {product.isAvailable && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-tg-bg border-t border-gray-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-tg-secondary rounded-xl px-3 py-2">
                <button
                  className="w-8 h-8 flex items-center justify-center text-lg font-bold text-tg-hint"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  −
                </button>
                <span className="w-8 text-center font-medium">{quantity}</span>
                <button
                  className="w-8 h-8 flex items-center justify-center text-lg font-bold text-dorify-primary"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                >
                  +
                </button>
              </div>
              <Button
                mode="filled"
                size="l"
                stretched
                onClick={handleAdd}
                className="!bg-dorify-primary"
              >
                {added ? '✓ Добавлено' : `В корзину · ${new Intl.NumberFormat('uz-UZ').format(product.price * quantity)} сум`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
