import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastKind = 'ok' | 'err';

interface ToastState {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastState>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; message: string; kind: ToastKind }[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-stack">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span className="toast-ico">{t.kind === 'ok' ? '✓' : '✕'}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}