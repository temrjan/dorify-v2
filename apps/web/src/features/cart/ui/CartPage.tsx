import { useNavigate } from 'react-router-dom';
import { Button, Text } from '@telegram-apps/telegram-ui';
import { useCartStore, selectTotalItems, selectTotalPrice } from '@shared/stores/cartStore';
import { PriceTag } from '@shared/ui/PriceTag';

export default function CartPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const totalItems = useCartStore(selectTotalItems);
  const totalPrice = useCartStore(selectTotalPrice);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-tg-hint">
        <span className="text-5xl mb-4">🛒</span>
        <Text className="text-lg">Корзина пуста</Text>
        <Button mode="plain" className="mt-4" onClick={() => navigate('/')}>
          Перейти к каталогу
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4">
        <Text className="text-lg font-bold">Корзина ({totalItems})</Text>
        <button className="text-dorify-error text-sm font-medium" onClick={clearCart}>
          Очистить
        </button>
      </div>

      {/* Items */}
      <div className="px-4 mt-3 space-y-3">
        {items.map(({ product, quantity }) => (
          <div
            key={product.id}
            role="button"
            tabIndex={0}
            aria-label={`Перейти к товару ${product.name}`}
            className="bg-tg-section rounded-card shadow-card p-3 flex gap-3 cursor-pointer transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-dorify-primary"
            onClick={() => navigate(`/product/${product.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(`/product/${product.id}`);
              }
            }}
          >
            {/* Image */}
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-dorify-primary-light flex items-center justify-center text-2xl flex-shrink-0">
                💊
              </div>
            )}

            {/* Details */}
            <div className="flex-1 min-w-0">
              <Text className="text-sm font-medium line-clamp-2">{product.name}</Text>
              <PriceTag amount={product.price} className="text-sm mt-1 font-semibold" />

              <div className="flex items-center justify-between mt-2">
                <div
                  className="flex items-center gap-2 bg-tg-secondary rounded-lg px-2 py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="w-6 h-6 flex items-center justify-center text-tg-hint"
                    onClick={() => updateQuantity(product.id, quantity - 1)}
                    aria-label="Уменьшить"
                  >
                    −
                  </button>
                  <span className="text-sm font-medium w-5 text-center">{quantity}</span>
                  <button
                    className="w-6 h-6 flex items-center justify-center text-dorify-primary"
                    onClick={() => updateQuantity(product.id, quantity + 1)}
                    aria-label="Увеличить"
                  >
                    +
                  </button>
                </div>
                <button
                  className="text-dorify-error text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(product.id);
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary + CTA — inline после items. Скроллится с контентом, не fixed
       * — упрощает UX (нет collision с TabBar) и убирает magic numbers. */}
      <div className="px-4 mt-4">
        <div className="bg-tg-section rounded-card shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <Text className="text-tg-hint">Итого</Text>
            <PriceTag amount={totalPrice} className="text-lg font-semibold" />
          </div>
          <Button
            mode="filled"
            size="l"
            stretched
            onClick={() => navigate('/checkout')}
            className="!bg-dorify-primary"
          >
            Оформить заказ
          </Button>
        </div>
      </div>
    </div>
  );
}
