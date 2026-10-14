import React, { useState } from 'react';
import { Database, FileText } from 'lucide-react';
import { RetentionPanel } from './RetentionPanel';
import { AuditLog } from './AuditLog';

export const DataRetentionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'retention' | 'audit'>('retention');

  return (
    <div className="space-y-6">
      {/* Header and Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-[24px] font-semibold text-[#E9EDEF] title-tracking">
            Data retention & audit log
          </h2>
          <p className="text-[13px] text-[#8696A0] mt-1 leading-[1.5]">
            Set how long messages and files are kept, and review the system audit log.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 rounded-[10px] bg-[#1F2C33] border border-white/[0.08] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('retention')}
            className={`h-[36px] px-3.5 rounded-[8px] text-[13px] font-medium transition-standard cursor-pointer flex items-center gap-2 ${
              activeTab === 'retention'
                ? 'bg-[#26353D] text-[#E9EDEF] shadow-sm'
                : 'text-[#8696A0] hover:text-[#E9EDEF]'
            }`}
          >
            <Database className="w-4 h-4 text-[#00A884]" strokeWidth={1.75} />
            <span>Retention policy</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`h-[36px] px-3.5 rounded-[8px] text-[13px] font-medium transition-standard cursor-pointer flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'bg-[#26353D] text-[#E9EDEF] shadow-sm'
                : 'text-[#8696A0] hover:text-[#E9EDEF]'
            }`}
          >
            <FileText className="w-4 h-4 text-[#8696A0]" strokeWidth={1.75} />
            <span>Audit log</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'retention' ? <RetentionPanel /> : <AuditLog />}
    </div>
  );
};
