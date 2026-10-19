import { type FormEvent, useId, useState } from 'react';
import { Button, ErrorMessage, TextInput } from '../../components/ui';
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
          <label htmlFor={inputId} className="label-mono block text-fg-subtle">
            {label}
          </label>
          <TextInput
            id={inputId}
            value={value}
            autoFocus={autoFocus}
            maxLength={ORGANIZATION_NAME_MAX_LENGTH * 2}
            aria-invalid={validationError !== null}
            aria-describedby={validationError ? errorId : undefined}
            onChange={(event) => setValue(event.target.value)}
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
        <p id={errorId} role="alert" className="text-sm text-danger">
          {validationError}
        </p>
      )}
      <ErrorMessage error={serverError} />
    </form>
  );
}
