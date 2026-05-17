import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null });
    // Tagged log so Captain can grep in Telegram Desktop DevTools console.
    console.error('[DORIFY-CRASH]', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null, componentStack: null });
  };

  private handleClearAndReload = (): void => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // ignore — quota / disabled storage
    }
    window.location.reload();
  };

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="px-4 pt-6 pb-8">
        <div className="bg-tg-section rounded-card shadow-card p-5 text-center">
          <div className="text-5xl mb-3" aria-hidden="true">⚠️</div>
          <h1 className="text-lg font-semibold mb-1">Что-то пошло не так</h1>
          <p className="text-sm text-tg-hint mb-5">
            Страница не отрисовалась. Часто помогает очистка локальных данных.
          </p>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={this.handleClearAndReload}
              className="w-full py-3 rounded-card bg-dorify-primary text-white font-medium active:opacity-80"
            >
              Очистить кэш и перезагрузить
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full py-3 rounded-card bg-tg-secondary text-tg-text font-medium active:opacity-80"
            >
              Попробовать снова
            </button>
          </div>

          <details className="mt-5 text-left">
            <summary className="text-xs text-tg-hint cursor-pointer select-none">
              Детали ошибки (для разработчика)
            </summary>
            <pre className="mt-2 p-3 rounded-card bg-tg-bg text-[11px] leading-snug whitespace-pre-wrap break-words overflow-auto max-h-64">
              {error.name}: {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
              {componentStack ? `\n\nComponent stack:${componentStack}` : ''}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
