import type { ReactNode } from 'react';

export type PillVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';
export type PillSize = 'sm' | 'md';

interface PillProps {
  children: ReactNode;
  variant?: PillVariant;
  size?: PillSize;
  icon?: ReactNode;
  className?: string;
  title?: string;
}

const VARIANT_STYLES: Record<PillVariant, string> = {
  neutral: 'bg-tg-secondary text-tg-hint',
  primary: 'bg-dorify-primary-light text-dorify-primary-dark',
  success: 'bg-dorify-success-light text-dorify-success',
  warning: 'bg-dorify-warning-light text-dorify-warning',
  error: 'bg-dorify-error-light text-dorify-error',
  info: 'bg-dorify-primary-light text-dorify-primary-dark',
};

const SIZE_STYLES: Record<PillSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export function Pill({
  children,
  variant = 'neutral',
  size = 'sm',
  icon,
  className = '',
  title,
}: PillProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full font-medium leading-none ${SIZE_STYLES[size]} ${VARIANT_STYLES[variant]} ${className}`}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
