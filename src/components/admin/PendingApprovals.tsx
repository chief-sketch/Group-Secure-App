import React, { useState, useEffect, useRef } from 'react';
import { UserCheck, CheckCircle2, Check, X, ShieldAlert } from 'lucide-react';
import { useApp, ALL_CHANNELS } from '../../context/AppContext';
import { OrgUser, UserRole } from '../../types';
import { Avatar } from '../common/Avatar';
import { ChannelAvatar } from '../common/ChannelAvatar';
import { displayChannelName } from '../../lib/channelAvatars';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export const PendingApprovals: React.FC = () => {
  const { users, approveUser, rejectUser } = useApp();

  const pendingUsers = users.filter((u) => u.status === 'pending');

  // Approval Modal State
  const [approvingUser, setApprovingUser] = useState<OrgUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([
    'General',
    'IT Support',
  ]);
  const [channelHistoryOptions, setChannelHistoryOptions] = useState<
    Record<string, 'now' | 'full'>
  >({});

  // Reject Confirmation State
  const [rejectingUser, setRejectingUser] = useState<OrgUser | null>(null);

  const approveDialogRef = useRef<HTMLDivElement>(null);
  const rejectDialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(approveDialogRef, Boolean(approvingUser), {
    onEscape: () => setApprovingUser(null),
  });
  useFocusTrap(rejectDialogRef, Boolean(rejectingUser), {
    onEscape: () => setRejectingUser(null),
  });

  const openApproveModal = (user: OrgUser) => {
    setApprovingUser(user);
    setSelectedRole('staff');
    const defaultHistory: Record<string, 'now' | 'full'> = {};
    ALL_CHANNELS.forEach((c) => {
      defaultHistory[c] = 'now';
    });
    setChannelHistoryOptions(defaultHistory);

    if (user.department === 'Finance') {
      setSelectedChannels(['General', 'Finance Team']);
    } else if (user.department === 'IT') {
      setSelectedChannels(['General', 'IT Support']);
    } else {
      setSelectedChannels(['General']);
    }
  };

  const handleChannelToggle = (ch: string) => {
    if (selectedChannels.includes(ch)) {
      if (selectedChannels.length === 1) return; // Keep at least one channel
      setSelectedChannels(selectedChannels.filter((c) => c !== ch));
    } else {
      setSelectedChannels([...selectedChannels, ch]);
      // Default to "From now" when selected
      setChannelHistoryOptions((prev) => ({
        ...prev,
        [ch]: prev[ch] || 'now',
      }));
    }
  };

  const handleConfirmApproval = () => {
    if (!approvingUser) return;
    approveUser(approvingUser.id, selectedRole, selectedChannels, channelHistoryOptions);
    setApprovingUser(null);
  };

  const handleQuickApproveToGeneral = (user: OrgUser) => {
    approveUser(user.id, 'staff', ['General'], { General: 'now' });
  };

  const handleConfirmRejection = () => {
    if (!rejectingUser) return;
    rejectUser(rejectingUser.id);
    setRejectingUser(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-[24px] font-semibold text-[#E9EDEF] title-tracking">
            Pending account approvals
          </h2>
          <p className="text-[13px] text-[#8696A0] mt-1 leading-[1.5]">
            Review registration submissions, assign RBAC permissions, and authorize channel membership.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[#8696A0]">Awaiting review:</span>
          <span className="px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 tabular-nums">
            {pendingUsers.length}
          </span>
        </div>
      </div>

      {/* List / Table */}
      {pendingUsers.length === 0 ? (
        <div className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] p-12 text-center select-none">
          <div className="w-12 h-12 rounded-full bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <h3 className="text-[18px] font-semibold text-[#E9EDEF] title-tracking mb-1">
            No pending approvals
          </h3>
          <p className="text-[13px] text-[#8696A0] max-w-[340px] mx-auto leading-relaxed">
            All submitted registrations have been reviewed. New staff sign-ups will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="sticky top-0 bg-[#1F2C33] text-[#8696A0] border-b border-white/[0.06] select-none font-medium">
                <tr>
                  <th className="py-3.5 px-5 font-medium">Staff member</th>
                  <th className="py-3.5 px-5 font-medium">Department</th>
                  <th className="py-3.5 px-5 font-medium">Status</th>
                  <th className="py-3.5 px-5 font-medium">Registered</th>
                  <th className="py-3.5 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {pendingUsers.map((user) => (
                  <tr key={user.id} className="h-[52px] hover:bg-white/[0.03] transition-standard">
                    <td className="py-2.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <Avatar uid={user.id} name={user.fullName} size={24} />
                        <div className="min-w-0">
                          <div className="font-medium text-[#E9EDEF]">{user.fullName}</div>
                          <div className="text-[12px] text-[#8696A0] font-mono">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-5 text-[#E9EDEF]">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[12px] bg-white/[0.05] text-[#E9EDEF]">
                        {user.department}
                      </span>
                    </td>
                    <td className="py-2.5 px-5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
                        Pending
                      </span>
                    </td>
                    <td className="py-2.5 px-5 text-[#8696A0] tabular-nums text-[13px]">
                      {user.dateRegistered}
                    </td>
                    <td className="py-2.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuickApproveToGeneral(user)}
                          title="Quick approve and add to General (sees messages from now)"
                          className="min-h-[44px] h-[44px] px-3 rounded-[8px] bg-transparent hover:bg-white/[0.05] border border-[#00A884]/40 text-[#00A884] text-[12px] font-medium flex items-center gap-1 transition-standard cursor-pointer whitespace-nowrap"
                        >
                          <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                          <span>Add to General</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openApproveModal(user)}
                          className="h-[36px] px-3.5 rounded-[8px] bg-[#00A884] hover:bg-[#008F72] text-white text-[13px] font-medium flex items-center gap-1.5 transition-standard cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" strokeWidth={2} />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingUser(user)}
                          className="h-[36px] px-3 rounded-[8px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] hover:border-[#E5484D]/50 hover:text-[#E5484D] text-[#8696A0] text-[13px] font-medium flex items-center gap-1.5 transition-standard cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>Reject</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Card View */}
          <div className="md:hidden divide-y divide-white/[0.06]">
            {pendingUsers.map((user) => (
              <div key={user.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar uid={user.id} name={user.fullName} size={32} />
                    <div className="min-w-0">
                      <div className="font-medium text-[#E9EDEF] truncate">{user.fullName}</div>
                      <div className="text-[12px] text-[#8696A0] font-mono truncate">{user.email}</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 flex-shrink-0">
                    Pending
                  </span>
                </div>

                <div className="flex items-center justify-between text-[12px] text-[#8696A0]">
                  <span>Dept: <strong className="text-[#E9EDEF] font-normal">{user.department}</strong></span>
                  <span className="tabular-nums">{user.dateRegistered}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleQuickApproveToGeneral(user)}
                    className="flex-1 min-h-[44px] h-[44px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-[#00A884]/40 text-[#00A884] text-[12px] font-medium flex items-center justify-center gap-1.5 transition-standard cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Add to General</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openApproveModal(user)}
                    className="flex-1 h-[40px] rounded-[10px] bg-[#00A884] hover:bg-[#008F72] text-white text-[13px] font-medium flex items-center justify-center gap-1.5 transition-standard cursor-pointer"
                  >
                    <Check className="w-4 h-4" strokeWidth={2} />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectingUser(user)}
                    className="h-[40px] px-3 rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E5484D] text-[13px] font-medium flex items-center justify-center gap-1.5 transition-standard cursor-pointer"
                  >
                    <X className="w-4 h-4" strokeWidth={1.75} />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* APPROVE MODAL DIALOG */}
      {approvingUser && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setApprovingUser(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-standard"
        >
          <div
            ref={approveDialogRef}
            tabIndex={-1}
            className="w-full max-w-[460px] bg-[#1F2C33] rounded-[12px] border border-white/[0.08] shadow-xl p-6 outline-none"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
              <div className="flex items-center gap-2 text-[#00A884]">
                <UserCheck className="w-5 h-5" strokeWidth={1.75} />
                <h3 className="text-[18px] font-semibold text-[#E9EDEF] title-tracking">
                  Approve Account
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setApprovingUser(null)}
                className="text-[#8696A0] hover:text-[#E9EDEF] p-1 rounded transition-standard cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* User Target Card */}
            <div className="bg-[#202C33] rounded-[10px] p-3 mb-4 text-[13px] border border-white/[0.08] flex items-center gap-3">
              <Avatar uid={approvingUser.id} name={approvingUser.fullName} size={40} />
              <div className="min-w-0">
                <div className="text-[#E9EDEF] font-medium">{approvingUser.fullName}</div>
                <div className="text-[#8696A0] font-mono text-[12px]">{approvingUser.email}</div>
                <div className="text-[#8696A0] mt-0.5 text-[12px]">
                  Department: <span className="text-[#E9EDEF]">{approvingUser.department}</span>
                </div>
              </div>
            </div>

            {/* Select Role */}
            <div className="mb-4">
              <label className="block text-[13px] text-[#8696A0] mb-2 font-medium">
                Assign RBAC role:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['staff', 'team_lead', 'admin'] as UserRole[]).map((r) => {
                  const isCurrent = selectedRole === r;
                  const label = r === 'staff' ? 'Staff' : r === 'team_lead' ? 'Team Lead' : 'Admin';
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedRole(r)}
                      className={`h-[40px] rounded-[8px] text-[13px] font-medium transition-standard cursor-pointer border ${
                        isCurrent
                          ? 'bg-[#00A884] text-white border-[#00A884]'
                          : 'bg-[#202C33] text-[#8696A0] border-white/[0.08] hover:text-[#E9EDEF]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Select Channels */}
            <div className="mb-5">
              <label className="block text-[13px] text-[#8696A0] mb-2 font-medium">
                Authorize initial channels:
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {ALL_CHANNELS.map((ch) => {
                  const isChecked = selectedChannels.includes(ch);
                  const historyOption = channelHistoryOptions[ch] || 'now';

                  return (
                    <div
                      key={ch}
                      onClick={() => handleChannelToggle(ch)}
                      className={`flex items-center justify-between p-2.5 rounded-[8px] border text-[13px] transition-standard cursor-pointer select-none ${
                        isChecked
                          ? 'bg-[#00A884]/10 border-[#00A884]/30 text-[#E9EDEF]'
                          : 'bg-[#202C33] border-white/[0.06] text-[#8696A0] hover:text-[#E9EDEF]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <ChannelAvatar channelId={ch} size={24} />
                        <span>{displayChannelName(ch)}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isChecked && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center rounded-[6px] bg-[#111B21] p-0.5 border border-white/[0.08] text-[11px]"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setChannelHistoryOptions((prev) => ({ ...prev, [ch]: 'now' }))
                              }
                              className={`px-2 py-0.5 rounded-[4px] font-medium transition-standard ${
                                historyOption === 'now'
                                  ? 'bg-[#00A884] text-white shadow-sm'
                                  : 'text-[#8696A0] hover:text-[#E9EDEF]'
                              }`}
                            >
                              From now
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setChannelHistoryOptions((prev) => ({ ...prev, [ch]: 'full' }))
                              }
                              className={`px-2 py-0.5 rounded-[4px] font-medium transition-standard ${
                                historyOption === 'full'
                                  ? 'bg-[#00A884] text-white shadow-sm'
                                  : 'text-[#8696A0] hover:text-[#E9EDEF]'
                              }`}
                            >
                              Full history
                            </button>
                          </div>
                        )}
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                            isChecked ? 'bg-[#00A884] text-white' : 'border border-[#8696A0]/40'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions: 44px buttons */}
            <div className="flex gap-2.5 pt-3 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={handleConfirmApproval}
                className="flex-1 h-[44px] rounded-[10px] bg-[#00A884] hover:bg-[#008F72] text-white text-[14px] font-medium transition-standard cursor-pointer flex items-center justify-center"
              >
                Confirm Approval
              </button>
              <button
                type="button"
                onClick={() => setApprovingUser(null)}
                className="flex-1 h-[44px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[14px] font-medium transition-standard cursor-pointer flex items-center justify-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT CONFIRMATION DIALOG (Destructive action standard) */}
      {rejectingUser && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRejectingUser(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-standard"
        >
          <div
            ref={rejectDialogRef}
            tabIndex={-1}
            className="w-full max-w-[380px] bg-[#1F2C33] rounded-[12px] border border-white/[0.08] shadow-xl p-6 text-center select-none outline-none"
          >
            <div className="w-11 h-11 rounded-full bg-[#E5484D]/15 border border-[#E5484D]/30 text-[#E5484D] flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-5 h-5" strokeWidth={1.75} />
            </div>

            <h3 className="text-[18px] font-semibold text-[#E9EDEF] title-tracking mb-2 leading-tight">
              Reject registration?
            </h3>

            <p className="text-[13px] text-[#8696A0] leading-relaxed mb-6">
              This account registration for <strong className="text-[#E9EDEF] font-medium">{rejectingUser.fullName}</strong> will be rejected and denied access to channels.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleConfirmRejection}
                className="w-full h-[44px] rounded-[10px] bg-[#E5484D] hover:bg-[#c93b40] text-white text-[14px] font-medium transition-standard cursor-pointer flex items-center justify-center"
              >
                Reject Registration
              </button>
              <button
                type="button"
                onClick={() => setRejectingUser(null)}
                className="w-full h-[44px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[14px] font-medium transition-standard cursor-pointer flex items-center justify-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
