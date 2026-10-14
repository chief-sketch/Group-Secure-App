import React, { useState, useEffect, useRef } from 'react';
import { Clock, Send, X, Loader2, CheckCircle2 } from 'lucide-react';
import {
  createHistoryRequestInFirestore,
  getHistoryRequest,
} from '../../lib/firebaseService';
import { HistoryRequest } from '../../types';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface RequestHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  userName: string;
  channelId: string;
  channelName: string;
  onSuccessToast: (message: string) => void;
}

export const RequestHistoryDialog: React.FC<RequestHistoryDialogProps> = ({
  isOpen,
  onClose,
  uid,
  userName,
  channelId,
  channelName,
  onSuccessToast,
}) => {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  const [existingRequest, setExistingRequest] = useState<HistoryRequest | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, isOpen, { onEscape: onClose });

  useEffect(() => {
    if (!isOpen) return;
    setNote('');
    setIsLoadingExisting(true);
    getHistoryRequest(uid, channelId)
      .then((req) => {
        setExistingRequest(req);
      })
      .catch(() => {
        setExistingRequest(null);
      })
      .finally(() => {
        setIsLoadingExisting(false);
      });
  }, [isOpen, uid, channelId]);

  if (!isOpen) return null;

  const hasOpenRequest = existingRequest?.status === 'open';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasOpenRequest || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createHistoryRequestInFirestore(uid, userName, channelId, note);
      onSuccessToast('Request sent to the administrators');
      onClose();
    } catch {
      // Handled in service
    } finally {
      setIsSubmitting(false);
    }
  };

  const cleanChannelName = channelName.replace(/^#\s*/, '');

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-standard animate-in fade-in duration-150"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-[420px] bg-[#1F2C33] rounded-[12px] border border-white/[0.08] shadow-2xl p-6 select-none relative outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-full text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.06] transition-standard cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>

        {/* Icon & Title */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-[10px] bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-[17px] font-semibold text-[#E9EDEF] title-tracking">
              Request earlier history
            </h3>
            <p className="text-[12px] text-[#00A884] font-medium">
              {cleanChannelName}
            </p>
          </div>
        </div>

        {/* Explanation */}
        <p className="text-[13px] text-[#8696A0] leading-relaxed mb-4">
          An administrator decides whether you can read messages sent before you joined.
        </p>

        {isLoadingExisting ? (
          <div className="py-8 flex items-center justify-center text-[#8696A0]">
            <Loader2 className="w-5 h-5 animate-spin text-[#00A884]" />
          </div>
        ) : hasOpenRequest ? (
          /* Request already open notice */
          <div className="space-y-4">
            <div className="p-3.5 rounded-[10px] bg-[#00A884]/10 border border-[#00A884]/30 text-[#E9EDEF] flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#00A884] flex-shrink-0" strokeWidth={1.75} />
              <p className="text-[13px] font-medium">
                Request sent. An administrator will review it.
              </p>
            </div>
            {existingRequest?.note && (
              <div className="p-3 bg-[#111B21] rounded-[8px] border border-white/[0.04]">
                <span className="text-[11px] text-[#8696A0] uppercase font-mono block mb-1">
                  Your note
                </span>
                <p className="text-[12px] text-[#E9EDEF] italic">
                  "{existingRequest.note}"
                </p>
              </div>
            )}
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full h-[40px] rounded-[8px] bg-white/[0.08] hover:bg-white/[0.12] text-[#E9EDEF] text-[13px] font-medium transition-standard cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* Submission form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12px] font-medium text-[#8696A0]">
                  Optional note for administrators:
                </label>
                <span className="text-[11px] text-[#8696A0] tabular-nums">
                  {note.length}/200
                </span>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                rows={3}
                placeholder="Reason or context for needing past messages..."
                className="w-full bg-[#111B21] border border-white/[0.08] rounded-[8px] p-3 text-[13px] text-[#E9EDEF] placeholder-[#8696A0]/75 focus:outline-none focus:border-[#00A884] transition-colors resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                className="h-[40px] px-4 rounded-[8px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#8696A0] hover:text-[#E9EDEF] text-[13px] font-medium transition-standard cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-[40px] px-5 rounded-[8px] bg-[#00A884] hover:bg-[#008F72] text-white text-[13px] font-medium flex items-center gap-2 transition-standard cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" strokeWidth={2} />
                )}
                <span>Send request</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
