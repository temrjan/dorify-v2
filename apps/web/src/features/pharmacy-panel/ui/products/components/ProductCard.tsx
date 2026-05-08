import { Text } from '@telegram-apps/telegram-ui';
import { PriceTag } from '@shared/ui/PriceTag';
import { ProductStatusBadge } from './ProductStatusBadge';
import type { Product } from '@shared/types';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export function ProductCard({ product, onEdit, onDelete }: ProductCardProps) {
  const lowStock = product.stock > 0 && product.stock < 5;
  const outOfStock = product.stock === 0;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Редактировать ${product.name}`}
      className="bg-tg-section rounded-xl p-3 flex gap-3 cursor-pointer active:opacity-70 focus:outline-none focus:ring-2 focus:ring-dorify-primary"
      onClick={() => onEdit(product)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit(product);
        }
      }}
    >
      {/* Image */}
      <div className="w-16 h-16 rounded-lg bg-tg-secondary overflow-hidden flex items-center justify-center shrink-0">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Text className="text-tg-hint text-xs">нет фото</Text>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Text className="font-medium truncate">{product.name}</Text>
          <ProductStatusBadge status={product.status} moderationNote={product.moderationNote} />
        </div>

        {product.activeSubstance && (
          <Text className="text-xs text-tg-hint truncate mt-0.5">
            {product.activeSubstance}
          </Text>
        )}

        <div className="flex items-center justify-between mt-1.5">
          <PriceTag amount={product.price} />
          <div className="flex items-center gap-2 text-xs">
            <Text
              className={
                outOfStock
                  ? 'text-dorify-secondary'
                  : lowStock
                    ? 'text-amber-600'
                    : 'text-tg-hint'
              }
            >
              {outOfStock ? 'нет в наличии' : `${product.stock} шт.`}
            </Text>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(product);
              }}
              className="text-tg-hint hover:text-dorify-secondary px-2 py-0.5 -my-0.5 rounded"
              aria-label="Удалить товар"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
