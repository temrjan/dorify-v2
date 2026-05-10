import { Text } from '@telegram-apps/telegram-ui';
import type { ReactNode } from 'react';

interface SectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

export function Section({ title, description, children }: SectionProps) {
  return (
    <section className="bg-tg-section rounded-card shadow-card p-4 mt-3 space-y-3">
      {title && (
        <div className="-mb-1">
          <Text className="text-sm font-semibold block">{title}</Text>
          {description && (
            <Text className="text-xs text-tg-hint mt-0.5 block">{description}</Text>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, required, error, hint, children }: FieldProps) {
  return (
    <div>
      <label className="text-xs text-tg-hint block mb-1">
        {label}
        {required && <span className="text-dorify-error ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <Text className="text-xs text-dorify-error mt-1 block">{error}</Text>
      )}
      {hint && !error && (
        <Text className="text-xs text-tg-hint mt-1 block">{hint}</Text>
      )}
    </div>
  );
}
