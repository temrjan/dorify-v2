import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Text, Textarea } from '@telegram-apps/telegram-ui';
import { pharmaciesApi } from '@shared/api/pharmacies';
import { LogoUpload } from '@features/become-pharmacy/components/LogoUpload';
import { Skeleton } from '@shared/ui/Skeleton';
import { IconAlert, IconCheck } from '@shared/ui/icons';
import type { UpdateProfilePayload } from '@shared/api/pharmacies';

const TOAST_AUTO_HIDE_MS = 3000;

interface FormErrors {
  name?: string;
  address?: string;
  phone?: string;
  description?: string;
  deliveryPrice?: string;
}

interface FormDraft {
  name: string;
  description: string;
  address: string;
  phone: string;
  logo: string;
  deliveryEnabled: boolean;
  deliveryPrice: string; // raw input — converted to number on submit
}

// Backend Zod schema bounds (UpdatePharmacySchema):
// name: 2..200, description: ≤2000, address: 5..500, phone: 9..15.
function validate(draft: FormDraft): FormErrors {
  const errors: FormErrors = {};
  if (draft.name.trim().length < 2) errors.name = 'Минимум 2 символа';
  if (draft.name.trim().length > 200) errors.name = 'Максимум 200 символов';
  if (draft.address.trim().length < 5) errors.address = 'Минимум 5 символов';
  if (draft.address.trim().length > 500) errors.address = 'Максимум 500 символов';
  const phoneClean = draft.phone.replace(/[\s\-()]/g, '');
  if (phoneClean.length === 0) errors.phone = 'Обязательное поле';
  else if (phoneClean.length < 9) errors.phone = 'Слишком короткий номер';
  else if (phoneClean.length > 15) errors.phone = 'Слишком длинный номер';
  if (draft.description.length > 2000) errors.description = 'Максимум 2000 символов';
  if (draft.deliveryEnabled && draft.deliveryPrice) {
    const price = Number(draft.deliveryPrice);
    if (!Number.isFinite(price) || price < 0) errors.deliveryPrice = 'Должно быть число ≥ 0';
  }
  return errors;
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  // Sentinel-undefined: local state takes over только after user edits. Until
  // then, value falls back to fetched profile data (sync с server).
  const [draftLocal, setDraftLocal] = useState<Partial<FormDraft> | undefined>(undefined);
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['pharmacy-profile'],
    queryFn: () => pharmaciesApi.getProfile(),
    staleTime: 60_000,
  });

  // Derive effective form values: local override → server data → empty.
  const draft: FormDraft = {
    name: draftLocal?.name ?? profileQuery.data?.name ?? '',
    description: draftLocal?.description ?? profileQuery.data?.description ?? '',
    address: draftLocal?.address ?? profileQuery.data?.address ?? '',
    phone: draftLocal?.phone ?? profileQuery.data?.phone ?? '',
    logo: draftLocal?.logo ?? profileQuery.data?.logo ?? '',
    deliveryEnabled: draftLocal?.deliveryEnabled ?? profileQuery.data?.deliveryEnabled ?? false,
    deliveryPrice:
      draftLocal?.deliveryPrice ??
      (profileQuery.data?.deliveryPrice != null ? String(profileQuery.data.deliveryPrice) : ''),
  };

  const updateField = <K extends keyof FormDraft>(key: K, value: FormDraft[K]) => {
    setDraftLocal((prev) => ({ ...(prev ?? {}), [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as keyof FormErrors];
        return next;
      });
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const mutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => pharmaciesApi.updateProfile(payload),
    retry: 0,
    onSuccess: () => {
      setToast('Профиль обновлён');
      setDraftLocal(undefined); // reset sentinel — server is source of truth
      queryClient.invalidateQueries({ queryKey: ['pharmacy-profile'] });
    },
  });

  const handleSubmit = () => {
    const validationErrors = validate(draft);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    const payload: UpdateProfilePayload = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      address: draft.address.trim(),
      phone: draft.phone.replace(/[\s\-()]/g, ''),
      logo: draft.logo || undefined,
      deliveryEnabled: draft.deliveryEnabled,
      deliveryPrice: draft.deliveryEnabled && draft.deliveryPrice
        ? Number(draft.deliveryPrice)
        : undefined,
    };
    mutation.mutate(payload);
  };

  if (profileQuery.isLoading) {
    return (
      <div className="px-4 pt-4 pb-8 space-y-3">
        <Skeleton className="h-8 w-2/3 rounded" />
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-32 rounded-card" />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="px-4 pt-4 pb-8">
        <div className="bg-dorify-error-light text-dorify-error rounded-card p-3 flex items-start gap-2">
          <IconAlert width={18} height={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <Text className="text-sm font-medium block">Не удалось загрузить профиль</Text>
            <Text className="text-xs mt-1 block">
              {profileQuery.error instanceof Error ? profileQuery.error.message : 'Попробуйте ещё раз'}
            </Text>
            <button
              type="button"
              onClick={() => profileQuery.refetch()}
              className="text-xs font-medium underline mt-2"
            >
              Повторить
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      className="px-4 pt-4 pb-8"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <Text className="text-2xl font-bold block">Профиль аптеки</Text>
      <Text className="text-tg-hint text-sm mt-1 block">
        Название, контакты, описание, доставка. Slug и лицензия — неизменяемые.
      </Text>

      {/* Basic info */}
      <section className="mt-4 bg-tg-section rounded-card p-3 space-y-3">
        <div>
          <label className="text-xs text-tg-hint block mb-1">
            Название <span className="text-dorify-error">*</span>
          </label>
          <Input
            value={draft.name}
            onChange={(e) => updateField('name', e.target.value)}
            status={errors.name ? 'error' : undefined}
            disabled={mutation.isPending}
            placeholder="Аптека «Здоровье»"
          />
          {errors.name && (
            <Text className="text-xs text-dorify-error mt-1 block">{errors.name}</Text>
          )}
        </div>

        <div>
          <label className="text-xs text-tg-hint block mb-1">
            Адрес <span className="text-dorify-error">*</span>
          </label>
          <Input
            value={draft.address}
            onChange={(e) => updateField('address', e.target.value)}
            status={errors.address ? 'error' : undefined}
            disabled={mutation.isPending}
            placeholder="г. Ташкент, ул. Амира Темура, 12"
          />
          {errors.address && (
            <Text className="text-xs text-dorify-error mt-1 block">{errors.address}</Text>
          )}
        </div>

        <div>
          <label className="text-xs text-tg-hint block mb-1">
            Контактный телефон <span className="text-dorify-error">*</span>
          </label>
          <Input
            type="tel"
            inputMode="tel"
            value={draft.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            status={errors.phone ? 'error' : undefined}
            disabled={mutation.isPending}
            placeholder="+998 90 123 45 67"
          />
          {errors.phone && (
            <Text className="text-xs text-dorify-error mt-1 block">{errors.phone}</Text>
          )}
        </div>

        <div>
          <label className="text-xs text-tg-hint block mb-1">Описание</label>
          <Textarea
            value={draft.description}
            onChange={(e) => updateField('description', e.target.value)}
            disabled={mutation.isPending}
            rows={4}
            placeholder="Работаем с 2010 года, специализируемся на..."
          />
          {errors.description && (
            <Text className="text-xs text-dorify-error mt-1 block">{errors.description}</Text>
          )}
        </div>

        <LogoUpload
          value={draft.logo}
          onChange={(url) => updateField('logo', url)}
          disabled={mutation.isPending}
        />
      </section>

      {/* Delivery */}
      <section className="mt-3 bg-tg-section rounded-card p-3 space-y-3">
        <label className="flex items-center justify-between py-2 cursor-pointer">
          <span className="text-sm font-medium">Доставка по городу</span>
          <input
            type="checkbox"
            checked={draft.deliveryEnabled}
            onChange={(e) => updateField('deliveryEnabled', e.target.checked)}
            disabled={mutation.isPending}
            className="w-5 h-5 accent-dorify-primary"
          />
        </label>

        {draft.deliveryEnabled && (
          <div>
            <label className="text-xs text-tg-hint block mb-1">Стоимость доставки (UZS)</label>
            <Input
              type="number"
              inputMode="numeric"
              value={draft.deliveryPrice}
              onChange={(e) => updateField('deliveryPrice', e.target.value)}
              status={errors.deliveryPrice ? 'error' : undefined}
              disabled={mutation.isPending}
              placeholder="15000"
            />
            {errors.deliveryPrice && (
              <Text className="text-xs text-dorify-error mt-1 block">{errors.deliveryPrice}</Text>
            )}
            <Text className="text-xs text-tg-hint mt-1 block">
              0 = бесплатная доставка
            </Text>
          </div>
        )}
      </section>

      {/* Error */}
      {mutation.isError && (
        <div className="mt-3 bg-dorify-error-light text-dorify-error rounded-card p-3 flex items-start gap-2">
          <IconAlert width={18} height={18} className="shrink-0 mt-0.5" />
          <Text className="text-sm flex-1">
            {mutation.error instanceof Error
              ? mutation.error.message
              : 'Не удалось сохранить профиль'}
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
