import { type FormEvent, useId, useState } from 'react';
import { Button, ErrorMessage } from '../../components/ui';
import { ORGANIZATION_NAME_MAX_LENGTH, validateOrganizationName } from './organizationModel';

interface OrganizationNameFormProps {
  label: string;
  initialName?: string;
  submitLabel: string;
  isSubmitting: boolean;
  serverError: unknown;
  autoFocus?: boolean;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
}

export function OrganizationNameForm({
  label,
  initialName = '',
  submitLabel,
  isSubmitting,
  serverError,
  autoFocus,
  onSubmit,
  onCancel,
}: OrganizationNameFormProps) {
  const [value, setValue] = useState(initialName);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = `${inputId}-error`;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateOrganizationName(value);
    setValidationError(result.error);
    if (result.name !== null) onSubmit(result.name);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1 space-y-1">
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold tracking-wide text-zinc-400 uppercase"
          >
            {label}
          </label>
          <input
            id={inputId}
            value={value}
            autoFocus={autoFocus}
            maxLength={ORGANIZATION_NAME_MAX_LENGTH * 2}
            aria-invalid={validationError !== null}
            aria-describedby={validationError ? errorId : undefined}
            onChange={(event) => setValue(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
      {validationError && (
        <p id={errorId} role="alert" className="text-sm text-red-300">
          {validationError}
        </p>
      )}
      <ErrorMessage error={serverError} />
    </form>
  );
}
