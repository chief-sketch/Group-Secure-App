import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  UserCheck,
  Sliders,
  Database,
  CheckSquare,
  LogOut,
  Menu,
  X,
  User,
  Flag,
  Shield,
  Hash,
  Clock,
  Sun,
  Moon,
  Calendar,
} from 'lucide-react';
import { useApp, AdminSection } from '../../context/AppContext';
import { Dashboard } from './Dashboard';
import { PendingApprovals } from './PendingApprovals';
import { RolesPanel } from './RolesPanel';
import { ChannelsPanel } from './ChannelsPanel';
import { DataRetentionPage } from './DataRetentionPage';
import { TestChecklist } from './TestChecklist';
import { ReportsPanel } from './ReportsPanel';
import { HistoryRequestsPanel } from './HistoryRequestsPanel';
import { Toast } from '../chat/Toast';
import { Avatar } from '../common/Avatar';
import { ProfileDialog } from '../profile/ProfileDialog';
import { ADMIN_IDLE_MINUTES } from '../../config/session';
import { MyMeetingsPage } from '../meetings/MyMeetingsPage';
import { MeetingReminderToast } from '../meetings/MeetingReminderToast';

export const AdminLayout: React.FC = () => {
  const {
    adminSection,
    setAdminSection,
    currentSession,
    openLogoutDialog,
    users,
    toastMessage,
    showToast,
    isProfileOpen,
    openProfileDialog,
    closeProfileDialog,
    openPrivacyModal,
    openReportModal,
    openReportsCount,
    openHistoryRequestsCount,
    theme,
    toggleTheme,
    meetingReminder,
    clearMeetingReminder,
    openMeetingConversation,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Detect prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    if (mql.addEventListener) mql.addEventListener('change', handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
    };
  }, []);

  // Escape key closes mobile menu
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Live session countdown timer connected to existing gsa_last_activity tracking
  const [remainingSeconds, setRemainingSeconds] = useState<number>(ADMIN_IDLE_MINUTES * 60);

  useEffect(() => {
    const updateCountdown = () => {
      try {
        const stored = localStorage.getItem('gsa_last_activity');
        const lastActivity = stored ? parseInt(stored, 10) : Date.now();
        const elapsedMs = Date.now() - (isNaN(lastActivity) ? Date.now() : lastActivity);
        const totalIdleMs = ADMIN_IDLE_MINUTES * 60 * 1000;
        const remainingMs = Math.max(0, totalIdleMs - elapsedMs);
        setRemainingSeconds(Math.ceil(remainingMs / 1000));
      } catch {
        // Fallback
        setRemainingSeconds(ADMIN_IDLE_MINUTES * 60);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    // Reset countdown display immediately on user input
    const onUserActivity = () => {
      setTimeout(updateCountdown, 50);
    };

    window.addEventListener('mousemove', onUserActivity, { passive: true });
    window.addEventListener('keydown', onUserActivity, { passive: true });
    window.addEventListener('click', onUserActivity, { passive: true });
    window.addEventListener('storage', updateCountdown);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', onUserActivity);
      window.removeEventListener('keydown', onUserActivity);
      window.removeEventListener('click', onUserActivity);
      window.removeEventListener('storage', updateCountdown);
    };
  }, []);

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeDisplay = `${mins}:${secs.toString().padStart(2, '0')}`;
  const totalSessionSeconds = ADMIN_IDLE_MINUTES * 60;
  const progressPercent = Math.min(100, Math.max(0, (remainingSeconds / totalSessionSeconds) * 100));

  const pendingCount = users.filter((u) => u.status === 'pending').length;

  const navGroups = [
    {
      title: 'People',
      items: [
        {
          id: 'pending' as const,
          label: 'Pending approvals',
          icon: UserCheck,
          badge: pendingCount > 0 ? pendingCount : undefined,
        },
        {
          id: 'roles' as const,
          label: 'Roles & channels',
          icon: Sliders,
        },
      ],
    },
    {
      title: 'Content',
      items: [
        {
          id: 'channels' as const,
          label: 'Channels',
          icon: Hash,
        },
        {
          id: 'reports' as const,
          label: 'Reports',
          icon: Flag,
          badge: openReportsCount > 0 ? openReportsCount : undefined,
        },
      ],
    },
    {
      title: 'Compliance',
      items: [
        {
          id: 'history_requests' as const,
          label: 'History requests',
          icon: Clock,
          badge: openHistoryRequestsCount > 0 ? openHistoryRequestsCount : undefined,
        },
        {
          id: 'retention' as const,
          label: 'Data retention & logs',
          icon: Database,
        },
      ],
    },
  ];

  const handleNavClick = (section: AdminSection) => {
    setAdminSection(section);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Brand Header (Desktop) - clean without ADMIN badge */}
        <div className="hidden md:flex items-center gap-2.5 px-5 h-[64px] border-b border-[#2C3B44]">
          <svg
            className="w-6 h-6 text-[#3DDBB4] flex-shrink-0"
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
              rx="2"
              stroke="#3DDBB4"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-semibold text-[14px] text-white truncate">
            Group Secure App
          </span>
        </div>

        {/* Navigation Links */}
        <div className="p-3 space-y-1">
          {/* Dashboard Link (Always at top) */}
          <button
            type="button"
            onClick={() => handleNavClick('dashboard')}
            aria-current={adminSection === 'dashboard' ? 'page' : undefined}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-[13px] font-medium transition-colors cursor-pointer nav-row ${
              adminSection === 'dashboard'
                ? 'bg-[#173A33] border border-[#3DDBB4]/30 text-[#3DDBB4] font-semibold'
                : 'border border-transparent text-[#A9BAC4] hover:text-[#E9EDEF] hover:bg-white/[0.04]'
            } focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]`}
          >
            <LayoutDashboard
              className={`w-4 h-4 flex-shrink-0 ${
                adminSection === 'dashboard' ? 'text-[#3DDBB4]' : 'text-[#A9BAC4]'
              }`}
            />
            <span>Dashboard</span>
          </button>

          {/* Grouped Nav Items (Sentence case headings) */}
          {navGroups.map((group) => (
            <div key={group.title} className="pt-3 pb-1">
              <div className="px-3.5 text-[11px] font-medium text-[#71828D] select-none tracking-normal">
                {group.title}
              </div>
              <div className="mt-1 space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = adminSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full flex items-center justify-between px-3.5 py-2 rounded-[12px] text-[13px] font-medium transition-colors cursor-pointer nav-row ${
                        isActive
                          ? 'bg-[#173A33] border border-[#3DDBB4]/30 text-[#3DDBB4] font-semibold'
                          : 'border border-transparent text-[#A9BAC4] hover:text-[#E9EDEF] hover:bg-white/[0.04]'
                      } focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 ${
                            isActive ? 'text-[#3DDBB4]' : 'text-[#A9BAC4]'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="ml-2 w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold bg-[#F5B84A] text-[#0B1419] flex-shrink-0 tabular-nums animate-badge-pulse">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Section: Admin User & Timeout Progress & Logout */}
      <div className="p-3 border-t border-[#2C3B44] bg-[#111C22]">
        {/* User profile row */}
        <div className="flex items-center gap-2.5 px-1 py-1">
          <Avatar
            uid={currentSession?.uid}
            name={currentSession?.fullName || 'Daniel Mbogo'}
            size={34}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-white truncate">
              {currentSession?.fullName || 'Daniel Mbogo'}
            </div>
            <div className="text-[11px] text-[#A9BAC4] font-medium truncate">
              Administrator
            </div>
          </div>
        </div>

        {/* Live Session Timeout countdown and progress bar (scaleX transform) */}
        <div className="mt-2.5 mb-2 px-1">
          <div className="flex items-center justify-between text-[11px] text-[#A9BAC4] mb-1 font-medium select-none tabular-nums">
            <span>Session ends in {timeDisplay}</span>
          </div>
          <div className="w-full h-1 bg-[#2C3B44] rounded-full overflow-hidden">
            <div
              className="w-full h-full bg-[#3DDBB4] rounded-full transition-transform duration-300"
              style={{
                transform: `scaleX(${progressPercent / 100})`,
                transformOrigin: 'left',
              }}
            />
          </div>
        </div>

        {/* Quick action items */}
        <div className="flex flex-col gap-0.5 mt-2 pt-1 border-t border-[#2C3B44]/60">
          <button
            type="button"
            onClick={openProfileDialog}
            title="Edit profile"
            aria-label="Edit profile"
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[12px] text-[12px] text-[#A9BAC4] hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]"
          >
            <User className="w-3.5 h-3.5 text-[#A9BAC4]" />
            <span>Edit profile</span>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[12px] text-[12px] text-[#A9BAC4] hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-[#A9BAC4]" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-[#A9BAC4]" />
            )}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button
            type="button"
            onClick={openPrivacyModal}
            title="Privacy notice"
            aria-label="Privacy notice"
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[12px] text-[12px] text-[#A9BAC4] hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]"
          >
            <Shield className="w-3.5 h-3.5 text-[#A9BAC4]" />
            <span>Privacy notice</span>
          </button>
          <button
            type="button"
            onClick={() => openReportModal({ type: 'app' })}
            title="Report a problem"
            aria-label="Report a problem"
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[12px] text-[12px] text-[#A9BAC4] hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]"
          >
            <Flag className="w-3.5 h-3.5 text-[#A9BAC4]" />
            <span>Report a problem</span>
          </button>

          {/* Divider before Log out */}
          <div className="border-t border-[#2C3B44] my-1" />

          <button
            type="button"
            onClick={openLogoutDialog}
            title="Log out of administrator account"
            aria-label="Log out"
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[12px] text-[12px] text-[#A9BAC4] hover:text-[#F08A9B] hover:bg-[#F08A9B]/10 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]"
          >
            <LogOut className="w-3.5 h-3.5 text-[#A9BAC4]" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="h-screen h-[100dvh] w-screen bg-[#0B1419] text-[#E9EDEF] flex flex-col md:flex-row overflow-hidden font-sans antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => showToast('')} />
      )}

      {/* Meeting Reminder Toast */}
      {meetingReminder && (
        <MeetingReminderToast
          reminder={meetingReminder}
          onClose={clearMeetingReminder}
          onOpen={() => {
            if (meetingReminder) {
              openMeetingConversation(
                meetingReminder.conversationType,
                meetingReminder.conversationId
              );
            }
          }}
        />
      )}

      {/* Mobile Top Header */}
      <div className="md:hidden h-[60px] bg-[#111C22] border-b border-[#2C3B44] px-4 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <svg
            className="w-6 h-6 text-[#3DDBB4] flex-shrink-0"
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
              rx="2"
              stroke="#3DDBB4"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-semibold text-[15px] text-white">
            Group Secure App
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-11 h-11 flex items-center justify-center text-[#A9BAC4] hover:text-white rounded-lg cursor-pointer -mr-2 focus:outline-none focus:ring-2 focus:ring-[#3DDBB4]"
          title={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer (with critically damped spring motion) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              key="admin-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 z-30 bg-black/60 pointer-events-auto"
              aria-hidden="true"
            />
            <motion.aside
              key="admin-drawer"
              role="region"
              aria-label="Mobile navigation drawer"
              initial={prefersReducedMotion ? { opacity: 0 } : { x: '-100%' }}
              animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { x: '-100%' }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.18 }
                  : { type: 'spring', bounce: 0, duration: 0.35 }
              }
              className="md:hidden fixed inset-y-0 left-0 top-[60px] w-[280px] max-w-[85vw] bg-[#111C22] border-r border-[#2C3B44] flex flex-col justify-between flex-shrink-0 z-40 shadow-2xl pointer-events-auto"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar (240px) */}
      <aside className="hidden md:flex w-[240px] bg-[#111C22] border-r border-[#2C3B44] flex-col justify-between flex-shrink-0 z-30">
        {sidebarContent}
      </aside>

      {/* Main Content Area (150ms page crossfade) */}
      <main className="flex-1 h-[calc(100vh-60px)] h-[calc(100dvh-60px)] md:h-screen md:h-[100dvh] overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#0B1419] scrollbar-thin pb-safe">
        <div className="max-w-[1180px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={adminSection}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              {adminSection === 'dashboard' && <Dashboard />}
              {adminSection === 'pending' && <PendingApprovals />}
              {adminSection === 'history_requests' && <HistoryRequestsPanel />}
              {adminSection === 'roles' && <RolesPanel />}
              {adminSection === 'channels' && <ChannelsPanel />}
              {adminSection === 'reports' && <ReportsPanel />}
              {adminSection === 'retention' && <DataRetentionPage />}
              {adminSection === 'checklist' && <TestChecklist />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Profile Dialog */}
      <ProfileDialog
        isOpen={isProfileOpen}
        onClose={closeProfileDialog}
      />
    </div>
  );
};
