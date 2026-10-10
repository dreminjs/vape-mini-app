import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

import { Button } from './button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmText: string;
  onConfirm: () => void;
  pending?: boolean;
}

/** Used before destructive actions (delete variant, archive product, cancel order). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  onConfirm,
  pending = false,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border border-red-500/50 bg-vape-card p-5 text-center">
          <Dialog.Title className="text-base font-bold text-white">{title}</Dialog.Title>
          <Dialog.Description className={description ? 'text-sm text-vape-muted' : 'sr-only'}>
            {description ?? title}
          </Dialog.Description>
          <div className="flex gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary" block>
                Отмена
              </Button>
            </Dialog.Close>
            <Button variant="danger" block pending={pending} onClick={onConfirm}>
              {confirmText}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
