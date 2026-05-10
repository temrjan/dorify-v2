import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Spinner, Text } from '@telegram-apps/telegram-ui';
import { useMutation } from '@tanstack/react-query';
import { IconAlert, IconCheck } from '@shared/ui/icons';
import { StepIndicator } from './components/StepIndicator';
import { Step1Basic } from './steps/Step1Basic';
import { Step2Optional } from './steps/Step2Optional';
import { Step3Multicard } from './steps/Step3Multicard';
import { Step4Confirm } from './steps/Step4Confirm';
import { validateStep } from './validation';
import { becomePharmacyApi } from './api';
import { INITIAL_STATE, TOTAL_STEPS, type StepNumber, type WizardErrors, type WizardState } from './types';

interface SubmitResult {
  ok: boolean;
  pharmacyId?: string;
  warnings: string[];
}

/**
 * Submit orchestrator: registers pharmacy, then atomically follows up with
 * profile + payment-settings updates if user provided optional fields.
 *
 * If a follow-up call fails, the pharmacy is still registered (basic fields
 * persisted). Caller surfaces warnings; owner can edit later in panel.
 */
async function submitWizard(state: WizardState): Promise<SubmitResult> {
  const warnings: string[] = [];

  const phoneClean = state.phone.replace(/[\s-()]/g, '');
  const pharmacy = await becomePharmacyApi.register({
    name: state.name.trim(),
    slug: state.slug.trim(),
    phone: phoneClean,
    address: state.address.trim(),
    license: state.license.trim() || undefined,
  });

  // Step 2 fields → profile update
  const hasProfileExtras =
    state.description.trim() ||
    state.logoUrl ||
    state.deliveryEnabled;
  if (hasProfileExtras) {
    try {
      await becomePharmacyApi.updateProfile({
        description: state.description.trim() || undefined,
        logo: state.logoUrl || undefined,
        deliveryEnabled: state.deliveryEnabled,
        deliveryPrice: state.deliveryEnabled && state.deliveryPrice
          ? Number(state.deliveryPrice)
          : undefined,
      });
    } catch {
      warnings.push('Не удалось сохранить описание/логотип/доставку — заполните в панели аптеки.');
    }
  }

  // Step 3 fields → payment settings
  if (state.multicardAppId && state.multicardStoreId && state.multicardSecret) {
    try {
      await becomePharmacyApi.updatePaymentSettings({
        multicardAppId: state.multicardAppId,
        multicardStoreId: state.multicardStoreId,
        multicardSecret: state.multicardSecret,
      });
    } catch {
      warnings.push('Не удалось сохранить Multicard credentials — заполните в настройках.');
    }
  }

  return { ok: true, pharmacyId: pharmacy.id, warnings };
}

export default function BecomePharmacyPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<StepNumber>(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [errors, setErrors] = useState<WizardErrors>({});
  const [autoSlug, setAutoSlug] = useState(true);
  const [slugAvailable, setSlugAvailable] = useState(false);

  // Telegram BackButton
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.BackButton.show();
    const handler = () => {
      if (step > 1) {
        setStep((s) => (s - 1) as StepNumber);
      } else {
        navigate('/');
      }
    };
    tg?.BackButton.onClick(handler);
    return () => {
      tg?.BackButton.offClick(handler);
      tg?.BackButton.hide();
    };
  }, [navigate, step]);

  const updateField = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const mutation = useMutation({
    mutationFn: submitWizard,
    onSuccess: (result) => {
      // Pharmacy created — show success view (handled inline via mutation.isSuccess)
      // Warnings rendered if any.
      void result;
    },
  });

  const handleNext = () => {
    const stepErrors = validateStep(state, step);
    if (step === 1 && !slugAvailable) {
      stepErrors.slug = stepErrors.slug ?? 'Слаг занят либо ещё проверяется';
    }
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    if (step < TOTAL_STEPS) {
      setStep(((step as number) + 1) as StepNumber);
    } else {
      mutation.mutate(state);
    }
  };

  const stepLabels: Record<StepNumber, string> = {
    1: 'О магазине',
    2: 'Дополнительно',
    3: 'Оплата',
    4: 'Подтверждение',
  };

  // Success view
  if (mutation.isSuccess) {
    const result = mutation.data;
    return (
      <div className="px-4 pt-12 pb-6">
        <div className="w-20 h-20 rounded-full bg-dorify-success-light text-dorify-success flex items-center justify-center mx-auto">
          <IconCheck width={40} height={40} />
        </div>
        <Text className="text-2xl font-bold text-center mt-6 block">Заявка отправлена</Text>
        <Text className="text-tg-hint text-center mt-2 block max-w-sm mx-auto">
          Админ проверит данные и подтвердит регистрацию. Уведомление придёт в Telegram —
          обычно в течение 1-2 часов.
        </Text>
        {result.warnings.length > 0 && (
          <div className="mt-6 max-w-sm mx-auto bg-dorify-warning-light text-dorify-warning rounded-card p-3">
            <Text className="text-sm font-medium block mb-1">Несколько полей не сохранилось:</Text>
            <ul className="text-xs space-y-1 list-disc pl-4">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <Text className="text-xs mt-2 block">Заполните позже в панели аптеки.</Text>
          </div>
        )}
        <div className="mt-8 max-w-sm mx-auto">
          <Button
            mode="filled"
            size="l"
            stretched
            onClick={() => navigate('/pharmacy')}
            className="!bg-dorify-primary"
          >
            Открыть панель
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 px-4 pt-4">
      <Text className="text-lg font-bold block">Регистрация аптеки</Text>
      <Text className="text-sm text-tg-hint mt-0.5 block">
        Шаг {step} из {TOTAL_STEPS} — {stepLabels[step]}
      </Text>

      <div className="mt-3">
        <StepIndicator current={step} />
      </div>

      {step === 1 && (
        <Step1Basic
          state={state}
          errors={errors}
          autoSlug={autoSlug}
          onChange={updateField}
          onAutoSlugChange={setAutoSlug}
          onSlugAvailabilityChange={setSlugAvailable}
        />
      )}
      {step === 2 && <Step2Optional state={state} errors={errors} onChange={updateField} />}
      {step === 3 && <Step3Multicard state={state} errors={errors} onChange={updateField} />}
      {step === 4 && <Step4Confirm state={state} errors={errors} onChange={updateField} />}

      {mutation.isError && (
        <div className="mt-3 bg-dorify-error-light text-dorify-error rounded-card p-3 flex items-start gap-2">
          <IconAlert width={18} height={18} className="shrink-0 mt-0.5" />
          <Text className="text-sm">
            {mutation.error instanceof Error
              ? mutation.error.message
              : 'Не удалось зарегистрировать аптеку. Попробуйте ещё раз.'}
          </Text>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        {step > 1 && (
          <Button
            mode="plain"
            size="l"
            stretched
            onClick={() => setStep((s) => (s - 1) as StepNumber)}
            disabled={mutation.isPending}
          >
            Назад
          </Button>
        )}
        <Button
          mode="filled"
          size="l"
          stretched
          onClick={handleNext}
          disabled={mutation.isPending}
          className="!bg-dorify-primary"
        >
          {mutation.isPending ? (
            <Spinner size="s" />
          ) : step < TOTAL_STEPS ? (
            'Далее'
          ) : (
            'Создать'
          )}
        </Button>
      </div>
    </div>
  );
}
