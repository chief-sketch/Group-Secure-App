import React from 'react';
import { UserX, LogOut } from 'lucide-react';

interface SuspendedNoticeProps {
  onSignOut: () => void;
}

export const SuspendedNotice: React.FC<SuspendedNoticeProps> = ({ onSignOut }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B141A] text-[#E9EDEF]">
      <div className="w-full max-w-[420px] bg-[#1F2C33] rounded-[14px] border border-white/[0.08] shadow-2xl p-6 sm:p-8 text-center select-none animate-fadeIn">
        <div className="w-12 h-12 rounded-full bg-[#E5484D]/15 border border-[#E5484D]/30 text-[#E5484D] flex items-center justify-center mx-auto mb-4">
          <UserX className="w-6 h-6" strokeWidth={1.75} />
        </div>

        <h1 className="text-[19px] font-semibold text-[#E9EDEF] title-tracking mb-2 leading-snug">
          Your account has been suspended. Contact your administrator.
        </h1>

        <p className="text-[13px] text-[#8696A0] mb-6 leading-relaxed">
          Access to organization messages, channels, and member directories is restricted while this account is suspended. If this was done in error, reach out to your administrator to reactivate your profile.
        </p>

        <button
          type="button"
          onClick={onSignOut}
          className="w-full h-[44px] rounded-[10px] bg-[#2A3942] hover:bg-[#32444f] border border-white/[0.08] text-[#E9EDEF] hover:text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-standard cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-[#8696A0]" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
};
