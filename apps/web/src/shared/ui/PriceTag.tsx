interface PriceTagProps {
  amount: number;
  className?: string;
}

export function PriceTag({ amount, className = '' }: PriceTagProps) {
  const formatted = new Intl.NumberFormat('uz-UZ').format(amount);
  return (
    <span className={`font-semibold text-dorify-primary ${className}`}>
      {formatted} сум
    </span>
  );
}
