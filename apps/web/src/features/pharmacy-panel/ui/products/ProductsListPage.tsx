import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Chip, Input, Spinner, Text } from '@telegram-apps/telegram-ui';
import { pharmacyProductsApi } from '@shared/api/pharmacyProducts';
import type { Product, ProductStatus } from '@shared/types';
import { EmptyState } from '@shared/ui/EmptyState';
import { Skeleton } from '@shared/ui/Skeleton';
import { IconPackage, IconSearch, IconAlert } from '@shared/ui/icons';
import { ProductCard } from './components/ProductCard';

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;
const TOAST_AUTO_HIDE_MS = 3000;

interface RouteState {
  toast?: string;
}

const STATUS_FILTERS: Array<{ value: ProductStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Все' },
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
  const [toast, setToast] = useState<string | null>(() => {
    const s = (location.state as RouteState | null) ?? null;
    return s?.toast ?? null;
  });

  // Clear navigate state once after consuming toast
  useEffect(() => {
    if (toast && location.state) {
      navigate(location.pathname, { replace: true, state: null });
    }
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
      setToast('Товар скрыт');
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="pb-24 min-h-screen">
      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-3 left-3 right-3 bg-dorify-success text-white px-4 py-2.5 rounded-card text-sm shadow-card-hover z-50 flex items-center gap-2"
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-4 flex items-center justify-between gap-2">
        <div>
          <Text className="text-lg font-bold">Мои товары</Text>
          {total > 0 && (
            <Text className="text-xs text-tg-hint">
              {total} {total === 1 ? 'позиция' : total < 5 ? 'позиции' : 'позиций'}
            </Text>
          )}
        </div>
        <Button
          mode="filled"
          size="s"
          onClick={() => navigate('new')}
          className="!bg-dorify-primary"
        >
          + Добавить
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 mt-3">
        <div className="relative">
          <IconSearch
            width={18}
            height={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-tg-hint pointer-events-none"
          />
          <Input
            placeholder="Поиск по названию"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 px-4 mt-3 overflow-x-auto no-scrollbar">
        {STATUS_FILTERS.map((opt) => (
          <Chip
            key={opt.value}
            mode={statusFilter === opt.value ? 'elevated' : 'mono'}
            onClick={() => {
              setStatusFilter(opt.value);
              setPage(1);
            }}
          >
            {opt.label}
          </Chip>
        ))}
      </div>

      {/* Body */}
      <div className="px-4 mt-4">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="bg-tg-section rounded-card p-3 flex gap-3 shadow-card">
                <Skeleton width={64} height={64} rounded="lg" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton height={14} width="70%" />
                  <Skeleton height={12} width="50%" />
                  <Skeleton height={14} width="40%" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <EmptyState
            icon={<IconAlert width={48} height={48} className="text-dorify-error" />}
            title="Не удалось загрузить"
            description={error instanceof Error ? error.message : 'Проверьте соединение и попробуйте ещё раз.'}
            action={
              <button
                type="button"
                onClick={() => refetch()}
                className="px-5 py-2.5 rounded-full bg-dorify-primary text-white text-sm font-medium active:opacity-80"
              >
                Повторить
              </button>
            }
          />
        )}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={<IconPackage width={48} height={48} />}
            title={
              search || statusFilter !== 'ALL'
                ? 'По вашему запросу ничего не найдено'
                : 'Пока нет товаров'
            }
            description={
              search || statusFilter !== 'ALL'
                ? 'Попробуйте изменить фильтры или поисковый запрос.'
                : 'Добавьте первый товар, чтобы начать продавать.'
            }
            action={
              !search && statusFilter === 'ALL' ? (
                <button
                  type="button"
                  onClick={() => navigate('new')}
                  className="px-5 py-2.5 rounded-full bg-dorify-primary text-white text-sm font-medium active:opacity-80"
                >
                  Добавить первый товар
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                    setStatusFilter('ALL');
                    setPage(1);
                  }}
                  className="px-5 py-2.5 rounded-full bg-dorify-primary text-white text-sm font-medium active:opacity-80"
                >
                  Сбросить фильтры
                </button>
              )
            }
          />
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
          <div className="flex items-center justify-between mt-4 px-1">
            <Button
              mode="plain"
              size="s"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Назад
            </Button>
            <Text className="text-sm text-tg-hint">
              {page} из {totalPages}
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
            className="bg-tg-bg w-full rounded-t-sheet p-5 space-y-3 shadow-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <Text id="delete-dialog-title" className="text-base font-semibold block">
              Скрыть товар?
            </Text>
            <Text id="delete-dialog-desc" className="text-sm text-tg-hint block">
              «{confirmDelete.name}» больше не будет виден покупателям. Можно вернуть позже,
              отредактировав товар.
            </Text>
            {deleteMutation.isError && (
              <Text className="text-sm text-dorify-error block">
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
                className="!bg-dorify-error"
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
