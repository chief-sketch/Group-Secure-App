import React, { useState, useRef, useEffect } from 'react';
import { Search, MoreVertical, LogOut, Shield, Bell, BellOff, MessageSquarePlus, User, Flag, KeyRound, Sun, Moon, Calendar } from 'lucide-react';
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
    <div className="w-full md:w-[360px] h-full bg-[#111B21] border-r border-white/[0.06] flex flex-col flex-shrink-0 select-none">
      {/* Profile Dialog */}
      <ProfileDialog
        isOpen={isProfileOpen}
        onClose={closeProfileDialog}
        returnFocusRef={menuButtonRef}
      />

      {/* Sidebar Header */}
      <div className="h-[60px] bg-[#1F2C33] px-3.5 flex items-center justify-between flex-shrink-0 border-b border-white/[0.06]">
        {/* User avatar & info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar uid={user.uid} name={user.fullName} size={40} />
          <div className="min-w-0">
            <h1 className="text-[14px] font-semibold text-[#E9EDEF] truncate leading-tight">
              {user.fullName}
            </h1>
            <p className="text-[11px] text-[#8696A0] truncate flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#00A884]" strokeWidth={1.75} />
              <span className="uppercase tracking-wider label-tracking">{user.role}</span>
            </p>
          </div>
        </div>

        {/* Right side controls: Notification Bell toggle, Meetings button & Menu */}
        <div className="flex items-center gap-1">
          {/* Notification Mute/Unmute Toggle */}
          <button
            type="button"
            onClick={toggleNotifications}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              notificationsEnabled
                ? 'text-[#00A884] hover:bg-white/[0.08]'
                : 'text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.05]'
            }`}
            title={notificationsEnabled ? 'Notification toasts enabled (click to mute)' : 'Notification toasts muted (click to unmute)'}
            aria-label="Toggle notifications"
          >
            {notificationsEnabled ? (
              <Bell className="w-4 h-4" />
            ) : (
              <BellOff className="w-4 h-4" />
            )}
          </button>

          {/* Meetings Calendar Button */}
          <button
            type="button"
            onClick={() => setIsMyMeetingsPageOpen(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.05] transition-colors cursor-pointer relative"
            title="Meetings"
            aria-label="Meetings"
          >
            <Calendar className="w-4 h-4" />
            {myMeetings.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#00A884] text-white text-[10px] font-bold flex items-center justify-center tabular-nums leading-none">
                {myMeetings.length}
              </span>
            )}
          </button>

          {/* Menu Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.05] transition-colors duration-150 cursor-pointer"
              aria-label="User Menu"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-11 w-44 bg-[#233138] rounded-[8px] border border-white/[0.08] shadow-xl py-1.5 z-50 animate-fadeIn">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    setIsMyMeetingsPageOpen(true);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-[13px] text-[#E9EDEF] hover:bg-[#182229] flex items-center gap-2.5 transition-colors duration-150 cursor-pointer min-h-[44px]"
                >
                  <Calendar className="w-4 h-4 text-[#8696A0]" />
                  <span className="flex-1">Meetings</span>
                  {myMeetings.length > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#00A884] text-white text-[10px] font-bold flex items-center justify-center tabular-nums leading-none">
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
                  className="w-full px-3.5 py-2.5 text-left text-[13px] text-[#E9EDEF] hover:bg-[#182229] flex items-center gap-2.5 transition-colors duration-150 cursor-pointer min-h-[44px]"
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
                  aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                  className="w-full px-3.5 py-2.5 text-left text-[13px] text-[#E9EDEF] hover:bg-[#182229] flex items-center gap-2.5 transition-colors duration-150 cursor-pointer min-h-[44px]"
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
                  className="w-full px-3.5 py-2.5 text-left text-[13px] text-[#E9EDEF] hover:bg-[#182229] flex items-center gap-2.5 transition-colors duration-150 cursor-pointer"
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
                  className="w-full px-3.5 py-2.5 text-left text-[13px] text-[#E9EDEF] hover:bg-[#182229] flex items-center gap-2.5 transition-colors duration-150 cursor-pointer"
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
                    className="w-full px-3.5 py-2.5 text-left text-[13px] text-[#E9EDEF] hover:bg-[#182229] flex items-center gap-2.5 transition-colors duration-150 cursor-pointer"
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
                  className="w-full px-3.5 py-2.5 text-left text-[13px] text-[#E9EDEF] hover:bg-[#182229] flex items-center gap-2.5 transition-colors duration-150 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-[#8696A0]" />
                  <span>Log out</span>
                </button>
                <div className="px-3.5 py-2 text-[11px] text-[#8696A0]/70 select-none border-t border-white/[0.06] mt-0.5">
                  Session expires after {STAFF_IDLE_MINUTES} minutes of inactivity.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 bg-[#111B21] border-b border-white/[0.04]">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8696A0]">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search channels or direct chats"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[38px] pl-9 pr-3 rounded-[8px] bg-[#202C33] text-[#E9EDEF] placeholder-[#8696A0] text-[13px] border border-transparent focus:border-[#00A884] focus:outline-none transition-colors duration-150"
          />
        </div>
      </div>

      {/* Tabs (Channels and Direct) */}
      {(() => {
        const channelUnreadTotal = chats
          .filter((c) => c.type === 'channel' && c.hasAccess)
          .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        const directUnreadTotal = chats
          .filter((c) => c.type === 'direct')
          .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        const allUnreadTotal = channelUnreadTotal + directUnreadTotal;

        return (
          <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-white/[0.04] bg-[#111B21]">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-[6px] text-[12px] font-medium transition-colors duration-150 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'all'
                    ? 'bg-[#202C33] text-[#00A884]'
                    : 'text-[#8696A0] hover:text-[#E9EDEF]'
                }`}
              >
                <span>All</span>
                {allUnreadTotal > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#00A884] text-white text-[10px] font-bold flex items-center justify-center tabular-nums leading-none">
                    {allUnreadTotal > 99 ? '99+' : allUnreadTotal}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('channels')}
                className={`px-3 py-1 rounded-[6px] text-[12px] font-medium transition-colors duration-150 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'channels'
                    ? 'bg-[#202C33] text-[#00A884]'
                    : 'text-[#8696A0] hover:text-[#E9EDEF]'
                }`}
              >
                <span>Channels</span>
                {channelUnreadTotal > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#00A884] text-white text-[10px] font-bold flex items-center justify-center tabular-nums leading-none">
                    {channelUnreadTotal > 99 ? '99+' : channelUnreadTotal}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('direct')}
                className={`px-3 py-1 rounded-[6px] text-[12px] font-medium transition-colors duration-150 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'direct'
                    ? 'bg-[#202C33] text-[#00A884]'
                    : 'text-[#8696A0] hover:text-[#E9EDEF]'
                }`}
              >
                <span>Direct</span>
                {directUnreadTotal > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#00A884] text-white text-[10px] font-bold flex items-center justify-center tabular-nums leading-none">
                    {directUnreadTotal > 99 ? '99+' : directUnreadTotal}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'direct' && onOpenDirectory && (
              <button
                type="button"
                onClick={onOpenDirectory}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[12px] font-medium text-[#00A884] hover:bg-[#00A884]/15 transition-standard cursor-pointer border border-[#00A884]/30"
                title="Start new conversation from staff directory"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>New message</span>
              </button>
            )}
          </div>
        );
      })()}

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
