import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Spinner, Text } from '@telegram-apps/telegram-ui';
import { paymentsApi } from '@shared/api/payments';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60_000;
const FINAL_STATUSES = ['PAID', 'FAILED', 'REFUNDED'] as const;

type FinalStatus = (typeof FINAL_STATUSES)[number];

function isFinalStatus(status: string | undefined): status is FinalStatus {
  return !!status && (FINAL_STATUSES as readonly string[]).includes(status);
}

export default function PaymentResultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';

  const [pollingStarted, setPollingStarted] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.BackButton.show();
    const handler = () => navigate('/orders');
    tg?.BackButton.onClick(handler);
    return () => {
      tg?.BackButton.offClick(handler);
      tg?.BackButton.hide();
    };
  }, [navigate]);

  const { data: payment, isError, error, refetch } = useQuery({
    queryKey: ['payment-by-order', orderId],
    queryFn: () => paymentsApi.getByOrder(orderId),
    enabled: !!orderId && !timedOut,
    refetchInterval: (query) => {
      if (isFinalStatus(query.state.data?.status)) return false;
      if (Date.now() - pollingStarted > POLL_TIMEOUT_MS) return false;
      return POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), POLL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pollingStarted]);

  if (!orderId) {
    return (
      <div className="px-4 pt-8">
        <Text className="text-base">Не указан заказ. Откройте «Мои заказы».</Text>
        <div className="mt-4">
          <Button mode="filled" size="l" stretched onClick={() => navigate('/orders')}>
            К заказам
          </Button>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 pt-8">
        <Text className="text-base">
          Не удалось получить статус оплаты: {error instanceof Error ? error.message : 'неизвестная ошибка'}
        </Text>
        <div className="mt-4 space-y-2">
          <Button mode="filled" size="l" stretched onClick={() => refetch()}>
            Повторить
          </Button>
          <Button mode="plain" size="l" stretched onClick={() => navigate('/orders')}>
            К заказам
          </Button>
        </div>
      </div>
    );
  }

  if (payment?.status === 'PAID') {
    return (
      <div className="px-4 pt-12 text-center">
        <Text className="text-2xl font-bold">Оплата прошла</Text>
        <Text className="text-tg-hint mt-2 block">Заказ передан в аптеку.</Text>
        <div className="mt-6 space-y-2">
          {payment.receiptUrl && (
            <Button
              mode="plain"
              size="l"
              stretched
              onClick={() => {
                const url = payment.receiptUrl!;
                const tg = window.Telegram?.WebApp;
                if (tg?.openLink) {
                  tg.openLink(url);
                } else {
                  window.open(url, '_blank');
                }
              }}
            >
              Чек ОФД
            </Button>
          )}
          <Button mode="filled" size="l" stretched onClick={() => navigate('/orders')}>
            К заказам
          </Button>
        </div>
      </div>
    );
  }

  if (payment?.status === 'FAILED' || payment?.status === 'REFUNDED') {
    return (
      <div className="px-4 pt-12 text-center">
        <Text className="text-2xl font-bold">Оплата не прошла</Text>
        <Text className="text-tg-hint mt-2 block">
          Можно повторить попытку из карточки заказа.
        </Text>
        <div className="mt-6">
          <Button mode="filled" size="l" stretched onClick={() => navigate('/orders')}>
            К заказам
          </Button>
        </div>
      </div>
    );
  }

  if (timedOut) {
    return (
      <div className="px-4 pt-12 text-center">
        <Text className="text-2xl font-bold">Платёж обрабатывается</Text>
        <Text className="text-tg-hint mt-2 block">
          Проверка статуса занимает дольше обычного. Откройте заказ позже — статус обновится.
        </Text>
        <div className="mt-6 space-y-2">
          <Button
            mode="filled"
            size="l"
            stretched
            onClick={() => {
              setPollingStarted(Date.now());
              setTimedOut(false);
              refetch();
            }}
          >
            Проверить ещё раз
          </Button>
          <Button mode="plain" size="l" stretched onClick={() => navigate('/orders')}>
            К заказам
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-12 text-center">
      <Spinner size="l" />
      <Text className="text-lg font-medium mt-6 block">Подтверждаем оплату...</Text>
      <Text className="text-tg-hint mt-2 block">Обычно это занимает несколько секунд.</Text>
    </div>
  );
}
