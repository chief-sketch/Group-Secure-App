import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
  Trash2,
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
import { ClearChannelDialog } from './ClearChannelDialog';
import { ConversationMeetingsPanel } from '../meetings/ConversationMeetingsPanel';
import { useApp } from '../../context/AppContext';
import { displayChannelName } from '../../lib/channelAvatars';
import { MessageAreaSkeleton } from '../common/ShimmerSkeleton';
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
  isLoadingMessages?: boolean;
}

const getChannelBadgeColors = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('finance')) return { bg: 'bg-[#382F18]', text: 'text-[#F5A623]' };
  if (lower.includes('it') || lower.includes('support')) return { bg: 'bg-[#162D3D]', text: 'text-[#38BDF8]' };
  if (lower.includes('exec') || lower.includes('board')) return { bg: 'bg-[#2E1A3D]', text: 'text-[#C084FC]' };
  return { bg: 'bg-[#13382F]', text: 'text-[#20E39F]' };
};

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
  isLoadingMessages = false,
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

  const handleMeetingCountChange = useCallback((count: number) => {
    setPanelMeetingsCount(count);
  }, []);

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

  // Motion tracking for new message arrivals
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const activeChatIdRef = useRef<string>(chat.id);

  if (activeChatIdRef.current !== chat.id) {
    activeChatIdRef.current = chat.id;
    knownMessageIdsRef.current = new Set(chat.messages.map((m) => m.id));
  } else if (knownMessageIdsRef.current.size === 0 && chat.messages.length > 0) {
    knownMessageIdsRef.current = new Set(chat.messages.map((m) => m.id));
  }

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
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

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

  const formattedClearedAt = useMemo(() => {
    if (!chat.clearedAt) return null;
    let date: Date | null = null;
    if (chat.clearedAt instanceof Date) date = chat.clearedAt;
    else if (typeof chat.clearedAt.toDate === 'function') date = chat.clearedAt.toDate();
    else if (typeof chat.clearedAt.seconds === 'number') date = new Date(chat.clearedAt.seconds * 1000);
    if (!date || isNaN(date.getTime())) return null;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [chat.clearedAt]);

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
    if (!currentMsg.isOutgoing && currentMsg.senderId !== prevMsg.senderId) return false;

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

      {/* Conversation Header: 64px matching mockup */}
      <div className="h-[64px] bg-[#0F1D24] border-b border-white/[0.06] px-4 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button (Mobile only - 44px tap area) */}
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center md:hidden text-[#8696A0] hover:text-[#E9EDEF] -ml-2 rounded-full transition-standard cursor-pointer"
            aria-label="Back to chat list"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.75} />
          </button>

          {/* Channel badge with # or Direct Avatar */}
          {isChannel ? (
            <div
              className={`w-10 h-10 rounded-[10px] ${getChannelBadgeColors(chat.name).bg} ${
                getChannelBadgeColors(chat.name).text
              } flex items-center justify-center font-bold text-[18px] flex-shrink-0 select-none shadow-sm relative`}
            >
              #
              {!chat.hasAccess && (
                <div
                  title="Restricted channel"
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#0F1D24] border border-white/[0.1] flex items-center justify-center text-[#F5A623] shadow-sm"
                >
                  <Lock className="w-2.5 h-2.5" strokeWidth={2} />
                </div>
              )}
            </div>
          ) : (
            <Avatar uid={chat.participantUid} name={chat.name} size={40} />
          )}

          {/* Chat Title & Status Subtitle */}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15.5px] font-bold text-white truncate leading-tight flex items-center gap-1.5">
              <span>{isChannel ? displayChannelName(chat.name) : chat.name}</span>
              {!chat.hasAccess && (
                <span
                  title="This channel requires administrator approval or membership to access."
                  className="cursor-help inline-flex items-center text-[#F5A623]"
                >
                  <Lock className="w-3.5 h-3.5" strokeWidth={1.75} />
                </span>
              )}
            </h2>

            {/* Subtitle: Typing indicator or member info */}
            {typingUsers.length > 0 ? (
              <div className="flex items-center gap-1.5 text-[12px] truncate leading-normal text-[#20E39F] mt-0.5 font-medium">
                <span>
                  {typingUsers.length === 1
                    ? `${typingUsers[0].name} is typing...`
                    : 'Several people are typing...'}
                </span>
                <span className="inline-flex items-center gap-1 ml-0.5">
                  <span className="w-1 h-1 rounded-full bg-[#20E39F] animate-pulse" />
                  <span className="w-1 h-1 rounded-full bg-[#20E39F] animate-pulse [animation-delay:200ms]" />
                  <span className="w-1 h-1 rounded-full bg-[#20E39F] animate-pulse [animation-delay:400ms]" />
                </span>
              </div>
            ) : isChannel && isApprovedAdmin && !chat.hasAccess ? (
              <div className="flex items-center gap-1.5 text-[12px] truncate leading-normal text-[#6B7D87] mt-0.5 font-medium">
                <span>Add yourself to this channel in Roles and channels to moderate it</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[12px] truncate leading-normal text-[#6B7D87] mt-0.5 font-medium">
                {isChannel ? (
                  <span>
                    {chat.memberCount !== undefined && chat.memberCount > 0
                      ? `Visible to ${chat.memberCount} member${chat.memberCount === 1 ? '' : 's'}`
                      : 'Visible to 7 members'}
                  </span>
                ) : (
                  <span>Only you and {chat.name} can see this chat</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right header controls: Access controlled badge, Search, Meetings, Channel menu */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Access controlled badge matching mockup */}
          <div
            title="Access controlled"
            className="flex items-center gap-1.5 text-[12px] font-semibold text-[#20E39F] bg-[#122E26] border border-[#20E39F]/30 px-3 py-1 rounded-full select-none shadow-sm cursor-default"
          >
            <Lock className="w-3.5 h-3.5 text-[#20E39F] flex-shrink-0" strokeWidth={2} />
            <span className="hidden sm:inline">Access controlled</span>
          </div>

          {/* Conversation Search Toggle Button */}
          <button
            type="button"
            onClick={() => setIsSearchOpen((prev) => !prev)}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
              isSearchOpen
                ? 'text-[#20E39F] bg-white/[0.08]'
                : 'text-[#8696A0] hover:text-[#20E39F] hover:bg-white/[0.05]'
            }`}
            title="Search loaded messages"
            aria-label="Search loaded messages"
          >
            <Search className="w-4 h-4" strokeWidth={1.75} />
          </button>

          {/* Calendar Meetings button with small count badge */}
          <button
            type="button"
            onClick={() => setIsMeetingsPanelOpen((prev) => !prev)}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer relative ${
              isMeetingsPanelOpen
                ? 'text-[#20E39F] bg-white/[0.08]'
                : 'text-[#8696A0] hover:text-[#20E39F] hover:bg-white/[0.05]'
            }`}
            aria-label="Meetings"
            title="Meetings"
          >
            <Calendar className="w-4 h-4" strokeWidth={1.75} />
            {upcomingMeetingCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#20E39F] text-[#0A1A14] text-[10px] font-bold flex items-center justify-center tabular-nums leading-none">
                {upcomingMeetingCount}
              </span>
            )}
          </button>

          {/* Channel Menu Dropdown (Mute/Unmute Notifications) */}
          {isChannel && (
            <div className="relative">
              <button
                ref={channelMenuButtonRef}
                type="button"
                onClick={() => setShowChannelMenu((prev) => !prev)}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                  isChannelMuted(chat.id)
                    ? 'text-[#F5A623] bg-[#F5A623]/10 hover:bg-[#F5A623]/20'
                    : 'text-[#8696A0] hover:text-white hover:bg-white/[0.05]'
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
                  className="absolute right-0 top-11 w-52 bg-[#18262E] rounded-[12px] border border-white/[0.08] shadow-2xl py-1.5 z-50 origin-top-right menu-popover-animate"
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
                    className="w-full px-3.5 py-2.5 text-left text-[13px] text-[#E9EDEF] hover:bg-[#1E303A] flex items-center gap-2.5 transition-colors duration-150 cursor-pointer min-h-[44px]"
                  >
                    {isChannelMuted(chat.id) ? (
                      <>
                        <Bell className="w-4 h-4 text-[#20E39F]" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-white">Unmute channel</span>
                          <span className="text-[11px] text-[#8696A0]">Receive notifications</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <BellOff className="w-4 h-4 text-[#8696A0]" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-white">Mute channel</span>
                          <span className="text-[11px] text-[#8696A0]">Silence notifications</span>
                        </div>
                      </>
                    )}
                  </button>

                  {isApprovedAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowChannelMenu(false);
                        setIsClearDialogOpen(true);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-[13px] text-[#FF6B6B] hover:bg-[#E5484D]/10 flex items-center gap-2.5 transition-colors duration-150 cursor-pointer min-h-[44px] border-t border-white/[0.06]"
                    >
                      <Trash2 className="w-4 h-4 text-[#FF6B6B] flex-shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-[#FF6B6B]">Clear channel history</span>
                        <span className="text-[11px] text-[#8696A0]">Reset messages for everyone</span>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
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
                className="w-full h-[36px] pl-9 pr-3 rounded-[8px] bg-[#2A3942] text-[#E9EDEF] placeholder-[#8696A0] text-base sm:text-[13px] border border-transparent focus:border-[#00A884] focus:outline-none"
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

        {/* Cleared Channel System Event Banner */}
        {chat.clearedAt && formattedClearedAt && (
          <div className="flex justify-center my-4 select-none px-4 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#17232A] border border-[#2C3B44] text-[12px] text-[#8696A0] shadow-sm">
              <Trash2 className="w-3.5 h-3.5 text-[#FF6B6B] flex-shrink-0" strokeWidth={1.75} />
              <span>
                Channel history cleared by Administrator {chat.clearedByName || 'Admin'} on {formattedClearedAt}
                {chat.clearedReason ? ` · Reason: ${chat.clearedReason}` : ''}
              </span>
            </div>
          </div>
        )}

        {isLoadingMessages && chat.messages.length === 0 ? (
          <div className="py-2">
            <MessageAreaSkeleton />
          </div>
        ) : chat.messages.length === 0 ? (
          /* Empty state */
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#8696A0]">
            <div className="w-12 h-12 rounded-full bg-[#1F2C33] border border-white/[0.08] flex items-center justify-center mb-3 text-[#00A884]">
              {chat.clearedAt ? (
                <Trash2 className="w-6 h-6 text-[#FF6B6B]" strokeWidth={1.75} />
              ) : (
                <MessageSquare className="w-6 h-6" strokeWidth={1.75} />
              )}
            </div>
            <p className="text-[15px] font-semibold text-[#E9EDEF] mb-1">
              {chat.clearedAt ? 'Channel history cleared' : 'No messages yet'}
            </p>
            <p className="text-[13px] text-[#8696A0] max-w-sm">
              {chat.clearedAt
                ? 'An administrator cleared all previous messages in this channel. New messages sent here will start a fresh conversation.'
                : 'Messages are visible only to the people in each conversation.'}
            </p>
          </div>
        ) : (
          <>
            {/* Centered Date Separator Pill matching mockup */}
            <div className="relative flex items-center justify-center my-6 select-none">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.06]" />
              </div>
              <span className="relative px-3.5 py-0.5 rounded-full bg-[#11232B] border border-white/[0.08] text-[11px] font-semibold text-[#8696A0] tracking-wide uppercase shadow-sm">
                Today
              </span>
            </div>

            {/* Message bubbles */}
            {chat.messages.map((msg, index) => {
              const prevMsg = index > 0 ? chat.messages[index - 1] : null;
              const isGrouped = isMessageGrouped(msg, prevMsg);
              const isCurrentSearchResult =
                matchingMessageIds.length > 0 &&
                matchingMessageIds[currentMatchIndex] === msg.id;

              const isNewArrival = !knownMessageIdsRef.current.has(msg.id);
              if (isNewArrival) {
                knownMessageIdsRef.current.add(msg.id);
              }

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
                  isNewArrival={isNewArrival}
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
            <span className="absolute -top-1.5 -right-1.5 bg-[#20E39F] text-[#0A1A14] text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums">
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
        placeholder={isChannel ? `Message #${displayChannelName(chat.name)}` : `Message ${chat.name}`}
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

      {/* Clear Channel Dialog */}
      {isClearDialogOpen && (
        <ClearChannelDialog
          isOpen={isClearDialogOpen}
          onClose={() => setIsClearDialogOpen(false)}
          channelId={chat.id}
          channelName={chat.name}
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
        onMeetingCountChange={handleMeetingCountChange}
      />
    </div>
  );
};
