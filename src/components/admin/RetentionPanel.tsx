import React, { useState, useEffect } from 'react';
import { Clock, Check, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ChannelRetentionPolicy } from '../../types';
import { displayChannelName } from '../../lib/channelAvatars';

export const RetentionPanel: React.FC = () => {
  const {
    retentionPolicies,
    saveRetentionPolicies,
  } = useApp();

  const [policies, setPolicies] = useState<ChannelRetentionPolicy[]>(retentionPolicies);

  useEffect(() => {
    setPolicies(retentionPolicies);
  }, [retentionPolicies]);

  const messageExpiryOptions = ['Never', '7 days', '30 days', '90 days', '1 year'];
  const fileExpiryOptions = ['Never', '7 days', '30 days', '90 days'];

  const handleMessageExpiryChange = (channelName: string, value: string) => {
    setPolicies((prev) =>
      prev.map((p) => (p.channelName === channelName ? { ...p, messageExpiry: value } : p))
    );
  };

  const handleFileExpiryChange = (channelName: string, value: string) => {
    setPolicies((prev) =>
      prev.map((p) => (p.channelName === channelName ? { ...p, fileExpiry: value } : p))
    );
  };

  const handleSave = () => {
    saveRetentionPolicies(policies);
  };

  return (
    <div className="space-y-6">
      {/* Top Notice: Muted Info Card */}
      <div className="p-3.5 rounded-[10px] bg-[#202C33] border border-white/[0.08] text-[#8696A0] text-[13px] flex items-center gap-2.5">
        <Info className="w-4 h-4 text-[#8696A0] flex-shrink-0" />
        <span>Policy settings are recorded. Automatic deletion is planned and not active yet.</span>
      </div>

      {/* Top Description & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <h3 className="text-[17px] font-semibold text-[#E9EDEF]">
            Channel message & file retention
          </h3>
          <p className="text-[13px] text-[#8696A0] mt-0.5">
            Configure retention rules and lifetime thresholds for conversation history.
          </p>
        </div>

        {/* Disabled purge button with required tooltip and label */}
        <button
          type="button"
          disabled
          title="Not available in this version"
          className="h-[40px] px-3.5 rounded-[10px] bg-white/[0.03] border border-white/[0.08] text-[#8696A0] text-[13px] font-medium flex items-center gap-2 transition-standard cursor-not-allowed opacity-60 self-start sm:self-auto"
        >
          <Clock className="w-4 h-4" strokeWidth={1.75} />
          <span>Automatic purge (planned)</span>
        </button>
      </div>

      {/* Channels Retention Table */}
      <div className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead className="sticky top-0 bg-[#1F2C33] text-[#8696A0] border-b border-white/[0.06] select-none font-medium text-[13px]">
              <tr>
                <th className="py-3.5 px-4 font-medium">Channel name</th>
                <th className="py-3.5 px-4 font-medium">Message expiry</th>
                <th className="py-3.5 px-4 font-medium">File / Attachment expiry</th>
                <th className="py-3.5 px-4 font-medium text-right">Policy Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {policies.map((policy) => {
                const isExecutive = policy.channelName === 'Executive Board';
                return (
                  <tr key={policy.channelName} className="h-[52px] hover:bg-white/[0.03] transition-standard">
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#E9EDEF]">
                        {displayChannelName(policy.channelName)}
                      </div>
                      <div className="text-[12px] text-[#8696A0]">
                        {isExecutive
                          ? 'Restricted fiduciary channel'
                          : 'Standard staff group'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <select
                        value={policy.messageExpiry}
                        onChange={(e) =>
                          handleMessageExpiryChange(policy.channelName, e.target.value)
                        }
                        className="h-[38px] px-3 rounded-[8px] bg-[#26353D] text-[#E9EDEF] border border-white/[0.08] focus:border-[#00A884] focus:outline-none text-[13px] cursor-pointer transition-standard"
                      >
                        {messageExpiryOptions.map((opt) => (
                          <option key={opt} value={opt} className="bg-[#1F2C33]">
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3 px-4">
                      <select
                        value={policy.fileExpiry}
                        onChange={(e) =>
                          handleFileExpiryChange(policy.channelName, e.target.value)
                        }
                        className="h-[38px] px-3 rounded-[8px] bg-[#26353D] text-[#E9EDEF] border border-white/[0.08] focus:border-[#00A884] focus:outline-none text-[13px] cursor-pointer transition-standard"
                      >
                        {fileExpiryOptions.map((opt) => (
                          <option key={opt} value={opt} className="bg-[#1F2C33]">
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-[#00A884]/15 text-[#00A884] border border-[#00A884]/30 font-medium label-tracking">
                        <Check className="w-3 h-3" strokeWidth={2} />
                        <span>Configured</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-black/10 border-t border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-[12px] text-[#8696A0]">
            Policy updates take effect upon saving.
          </span>
          <button
            type="button"
            onClick={handleSave}
            className="h-[40px] px-5 rounded-[10px] bg-[#00A884] hover:bg-[#008F72] text-white text-[13px] font-medium transition-standard cursor-pointer"
          >
            Save policy
          </button>
        </div>
      </div>
    </div>
  );
};
