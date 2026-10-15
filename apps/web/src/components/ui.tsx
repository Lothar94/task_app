import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-500 text-white hover:bg-indigo-400',
  secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700',
  danger: 'bg-red-600/90 text-white hover:bg-red-500',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  );
}

export function LinkButton({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={`rounded-md px-3 py-1.5 text-sm font-medium ${BUTTON_STYLES.primary}`}>
      {children}
    </Link>
  );
}

const CONTROL =
  'w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-indigo-400';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
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
  actions,
  children,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>}
          {actions}
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
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-zinc-400">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Divided list container; rows are `<li>` using ROW_CLASS. */
export function RowList({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
      {children}
    </ul>
  );
}

export const ROW_CLASS =
  'flex items-center gap-4 px-4 py-3 transition hover:bg-zinc-800/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400';

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs whitespace-nowrap text-zinc-300">
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
      {children}
    </p>
  );
}

export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const details = (error as { details?: string[] }).details ?? [];
  return (
    <div role="alert" className="rounded-md border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
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
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-zinc-700 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={`rounded px-3 py-1 text-sm ${option.value === value ? 'bg-zinc-700 text-zinc-50' : 'text-zinc-400 hover:text-zinc-50'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Loading() {
  return <p className="text-sm text-zinc-500">Cargando…</p>;
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
  if (options.length === 0) return <p className="text-sm text-zinc-500">No hay opciones disponibles.</p>;
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <li key={option.id}>
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-zinc-800 p-2 hover:border-zinc-600 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
            <input
              type="checkbox"
              className="mt-1 accent-indigo-500"
              checked={selected.includes(option.id)}
              disabled={isDisabled?.(option) ?? false}
              onChange={() => toggle(option.id)}
            />
            <span>
              <span className="block text-sm font-medium">{option.name}</span>
              {describe && <span className="block text-xs text-zinc-500">{describe(option)}</span>}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
