import React, { useState, useRef, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export const REMOVAL_REASONS = [
  'Not related to office work',
  'Abusive or harassing',
  'Spam',
  'Confidential or sensitive information',
  'Other',
] as const;

export type RemovalReason = (typeof REMOVAL_REASONS)[number];

interface RemoveMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, note: string) => Promise<void> | void;
  isRemoving?: boolean;
}

export const RemoveMessageDialog: React.FC<RemoveMessageDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isRemoving = false,
}) => {
  const [reason, setReason] = useState<string>(REMOVAL_REASONS[0]);
  const [note, setNote] = useState<string>('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, isOpen, {
    onEscape: () => {
      if (!isRemoving) onClose();
    },
  });

  useEffect(() => {
    if (isOpen) {
      setReason(REMOVAL_REASONS[0]);
      setNote('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || isRemoving) return;
    onConfirm(reason, note.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-msg-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isRemoving) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-standard animate-fadeIn"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-[420px] bg-[#1F2C33] rounded-[12px] border border-white/[0.08] shadow-2xl p-6 text-left select-none outline-none"
      >
        <div className="w-11 h-11 rounded-full bg-[#E5484D]/15 border border-[#E5484D]/30 text-[#E5484D] flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-5 h-5" strokeWidth={1.75} />
        </div>

        <h3
          id="remove-msg-title"
          className="text-[17px] font-semibold text-[#E9EDEF] title-tracking text-center mb-2 leading-tight"
        >
          Remove this message?
        </h3>

        <p className="text-[13px] text-[#8696A0] leading-relaxed mb-5 text-center">
          It will be replaced with a notice for everyone in the channel. The message text is not kept in the audit log.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Required Reason Dropdown */}
          <div>
            <label
              htmlFor="removal-reason-select"
              className="block text-[12px] font-medium text-[#8696A0] uppercase tracking-wider mb-1.5"
            >
              Reason <span className="text-[#E5484D]">*</span>
            </label>
            <select
              id="removal-reason-select"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isRemoving}
              required
              className="w-full h-[40px] px-3 rounded-[8px] bg-[#111B21] text-[#E9EDEF] border border-white/[0.08] focus:border-[#00A884] focus:outline-none text-[13px] cursor-pointer transition-standard"
            >
              {REMOVAL_REASONS.map((r) => (
                <option key={r} value={r} className="bg-[#1F2C33]">
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Optional Note (max 200 characters) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="removal-note-input"
                className="text-[12px] font-medium text-[#8696A0] uppercase tracking-wider"
              >
                Administrative note (optional)
              </label>
              <span className="text-[11px] text-[#8696A0] font-mono tabular-nums">
                {note.length}/200
              </span>
            </div>
            <textarea
              id="removal-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              disabled={isRemoving}
              maxLength={200}
              rows={3}
              placeholder="Internal record only; never shown to members..."
              className="w-full bg-[#111B21] border border-white/[0.08] rounded-[8px] p-3 text-[13px] text-[#E9EDEF] placeholder-[#8696A0]/60 focus:outline-none focus:border-[#00A884] transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isRemoving}
              className="flex-1 px-4 py-2.5 rounded-[8px] bg-transparent hover:bg-white/[0.05] border border-white/[0.08] text-[13px] font-medium text-[#E9EDEF] transition-standard cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRemoving || !reason}
              className="flex-1 px-4 py-2.5 rounded-[8px] bg-[#E5484D] hover:bg-[#D93D42] text-[13px] font-medium text-white transition-standard cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
            >
              {isRemoving ? 'Removing...' : 'Remove message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
