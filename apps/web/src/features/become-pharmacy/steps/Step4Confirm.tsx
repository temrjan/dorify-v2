import { Text } from '@telegram-apps/telegram-ui';
import { Section } from '../components/FormParts';
import { IconStore, IconCheck, IconX } from '@shared/ui/icons';
import { Pill } from '@shared/ui/Pill';
import type { WizardErrors, WizardState } from '../types';

interface Step4Props {
  state: WizardState;
  errors: WizardErrors;
  onChange: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}

export function Step4Confirm({ state, errors, onChange }: Step4Props) {
  const hasMulticard = state.multicardAppId && state.multicardStoreId && state.multicardSecret;

  return (
    <>
      <Section title="Превью карточки" description="Так аптека будет видна покупателям">
        <div className="bg-tg-bg rounded-card p-4 flex gap-3 items-start">
          {state.logoUrl ? (
            <img
              src={state.logoUrl}
              alt={state.name}
              className="w-16 h-16 rounded-lg object-cover bg-tg-secondary shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-dorify-primary-light flex items-center justify-center shrink-0">
              <IconStore width={32} height={32} className="text-dorify-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <Text className="font-semibold block truncate">{state.name || '—'}</Text>
            <Text className="text-xs text-tg-hint block mt-0.5 break-all">
              app.dorify.uz/p/{state.slug || '—'}
            </Text>
            {state.address && (
              <Text className="text-xs mt-1 block line-clamp-2">{state.address}</Text>
            )}
          </div>
        </div>
      </Section>

      <Section title="Подключённые сервисы">
        <div className="flex items-center justify-between text-sm">
          <span>Доставка</span>
          {state.deliveryEnabled ? (
            <Pill variant="success" icon={<IconCheck width={12} height={12} />}>
              Включена
            </Pill>
          ) : (
            <Pill variant="neutral" icon={<IconX width={12} height={12} />}>
              Отключена
            </Pill>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Multicard (онлайн-оплата)</span>
          {hasMulticard ? (
            <Pill variant="success" icon={<IconCheck width={12} height={12} />}>
              Подключена
            </Pill>
          ) : (
            <Pill variant="neutral">Не подключена</Pill>
          )}
        </div>
      </Section>

      <Section title="Согласие">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={state.agreedToTerms}
            onChange={(e) => onChange('agreedToTerms', e.target.checked)}
            className="w-5 h-5 mt-0.5 accent-dorify-primary shrink-0"
          />
          <span className="text-sm">
            Я согласен с{' '}
            <a
              href="https://dorify.uz/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-dorify-primary underline"
            >
              правилами площадки
            </a>{' '}
            и подтверждаю достоверность данных.
          </span>
        </label>
        {errors.agreedToTerms && (
          <Text className="text-xs text-dorify-error mt-1 block">{errors.agreedToTerms}</Text>
        )}
      </Section>

      <div className="mt-4 px-1">
        <Text className="text-xs text-tg-hint">
          После создания заявка попадёт на модерацию. Обычно админ одобряет в течение
          1-2 часов. Вам придёт уведомление в Telegram.
        </Text>
      </div>
    </>
  );
}
