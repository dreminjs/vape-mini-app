import { AlertTriangle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from './button';

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-slate-800 text-slate-400">
        <Icon className="size-7" aria-hidden />
      </div>
      <h2 className="text-base font-bold text-slate-200">{title}</h2>
      {text && <p className="max-w-xs text-sm text-vape-muted">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-red-900/60 bg-red-950/30 p-5 text-center"
    >
      <AlertTriangle className="size-7 text-vape-red" aria-hidden />
      <p className="text-sm text-red-200">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  );
}
