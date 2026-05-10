import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, Text, Spinner } from '@telegram-apps/telegram-ui';
import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useCartStore, selectItemsByPharmacy } from '@shared/stores/cartStore';
import { ordersApi } from '@shared/api/orders';
import { paymentsApi } from '@shared/api/payments';
import { PriceTag } from '@shared/ui/PriceTag';
import { IconStore, IconPackage, IconAlert } from '@shared/ui/icons';

type DeliveryType = 'PICKUP' | 'DELIVERY';

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="px-4 mt-4">
      <Text className="text-xs uppercase tracking-wider text-tg-hint block mb-2 px-1">
        {title}
      </Text>
      <div className="bg-tg-section rounded-card shadow-card p-4">{children}</div>
    </div>
  );
}

interface DeliveryOptionProps {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function DeliveryOption({ active, icon, title, description, onClick }: DeliveryOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 p-3 rounded-xl border-2 text-left transition active:scale-[0.98] ${
        active
          ? 'border-dorify-primary bg-dorify-primary-light'
          : 'border-transparent bg-tg-secondary'
      }`}
    >
      <div className={`mb-2 ${active ? 'text-dorify-primary-dark' : 'text-tg-hint'}`}>
        {icon}
      </div>
      <Text
        className={`text-sm font-medium block ${active ? 'text-dorify-primary-dark' : ''}`}
      >
        {title}
      </Text>
      <Text className="text-xs text-tg-hint block mt-0.5">{description}</Text>
    </button>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pharmacyId = searchParams.get('pharmacyId');

  const items = useCartStore((s) => s.items);
  const clearPharmacy = useCartStore((s) => s.clearPharmacy);
  const itemsByPharmacy = useCartStore(selectItemsByPharmacy);

  // Resolve target pharmacy: explicit ?pharmacyId= wins, else first in cart.
  const targetPharmacyId = pharmacyId ?? Array.from(itemsByPharmacy.keys())[0];
  const pharmacyItems = targetPharmacyId
    ? itemsByPharmacy.get(targetPharmacyId) ?? []
    : [];
  const pharmacyTotal = pharmacyItems.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0,
  );

  const [phone, setPhone] = useState(() => {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    return user ? '+998' : '';
  });
  const [address, setAddress] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('PICKUP');

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

  const mutation = useMutation({
    mutationFn: async () => {
      if (!targetPharmacyId) throw new Error('Не выбрана аптека');

      const order = await ordersApi.place({
        pharmacyId: targetPharmacyId,
        items: pharmacyItems.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
        deliveryType,
        contactPhone: phone,
        deliveryAddress: deliveryType === 'DELIVERY' ? address : undefined,
      });

      // Order created. If pharmacy has Multicard — redirect to checkout.
      // If status came back as PENDING_MANUAL_CONTACT — order is заявка,
      // bot DM'нет продавцу автоматически (notification handler).
      if (order.status === 'PENDING_MANUAL_CONTACT') {
        clearPharmacy(targetPharmacyId);
        return { kind: 'manual' as const, orderId: order.id };
      }

      const payment = await paymentsApi.create(order.id);
      if (!payment.checkoutUrl?.startsWith('https://')) {
        throw new Error('Не удалось получить ссылку оплаты');
      }
      clearPharmacy(targetPharmacyId);
      return { kind: 'redirect' as const, checkoutUrl: payment.checkoutUrl };
    },
    onSuccess: (result) => {
      if (result.kind === 'redirect') {
        window.location.assign(result.checkoutUrl);
      } else {
        navigate('/cart', { replace: true });
      }
    },
  });

  if (items.length === 0 || !targetPharmacyId) {
    navigate('/cart');
    return null;
  }

  const totalQty = pharmacyItems.reduce((sum, i) => sum + i.quantity, 0);
  const canSubmit =
    phone.trim().length > 0 &&
    (deliveryType === 'PICKUP' || address.trim().length > 0);

  return (
    <div className="pb-6">
      <div className="px-4 pt-4">
        <Text className="text-lg font-bold">Оформление заказа</Text>
      </div>

      <Section title="Контакт">
        <Input
          type="tel"
          placeholder="+998 90 123 45 67"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Section>

      <Section title="Способ получения">
        <div className="flex gap-2">
          <DeliveryOption
            active={deliveryType === 'PICKUP'}
            icon={<IconStore width={22} height={22} />}
            title="Самовывоз"
            description="Из аптеки"
            onClick={() => setDeliveryType('PICKUP')}
          />
          <DeliveryOption
            active={deliveryType === 'DELIVERY'}
            icon={<IconPackage width={22} height={22} />}
            title="Доставка"
            description="Курьер"
            onClick={() => setDeliveryType('DELIVERY')}
          />
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
      </Section>

      <Section title="Ваш заказ">
        <div className="flex justify-between text-sm">
          <span className="text-tg-hint">Товаров</span>
          <span>{totalQty} шт</span>
        </div>
        <div className="h-px bg-tg-secondary my-3" />
        <div className="flex justify-between items-baseline">
          <span className="text-tg-hint">Итого</span>
          <PriceTag amount={pharmacyTotal} className="text-lg" />
        </div>
      </Section>

      {mutation.isError && (
        <div className="px-4 mt-4">
          <div className="bg-dorify-error-light text-dorify-error rounded-card p-3 flex items-start gap-2">
            <IconAlert width={18} height={18} className="shrink-0 mt-0.5" />
            <Text className="text-sm">
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Не удалось оформить заказ. Попробуйте ещё раз.'}
            </Text>
          </div>
        </div>
      )}

      <div className="px-4 mt-5">
        <Button
          mode="filled"
          size="l"
          stretched
          onClick={() => mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
          className="!bg-dorify-primary"
        >
          {mutation.isPending ? (
            <Spinner size="s" />
          ) : (
            `Оплатить · ${new Intl.NumberFormat('uz-UZ').format(pharmacyTotal)} сум`
          )}
        </Button>
      </div>
    </div>
  );
}
