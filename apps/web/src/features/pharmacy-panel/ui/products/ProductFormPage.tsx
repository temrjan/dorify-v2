import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Spinner, Text, Textarea } from '@telegram-apps/telegram-ui';
import { pharmacyProductsApi } from '@shared/api/pharmacyProducts';
import type {
  CreateProductPayload,
  UpdateProductPayload,
} from '@shared/api/pharmacyProducts';
import type { Product } from '@shared/types';
import { IconAlert } from '@shared/ui/icons';
import { CATEGORIES } from '@shared/constants/categories';
import { ProductStatusBadge } from './components/ProductStatusBadge';

interface FormState {
  name: string;
  description: string;
  activeSubstance: string;
  manufacturer: string;
  barcode: string;
  category: string;
  price: string;
  imageUrl: string;
  ikpu: string;
  packageCode: string;
  vat: string;
  stock: string;
  requiresPrescription: boolean;
}

const INITIAL_FORM: FormState = {
  name: '',
  description: '',
  activeSubstance: '',
  manufacturer: '',
  barcode: '',
  category: '',
  price: '',
  imageUrl: '',
  ikpu: '',
  packageCode: '',
  vat: '12',
  stock: '0',
  requiresPrescription: false,
};

const VAT_OPTIONS = [
  { value: '0', label: 'Без НДС (0%)' },
  { value: '12', label: '12%' },
  { value: '15', label: '15%' },
];

type FormErrors = Partial<Record<keyof FormState, string>>;

function fromProduct(product: Product): FormState {
  return {
    name: product.name,
    description: product.description ?? '',
    activeSubstance: product.activeSubstance ?? '',
    manufacturer: product.manufacturer ?? '',
    barcode: product.barcode ?? '',
    category: product.category ?? '',
    price: String(product.price),
    imageUrl: product.imageUrl ?? '',
    ikpu: product.ikpu ?? '',
    packageCode: product.packageCode ?? '',
    vat: product.vat !== undefined ? String(product.vat) : '12',
    stock: String(product.stock),
    requiresPrescription: product.requiresPrescription,
  };
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  const name = form.name.trim();
  if (name.length < 2) errors.name = 'Минимум 2 символа';
  if (name.length > 300) errors.name = 'Максимум 300 символов';

  if (form.description.length > 5000) {
    errors.description = 'Максимум 5000 символов';
  }
  if (form.activeSubstance.length > 300) {
    errors.activeSubstance = 'Максимум 300 символов';
  }
  if (form.manufacturer.length > 300) {
    errors.manufacturer = 'Максимум 300 символов';
  }
  if (form.barcode.length > 50) {
    errors.barcode = 'Максимум 50 символов';
  }
  if (form.category.length > 100) {
    errors.category = 'Максимум 100 символов';
  }

  const price = Number(form.price);
  if (!Number.isFinite(price) || price <= 0) {
    errors.price = 'Цена должна быть больше 0';
  }

  if (form.imageUrl && !/^https?:\/\//i.test(form.imageUrl)) {
    errors.imageUrl = 'URL должен начинаться с http:// или https://';
  }

  if (form.ikpu && !/^\d{17}$/.test(form.ikpu)) {
    errors.ikpu = 'ИКПУ — ровно 17 цифр';
  }

  if (form.packageCode && form.packageCode.length > 20) {
    errors.packageCode = 'Максимум 20 символов';
  }

  if (form.stock) {
    const stock = Number(form.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      errors.stock = 'Целое число ≥ 0';
    }
  }

  return errors;
}

function buildPayload(form: FormState): CreateProductPayload {
  const trim = (s: string) => s.trim() || undefined;
  return {
    name: form.name.trim(),
    description: trim(form.description),
    activeSubstance: trim(form.activeSubstance),
    manufacturer: trim(form.manufacturer),
    barcode: trim(form.barcode),
    category: trim(form.category),
    price: Number(form.price),
    imageUrl: trim(form.imageUrl),
    ikpu: trim(form.ikpu),
    packageCode: trim(form.packageCode),
    vat: form.vat ? Number(form.vat) : undefined,
    stock: form.stock ? Number(form.stock) : 0,
    requiresPrescription: form.requiresPrescription,
  };
}

interface SectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

function Section({ title, description, children, className = '' }: SectionProps) {
  return (
    <section
      className={`bg-tg-section rounded-card shadow-card p-4 mt-3 space-y-3 ${className}`}
    >
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
  children: React.ReactNode;
}

function Field({ label, required, error, hint, children }: FieldProps) {
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

interface ProductFormProps {
  productId?: string;
  initialProduct?: Product;
}

function ProductForm({ productId, initialProduct }: ProductFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(productId);

  const [form, setForm] = useState<FormState>(() =>
    initialProduct ? fromProduct(initialProduct) : INITIAL_FORM,
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [showOfd, setShowOfd] = useState(
    () =>
      Boolean(initialProduct?.ikpu) ||
      Boolean(initialProduct?.packageCode) ||
      initialProduct?.vat !== undefined,
  );

  // BackButton
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.BackButton.show();
    const handler = () => navigate('..');
    tg?.BackButton.onClick(handler);
    return () => {
      tg?.BackButton.offClick(handler);
      tg?.BackButton.hide();
    };
  }, [navigate]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateProductPayload) => pharmacyProductsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy-products'] });
      navigate('..', { state: { toast: 'Товар отправлен на модерацию' } });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateProductPayload) =>
      pharmacyProductsApi.update(productId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy-products'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacy-product', productId] });
      navigate('..', { state: { toast: 'Изменения сохранены' } });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmit = () => {
    const validation = validate(form);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }
    const payload = buildPayload(form);
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const errorCount = Object.keys(errors).length;

  return (
    <div className="pb-28 px-4 pt-4">
      {/* Header */}
      <div>
        <Text className="text-lg font-bold block">
          {isEdit ? 'Редактирование товара' : 'Новый товар'}
        </Text>
        {initialProduct && (
          <div className="mt-2 flex flex-col gap-1">
            <ProductStatusBadge
              status={initialProduct.status}
              moderationNote={initialProduct.moderationNote}
            />
            {initialProduct.status === 'REJECTED' && initialProduct.moderationNote && (
              <Text className="text-xs text-dorify-error block mt-1">
                {initialProduct.moderationNote}
              </Text>
            )}
          </div>
        )}
      </div>

      {/* Errors summary */}
      {errorCount > 1 && (
        <div className="mt-3 bg-dorify-error-light text-dorify-error rounded-card p-3 flex items-start gap-2">
          <IconAlert width={18} height={18} className="shrink-0 mt-0.5" />
          <Text className="text-sm">
            Найдено {errorCount} {errorCount < 5 ? 'ошибки' : 'ошибок'}. Проверьте поля ниже.
          </Text>
        </div>
      )}

      {/* Section: Основное */}
      <Section title="Основное">
        <Field label="Название" required error={errors.name}>
          <Input
            placeholder="Парацетамол 500мг"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            status={errors.name ? 'error' : undefined}
          />
        </Field>

        <Field label="Цена (UZS)" required error={errors.price}>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="25000"
            value={form.price}
            onChange={(e) => updateField('price', e.target.value)}
            status={errors.price ? 'error' : undefined}
          />
        </Field>

        <Field label="Описание" error={errors.description}>
          <Textarea
            placeholder="Показания, противопоказания..."
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={3}
          />
        </Field>

        <Field label="Категория" error={errors.category}>
          <select
            value={form.category}
            onChange={(e) => updateField('category', e.target.value)}
            className="w-full bg-tg-bg text-tg rounded-xl px-4 py-3 text-sm border border-transparent focus:border-dorify-primary focus:outline-none"
          >
            <option value="">— Выберите категорию —</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.emoji} {cat.slug}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {/* Section: Характеристики */}
      <Section title="Характеристики">
        <Field label="Действующее вещество" error={errors.activeSubstance}>
          <Input
            placeholder="Парацетамол"
            value={form.activeSubstance}
            onChange={(e) => updateField('activeSubstance', e.target.value)}
            status={errors.activeSubstance ? 'error' : undefined}
          />
        </Field>

        <Field label="Производитель" error={errors.manufacturer}>
          <Input
            placeholder="Фармстандарт"
            value={form.manufacturer}
            onChange={(e) => updateField('manufacturer', e.target.value)}
            status={errors.manufacturer ? 'error' : undefined}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Штрих-код" error={errors.barcode}>
            <Input
              placeholder="4607000123456"
              value={form.barcode}
              onChange={(e) => updateField('barcode', e.target.value)}
              status={errors.barcode ? 'error' : undefined}
            />
          </Field>
          <Field label="Остаток" error={errors.stock}>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={form.stock}
              onChange={(e) => updateField('stock', e.target.value)}
              status={errors.stock ? 'error' : undefined}
            />
          </Field>
        </div>

        <label className="flex items-center justify-between py-2 cursor-pointer">
          <span className="text-sm">Только по рецепту</span>
          <input
            type="checkbox"
            checked={form.requiresPrescription}
            onChange={(e) => updateField('requiresPrescription', e.target.checked)}
            className="w-5 h-5 accent-dorify-primary"
          />
        </label>
      </Section>

      {/* Section: Изображение */}
      <Section title="Изображение">
        <Field label="URL изображения" error={errors.imageUrl}>
          <Input
            placeholder="https://..."
            value={form.imageUrl}
            onChange={(e) => updateField('imageUrl', e.target.value)}
            status={errors.imageUrl ? 'error' : undefined}
          />
        </Field>
        {form.imageUrl && !errors.imageUrl && /^https?:\/\//i.test(form.imageUrl) && (
          <img
            src={form.imageUrl}
            alt="превью"
            className="w-32 h-32 object-cover rounded-lg bg-tg-secondary"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
      </Section>

      {/* Section: OFD (collapsible) */}
      <Section className="!p-0">
        <button
          type="button"
          onClick={() => setShowOfd((s) => !s)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
        >
          <div>
            <span>OFD-данные</span>
            <Text className="text-xs text-tg-hint block mt-0.5 font-normal">
              для оплаты через Multicard
            </Text>
          </div>
          <span className="text-tg-hint text-xs">{showOfd ? '▲' : '▼'}</span>
        </button>

        {showOfd && (
          <div className="px-4 pb-4 space-y-3 border-t border-tg-secondary pt-3">
            <Field label="ИКПУ (mxik)" error={errors.ikpu} hint="17 цифр. Источник: tasnif.soliq.uz">
              <Input
                placeholder="00000000000000000"
                value={form.ikpu}
                onChange={(e) => updateField('ikpu', e.target.value)}
                status={errors.ikpu ? 'error' : undefined}
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Код упаковки" error={errors.packageCode}>
                <Input
                  placeholder="0000000"
                  value={form.packageCode}
                  onChange={(e) => updateField('packageCode', e.target.value)}
                  status={errors.packageCode ? 'error' : undefined}
                />
              </Field>
              <Field label="НДС">
                <select
                  value={form.vat}
                  onChange={(e) => updateField('vat', e.target.value)}
                  className="w-full bg-tg-bg text-tg rounded-xl px-4 py-3 text-sm border border-transparent focus:border-dorify-primary focus:outline-none"
                >
                  {VAT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        )}
      </Section>

      {/* Mutation error */}
      {mutationError && (
        <div className="mt-3 bg-dorify-error-light text-dorify-error rounded-card p-3 flex items-start gap-2">
          <IconAlert width={18} height={18} className="shrink-0 mt-0.5" />
          <Text className="text-sm">
            {mutationError instanceof Error
              ? mutationError.message
              : 'Не удалось сохранить товар. Попробуйте ещё раз.'}
          </Text>
        </div>
      )}

      {/* Submit */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-tg-secondary shadow-sheet pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button
          mode="filled"
          size="l"
          stretched
          onClick={handleSubmit}
          disabled={isPending}
          className="!bg-dorify-primary"
        >
          {isPending ? (
            <Spinner size="s" />
          ) : isEdit ? (
            'Сохранить'
          ) : (
            'Отправить на модерацию'
          )}
        </Button>
      </div>
    </div>
  );
}

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const productQuery = useQuery({
    queryKey: ['pharmacy-product', id],
    queryFn: async () => {
      try {
        return await pharmacyProductsApi.getById(id!);
      } catch {
        return null;
      }
    },
    enabled: isEdit,
  });

  if (!isEdit) {
    return <ProductForm key="new" />;
  }

  if (productQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="m" />
      </div>
    );
  }

  if (!productQuery.data) {
    return (
      <div className="px-4 pt-8">
        <Text className="text-base block">Товар не найден.</Text>
        <div className="mt-4">
          <Button
            mode="filled"
            size="l"
            stretched
            onClick={() => navigate('..')}
            className="!bg-dorify-primary"
          >
            К списку товаров
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ProductForm
      key={productQuery.data.id}
      productId={productQuery.data.id}
      initialProduct={productQuery.data}
    />
  );
}
