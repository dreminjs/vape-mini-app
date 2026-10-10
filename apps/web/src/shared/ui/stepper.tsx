import { Minus, Plus } from 'lucide-react';

interface StepperProps {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
}

/** Quantity stepper with 44×44 touch targets. */
export function Stepper({ value, min = 0, max, onChange, label }: StepperProps) {
  return (
    <div
      className="ui-chrome flex items-center rounded-xl border border-vape-accent/40 bg-slate-950"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        className="flex size-11 items-center justify-center text-slate-300 hover:text-white disabled:opacity-40"
        onClick={() => {
          onChange(value - 1);
        }}
        disabled={value <= min}
        aria-label="Уменьшить"
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <output
        className="min-w-6 text-center text-sm font-extrabold text-vape-glow"
        aria-live="polite"
      >
        {value}
      </output>
      <button
        type="button"
        className="flex size-11 items-center justify-center text-slate-300 hover:text-white disabled:opacity-40"
        onClick={() => {
          onChange(value + 1);
        }}
        disabled={value >= max}
        aria-label="Увеличить"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
