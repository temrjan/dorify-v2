import { Text } from '@telegram-apps/telegram-ui';
import { Pill } from '@shared/ui/Pill';
import { IconChevronRight } from '@shared/ui/icons';
import type { Order, OrderStatus } from '@shared/types';

interface OrderRowProps {
  order: Order;
  onClick: () => void;
}

interface StatusBadge {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

const STATUS_BADGES: Record<OrderStatus, StatusBadge> = {
  PENDING: { label: 'Ожидает оплаты', variant: 'warning' },
  PENDING_MANUAL_CONTACT: { label: 'Новая заявка', variant: 'info' },
  CONFIRMED: { label: 'Подтверждён', variant: 'info' },
  PREPARING: { label: 'В сборке', variant: 'info' },
  READY: { label: 'Готов', variant: 'success' },
  DELIVERING: { label: 'В доставке', variant: 'info' },
  DELIVERED: { label: 'Выполнен', variant: 'success' },
  CANCELLED: { label: 'Отменён', variant: 'error' },
};

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} дн назад`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(amount);
}

export function OrderRow({ order, onClick }: OrderRowProps) {
  const badge = STATUS_BADGES[order.status];
  const itemsCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const shortId = order.id.slice(-6);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-tg-section rounded-card shadow-card p-4 transition active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Text className="font-medium text-sm block">#{shortId}</Text>
            <Pill variant={badge.variant} size="sm">
              {badge.label}
            </Pill>
          </div>

          <Text className="text-xs text-tg-hint block mb-2">
            {formatRelativeTime(order.createdAt)} · {itemsCount} {itemsCount === 1 ? 'товар' : 'товаров'}
            {order.deliveryType === 'DELIVERY' ? ' · доставка' : ' · самовывоз'}
          </Text>

          <Text className="text-sm font-semibold">
            {formatMoney(order.totalAmount)} сум
          </Text>
        </div>
        <IconChevronRight width={18} height={18} className="shrink-0 text-tg-hint mt-1" />
      </div>
    </button>
  );
}
