import { Modal } from "./Modal";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Ya, Konfirmasi",
  cancelText = "Batal",
  type = "danger",
  isLoading = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-5">
        <div className="flex items-start gap-3.5">
          <div className={`p-2.5 rounded-2xl flex-shrink-0 ${
            type === "danger" 
              ? "bg-rose-50 text-rose-500 border border-rose-100" 
              : type === "warning"
                ? "bg-amber-50 text-amber-500 border border-amber-100"
                : "bg-indigo-50 text-indigo-500 border border-indigo-100"
          }`}>
            {type === "danger" ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            ) : type === "warning" ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div className="space-y-1.5 flex-1">
            <p className="text-sm text-slate-650 leading-relaxed font-semibold">
              {message}
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button 
            type="button" 
            onClick={onClose} 
            disabled={isLoading}
            className="btn-premium-secondary flex-1 text-sm py-3"
          >
            {cancelText}
          </button>
          <button 
            type="button" 
            onClick={onConfirm} 
            disabled={isLoading}
            className={`flex-1 text-sm py-3 rounded-2xl font-bold transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2 ${
              type === "danger" 
                ? "btn-premium-danger" 
                : type === "warning"
                  ? "bg-amber-500 hover:bg-amber-600 border border-amber-600 text-white"
                  : "btn-premium-primary"
            }`}
          >
            {isLoading ? "Memproses..." : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
