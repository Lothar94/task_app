import { type FormEvent, useState } from 'react';
import { Button, ErrorMessage, TextArea } from '../../components/ui';
import { useFollowUp } from './taskQueries';

export function FollowUpForm({ taskId }: { taskId: string }) {
  const [message, setMessage] = useState('');
  const followUp = useFollowUp(taskId);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    followUp.mutate(message, { onSuccess: () => setMessage('') });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <TextArea
        rows={3}
        required
        placeholder="Escribe al agente para continuar esta tarea…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <ErrorMessage error={followUp.error} />
      <Button type="submit" disabled={followUp.isPending}>
        Enviar
      </Button>
    </form>
  );
}
