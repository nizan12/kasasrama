import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove after 3.5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 3500);
  }, [removeToast]);

  const success = useCallback((message: string) => showToast(message, "success"), [showToast]);
  const error = useCallback((message: string) => showToast(message, "error"), [showToast]);
  const warning = useCallback((message: string) => showToast(message, "warning"), [showToast]);
  const info = useCallback((message: string) => showToast(message, "info"), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      {createPortal(
        <div className="fixed bottom-5 right-5 z-[10000] flex flex-col gap-3 w-full max-w-sm pointer-events-none px-4 sm:px-0">
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

interface ToastCardProps {
  toast: ToastItem;
  onClose: () => void;
}

function ToastCard({ toast, onClose }: ToastCardProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  // Color configurations
  const configs = {
    success: {
      bg: "bg-white/95 border-emerald-100",
      iconBg: "bg-emerald-50 text-emerald-500 border-emerald-100",
      text: "text-slate-800",
      progressBg: "bg-emerald-500",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    error: {
      bg: "bg-white/95 border-rose-100",
      iconBg: "bg-rose-50 text-rose-500 border-rose-100",
      text: "text-slate-800",
      progressBg: "bg-rose-500",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    warning: {
      bg: "bg-white/95 border-amber-100",
      iconBg: "bg-amber-50 text-amber-500 border-amber-100",
      text: "text-slate-800",
      progressBg: "bg-amber-500",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    info: {
      bg: "bg-white/95 border-indigo-100",
      iconBg: "bg-indigo-50 text-indigo-500 border-indigo-100",
      text: "text-slate-800",
      progressBg: "bg-indigo-500",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const config = configs[toast.type];

  return (
    <div
      className={`w-full pointer-events-auto rounded-2xl border bg-white shadow-xl shadow-slate-200/50 backdrop-blur-md p-4 flex gap-3 relative overflow-hidden transition-all duration-300 ${
        isExiting 
          ? "opacity-0 translate-y-2 scale-95" 
          : "animate-slide-in-right"
      } ${config.bg}`}
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${config.iconBg}`}>
        {config.icon}
      </div>

      {/* Message */}
      <div className="flex-1 pt-1.5 min-w-0 pr-4">
        <p className={`text-sm font-bold leading-relaxed truncate ${config.text}`}>
          {toast.message}
        </p>
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Progress Bar (Animation) */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
        <div 
          className={`h-full w-full origin-left animate-toast-progress ${config.progressBg}`}
        />
      </div>
    </div>
  );
}
