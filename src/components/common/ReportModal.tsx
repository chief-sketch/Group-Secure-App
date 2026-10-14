import React, { useState, useRef } from 'react';
import { Flag, X, AlertCircle } from 'lucide-react';
import { submitReportToFirestore } from '../../lib/firebaseService';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface ReportTarget {
  type: 'message' | 'app';
  conversationType?: 'channel' | 'direct';
  conversationId?: string;
  messageId?: string;
}

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ReportTarget | null;
  reporterId: string;
  reporterName: string;
  onSuccessToast: (msg: string) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  target,
  reporterId,
  reporterName,
  onSuccessToast,
}) => {
  const isMessageReport = target?.type === 'message';

  const [messageReason, setMessageReason] = useState<'Spam or abuse' | 'Inappropriate content' | 'Other'>('Spam or abuse');
  const [appCategory, setAppCategory] = useState<'Bug' | 'Suggestion' | 'Other'>('Bug');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, isOpen, {
    onEscape: () => {
      if (!isSubmitting) onClose();
    },
  });

  if (!isOpen || !target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (isMessageReport) {
        await submitReportToFirestore({
          reporterId,
          reporterName,
          conversationType: target.conversationType || 'channel',
          conversationId: target.conversationId,
          messageId: target.messageId,
          reason: messageReason,
          note: note.trim().slice(0, 500),
        });
      } else {
        await submitReportToFirestore({
          reporterId,
          reporterName,
          conversationType: 'app',
          reason: appCategory,
          note: note.trim().slice(0, 500),
        });
      }

      onSuccessToast('Report sent to the administrators');
      setNote('');
      onClose();
    } catch (err: any) {
      console.error('Error submitting report:', err);
      setError(err?.message || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm transition-standard"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-[440px] bg-[#1F2C33] rounded-[12px] border border-white/[0.08] shadow-2xl p-6 text-left select-none animate-fadeIn outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#E5484D]/15 border border-[#E5484D]/30 text-[#E5484D] flex items-center justify-center">
              <Flag className="w-4 h-4" />
            </div>
            <h2 id="report-modal-title" className="text-[17px] font-semibold text-[#E9EDEF]">
              {isMessageReport ? 'Report message' : 'Report a problem'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-[#8696A0] hover:text-[#E9EDEF] p-1.5 rounded-lg cursor-pointer transition-standard"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#E5484D]/15 border border-[#E5484D]/30 rounded-[8px] text-[13px] text-[#E5484D] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isMessageReport ? (
            <div>
              <label className="block text-[13px] text-[#8696A0] font-medium mb-1.5">
                Reason
              </label>
              <select
                value={messageReason}
                onChange={(e) => setMessageReason(e.target.value as any)}
                className="w-full h-[40px] px-3 rounded-[8px] bg-[#2A3942] border border-white/[0.08] text-[#E9EDEF] text-[13px] focus:outline-none focus:border-[#00A884] cursor-pointer"
              >
                <option value="Spam or abuse">Spam or abuse</option>
                <option value="Inappropriate content">Inappropriate content</option>
                <option value="Other">Other</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[13px] text-[#8696A0] font-medium mb-1.5">
                Category
              </label>
              <select
                value={appCategory}
                onChange={(e) => setAppCategory(e.target.value as any)}
                className="w-full h-[40px] px-3 rounded-[8px] bg-[#2A3942] border border-white/[0.08] text-[#E9EDEF] text-[13px] focus:outline-none focus:border-[#00A884] cursor-pointer"
              >
                <option value="Bug">Bug</option>
                <option value="Suggestion">Suggestion</option>
                <option value="Other">Other</option>
              </select>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[13px] text-[#8696A0] font-medium">
                {isMessageReport ? 'Optional note' : 'Description'}
              </label>
              <span className="text-[11px] text-[#8696A0] tabular-nums">
                {note.length}/500
              </span>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              required={!isMessageReport}
              placeholder={
                isMessageReport
                  ? 'Add context for the administrator (optional)...'
                  : 'Describe what happened or your suggestion...'
              }
              rows={3}
              className="w-full px-3 py-2 rounded-[8px] bg-[#2A3942] border border-white/[0.08] text-[#E9EDEF] placeholder-[#8696A0] text-[13px] focus:outline-none focus:border-[#00A884] resize-none"
            />
          </div>

          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-[38px] px-4 rounded-[8px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[13px] font-medium transition-standard cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!isMessageReport && !note.trim())}
              className="h-[38px] px-4 rounded-[8px] bg-[#E5484D] hover:bg-[#c93b40] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-standard cursor-pointer flex items-center gap-2"
            >
              {isSubmitting ? 'Sending...' : 'Send report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
