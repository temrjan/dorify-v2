import type { CSSProperties } from 'react';

interface SkeletonProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'card';
}

const ROUNDED_MAP: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  sm: 'rounded',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
  card: 'rounded-card',
};

export function Skeleton({
  className = '',
  width,
  height,
  rounded = 'md',
}: SkeletonProps) {
  const style: CSSProperties = {};
  if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      aria-hidden="true"
      className={`bg-tg-secondary animate-pulse ${ROUNDED_MAP[rounded]} ${className}`}
      style={style}
    />
  );
}

interface SkeletonCardProps {
  className?: string;
}

/** Product/list card placeholder — image + 2 lines + price row. */
export function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <div className={`bg-tg-section rounded-card p-3 shadow-card ${className}`}>
      <Skeleton height={128} rounded="lg" className="mb-2" />
      <Skeleton height={14} width="80%" className="mb-1.5" />
      <Skeleton height={12} width="60%" className="mb-3" />
      <Skeleton height={16} width={80} />
    </div>
  );
}
