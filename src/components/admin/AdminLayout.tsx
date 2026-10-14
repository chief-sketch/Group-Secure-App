import React, { useState } from 'react';
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
    myMeetings,
    meetingReminder,
    clearMeetingReminder,
    openMeetingConversation,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pendingCount = users.filter((u) => u.status === 'pending').length;

  const navItems = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'meetings' as const,
      label: 'Meetings',
      icon: Calendar,
      badge: myMeetings.length > 0 ? myMeetings.length : undefined,
    },
    {
      id: 'pending' as const,
      label: 'Pending approvals',
      icon: UserCheck,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      id: 'history_requests' as const,
      label: 'History requests',
      icon: Clock,
      badge: openHistoryRequestsCount > 0 ? openHistoryRequestsCount : undefined,
    },
    {
      id: 'roles' as const,
      label: 'Roles & channels',
      icon: Sliders,
    },
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
    {
      id: 'retention' as const,
      label: 'Data retention & logs',
      icon: Database,
    },
    {
      id: 'checklist' as const,
      label: 'Test checklist',
      icon: CheckSquare,
    },
  ];

  const handleNavClick = (section: AdminSection) => {
    setAdminSection(section);
    setMobileMenuOpen(false);
  };

  return (
    <div className="h-screen w-screen bg-[#0B141A] text-[#E9EDEF] flex flex-col md:flex-row overflow-hidden font-sans antialiased">
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
      <div className="md:hidden h-[60px] bg-[#111B21] border-b border-white/[0.06] px-4 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-2">
          <svg
            className="w-6 h-6 text-[#00A884]"
            viewBox="0 0 56 56"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M28 8C16.954 8 8 16.657 8 27.34c0 3.864 1.154 7.476 3.167 10.536L8.5 48l10.535-2.673A19.82 19.82 0 0028 46.68c11.046 0 20-8.657 20-19.34C48 16.657 39.046 8 28 8z"
              stroke="#00A884"
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
              stroke="#00A884"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-semibold text-[15px] text-[#E9EDEF]">
            Group Secure
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#00A884]/15 text-[#00A884] border border-[#00A884]/30">
            Admin
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-[#8696A0] hover:text-[#E9EDEF] p-1.5 rounded-lg cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar for Desktop (240px) & Mobile Drawer */}
      <aside
        className={`w-full md:w-[240px] bg-[#111B21] border-r border-white/[0.06] flex flex-col justify-between flex-shrink-0 z-30 transition-all duration-200 ${
          mobileMenuOpen
            ? 'block fixed inset-0 top-[60px] bg-[#111B21]'
            : 'hidden md:flex'
        }`}
      >
        <div>
          {/* Brand Header (Desktop) */}
          <div className="hidden md:flex items-center gap-2.5 px-5 h-[64px] border-b border-white/[0.06]">
            <svg
              className="w-6 h-6 text-[#00A884] flex-shrink-0"
              viewBox="0 0 56 56"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M28 8C16.954 8 8 16.657 8 27.34c0 3.864 1.154 7.476 3.167 10.536L8.5 48l10.535-2.673A19.82 19.82 0 0028 46.68c11.046 0 20-8.657 20-19.34C48 16.657 39.046 8 28 8z"
                stroke="#00A884"
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
                stroke="#00A884"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-[14px] text-[#E9EDEF] truncate">
                Group Secure App
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#00A884]/15 text-[#00A884] border border-[#00A884]/30">
                Admin
              </span>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="p-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = adminSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[8px] text-[13px] font-medium transition-colors cursor-pointer border-l-2 ${
                    isActive
                      ? 'border-[#00A884] bg-[#1F2C33] text-[#E9EDEF]'
                      : 'border-transparent text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#00A884]' : 'text-[#8696A0]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="px-2 py-0.2 rounded-full text-[11px] font-bold bg-[#F59E0B] text-black">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Admin User & Logout */}
        <div className="p-3 border-t border-white/[0.06] bg-[#1F2C33]/40">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar
                uid={currentSession?.uid}
                name={currentSession?.fullName || 'Security Administrator'}
                size={32}
              />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[#E9EDEF] truncate">
                  {currentSession?.fullName || 'Security Administrator'}
                </div>
                <div className="text-[11px] text-[#8696A0] font-mono truncate">
                  {currentSession?.email || 'admin@organization.local'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-white/[0.04]">
            <button
              type="button"
              onClick={openProfileDialog}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] text-[12px] text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-[#00A884]" />
              <span>Edit profile</span>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] text-[12px] text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-[#00A884]" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-[#00A884]" />
              )}
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>
            <button
              type="button"
              onClick={openPrivacyModal}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] text-[12px] text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-[#8696A0]" />
              <span>Privacy notice</span>
            </button>
            <button
              type="button"
              onClick={() => openReportModal({ type: 'app' })}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] text-[12px] text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5 text-[#8696A0]" />
              <span>Report a problem</span>
            </button>
            <button
              type="button"
              onClick={openLogoutDialog}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] text-[12px] text-[#8696A0] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
            <div className="px-2.5 py-1 text-[11px] text-[#8696A0]/70 select-none border-t border-white/[0.04] mt-1 pt-1">
              Session expires after {ADMIN_IDLE_MINUTES} minutes of inactivity.
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-[calc(100vh-60px)] md:h-screen overflow-y-auto p-4 sm:p-8 bg-[#0B141A] scrollbar-thin">
        <div className="max-w-[1080px] mx-auto">
          {adminSection === 'dashboard' && <Dashboard />}
          {adminSection === 'meetings' && currentSession && (
            <MyMeetingsPage
              currentUser={currentSession}
              onBack={() => setAdminSection('dashboard')}
            />
          )}
          {adminSection === 'pending' && <PendingApprovals />}
          {adminSection === 'history_requests' && <HistoryRequestsPanel />}
          {adminSection === 'roles' && <RolesPanel />}
          {adminSection === 'channels' && <ChannelsPanel />}
          {adminSection === 'reports' && <ReportsPanel />}
          {adminSection === 'retention' && <DataRetentionPage />}
          {adminSection === 'checklist' && <TestChecklist />}
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
