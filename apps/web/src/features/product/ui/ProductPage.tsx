import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Text } from '@telegram-apps/telegram-ui';
import { useEffect } from 'react';
import { productsApi } from '@shared/api/products';
import { useCartStore } from '@shared/stores/cartStore';
import { PriceTag } from '@shared/ui/PriceTag';
import { Skeleton } from '@shared/ui/Skeleton';
import { EmptyState } from '@shared/ui/EmptyState';
import { Pill } from '@shared/ui/Pill';
import {
  IconPackage,
  IconAlert,
  IconCart,
  IconChevronRight,
} from '@shared/ui/icons';

function ProductSkeleton() {
  return (
    <div>
      <Skeleton height={256} rounded="md" />
      <div className="p-4 space-y-3">
        <Skeleton height={24} width="80%" />
        <Skeleton height={28} width={120} />
        <div className="h-px bg-tg-secondary my-2" />
        <Skeleton height={14} width="60%" />
        <Skeleton height={14} width="50%" />
        <div className="h-px bg-tg-secondary my-2" />
        <Skeleton height={14} width="90%" />
        <Skeleton height={14} width="85%" />
        <Skeleton height={14} width="70%" />
      </div>
    </div>
  );
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.getById(id!),
    enabled: !!id,
  });

  // Subscribe to this product's cart item only. `find` returns a stable ref
  // when other items are mutated (cartStore.updateQuantity uses .map with
  // identity passthrough), so we don't re-render on unrelated cart changes.
  const cartItem = useCartStore((s) =>
    s.items.find((i) => i.product.id === product?.id),
  );
  const cartQty = cartItem?.quantity ?? 0;
  const inCart = cartQty > 0;

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
    return <ProductSkeleton />;
  }

  if (isError || !product) {
    return (
      <EmptyState
        icon={<IconAlert width={48} height={48} />}
        title="Товар не найден"
        description="Возможно, его сняли с продажи или ссылка устарела."
        action={
          <Button mode="filled" size="m" onClick={() => navigate('/')}>
            К каталогу
          </Button>
        }
        className="min-h-[60vh]"
      />
    );
  }

  const unavailable = !product.isAvailable || product.stock === 0;
  const stockLimitReached = cartQty >= product.stock;

  const handleAddToCart = () => addItem(product, 1);
  // updateQuantity routes to removeItem when target ≤ 0, so passing
  // cartQty - 1 at qty=1 naturally reverts the bar to "В корзину" state.
  const handleDecrement = () => updateQuantity(product.id, cartQty - 1);
  const handleIncrement = () =>
    updateQuantity(product.id, Math.min(product.stock, cartQty + 1));
  const handleGoToCart = () => navigate('/cart');

  return (
    // Bottom padding clears the sticky action bar; mirrors Layout's
    // tabbar-padding pattern but applied per-page since /product/* hides tabbar.
    <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      {/* Image with floating back button — TG BackButton API doesn't
          activate on all clients, so we render our own as belt-and-suspenders.
          Without this, ProductPage has no escape (Tabbar hidden by Layout). */}
      <div className="relative">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Назад"
          className="absolute top-3 left-3 z-10 w-10 h-10 rounded-full bg-tg-bg/80 backdrop-blur shadow-card flex items-center justify-center active:scale-95"
        >
          <IconChevronRight width={20} height={20} className="rotate-180" />
        </button>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-64 object-cover bg-tg-secondary"
          />
        ) : (
          <div className="w-full h-64 bg-dorify-primary-light flex items-center justify-center">
            <IconPackage width={64} height={64} className="text-dorify-primary" />
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Name & Price */}
        <Text className="text-xl font-bold block">{product.name}</Text>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <PriceTag amount={product.price} className="text-2xl" />
          {product.requiresPrescription && (
            <Pill variant="warning">По рецепту</Pill>
          )}
        </div>

        {/* Stock */}
        <div className="mt-2 text-sm">
          {unavailable ? (
            <span className="text-dorify-error font-medium">Нет в наличии</span>
          ) : (
            <span className="text-tg-hint">В наличии: {product.stock} шт</span>
          )}
        </div>

        {/* Meta */}
        {(product.manufacturer || product.activeSubstance) && (
          <>
            <div className="h-px bg-tg-secondary my-4" />
            <div className="space-y-2">
              {product.manufacturer && (
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="text-tg-hint shrink-0">Производитель:</span>
                  <span>{product.manufacturer}</span>
                </div>
              )}
              {product.activeSubstance && (
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="text-tg-hint shrink-0">Действующее вещество:</span>
                  <span>{product.activeSubstance}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Description */}
        {product.description && (
          <>
            <div className="h-px bg-tg-secondary my-4" />
            <Text className="text-tg-hint text-xs uppercase tracking-wider font-medium block mb-2">
              Описание
            </Text>
            <Text className="text-sm leading-relaxed whitespace-pre-line block">
              {product.description}
            </Text>
          </>
        )}
      </div>

      {/* Sticky action bar — morphs between «В корзину» and stepper+«Перейти»
          based on whether this product is in cart. Hidden when unavailable. */}
      {!unavailable && (
        <div
          className="fixed bottom-0 inset-x-0 z-40 bg-tg-section border-t border-tg-secondary/50"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="p-3">
            {!inCart ? (
              <Button
                mode="filled"
                size="l"
                stretched
                onClick={handleAddToCart}
                className="!bg-dorify-primary"
              >
                В корзину
              </Button>
            ) : (
              <div className="flex gap-3 items-stretch">
                <div className="flex items-center gap-1 bg-tg-secondary rounded-xl px-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    aria-label="Уменьшить"
                    className="w-11 h-11 flex items-center justify-center text-2xl text-tg-hint active:opacity-60"
                  >
                    −
                  </button>
                  <span className="w-7 text-center font-semibold tabular-nums">{cartQty}</span>
                  <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={stockLimitReached}
                    aria-label="Увеличить"
                    className="w-11 h-11 flex items-center justify-center text-2xl text-dorify-primary disabled:opacity-40 active:opacity-60"
                  >
                    +
                  </button>
                </div>
                <Button
                  mode="filled"
                  size="l"
                  stretched
                  onClick={handleGoToCart}
                  className="!bg-dorify-primary flex-1"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <IconCart width={18} height={18} />
                    Перейти
                  </span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
