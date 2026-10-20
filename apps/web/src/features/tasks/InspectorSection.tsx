import type { ReactNode } from 'react';
import { Accordion } from '../../components/Accordion';

export function InspectorSection({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <Accordion
      defaultOpen
      header={<h3 className="label-mono text-fg-muted">{title}</h3>}
      trailing={meta && <span className="label-mono text-fg-subtle">{meta}</span>}
      bodyClassName="border-t border-line p-3"
    >
      {children}
    </Accordion>
  );
}
