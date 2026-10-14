import React from 'react';

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
  return (
    <div className="min-h-screen bg-[#0B141A] text-[#E9EDEF] flex flex-col items-center justify-center p-4 antialiased">
      {/* Centered Restrained Card: solid #1F2C33, 12px radius, 1px border rgba(255,255,255,0.08) */}
      <div className="w-full max-w-[420px] bg-[#1F2C33] rounded-[12px] border border-white/[0.08] p-8 flex flex-col">
        {!hideHeader && (
          <div className="flex flex-col items-center text-center">
            {/* Outlined green chat bubble with lock */}
            <div className="w-[52px] h-[52px] flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <svg
                className="w-[52px] h-[52px]"
                viewBox="0 0 56 56"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M28 8C16.954 8 8 16.657 8 27.34c0 3.864 1.154 7.476 3.167 10.536L8.5 48l10.535-2.673A19.82 19.82 0 0028 46.68c11.046 0 20-8.657 20-19.34C48 16.657 39.046 8 28 8z"
                  stroke="#00A884"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <rect
                  x="22"
                  y="24"
                  width="12"
                  height="9.5"
                  rx="1.5"
                  stroke="#00A884"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M25 24v-3.2a3 3 0 016 0V24"
                  stroke="#00A884"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Title: 24px, 700 for main login, 600 for others */}
            <h1
              className={`text-[24px] title-tracking text-[#E9EDEF] mt-4 leading-tight ${
                isMainLogin ? 'font-bold' : 'font-semibold'
              }`}
            >
              {title}
            </h1>

            {/* Subtitle: 13-14px regular #8696A0 */}
            <p className="text-[14px] text-[#8696A0] mt-1 font-normal leading-[1.5]">
              {subtitle}
            </p>
          </div>
        )}

        <div className={`w-full ${!hideHeader ? 'mt-6' : ''}`}>{children}</div>
      </div>
    </div>
  );
};
