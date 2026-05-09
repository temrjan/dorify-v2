import { useNavigate } from 'react-router-dom';
import { Button, Input, Text, Spinner } from '@telegram-apps/telegram-ui';
import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useCartStore, selectTotalPrice, selectItemsByPharmacy } from '@shared/stores/cartStore';
import { ordersApi } from '@shared/api/orders';
import { paymentsApi } from '@shared/api/payments';
import { PriceTag } from '@shared/ui/PriceTag';
import type { Order } from '@shared/types';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const clearPharmacy = useCartStore((s) => s.clearPharmacy);
  const totalPrice = useCartStore(selectTotalPrice);
  const itemsByPharmacy = useCartStore(selectItemsByPharmacy);

  const [phone, setPhone] = useState(() => {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    return user ? '+998' : '';
  });
  const [address, setAddress] = useState('');
  const [deliveryType, setDeliveryType] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');

  // BackButton
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

  type CheckoutResult =
    | { kind: 'redirect'; checkoutUrl: string }
    | { kind: 'orders' };

  const mutation = useMutation({
    mutationFn: async (): Promise<CheckoutResult> => {
      // Create order per pharmacy
      const pharmacyIds = Array.from(itemsByPharmacy.keys());
      const isSinglePharmacy = pharmacyIds.length === 1;
      const createdOrders: Order[] = [];

      for (const pharmacyId of pharmacyIds) {
        const pharmacyItems = itemsByPharmacy.get(pharmacyId)!;
        const order = await ordersApi.place({
          pharmacyId,
          items: pharmacyItems.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
          })),
          deliveryType,
          contactPhone: phone,
          deliveryAddress: deliveryType === 'DELIVERY' ? address : undefined,
        });
        createdOrders.push(order);
        clearPharmacy(pharmacyId);
      }

      // Multi-pharmacy carts: skip payment trigger for now (Tier 2 will revisit)
      if (!isSinglePharmacy || !createdOrders[0]) {
        return { kind: 'orders' };
      }

      const payment = await paymentsApi.create(createdOrders[0].id);
      if (!payment.checkoutUrl) {
        throw new Error('Не получилось получить ссылку оплаты');
      }
      if (!payment.checkoutUrl.startsWith('https://')) {
        throw new Error('Неподдерживаемая ссылка оплаты');
      }
      return { kind: 'redirect', checkoutUrl: payment.checkoutUrl };
    },
    onSuccess: (result) => {
      if (result.kind === 'redirect') {
        window.location.href = result.checkoutUrl;
        return;
      }
      navigate('/orders');
    },
    onError: () => {
      // Order(s) могли быть созданы до payment failure (cart cleared per pharmacy внутри loop).
      // Если cart после fail оказался пуст — все orders созданы, ведём на /orders для retry.
      if (useCartStore.getState().items.length === 0) {
        navigate('/orders');
      }
    },
  });

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="pb-28">
      <div className="px-4 pt-4">
        <Text className="text-lg font-bold">Оформление заказа</Text>
      </div>

      {/* Contact */}
      <div className="px-4 mt-4 space-y-3">
        <Text className="text-sm font-medium text-tg-hint">Контактные данные</Text>
        <Input
          placeholder="Телефон *"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      {/* Delivery */}
      <div className="px-4 mt-4">
        <Text className="text-sm font-medium text-tg-hint mb-2">Способ получения</Text>
        <div className="flex gap-2">
          <button
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition ${
              deliveryType === 'PICKUP'
                ? 'bg-dorify-primary text-white'
                : 'bg-tg-secondary text-tg'
            }`}
            onClick={() => setDeliveryType('PICKUP')}
          >
            Самовывоз
          </button>
          <button
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition ${
              deliveryType === 'DELIVERY'
                ? 'bg-dorify-primary text-white'
                : 'bg-tg-secondary text-tg'
            }`}
            onClick={() => setDeliveryType('DELIVERY')}
          >
            Доставка
          </button>
        </div>

        {deliveryType === 'DELIVERY' && (
          <div className="mt-3">
            <Input
              placeholder="Адрес доставки"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="px-4 mt-6">
        <div className="bg-tg-section rounded-xl p-4">
          <div className="flex justify-between text-sm">
            <span className="text-tg-hint">Товаров</span>
            <span>{items.length}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-tg-hint">Итого</span>
            <PriceTag amount={totalPrice} />
          </div>
        </div>
      </div>

      {/* Error */}
      {mutation.isError && (
        <div className="px-4 mt-3">
          <div className="bg-dorify-secondary-light text-dorify-secondary text-sm p-3 rounded-xl">
            {mutation.error instanceof Error
              ? mutation.error.message
              : 'Не удалось завершить оформление. Откройте «Мои заказы».'}
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-tg-secondary shadow-sheet pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button
          mode="filled"
          size="l"
          stretched
          onClick={() => mutation.mutate()}
          disabled={!phone || mutation.isPending}
          className="!bg-dorify-primary"
        >
          {mutation.isPending ? <Spinner size="s" /> : 'Оформить заказ'}
        </Button>
      </div>
    </div>
  );
}
