import React, { useRef } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface CancelMeetingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isCancelling: boolean;
  meetingTitle: string;
}

export const CancelMeetingDialog: React.FC<CancelMeetingDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isCancelling,
  meetingTitle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, isOpen, { onEscape: onClose, isDismissible: !isCancelling });

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="w-full max-w-[420px] bg-[#1F2C33] rounded-[12px] border border-white/[0.08] shadow-2xl p-6 overflow-hidden"
      >
        <div className="w-12 h-12 rounded-full bg-[#E5484D]/15 text-[#E5484D] flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" strokeWidth={1.75} />
        </div>

        <h3
          id="cancel-dialog-title"
          className="text-[17px] font-semibold text-[#E9EDEF] text-center mb-2"
        >
          Cancel this meeting?
        </h3>

        <p className="text-[13px] text-[#8696A0] text-center leading-relaxed mb-1">
          People who said they are going will see that it was cancelled.
        </p>
        {meetingTitle && (
          <p className="text-[12px] text-[#E9EDEF] font-medium text-center truncate px-2 py-1 bg-[#111B21] rounded mt-2 mb-5">
            "{meetingTitle}"
          </p>
        )}

        <div className="flex items-center justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            className="min-h-[44px] flex-1 px-4 py-2.5 rounded-[8px] text-[13px] font-medium text-[#E9EDEF] bg-white/[0.05] hover:bg-white/[0.08] transition-standard cursor-pointer"
          >
            Keep meeting
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isCancelling}
            className="min-h-[44px] flex-1 px-4 py-2.5 rounded-[8px] text-[13px] font-semibold text-white bg-[#E5484D] hover:bg-[#c93b40] disabled:opacity-50 transition-standard flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Cancel meeting</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
