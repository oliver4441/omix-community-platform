'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex flex-col items-center justify-center p-8 text-center min-h-[200px]"
          role="alert"
        >
          <div className="w-12 h-12 rounded-full bg-[var(--color-dnd)]/10 flex items-center justify-center mb-4">
            <span
              className="text-2xl font-bold text-[var(--color-dnd)]"
              aria-hidden="true"
            >
              !
            </span>
          </div>
          <h3 className="text-lg font-semibold text-[var(--color-txt)] mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-[var(--color-txt-muted)] mb-6 max-w-sm">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={this.handleRetry}
            className="btn-primary"
            aria-label="Retry loading this section"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
