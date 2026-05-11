import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Text, Textarea } from '@telegram-apps/telegram-ui';
import { pharmacyOrdersApi } from '@shared/api/pharmacyOrders';
import { Pill } from '@shared/ui/Pill';
import { IconAlert, IconX } from '@shared/ui/icons';
import type { Order, OrderStatus, PaginatedResult } from '@shared/types';

interface OrderDetailSheetProps {
  order: Order;
  onClose: () => void;
}

interface ForwardAction {
  label: string;
  next: OrderStatus;
}

function getForwardActions(order: Order): ForwardAction[] {
  switch (order.status) {
    case 'PENDING_MANUAL_CONTACT':
      return [{ label: 'Подтвердить', next: 'CONFIRMED' }];
    case 'CONFIRMED':
      return [{ label: 'В сборку', next: 'PREPARING' }];
    case 'PREPARING':
      return [{ label: 'Готов', next: 'READY' }];
    case 'READY':
      return order.deliveryType === 'DELIVERY'
        ? [{ label: 'Передать курьеру', next: 'DELIVERING' }]
        : [{ label: 'Выдан покупателю', next: 'DELIVERED' }];
    case 'DELIVERING':
      return [{ label: 'Доставлен', next: 'DELIVERED' }];
    default:
      return [];
  }
}

function isCancellable(status: OrderStatus): boolean {
  return status === 'PENDING' || status === 'PENDING_MANUAL_CONTACT' || status === 'CONFIRMED';
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(amount);
}

// Backend stores contactPhone as user-entered (may contain spaces/dashes).
// tel: URI scheme requires no whitespace — sanitize for href, keep raw for display.
function telHref(phone: string): string {
  return 'tel:' + phone.replace(/[\s\-()]/g, '');
}

export function OrderDetailSheet({ order, onClose }: OrderDetailSheetProps) {
  const queryClient = useQueryClient();
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Prevent scroll-through on body when sheet is open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  type OrdersCache = PaginatedResult<Order>;

  // Optimistic update: snapshot every cached pharmacy-orders page, replace
  // matching order with new status. onError restores; onSettled invalidates
  // to converge с server truth (handles concurrent buyer cancellation).
  const advanceMutation = useMutation({
    mutationFn: (next: OrderStatus) => pharmacyOrdersApi.updateStatus(order.id, next),
    retry: 0,
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: ['pharmacy-orders'] });
      const snapshots = queryClient.getQueriesData<OrdersCache>({ queryKey: ['pharmacy-orders'] });
      queryClient.setQueriesData<OrdersCache>(
        { queryKey: ['pharmacy-orders'] },
        (old) =>
          old
            ? {
                ...old,
                items: old.items.map((o) => (o.id === order.id ? { ...o, status: next } : o)),
              }
            : old,
      );
      return { snapshots };
    },
    onError: (err, _next, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
      setError(err instanceof Error ? err.message : 'Не удалось обновить статус');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy-orders'] });
    },
    onSuccess: () => {
      onClose();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => pharmacyOrdersApi.cancel(order.id, reason),
    retry: 0,
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Не удалось отменить заказ');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy-orders'] });
    },
    onSuccess: () => {
      onClose();
    },
  });

  const isPending = advanceMutation.isPending || cancelMutation.isPending;
  const forwardActions = getForwardActions(order);
  const cancellable = isCancellable(order.status);
  const shortId = order.id.slice(-6);

  const handleCancelSubmit = () => {
    const trimmed = cancelReason.trim();
    if (!trimmed) {
      setError('Укажите причину отмены');
      return;
    }
    setError(null);
    cancelMutation.mutate(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-end bg-black/40 transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[85vh] overflow-y-auto bg-tg-bg rounded-t-2xl px-4 pt-3 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-tg-hint/40 mx-auto mb-3" />

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <Text className="text-lg font-bold block">Заказ #{shortId}</Text>
            <Text className="text-xs text-tg-hint block mt-0.5">
              {new Date(order.createdAt).toLocaleString('ru-RU')}
            </Text>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-tg-secondary text-tg-hint"
          >
            <IconX width={16} height={16} />
          </button>
        </div>

        {/* Items */}
        <section className="bg-tg-section rounded-card p-3 mb-3">
          <Text className="text-xs text-tg-hint uppercase tracking-wide mb-2 block">Товары</Text>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-2">
                <div className="min-w-0">
                  <Text className="text-sm font-medium truncate">{item.productName}</Text>
                  <Text className="text-xs text-tg-hint">
                    {item.quantity} × {formatMoney(item.priceAtTime)} сум
                  </Text>
                </div>
                <Text className="text-sm font-semibold shrink-0">
                  {formatMoney(item.subtotal)} сум
                </Text>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 pt-3 border-t border-tg-section-separator">
            <Text className="text-sm font-medium">Итого</Text>
            <Text className="text-base font-bold">{formatMoney(order.totalAmount)} сум</Text>
          </div>
        </section>

        {/* Delivery / Contact */}
        <section className="bg-tg-section rounded-card p-3 mb-3 space-y-2">
          <div>
            <Text className="text-xs text-tg-hint block">Способ получения</Text>
            <Text className="text-sm">
              {order.deliveryType === 'DELIVERY'
                ? `Доставка${order.deliveryAddress ? ': ' + order.deliveryAddress : ''}`
                : 'Самовывоз'}
            </Text>
          </div>
          <div>
            <Text className="text-xs text-tg-hint block">Покупатель</Text>
            <a
              href={telHref(order.contactPhone)}
              className="text-sm text-dorify-primary underline"
            >
              {order.contactPhone}
            </a>
          </div>
          {order.comment && (
            <div>
              <Text className="text-xs text-tg-hint block">Комментарий</Text>
              <Text className="text-sm">{order.comment}</Text>
            </div>
          )}
          <div>
            <Text className="text-xs text-tg-hint block">Оплата</Text>
            <Pill
              variant={order.paymentStatus === 'PAID' ? 'success' : 'neutral'}
              size="sm"
            >
              {order.paymentStatus === 'PAID' ? 'Оплачено' : 'Не оплачено'}
            </Pill>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="bg-dorify-error-light text-dorify-error rounded-card p-3 mb-3 flex items-start gap-2">
            <IconAlert width={18} height={18} className="shrink-0 mt-0.5" />
            <Text className="text-sm flex-1">{error}</Text>
          </div>
        )}

        {/* Cancel form (when active) overrides action buttons */}
        {showCancelForm ? (
          <section className="bg-tg-section rounded-card p-3 mb-3">
            <Text className="text-sm font-medium block mb-2">Укажите причину отмены</Text>
            <Textarea
              placeholder="Например: товар закончился"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 mt-3">
              <Button
                mode="plain"
                size="m"
                stretched
                onClick={() => {
                  setShowCancelForm(false);
                  setCancelReason('');
                  setError(null);
                }}
                disabled={isPending}
              >
                Назад
              </Button>
              <Button
                mode="filled"
                size="m"
                stretched
                onClick={handleCancelSubmit}
                disabled={isPending || !cancelReason.trim()}
                className="!bg-dorify-error"
              >
                {cancelMutation.isPending ? 'Отменяем...' : 'Отменить заказ'}
              </Button>
            </div>
          </section>
        ) : (
          (forwardActions.length > 0 || cancellable) && (
            <div className="space-y-2">
              {forwardActions.map((action) => (
                <Button
                  key={action.next}
                  mode="filled"
                  size="l"
                  stretched
                  onClick={() => advanceMutation.mutate(action.next)}
                  disabled={isPending}
                  className="!bg-dorify-primary"
                >
                  {advanceMutation.isPending ? 'Обновляем...' : action.label}
                </Button>
              ))}
              {cancellable && (
                <Button
                  mode="outline"
                  size="l"
                  stretched
                  onClick={() => {
                    setShowCancelForm(true);
                    setError(null);
                  }}
                  disabled={isPending}
                >
                  Отменить заказ
                </Button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
