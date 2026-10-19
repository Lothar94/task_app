import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { IconButton } from './ui';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Modal dialog built on the native <dialog>: focus trap, Escape and backdrop come for free. */
export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      className="m-auto w-[min(48rem,calc(100vw-2rem))] rounded-xl bg-surface-raised p-0 text-fg shadow-float backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="space-y-4 p-6">
          <header className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <IconButton label="Cerrar" onClick={onClose}>
              <X aria-hidden className="size-4" />
            </IconButton>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
