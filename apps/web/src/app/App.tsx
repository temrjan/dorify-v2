import { useEffect, useState } from 'react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { Providers } from './providers';
import { AppRouter } from './router';
import { Layout } from './Layout';
import { useThemeStore } from '@shared/stores/themeStore';

type Appearance = 'light' | 'dark';
type Platform = 'ios' | 'base';

const THEME_VARS = [
  '--tg-theme-bg-color',
  '--tg-theme-secondary-bg-color',
  '--tg-theme-section-bg-color',
  '--tg-theme-text-color',
  '--tg-theme-hint-color',
  '--tg-theme-link-color',
  '--tg-theme-button-color',
  '--tg-theme-button-text-color',
] as const;

const PALETTES: Record<Appearance, Record<(typeof THEME_VARS)[number], string>> = {
  light: {
    '--tg-theme-bg-color': '#FFFFFF',
    '--tg-theme-secondary-bg-color': '#EFEFF4',
    '--tg-theme-section-bg-color': '#FFFFFF',
    '--tg-theme-text-color': '#000000',
    '--tg-theme-hint-color': '#707579',
    '--tg-theme-link-color': '#007AFF',
    '--tg-theme-button-color': '#3B82F6',
    '--tg-theme-button-text-color': '#FFFFFF',
  },
  dark: {
    '--tg-theme-bg-color': '#232E3C',
    '--tg-theme-secondary-bg-color': '#17212B',
    '--tg-theme-section-bg-color': '#232E3C',
    '--tg-theme-text-color': '#FFFFFF',
    '--tg-theme-hint-color': '#708499',
    '--tg-theme-link-color': '#6AB3F2',
    '--tg-theme-button-color': '#3B82F6',
    '--tg-theme-button-text-color': '#FFFFFF',
  },
};

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

  // Sync theme:
  // - data-theme на <html> = effective appearance (для CSS-only utilities).
  // - При manual override (mode != 'system') — выставляем --tg-theme-* vars
  //   ИНЛАЙН на <body> с !important. Telegram WebApp инжектит свои vars
  //   inline на body с системной темой; чтобы перебить — нужно своё inline
  //   с !important. CSS правила на html[data-theme-override] не работают
  //   потому что body's inline более специфичен.
  // - При 'system' — удаляем наши overrides, Telegram восстанавливает свои.
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.dataset.theme = appearance;

    if (themeMode === 'system') {
      THEME_VARS.forEach((varName) => body.style.removeProperty(varName));
    } else {
      const palette = PALETTES[themeMode];
      THEME_VARS.forEach((varName) => {
        body.style.setProperty(varName, palette[varName], 'important');
      });
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
