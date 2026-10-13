const relative = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "hace 5 minutos", "ayer"… relative to `now`. */
export function formatDistanceLabel(iso: string, now = Date.now()): string {
  const diff = Date.parse(iso) - now;
  const [unit, size] = UNITS.find(([, ms]) => Math.abs(diff) >= ms) ?? ['second', 1000];
  return relative.format(Math.round(diff / size), unit);
}
