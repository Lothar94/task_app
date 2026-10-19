/** Milestone and tag chips of a task. */
export function TaskLabels({ milestone, tags }: { milestone: string | null; tags: string[] }) {
  if (!milestone && tags.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {milestone && (
        <span className="rounded border border-line-strong bg-accent/10 px-1.5 py-0.5 font-mono text-xs text-accent">
          <span className="sr-only">Milestone: </span>◆ {milestone}
        </span>
      )}
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded border border-line bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-fg-muted"
        >
          <span className="sr-only">Tag: </span>#{tag}
        </span>
      ))}
    </span>
  );
}
