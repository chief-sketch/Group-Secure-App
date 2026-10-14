import React, { useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface DeleteMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export const DeleteMessageDialog: React.FC<DeleteMessageDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, isOpen, {
    onEscape: () => {
      if (!isDeleting) onClose();
    },
  });

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-msg-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-standard animate-fadeIn"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-[380px] bg-[#1F2C33] rounded-[12px] border border-white/[0.08] shadow-xl p-6 text-center select-none outline-none"
      >
        <div className="w-11 h-11 rounded-full bg-[#E5484D]/15 border border-[#E5484D]/30 text-[#E5484D] flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-5 h-5" strokeWidth={1.75} />
        </div>

        <h3 id="delete-msg-title" className="text-[17px] font-semibold text-[#E9EDEF] title-tracking mb-2 leading-tight">
          Delete this message?
        </h3>

        <p className="text-[13px] text-[#8696A0] leading-relaxed mb-6">
          It will be removed for everyone.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-[8px] bg-transparent hover:bg-white/[0.05] border border-white/[0.08] text-[13px] font-medium text-[#E9EDEF] transition-standard cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-[8px] bg-[#E5484D] hover:bg-[#D93D42] text-[13px] font-medium text-white transition-standard cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};
