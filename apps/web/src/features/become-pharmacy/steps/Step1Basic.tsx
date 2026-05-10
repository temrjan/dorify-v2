import { Input, Textarea } from '@telegram-apps/telegram-ui';
import { Field, Section } from '../components/FormParts';
import { SlugField } from '../components/SlugField';
import type { WizardErrors, WizardState } from '../types';

interface Step1Props {
  state: WizardState;
  errors: WizardErrors;
  /** Whether slug should auto-derive from name (turns false on manual edit). */
  autoSlug: boolean;
  onChange: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  onAutoSlugChange: (auto: boolean) => void;
  onSlugAvailabilityChange: (available: boolean) => void;
}

export function Step1Basic({
  state,
  errors,
  autoSlug,
  onChange,
  onAutoSlugChange,
  onSlugAvailabilityChange,
}: Step1Props) {
  return (
    <>
      <Section title="Об аптеке" description="Эти данные увидят покупатели">
        <Field label="Название" required error={errors.name}>
          <Input
            placeholder="Аптека Сити"
            value={state.name}
            onChange={(e) => onChange('name', e.target.value)}
            status={errors.name ? 'error' : undefined}
          />
        </Field>

        <SlugField
          value={state.slug}
          autoFromName={autoSlug}
          nameSource={state.name}
          error={errors.slug}
          onChange={(slug) => {
            onAutoSlugChange(false);
            onChange('slug', slug);
          }}
          onAvailabilityChange={onSlugAvailabilityChange}
        />

        <Field label="Адрес" required error={errors.address}>
          <Textarea
            placeholder="ул. Навои 1, Ташкент"
            value={state.address}
            onChange={(e) => onChange('address', e.target.value)}
            rows={2}
          />
        </Field>
      </Section>

      <Section title="Контакт">
        <Field label="Телефон" required error={errors.phone} hint="Формат: +998 XX XXX XX XX">
          <Input
            type="tel"
            inputMode="tel"
            placeholder="+998 90 123 45 67"
            value={state.phone}
            onChange={(e) => onChange('phone', e.target.value)}
            status={errors.phone ? 'error' : undefined}
          />
        </Field>

        <Field label="Лицензия (необязательно)" error={errors.license} hint="Номер лицензии Минздрава">
          <Input
            placeholder="LIC-12345"
            value={state.license}
            onChange={(e) => onChange('license', e.target.value)}
          />
        </Field>
      </Section>
    </>
  );
}
