import { Input, Textarea } from '@telegram-apps/telegram-ui';
import { Field, Section } from '../components/FormParts';
import { ImageUploadField } from '@shared/ui/ImageUploadField';
import type { WizardErrors, WizardState } from '../types';

interface Step2Props {
  state: WizardState;
  errors: WizardErrors;
  onChange: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}

export function Step2Optional({ state, errors, onChange }: Step2Props) {
  return (
    <>
      <Section title="О бизнесе" description="Не обязательно — можно заполнить позже в панели">
        <Field label="Описание" error={errors.description} hint="До 2000 символов">
          <Textarea
            placeholder="Аптека работает с 2010 года, специализируется на..."
            value={state.description}
            onChange={(e) => onChange('description', e.target.value)}
            rows={4}
          />
        </Field>

        <ImageUploadField
          scope="logos"
          value={state.logoUrl}
          onChange={(url) => onChange('logoUrl', url)}
          label="Логотип аптеки"
          hint="Покажется покупателям в каталоге · JPEG / PNG / WebP до 5 МБ"
        />
      </Section>

      <Section title="Доставка">
        <label className="flex items-center justify-between py-2 cursor-pointer">
          <span className="text-sm">Доставка по городу</span>
          <input
            type="checkbox"
            checked={state.deliveryEnabled}
            onChange={(e) => onChange('deliveryEnabled', e.target.checked)}
            className="w-5 h-5 accent-dorify-primary"
          />
        </label>

        {state.deliveryEnabled && (
          <Field
            label="Стоимость доставки (UZS)"
            error={errors.deliveryPrice}
            hint="0 — бесплатная доставка"
          >
            <Input
              type="number"
              inputMode="numeric"
              placeholder="15000"
              value={state.deliveryPrice}
              onChange={(e) => onChange('deliveryPrice', e.target.value)}
              status={errors.deliveryPrice ? 'error' : undefined}
            />
          </Field>
        )}
      </Section>
    </>
  );
}
