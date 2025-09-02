import React, { createContext, useContext, useMemo, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number; // ms
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = ({ type, message, title, duration = 3000 }: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const item: ToastItem = { id, type, message, title, duration };
    setToasts((prev) => [...prev, item]);
    // Auto-remove
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const value = useMemo(() => ({ showToast }), []);

  const colorClasses: Record<ToastType, string> = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-600 text-black',
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] space-y-3 w-[90vw] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`shadow-lg rounded-md text-white overflow-hidden border border-black/10 ${colorClasses[t.type]}`}
            role="alert"
          >
            <div className="flex items-start p-3">
              <div className="flex-1">
                {t.title && <p className="font-semibold leading-tight">{t.title}</p>}
                <p className="text-sm leading-snug">{t.message}</p>
              </div>
              <button
                className="ml-3 text-white/80 hover:text-white"
                onClick={() => remove(t.id)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
