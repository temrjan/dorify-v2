import { TOTAL_STEPS, type StepNumber } from '../types';

interface StepIndicatorProps {
  current: StepNumber;
}

export function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5 px-1" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const step = (i + 1) as StepNumber;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div
            key={step}
            className={`h-1.5 flex-1 rounded-full transition ${
              isDone || isActive ? 'bg-dorify-primary' : 'bg-tg-secondary'
            }`}
          />
        );
      })}
    </div>
  );
}
