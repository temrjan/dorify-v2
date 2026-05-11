import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Text } from '@telegram-apps/telegram-ui';
import type { ComponentType, SVGProps } from 'react';
import { pharmacyOrdersApi } from '@shared/api/pharmacyOrders';
import {
  IconCard,
  IconChevronRight,
  IconOrders,
  IconPackage,
  IconStore,
} from '@shared/ui/icons';

interface NavCardProps {
  title: string;
  description: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  to?: string;
  disabled?: boolean;
  /** Red dot indicator показывается рядом с заголовком — без числа, v1. */
  indicator?: boolean;
}

function NavCard({ title, description, Icon, to, disabled, indicator }: NavCardProps) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => to && navigate(to)}
      className={`w-full text-left bg-tg-section rounded-card p-4 shadow-card transition flex items-center gap-3 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'
      }`}
    >
      <div
        className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${
          disabled ? 'bg-tg-secondary text-tg-hint' : 'bg-dorify-primary-light text-dorify-primary-dark'
        }`}
      >
        <Icon width={22} height={22} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Text className="font-medium block">{title}</Text>
          {indicator && (
            <span
              className="w-2 h-2 rounded-full bg-dorify-error"
              aria-label="Есть новые"
            />
          )}
          {disabled && (
            <span className="text-[10px] uppercase tracking-wider text-tg-hint bg-tg-secondary px-1.5 py-0.5 rounded">
              скоро
            </span>
          )}
        </div>
        <Text className="text-sm text-tg-hint block mt-0.5 truncate">{description}</Text>
      </div>
      {!disabled && (
        <IconChevronRight width={18} height={18} className="shrink-0 text-tg-hint" />
      )}
    </button>
  );
}

export function PharmacyHomePage() {
  // Cheap presence check — limit=1 даёт boolean "is there any new заявка?".
  // Stats endpoint с counts — отдельный PR (v2 follow-up).
  const { data: newRequestsProbe } = useQuery({
    queryKey: ['pharmacy-orders', 'has-pending-manual'],
    queryFn: () =>
      pharmacyOrdersApi.list({ page: 1, limit: 1, status: 'PENDING_MANUAL_CONTACT' }),
  });
  const hasNewRequests = (newRequestsProbe?.total ?? 0) > 0;

  return (
    <div className="px-4 pt-4 pb-8">
      <Text className="text-2xl font-bold block">Панель аптеки</Text>
      <Text className="text-tg-hint mt-1 block">
        Управление товарами, заказами и настройками.
      </Text>

      <div className="mt-6 space-y-3">
        <NavCard
          title="Мои товары"
          description="Добавление и управление каталогом"
          Icon={IconPackage}
          to="products"
        />
        <NavCard
          title="Заказы"
          description="Управление заказами покупателей"
          Icon={IconOrders}
          to="orders"
          indicator={hasNewRequests}
        />
        <NavCard
          title="Настройки оплаты"
          description="Multicard и реквизиты"
          Icon={IconCard}
          disabled
        />
        <NavCard
          title="Профиль аптеки"
          description="Название, адрес, график"
          Icon={IconStore}
          disabled
        />
      </div>
    </div>
  );
}
