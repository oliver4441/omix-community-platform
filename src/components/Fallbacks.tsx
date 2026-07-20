import { Icon } from './Icon';

export function LoadingFallback({ height = 'h-32' }: { height?: string }) {
  return (
    <div className={`flex items-center justify-center ${height}`}>
      <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

export function ErrorFallback({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center min-h-[120px]">
      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
        <Icon name="alert-triangle" size={20} className="text-red-400" />
      </div>
      <p className="text-sm text-[var(--text-muted)] mb-3">{message || 'Failed to load'}</p>
      {onRetry && (
        <button onClick={onRetry}
          className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-all">
          Try Again
        </button>
      )}
    </div>
  );
}
