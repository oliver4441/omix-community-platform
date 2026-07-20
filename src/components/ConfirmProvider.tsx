import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmContextType {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType>({
  confirm: () => Promise.resolve(false),
});

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const [animatingOut, setAnimatingOut] = useState(false);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ ...opts, resolve });
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    if (!state) return;
    setAnimatingOut(true);
    setTimeout(() => {
      state.resolve(result);
      setState(null);
      setAnimatingOut(false);
    }, 150);
  }, [state]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-60 px-4"
          onClick={e => { if (e.target === e.currentTarget) handleClose(false); }}
          style={{ animation: animatingOut ? 'fadeOut 0.15s ease forwards' : 'fadeIn 0.15s ease' }}
        >
          <div
            className="bg-[var(--bg-sidebar)] rounded-xl p-6 w-80 max-w-full shadow-2xl border border-gray-700"
            style={{ animation: animatingOut ? 'scaleOut 0.15s ease forwards' : 'scaleIn 0.15s ease' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h3 id="confirm-title" className="text-lg font-bold text-[var(--text-primary)] mb-2">{state.title}</h3>
            <p className="text-sm text-[var(--text-muted)] mb-5">{state.message}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--bg-hover)]"
                autoFocus
              >
                {state.cancelText || 'Cancel'}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  state.danger ? 'bg-red-500 hover:bg-red-600' : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
                }`}
              >
                {state.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
