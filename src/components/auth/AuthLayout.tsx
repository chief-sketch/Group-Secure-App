import React, { useState, useEffect, useCallback } from 'react';
import { NetworkBackground } from './NetworkBackground';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onQuickFill?: (email: string, pass: string) => void;
  showDemoHint?: boolean;
  hideHeader?: boolean;
  isMainLogin?: boolean;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title = 'Group Secure App',
  subtitle = 'Secure messaging for your organization',
  hideHeader = false,
  isMainLogin = false,
}) => {
  const reducedMotion = useReducedMotion();
  const [isShaking, setIsShaking] = useState(false);
  const [shouldAnimateEntrance, setShouldAnimateEntrance] = useState(false);

  useEffect(() => {
    if (isMainLogin && !reducedMotion) {
      const alreadyPlayed = sessionStorage.getItem('gsa_login_stagger_played');
      if (!alreadyPlayed) {
        setShouldAnimateEntrance(true);
        sessionStorage.setItem('gsa_login_stagger_played', '1');
      }
    }
  }, [isMainLogin, reducedMotion]);

  const handleFailedLogin = useCallback(() => {
    if (reducedMotion) return;
    setIsShaking(true);
    const timer = setTimeout(() => setIsShaking(false), 300);
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  if (isMainLogin) {
    return (
      <div
        className="min-h-screen min-h-[100dvh] w-full flex items-center justify-center p-4 antialiased pt-safe pb-safe relative overflow-x-hidden overflow-y-auto"
        style={{
          background: 'radial-gradient(circle at center, #12232B 0%, #0B1419 100%)',
        }}
      >
        <NetworkBackground />
        {/* Centered Login Card: max-w 408px, 20px radius, 1px border #2C3B44, solid #17232A, padding 36px 32px 28px, 24px gap */}
        <div
          className={`w-full max-w-[408px] bg-[#17232A] rounded-[20px] border border-[#2C3B44] shadow-2xl p-[36px_32px_28px] relative z-10 flex flex-col gap-6 font-['Montserrat',sans-serif] font-medium text-[#F2F7F9] my-auto ${
            isShaking ? 'card-shake' : ''
          }`}
        >
          {!hideHeader && (
            <div className="flex flex-col items-center text-center">
              {/* Logo icon (chat bubble with a lock, teal #3DDBB4) */}
              <div
                className={`w-[44px] h-[44px] flex items-center justify-center flex-shrink-0 ${
                  shouldAnimateEntrance ? 'animate-login-stagger' : ''
                }`}
                style={shouldAnimateEntrance ? { animationDelay: '0ms' } : undefined}
                aria-hidden="true"
              >
                <svg
                  className="w-[44px] h-[44px]"
                  viewBox="0 0 56 56"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M28 8C16.954 8 8 16.657 8 27.34c0 3.864 1.154 7.476 3.167 10.536L8.5 48l10.535-2.673A19.82 19.82 0 0028 46.68c11.046 0 20-8.657 20-19.34C48 16.657 39.046 8 28 8z"
                    stroke="#3DDBB4"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <rect
                    x="22"
                    y="24"
                    width="12"
                    height="9.5"
                    rx="1.5"
                    stroke="#3DDBB4"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M25 24v-3.2a3 3 0 016 0V24"
                    stroke="#3DDBB4"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Title: 600/700 font weight */}
              <h1
                className={`text-[22px] sm:text-[24px] font-bold text-white mt-3 leading-tight tracking-tight ${
                  shouldAnimateEntrance ? 'animate-login-stagger' : ''
                }`}
                style={shouldAnimateEntrance ? { animationDelay: '40ms' } : undefined}
              >
                {title}
              </h1>

              {/* Subtitle: 14px, #A9BAC4, 500 weight */}
              <p
                className={`text-[14px] text-[#A9BAC4] mt-1.5 font-medium leading-normal ${
                  shouldAnimateEntrance ? 'animate-login-stagger' : ''
                }`}
                style={shouldAnimateEntrance ? { animationDelay: '80ms' } : undefined}
              >
                {subtitle}
              </p>
            </div>
          )}

          <div className="w-full">
            {React.isValidElement(children)
              ? React.cloneElement(children as React.ReactElement<any>, {
                  onFailedLogin: handleFailedLogin,
                  shouldAnimateEntrance,
                })
              : children}
          </div>
        </div>
      </div>
    );
  }

  // Non-login screens (e.g. signup, verifying_keys) preserve their existing layout & behavior
  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#0B141A] text-[#E9EDEF] flex flex-col items-center justify-center p-4 antialiased pt-safe pb-safe">
      <div className="w-full max-w-[420px] bg-[#16232B] rounded-[20px] border border-white/[0.08] shadow-2xl p-7 sm:p-8 flex flex-col">
        {!hideHeader && (
          <div className="flex flex-col items-center text-center">
            <div className="w-[48px] h-[48px] flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <svg
                className="w-[48px] h-[48px]"
                viewBox="0 0 56 56"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M28 8C16.954 8 8 16.657 8 27.34c0 3.864 1.154 7.476 3.167 10.536L8.5 48l10.535-2.673A19.82 19.82 0 0028 46.68c11.046 0 20-8.657 20-19.34C48 16.657 39.046 8 28 8z"
                  stroke="#20E39F"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <rect
                  x="22"
                  y="24"
                  width="12"
                  height="9.5"
                  rx="1.5"
                  stroke="#20E39F"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M25 24v-3.2a3 3 0 016 0V24"
                  stroke="#20E39F"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h1 className="text-[23px] sm:text-[25px] title-tracking text-white mt-3 leading-tight font-semibold">
              {title}
            </h1>

            <p className="text-[13.5px] sm:text-[14px] text-[#8696A0] mt-1 font-normal leading-relaxed">
              {subtitle}
            </p>
          </div>
        )}

        <div className={`w-full ${!hideHeader ? 'mt-5' : ''}`}>{children}</div>
      </div>
    </div>
  );
};
