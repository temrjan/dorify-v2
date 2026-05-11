import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Chip, Spinner, Text } from '@telegram-apps/telegram-ui';
import { pharmacyOrdersApi } from '@shared/api/pharmacyOrders';
import type { Order, OrderStatus } from '@shared/types';
import { EmptyState } from '@shared/ui/EmptyState';
import { Skeleton } from '@shared/ui/Skeleton';
import { IconAlert, IconOrders } from '@shared/ui/icons';
import { OrderRow } from './OrderRow';
import { OrderDetailSheet } from './OrderDetailSheet';

const PAGE_LIMIT = 20;

const STATUS_FILTERS: Array<{ value: OrderStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Все' },
  { value: 'PENDING_MANUAL_CONTACT', label: 'Новые заявки' },
  { value: 'CONFIRMED', label: 'Подтверждённые' },
  { value: 'PREPARING', label: 'В сборке' },
  { value: 'READY', label: 'Готовы' },
  { value: 'DELIVERING', label: 'Доставка' },
  { value: 'DELIVERED', label: 'Выполнено' },
  { value: 'CANCELLED', label: 'Отменено' },
];

const EMPTY_MESSAGES: Record<OrderStatus | 'ALL', string> = {
  ALL: 'Заказов пока нет. Когда покупатели начнут оформлять — здесь появятся.',
  PENDING: 'Нет заказов в ожидании оплаты.',
  PENDING_MANUAL_CONTACT: 'Новых заявок нет.',
  CONFIRMED: 'Нет подтверждённых заказов.',
  PREPARING: 'Нет заказов в сборке.',
  READY: 'Нет готовых заказов.',
  DELIVERING: 'Нет заказов в доставке.',
  DELIVERED: 'Нет выполненных заказов.',
  CANCELLED: 'Нет отменённых заказов.',
};

export function PharmacyOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Filter change resets pagination — stale page index leaks across status
  // filters otherwise (page 3 of PENDING may have 0 matches in DELIVERED).
  const handleFilterChange = (value: OrderStatus | 'ALL') => {
    setStatusFilter(value);
    setPage(1);
  };

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['pharmacy-orders', { page, status: statusFilter }],
    queryFn: () =>
      pharmacyOrdersApi.list({
        page,
        limit: PAGE_LIMIT,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 flex items-center justify-between">
        <Text className="text-2xl font-bold block">Заказы</Text>
        {data && (
          <Text className="text-sm text-tg-hint">
            Всего: {data.total}
          </Text>
        )}
      </div>

      {/* Sticky filter chips — horizontal scroll on narrow screens */}
      <div className="sticky top-0 z-10 bg-tg-bg mt-3 px-4 py-2 border-b border-tg-section-separator overflow-x-auto">
        <div className="flex gap-2 w-max">
          {STATUS_FILTERS.map((f) => (
            <Chip
              key={f.value}
              mode={statusFilter === f.value ? 'elevated' : 'mono'}
              onClick={() => handleFilterChange(f.value)}
            >
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="px-4 mt-3 space-y-2">
        {isLoading && (
          <>
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-24 rounded-card" />
          </>
        )}

        {isError && (
          <div className="bg-dorify-error-light text-dorify-error rounded-card p-3 flex items-start gap-2">
            <IconAlert width={18} height={18} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <Text className="text-sm font-medium block">
                Не удалось загрузить заказы
              </Text>
              <Text className="text-xs mt-1 block">
                {error instanceof Error ? error.message : 'Попробуйте ещё раз'}
              </Text>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-xs font-medium underline mt-2"
              >
                Повторить
              </button>
            </div>
          </div>
        )}

        {data && data.items.length === 0 && (
          <EmptyState
            icon={<IconOrders width={48} height={48} />}
            title="Нет заказов"
            description={EMPTY_MESSAGES[statusFilter]}
          />
        )}

        {data && data.items.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            onClick={() => setSelectedOrder(order)}
          />
        ))}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm text-dorify-primary disabled:opacity-40"
            >
              ← Назад
            </button>
            <Text className="text-xs text-tg-hint">
              Стр. {page} из {data.totalPages}
            </Text>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="text-sm text-dorify-primary disabled:opacity-40"
            >
              Вперёд →
            </button>
          </div>
        )}
      </div>

      {selectedOrder && (
        <OrderDetailSheet
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {/* Background refetch indicator — initial load uses Skeleton above */}
      {data && isFetching && (
        <div className="fixed top-2 right-2 z-20">
          <Spinner size="s" />
        </div>
      )}
    </div>
  );
}
