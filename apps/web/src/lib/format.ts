const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('es-ES');
const usd = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 0 });

/** 950 → "950", 12 400 → "12,4 mil", 3 200 000 → "3,2 M". */
export const formatTokens = (tokens: number) => compact.format(tokens);

export const formatInteger = (value: number) => integer.format(value);

export const formatCost = (usdAmount: number) =>
  usdAmount > 0 && usdAmount < 0.01 ? `< ${usd.format(0.01)}` : usd.format(usdAmount);

export const formatPercent = (ratio: number | null) => (ratio === null ? '—' : percent.format(ratio));

/** 42_000 → "42 s", 200_000 → "3 min 20 s", 3_900_000 → "1 h 05 min". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
}

/** "2026-10-12" → "12 oct". */
export function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}
