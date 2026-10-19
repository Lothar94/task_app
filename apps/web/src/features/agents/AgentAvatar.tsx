/** Up to two initials of the agent name: "Lara Backend" → "LB", "Conde" → "CO". */
export function agentInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1 ? words.slice(0, 2).map((word) => word[0]) : [...(words[0] ?? '?')].slice(0, 2);
  return letters.join('').toUpperCase();
}

/** Square monospace avatar with the agent's initials; decorative (the name always sits next to it). */
export function AgentAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-sm border border-line-strong bg-surface-raised font-mono text-sm font-semibold text-accent"
    >
      {agentInitials(name)}
    </span>
  );
}
