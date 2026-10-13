/** Milestone and tag chips of a task. */
export function TaskLabels({ milestone, tags }: { milestone: string | null; tags: string[] }) {
  if (!milestone && tags.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {milestone && (
        <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-xs text-indigo-300">
          <span className="sr-only">Milestone: </span>◆ {milestone}
        </span>
      )}
      {tags.map((tag) => (
        <span key={tag} className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
          <span className="sr-only">Tag: </span>#{tag}
        </span>
      ))}
    </span>
  );
}
