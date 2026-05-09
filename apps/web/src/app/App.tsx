import { useEffect, useState } from 'react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { Providers } from './providers';
import { AppRouter } from './router';
import { Layout } from './Layout';

type Appearance = 'light' | 'dark';
type Platform = 'ios' | 'base';

function getAppearance(): Appearance {
  return window.Telegram?.WebApp?.colorScheme === 'dark' ? 'dark' : 'light';
}

function getPlatform(): Platform {
  return window.Telegram?.WebApp?.platform === 'ios' ? 'ios' : 'base';
}

export function App() {
  const [appearance, setAppearance] = useState<Appearance>(getAppearance);
  const [platform] = useState<Platform>(getPlatform);

  // React to Telegram theme changes (user toggles dark/light in Telegram settings)
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.onEvent) return;
    const handler = () => setAppearance(getAppearance());
    tg.onEvent('themeChanged', handler);
    return () => {
      tg.offEvent?.('themeChanged', handler);
    };
  }, []);

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
