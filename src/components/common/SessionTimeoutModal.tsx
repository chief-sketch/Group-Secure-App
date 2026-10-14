import React, { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export type SessionTimeoutType = 'idle' | 'max_session';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  type: SessionTimeoutType;
  secondsRemaining: number;
  onStaySignedIn: () => void;
  onSignOut: () => void;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  isOpen,
  type,
  secondsRemaining,
  onStaySignedIn,
  onSignOut,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const secondaryButtonRef = useRef<HTMLButtonElement>(null);
  const [srAnnouncement, setSrAnnouncement] = useState('');

  useFocusTrap(dialogRef, isOpen, { isDismissible: false });

  // Announce countdown to screen readers every 10 seconds
  useEffect(() => {
    if (!isOpen || type !== 'idle') return;
    if (secondsRemaining > 0 && secondsRemaining % 10 === 0) {
      setSrAnnouncement(
        `For your security you'll be signed out in ${secondsRemaining} seconds because of inactivity.`
      );
    }
  }, [isOpen, type, secondsRemaining]);

  if (!isOpen) return null;

  const isIdle = type === 'idle';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      aria-describedby="session-timeout-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-standard"
    >
      {/* Screen reader live region for 10-second interval announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {srAnnouncement}
      </div>

      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-[380px] bg-[#1F2C33] rounded-[12px] border border-white/[0.08] shadow-xl p-6 text-center select-none outline-none"
      >
        {/* Clock icon in matching circular badge */}
        <div className="w-11 h-11 rounded-full bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center mx-auto mb-4">
          <Clock className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
        </div>

        <h3
          id="session-timeout-title"
          className="text-[18px] font-semibold text-[#E9EDEF] title-tracking mb-2 leading-tight"
        >
          {isIdle ? 'Still there?' : 'Session expired'}
        </h3>

        <p
          id="session-timeout-desc"
          className="text-[13px] text-[#8696A0] leading-relaxed mb-6"
        >
          {isIdle ? (
            <>
              For your security you&apos;ll be signed out in{' '}
              <span className="text-white font-semibold tabular-nums">
                {secondsRemaining}
              </span>{' '}
              seconds because of inactivity.
            </>
          ) : (
            'For your security, please sign in again.'
          )}
        </p>

        {isIdle ? (
          <div className="flex flex-col gap-2.5">
            <button
              ref={primaryButtonRef}
              type="button"
              onClick={onStaySignedIn}
              className="w-full h-[44px] rounded-[10px] bg-[#00A884] hover:bg-[#008f72] text-white text-[14px] font-medium transition-standard cursor-pointer flex items-center justify-center shadow-sm"
            >
              Stay signed in
            </button>
            <button
              ref={secondaryButtonRef}
              type="button"
              onClick={onSignOut}
              className="w-full h-[44px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[14px] font-medium transition-standard cursor-pointer flex items-center justify-center"
            >
              Sign out now
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            <button
              ref={primaryButtonRef}
              type="button"
              onClick={onSignOut}
              className="w-full h-[44px] rounded-[10px] bg-[#00A884] hover:bg-[#008f72] text-white text-[14px] font-medium transition-standard cursor-pointer flex items-center justify-center shadow-sm"
            >
              Sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
