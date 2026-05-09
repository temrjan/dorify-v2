import type { ReactNode } from 'react';
import { Text } from '@telegram-apps/telegram-ui';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}
    >
      {icon && (
        <div className="mb-4 text-tg-hint" aria-hidden="true">
          {icon}
        </div>
      )}
      <Text className="text-base font-medium block">{title}</Text>
      {description && (
        <Text className="text-sm text-tg-hint mt-1 block max-w-xs">{description}</Text>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
