import React, { useRef } from 'react';
import { LogOut } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface LogoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const LogoutDialog: React.FC<LogoutDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, isOpen, { onEscape: onClose });

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-standard"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-[380px] bg-[#1F2C33] rounded-[12px] border border-white/[0.08] shadow-xl p-6 text-center select-none outline-none"
      >
        <div className="w-11 h-11 rounded-full bg-[#E5484D]/15 border border-[#E5484D]/30 text-[#E5484D] flex items-center justify-center mx-auto mb-4">
          <LogOut className="w-5 h-5" strokeWidth={1.75} />
        </div>

        <h3 id="logout-title" className="text-[18px] font-semibold text-[#E9EDEF] title-tracking mb-2 leading-tight">
          Log out of organization?
        </h3>

        <p className="text-[13px] text-[#8696A0] leading-relaxed mb-6">
          Your active session will be ended and you will need to sign in again to access channels and messages.
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full h-[44px] rounded-[10px] bg-[#E5484D] hover:bg-[#c93b40] text-white text-[14px] font-medium transition-standard cursor-pointer flex items-center justify-center"
          >
            Log out
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-[44px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[14px] font-medium transition-standard cursor-pointer flex items-center justify-center"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
