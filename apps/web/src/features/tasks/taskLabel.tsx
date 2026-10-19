export const taskLabel = (number: number) => `Tarea ${number}`;

/** Compact chip with the per-project task identifier ("Tarea 7"). */
export function TaskNumber({ number }: { number: number }) {
  return (
    <span className="shrink-0 rounded-sm border border-line bg-surface-raised px-1.5 py-0.5 font-mono text-xs whitespace-nowrap text-fg-muted">
      {taskLabel(number)}
    </span>
  );
}
