import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Spinner, Text } from '@telegram-apps/telegram-ui';
import { pharmacyProductsApi } from '@shared/api/pharmacyProducts';
import type { Product, ProductStatus } from '@shared/types';
import { ProductCard } from './components/ProductCard';

const TOAST_AUTO_HIDE_MS = 3000;

interface RouteState {
  toast?: string;
}

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_OPTIONS: Array<{ value: ProductStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Все статусы' },
  { value: 'PUBLISHED', label: 'Опубликованные' },
  { value: 'PENDING_MODERATION', label: 'На модерации' },
  { value: 'REJECTED', label: 'Отклонённые' },
  { value: 'DRAFT', label: 'Черновики' },
  { value: 'HIDDEN', label: 'Скрытые' },
];

export function ProductsListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  // Lazy-init toast from navigate state — avoids sync setState in effect
  const [toast, setToast] = useState<string | null>(() => {
    const s = (location.state as RouteState | null) ?? null;
    return s?.toast ?? null;
  });

  // Clear navigate state once after consuming toast (so back/forward не повторяет)
  useEffect(() => {
    if (toast && location.state) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // intentionally only on mount: navigate state is consumed once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-hide
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pharmacy-products', { page, search, status: statusFilter }],
    queryFn: () =>
      pharmacyProductsApi.list({
        page,
        limit: PAGE_LIMIT,
        search: search || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pharmacyProductsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy-products'] });
      setConfirmDelete(null);
    },
  });

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="pb-24">
      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-2 left-2 right-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm shadow-lg z-50"
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-4 flex items-center justify-between gap-2">
        <Text className="text-lg font-bold">Мои товары</Text>
        <Button
          mode="filled"
          size="s"
          onClick={() => navigate('new')}
          className="!bg-dorify-primary"
        >
          + Добавить
        </Button>
      </div>

      {/* Filters */}
      <div className="px-4 mt-3 space-y-2">
        <Input
          placeholder="Поиск по названию"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as ProductStatus | 'ALL');
            setPage(1);
          }}
          className="w-full bg-tg-section text-tg rounded-xl px-4 py-3 text-sm"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Body */}
      <div className="px-4 mt-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="m" />
          </div>
        )}

        {isError && (
          <div className="bg-dorify-secondary-light text-dorify-secondary text-sm p-3 rounded-xl">
            <Text className="block">
              Не удалось загрузить товары:{' '}
              {error instanceof Error ? error.message : 'неизвестная ошибка'}
            </Text>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 underline text-sm"
            >
              Повторить
            </button>
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="text-center py-12">
            <Text className="text-tg-hint block">
              {search || statusFilter !== 'ALL'
                ? 'По вашему запросу ничего не найдено.'
                : 'Пока нет товаров.'}
            </Text>
            {!search && statusFilter === 'ALL' && (
              <div className="mt-4">
                <Button
                  mode="filled"
                  size="m"
                  onClick={() => navigate('new')}
                  className="!bg-dorify-primary"
                >
                  Добавить первый товар
                </Button>
              </div>
            )}
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="space-y-2">
            {items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={(p) => navigate(`${p.id}/edit`)}
                onDelete={(p) => setConfirmDelete(p)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <Button
              mode="plain"
              size="s"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Назад
            </Button>
            <Text className="text-sm text-tg-hint">
              Стр. {page} из {totalPages}
            </Text>
            <Button
              mode="plain"
              size="s"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Вперёд →
            </Button>
          </div>
        )}
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-desc"
          tabIndex={-1}
          className="fixed inset-0 bg-black/50 flex items-end z-50"
          onClick={() => !deleteMutation.isPending && setConfirmDelete(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !deleteMutation.isPending) {
              setConfirmDelete(null);
            }
          }}
        >
          <div
            className="bg-tg-bg w-full rounded-t-2xl p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <Text id="delete-dialog-title" className="text-base font-medium block">
              Скрыть товар?
            </Text>
            <Text id="delete-dialog-desc" className="text-sm text-tg-hint block">
              «{confirmDelete.name}» больше не будет виден покупателям. Можно вернуть позже,
              отредактировав товар.
            </Text>
            {deleteMutation.isError && (
              <Text className="text-sm text-dorify-secondary block">
                Не удалось удалить товар. Попробуйте ещё раз.
              </Text>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                mode="plain"
                size="l"
                stretched
                onClick={() => setConfirmDelete(null)}
                disabled={deleteMutation.isPending}
              >
                Отмена
              </Button>
              <Button
                mode="filled"
                size="l"
                stretched
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                className="!bg-dorify-secondary"
              >
                {deleteMutation.isPending ? <Spinner size="s" /> : 'Скрыть'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
