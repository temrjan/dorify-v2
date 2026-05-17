import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { Button, Spinner, Text } from '@telegram-apps/telegram-ui';
import {
  useCartStore,
  selectTotalItems,
  selectTotalPrice,
  type CartItem,
} from '@shared/stores/cartStore';
import { pharmaciesApi } from '@shared/api/pharmacies';
import { PriceTag } from '@shared/ui/PriceTag';
import { IconStore, IconCard, IconAlert } from '@shared/ui/icons';
import type { Pharmacy } from '@shared/types';

interface PharmacyBlockProps {
  pharmacyId: string;
  pharmacy: Pharmacy | undefined;
  pharmacyLoading: boolean;
  items: CartItem[];
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(amount);
}

function PharmacyBlock({ pharmacyId, pharmacy, pharmacyLoading, items }: PharmacyBlockProps) {
  const navigate = useNavigate();
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const hasMulticard = pharmacy?.hasPaymentSettings ?? false;

  const handleCheckout = () => {
    if (hasMulticard) {
      navigate(`/checkout?pharmacyId=${pharmacyId}`);
    } else {
      navigate(`/inquiry/${pharmacyId}`);
    }
  };

  return (
    <section className="bg-tg-section rounded-card shadow-card mt-3 overflow-hidden">
      {/* Pharmacy header */}
      <header className="px-4 pt-3 pb-2 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-dorify-primary-light text-dorify-primary-dark flex items-center justify-center shrink-0">
          <IconStore width={18} height={18} />
        </div>
        <div className="flex-1 min-w-0">
          {pharmacyLoading ? (
            <Text className="text-sm font-medium block">Загрузка...</Text>
          ) : (
            <Text className="text-sm font-medium block truncate">
              {pharmacy?.name ?? 'Аптека'}
            </Text>
          )}
        </div>
      </header>

      {/* Items */}
      <ul className="px-3 pb-2 space-y-2">
        {items.map(({ product, quantity }) => (
          <li
            key={product.id}
            role="button"
            tabIndex={0}
            aria-label={`Открыть ${product.name}`}
            className="bg-tg-bg rounded-card p-3 flex gap-3 cursor-pointer transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-dorify-primary"
            onClick={() => navigate(`/product/${product.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(`/product/${product.id}`);
              }
            }}
          >
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-dorify-primary-light flex items-center justify-center text-2xl flex-shrink-0">
                💊
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Text className="text-sm font-medium line-clamp-2">{product.name}</Text>
              <PriceTag amount={product.price} className="text-sm mt-0.5 font-semibold" />
              <div className="flex items-center justify-between mt-2">
                <div
                  className="flex items-center gap-2 bg-tg-secondary rounded-lg px-2 py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="w-6 h-6 flex items-center justify-center text-tg-hint"
                    onClick={() => updateQuantity(product.id, quantity - 1)}
                    aria-label="Уменьшить"
                  >
                    −
                  </button>
                  <span className="text-sm font-medium w-5 text-center">{quantity}</span>
                  <button
                    type="button"
                    className="w-6 h-6 flex items-center justify-center text-dorify-primary"
                    onClick={() => updateQuantity(product.id, quantity + 1)}
                    aria-label="Увеличить"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
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
          </li>
        ))}
      </ul>

      {/* Per-pharmacy total + CTA */}
      <footer className="px-4 pb-4 pt-2 border-t border-tg-secondary/50">
        <div className="flex items-center justify-between mb-3">
          <Text className="text-tg-hint text-sm">Сумма по аптеке</Text>
          <PriceTag amount={total} className="text-base font-semibold" />
        </div>

        {!pharmacyLoading && !hasMulticard && (
          <div className="bg-dorify-warning-light text-dorify-warning rounded-card p-2 mb-3 flex items-start gap-2">
            <IconAlert width={14} height={14} className="shrink-0 mt-0.5" />
            <Text className="text-xs">
              У этой аптеки нет онлайн-оплаты — отправите заявку, продавец свяжется по телефону.
            </Text>
          </div>
        )}

        <Button
          mode="filled"
          size="l"
          stretched
          onClick={handleCheckout}
          disabled={pharmacyLoading}
          className="!bg-dorify-primary"
        >
          {pharmacyLoading ? (
            <Spinner size="s" />
          ) : hasMulticard ? (
            <span className="inline-flex items-center gap-1.5">
              <IconCard width={18} height={18} />
              Оплатить · {formatAmount(total)} сум
            </span>
          ) : (
            <span>💬 Отправить заявку · {formatAmount(total)} сум</span>
          )}
        </Button>
      </footer>
    </section>
  );
}

export default function CartPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const totalItems = useCartStore(selectTotalItems);
  const totalPrice = useCartStore(selectTotalPrice);
  // Group locally with useMemo: subscribing to a Map-building selector via
  // `useShallow` infinite-loops because the inner arrays are new every call,
  // and `Object.is` on Map entries never stabilizes (React #185 / issue #66).
  const itemsByPharmacy = useMemo(() => {
    const grouped = new Map<string, CartItem[]>();
    for (const item of items) {
      const key = item.product.pharmacyId;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }
    return grouped;
  }, [items]);

  const pharmacyIds = useMemo(() => Array.from(itemsByPharmacy.keys()), [itemsByPharmacy]);
  const pharmacyQueries = useQueries({
    queries: pharmacyIds.map((id) => ({
      queryKey: ['pharmacy', id] as const,
      queryFn: () => pharmaciesApi.getById(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

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
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div>
          <Text className="text-lg font-bold block">Корзина</Text>
          <Text className="text-xs text-tg-hint mt-0.5 block">
            {pharmacyIds.length === 1 ? '1 аптека' : `${pharmacyIds.length} аптек`} ·{' '}
            {totalItems} {totalItems === 1 ? 'товар' : 'товаров'}
          </Text>
        </div>
        <button
          type="button"
          className="text-dorify-error text-sm font-medium"
          onClick={clearCart}
        >
          Очистить
        </button>
      </div>

      {/* Grand total — visible when 2+ pharmacies (single shows per-block) */}
      {pharmacyIds.length > 1 && (
        <div className="px-4 mt-3">
          <div className="bg-tg-section rounded-card shadow-card p-3 flex items-center justify-between">
            <Text className="text-sm text-tg-hint">Итого по корзине</Text>
            <PriceTag amount={totalPrice} className="text-lg font-semibold" />
          </div>
        </div>
      )}

      {/* Per-pharmacy blocks */}
      <div className="px-4">
        {pharmacyIds.map((pharmacyId, index) => {
          const items = itemsByPharmacy.get(pharmacyId) ?? [];
          const query = pharmacyQueries[index];
          return (
            <PharmacyBlock
              key={pharmacyId}
              pharmacyId={pharmacyId}
              pharmacy={query?.data}
              pharmacyLoading={query?.isLoading ?? false}
              items={items}
            />
          );
        })}
      </div>
    </div>
  );
}
