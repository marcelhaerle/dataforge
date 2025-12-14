'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';

// --- Types ---

export type ToastType = 'success' | 'error' | 'info' | 'loading';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

// --- Context ---

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// --- Provider Component ---

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type, title, message, duration = 5000 }: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}

      {/* Toast Container (Fixed Overlay) */}
      <div className="fixed bottom-4 right-4 z-100 flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// --- Individual Toast Item UI ---

const ToastItem = ({ type, title, message, onClose }: Toast & { onClose: () => void }) => {
  // Determine styles based on type
  const styles = {
    success: 'bg-white border-l-4 border-green-500 shadow-lg ring-1 ring-black/5',
    error: 'bg-white border-l-4 border-red-500 shadow-lg ring-1 ring-black/5',
    info: 'bg-white border-l-4 border-blue-500 shadow-lg ring-1 ring-black/5',
    loading: 'bg-white border-l-4 border-indigo-500 shadow-lg ring-1 ring-black/5',
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertTriangle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    loading: <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />,
  };

  return (
    <div
      className={`pointer-events-auto rounded-lg p-4 flex items-start gap-3 transition-all duration-500 animate-in slide-in-from-right-full fade-in ${styles[type]}`}
      role="alert"
    >
      <div className="mt-0.5">{icons[type]}</div>
      <div className="flex-1">
        <h3 className="font-semibold text-sm text-slate-800">{title}</h3>
        {message && <p className="text-sm text-slate-600 mt-1">{message}</p>}
      </div>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
