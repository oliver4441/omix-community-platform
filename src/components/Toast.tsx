import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const iconMap: Record<ToastType, IconName> = {
    success: 'check',
    error: 'alert-triangle',
    info: 'info',
    warning: 'alert-triangle',
  };

  const colorMap: Record<ToastType, string> = {
    success: 'bg-green-500/15 border-green-500/30 text-green-400',
    error: 'bg-red-500/15 border-red-500/30 text-red-400',
    info: 'bg-[var(--accent-subtle)] border-[var(--accent)]/30 text-[var(--accent)]',
    warning: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-sm ${colorMap[t.type]}`}
            style={{ animation: 'fadeSlideUp 0.25s ease, fadeOut 0.3s ease 3.7s forwards' }}
          >
            <Icon name={iconMap[t.type]} size={18} className="shrink-0 mt-0.5" />
            <span className="text-sm font-medium flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss notification"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
