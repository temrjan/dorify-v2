/// <reference types="vite/client" />

type TelegramEvent = 'themeChanged' | 'viewportChanged' | 'mainButtonClicked' | 'backButtonClicked';
type TelegramPlatform = 'android' | 'android_x' | 'ios' | 'macos' | 'tdesktop' | 'web' | 'weba' | 'webk' | 'unigram' | 'unknown';

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
  };
  themeParams: Record<string, string>;
  colorScheme: 'light' | 'dark';
  platform: TelegramPlatform;
  onEvent: (event: TelegramEvent, handler: () => void) => void;
  offEvent: (event: TelegramEvent, handler: () => void) => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    setText: (text: string) => void;
    setParams: (params: { text?: string; color?: string; text_color?: string; is_active?: boolean }) => void;
  };
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
