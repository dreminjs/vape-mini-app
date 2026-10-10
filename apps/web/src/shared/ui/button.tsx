import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-vape-accent to-vape-glow text-white shadow-lg shadow-vape-accent/20 hover:opacity-95',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
  danger: 'bg-vape-red text-white hover:bg-red-500',
  ghost: 'bg-transparent text-slate-300 hover:text-white',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  pending?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

/** Min 44px height. While `pending`, the button is disabled and shows a spinner (no double submit). */
export function Button({
  variant = 'primary',
  pending = false,
  icon,
  block = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled === true || pending}
      aria-busy={pending}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
