import type { ReactNode } from 'react';

interface StatTileProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: 'default' | 'good' | 'critical' | 'active';
}

const TONE_MARKERS: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: '',
  good: 'before:bg-[var(--status-good)]',
  critical: 'before:bg-[var(--status-critical)]',
  active: 'before:bg-[var(--series-1)]',
};

/** A single headline number; a small coloured bar marks status tiles (always with its label). */
export function StatTile({ label, value, detail, tone = 'default' }: StatTileProps) {
  const marker =
    tone === 'default'
      ? ''
      : `relative pl-5 before:absolute before:top-4 before:bottom-4 before:left-0 before:w-1 before:rounded-full ${TONE_MARKERS[tone]}`;
  return (
    <div className={`min-w-0 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 ${marker}`}>
      <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-100">{value}</p>
      {detail && <p className="mt-1 text-xs text-zinc-500">{detail}</p>}
    </div>
  );
}
