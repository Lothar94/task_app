import { type MouseEvent, type ReactNode, useState } from 'react';

interface TooltipState {
  x: number;
  y: number;
  content: ReactNode;
}

/** Hover tooltip for HTML charts: attach `show`/`hide` to marks, render `tooltip` inside a relative container. */
export function useChartTooltip() {
  const [state, setState] = useState<TooltipState | null>(null);

  const show = (event: MouseEvent<HTMLElement>, content: ReactNode) => {
    const container = event.currentTarget.closest('[data-chart]')?.getBoundingClientRect();
    if (!container) return;
    setState({ x: event.clientX - container.left, y: event.clientY - container.top, content });
  };

  const tooltip = state && (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 min-w-40 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded border border-line-strong bg-surface-raised px-3 py-2 text-xs text-fg shadow-float"
      style={{ left: state.x, top: state.y }}
    >
      {state.content}
    </div>
  );

  return { show, hide: () => setState(null), tooltip };
}

export function TooltipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-fg-muted">
        {color && <span aria-hidden className="size-2 rounded-sm" style={{ background: color }} />}
        {label}
      </span>
      <span className="font-mono text-fg tabular-nums">{value}</span>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="label-mono flex flex-wrap gap-x-4 gap-y-1 text-fg-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
