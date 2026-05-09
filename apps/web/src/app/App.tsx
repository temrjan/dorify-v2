import { useEffect, useState } from 'react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { Providers } from './providers';
import { AppRouter } from './router';
import { Layout } from './Layout';
import { useThemeStore } from '@shared/stores/themeStore';

type Appearance = 'light' | 'dark';
type Platform = 'ios' | 'base';

function getTelegramAppearance(): Appearance {
  return window.Telegram?.WebApp?.colorScheme === 'dark' ? 'dark' : 'light';
}

function getPlatform(): Platform {
  return window.Telegram?.WebApp?.platform === 'ios' ? 'ios' : 'base';
}

export function App() {
  const themeMode = useThemeStore((s) => s.mode);
  const [telegramScheme, setTelegramScheme] = useState<Appearance>(getTelegramAppearance);
  const [platform] = useState<Platform>(getPlatform);

  // Track Telegram colorScheme so 'system' mode reacts to system changes.
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.onEvent) return;
    const handler = () => setTelegramScheme(getTelegramAppearance());
    tg.onEvent('themeChanged', handler);
    return () => {
      tg.offEvent?.('themeChanged', handler);
    };
  }, []);

  // Resolve effective appearance: 'system' follows Telegram, otherwise explicit override.
  const appearance: Appearance = themeMode === 'system' ? telegramScheme : themeMode;

  // Sync to <html>:
  // - data-theme = effective appearance (always)
  // - data-theme-override = mode (only when manual override) — CSS использует чтобы
  //   подменить --tg-theme-* vars (Telegram даёт vars от своей темы, наш override
  //   их перебивает только при manual mode).
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = appearance;
    if (themeMode === 'system') {
      delete root.dataset.themeOverride;
    } else {
      root.dataset.themeOverride = themeMode;
    }
  }, [appearance, themeMode]);

  return (
    <AppRoot appearance={appearance} platform={platform}>
      <Providers>
        <Layout>
          <AppRouter />
        </Layout>
      </Providers>
    </AppRoot>
  );
}
