import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Spinner, Text } from '@telegram-apps/telegram-ui';
import { apiClient } from '@shared/api/client';
import type { Pharmacy, PaginatedResult, Product } from '@shared/types';
import { IconCheck } from '@shared/ui/icons';

interface ChecklistItemProps {
  done: boolean;
  loading?: boolean;
  title: string;
  description: string;
  cta?: { label: string; onClick: () => void };
}

function ChecklistItem({ done, loading, title, description, cta }: ChecklistItemProps) {
  return (
    <div className="bg-tg-section rounded-card shadow-card p-4 flex items-start gap-3">
      <div
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
          done ? 'bg-dorify-success-light text-dorify-success' : 'bg-tg-secondary text-tg-hint'
        }`}
      >
        {loading ? (
          <Spinner size="s" />
        ) : done ? (
          <IconCheck width={18} height={18} />
        ) : (
          <span className="text-sm font-bold">·</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <Text className="font-medium block">{title}</Text>
        <Text className="text-sm text-tg-hint block mt-0.5">{description}</Text>
        {!done && cta && !loading && (
          <Button mode="filled" size="s" onClick={cta.onClick} className="mt-2 !bg-dorify-primary">
            {cta.label}
          </Button>
        )}
      </div>
    </div>
  );
}

export function PharmacyOnboardingPage() {
  const navigate = useNavigate();

  const profileQuery = useQuery({
    queryKey: ['pharmacy-profile'],
    queryFn: () => apiClient.get<Pharmacy>('/pharmacy/profile').then((r) => r.data),
  });

  const productsQuery = useQuery({
    queryKey: ['pharmacy-products', { limit: 1 }],
    queryFn: () =>
      apiClient
        .get<PaginatedResult<Product>>('/pharmacy/products', { params: { limit: 1 } })
        .then((r) => r.data),
  });

  const profile = profileQuery.data;
  const isVerified = profile?.isVerified ?? false;
  const hasProducts = (productsQuery.data?.total ?? 0) > 0;
  const hasMulticard = profile?.hasPaymentSettings ?? false;

  const allDone = isVerified && hasProducts && hasMulticard;

  return (
    <div className="px-4 pt-4 pb-8">
      <Text className="text-2xl font-bold block">Добро пожаловать!</Text>
      <Text className="text-tg-hint mt-1 block">
        Несколько шагов, чтобы аптека начала продавать.
      </Text>

      {allDone && (
        <div className="mt-4 bg-dorify-success-light text-dorify-success rounded-card p-3 flex items-start gap-2">
          <IconCheck width={20} height={20} className="shrink-0 mt-0.5" />
          <Text className="text-sm font-medium">
            Всё готово — аптека работает на полную.
          </Text>
        </div>
      )}

      <div className="mt-5 space-y-3">
        <ChecklistItem
          done={isVerified}
          loading={profileQuery.isLoading}
          title="Дождитесь одобрения"
          description={
            isVerified
              ? 'Аптека одобрена админом и видна покупателям.'
              : 'Заявка на модерации. Уведомление придёт в Telegram (обычно в течение 1-2 ч).'
          }
        />

        <ChecklistItem
          done={hasProducts}
          loading={productsQuery.isLoading}
          title="Добавьте первый товар"
          description={
            hasProducts
              ? `В каталоге ${productsQuery.data?.total ?? 0} ${
                  (productsQuery.data?.total ?? 0) === 1 ? 'товар' : 'товаров'
                }.`
              : 'Без товаров аптека не появится в каталоге покупателей.'
          }
          cta={
            !hasProducts
              ? { label: 'Добавить', onClick: () => navigate('../products/new') }
              : undefined
          }
        />

        <ChecklistItem
          done={hasMulticard}
          loading={profileQuery.isLoading}
          title="Подключите Multicard (опц.)"
          description={
            hasMulticard
              ? 'Онлайн-оплата работает — покупатели платят прямо в Mini App.'
              : 'Без Multicard заказы приходят как заявки в Telegram. Вы свяжетесь с покупателем и договоритесь об оплате.'
          }
        />
      </div>

      <div className="mt-6">
        <Button
          mode="filled"
          size="l"
          stretched
          onClick={() => navigate('..')}
          className="!bg-dorify-primary"
        >
          В панель аптеки
        </Button>
      </div>
    </div>
  );
}
