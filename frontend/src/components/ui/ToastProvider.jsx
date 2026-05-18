import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Toast from './Toast';
import '../../styles/toast.css';

const ToastContext = createContext(null);

let idCounter = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((opts) => {
    const id = String(idCounter++);
    const toast = { id, createdAt: Date.now(), duration: opts.duration ?? 5000, ...opts };
    setToasts((prev) => [toast, ...prev]);

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => remove(id), toast.duration);
    }

    return id;
  }, [remove]);

  const api = useMemo(() => ({
    show,
    success: (opts) => show({ variant: 'success', ...opts }),
    error: (opts) => show({ variant: 'error', ...opts }),
    info: (opts) => show({ variant: 'info', ...opts }),
    remove,
  }), [show, remove]);

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div className="toast-root" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className="toast-item">
            <Toast toast={t} onClose={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  return useContext(ToastContext);
}

export default ToastProvider;
