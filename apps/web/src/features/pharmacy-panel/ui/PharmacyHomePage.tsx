import { useNavigate } from 'react-router-dom';
import { Text } from '@telegram-apps/telegram-ui';

interface NavCardProps {
  title: string;
  description: string;
  to?: string;
  disabled?: boolean;
}

function NavCard({ title, description, to, disabled }: NavCardProps) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => to && navigate(to)}
      className={`w-full text-left bg-tg-section rounded-xl p-4 transition active:opacity-70 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <Text className="font-medium block">{title}</Text>
      <Text className="text-sm text-tg-hint">{description}</Text>
      {disabled && (
        <Text className="text-xs text-tg-hint mt-1">скоро</Text>
      )}
    </button>
  );
}

export function PharmacyHomePage() {
  return (
    <div className="px-4 pt-4">
      <Text className="text-lg font-bold">Панель аптеки</Text>
      <Text className="text-tg-hint mt-2 block">
        Управление товарами, заказами и настройками аптеки.
      </Text>

      <div className="mt-6 space-y-3">
        <NavCard
          title="Мои товары"
          description="Добавление и управление каталогом"
          to="products"
        />
        <NavCard title="Заказы" description="Управление заказами покупателей" disabled />
        <NavCard title="Настройки оплаты" description="Multicard credentials" disabled />
        <NavCard title="Профиль аптеки" description="Название, адрес, график" disabled />
      </div>
    </div>
  );
}
