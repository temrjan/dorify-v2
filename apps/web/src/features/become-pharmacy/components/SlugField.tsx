import { useEffect, useState } from 'react';
import { Input, Text } from '@telegram-apps/telegram-ui';
import slugify from 'slugify';
import { becomePharmacyApi } from '../api';

interface SlugFieldProps {
  /** Current slug value (controlled). */
  value: string;
  /** Source name for auto-translit while user не редактировал slug вручную. */
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
  nameSource,
  error,
  onChange,
  onAvailabilityChange,
}: SlugFieldProps) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [suggestion, setSuggestion] = useState<string | undefined>();
  // Auto-derive enabled until user edits либо taps suggestion. Owned
  // INTERNALLY — раньше parent flipped flag через shared onChange callback,
  // что ломало последующие keystrokes (auto-derive emit → parent flips →
  // next char skipped). Now SlugField solely decides когда auto-derive.
  const [autoFromName, setAutoFromName] = useState(() => value.length === 0);

  // Auto-derive slug from name. Skipped после user edit либо tap suggestion.
  useEffect(() => {
    if (!autoFromName) return;
    const derived = normalize(nameSource);
    if (derived !== value) {
      onChange(derived);
    }
  }, [autoFromName, nameSource, value, onChange]);

  // Debounced availability check. setState calls deferred внутрь setTimeout
  // → не triggers cascading renders (react-hooks/immutability rule).
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      const handle = setTimeout(() => {
        setStatus('idle');
        setSuggestion(undefined);
        onAvailabilityChange(false);
      }, 0);
      return () => clearTimeout(handle);
    }
    const checkingHandle = setTimeout(() => setStatus('checking'), 0);
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
    return () => {
      clearTimeout(checkingHandle);
      clearTimeout(handle);
    };
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
        onChange={(e) => {
          // User manual edit — disable auto-derive до конца сессии.
          setAutoFromName(false);
          onChange(normalize(e.target.value));
        }}
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
          onClick={() => {
            setAutoFromName(false);
            onChange(suggestion);
          }}
          className="mt-1 text-xs text-dorify-primary underline"
        >
          Использовать «{suggestion}»
        </button>
      )}
    </div>
  );
}
