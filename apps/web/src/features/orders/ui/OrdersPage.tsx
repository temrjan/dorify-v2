import { useQuery } from '@tanstack/react-query';
import { Text } from '@telegram-apps/telegram-ui';
import { ordersApi } from '@shared/api/orders';
import { PriceTag } from '@shared/ui/PriceTag';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { Skeleton } from '@shared/ui/Skeleton';
import { EmptyState } from '@shared/ui/EmptyState';
import { IconOrders } from '@shared/ui/icons';

const SKELETON_COUNT = 3;

function OrderSkeleton() {
  return (
    <div className="bg-tg-section rounded-card shadow-card p-4">
      <div className="flex items-center justify-between">
        <Skeleton height={14} width={120} />
        <Skeleton height={20} width={80} rounded="full" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton height={12} width="90%" />
        <Skeleton height={12} width="70%" />
      </div>
      <div className="h-px bg-tg-secondary my-3" />
      <div className="flex items-center justify-between">
        <Skeleton height={12} width={80} />
        <Skeleton height={16} width={100} />
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list({ limit: 50 }),
  });

  if (isLoading) {
    return (
      <div className="px-4 pt-4 pb-4">
        <Text className="text-lg font-bold mb-3 block">Мои заказы</Text>
        <div className="space-y-3">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <OrderSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.items.length) {
    return (
      <EmptyState
        icon={<IconOrders width={48} height={48} />}
        title="Заказов пока нет"
        description="Здесь появятся ваши заказы из аптек."
        className="min-h-[60vh]"
      />
    );
  }

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-baseline gap-2 mb-3">
        <Text className="text-lg font-bold">Мои заказы</Text>
        <Text className="text-sm text-tg-hint">· {data.items.length}</Text>
      </div>

      <div className="space-y-3">
        {data.items.map((order) => (
          <div key={order.id} className="bg-tg-section rounded-card shadow-card p-4">
            <div className="flex items-center justify-between gap-2">
              <Text className="text-sm font-medium truncate">
                Заказ #{order.id.slice(-6)}
              </Text>
              <StatusBadge status={order.status} />
            </div>

            <div className="mt-2 space-y-1">
              {order.items.slice(0, 3).map((item) => (
                <div key={item.id} className="flex justify-between text-sm gap-2">
                  <span className="text-tg-hint truncate flex-1">{item.productName}</span>
                  <span className="text-tg-hint shrink-0">{item.quantity} шт</span>
                </div>
              ))}
              {order.items.length > 3 && (
                <Text className="text-xs text-tg-hint">
                  …и ещё {order.items.length - 3}
                </Text>
              )}
            </div>

            <div className="h-px bg-tg-secondary my-3" />

            <div className="flex items-center justify-between">
              <Text className="text-xs text-tg-hint">
                {new Date(order.createdAt).toLocaleDateString('ru-RU')}
              </Text>
              <PriceTag amount={order.totalAmount} className="text-sm font-semibold" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
