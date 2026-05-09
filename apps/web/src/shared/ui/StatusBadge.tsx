import type { ReactNode } from 'react';
import { Pill, type PillVariant } from './Pill';
import { IconCheck, IconClock, IconX, IconAlert, IconPackage } from './icons';

interface StatusConfig {
  label: string;
  variant: PillVariant;
  icon?: ReactNode;
}

const ICON_PROPS = { width: 12, height: 12 } as const;

const STATUS_CONFIG: Record<string, StatusConfig> = {
  PENDING: { label: 'Ожидает', variant: 'warning', icon: <IconClock {...ICON_PROPS} /> },
  CONFIRMED: { label: 'Подтверждён', variant: 'primary', icon: <IconCheck {...ICON_PROPS} /> },
  PREPARING: { label: 'Готовится', variant: 'primary', icon: <IconPackage {...ICON_PROPS} /> },
  READY: { label: 'Готов', variant: 'success', icon: <IconCheck {...ICON_PROPS} /> },
  DELIVERING: { label: 'Доставка', variant: 'info', icon: <IconPackage {...ICON_PROPS} /> },
  DELIVERED: { label: 'Доставлен', variant: 'success', icon: <IconCheck {...ICON_PROPS} /> },
  CANCELLED: { label: 'Отменён', variant: 'error', icon: <IconX {...ICON_PROPS} /> },
  PAID: { label: 'Оплачен', variant: 'success', icon: <IconCheck {...ICON_PROPS} /> },
  FAILED: { label: 'Ошибка', variant: 'error', icon: <IconAlert {...ICON_PROPS} /> },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: 'neutral' as const };
  return (
    <Pill variant={cfg.variant} icon={cfg.icon}>
      {cfg.label}
    </Pill>
  );
}
