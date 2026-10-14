import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Loader2, LogOut, AlertCircle, CheckCircle2 } from 'lucide-react';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../../lib/firebase';

interface VerifyEmailNoticeProps {
  email: string;
  onVerified: () => void;
  onSignOut: () => void;
}

export const VerifyEmailNotice: React.FC<VerifyEmailNoticeProps> = ({
  email,
  onVerified,
  onSignOut,
}) => {
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // 60-second cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Check email verification status:
  // "Every 5 seconds, and when the tab becomes visible again, call user.reload().
  // When emailVerified becomes true, call getIdToken(true) to refresh the token,
  // then move on automatically to the existing 'Waiting for approval' screen (or to the chat if already approved)."
  const checkVerification = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await user.reload();
      if (user.emailVerified) {
        await user.getIdToken(true);
        onVerified();
      }
    } catch (err) {
      console.warn('user.reload error:', err);
    }
  }, [onVerified]);

  useEffect(() => {
    // Immediate check
    checkVerification();

    const interval = setInterval(checkVerification, 5000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkVerification();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkVerification]);

  const handleResend = async () => {
    if (resendCooldown > 0 || isSending) return;
    const user = auth.currentUser;
    if (!user) return;

    setIsSending(true);
    setErrorMessage(null);
    setResendStatus(null);

    try {
      await sendEmailVerification(user);
      setResendCooldown(60);
      setResendStatus('Verification link sent. Please check your inbox.');
    } catch (err: any) {
      console.warn('sendEmailVerification error:', err?.code, err?.message);
      if (err?.code === 'auth/too-many-requests') {
        setErrorMessage(
          'Please wait a few minutes before asking for another email.'
        );
      } else {
        setErrorMessage('Could not send the verification email. Try again.');
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B141A] text-[#E9EDEF] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] bg-[#1F2C33] rounded-[14px] border border-white/[0.08] shadow-2xl p-6 sm:p-8 text-center select-none animate-fadeIn">
        {/* Outlined Mail Icon */}
        <div className="w-14 h-14 rounded-full bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center mx-auto mb-4">
          <Mail className="w-7 h-7" strokeWidth={1.75} />
        </div>

        <h1 className="text-[20px] font-semibold text-[#E9EDEF] title-tracking mb-2 leading-snug">
          Verify your email
        </h1>

        <p className="text-[13px] text-[#8696A0] mb-5 leading-relaxed">
          We sent a link to <span className="text-[#E9EDEF] font-medium">{email}</span>. Open it, then come back here. Check your spam folder too.
        </p>

        {errorMessage && (
          <div className="p-3 bg-[#E5484D]/10 border border-[#E5484D]/30 rounded-[10px] text-[13px] text-[#E5484D] flex items-start gap-2 text-left mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {resendStatus && (
          <div className="p-3 bg-[#00A884]/10 border border-[#00A884]/30 rounded-[10px] text-[13px] text-[#E9EDEF] flex items-start gap-2 text-left mb-4">
            <CheckCircle2 className="w-4 h-4 text-[#00A884] flex-shrink-0 mt-0.5" />
            <span>{resendStatus}</span>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || isSending}
            className="w-full h-[46px] rounded-[10px] bg-[#00A884] hover:bg-[#008F72] disabled:opacity-50 text-white text-[14px] font-semibold transition-standard cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending email...</span>
              </>
            ) : resendCooldown > 0 ? (
              <span>Resend email ({resendCooldown}s)</span>
            ) : (
              <span>Resend email</span>
            )}
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full h-[44px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[14px] font-medium transition-standard cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4 text-[#8696A0]" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
