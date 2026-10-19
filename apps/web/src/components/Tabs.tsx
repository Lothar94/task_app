import { type KeyboardEvent, useRef } from 'react';
import { FOCUS_RING } from './ui';

interface TabOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  label: string;
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Builds the DOM id of each tab and of its panel (`${idPrefix}-tab-x` / `${idPrefix}-panel`). */
  idPrefix: string;
}

export const tabPanelProps = (idPrefix: string, value: string) =>
  ({ id: `${idPrefix}-panel`, role: 'tabpanel', 'aria-labelledby': `${idPrefix}-tab-${value}` }) as const;

/** Reference-style tab strip (mono labels, count pills) with arrow-key navigation. */
export function Tabs<T extends string>({ label, options, value, onChange, idPrefix }: TabsProps<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (offset === 0) return;
    event.preventDefault();
    const next = options[(index + offset + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    refs.current.get(next.value)?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="inline-flex border border-line bg-surface p-0.5">
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) refs.current.set(option.value, node);
            }}
            id={`${idPrefix}-tab-${option.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`flex items-center gap-1.5 px-3 py-1 font-mono text-xs transition-colors ${FOCUS_RING} ${selected ? 'bg-surface-hover font-medium text-accent' : 'text-fg-subtle hover:text-fg'}`}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={`px-1 text-[0.625rem] ${selected ? 'bg-accent/20 text-accent' : 'text-fg-subtle'}`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
