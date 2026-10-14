import React, { useEffect } from 'react';
import { Calendar, X, ArrowRight } from 'lucide-react';
import { MeetingReminderToastData } from '../../types';

interface MeetingReminderToastProps {
  reminder: MeetingReminderToastData | null;
  onClose: () => void;
  onOpen: () => void;
}

export const MeetingReminderToast: React.FC<MeetingReminderToastProps> = ({
  reminder,
  onClose,
  onOpen,
}) => {
  // Auto-dismiss after 10 seconds if not clicked
  useEffect(() => {
    if (!reminder) return;
    const timer = setTimeout(() => {
      onClose();
    }, 10000);
    return () => clearTimeout(timer);
  }, [reminder, onClose]);

  if (!reminder) return null;

  const timingText =
    reminder.timing === '15' ? 'starts in 15 minutes' : 'starts now';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:bottom-auto sm:top-6 sm:right-6 sm:left-auto sm:translate-x-0 z-50 w-[380px] max-w-[92vw] bg-[#1F2C33] border border-[#00A884] rounded-[10px] shadow-2xl p-3.5 flex items-start gap-3 select-none animate-fadeIn"
    >
      <div className="w-10 h-10 rounded-full bg-[#00A884]/20 text-[#00A884] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Calendar className="w-5 h-5" strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <span className="text-[14px] font-semibold text-[#E9EDEF] truncate leading-tight">
            {reminder.title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8696A0] hover:text-[#E9EDEF] p-0.5 transition-standard -mr-1 rounded cursor-pointer"
            aria-label="Dismiss reminder"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <p className="text-[12px] text-[#00A884] font-medium truncate mb-1">
          {reminder.conversationName} • <span className="text-[#E9EDEF]">{timingText}</span>
        </p>

        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={() => {
              onOpen();
              onClose();
            }}
            className="min-h-[36px] px-3 py-1 bg-[#00A884] hover:bg-[#008f6f] text-white rounded-[6px] text-[12px] font-semibold flex items-center gap-1.5 transition-standard cursor-pointer shadow-sm"
          >
            <span>Open</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
