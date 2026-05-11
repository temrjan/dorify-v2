import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Text } from '@telegram-apps/telegram-ui';
import { pharmaciesApi } from '@shared/api/pharmacies';
import { Pill } from '@shared/ui/Pill';
import { Skeleton } from '@shared/ui/Skeleton';
import { IconAlert, IconCard, IconCheck } from '@shared/ui/icons';
import type { UpdatePaymentSettingsPayload } from '@shared/api/pharmacies';

const TOAST_AUTO_HIDE_MS = 3000;

interface FormErrors {
  multicardAppId?: string;
  multicardStoreId?: string;
  multicardSecret?: string;
}

function validate(payload: UpdatePaymentSettingsPayload): FormErrors {
  const errors: FormErrors = {};
  if (!payload.multicardAppId.trim()) errors.multicardAppId = 'Обязательное поле';
  if (!payload.multicardStoreId.trim()) errors.multicardStoreId = 'Обязательное поле';
  if (!payload.multicardSecret.trim()) errors.multicardSecret = 'Обязательное поле';
  return errors;
}

export function PaymentSettingsPage() {
  const queryClient = useQueryClient();
  // Sentinel-undefined: local state takes over only after user types. Until
  // then, value falls back to fetched data — avoids useEffect setState anti-
  // pattern (react-hooks/set-state-in-effect). Empty string = user explicitly
  // cleared, doesn't fall back.
  const [appIdLocal, setAppIdLocal] = useState<string | undefined>(undefined);
  const [storeIdLocal, setStoreIdLocal] = useState<string | undefined>(undefined);
  const [secret, setSecret] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['pharmacy-payment-settings'],
    queryFn: () => pharmaciesApi.getPaymentSettings(),
    staleTime: 60_000,
  });

  const appId = appIdLocal ?? settingsQuery.data?.multicardAppId ?? '';
  const storeId = storeIdLocal ?? settingsQuery.data?.multicardStoreId ?? '';

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const mutation = useMutation({
    mutationFn: (payload: UpdatePaymentSettingsPayload) =>
      pharmaciesApi.updatePaymentSettings(payload),
    retry: 0,
    onSuccess: () => {
      setToast('Настройки сохранены');
      setSecret('');
      // After save, reset sentinel so fetched data drives display again
      setAppIdLocal(undefined);
      setStoreIdLocal(undefined);
      queryClient.invalidateQueries({ queryKey: ['pharmacy-payment-settings'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacy-profile'] });
    },
  });

  const handleSubmit = () => {
    const payload: UpdatePaymentSettingsPayload = {
      multicardAppId: appId.trim(),
      multicardStoreId: storeId.trim(),
      multicardSecret: secret.trim(),
    };
    const validationErrors = validate(payload);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    mutation.mutate(payload);
  };

  if (settingsQuery.isLoading) {
    return (
      <div className="px-4 pt-4 pb-8 space-y-3">
        <Skeleton className="h-8 w-2/3 rounded" />
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-48 rounded-card" />
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className="px-4 pt-4 pb-8">
        <div className="bg-dorify-error-light text-dorify-error rounded-card p-3 flex items-start gap-2">
          <IconAlert width={18} height={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <Text className="text-sm font-medium block">Не удалось загрузить настройки</Text>
            <Text className="text-xs mt-1 block">
              {settingsQuery.error instanceof Error ? settingsQuery.error.message : 'Попробуйте ещё раз'}
            </Text>
            <button
              type="button"
              onClick={() => settingsQuery.refetch()}
              className="text-xs font-medium underline mt-2"
            >
              Повторить
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasCredentials = Boolean(settingsQuery.data?.multicardSecret);

  return (
    <form
      className="px-4 pt-4 pb-8"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <Text className="text-2xl font-bold block">Настройки оплаты</Text>
      <Text className="text-tg-hint text-sm mt-1 block">
        Multicard credentials аптеки. Шифруются при сохранении.
      </Text>

      {/* Status banner */}
      <section className="mt-4 bg-tg-section rounded-card p-3 flex items-center gap-3">
        <div
          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            hasCredentials ? 'bg-dorify-success-light text-dorify-success' : 'bg-tg-secondary text-tg-hint'
          }`}
        >
          {hasCredentials ? <IconCheck width={20} height={20} /> : <IconCard width={20} height={20} />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Text className="text-sm font-medium">
              {hasCredentials ? 'Multicard подключён' : 'Multicard не подключён'}
            </Text>
            <Pill variant={hasCredentials ? 'success' : 'neutral'} size="sm">
              {hasCredentials ? 'активно' : 'нет креденшелов'}
            </Pill>
          </div>
          <Text className="text-xs text-tg-hint mt-0.5">
            {hasCredentials
              ? 'Покупатели могут оплачивать онлайн через Multicard.'
              : 'Без креденшелов покупатели смогут только отправлять заявки — продавец связывается по телефону.'}
          </Text>
        </div>
      </section>

      {/* Form */}
      <section className="mt-3 bg-tg-section rounded-card p-3 space-y-3">
        <div>
          <label className="text-xs text-tg-hint block mb-1">
            Application ID
            <span className="text-dorify-error ml-0.5">*</span>
          </label>
          <Input
            placeholder="например: rhmt_test"
            value={appId}
            onChange={(e) => setAppIdLocal(e.target.value)}
            status={errors.multicardAppId ? 'error' : undefined}
            disabled={mutation.isPending}
          />
          {errors.multicardAppId && (
            <Text className="text-xs text-dorify-error mt-1 block">{errors.multicardAppId}</Text>
          )}
        </div>

        <div>
          <label className="text-xs text-tg-hint block mb-1">
            Store ID
            <span className="text-dorify-error ml-0.5">*</span>
          </label>
          <Input
            placeholder="например: 6"
            value={storeId}
            onChange={(e) => setStoreIdLocal(e.target.value)}
            status={errors.multicardStoreId ? 'error' : undefined}
            disabled={mutation.isPending}
          />
          {errors.multicardStoreId && (
            <Text className="text-xs text-dorify-error mt-1 block">{errors.multicardStoreId}</Text>
          )}
        </div>

        <div>
          <label className="text-xs text-tg-hint block mb-1">
            Secret
            <span className="text-dorify-error ml-0.5">*</span>
          </label>
          <Input
            type="password"
            placeholder={hasCredentials ? 'Введите заново для замены' : 'Multicard secret key'}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            status={errors.multicardSecret ? 'error' : undefined}
            disabled={mutation.isPending}
            autoComplete="off"
            spellCheck={false}
          />
          {errors.multicardSecret && (
            <Text className="text-xs text-dorify-error mt-1 block">{errors.multicardSecret}</Text>
          )}
          <Text className="text-xs text-tg-hint mt-1 block">
            Шифруется AES-256 на сервере. Реальное значение никогда не передаётся обратно.
          </Text>
        </div>
      </section>

      {/* Error */}
      {mutation.isError && (
        <div className="mt-3 bg-dorify-error-light text-dorify-error rounded-card p-3 flex items-start gap-2">
          <IconAlert width={18} height={18} className="shrink-0 mt-0.5" />
          <Text className="text-sm flex-1">
            {mutation.error instanceof Error
              ? mutation.error.message
              : 'Не удалось сохранить настройки'}
          </Text>
        </div>
      )}

      {/* Submit */}
      <div className="mt-6">
        <Button
          type="submit"
          mode="filled"
          size="l"
          stretched
          disabled={mutation.isPending}
          className="!bg-dorify-primary"
        >
          {mutation.isPending ? 'Сохраняем...' : 'Сохранить'}
        </Button>
      </div>

      {/* Success toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-dorify-success text-white px-4 py-2 rounded-card shadow-card"
        >
          <Text className="text-sm flex items-center gap-2">
            <IconCheck width={16} height={16} />
            {toast}
          </Text>
        </div>
      )}
    </form>
  );
}
