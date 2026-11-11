import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  UserCheck,
  Hash,
  Flag,
  ArrowRight,
  Sliders,
  Database,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ReportDoc, AuditLogEntry } from '../../types';
import { subscribeToReports } from '../../lib/firebaseService';
import { AnimatedCounter } from '../common/AnimatedCounter';
import { ClearActivityDialog } from './ClearActivityDialog';

type ActivityCategoryFilter = 'All' | 'Security' | 'Moderation' | 'Users';

interface ProcessedActivity {
  id: string;
  categoryType: 'Security' | 'Moderation' | 'Users';
  action: string;
  details: string;
  timestampStr: string;
  timeMs: number;
}

/**
 * Extract numeric milliseconds from an audit log entry for strictly chronological sorting.
 */
function getEntryTimeMs(entry: AuditLogEntry & { _time?: number; createdAt?: any }): number {
  if (typeof entry._time === 'number' && !isNaN(entry._time) && entry._time > 0) {
    return entry._time;
  }
  if (entry.createdAt) {
    if (typeof entry.createdAt.toMillis === 'function') {
      return entry.createdAt.toMillis();
    }
    if (typeof entry.createdAt.seconds === 'number') {
      return entry.createdAt.seconds * 1000 + (entry.createdAt.nanoseconds || 0) / 1e6;
    }
    if (entry.createdAt instanceof Date) {
      return entry.createdAt.getTime();
    }
  }
  if (typeof entry.id === 'string' && entry.id.startsWith('log-')) {
    const parts = entry.id.split('-');
    const ms = parseInt(parts[1], 10);
    if (!isNaN(ms) && ms > 1500000000000) {
      return ms;
    }
  }
  if (typeof entry.timestamp === 'string') {
    const parsed = Date.parse(entry.timestamp);
    if (!isNaN(parsed) && parsed > 1500000000000) {
      return parsed;
    }
    // "Today at H:MM AM/PM"
    const todayMatch = entry.timestamp.match(/Today\s+at\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (todayMatch) {
      const now = new Date();
      let hours = parseInt(todayMatch[1], 10);
      const minutes = parseInt(todayMatch[2], 10);
      const ampm = todayMatch[3]?.toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
      return d.getTime();
    }
    // "Mon DD at H:MM AM/PM"
    const dateMatch = entry.timestamp.match(/([A-Za-z]+)\s+(\d{1,2})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (dateMatch) {
      const d = new Date(`${dateMatch[1]} ${dateMatch[2]}, ${new Date().getFullYear()} ${dateMatch[3]}:${dateMatch[4]} ${dateMatch[5] || ''}`);
      if (!isNaN(d.getTime())) return d.getTime();
    }
  }
  return 0;
}

/**
 * Format timestamp strictly in user's local time:
 * - 12-hour format with AM/PM (handling 12:00 AM midnight and 12:00 PM noon correctly)
 * - If today: time only (e.g. "12:58 PM")
 * - If older: date and time (e.g. "Oct 24, 11:15 AM")
 */
function formatActivityTime(timeMs: number, fallbackStr?: string): string {
  if (timeMs <= 0) {
    if (fallbackStr) {
      return fallbackStr.replace(/^Today at\s+/i, '');
    }
    return '';
  }

  const d = new Date(timeMs);
  const hours24 = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const timeStr = `${hours12}:${minutes} ${ampm}`;

  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isToday) {
    return timeStr;
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const day = d.getDate();
  return `${month} ${day}, ${timeStr}`;
}

/**
 * Categorize audit log entry into Security, Moderation, or Users
 */
function categorizeActivity(entry: AuditLogEntry): 'Security' | 'Moderation' | 'Users' {
  const cat = entry.category || '';
  const actionLower = (entry.action || '').toLowerCase();
  const detailsLower = (entry.details || '').toLowerCase();

  if (
    cat === 'Moderation' ||
    actionLower.includes('report') ||
    actionLower.includes('flag') ||
    actionLower.includes('message removed') ||
    detailsLower.includes('moderated')
  ) {
    return 'Moderation';
  }

  if (
    cat === 'Approval' ||
    cat === 'Role change' ||
    actionLower.includes('user') ||
    actionLower.includes('account') ||
    actionLower.includes('registered') ||
    actionLower.includes('approved') ||
    actionLower.includes('rejected') ||
    actionLower.includes('suspended') ||
    actionLower.includes('reactivated') ||
    actionLower.includes('role') ||
    actionLower.includes('channel history')
  ) {
    return 'Users';
  }

  return 'Security';
}

export const Dashboard: React.FC = () => {
  const { users, auditLogs, channelsList, setAdminSection, openReportsCount, currentSession } = useApp();
  const [filterType, setFilterType] = useState<ActivityCategoryFilter>('All');
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  // Real-time reports subscription to compute open count and new today count
  useEffect(() => {
    const unsub = subscribeToReports(
      (list) => setReports(list),
      () => {}
    );
    return () => unsub();
  }, []);

  // Compute User Counts
  const totalUsers = users.length;
  const activeCount = users.filter((u) => u.status === 'approved').length;
  const suspendedCount = users.filter((u) => u.status === 'suspended').length;
  const pendingCount = users.filter((u) => u.status === 'pending').length;

  // Compute Oldest Pending Request Waiting Time
  const oldestDaysText = useMemo(() => {
    const pendingUsers = users.filter((u) => u.status === 'pending');
    if (pendingUsers.length === 0) return 'All registrations reviewed';

    const now = Date.now();
    let oldestMs = now;

    for (const u of pendingUsers) {
      let regMs = 0;
      if (u.dateRegistered) {
        const p = Date.parse(u.dateRegistered);
        if (!isNaN(p)) regMs = p;
      }
      if (!regMs && (u as any).createdAt) {
        const ca = (u as any).createdAt;
        if (typeof ca.toMillis === 'function') regMs = ca.toMillis();
        else if (typeof ca.seconds === 'number') regMs = ca.seconds * 1000;
        else if (ca instanceof Date) regMs = ca.getTime();
      }
      if (regMs && regMs < oldestMs) {
        oldestMs = regMs;
      }
    }

    const diffDays = Math.floor((now - oldestMs) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Oldest request waiting today';
    if (diffDays === 1) return 'Oldest request waiting 1 day';
    return `Oldest request waiting ${diffDays} days`;
  }, [users]);

  // Compute Open Reports and Reports Created Today
  const openReports = reports.filter((r) => r.status === 'open');
  const effectiveOpenReportsCount = Math.max(openReports.length, openReportsCount);
  const newTodayReportsCount = useMemo(() => {
    const now = new Date();
    const startOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return openReports.filter((r) => {
      if (r.createdAt) {
        const ms =
          typeof r.createdAt.toMillis === 'function'
            ? r.createdAt.toMillis()
            : typeof r.createdAt.seconds === 'number'
            ? r.createdAt.seconds * 1000
            : new Date(r.createdAt).getTime();
        return ms >= startOfTodayMs;
      }
      return false;
    }).length;
  }, [openReports]);

  const activeChannelsCount = channelsList.length;

  // Process, strictly sort descending by epoch ms, merge login+2FA, and filter activity feed
  const processedActivities = useMemo(() => {
    // 1. Map to raw items with numeric time
    const items = auditLogs.map((entry) => {
      const timeMs = getEntryTimeMs(entry);
      return {
        entry,
        timeMs,
      };
    });

    // 2. Sort strictly newest first by numeric milliseconds
    items.sort((a, b) => b.timeMs - a.timeMs);

    // 3. Merge back-to-back admin login and 2FA entries, and format entries
    const result: ProcessedActivity[] = [];
    const skipIndices = new Set<number>();

    for (let i = 0; i < items.length; i++) {
      if (skipIndices.has(i)) continue;

      const { entry, timeMs } = items[i];
      const actionLower = (entry.action || '').toLowerCase();
      const detailsLower = (entry.details || '').toLowerCase();

      // Check for Admin sign-in / login pattern
      const isAdminLogin =
        actionLower.includes('admin login') ||
        actionLower.includes('admin sign-in') ||
        detailsLower.includes('elevated governance session') ||
        detailsLower.includes('sec-device-adm-01');

      if (isAdminLogin) {
        // Look ahead to check if the next entry is 2FA verified or duplicate login within 2 minutes
        if (i + 1 < items.length) {
          const next = items[i + 1];
          const nextActLower = (next.entry.action || '').toLowerCase();
          const nextDetLower = (next.entry.details || '').toLowerCase();
          const timeDiff = Math.abs(timeMs - next.timeMs);

          if (
            timeDiff < 120000 &&
            (nextActLower.includes('2fa') ||
              nextDetLower.includes('2fa') ||
              nextActLower.includes('two-factor') ||
              nextActLower.includes('login') ||
              nextActLower.includes('elevated'))
          ) {
            skipIndices.add(i + 1);
          }
        }

        result.push({
          id: entry.id,
          categoryType: 'Security',
          action: 'Admin sign-in',
          details: '2FA verified, elevated session started on device SEC-DEVICE-ADM-01',
          timestampStr: formatActivityTime(timeMs, entry.timestamp),
          timeMs,
        });
        continue;
      }

      // Check if this standalone entry is a 2FA entry that didn't precede login
      if (actionLower.includes('2fa') || detailsLower.includes('2fa verified')) {
        result.push({
          id: entry.id,
          categoryType: 'Security',
          action: 'Admin sign-in',
          details: '2FA verified, elevated session started on device SEC-DEVICE-ADM-01',
          timestampStr: formatActivityTime(timeMs, entry.timestamp),
          timeMs,
        });
        continue;
      }

      // Standard entry
      const categoryType = categorizeActivity(entry);
      result.push({
        id: entry.id,
        categoryType,
        action: entry.action || 'Activity',
        details: entry.details || '',
        timestampStr: formatActivityTime(timeMs, entry.timestamp),
        timeMs,
      });
    }

    return result;
  }, [auditLogs]);

  // Apply category chip filter
  const filteredActivities = useMemo(() => {
    if (filterType === 'All') {
      return processedActivities.slice(0, 8);
    }
    return processedActivities.filter((a) => a.categoryType === filterType).slice(0, 8);
  }, [processedActivities, filterType]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-[#2C3B44]">
        <h1 className="text-[26px] font-bold text-white tracking-tight">
          Governance dashboard
        </h1>
        <p className="text-[13px] text-[#A9BAC4] mt-1">
          Who has access, what needs your decision, and what changed today.
        </p>
      </div>

      {/* Row of 4 Stat Cards: wraps to 2x2 or 1-column on narrow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Users */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setAdminSection('roles')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setAdminSection('roles');
            }
          }}
          className="bg-[#17232A] rounded-[16px] border border-[#2C3B44] p-5 flex flex-col justify-between hover:border-[#3DDBB4]/50 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#A9BAC4] font-medium">Total users</span>
            <div className="w-9 h-9 rounded-[10px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#A9BAC4]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[28px] font-bold text-white leading-tight tabular-nums">
              <AnimatedCounter value={totalUsers} />
            </div>
            <div className="text-[12px] text-[#A9BAC4] mt-1 font-medium">
              {activeCount} active · {suspendedCount} suspended · {pendingCount} pending
            </div>
          </div>
        </div>

        {/* Card 2: Pending Approvals */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setAdminSection('pending')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setAdminSection('pending');
            }
          }}
          className={`bg-[#17232A] rounded-[16px] border p-5 flex flex-col justify-between transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] ${
            pendingCount > 0
              ? 'border-[#F5B84A]/60 hover:border-[#F5B84A]'
              : 'border-[#2C3B44] hover:border-white/[0.15]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#A9BAC4] font-medium">Pending approvals</span>
            <div className="w-9 h-9 rounded-[10px] bg-[#382810] border border-[#F5B84A]/30 flex items-center justify-center text-[#F5B84A]">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[28px] font-bold text-white leading-tight tabular-nums">
              <AnimatedCounter value={pendingCount} />
            </div>
            <div className="text-[12px] text-[#A9BAC4] mt-1 font-medium">
              {pendingCount > 0 ? (
                <>
                  <span>{oldestDaysText}</span>
                  <span className="block text-[#F5B84A] font-semibold mt-1">
                    Review sign-ups &rarr;
                  </span>
                </>
              ) : (
                'All registrations reviewed'
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Open Reports */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setAdminSection('reports')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setAdminSection('reports');
            }
          }}
          className={`bg-[#17232A] rounded-[16px] border p-5 flex flex-col justify-between transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] ${
            effectiveOpenReportsCount > 0
              ? 'border-[#F08A9B]/60 hover:border-[#F08A9B]'
              : 'border-[#2C3B44] hover:border-white/[0.15]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#A9BAC4] font-medium">Open reports</span>
            <div className="w-9 h-9 rounded-[10px] bg-[#381A24] border border-[#F08A9B]/30 flex items-center justify-center text-[#F08A9B]">
              <Flag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[28px] font-bold text-white leading-tight tabular-nums">
              <AnimatedCounter value={effectiveOpenReportsCount} />
            </div>
            <div className="text-[12px] text-[#A9BAC4] mt-1 font-medium">
              {effectiveOpenReportsCount > 0 ? (
                <>
                  <span>
                    {newTodayReportsCount > 0
                      ? `${newTodayReportsCount} new today`
                      : `${effectiveOpenReportsCount} open`}
                  </span>
                  <span className="block text-[#F08A9B] font-semibold mt-1">
                    Review reports &rarr;
                  </span>
                </>
              ) : (
                'No open reports'
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Active Channels */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setAdminSection('channels')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setAdminSection('channels');
            }
          }}
          className="bg-[#17232A] rounded-[16px] border border-[#2C3B44] p-5 flex flex-col justify-between hover:border-[#3DDBB4]/50 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#A9BAC4] font-medium">Active channels</span>
            <div className="w-9 h-9 rounded-[10px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#A9BAC4]">
              <Hash className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[28px] font-bold text-white leading-tight tabular-nums">
              <AnimatedCounter value={activeChannelsCount} />
            </div>
            <div className="text-[12px] text-[#A9BAC4] mt-1 font-medium">
              1 restricted board channel
            </div>
          </div>
        </div>
      </div>

      {/* Row of 3 Shortcut Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Shortcut 1: Pending Approvals */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setAdminSection('pending')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setAdminSection('pending');
            }
          }}
          className="bg-[#17232A] rounded-[16px] border border-[#2C3B44] p-5 hover:border-[#3DDBB4]/50 transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#382810] border border-[#F5B84A]/30 text-[#F5B84A] flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-[#A9BAC4] group-hover:text-[#3DDBB4] transition-colors" />
          </div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="text-[15px] font-bold text-white">
              Pending approvals
            </h3>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#F5B84A] text-[#0B1419]">
                {pendingCount} waiting
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#A9BAC4] leading-relaxed">
            Review new sign-ups, set initial RBAC clearance and assign authorized channels.
          </p>
        </div>

        {/* Shortcut 2: Roles & Channels */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setAdminSection('roles')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setAdminSection('roles');
            }
          }}
          className="bg-[#17232A] rounded-[16px] border border-[#2C3B44] p-5 hover:border-[#3DDBB4]/50 transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#10342B] border border-[#3DDBB4]/30 text-[#3DDBB4] flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-[#A9BAC4] group-hover:text-[#3DDBB4] transition-colors" />
          </div>
          <h3 className="text-[15px] font-bold text-white mb-1.5">
            Roles & channels
          </h3>
          <p className="text-[12px] text-[#A9BAC4] leading-relaxed">
            Change user roles (Staff, Team Lead, Admin) and channel memberships.
          </p>
        </div>

        {/* Shortcut 3: Data Retention & Logs */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setAdminSection('retention')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setAdminSection('retention');
            }
          }}
          className="bg-[#17232A] rounded-[16px] border border-[#2C3B44] p-5 hover:border-[#3DDBB4]/50 transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#10342B] border border-[#3DDBB4]/30 text-[#3DDBB4] flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-[#A9BAC4] group-hover:text-[#3DDBB4] transition-colors" />
          </div>
          <h3 className="text-[15px] font-bold text-white mb-1.5">
            Data retention & logs
          </h3>
          <p className="text-[12px] text-[#A9BAC4] leading-relaxed">
            Set message retention, file expiry rules and review the audit log.
          </p>
        </div>
      </div>

      {/* Recent Governance Activity Section */}
      <div className="bg-[#17232A] rounded-[16px] border border-[#2C3B44] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2C3B44] mb-4">
          <h2 className="text-[16px] font-bold text-white">
            Recent governance activity
          </h2>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Chips */}
            {(['All', 'Security', 'Moderation', 'Users'] as ActivityCategoryFilter[]).map((cat) => {
              const isActive = filterType === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterType(cat)}
                  className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] ${
                    isActive
                      ? 'bg-[#13382F] text-[#3DDBB4] border border-[#3DDBB4]/40 font-semibold'
                      : 'bg-white/[0.04] text-[#A9BAC4] border border-white/[0.06] hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setAdminSection('retention')}
              className="text-[12px] text-[#3DDBB4] hover:underline font-semibold ml-1 sm:ml-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] rounded"
            >
              View full audit ledger
            </button>

            {currentSession?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setIsClearDialogOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#E5484D]/15 hover:bg-[#E5484D]/25 border border-[#E5484D]/30 text-[#FF6B6B] text-[12px] font-medium transition-all cursor-pointer ml-1"
                title="Clear governance activity records"
                aria-label="Clear governance activity"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear activity</span>
              </button>
            )}
          </div>
        </div>

        {filteredActivities.length === 0 ? (
          <div className="py-10 text-center text-[#A9BAC4] text-[13px] flex flex-col items-center justify-center gap-2 select-none">
            <p className="font-semibold text-white">No activity in this category</p>
            <p className="text-[12px] text-[#A9BAC4]">
              Administrative actions and governance logs matching this filter will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#2C3B44]/50">
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredActivities.map((item) => {
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Category Type Tag */}
                      {item.categoryType === 'Security' && (
                        <span className="bg-[#182C44] text-[#60A5FA] border border-[#60A5FA]/30 px-2.5 py-0.5 rounded-md text-[11px] font-semibold flex-shrink-0">
                          Security
                        </span>
                      )}
                      {item.categoryType === 'Moderation' && (
                        <span className="bg-[#382810] text-[#F5B84A] border border-[#F5B84A]/30 px-2.5 py-0.5 rounded-md text-[11px] font-semibold flex-shrink-0">
                          Moderation
                        </span>
                      )}
                      {item.categoryType === 'Users' && (
                        <span className="bg-[#10342B] text-[#3DDBB4] border border-[#3DDBB4]/30 px-2.5 py-0.5 rounded-md text-[11px] font-semibold flex-shrink-0">
                          Users
                        </span>
                      )}

                      {/* Entry Text */}
                      <div className="min-w-0 truncate text-[13px]">
                        <span className="font-bold text-white mr-1.5">
                          {item.action}
                        </span>
                        <span className="text-[#A9BAC4]">
                          {item.details}
                        </span>
                      </div>
                    </div>

                    {/* Right-aligned tabular timestamp */}
                    <div className="text-[12px] text-[#A9BAC4] font-mono tabular-nums whitespace-nowrap sm:text-right flex-shrink-0">
                      {item.timestampStr}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Clear Governance Activity Dialog */}
      {isClearDialogOpen && (
        <ClearActivityDialog
          isOpen={isClearDialogOpen}
          onClose={() => setIsClearDialogOpen(false)}
        />
      )}
    </div>
  );
};
