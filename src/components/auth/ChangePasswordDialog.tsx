import React, { useState, useRef } from 'react';
import { Lock, Eye, EyeOff, Loader2, X, AlertCircle } from 'lucide-react';
import { changeStaffPassword } from '../../lib/firebaseService';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ChangePasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, isOpen, {
    onEscape: () => {
      if (!isSubmitting) onClose();
    },
  });

  if (!isOpen) return null;

  // Live checklist criteria: at least 8 characters, a letter, a number
  const hasLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isValidNewPassword = hasLength && hasLetter && hasNumber;
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentPassword) {
      setErrorMessage('Please enter your current password.');
      return;
    }
    if (!isValidNewPassword) {
      setErrorMessage('Please meet all password requirements before saving.');
      return;
    }
    if (!passwordsMatch) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await changeStaffPassword(currentPassword, newPassword);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not update password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-standard"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-[420px] bg-[#1F2C33] rounded-[14px] border border-white/[0.08] shadow-2xl p-6 text-left select-none relative animate-fadeIn outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.05] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-11 h-11 rounded-full bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center mb-3">
          <Lock className="w-5 h-5" strokeWidth={1.75} />
        </div>

        <h3
          id="change-password-title"
          className="text-[18px] font-semibold text-[#E9EDEF] title-tracking mb-1"
        >
          Change password
        </h3>

        <p className="text-[13px] text-[#8696A0] leading-relaxed mb-4">
          Enter your current password followed by your new password.
        </p>

        {errorMessage && (
          <div className="p-3 bg-[#E5484D]/10 border border-[#E5484D]/30 rounded-[10px] text-[13px] text-[#E5484D] flex items-start gap-2 mb-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Current Password */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-[#8696A0]">
              Current password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter current password"
                className="w-full h-[42px] px-3.5 pr-10 rounded-[10px] bg-[#2A3942] border border-white/[0.08] text-[#E9EDEF] text-[13px] placeholder-[#8696A0]/75 focus:outline-none focus:border-[#00A884] transition-standard"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8696A0] hover:text-[#00A884] transition-colors cursor-pointer"
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-[#8696A0]">
              New password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter new password"
                className="w-full h-[42px] px-3.5 pr-10 rounded-[10px] bg-[#2A3942] border border-white/[0.08] text-[#E9EDEF] text-[13px] placeholder-[#8696A0]/75 focus:outline-none focus:border-[#00A884] transition-standard"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8696A0] hover:text-[#00A884] transition-colors cursor-pointer"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Live checklist: at least 8 characters, a letter, a number */}
            <div className="flex flex-col gap-1 text-[12px] text-[#8696A0] mt-1 pl-1">
              <div className={`flex items-center gap-1.5 ${hasLength ? 'text-[#00A884]' : 'text-[#8696A0]'}`}>
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${hasLength ? 'bg-[#00A884]/20 text-[#00A884]' : 'bg-white/10 text-transparent'}`}>✓</span>
                <span>At least 8 characters</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasLetter ? 'text-[#00A884]' : 'text-[#8696A0]'}`}>
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${hasLetter ? 'bg-[#00A884]/20 text-[#00A884]' : 'bg-white/10 text-transparent'}`}>✓</span>
                <span>At least one letter</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-[#00A884]' : 'text-[#8696A0]'}`}>
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${hasNumber ? 'bg-[#00A884]/20 text-[#00A884]' : 'bg-white/10 text-transparent'}`}>✓</span>
                <span>At least one number</span>
              </div>
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-[#8696A0]">
              Confirm new password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Re-enter new password"
                className="w-full h-[42px] px-3.5 pr-10 rounded-[10px] bg-[#2A3942] border border-white/[0.08] text-[#E9EDEF] text-[13px] placeholder-[#8696A0]/75 focus:outline-none focus:border-[#00A884] transition-standard"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8696A0] hover:text-[#00A884] transition-colors cursor-pointer"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-[12px] text-[#E5484D] pl-1">Passwords do not match</p>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !isValidNewPassword || !passwordsMatch}
              className="w-full h-[44px] rounded-[10px] bg-[#00A884] hover:bg-[#008F72] disabled:opacity-50 text-white text-[14px] font-medium transition-standard cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating password...</span>
                </>
              ) : (
                <span>Save new password</span>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full h-[40px] rounded-[10px] bg-transparent hover:bg-white/[0.05] text-[#8696A0] hover:text-[#E9EDEF] text-[13px] font-medium transition-standard cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
