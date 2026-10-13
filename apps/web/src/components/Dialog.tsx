import { type ReactNode, useEffect, useRef } from 'react';

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
      className="m-auto w-[min(48rem,calc(100vw-2rem))] rounded-xl border border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="space-y-4 p-6">
          <header className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="rounded-md px-2 text-xl leading-none text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              ×
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
