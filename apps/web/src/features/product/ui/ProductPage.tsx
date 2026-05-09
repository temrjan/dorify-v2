import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Text } from '@telegram-apps/telegram-ui';
import { useState, useEffect } from 'react';
import { productsApi } from '@shared/api/products';
import { useCartStore } from '@shared/stores/cartStore';
import { PriceTag } from '@shared/ui/PriceTag';
import { Skeleton } from '@shared/ui/Skeleton';
import { EmptyState } from '@shared/ui/EmptyState';
import { Pill } from '@shared/ui/Pill';
import { IconPackage, IconCheck, IconAlert } from '@shared/ui/icons';

const ADDED_FEEDBACK_MS = 1500;

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
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.getById(id!),
    enabled: !!id,
  });

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
  const totalPrice = product.price * quantity;

  const handleAdd = () => {
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS);
  };

  return (
    <div className="pb-6">
      {/* Image */}
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

        {/* Inline CTA — после описания, скроллится с контентом (per Cart lesson PR #20) */}
        {!unavailable && (
          <div className="mt-6 bg-tg-section rounded-card shadow-card p-4">
            <div className="flex items-center justify-between mb-3">
              <Text className="text-tg-hint">Количество</Text>
              <div className="flex items-center gap-2 bg-tg-secondary rounded-xl px-2 py-1">
                <button
                  type="button"
                  className="w-9 h-9 flex items-center justify-center text-lg font-bold text-tg-hint disabled:opacity-40"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  aria-label="Уменьшить"
                >
                  −
                </button>
                <span className="w-8 text-center font-medium">{quantity}</span>
                <button
                  type="button"
                  className="w-9 h-9 flex items-center justify-center text-lg font-bold text-dorify-primary disabled:opacity-40"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock}
                  aria-label="Увеличить"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <Text className="text-tg-hint">Итого</Text>
              <PriceTag amount={totalPrice} className="text-lg" />
            </div>

            <Button
              mode="filled"
              size="l"
              stretched
              onClick={handleAdd}
              className="!bg-dorify-primary"
            >
              {added ? (
                <span className="inline-flex items-center gap-1.5">
                  <IconCheck width={18} height={18} />
                  Добавлено
                </span>
              ) : (
                'В корзину'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
