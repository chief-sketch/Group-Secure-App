import React, { useState, useEffect, useRef } from 'react';
import { Mail, KeyRound, Loader2, X, CheckCircle2 } from 'lucide-react';
import { sendStaffPasswordResetEmail } from '../../lib/firebaseService';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ForgotPasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export const ForgotPasswordDialog: React.FC<ForgotPasswordDialogProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, isOpen, { onEscape: onClose });

  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail);
      setEmailError(null);
      setSubmittedMessage(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialEmail]);

  // 60-second cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Please enter your email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setEmailError(null);
    setIsSubmitting(true);

    try {
      await sendStaffPasswordResetEmail(trimmed);
    } catch (err) {
      console.warn('Password reset request error:', err);
    } finally {
      setIsSubmitting(false);
      setCooldown(60);
      setSubmittedMessage(
        "If an account exists for that email, we've sent a reset link."
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-standard"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-[390px] bg-[#1F2C33] rounded-[14px] border border-white/[0.08] shadow-2xl p-6 text-left select-none relative animate-fadeIn outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.05] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-11 h-11 rounded-full bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center mb-3">
          <KeyRound className="w-5 h-5" strokeWidth={1.75} />
        </div>

        <h3
          id="forgot-password-title"
          className="text-[18px] font-semibold text-[#E9EDEF] title-tracking mb-1"
        >
          Reset your password
        </h3>

        <p className="text-[13px] text-[#8696A0] leading-relaxed mb-4">
          Enter your organization email and we will send you a secure link to reset your password.
        </p>

        {submittedMessage ? (
          <div className="flex flex-col gap-4">
            <div className="p-3.5 bg-[#00A884]/10 border border-[#00A884]/30 rounded-[10px] text-[13px] text-[#E9EDEF] flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#00A884] flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{submittedMessage}</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full h-[44px] rounded-[10px] bg-[#00A884] hover:bg-[#008F72] text-white text-[14px] font-medium transition-standard cursor-pointer flex items-center justify-center"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-[#8696A0]">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8696A0]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  ref={inputRef}
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="name@organization.com"
                  className="w-full h-[42px] pl-10 pr-3.5 rounded-[10px] bg-[#2A3942] border border-white/[0.08] text-[#E9EDEF] text-[13px] placeholder-[#8696A0]/75 focus:outline-none focus:border-[#00A884] transition-standard"
                />
              </div>
              {emailError && (
                <p className="text-[12px] text-[#E5484D] pl-1">{emailError}</p>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="submit"
                disabled={isSubmitting || cooldown > 0}
                className="w-full h-[44px] rounded-[10px] bg-[#00A884] hover:bg-[#008F72] disabled:opacity-50 text-white text-[14px] font-medium transition-standard cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending link...</span>
                  </>
                ) : cooldown > 0 ? (
                  <span>Send reset link ({cooldown}s)</span>
                ) : (
                  <span>Send reset link</span>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full h-[40px] rounded-[10px] bg-transparent hover:bg-white/[0.05] text-[#8696A0] hover:text-[#E9EDEF] text-[13px] font-medium transition-standard cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
