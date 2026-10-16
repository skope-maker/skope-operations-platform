import { Component } from 'react';

// Catches render errors anywhere below it so one broken screen shows a recovery
// message instead of blanking the whole app.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex min-h-dvh items-center justify-center bg-background p-6" data-testid="error-boundary">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-extrabold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This screen hit an unexpected error. Your data is safe. Go back to the dashboard to continue.
          </p>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            data-testid="error-reload-btn"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }
}
