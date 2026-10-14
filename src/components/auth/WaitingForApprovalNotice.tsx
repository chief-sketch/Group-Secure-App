import React from 'react';
import { Clock, LogOut, ShieldCheck } from 'lucide-react';
import { UserSession } from '../../types';

interface WaitingForApprovalNoticeProps {
  user: UserSession;
  onSignOut: () => void;
}

export const WaitingForApprovalNotice: React.FC<WaitingForApprovalNoticeProps> = ({
  user,
  onSignOut,
}) => {
  return (
    <div className="min-h-screen bg-[#0B141A] text-[#E9EDEF] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] bg-[#1F2C33] rounded-[14px] border border-white/[0.08] shadow-2xl p-6 sm:p-8 text-center select-none animate-fadeIn">
        <div className="w-14 h-14 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7" strokeWidth={1.75} />
        </div>

        <h1 className="text-[20px] font-semibold text-[#E9EDEF] title-tracking mb-2 leading-snug">
          Waiting for approval
        </h1>

        <p className="text-[13px] text-[#8696A0] mb-5 leading-relaxed">
          Your account is pending administrator approval. An administrator must approve your registration and assign your channels before you can access the app.
        </p>

        {/* User Summary Box */}
        <div className="w-full bg-[#2A3942] border border-white/[0.08] rounded-[10px] p-4 text-left mb-6 text-[13px] space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-[#8696A0]">Name</span>
            <span className="text-[#E9EDEF] font-medium">{user.fullName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8696A0]">Email</span>
            <span className="text-[#E9EDEF] font-mono text-[12px]">{user.email}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8696A0]">Department</span>
            <span className="text-[#E9EDEF]">{user.department}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-white/[0.06]">
            <span className="text-[#8696A0]">Account Status</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F59E0B]/10 text-[#F59E0B]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
              Pending Admin Approval
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onSignOut}
            className="w-full h-[44px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[14px] font-medium transition-standard cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4 text-[#8696A0]" />
            <span>Sign out</span>
          </button>
        </div>

        <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-center gap-1.5 text-[#8696A0] text-[12px]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00A884]" />
          <span>Access opens automatically once approved</span>
        </div>
      </div>
    </div>
  );
};
