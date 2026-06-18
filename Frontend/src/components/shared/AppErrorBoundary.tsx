import React from 'react';

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled React render error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Digital PSSR Portal</p>
          <h1 className="mt-2 text-headline-sm font-black text-on-surface">Something failed while rendering</h1>
          <p className="mt-3 text-body-sm text-on-surface-variant">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded bg-primary px-4 py-2 text-label-sm font-black text-on-primary hover:bg-primary/90"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
