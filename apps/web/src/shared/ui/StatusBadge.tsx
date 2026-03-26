const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Ожидает' },
  CONFIRMED: { bg: 'bg-dorify-primary-light', text: 'text-dorify-primary-dark', label: 'Подтверждён' },
  PREPARING: { bg: 'bg-dorify-primary-light', text: 'text-dorify-primary-dark', label: 'Готовится' },
  READY: { bg: 'bg-green-100', text: 'text-green-700', label: 'Готов' },
  DELIVERING: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Доставка' },
  DELIVERED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Доставлен' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-600', label: 'Отменён' },
  PAID: { bg: 'bg-green-100', text: 'text-green-700', label: 'Оплачен' },
  FAILED: { bg: 'bg-red-100', text: 'text-red-600', label: 'Ошибка' },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: status };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}
