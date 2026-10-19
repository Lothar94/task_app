import { ChevronDown } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { FOCUS_RING, type ChipTone } from './ui';

const BAR_STYLES: Record<ChipTone, string> = {
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-line-strong',
};

interface AccordionProps {
  /** Always-visible content of the toggle button. */
  header: ReactNode;
  /** Controls kept outside the button (links, actions), aligned to the right of the header. */
  trailing?: ReactNode;
  /** Colours a 2px bar on the left edge. */
  bar?: ChipTone;
  /** Dim the bar and header text while something is still running. */
  pulseBar?: boolean;
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Collapsible panel: a `button` with aria-expanded/aria-controls toggles the body. */
export function Accordion({
  header,
  trailing,
  bar,
  pulseBar = false,
  defaultOpen = false,
  className = '',
  bodyClassName = '',
  children,
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <div className={`relative min-w-0 overflow-hidden rounded-lg border border-line bg-surface ${className}`}>
      {bar && (
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-0.5 ${BAR_STYLES[bar]} ${pulseBar ? 'motion-safe:animate-pulse' : ''}`}
        />
      )}
      <div className="flex min-w-0 items-center gap-2 pr-3">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => setIsOpen((open) => !open)}
          className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover ${FOCUS_RING} focus-visible:-outline-offset-2`}
        >
          <ChevronDown
            aria-hidden
            className={`size-4 shrink-0 text-fg-subtle motion-safe:transition-transform ${isOpen ? '' : '-rotate-90'}`}
          />
          {header}
        </button>
        {trailing}
      </div>
      <div id={bodyId} hidden={!isOpen} className={bodyClassName}>
        {isOpen && children}
      </div>
    </div>
  );
}
