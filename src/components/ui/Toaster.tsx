import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  toast: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

// Context
const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  dismiss: () => {},
});

export const useToast = () => useContext(ToastContext);

// Provider
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (props: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, ...props }]);
  };

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
};

// Toast Component
const ToastItem: React.FC<{ toast: Toast; dismiss: () => void }> = ({ toast, dismiss }) => {
  const { title, description, variant = 'default', duration = 5000 } = toast;

  useEffect(() => {
    const timer = setTimeout(() => {
      dismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [dismiss, duration]);

  // Derive background color based on variant
  const getBgColor = () => {
    switch (variant) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      case 'info': return 'bg-blue-50 border-blue-200';
      default: return 'bg-white border-gray-200';
    }
  };

  // Derive text color based on variant
  const getTextColor = () => {
    switch (variant) {
      case 'success': return 'text-green-800';
      case 'error': return 'text-red-800';
      case 'warning': return 'text-yellow-800';
      case 'info': return 'text-blue-800';
      default: return 'text-gray-800';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      className={`rounded-lg shadow-lg border p-4 mb-2 ${getBgColor()}`}
      role="alert"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className={`font-semibold ${getTextColor()}`}>{title}</h3>
          {description && <p className={`mt-1 text-sm ${getTextColor()} opacity-90`}>{description}</p>}
        </div>
        <button 
          onClick={dismiss}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          &times;
        </button>
      </div>
    </motion.div>
  );
};

// Toaster Component (Container for all toasts)
export const Toaster: React.FC<{ toasts?: Toast[]; dismiss?: (id: string) => void }> = ({ 
  toasts = [], 
  dismiss = () => {} 
}) => {
  return (
    <div className="fixed top-4 right-4 z-50 w-80">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            dismiss={() => dismiss(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Toaster;

export { ToastContext }