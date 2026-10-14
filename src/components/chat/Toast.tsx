import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const isError = type === 'error' || /fail|error|denied|rejected|invalid/i.test(message);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 sm:bottom-auto sm:top-6 sm:right-6 sm:left-auto sm:translate-x-0 z-50 flex items-center gap-3 px-4 py-3 rounded-[10px] bg-[#1F2C33] shadow-lg max-w-[92vw] sm:max-w-[380px] transition-standard ${
        isError
          ? 'border border-[#E5484D]/40 text-[#E9EDEF]'
          : 'border border-[#00A884]/40 text-[#E9EDEF]'
      }`}
    >
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
          isError ? 'bg-[#E5484D]/15 text-[#E5484D]' : 'bg-[#00A884]/15 text-[#00A884]'
        }`}
      >
        {isError ? (
          <AlertCircle className="w-4 h-4" strokeWidth={1.75} />
        ) : (
          <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />
        )}
      </div>

      <span className="flex-1 text-[13px] leading-snug break-words">
        {message}
      </span>

      <button
        type="button"
        onClick={onClose}
        className="w-11 h-11 flex items-center justify-center text-[#8696A0] hover:text-[#E9EDEF] -mr-2 rounded-[8px] hover:bg-white/[0.05] transition-standard cursor-pointer flex-shrink-0"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" strokeWidth={1.75} />
      </button>
    </div>
  );
};
