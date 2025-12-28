import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, variant = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, variant }]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration),
    warning: (msg, duration) => addToast(msg, 'warning', duration),
    info: (msg, duration) => addToast(msg, 'info', duration),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(({ id, message, variant }) => (
          <Toast
            key={id}
            message={message}
            variant={variant}
            onClose={() => removeToast(id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const Toast = ({ message, variant, onClose }) => {
  const variants = {
    success: {
      bg: 'bg-success-50',
      border: 'border-success-200',
      text: 'text-success-800',
      iconBg: 'bg-success-100',
      iconColor: 'text-success-600',
      Icon: CheckCircle
    },
    error: {
      bg: 'bg-error-50',
      border: 'border-error-200',
      text: 'text-error-800',
      iconBg: 'bg-error-100',
      iconColor: 'text-error-600',
      Icon: AlertCircle
    },
    warning: {
      bg: 'bg-warning-50',
      border: 'border-warning-200',
      text: 'text-warning-800',
      iconBg: 'bg-warning-100',
      iconColor: 'text-warning-600',
      Icon: AlertTriangle
    },
    info: {
      bg: 'bg-info-50',
      border: 'border-info-200',
      text: 'text-info-800',
      iconBg: 'bg-info-100',
      iconColor: 'text-info-600',
      Icon: Info
    },
  };

  const { bg, border, text, iconBg, iconColor, Icon } = variants[variant];

  return (
    <div className={`
      ${bg} ${border} ${text}
      flex items-start gap-3 p-4 rounded-xl border shadow-lg
      min-w-[320px] max-w-md
      animate-slide-in-right pointer-events-auto
    `}>
      <div className={`${iconBg} p-1 rounded-lg flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className="flex-1 text-sm font-medium leading-relaxed">{message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 hover:opacity-70 transition-opacity p-1 rounded hover:bg-white/50"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
