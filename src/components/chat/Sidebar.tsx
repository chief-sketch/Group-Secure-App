import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  MoreVertical,
  LogOut,
  Shield,
  Bell,
  BellOff,
  MessageSquarePlus,
  User,
  Flag,
  KeyRound,
  Sun,
  Moon,
  Calendar,
} from 'lucide-react';
import { ChatConversation, UserSession, DirectoryUser } from '../../types';
import { ChatList } from './ChatList';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { ProfileDialog } from '../profile/ProfileDialog';
import { displayChannelName } from '../../lib/channelAvatars';
import { ChangePasswordDialog } from '../auth/ChangePasswordDialog';
import { auth } from '../../lib/firebase';
import { STAFF_IDLE_MINUTES } from '../../config/session';

interface SidebarProps {
  user: UserSession;
  chats: ChatConversation[];
  activeChatId: string | null;
  onSelectChat: (chat: ChatConversation) => void;
  onRestrictedClick: (chatName: string) => void;
  onLogout: () => void;
  onOpenDirectory?: () => void;
  directoryUsers?: DirectoryUser[];
  onSelectPerson?: (person: DirectoryUser) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  chats,
  activeChatId,
  onSelectChat,
  onRestrictedClick,
  onLogout,
  onOpenDirectory,
  directoryUsers = [],
  onSelectPerson,
}) => {
  const {
    notificationsEnabled,
    toggleNotifications,
    isProfileOpen,
    openProfileDialog,
    closeProfileDialog,
    openPrivacyModal,
    openReportModal,
    showToast,
    addAuditEntry,
    theme,
    toggleTheme,
    myMeetings,
    setIsMyMeetingsPageOpen,
    setScreen,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'channels' | 'direct'>('all');
  const [showMenu, setShowMenu] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const isPasswordUser = Boolean(
    user.providerId === 'password' ||
    auth.currentUser?.providerData.some((p) => p.providerId === 'password')
  );

  const isAdmin = user.role === 'admin';

  // Close menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filter chats by tab & search query
  const filteredChats = chats.filter((chat) => {
    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'channels' && chat.type === 'channel') ||
      (activeTab === 'direct' && chat.type === 'direct');

    const cleanChName = chat.type === 'channel' ? displayChannelName(chat.name) : chat.name;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      chat.name.toLowerCase().includes(q) || cleanChName.toLowerCase().includes(q);

    return matchesTab && matchesSearch;
  });

  // Filter matching directory people when search query is active
  const matchingPeople = searchQuery.trim()
    ? directoryUsers.filter(
        (u) =>
          u.uid !== user.uid &&
          u.displayName.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : [];

  return (
    <div className="w-full md:w-[320px] lg:w-[360px] h-full bg-[#0D191F] border-r border-white/[0.06] flex flex-col flex-shrink-0 select-none">
      {/* Profile Dialog */}
      <ProfileDialog
        isOpen={isProfileOpen}
        onClose={closeProfileDialog}
        returnFocusRef={menuButtonRef}
      />

      {/* Sidebar Header: 64px matching mockup */}
      <div className="h-[64px] bg-[#0F1D24] px-4 flex items-center justify-between flex-shrink-0 border-b border-white/[0.06]">
        {/* User avatar & info */}
        <div className="flex items-center gap-3 min-w-0">
          <Avatar uid={user.uid} name={user.fullName} size={38} />
          <div className="min-w-0">
            <h1 className="text-[13.5px] font-semibold text-white truncate leading-tight">
              {user.fullName}
            </h1>
            <p className="text-[11px] font-bold text-[#20E39F] truncate tracking-wide mt-0.5">
              {user.role?.toUpperCase() || 'STAFF'}
            </p>
          </div>
        </div>

        {/* Right side controls: Admin badge button, Notification Bell toggle, Meetings & Menu */}
        <div className="flex items-center gap-1.5">
          {/* Admin Pill Button (shown for admins) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setScreen('admin_dashboard')}
              className="px-2.5 py-1 rounded-full border border-[#20E39F]/40 text-[#20E39F] text-[12px] font-semibold flex items-center gap-1 hover:bg-[#20E39F]/10 transition-colors cursor-pointer"
              title="Admin Dashboard"
            >
              <Shield className="w-3.5 h-3.5 text-[#20E39F]" strokeWidth={2} />
              <span>Admin</span>
            </button>
          )}

          {/* Notification Mute/Unmute Toggle */}
          <button
            type="button"
            onClick={toggleNotifications}
            className={`w-9 h-9 rounded-[12px] flex items-center justify-center transition-colors cursor-pointer ${
              notificationsEnabled
                ? 'text-[#20E39F] hover:bg-white/[0.06]'
                : 'text-[#8696A0] hover:text-white hover:bg-white/[0.04]'
            }`}
            title={notificationsEnabled ? 'Notification toasts enabled (click to mute)' : 'Notification toasts muted (click to unmute)'}
            aria-label="Toggle notifications"
          >
            {notificationsEnabled ? (
              <Bell className="w-4 h-4 text-[#20E39F]" />
            ) : (
              <BellOff className="w-4 h-4" />
            )}
          </button>

          {/* Menu Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="w-9 h-9 rounded-[12px] flex items-center justify-center text-[#8696A0] hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
              aria-label="User Menu"
              title="User menu"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-11 w-48 bg-[#18262E] rounded-[12px] border border-white/[0.08] shadow-2xl py-1.5 z-50 origin-top-right menu-popover-animate text-[13px]">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    setIsMyMeetingsPageOpen(true);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-[#E9EDEF] hover:bg-[#1E303A] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-[#8696A0]" />
                  <span className="flex-1">Meetings</span>
                  {myMeetings.length > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#20E39F] text-[#0A1A14] text-[10px] font-bold flex items-center justify-center tabular-nums">
                      {myMeetings.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    openProfileDialog();
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-[#E9EDEF] hover:bg-[#1E303A] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <User className="w-4 h-4 text-[#8696A0]" />
                  <span>Edit profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    toggleTheme();
                    setShowMenu(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-[#E9EDEF] hover:bg-[#1E303A] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4 text-[#8696A0]" />
                  ) : (
                    <Moon className="w-4 h-4 text-[#8696A0]" />
                  )}
                  <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    openPrivacyModal();
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-[#E9EDEF] hover:bg-[#1E303A] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Shield className="w-4 h-4 text-[#8696A0]" />
                  <span>Privacy notice</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    openReportModal({ type: 'app' });
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-[#E9EDEF] hover:bg-[#1E303A] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Flag className="w-4 h-4 text-[#8696A0]" />
                  <span>Report a problem</span>
                </button>

                {isPasswordUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setIsChangePasswordOpen(true);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-[#E9EDEF] hover:bg-[#1E303A] flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-[#8696A0]" />
                    <span>Change password</span>
                  </button>
                )}

                <div className="my-1 border-t border-white/[0.06]" />

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onLogout();
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-[#E9EDEF] hover:bg-[#1E303A] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-[#8696A0]" />
                  <span>Log out</span>
                </button>

                <div className="px-3.5 py-1.5 text-[11px] text-[#8696A0]/60 select-none border-t border-white/[0.06] mt-0.5">
                  Expires after {STAFF_IDLE_MINUTES}m idle
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar matching mockup: "Search channels or people" */}
      <div className="p-3 bg-[#0D191F]">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7D87]">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search channels or people"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[40px] pl-10 pr-3 rounded-[12px] bg-[#16252C] text-[#E9EDEF] placeholder-[#6B7D87] text-[13.5px] border border-white/[0.06] focus:border-[#20E39F] focus:outline-none transition-standard"
          />
        </div>
      </div>

      {/* Tabs matching mockup: All / Channels / Direct pills */}
      <div className="flex items-center justify-between px-3.5 pb-2.5 pt-0.5 bg-[#0D191F] border-b border-white/[0.04]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1 rounded-full text-[12.5px] font-semibold transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#13382F] text-[#20E39F] border border-[#20E39F]/30'
                : 'text-[#8696A0] hover:text-white'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('channels')}
            className={`px-3.5 py-1 rounded-full text-[12.5px] font-semibold transition-colors cursor-pointer ${
              activeTab === 'channels'
                ? 'bg-[#13382F] text-[#20E39F] border border-[#20E39F]/30'
                : 'text-[#8696A0] hover:text-white'
            }`}
          >
            Channels
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('direct')}
            className={`px-3.5 py-1 rounded-full text-[12.5px] font-semibold transition-colors cursor-pointer ${
              activeTab === 'direct'
                ? 'bg-[#13382F] text-[#20E39F] border border-[#20E39F]/30'
                : 'text-[#8696A0] hover:text-white'
            }`}
          >
            Direct
          </button>
        </div>

        {activeTab === 'direct' && onOpenDirectory && (
          <button
            type="button"
            onClick={onOpenDirectory}
            className="flex items-center gap-1 text-[12px] font-semibold text-[#20E39F] hover:bg-[#20E39F]/10 px-2 py-1 rounded-full border border-[#20E39F]/30 transition-standard cursor-pointer"
            title="Start new conversation"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        )}
      </div>

      {/* Chat List */}
      <ChatList
        chats={filteredChats}
        activeChatId={activeChatId}
        onSelectChat={onSelectChat}
        onRestrictedClick={onRestrictedClick}
        searchQuery={searchQuery}
        onClearSearch={() => setSearchQuery('')}
        matchingPeople={matchingPeople}
        onSelectPerson={(person) => {
          setSearchQuery('');
          onSelectPerson?.(person);
        }}
        activeTab={activeTab}
      />

      {/* Change Password Dialog for email/password users */}
      {isPasswordUser && (
        <ChangePasswordDialog
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
          onSuccess={() => {
            showToast('Password updated');
            addAuditEntry(
              user.email,
              'Password changed',
              'Password changed',
              'Auth'
            );
          }}
        />
      )}
    </div>
  );
};
