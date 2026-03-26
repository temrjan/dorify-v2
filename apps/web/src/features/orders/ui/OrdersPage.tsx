import { useQuery } from '@tanstack/react-query';
import { Spinner, Text } from '@telegram-apps/telegram-ui';
import { ordersApi } from '@shared/api/orders';
import { PriceTag } from '@shared/ui/PriceTag';
import { StatusBadge } from '@shared/ui/StatusBadge';

export default function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list({ limit: 50 }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="m" />
      </div>
    );
  }

  if (!data?.items.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-tg-hint">
        <span className="text-5xl mb-4">📦</span>
        <Text className="text-lg">Заказов пока нет</Text>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-4">
      <Text className="text-lg font-bold mb-3">Мои заказы</Text>

      <div className="space-y-3">
        {data.items.map((order) => (
          <div key={order.id} className="bg-tg-section rounded-xl p-4">
            <div className="flex items-center justify-between">
              <Text className="text-sm font-medium">
                Заказ #{order.id.slice(-6)}
              </Text>
              <StatusBadge status={order.status} />
            </div>

            <div className="mt-2 space-y-1">
              {order.items.slice(0, 3).map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-tg-hint truncate flex-1">{item.productName}</span>
                  <span className="ml-2 text-tg-hint">{item.quantity} шт</span>
                </div>
              ))}
              {order.items.length > 3 && (
                <Text className="text-xs text-tg-hint">
                  ...и ещё {order.items.length - 3}
                </Text>
              )}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <Text className="text-xs text-tg-hint">
                {new Date(order.createdAt).toLocaleDateString('ru-RU')}
              </Text>
              <PriceTag amount={order.totalAmount} className="text-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
