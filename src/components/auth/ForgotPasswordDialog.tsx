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
        className="w-full max-w-[390px] bg-[#17232A] rounded-[18px] border border-[#2C3B44] shadow-2xl p-6 text-left select-none relative animate-fadeIn outline-none font-['Montserrat',sans-serif] font-medium"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[#8FA2AD] hover:text-[#F2F7F9] hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-11 h-11 rounded-full bg-[#3DDBB4]/15 border border-[#3DDBB4]/30 text-[#3DDBB4] flex items-center justify-center mb-3">
          <KeyRound className="w-5 h-5" strokeWidth={1.75} />
        </div>

        <h3
          id="forgot-password-title"
          className="text-[18px] font-bold text-white title-tracking mb-1"
        >
          Reset your password
        </h3>

        <p className="text-[13px] text-[#A9BAC4] leading-relaxed mb-4 font-medium">
          Enter your organization email and we will send you a secure link to reset your password.
        </p>

        {submittedMessage ? (
          <div className="flex flex-col gap-4">
            <div className="p-3.5 bg-[#3DDBB4]/10 border border-[#3DDBB4]/30 rounded-[12px] text-[13px] text-[#F2F7F9] flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#3DDBB4] flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{submittedMessage}</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full h-[46px] rounded-[12px] bg-[#2EE0B0] hover:bg-[#28CCA0] text-[#042A21] text-[14px] font-bold transition-all cursor-pointer flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#C9D6DD]">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8FA2AD]">
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
                  className="w-full h-[46px] pl-10 pr-3.5 rounded-[12px] bg-[#22323B] border border-[#3A4C57] text-[#F2F7F9] text-[14px] font-medium placeholder-[#8FA2AD] focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] transition-all"
                />
              </div>
              {emailError && (
                <p className="text-[12px] text-[#FF6B6B] pl-1 font-medium">{emailError}</p>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || cooldown > 0}
                className="w-full h-[46px] rounded-[12px] bg-[#2EE0B0] hover:bg-[#28CCA0] disabled:opacity-50 text-[#042A21] text-[14px] font-bold transition-all cursor-pointer flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]"
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
                className="w-full h-[42px] rounded-[12px] bg-transparent hover:bg-white/[0.05] text-[#A9BAC4] hover:text-[#F2F7F9] text-[13px] font-medium transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]"
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
