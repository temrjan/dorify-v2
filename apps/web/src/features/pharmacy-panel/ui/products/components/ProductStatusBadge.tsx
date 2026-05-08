import type { ProductStatus } from '@shared/types';

interface ProductStatusBadgeProps {
  status: ProductStatus;
  moderationNote?: string;
}

interface BadgeConfig {
  label: string;
  className: string;
}

const STATUS_CONFIG: Record<ProductStatus, BadgeConfig> = {
  DRAFT: {
    label: 'Черновик',
    className: 'bg-gray-200 text-gray-700',
  },
  PENDING_MODERATION: {
    label: 'На модерации',
    className: 'bg-amber-100 text-amber-800',
  },
  PUBLISHED: {
    label: 'Опубликован',
    className: 'bg-green-100 text-green-800',
  },
  REJECTED: {
    label: 'Отклонён',
    className: 'bg-red-100 text-red-800',
  },
  HIDDEN: {
    label: 'Скрыт',
    className: 'bg-gray-100 text-gray-600',
  },
  EXPIRED: {
    label: 'Истёк',
    className: 'bg-gray-100 text-gray-500',
  },
};

export function ProductStatusBadge({ status, moderationNote }: ProductStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${cfg.className}`}
      title={status === 'REJECTED' && moderationNote ? moderationNote : undefined}
    >
      {cfg.label}
    </span>
  );
}
