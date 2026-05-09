import { useNavigate } from 'react-router-dom';
import { Text } from '@telegram-apps/telegram-ui';
import { useThemeStore, type ThemeMode } from '@shared/stores/themeStore';
import { IconChevronRight, IconOrders, IconUser } from '@shared/ui/icons';

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: 'Системная' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
];

interface MenuItemProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  onClick: () => void;
}

function MenuItem({ icon, title, description, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-tg-section rounded-card shadow-card p-4 flex items-center gap-3 transition active:scale-[0.99]"
    >
      <div className="shrink-0 w-10 h-10 rounded-xl bg-dorify-primary-light text-dorify-primary-dark flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <Text className="font-medium block">{title}</Text>
        {description && (
          <Text className="text-sm text-tg-hint block mt-0.5 truncate">{description}</Text>
        )}
      </div>
      <IconChevronRight width={18} height={18} className="shrink-0 text-tg-hint" />
    </button>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);

  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const displayName = tgUser
    ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim() || 'Без имени'
    : 'Гость';
  const username = tgUser?.username ? `@${tgUser.username}` : null;

  return (
    <div className="px-4 pt-4 pb-8">
      {/* User card */}
      <div className="bg-tg-section rounded-card shadow-card p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-dorify-primary-light text-dorify-primary-dark flex items-center justify-center">
          <IconUser width={24} height={24} />
        </div>
        <div className="flex-1 min-w-0">
          <Text className="font-medium block truncate">{displayName}</Text>
          {username && (
            <Text className="text-sm text-tg-hint block truncate">{username}</Text>
          )}
        </div>
      </div>

      {/* Theme toggle */}
      <div className="mt-5">
        <Text className="text-xs uppercase tracking-wider text-tg-hint block mb-2 px-1">
          Тема
        </Text>
        <div className="bg-tg-section rounded-card shadow-card p-1 flex gap-1">
          {THEME_OPTIONS.map((opt) => {
            const isActive = themeMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setThemeMode(opt.value)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-dorify-primary text-white'
                    : 'text-tg-hint active:bg-tg-secondary'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <Text className="text-xs text-tg-hint mt-2 block px-1">
          Системная — следует за темой Telegram. Светлая / Тёмная — фиксирует выбор.
        </Text>
      </div>

      {/* Menu */}
      <div className="mt-5 space-y-2">
        <MenuItem
          icon={<IconOrders width={20} height={20} />}
          title="Мои заказы"
          description="История покупок и статусы"
          onClick={() => navigate('/orders')}
        />
      </div>
    </div>
  );
}
