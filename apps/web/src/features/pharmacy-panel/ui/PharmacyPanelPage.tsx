import { Text } from '@telegram-apps/telegram-ui';

export default function PharmacyPanelPage() {
  return (
    <div className="px-4 pt-4">
      <Text className="text-lg font-bold">Панель аптеки</Text>
      <Text className="text-tg-hint mt-2">
        Управление товарами, заказами и настройками аптеки.
      </Text>
      {/* TODO: Phase 5.1 — Products CRUD, Orders list, Profile, Payment settings */}
      <div className="mt-6 space-y-3">
        <div className="bg-tg-section rounded-xl p-4">
          <Text className="font-medium">Мои товары</Text>
          <Text className="text-sm text-tg-hint">Добавление и управление каталогом</Text>
        </div>
        <div className="bg-tg-section rounded-xl p-4">
          <Text className="font-medium">Заказы</Text>
          <Text className="text-sm text-tg-hint">Управление заказами покупателей</Text>
        </div>
        <div className="bg-tg-section rounded-xl p-4">
          <Text className="font-medium">Настройки оплаты</Text>
          <Text className="text-sm text-tg-hint">Multicard credentials</Text>
        </div>
        <div className="bg-tg-section rounded-xl p-4">
          <Text className="font-medium">Профиль аптеки</Text>
          <Text className="text-sm text-tg-hint">Название, адрес, график</Text>
        </div>
      </div>
    </div>
  );
}
