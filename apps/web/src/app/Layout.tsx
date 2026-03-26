import { useLocation, useNavigate } from 'react-router-dom';
import { FixedLayout, Tabbar } from '@telegram-apps/telegram-ui';
import type { ReactNode } from 'react';

const TABS = [
  { id: '/', label: 'Главная', icon: '🏠' },
  { id: '/search', label: 'Поиск', icon: '🔍' },
  { id: '/cart', label: 'Корзина', icon: '🛒' },
  { id: '/orders', label: 'Заказы', icon: '📦' },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide tabbar on checkout and product detail
  const hideTabbar = location.pathname.startsWith('/checkout') || location.pathname.startsWith('/product/');

  return (
    <div className="pb-20">
      {children}

      {!hideTabbar && (
        <FixedLayout vertical="bottom">
          <Tabbar>
            {TABS.map((tab) => (
              <Tabbar.Item
                key={tab.id}
                text={tab.label}
                selected={location.pathname === tab.id}
                onClick={() => navigate(tab.id)}
              >
                <span className="text-xl">{tab.icon}</span>
              </Tabbar.Item>
            ))}
          </Tabbar>
        </FixedLayout>
      )}
    </div>
  );
}
