import React from 'react';
import {
  Users,
  UserCheck,
  Hash,
  ArrowRight,
  Clock,
  Database,
  Sliders,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Dashboard: React.FC = () => {
  const { users, auditLogs, channelsList, setAdminSection } = useApp();

  const totalUsers = users.length;
  const pendingApprovalsCount = users.filter((u) => u.status === 'pending').length;
  const activeChannelsCount = channelsList.length;

  // Derive recent activity from unified audit log (top 6 entries)
  const recentActivities = auditLogs.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Page Title: 24px semi-bold */}
      <div className="pb-3 border-b border-white/[0.06]">
        <h2 className="text-[24px] font-semibold text-[#E9EDEF] title-tracking">
          Governance Dashboard
        </h2>
        <p className="text-[13px] text-[#8696A0] mt-1 leading-[1.5]">
          Overview of organization identity status, channel memberships, and pending approvals.
        </p>
      </div>

      {/* Row of 3 Stat Cards: 3 cols on desktop, 2 on tablet, 1 on mobile, equal height */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Users */}
        <div className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] p-5 flex items-center justify-between transition-standard">
          <div>
            <span className="text-[13px] text-[#8696A0] block font-normal">Total users</span>
            <span className="text-[24px] font-semibold text-[#E9EDEF] leading-tight mt-1 block tabular-nums">
              {totalUsers}
            </span>
            <span className="text-[12px] text-[#00A884] mt-1 block">
              {users.filter((u) => u.status === 'approved').length} active staff
            </span>
          </div>
          <div className="w-10 h-10 rounded-[10px] bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-[#8696A0] flex-shrink-0">
            <Users className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </div>

        {/* Pending Approvals */}
        <div
          onClick={() => setAdminSection('pending')}
          className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] p-5 flex items-center justify-between hover:border-[#F59E0B]/50 transition-standard cursor-pointer"
        >
          <div>
            <span className="text-[13px] text-[#8696A0] block font-normal">Pending approvals</span>
            <span className="text-[24px] font-semibold text-[#F59E0B] leading-tight mt-1 block tabular-nums">
              {pendingApprovalsCount}
            </span>
            <span className="text-[12px] text-[#8696A0] mt-1 block">
              {pendingApprovalsCount > 0 ? 'Requires administrator review' : 'All registrations reviewed'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-[10px] bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B] flex-shrink-0">
            <UserCheck className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </div>

        {/* Active Channels */}
        <div className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] p-5 flex items-center justify-between transition-standard">
          <div>
            <span className="text-[13px] text-[#8696A0] block font-normal">Active channels</span>
            <span className="text-[24px] font-semibold text-[#E9EDEF] leading-tight mt-1 block tabular-nums">
              {activeChannelsCount}
            </span>
            <span className="text-[12px] text-[#00A884] mt-1 block">
              1 restricted board channel
            </span>
          </div>
          <div className="w-10 h-10 rounded-[10px] bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-[#8696A0] flex-shrink-0">
            <Hash className="w-5 h-5" strokeWidth={1.75} />
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Quick Action 1: Pending Approvals */}
        <div
          onClick={() => setAdminSection('pending')}
          className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] p-5 hover:border-[#00A884]/40 transition-standard cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-[8px] bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center">
              <UserCheck className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <ArrowRight className="w-4 h-4 text-[#8696A0] group-hover:text-[#00A884] transition-standard" strokeWidth={1.75} />
          </div>
          <h3 className="text-[15px] font-semibold text-[#E9EDEF] mb-1">
            Pending approvals ({pendingApprovalsCount})
          </h3>
          <p className="text-[13px] text-[#8696A0] leading-relaxed">
            Review new user sign-ups, set initial RBAC clearance and assign authorized channels.
          </p>
        </div>

        {/* Quick Action 2: Roles & Channels */}
        <div
          onClick={() => setAdminSection('roles')}
          className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] p-5 hover:border-[#00A884]/40 transition-standard cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-[8px] bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center">
              <Sliders className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <ArrowRight className="w-4 h-4 text-[#8696A0] group-hover:text-[#00A884] transition-standard" strokeWidth={1.75} />
          </div>
          <h3 className="text-[15px] font-semibold text-[#E9EDEF] mb-1">
            Roles & channels
          </h3>
          <p className="text-[13px] text-[#8696A0] leading-relaxed">
            Modify existing user roles (Staff, Team Lead, Admin) and channel memberships.
          </p>
        </div>

        {/* Quick Action 3: Data Retention & Logs */}
        <div
          onClick={() => setAdminSection('retention')}
          className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] p-5 hover:border-[#00A884]/40 transition-standard cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-[8px] bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center">
              <Database className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <ArrowRight className="w-4 h-4 text-[#8696A0] group-hover:text-[#00A884] transition-standard" strokeWidth={1.75} />
          </div>
          <h3 className="text-[15px] font-semibold text-[#E9EDEF] mb-1">
            Data retention & logs
          </h3>
          <p className="text-[13px] text-[#8696A0] leading-relaxed">
            Configure channel message retention settings, file expiry rules, and review the audit log.
          </p>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] p-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#00A884]" strokeWidth={1.75} />
            <h3 className="text-[18px] font-semibold text-[#E9EDEF] title-tracking">
              Recent governance activity
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setAdminSection('retention')}
            className="text-[12px] text-[#00A884] hover:underline cursor-pointer font-medium"
          >
            View full audit ledger &rarr;
          </button>
        </div>

        {recentActivities.length === 0 ? (
          <div className="py-8 text-center text-[#8696A0] text-[13px] flex flex-col items-center justify-center gap-2 select-none">
            <Clock className="w-8 h-8 text-[#8696A0]/40" strokeWidth={1.5} />
            <p className="font-medium text-[#E9EDEF]">No recent activity yet</p>
            <p className="text-[12px] text-[#8696A0]">Administrative actions and user registrations will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {recentActivities.map((entry) => (
              <div key={entry.id} className="py-2.5 flex items-center justify-between gap-4 text-[13px]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#00A884] flex-shrink-0" />
                  <span className="text-[#E9EDEF] font-medium truncate">{entry.action}:</span>
                  <span className="text-[#8696A0] truncate">{entry.details}</span>
                </div>
                <span className="text-[12px] text-[#8696A0] font-mono tabular-nums flex-shrink-0 whitespace-nowrap">
                  {entry.timestamp}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
