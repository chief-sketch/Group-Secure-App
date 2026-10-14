import React, { useState, useRef } from 'react';
import { Shield, X, Lock } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface PrivacyNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isReadOnly?: boolean;
  onAccept?: () => Promise<void> | void;
}

export const PrivacyNoticeModal: React.FC<PrivacyNoticeModalProps> = ({
  isOpen,
  onClose,
  isReadOnly = false,
  onAccept,
}) => {
  const [understood, setUnderstood] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, isOpen, {
    isDismissible: isReadOnly,
    onEscape: isReadOnly ? onClose : undefined,
  });

  if (!isOpen) return null;

  const handleContinue = async () => {
    if (!understood || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (onAccept) {
        await onAccept();
      }
      onClose();
    } catch (err) {
      console.error('Error accepting privacy notice:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If read-only mode (opened from menu), show as dialog
  if (isReadOnly) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-notice-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm transition-standard"
      >
        <div
          ref={dialogRef}
          tabIndex={-1}
          className="w-full max-w-[460px] bg-[#1F2C33] rounded-[12px] border border-white/[0.08] shadow-2xl p-6 text-left select-none animate-fadeIn outline-none"
        >
          <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06] mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <h2 id="privacy-notice-title" className="text-[17px] font-semibold text-[#E9EDEF]">
                Privacy Notice
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#8696A0] hover:text-[#E9EDEF] p-1.5 rounded-lg cursor-pointer transition-standard"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 mb-6 text-[13px] text-[#D1D7DB] leading-relaxed">
            <div className="flex items-start gap-2.5">
              <span className="text-[#00A884] font-bold">•</span>
              <span>Administrators can remove channel messages that break the rules (for example, content unrelated to office work). Removals are logged.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-[#00A884] font-bold">•</span>
              <span>Direct messages are visible only to the two people in the chat.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-[#00A884] font-bold">•</span>
              <span>The system owner can access stored data for administration and testing.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-[#00A884] font-bold">•</span>
              <span>Messages are protected in transit and at rest, but not end-to-end encrypted.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-[#00A884] font-bold">•</span>
              <span>Your name and profile picture are visible to other members.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-[#00A884] font-bold">•</span>
              <span>This is a prototype. Do not share anything private or confidential.</span>
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-[40px] px-5 rounded-[10px] bg-[#00A884] hover:bg-[#008F72] text-white text-[13px] font-medium transition-standard cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full-page notice mode (shown once after first approved sign-in)
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B141A] text-[#E9EDEF] overflow-y-auto"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-[480px] bg-[#1F2C33] rounded-[14px] border border-white/[0.08] shadow-2xl p-6 sm:p-8 text-left outline-none"
      >
        <div className="w-12 h-12 rounded-full bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center mb-4">
          <Shield className="w-6 h-6" />
        </div>

        <h1 className="text-[20px] font-semibold text-[#E9EDEF] title-tracking mb-2">
          Before you start
        </h1>

        <p className="text-[13px] text-[#8696A0] mb-5">
          Please review the following security and privacy notices for this organization workspace:
        </p>

        <ul className="space-y-3.5 mb-6 text-[13px] text-[#D1D7DB] bg-[#111B21]/60 p-4 rounded-[10px] border border-white/[0.04] leading-relaxed">
          <li className="flex items-start gap-2.5">
            <span className="text-[#00A884] font-bold">•</span>
            <span>Administrators can remove channel messages that break the rules (for example, content unrelated to office work). Removals are logged.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-[#00A884] font-bold">•</span>
            <span>Direct messages are visible only to the two people in the chat.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-[#00A884] font-bold">•</span>
            <span>The system owner can access stored data for administration and testing.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-[#00A884] font-bold">•</span>
            <span>Messages are protected in transit and at rest, but not end-to-end encrypted.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-[#00A884] font-bold">•</span>
            <span>Your name and profile picture are visible to other members.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-[#00A884] font-bold">•</span>
            <span>This is a prototype. Do not share anything private or confidential.</span>
          </li>
        </ul>

        {/* Required Checkbox */}
        <label className="flex items-center gap-3 mb-6 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 text-[#00A884] bg-[#2A3942] accent-[#00A884] cursor-pointer flex-shrink-0"
          />
          <span className="text-[14px] text-[#E9EDEF] font-medium">
            I understand
          </span>
        </label>

        <button
          type="button"
          disabled={!understood || isSubmitting}
          onClick={handleContinue}
          className="w-full h-[44px] rounded-[10px] bg-[#00A884] hover:bg-[#008F72] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-standard cursor-pointer shadow-sm"
        >
          {isSubmitting ? 'Saving...' : 'Continue'}
        </button>

        <div className="w-full mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-center gap-1.5 text-[#8696A0] text-[12px]">
          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Secure messaging with role-based access control</span>
        </div>
      </div>
    </div>
  );
};
