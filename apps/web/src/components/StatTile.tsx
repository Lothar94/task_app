import type { ReactNode } from 'react';

type StatTileTone = 'default' | 'good' | 'critical' | 'active' | 'warning';

interface StatTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  tone?: StatTileTone;
}

const TONE_BARS: Record<StatTileTone, string> = {
  default: '',
  good: 'bg-[var(--status-good)]',
  critical: 'bg-[var(--status-critical)]',
  active: 'bg-info',
  warning: 'bg-warning',
};

/** A single headline number; a coloured left bar marks status tiles (always with its label). */
export function StatTile({ label, value, unit, detail, icon, footer, tone = 'default' }: StatTileProps) {
  return (
    <div className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-lg border border-line bg-surface p-3.5">
      {tone !== 'default' && <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${TONE_BARS[tone]}`} />}
      <div className="flex items-center justify-between gap-2">
        <p className="label-mono text-fg-subtle">{label}</p>
        {icon && (
          <span aria-hidden className="text-fg-subtle [&>svg]:size-4">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-[1.75rem] leading-9 font-semibold text-fg">
        {value}
        {unit && <span className="ml-1 font-mono text-sm font-normal text-fg-subtle">{unit}</span>}
      </p>
      {detail && <p className="mt-1 font-mono text-xs text-fg-subtle">{detail}</p>}
      {footer && (
        <div className="mt-2 border-t border-line pt-1.5 font-mono text-[0.6875rem] text-fg-subtle">{footer}</div>
      )}
    </div>
  );
}
