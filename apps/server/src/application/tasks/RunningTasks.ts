/** Keeps track of in-flight task executions so they can be aborted. */
export class RunningTasks {
  private readonly controllers = new Map<string, AbortController>();

  register(taskId: string, parentSignal?: AbortSignal): AbortController {
    const controller = new AbortController();
    parentSignal?.addEventListener('abort', () => controller.abort(), { once: true });
    this.controllers.set(taskId, controller);
    return controller;
  }

  isRunning(taskId: string): boolean {
    return this.controllers.has(taskId);
  }

  abort(taskId: string): void {
    this.controllers.get(taskId)?.abort();
  }

  release(taskId: string): void {
    this.controllers.delete(taskId);
  }
}
