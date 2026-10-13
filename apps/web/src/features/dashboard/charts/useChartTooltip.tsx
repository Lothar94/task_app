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
      className="pointer-events-none absolute z-10 min-w-40 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-md border border-zinc-700 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-200 shadow-xl"
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
      <span className="flex items-center gap-1.5 text-zinc-400">
        {color && <span className="h-2 w-2 rounded-sm" style={{ background: color }} />}
        {label}
      </span>
      <span className="font-mono text-zinc-100 tabular-nums">{value}</span>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
