import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary:', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-chat)]">
          <div className="text-center p-8 animate-fade-up">
            <img src="/logo.jpg" className="w-20 h-20 rounded-2xl mx-auto mb-4 object-cover" alt="Omix" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Something went wrong</h1>
            <p className="text-[var(--text-muted)] mb-4">{this.state.error?.message}</p>
            <button onClick={() => window.location.reload()} className="btn-accent px-6 py-2 rounded font-semibold">Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}