import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router';

export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

const BUTTON_BASE = `inline-flex items-center justify-center gap-1.5 rounded-sm px-3.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`;

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover focus-visible:outline-fg',
  secondary: 'border border-line-strong bg-transparent text-fg hover:bg-fg/5 hover:border-fg-subtle',
  danger: 'border border-danger-line bg-danger-soft text-danger hover:bg-danger/20',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`${BUTTON_BASE} ${BUTTON_STYLES[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  to,
  variant = 'primary',
  children,
}: {
  to: string;
  variant?: ButtonVariant;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={`${BUTTON_BASE} ${BUTTON_STYLES[variant]}`}>
      {children}
    </Link>
  );
}

/** 24px borderless ghost button for terminal-style micro actions; `label` is its accessible name. */
export function IconButton({
  label,
  children,
  className = '',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

const CONTROL =
  'w-full rounded-sm border border-line-strong bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent focus-visible:ring-1 focus-visible:ring-accent';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="label-mono block text-fg-subtle">{label}</span>
      {children}
      {hint && <span className="block text-xs text-fg-subtle">{hint}</span>}
    </label>
  );
}

export const TextInput = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={CONTROL} {...props} />
);

export const TextArea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={`${CONTROL} font-mono`} rows={6} {...props} />
);

export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={CONTROL} {...props} />
);

export function Card({
  title,
  icon,
  meta,
  actions,
  children,
}: {
  title?: string;
  icon?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface p-4">
      {(title || icon || meta || actions) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {icon && (
              <span aria-hidden className="text-fg-subtle [&>svg]:size-4">
                {icon}
              </span>
            )}
            {title && <h2 className="text-sm font-semibold text-fg">{title}</h2>}
          </div>
          {(meta || actions) && (
            <div className="label-mono flex items-center gap-2 text-fg-subtle">
              {meta}
              {actions}
            </div>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  badge,
  breadcrumb,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {breadcrumb && <div className="label-mono mb-1 text-fg-subtle">{breadcrumb}</div>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[1.75rem] leading-9 font-semibold tracking-tight">{title}</h1>
          {badge}
        </div>
        {subtitle && <div className="mt-1 text-sm text-fg-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Divided list container; rows are `<li>` using ROW_CLASS. */
export function RowList({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {children}
    </ul>
  );
}

export const ROW_CLASS =
  'flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent';

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="label-mono-md rounded-sm border border-line bg-surface-raised px-1.5 py-0.5 whitespace-nowrap text-fg-muted normal-case">
      {children}
    </span>
  );
}

export type ChipTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

const CHIP_TONES: Record<ChipTone, { box: string; dot: string }> = {
  success: { box: 'border-success-line bg-success-soft text-success', dot: 'bg-success' },
  info: { box: 'border-info-line bg-info-soft text-info', dot: 'bg-info' },
  warning: { box: 'border-warning-line bg-warning-soft text-warning', dot: 'bg-warning' },
  danger: { box: 'border-danger-line bg-danger-soft text-danger', dot: 'bg-danger' },
  neutral: { box: 'border-line-strong bg-fg/5 text-fg-muted', dot: 'bg-fg-subtle' },
};

/** 20px mono status chip. Always carries text; `pulse` adds a dot that animates unless reduced motion is set. */
export function StatusChip({
  tone,
  pulse = false,
  dashed = false,
  children,
}: {
  tone: ChipTone;
  pulse?: boolean;
  dashed?: boolean;
  children: ReactNode;
}) {
  const { box, dot } = CHIP_TONES[tone];
  return (
    <span
      className={`inline-flex h-5 items-center gap-1.5 rounded-sm border px-1.5 font-mono text-[0.6875rem] leading-none font-medium whitespace-nowrap ${dashed ? 'border-dashed' : ''} ${box}`}
    >
      {pulse && <span aria-hidden className={`size-1 rounded-full motion-safe:animate-pulse ${dot}`} />}
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-fg-subtle">
      {children}
    </p>
  );
}

export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const details = (error as { details?: string[] }).details ?? [];
  return (
    <div role="alert" className="rounded-sm border border-danger-line bg-danger-soft p-3 text-sm text-danger">
      {message}
      {details.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center rounded-sm border border-line bg-surface p-0.5">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`flex items-center gap-1.5 rounded-sm px-3 py-1 font-mono text-xs transition-colors ${FOCUS_RING} ${selected ? 'bg-surface-hover font-medium text-accent' : 'text-fg-subtle hover:text-fg'}`}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={`rounded-sm px-1 font-mono text-[0.625rem] ${selected ? 'bg-accent/20 text-accent' : 'text-fg-subtle'}`}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Loading() {
  return <p className="text-sm text-fg-subtle">Cargando…</p>;
}

export function CheckboxList<T extends { id: string; name: string }>({
  options,
  selected,
  onChange,
  describe,
  isDisabled,
}: {
  options: T[];
  selected: string[];
  onChange: (selected: string[]) => void;
  describe?: (option: T) => string;
  isDisabled?: (option: T) => boolean;
}) {
  if (options.length === 0) return <p className="text-sm text-fg-subtle">No hay opciones disponibles.</p>;
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <li key={option.id}>
          <label className="flex cursor-pointer items-start gap-2 rounded-sm border border-line p-2 hover:border-line-strong has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
            <input
              type="checkbox"
              className="mt-1 accent-accent"
              checked={selected.includes(option.id)}
              disabled={isDisabled?.(option) ?? false}
              onChange={() => toggle(option.id)}
            />
            <span>
              <span className="block text-sm font-medium">{option.name}</span>
              {describe && <span className="block text-xs text-fg-subtle">{describe(option)}</span>}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
