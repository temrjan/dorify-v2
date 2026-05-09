import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Spinner, Text } from '@telegram-apps/telegram-ui';
import { paymentsApi } from '@shared/api/payments';
import { IconCheck, IconX, IconClock, IconAlert } from '@shared/ui/icons';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60_000;
const FINAL_STATUSES = ['PAID', 'FAILED', 'REFUNDED'] as const;

type FinalStatus = (typeof FINAL_STATUSES)[number];

function isFinalStatus(status: string | undefined): status is FinalStatus {
  return !!status && (FINAL_STATUSES as readonly string[]).includes(status);
}

type IconColor = 'success' | 'error' | 'warning' | 'primary';

interface ResultIconProps {
  icon: React.ReactNode;
  color: IconColor;
}

const COLOR_STYLES: Record<IconColor, string> = {
  success: 'bg-dorify-success-light text-dorify-success',
  error: 'bg-dorify-error-light text-dorify-error',
  warning: 'bg-dorify-warning-light text-dorify-warning',
  primary: 'bg-dorify-primary-light text-dorify-primary-dark',
};

function ResultIcon({ icon, color }: ResultIconProps) {
  return (
    <div
      className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${COLOR_STYLES[color]}`}
      aria-hidden="true"
    >
      {icon}
    </div>
  );
}

interface ResultViewProps {
  icon: React.ReactNode;
  color: IconColor;
  title: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

function ResultView({
  icon,
  color,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: ResultViewProps) {
  return (
    <div className="px-4 pt-12">
      <ResultIcon icon={icon} color={color} />
      <Text className="text-2xl font-bold text-center mt-6 block">{title}</Text>
      <Text className="text-tg-hint text-center mt-2 block max-w-sm mx-auto">
        {description}
      </Text>
      <div className="mt-8 space-y-2 max-w-sm mx-auto">
        <Button mode="filled" size="l" stretched onClick={onPrimary} className="!bg-dorify-primary">
          {primaryLabel}
        </Button>
        {secondaryLabel && onSecondary && (
          <Button mode="plain" size="l" stretched onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        )}
      </div>
    </div>
  );
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
      <ResultView
        icon={<IconAlert width={36} height={36} />}
        color="warning"
        title="Не указан заказ"
        description="Откройте оплату из «Моих заказов»."
        primaryLabel="К заказам"
        onPrimary={() => navigate('/orders')}
      />
    );
  }

  if (isError) {
    return (
      <ResultView
        icon={<IconAlert width={36} height={36} />}
        color="error"
        title="Не удалось получить статус"
        description={error instanceof Error ? error.message : 'Неизвестная ошибка.'}
        primaryLabel="Повторить"
        onPrimary={() => refetch()}
        secondaryLabel="К заказам"
        onSecondary={() => navigate('/orders')}
      />
    );
  }

  if (payment?.status === 'PAID') {
    const onReceipt = payment.receiptUrl
      ? () => {
          const url = payment.receiptUrl!;
          const tg = window.Telegram?.WebApp;
          if (tg?.openLink) {
            tg.openLink(url);
          } else {
            window.open(url, '_blank');
          }
        }
      : undefined;

    return (
      <ResultView
        icon={<IconCheck width={40} height={40} />}
        color="success"
        title="Оплата прошла"
        description="Заказ передан в аптеку. Уведомление придёт в Telegram, как только аптека его подтвердит."
        primaryLabel="К заказам"
        onPrimary={() => navigate('/orders')}
        secondaryLabel={onReceipt ? 'Чек ОФД' : undefined}
        onSecondary={onReceipt}
      />
    );
  }

  if (payment?.status === 'FAILED' || payment?.status === 'REFUNDED') {
    return (
      <ResultView
        icon={<IconX width={40} height={40} />}
        color="error"
        title="Оплата не прошла"
        description="Можно повторить попытку из карточки заказа."
        primaryLabel="К заказам"
        onPrimary={() => navigate('/orders')}
      />
    );
  }

  if (timedOut) {
    return (
      <ResultView
        icon={<IconClock width={40} height={40} />}
        color="warning"
        title="Платёж обрабатывается"
        description="Проверка статуса занимает дольше обычного. Откройте заказ позже — статус обновится."
        primaryLabel="Проверить ещё раз"
        onPrimary={() => {
          setPollingStarted(Date.now());
          setTimedOut(false);
          refetch();
        }}
        secondaryLabel="К заказам"
        onSecondary={() => navigate('/orders')}
      />
    );
  }

  return (
    <div className="px-4 pt-12">
      <div className="w-20 h-20 rounded-full bg-dorify-primary-light flex items-center justify-center mx-auto">
        <Spinner size="m" />
      </div>
      <Text className="text-2xl font-bold text-center mt-6 block">Подтверждаем оплату</Text>
      <Text className="text-tg-hint text-center mt-2 block max-w-sm mx-auto">
        Обычно это занимает несколько секунд.
      </Text>
    </div>
  );
}
