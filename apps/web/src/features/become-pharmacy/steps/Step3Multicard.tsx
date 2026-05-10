import { Input, Text } from '@telegram-apps/telegram-ui';
import { Field, Section } from '../components/FormParts';
import { IconAlert } from '@shared/ui/icons';
import type { WizardErrors, WizardState } from '../types';

interface Step3Props {
  state: WizardState;
  errors: WizardErrors;
  onChange: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}

export function Step3Multicard({ state, errors, onChange }: Step3Props) {
  return (
    <>
      <div className="mt-3 bg-dorify-warning-light text-dorify-warning rounded-card p-3 flex items-start gap-2">
        <IconAlert width={18} height={18} className="shrink-0 mt-0.5" />
        <div>
          <Text className="text-sm font-medium block">Подключите Multicard позже — это не обязательно сейчас.</Text>
          <Text className="text-xs mt-1 block">
            Без Multicard заказы будут приходить как заявки в Telegram — продавец
            свяжется с покупателем напрямую. Вы можете подключить онлайн-оплату
            в любой момент в настройках аптеки.
          </Text>
        </div>
      </div>

      <Section
        title="Multicard credentials"
        description="Заполните только если у вас уже есть merchant-аккаунт. Иначе пропустите."
      >
        <Field label="App ID" error={errors.multicardAppId}>
          <Input
            placeholder="app_..."
            value={state.multicardAppId}
            onChange={(e) => onChange('multicardAppId', e.target.value)}
            status={errors.multicardAppId ? 'error' : undefined}
          />
        </Field>

        <Field label="Store ID" error={errors.multicardStoreId}>
          <Input
            placeholder="store_..."
            value={state.multicardStoreId}
            onChange={(e) => onChange('multicardStoreId', e.target.value)}
            status={errors.multicardStoreId ? 'error' : undefined}
          />
        </Field>

        <Field label="Secret" error={errors.multicardSecret} hint="Ключ хранится зашифрованным (AES-256-GCM)">
          <Input
            type="password"
            placeholder="••••••••••"
            value={state.multicardSecret}
            onChange={(e) => onChange('multicardSecret', e.target.value)}
            status={errors.multicardSecret ? 'error' : undefined}
          />
        </Field>
      </Section>
    </>
  );
}
