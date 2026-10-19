export const taskLabel = (number: number) => `Tarea ${number}`;

/** Compact chip with the per-project task identifier ("Tarea 7"). */
export function TaskNumber({ number }: { number: number }) {
  return (
    <span className="label-mono-md shrink-0 rounded border border-line-strong bg-surface px-2 py-0.5 whitespace-nowrap text-fg-muted">
      {taskLabel(number)}
    </span>
  );
}
