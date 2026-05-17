import { useRef, useState } from 'react';
import { Button, Text } from '@telegram-apps/telegram-ui';
import { uploadImage, type UploadScope } from '@shared/api/uploads';
import { IconAlert, IconImage } from './icons';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

interface ImageUploadFieldProps {
  scope: UploadScope;
  value: string;
  onChange: (url: string) => void;
  /** Top label rendered above the picker / preview. */
  label: string;
  /** Optional hint copy inside the empty-state picker. */
  hint?: string;
  /** External lock — `true` disables picker, replace, remove. Used пока parent form мутация pending. */
  disabled?: boolean;
}

/**
 * Single-image upload widget used both by the pharmacy onboarding wizard
 * (`scope=logos`) and the product editor (`scope=products`). Mirrors
 * server-side limits client-side для быстрого fail без round-trip:
 * - 5 MB max
 * - MIME starts с `image/`
 *
 * Server still validates magic bytes and re-rejects anything that lies
 * about its MIME, so this is purely for UX.
 */
export function ImageUploadField({
  scope,
  value,
  onChange,
  label,
  hint,
  disabled: externalDisabled = false,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const locked = externalDisabled || uploading;

  const handlePick = (): void => {
    inputRef.current?.click();
  };

  const handleFile = async (file: File): Promise<void> => {
    setError(undefined);

    if (file.size > MAX_BYTES) {
      setError('Файл больше 5 МБ');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Только изображения (JPEG / PNG / WebP)');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadImage(file, scope);
      onChange(result.url);
    } catch (err: unknown) {
      // Backend rejects non-image via magic bytes → 400 BadRequest
      const message = err instanceof Error ? err.message : 'Не удалось загрузить';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (): void => {
    onChange('');
    setError(undefined);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <label className="text-xs text-tg-hint block mb-1">{label}</label>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void handleFile(file);
          }
        }}
      />

      {value ? (
        <div className="flex items-center gap-3">
          <img
            src={value}
            alt={label}
            className="w-20 h-20 rounded-lg object-cover bg-tg-secondary"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="flex-1 flex flex-col gap-2">
            <Button mode="outline" size="s" onClick={handlePick} disabled={locked}>
              Заменить
            </Button>
            <Button mode="plain" size="s" onClick={handleRemove} disabled={locked}>
              Удалить
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePick}
          disabled={locked}
          aria-label={label}
          aria-busy={uploading}
          className="w-full border-2 border-dashed border-tg-hint/30 hover:border-tg-hint/60 rounded-card py-8 px-4 flex flex-col items-center gap-2 transition active:scale-[0.99] disabled:opacity-60"
        >
          <span className="w-14 h-14 rounded-full bg-tg-section flex items-center justify-center">
            <IconImage width={28} height={28} className="text-tg-hint" />
          </span>
          <Text className="text-base font-semibold">
            {uploading ? 'Загружаем...' : label}
          </Text>
          {hint && (
            <Text className="text-xs text-tg-hint text-center">{hint}</Text>
          )}
        </button>
      )}

      {error && (
        <div className="mt-2 bg-dorify-error-light text-dorify-error rounded-card p-2 flex items-start gap-2">
          <IconAlert width={16} height={16} className="shrink-0 mt-0.5" />
          <Text className="text-xs">{error}</Text>
        </div>
      )}
    </div>
  );
}
