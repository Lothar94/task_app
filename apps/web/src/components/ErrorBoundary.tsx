import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui';

interface ErrorBoundaryState {
  error: Error | null;
}

/** Shows a recoverable message instead of a blank page when a view crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('View crashed', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="space-y-3 rounded-lg border border-red-900 bg-red-950/40 p-6">
        <h2 className="font-semibold text-red-300">Algo ha fallado al mostrar esta vista</h2>
        <pre className="font-mono text-xs whitespace-pre-wrap text-red-200/80">
          {this.state.error.message}
        </pre>
        <Button variant="secondary" onClick={() => this.setState({ error: null })}>
          Reintentar
        </Button>
      </div>
    );
  }
}
