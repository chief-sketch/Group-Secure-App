import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  ArrowLeft,
  Lock,
  ArrowDown,
  MessageSquare,
  Users,
  Search,
  ChevronUp,
  ChevronDown,
  X,
  Clock,
  MoreVertical,
  Bell,
  BellOff,
  Shield,
  Calendar,
} from 'lucide-react';
import {
  ChatConversation,
  ChatMessage,
  UserSession,
  MessageReplyTo,
} from '../../types';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { Avatar } from '../common/Avatar';
import { ChannelAvatar } from '../common/ChannelAvatar';
import { DeleteMessageDialog } from '../common/DeleteMessageDialog';
import { RemoveMessageDialog } from '../common/RemoveMessageDialog';
import { RequestHistoryDialog } from './RequestHistoryDialog';
import { ConversationMeetingsPanel } from '../meetings/ConversationMeetingsPanel';
import { useApp } from '../../context/AppContext';
import { displayChannelName } from '../../lib/channelAvatars';
import {
  editChatMessage,
  softDeleteChatMessage,
  moderatorRemoveChatMessage,
  updateTypingStatusInFirestore,
  clearTypingStatusInFirestore,
  subscribeToTypingStatus,
  getChannelHistoryFromTimestamp,
} from '../../lib/firebaseService';
import { ProcessedFile } from '../../lib/fileProcessing';

interface ConversationPanelProps {
  chat: ChatConversation;
  currentUser: UserSession;
  onBack: () => void;
  onSendMessage: (text: string, replyTo?: MessageReplyTo) => void;
  onSendFileMessage: (fileData: ProcessedFile, caption: string, replyTo?: MessageReplyTo) => void;
  onRetryFileMessage?: (message: ChatMessage) => void;
  onLoadEarlier?: () => void;
  hasEarlierMessages?: boolean;
  isLoadingEarlier?: boolean;
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  chat,
  currentUser,
  onBack,
  onSendMessage,
  onSendFileMessage,
  onRetryFileMessage,
  onLoadEarlier,
  hasEarlierMessages = false,
  isLoadingEarlier = false,
}) => {
  const {
    openReportModal,
    showToast,
    isChannelMuted,
    toggleMuteChannel,
    addAuditEntry,
    myMeetings,
    openMeetingsPanelChatId,
    setOpenMeetingsPanelChatId,
  } = useApp();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const channelMenuRef = useRef<HTMLDivElement>(null);
  const channelMenuButtonRef = useRef<HTMLButtonElement>(null);

  const [showChannelMenu, setShowChannelMenu] = useState(false);
  const [isMeetingsPanelOpen, setIsMeetingsPanelOpen] = useState(false);
  const [panelMeetingsCount, setPanelMeetingsCount] = useState<number | null>(null);

  // Auto-open meetings panel if requested (e.g. from reminder or My Meetings card)
  useEffect(() => {
    if (openMeetingsPanelChatId === chat.id) {
      setIsMeetingsPanelOpen(true);
      setOpenMeetingsPanelChatId(null);
    }
  }, [openMeetingsPanelChatId, chat.id, setOpenMeetingsPanelChatId]);

  // Upcoming meetings count for this conversation
  const myUpcomingInThisChat = useMemo(() => {
    return myMeetings.filter((m) => m.conversationId === chat.id).length;
  }, [myMeetings, chat.id]);

  const upcomingMeetingCount = panelMeetingsCount !== null ? panelMeetingsCount : myUpcomingInThisChat;

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [newMessagesWhileScrolled, setNewMessagesWhileScrolled] = useState(0);
  const prevMessagesCountRef = useRef(chat.messages.length);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Reply and Edit state
  const [replyingTo, setReplyingTo] = useState<MessageReplyTo | null>(null);
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    text: string;
    createdAt: any;
  } | null>(null);

  // Delete dialog state (normal soft delete)
  const [deletingMessage, setDeletingMessage] = useState<ChatMessage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Moderator remove dialog state (admin removal)
  const [moderatingMessage, setModeratingMessage] = useState<ChatMessage | null>(null);
  const [isModerating, setIsModerating] = useState(false);

  // Request earlier history dialog state
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);

  const isChannel = chat.type === 'channel';
  const historyTimestamp = useMemo(() => {
    if (!isChannel) return null;
    return getChannelHistoryFromTimestamp(currentUser.historyFrom, chat.id);
  }, [isChannel, currentUser.historyFrom, chat.id]);

  const hasRestrictedHistory = Boolean(
    isChannel && historyTimestamp && historyTimestamp.toMillis() > 0
  );
  // Show pill when member's window starts later than channel's first message and channel is not empty
  const showHistoryPill = hasRestrictedHistory && chat.messages.length > 0;

  // Typing indicator state
  const [typingUsers, setTypingUsers] = useState<{ uid: string; name: string }[]>([]);

  // Focus search input when search bar opens
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
      setCurrentMatchIndex(0);
    }
  }, [isSearchOpen]);

  // Subscribe to typing indicator for open conversation
  useEffect(() => {
    if (!chat.id || !currentUser.uid) return;
    if (chat.type === 'channel' && !chat.hasAccess) return;

    const unsub = subscribeToTypingStatus(
      chat.type,
      chat.id,
      currentUser.uid,
      (activeUsers) => {
        setTypingUsers(activeUsers);
      }
    );

    return () => {
      unsub();
      clearTypingStatusInFirestore(chat.type, chat.id, currentUser.uid).catch(() => {});
    };
  }, [chat.type, chat.id, currentUser.uid]);

  // Clear typing and edit state on chat change
  useEffect(() => {
    setReplyingTo(null);
    setEditingMessage(null);
    setIsSearchOpen(false);
    setSearchQuery('');
    setShowChannelMenu(false);
  }, [chat.id]);

  // Close channel menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        channelMenuRef.current &&
        !channelMenuRef.current.contains(e.target as Node) &&
        channelMenuButtonRef.current &&
        !channelMenuButtonRef.current.contains(e.target as Node)
      ) {
        setShowChannelMenu(false);
      }
    };
    if (showChannelMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showChannelMenu]);

  // Search matches computation
  const matchingMessageIds = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return chat.messages
      .filter((m) => !m.deleted && m.text && m.text.toLowerCase().includes(query))
      .map((m) => m.id);
  }, [chat.messages, searchQuery]);

  // Keep current match index in range
  useEffect(() => {
    if (matchingMessageIds.length === 0) {
      setCurrentMatchIndex(0);
    } else if (currentMatchIndex >= matchingMessageIds.length) {
      setCurrentMatchIndex(matchingMessageIds.length - 1);
    }
  }, [matchingMessageIds.length, currentMatchIndex]);

  // Scroll to current search result
  useEffect(() => {
    if (matchingMessageIds.length > 0 && isSearchOpen) {
      const targetId = matchingMessageIds[currentMatchIndex];
      if (targetId) {
        const el = document.getElementById(`msg-${targetId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [currentMatchIndex, matchingMessageIds, isSearchOpen]);

  const handlePrevMatch = () => {
    if (matchingMessageIds.length === 0) return;
    setCurrentMatchIndex((prev) => (prev > 0 ? prev - 1 : matchingMessageIds.length - 1));
  };

  const handleNextMatch = () => {
    if (matchingMessageIds.length === 0) return;
    setCurrentMatchIndex((prev) => (prev < matchingMessageIds.length - 1 ? prev + 1 : 0));
  };

  // Monitor scroll position
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollBottom(!isAtBottom);
    if (isAtBottom) {
      setNewMessagesWhileScrolled(0);
    }
  };

  // Auto-scroll to bottom on messages change if already near bottom
  useEffect(() => {
    const isScrolledUp = showScrollBottom;
    if (!isScrolledUp && !isSearchOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (chat.messages.length > prevMessagesCountRef.current) {
      setNewMessagesWhileScrolled((prev) => prev + (chat.messages.length - prevMessagesCountRef.current));
    }
    prevMessagesCountRef.current = chat.messages.length;
  }, [chat.messages, showScrollBottom, isSearchOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
    setNewMessagesWhileScrolled(0);
  };

  // Handle typing triggers from composer
  const handleTyping = () => {
    updateTypingStatusInFirestore(chat.type, chat.id, currentUser.uid, currentUser.fullName).catch(
      () => {}
    );
  };

  const handleClearTyping = () => {
    clearTypingStatusInFirestore(chat.type, chat.id, currentUser.uid).catch(() => {});
  };

  // Handle message reply initiation
  const handleReplyMessage = (msg: ChatMessage) => {
    if (msg.deleted) return;
    const rawPreview = msg.text || msg.fileName || (msg.type === 'file' ? 'Photo' : 'Message');
    const preview = rawPreview.slice(0, 100);
    setReplyingTo({
      messageId: msg.id,
      senderName: msg.senderName,
      preview,
    });
  };

  // Handle quoted block click: scroll and briefly highlight
  const handleReplyClick = (targetMessageId: string) => {
    const el = document.getElementById(`msg-${targetMessageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-[#00A884]/20', 'rounded-[12px]');
      setTimeout(() => {
        el.classList.remove('bg-[#00A884]/20', 'rounded-[12px]');
      }, 1500);
    } else {
      showToast('Original message is not in loaded history');
    }
  };

  // Handle edit message initiation
  const handleEditMessage = (msg: ChatMessage) => {
    if (msg.deleted) return;
    setEditingMessage({
      id: msg.id,
      text: msg.text || '',
      createdAt: msg.createdAt,
    });
  };

  // Save edited message
  const handleSaveEdit = async (messageId: string, newText: string) => {
    try {
      await editChatMessage(chat.type, chat.id, messageId, newText);
      setEditingMessage(null);
    } catch (err: any) {
      console.error('Failed to edit message:', err);
      showToast('Failed to edit message. Please try again.');
    }
  };

  // Confirm soft delete message (also deletes file document if present)
  const handleConfirmDelete = async () => {
    if (!deletingMessage) return;
    setIsDeleting(true);
    try {
      await softDeleteChatMessage(chat.type, chat.id, deletingMessage.id, deletingMessage.fileId);
      setDeletingMessage(null);
    } catch (err) {
      console.error('Failed to delete message:', err);
      showToast('Failed to delete message. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to determine message grouping
  const isMessageGrouped = (currentMsg: ChatMessage, prevMsg: ChatMessage | null): boolean => {
    if (!prevMsg) return false;
    if (currentMsg.isOutgoing !== prevMsg.isOutgoing) return false;
    if (!currentMsg.isOutgoing && currentMsg.senderName !== prevMsg.senderName) return false;

    if (currentMsg.timestamp && prevMsg.timestamp) {
      const parseTime = (t: string) => {
        const parts = t.split(':');
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      };
      try {
        const diffMinutes = Math.abs(parseTime(currentMsg.timestamp) - parseTime(prevMsg.timestamp));
        return diffMinutes <= 2;
      } catch (_) {
        return false;
      }
    }
    return true;
  };

  // Check if current user is an approved admin who is a member of this channel
  const isApprovedAdmin = currentUser.role === 'admin' && currentUser.status === 'approved';
  const isAdminAndMember = isChannel && isApprovedAdmin && chat.hasAccess;

  // Confirm admin removal of channel message
  const handleConfirmModeratorRemove = async (reason: string, note: string) => {
    if (!moderatingMessage) return;
    setIsModerating(true);
    try {
      await moderatorRemoveChatMessage(
        chat.id,
        moderatingMessage.id,
        reason,
        moderatingMessage.fileId
      );
      const adminName = currentUser.fullName || currentUser.email || 'Administrator';
      const channelDisplayName = displayChannelName(chat.name);
      await addAuditEntry(
        currentUser.email || adminName,
        `Message removed by ${adminName} in ${channelDisplayName} (reason: ${reason})`,
        `Message ID: ${moderatingMessage.id}, Sender: ${moderatingMessage.senderName}${note ? `. Note: ${note}` : ''}`,
        'Moderation'
      );
      showToast('Message removed by administrator');
      setModeratingMessage(null);
    } catch (err: any) {
      const errorCode = err?.code || err?.name || 'unknown';
      console.error('Moderator remove error code:', errorCode);
      showToast('Could not remove the message. Check your channel access.');
    } finally {
      setIsModerating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B141A] overflow-hidden relative">
      {/* Delete Message Confirmation Dialog (Regular soft delete) */}
      <DeleteMessageDialog
        isOpen={deletingMessage !== null}
        onClose={() => setDeletingMessage(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Remove Message Confirmation Dialog (Admin moderation) */}
      <RemoveMessageDialog
        isOpen={moderatingMessage !== null}
        onClose={() => setModeratingMessage(null)}
        onConfirm={handleConfirmModeratorRemove}
        isRemoving={isModerating}
      />

      {/* Conversation Header: 60px */}
      <div className="h-[60px] bg-[#1F2C33] border-b border-white/[0.06] px-4 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button (Mobile only) */}
          <button
            type="button"
            onClick={onBack}
            className="md:hidden text-[#8696A0] hover:text-[#E9EDEF] p-1.5 -ml-1 rounded-full transition-standard cursor-pointer"
            aria-label="Back to chat list"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.75} />
          </button>

          {/* Avatar (40px) */}
          {isChannel ? (
            <ChannelAvatar channelId={chat.id} size={40} isLocked={!chat.hasAccess} />
          ) : (
            <Avatar uid={chat.participantUid} name={chat.name} size={40} />
          )}

          {/* Chat Title & Status Subtitle */}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-[#E9EDEF] truncate leading-tight flex items-center gap-1.5">
              <span>{isChannel ? displayChannelName(chat.name) : chat.name}</span>
              {!chat.hasAccess && (
                <span
                  title="This channel requires administrator approval or membership to access."
                  className="cursor-help inline-flex items-center text-[#F59E0B]"
                >
                  <Lock className="w-3.5 h-3.5" strokeWidth={1.75} />
                </span>
              )}
            </h2>

            {/* Subtitle: Typing indicator or member info */}
            {typingUsers.length > 0 ? (
              <div className="flex items-center gap-1.5 text-[12px] truncate leading-normal text-[#8696A0] mt-0.5">
                <span>
                  {typingUsers.length === 1
                    ? `${typingUsers[0].name} is typing...`
                    : 'Several people are typing...'}
                </span>
                <span className="inline-flex items-center gap-1 ml-0.5">
                  <span className="w-1 h-1 rounded-full bg-[#8696A0] animate-pulse" />
                  <span className="w-1 h-1 rounded-full bg-[#8696A0] animate-pulse [animation-delay:200ms]" />
                  <span className="w-1 h-1 rounded-full bg-[#8696A0] animate-pulse [animation-delay:400ms]" />
                </span>
              </div>
            ) : isChannel && isApprovedAdmin && !chat.hasAccess ? (
              <div className="flex items-center gap-1.5 text-[12px] truncate leading-normal text-[#8696A0] mt-0.5">
                <span>Add yourself to this channel in Roles and channels to moderate it</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[12px] truncate leading-normal text-[#8696A0] mt-0.5">
                {isChannel ? (
                  <>
                    <Users className="w-3.5 h-3.5 flex-shrink-0 text-[#8696A0]" strokeWidth={1.75} />
                    <span>
                      {chat.memberCount !== undefined && chat.memberCount > 0
                        ? `Visible to ${chat.memberCount} member${chat.memberCount === 1 ? '' : 's'}`
                        : 'Visible to channel members'}
                    </span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 flex-shrink-0 text-[#8696A0]" strokeWidth={1.75} />
                    <span>Only you and {chat.name} can see this chat</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right header controls: Calendar Meetings, Search icon button, Mute toggle/Channel menu, & Access controlled badge */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Calendar icon button (aria-label "Meetings", 44px tap area) with small count badge */}
          <button
            type="button"
            onClick={() => setIsMeetingsPanelOpen((prev) => !prev)}
            className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors cursor-pointer relative ${
              isMeetingsPanelOpen
                ? 'text-[#00A884] bg-white/[0.08]'
                : 'text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.05]'
            }`}
            aria-label="Meetings"
            title="Meetings"
          >
            <Calendar className="w-5 h-5" strokeWidth={1.75} />
            {upcomingMeetingCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#00A884] text-white text-[10px] font-bold flex items-center justify-center tabular-nums leading-none">
                {upcomingMeetingCount}
              </span>
            )}
          </button>

          {/* Conversation Search Toggle Button */}
          <button
            type="button"
            onClick={() => setIsSearchOpen((prev) => !prev)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isSearchOpen
                ? 'text-[#00A884] bg-white/[0.08]'
                : 'text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.05]'
            }`}
            title="Search loaded messages"
            aria-label="Search loaded messages"
          >
            <Search className="w-4 h-4" strokeWidth={1.75} />
          </button>

          {/* Channel Menu Dropdown (Mute/Unmute Notifications) */}
          {isChannel && (
            <div className="relative">
              <button
                ref={channelMenuButtonRef}
                type="button"
                onClick={() => setShowChannelMenu((prev) => !prev)}
                className={`p-2 rounded-full transition-colors cursor-pointer ${
                  isChannelMuted(chat.id)
                    ? 'text-[#F59E0B] bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20'
                    : 'text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.05]'
                }`}
                title={isChannelMuted(chat.id) ? 'Channel muted (click for options)' : 'Channel options'}
                aria-label="Channel options menu"
              >
                {isChannelMuted(chat.id) ? (
                  <BellOff className="w-4 h-4" strokeWidth={1.75} />
                ) : (
                  <MoreVertical className="w-4 h-4" strokeWidth={1.75} />
                )}
              </button>

              {showChannelMenu && (
                <div
                  ref={channelMenuRef}
                  className="absolute right-0 top-10 w-52 bg-[#233138] rounded-[10px] border border-white/[0.08] shadow-2xl py-1.5 z-50 animate-fadeIn"
                >
                  <button
                    type="button"
                    onClick={() => {
                      toggleMuteChannel(chat.id);
                      setShowChannelMenu(false);
                      showToast(
                        isChannelMuted(chat.id)
                          ? `Unmuted ${displayChannelName(chat.name)}`
                          : `Muted ${displayChannelName(chat.name)}`
                      );
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-[13px] text-[#E9EDEF] hover:bg-[#182229] flex items-center gap-2.5 transition-colors duration-150 cursor-pointer min-h-[44px]"
                  >
                    {isChannelMuted(chat.id) ? (
                      <>
                        <Bell className="w-4 h-4 text-[#00A884]" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-[#E9EDEF]">Unmute channel</span>
                          <span className="text-[11px] text-[#8696A0]">Receive notifications</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <BellOff className="w-4 h-4 text-[#8696A0]" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-[#E9EDEF]">Mute channel</span>
                          <span className="text-[11px] text-[#8696A0]">Silence unread tab counts</span>
                        </div>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Access controlled badge */}
          <div
            title="Access controlled"
            className="flex items-center gap-1.5 text-[12px] text-[#8696A0] bg-[#202C33] px-2.5 py-1 rounded-[6px] border border-white/[0.06] select-none cursor-default"
          >
            <Lock className="w-3.5 h-3.5 text-[#00A884] flex-shrink-0" strokeWidth={1.75} />
            <span className="hidden sm:inline">Access controlled</span>
          </div>
        </div>
      </div>

      {/* Muted line under channel header for admins when not a member of this channel */}
      {isChannel && isApprovedAdmin && !chat.hasAccess && (
        <div className="bg-[#182229] border-b border-white/[0.06] px-4 py-2 text-[12px] text-[#8696A0] flex items-center gap-2 select-none flex-shrink-0">
          <Shield className="w-3.5 h-3.5 text-[#8696A0] flex-shrink-0" strokeWidth={1.75} />
          <span>Add yourself to this channel in Roles and channels to moderate it</span>
        </div>
      )}

      {/* CONVERSATION SEARCH BAR */}
      {isSearchOpen && (
        <div className="bg-[#1F2C33] border-b border-white/[0.08] px-4 py-2.5 flex flex-col gap-2 z-20 shadow-lg animate-fadeIn select-none flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative flex items-center">
              <Search className="w-4 h-4 text-[#8696A0] absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search loaded messages..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentMatchIndex(0);
                }}
                className="w-full h-[36px] pl-9 pr-3 rounded-[8px] bg-[#2A3942] text-[#E9EDEF] placeholder-[#8696A0] text-[13px] border border-transparent focus:border-[#00A884] focus:outline-none"
              />
            </div>

            {/* Result count */}
            {searchQuery.trim() && (
              <div className="text-[12px] text-[#8696A0] font-mono tabular-nums whitespace-nowrap px-1">
                {matchingMessageIds.length > 0
                  ? `${currentMatchIndex + 1} of ${matchingMessageIds.length}`
                  : '0 of 0'}
              </div>
            )}

            {/* Up arrow */}
            <button
              type="button"
              onClick={handlePrevMatch}
              disabled={matchingMessageIds.length === 0}
              className="p-1.5 rounded text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Previous match"
              aria-label="Previous match"
            >
              <ChevronUp className="w-4 h-4" />
            </button>

            {/* Down arrow */}
            <button
              type="button"
              onClick={handleNextMatch}
              disabled={matchingMessageIds.length === 0}
              className="p-1.5 rounded text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Next match"
              aria-label="Next match"
            >
              <ChevronDown className="w-4 h-4" />
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
              }}
              className="p-1.5 rounded text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.05] transition-colors cursor-pointer"
              title="Close search"
              aria-label="Close search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* No matches banner */}
          {searchQuery.trim() && matchingMessageIds.length === 0 && (
            <div className="flex items-center justify-between text-[12px] text-[#8696A0] pt-1.5 border-t border-white/[0.04]">
              <span>No matches in loaded messages</span>
              {hasEarlierMessages && onLoadEarlier && (
                <button
                  type="button"
                  onClick={onLoadEarlier}
                  disabled={isLoadingEarlier}
                  className="text-[#00A884] hover:underline font-medium cursor-pointer disabled:opacity-50"
                >
                  {isLoadingEarlier ? 'Loading...' : 'Load earlier messages'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-0 scrollbar-thin"
      >
        {/* Centered pill for restricted history access */}
        {showHistoryPill && (
          <div className="flex justify-center my-3 select-none">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#182229] border border-white/[0.08] text-[12px] text-[#8696A0] shadow-sm">
              <Clock className="w-3.5 h-3.5 text-[#8696A0] flex-shrink-0" strokeWidth={1.75} />
              <span>Earlier messages aren't available to you</span>
              <button
                type="button"
                onClick={() => setIsRequestDialogOpen(true)}
                className="text-[#00A884] hover:underline font-medium ml-0.5 cursor-pointer"
              >
                Request earlier history
              </button>
            </div>
          </div>
        )}

        {/* Load Earlier Messages Button */}
        {hasEarlierMessages && (
          <div className="flex justify-center my-3 select-none">
            <button
              type="button"
              onClick={onLoadEarlier}
              disabled={isLoadingEarlier}
              className="px-3.5 py-1.5 rounded-[8px] bg-[#1F2C33] hover:bg-[#2A3942] border border-white/[0.08] text-[12px] text-[#00A884] font-medium transition-standard cursor-pointer disabled:opacity-50"
            >
              {isLoadingEarlier ? 'Loading messages...' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {chat.messages.length === 0 ? (
          /* Empty state */
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#8696A0]">
            <div className="w-12 h-12 rounded-full bg-[#1F2C33] border border-white/[0.08] flex items-center justify-center mb-3 text-[#00A884]">
              <MessageSquare className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <p className="text-[15px] font-semibold text-[#E9EDEF] mb-1">No messages yet</p>
            <p className="text-[13px] text-[#8696A0]">Messages are visible only to the people in each conversation.</p>
          </div>
        ) : (
          <>
            {/* Centered Date Separator Pill */}
            <div className="flex justify-center my-3 select-none">
              <div className="bg-[#182229] border border-white/[0.06] text-[#8696A0] text-[11px] font-medium px-3 py-1 rounded-[6px] shadow-sm">
                Today
              </div>
            </div>

            {/* Message bubbles */}
            {chat.messages.map((msg, index) => {
              const prevMsg = index > 0 ? chat.messages[index - 1] : null;
              const isGrouped = isMessageGrouped(msg, prevMsg);
              const isCurrentSearchResult =
                matchingMessageIds.length > 0 &&
                matchingMessageIds[currentMatchIndex] === msg.id;

              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isChannel={isChannel}
                  conversationType={chat.type}
                  conversationId={chat.id}
                  isGrouped={isGrouped}
                  hideSenderHeader={isGrouped}
                  allMessages={chat.messages}
                  searchQuery={isSearchOpen ? searchQuery : undefined}
                  isCurrentSearchResult={isCurrentSearchResult}
                  isAdmin={isAdminAndMember}
                  onReply={handleReplyMessage}
                  onEdit={handleEditMessage}
                  onDelete={(m) => setDeletingMessage(m)}
                  onModeratorRemove={(m) => setModeratingMessage(m)}
                  onReplyClick={handleReplyClick}
                  onRetry={onRetryFileMessage}
                  onReport={() =>
                    openReportModal({
                      type: 'message',
                      conversationType: chat.type,
                      conversationId: chat.id,
                      messageId: msg.id,
                    })
                  }
                />
              );
            })}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Floating 'Scroll to latest' Button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-20 right-6 z-20 w-10 h-10 rounded-full bg-[#1F2C33] hover:bg-[#2A3942] border border-white/[0.12] text-[#8696A0] hover:text-[#E9EDEF] flex items-center justify-center shadow-lg transition-standard cursor-pointer"
          aria-label="Scroll to newest messages"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" strokeWidth={1.75} />
          {newMessagesWhileScrolled > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-[#00A884] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums">
              {newMessagesWhileScrolled}
            </span>
          )}
        </button>
      )}

      {/* Message Composer */}
      <Composer
        onSendMessage={onSendMessage}
        onSendFileMessage={onSendFileMessage}
        disabled={!chat.hasAccess}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
        onSaveEdit={handleSaveEdit}
        onTyping={handleTyping}
        onClearTyping={handleClearTyping}
      />

      {/* Request earlier history modal */}
      {isRequestDialogOpen && (
        <RequestHistoryDialog
          isOpen={isRequestDialogOpen}
          onClose={() => setIsRequestDialogOpen(false)}
          uid={currentUser.uid}
          userName={currentUser.fullName}
          channelId={chat.id}
          channelName={chat.name}
          onSuccessToast={(msg) => showToast(msg)}
        />
      )}

      {/* Meetings Side Panel */}
      <ConversationMeetingsPanel
        isOpen={isMeetingsPanelOpen}
        onClose={() => setIsMeetingsPanelOpen(false)}
        conversationType={chat.type}
        conversationId={chat.id}
        conversationName={chat.name}
        currentUser={currentUser}
        isChannelMember={chat.hasAccess}
        onMeetingCountChange={(count) => setPanelMeetingsCount(count)}
      />
    </div>
  );
};
