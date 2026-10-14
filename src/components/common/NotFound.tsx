import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface NotFoundProps {
  onBackToLogin: () => void;
}

export const NotFound: React.FC<NotFoundProps> = ({ onBackToLogin }) => {
  return (
    <div className="min-h-screen bg-[#0B141A] text-[#E9EDEF] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] rounded-[12px] bg-[#1F2C33] border border-white/[0.08] p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[#E5484D]/15 border border-[#E5484D]/30 text-[#E5484D] flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" strokeWidth={1.75} />
        </div>

        <h1 className="text-[24px] font-semibold text-[#E9EDEF] title-tracking mb-2">
          Page not found
        </h1>

        <p className="text-[14px] text-[#8696A0] leading-relaxed mb-6">
          The requested path does not exist in this secure organization workspace or may have been decommissioned.
        </p>

        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full h-[44px] rounded-[10px] bg-[#00A884] hover:bg-[#008F72] text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-standard cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          <span>Return to login</span>
        </button>
      </div>
    </div>
  );
};
