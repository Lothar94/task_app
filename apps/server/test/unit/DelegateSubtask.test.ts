import { describe, expect, it, vi } from 'vitest';
import { DelegateSubtask } from '../../src/application/tasks/DelegateSubtask.js';
import type { DelegationRequest } from '../../src/application/ports/AgentRuntime.js';
import { ValidationError } from '../../src/domain/errors/DomainError.js';
import type { Task } from '../../src/domain/task/Task.js';

function setup() {
  const recorder = { recordNew: vi.fn(), recordChange: vi.fn() };
  const agents = { findById: vi.fn(), findByName: vi.fn() };
  const useCase = new DelegateSubtask(
    { nextNumber: vi.fn(), findById: vi.fn(), findChildren: vi.fn() } as never,
    agents as never,
    { findById: vi.fn() } as never,
    recorder as never,
    { next: () => 'id' },
    { now: () => new Date() },
    3,
  );
  const execute = (choice: Record<string, unknown>) =>
    useCase.execute({
      parent: { agentId: 'a1' } as Task,
      request: { collaboratorName: 'Dev', title: 't', instructions: 'i', ...choice } as DelegationRequest,
      executor: { execute: vi.fn() } as never,
      signal: new AbortController().signal,
    });
  return { execute, recorder, agents };
}

describe('DelegateSubtask model choice validation', () => {
  it.each([{ model: 'gpt-4' }, { effort: 'ultra' }, { model: 42 }, { effort: '' }])(
    'rejects %o before looking up the collaborator or creating a subtask',
    async (choice) => {
      const { execute, recorder, agents } = setup();

      await expect(execute(choice)).rejects.toBeInstanceOf(ValidationError);

      expect(agents.findById).not.toHaveBeenCalled();
      expect(recorder.recordNew).not.toHaveBeenCalled();
    },
  );
});
