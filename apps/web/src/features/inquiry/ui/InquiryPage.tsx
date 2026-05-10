import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Input, Spinner, Text, Textarea } from '@telegram-apps/telegram-ui';
import { useCartStore, selectItemsByPharmacy } from '@shared/stores/cartStore';
import { ordersApi } from '@shared/api/orders';
import { pharmaciesApi } from '@shared/api/pharmacies';
import { PriceTag } from '@shared/ui/PriceTag';
import { IconAlert, IconCheck } from '@shared/ui/icons';

/**
 * Inquiry confirmation: short form для аптек без Multicard. Buyer вводит
 * телефон + удобное время связи + опц. комментарий → backend создаёт Order
 * со статусом PENDING_MANUAL_CONTACT → notification handler шлёт DM
 * продавцу с buyer phone (apps/api/src/modules/notification/.../on-order-events.handler.ts).
 */
export default function InquiryPage() {
  const navigate = useNavigate();
  const { pharmacyId = '' } = useParams<{ pharmacyId: string }>();
  const itemsByPharmacy = useCartStore(selectItemsByPharmacy);
  const clearPharmacy = useCartStore((s) => s.clearPharmacy);
  const items = itemsByPharmacy.get(pharmacyId) ?? [];

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const [phone, setPhone] = useState(() => {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    return user ? '+998' : '';
  });
  const [comment, setComment] = useState('');

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.BackButton.show();
    const handler = () => navigate('/cart');
    tg?.BackButton.onClick(handler);
    return () => {
      tg?.BackButton.offClick(handler);
      tg?.BackButton.hide();
    };
  }, [navigate]);

  const pharmacyQuery = useQuery({
    queryKey: ['pharmacy', pharmacyId],
    queryFn: () => pharmaciesApi.getById(pharmacyId),
    enabled: !!pharmacyId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (items.length === 0) throw new Error('Корзина для этой аптеки пуста');

      const order = await ordersApi.place({
        pharmacyId,
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
        deliveryType: 'PICKUP',
        contactPhone: phone,
        comment: comment.trim() || undefined,
      });
      clearPharmacy(pharmacyId);
      return order;
    },
  });

  if (items.length === 0 && !mutation.isSuccess) {
    navigate('/cart');
    return null;
  }

  const canSubmit = phone.trim().length >= 9 && !mutation.isPending;

  // Success state
  if (mutation.isSuccess) {
    return (
      <div className="px-4 pt-12 pb-6">
        <div className="w-20 h-20 rounded-full bg-dorify-success-light text-dorify-success flex items-center justify-center mx-auto">
          <IconCheck width={40} height={40} />
        </div>
        <Text className="text-2xl font-bold text-center mt-6 block">Заявка отправлена</Text>
        <Text className="text-tg-hint text-center mt-2 block max-w-sm mx-auto">
          {pharmacyQuery.data?.name ?? 'Аптека'} получила вашу заявку в Telegram.
          Продавец свяжется с вами по номеру <b>{phone}</b> в ближайшее время.
        </Text>
        <div className="mt-8 max-w-sm mx-auto space-y-2">
          <Button
            mode="filled"
            size="l"
            stretched
            onClick={() => navigate('/orders')}
            className="!bg-dorify-primary"
          >
            Мои заказы
          </Button>
          <Button mode="plain" size="l" stretched onClick={() => navigate('/cart')}>
            Вернуться в корзину
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6 px-4 pt-4">
      <Text className="text-lg font-bold block">Отправка заявки</Text>
      <Text className="text-sm text-tg-hint mt-0.5 block">
        {pharmacyQuery.data?.name ?? 'Аптека'} — без онлайн-оплаты, продавец свяжется по
        телефону.
      </Text>

      {/* Order summary */}
      <section className="mt-4 bg-tg-section rounded-card shadow-card p-4">
        <div className="flex items-baseline justify-between mb-2">
          <Text className="text-sm font-semibold">Ваш заказ</Text>
          <Text className="text-sm text-tg-hint">{items.length} {items.length === 1 ? 'товар' : 'товаров'}</Text>
        </div>
        <ul className="space-y-1 text-sm">
          {items.map(({ product, quantity }) => (
            <li key={product.id} className="flex justify-between gap-2">
              <span className="truncate flex-1 text-tg-hint">
                {product.name} × {quantity}
              </span>
              <span className="shrink-0">
                {new Intl.NumberFormat('uz-UZ').format(product.price * quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="h-px bg-tg-secondary my-3" />
        <div className="flex items-baseline justify-between">
          <Text className="text-sm font-medium">Итого</Text>
          <PriceTag amount={total} className="text-base font-semibold" />
        </div>
      </section>

      {/* Contact form */}
      <section className="mt-4 bg-tg-section rounded-card shadow-card p-4 space-y-3">
        <div>
          <label className="text-xs text-tg-hint block mb-1">
            Телефон <span className="text-dorify-error">*</span>
          </label>
          <Input
            type="tel"
            placeholder="+998 90 123 45 67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Text className="text-xs text-tg-hint mt-1 block">
            Продавец позвонит на этот номер.
          </Text>
        </div>

        <div>
          <label className="text-xs text-tg-hint block mb-1">Комментарий (необязательно)</label>
          <Textarea
            placeholder="Удобное время связи, адрес доставки и т.п."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
        </div>
      </section>

      {mutation.isError && (
        <div className="mt-3 bg-dorify-error-light text-dorify-error rounded-card p-3 flex items-start gap-2">
          <IconAlert width={18} height={18} className="shrink-0 mt-0.5" />
          <Text className="text-sm">
            {mutation.error instanceof Error
              ? mutation.error.message
              : 'Не удалось отправить заявку. Попробуйте ещё раз.'}
          </Text>
        </div>
      )}

      <div className="mt-5">
        <Button
          mode="filled"
          size="l"
          stretched
          onClick={() => mutation.mutate()}
          disabled={!canSubmit}
          className="!bg-dorify-primary"
        >
          {mutation.isPending ? <Spinner size="s" /> : 'Отправить заявку'}
        </Button>
      </div>
    </div>
  );
}
