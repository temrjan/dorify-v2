import type { ProductStatus } from '@shared/types';
import { Pill, type PillVariant } from '@shared/ui/Pill';
import { IconCheck, IconClock, IconX, IconAlert } from '@shared/ui/icons';
import type { ReactNode } from 'react';

interface ProductStatusBadgeProps {
  status: ProductStatus;
  moderationNote?: string;
}

interface StatusConfig {
  label: string;
  variant: PillVariant;
  icon?: ReactNode;
}

const ICON_PROPS = { width: 12, height: 12 } as const;

const STATUS_CONFIG: Record<ProductStatus, StatusConfig> = {
  DRAFT: {
    label: 'Черновик',
    variant: 'neutral',
  },
  PENDING_MODERATION: {
    label: 'На модерации',
    variant: 'warning',
    icon: <IconClock {...ICON_PROPS} />,
  },
  PUBLISHED: {
    label: 'Опубликован',
    variant: 'success',
    icon: <IconCheck {...ICON_PROPS} />,
  },
  REJECTED: {
    label: 'Отклонён',
    variant: 'error',
    icon: <IconAlert {...ICON_PROPS} />,
  },
  HIDDEN: {
    label: 'Скрыт',
    variant: 'neutral',
    icon: <IconX {...ICON_PROPS} />,
  },
  EXPIRED: {
    label: 'Истёк',
    variant: 'neutral',
  },
};

export function ProductStatusBadge({ status, moderationNote }: ProductStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Pill
      variant={cfg.variant}
      icon={cfg.icon}
      title={status === 'REJECTED' && moderationNote ? moderationNote : undefined}
    >
      {cfg.label}
    </Pill>
  );
}
