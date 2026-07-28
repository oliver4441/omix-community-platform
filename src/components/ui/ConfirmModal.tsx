"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "default";
}

interface ConfirmContextType {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType>(null!);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const [resolve, setResolve] = useState<((v: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((res) => {
      setState(opts);
      setResolve(() => res);
    });
  }, []);

  const handleConfirm = () => {
    resolve?.(true);
    setState(null);
    setResolve(null);
  };

  const handleCancel = () => {
    resolve?.(false);
    setState(null);
    setResolve(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 bg-[var(--color-bg-overlay)] flex items-center justify-center z-[9998]"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel();
          }}
        >
          <div
            className="bg-[var(--color-bg-dark)] rounded-[20px] p-6 w-80 shadow-2xl border border-[var(--color-border)]"
            style={{ animation: "scaleIn 0.15s ease" }}
          >
            <h3 className="text-lg font-semibold text-[var(--color-txt)] mb-2">
              {state.title}
            </h3>
            <p className="text-sm text-[var(--color-txt-secondary)] mb-6">
              {state.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancel}
                className="btn-ghost text-sm"
              >
                {state.cancelText || "Cancel"}
              </button>
              <button
                onClick={handleConfirm}
                className={
                  state.variant === "danger"
                    ? "btn-danger text-sm px-4"
                    : "btn-primary text-sm"
                }
              >
                {state.confirmText || "Confirm"}
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
