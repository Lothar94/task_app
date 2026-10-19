import { SendHorizontal } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { Button, ErrorMessage } from '../../components/ui';
import { useFollowUp } from './taskQueries';

/** Chat console: hairline textarea with an accent focus ring and a send bar underneath. */
export function FollowUpForm({ taskId }: { taskId: string }) {
  const [message, setMessage] = useState('');
  const followUp = useFollowUp(taskId);
  const inputId = useId();

  const submit = () => followUp.mutate(message, { onSuccess: () => setMessage('') });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="rounded-lg border border-line-strong bg-canvas focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
        <label htmlFor={inputId} className="sr-only">
          Mensaje para el agente
        </label>
        <textarea
          id={inputId}
          rows={2}
          required
          placeholder="Escribe al agente para continuar esta tarea…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="block w-full resize-none bg-transparent px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
        />
        <div className="flex items-center justify-end border-t border-line px-2 py-1.5">
          <Button type="submit" disabled={followUp.isPending}>
            Enviar
            <SendHorizontal aria-hidden className="size-4" />
          </Button>
        </div>
      </div>
      <ErrorMessage error={followUp.error} />
    </form>
  );
}
