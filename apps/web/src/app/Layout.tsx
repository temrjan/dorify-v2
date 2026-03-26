import { useLocation, useNavigate } from 'react-router-dom';
import { FixedLayout, Tabbar } from '@telegram-apps/telegram-ui';
import type { ReactNode } from 'react';
import { IconHome, IconSearch, IconCart, IconOrders } from '@shared/ui/icons';
import { useCartStore, selectTotalItems } from '@shared/stores/cartStore';

const TABS = [
  { id: '/', label: 'Главная', Icon: IconHome },
  { id: '/search', label: 'Поиск', Icon: IconSearch },
  { id: '/cart', label: 'Корзина', Icon: IconCart },
  { id: '/orders', label: 'Заказы', Icon: IconOrders },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const cartCount = useCartStore(selectTotalItems);

  const hideTabbar = location.pathname.startsWith('/checkout') || location.pathname.startsWith('/product/');

  return (
    <div className="pb-20">
      {children}

      {!hideTabbar && (
        <FixedLayout vertical="bottom">
          <Tabbar>
            {TABS.map((tab) => {
              const isActive = location.pathname === tab.id;
              return (
                <Tabbar.Item
                  key={tab.id}
                  text={tab.label}
                  selected={isActive}
                  onClick={() => navigate(tab.id)}
                >
                  <div className="relative">
                    <tab.Icon
                      width={24}
                      height={24}
                      className={isActive ? 'text-dorify-primary' : 'text-[var(--tg-theme-hint-color,#707579)]'}
                    />
                    {tab.id === '/cart' && cartCount > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 bg-dorify-secondary text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                        {cartCount > 99 ? '99+' : cartCount}
                      </span>
                    )}
                  </div>
                </Tabbar.Item>
              );
            })}
          </Tabbar>
        </FixedLayout>
      )}
    </div>
  );
}
