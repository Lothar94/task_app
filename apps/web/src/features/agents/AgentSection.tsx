import type { ReactNode } from 'react';

/** "Ficha del agente" section: hairline panel headed by an uppercase mono label. */
export function AgentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface p-4">
      <h2 className="label-mono-md mb-3 border-b border-line pb-2 text-fg-muted">{title}</h2>
      {children}
    </section>
  );
}
