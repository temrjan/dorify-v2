import { useEffect, useState } from 'react';
import { Input, Text } from '@telegram-apps/telegram-ui';
import slugify from 'slugify';
import { becomePharmacyApi } from '../api';

interface SlugFieldProps {
  /** Current slug value (controlled). */
  value: string;
  /** When true, derives slug automatically from `nameSource` until user manually edits. */
  autoFromName: boolean;
  /** Source name for auto-translit when `autoFromName` is true. */
  nameSource: string;
  /** Validation error from form-level validation. */
  error?: string;
  onChange: (slug: string) => void;
  onAvailabilityChange: (available: boolean) => void;
}

const DEBOUNCE_MS = 500;

function normalize(input: string): string {
  return slugify(input, { lower: true, strict: true, locale: 'ru' });
}

export function SlugField({
  value,
  autoFromName,
  nameSource,
  error,
  onChange,
  onAvailabilityChange,
}: SlugFieldProps) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [suggestion, setSuggestion] = useState<string | undefined>();

  // Auto-derive slug from name until user manually edits.
  useEffect(() => {
    if (autoFromName) {
      const derived = normalize(nameSource);
      if (derived !== value) {
        onChange(derived);
      }
    }
    // We intentionally exclude `value` and `onChange` to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFromName, nameSource]);

  // Debounced availability check.
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setStatus('idle');
      setSuggestion(undefined);
      onAvailabilityChange(false);
      return;
    }
    setStatus('checking');
    const handle = setTimeout(async () => {
      try {
        const result = await becomePharmacyApi.checkSlug(trimmed);
        if (result.available) {
          setStatus('available');
          setSuggestion(undefined);
          onAvailabilityChange(true);
        } else {
          setStatus('taken');
          setSuggestion(result.suggestion);
          onAvailabilityChange(false);
        }
      } catch {
        // Network/auth failure — don't block submission, server-side validation will catch
        setStatus('idle');
        onAvailabilityChange(true);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [value, onAvailabilityChange]);

  const helperText = (() => {
    if (error) return error;
    if (status === 'checking') return 'Проверяем...';
    if (status === 'available') return '✓ URL свободен';
    if (status === 'taken') {
      return suggestion
        ? `Занят. Свободен: ${suggestion}`
        : 'Занят. Попробуйте другой.';
    }
    return undefined;
  })();

  const helperColor = (() => {
    if (error || status === 'taken') return 'text-dorify-error';
    if (status === 'available') return 'text-dorify-success';
    return 'text-tg-hint';
  })();

  return (
    <div>
      <label className="text-xs text-tg-hint block mb-1">
        URL аптеки <span className="text-dorify-error ml-0.5">*</span>
      </label>
      <Input
        placeholder="apteka-siti"
        value={value}
        onChange={(e) => onChange(normalize(e.target.value))}
        status={status === 'taken' || error ? 'error' : undefined}
      />
      <Text className="text-xs text-tg-hint mt-1 block break-all">
        app.dorify.uz/p/{value || '...'}
      </Text>
      {helperText && (
        <Text className={`text-xs mt-1 block ${helperColor}`}>{helperText}</Text>
      )}
      {status === 'taken' && suggestion && (
        <button
          type="button"
          onClick={() => onChange(suggestion)}
          className="mt-1 text-xs text-dorify-primary underline"
        >
          Использовать «{suggestion}»
        </button>
      )}
    </div>
  );
}
