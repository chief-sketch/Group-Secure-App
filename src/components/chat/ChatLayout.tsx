import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Lock } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import {
  UserSession,
  ChatConversation,
  ChatMessage,
  NotificationToastData,
  DirectoryUser,
  MessageReplyTo,
} from '../../types';
import { DEFAULT_CHANNELS } from '../../data/channels';
import { Sidebar } from './Sidebar';
import { ConversationPanel } from './ConversationPanel';
import { Toast } from './Toast';
import { NotificationToast } from './NotificationToast';
import { DirectoryDialog } from './DirectoryDialog';
import { MeetingReminderToast } from '../meetings/MeetingReminderToast';
import { MyMeetingsPage } from '../meetings/MyMeetingsPage';
import { useApp } from '../../context/AppContext';
import {
  subscribeToConversationMessages,
  markConversationMessagesAsRead,
  sendChatMessage,
  sendFileChatMessage,
  subscribeToUserDirectChats,
  getOrCreateDirectChat,
  getChannelHistoryFromTimestamp,
  subscribeToUserHistoryRequests,
} from '../../lib/firebaseService';
import { getChannelDisplayName, displayChannelName, normalizeChannelId } from '../../lib/channelAvatars';
import { ProcessedFile } from '../../lib/fileProcessing';

interface ChatLayoutProps {
  user: UserSession;
  onLogout: () => void;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ user, onLogout }) => {
  const {
    notificationsEnabled,
    directoryUsers,
    isChannelMuted,
    navToChatId,
    navToMessageId,
    clearNavToChatMessage,
    meetingReminder,
    clearMeetingReminder,
    openMeetingConversation,
    isMyMeetingsPageOpen,
    setIsMyMeetingsPageOpen,
  } = useApp();

  // Active chat state
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const activeChatIdRef = useRef<string | null>(null);
  activeChatIdRef.current = activeChatId;

  // Active messages and pagination
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [messageLimit, setMessageLimit] = useState<number>(50);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState<boolean>(false);

  // Direct chats from Firestore
  const [directChatsList, setDirectChatsList] = useState<
    { id: string; participants: string[]; lastMessage?: string; lastMessageTime?: any }[]
  >([]);

  // Directory dialog modal
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);

  // In-app Notification and Toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationToastData | null>(null);

  // Map of unread counts per chat
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  // Map of latest message info per chat for chat list preview
  const [latestMessageMap, setLatestMessageMap] = useState<
    Record<string, { preview: string; time: string }>
  >({});
  // Track last known message ids to trigger notifications for new arrivals (capped at latest 200 per conversation)
  const lastKnownMsgIdRef = useRef<Record<string, string[]>>({});

  // Window focus & document visibility tracking (provides real-time feedback when app is minimized or hidden)
  const [isWindowActive, setIsWindowActive] = useState<boolean>(() => {
    return typeof document !== 'undefined' ? !document.hidden && document.hasFocus() : true;
  });
  const isWindowActiveRef = useRef<boolean>(isWindowActive);

  useEffect(() => {
    isWindowActiveRef.current = isWindowActive;
  }, [isWindowActive]);

  useEffect(() => {
    const handleFocus = () => setIsWindowActive(true);
    const handleBlur = () => setIsWindowActive(false);
    const handleVisibility = () => {
      setIsWindowActive(!document.hidden && document.hasFocus());
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // 1. Subscribe to User's Direct Chats
  useEffect(() => {
    if (!user.uid) return;
    const unsub = subscribeToUserDirectChats(user.uid, (dChats) => {
      setDirectChatsList(dChats);
    });
    return () => unsub();
  }, [user.uid]);

  // Check channel access helper (strict membership check)
  const checkAccess = (channelId: string, channelName?: string): boolean => {
    const userChannels = user.channels || [];
    const cleanName = channelName ? displayChannelName(channelName) : '';
    const normChId = normalizeChannelId(channelId);
    return userChannels.some(
      (c) =>
        c === channelId ||
        c.toLowerCase() === channelId.toLowerCase() ||
        (cleanName && (c === cleanName || c.toLowerCase() === cleanName.toLowerCase())) ||
        normalizeChannelId(c) === normChId
    );
  };

  // Count members for a channel using directory users + current user
  const getChannelMemberCount = (channelId: string, channelName: string): number => {
    const cleanName = displayChannelName(channelName).toLowerCase();
    const cId = channelId.toLowerCase();
    const normChId = normalizeChannelId(channelId);

    const pool = [...directoryUsers];
    if (!pool.some((u) => u.uid === user.uid)) {
      pool.push({
        uid: user.uid,
        displayName: user.fullName,
        department: user.department,
        channels: user.channels || [],
      });
    }

    let count = 0;
    for (const u of pool) {
      const uChannels = (u.channels || []).map((c) => displayChannelName(c).toLowerCase());
      const uNorms = (u.channels || []).map((c) => normalizeChannelId(c));
      if (uChannels.includes(cId) || uChannels.includes(cleanName) || uNorms.includes(normChId)) {
        count++;
      }
    }
    return count;
  };

  // Helper to format chat list preview for latest message
  const formatLatestMessagePreview = (msg: ChatMessage): string => {
    if (msg.deleted) {
      if (msg.deletedBy === 'admin' || msg.deletedReason) {
        return 'Message removed';
      }
      return 'Message deleted';
    }
    if (msg.type === 'file' || msg.fileId) {
      if (msg.text && msg.text.trim()) {
        return msg.text;
      }
      if (msg.fileType?.startsWith('image/')) {
        return 'Photo';
      }
      return msg.fileName ? `File: ${msg.fileName}` : 'File';
    }
    return msg.text || '';
  };

  // 3. Assemble combined chats list (Channels + Direct chats)
  const channels: ChatConversation[] = DEFAULT_CHANNELS.map((defCh) => {
    const hasAccess = checkAccess(defCh.id, defCh.name);
    const memberCount = getChannelMemberCount(defCh.id, defCh.name);
    const latestInfo = latestMessageMap[defCh.id];
    return {
      ...defCh,
      hasAccess,
      memberCount,
      unreadCount: unreadMap[defCh.id] || 0,
      lastMessage: latestInfo ? latestInfo.preview : '',
      lastMessageTime: latestInfo ? latestInfo.time : '',
      messages: activeChatId === defCh.id ? activeMessages : [],
    };
  });

  const directConversations: ChatConversation[] = directChatsList.map((dChat) => {
    const otherUid = dChat.participants.find((p) => p !== user.uid) || dChat.participants[0] || '';
    const otherUser = directoryUsers.find((u) => u.uid === otherUid);
    const displayName = otherUser?.displayName || (otherUid === user.uid ? 'You (Notes)' : 'Colleague');
    const department = otherUser?.department || 'Operations';
    const latestInfo = latestMessageMap[dChat.id];

    let lastMsg = dChat.lastMessage || '';
    let lastTime = dChat.lastMessageTime
      ? typeof dChat.lastMessageTime.toDate === 'function'
        ? dChat.lastMessageTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : ''
      : '';

    if (latestInfo) {
      lastMsg = latestInfo.preview;
      lastTime = latestInfo.time;
    }

    return {
      id: dChat.id,
      name: displayName,
      type: 'direct' as const,
      hasAccess: true,
      participantUid: otherUid,
      participantDepartment: department,
      statusSubtitle: department,
      unreadCount: unreadMap[dChat.id] || 0,
      lastMessage: lastMsg,
      lastMessageTime: lastTime,
      messages: activeChatId === dChat.id ? activeMessages : [],
    };
  });

  const allChats = [...channels, ...directConversations];
  const activeChat = allChats.find((c) => c.id === activeChatId) || null;

  // Handle programmatic navigation to a specific channel (e.g. from Reports "View message")
  useEffect(() => {
    if (navToChatId) {
      const normTarget = normalizeChannelId(navToChatId);
      const targetChat = allChats.find(
        (c) =>
          c.id === navToChatId ||
          normalizeChannelId(c.id) === normTarget ||
          normalizeChannelId(c.name) === normTarget
      );
      const canAccess =
        targetChat &&
        (targetChat.hasAccess || (user.role === 'admin' && user.status === 'approved'));
      if (targetChat && canAccess && activeChatId !== targetChat.id) {
        setActiveChatId(targetChat.id);
      }
    }
  }, [navToChatId, allChats, activeChatId]);

  // Handle scrolling to a specific message target once messages load
  useEffect(() => {
    if (navToMessageId && activeMessages.length > 0) {
      const targetEl = document.getElementById(`msg-${navToMessageId}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetEl.classList.add('bg-[#00A884]/25', 'rounded-[12px]');
        setTimeout(() => {
          targetEl.classList.remove('bg-[#00A884]/25', 'rounded-[12px]');
        }, 2000);
        clearNavToChatMessage();
      }
    }
  }, [navToMessageId, activeMessages, clearNavToChatMessage]);

  // Stable active historyFrom milliseconds (primitive value to prevent re-subscription churn)
  const activeHistoryMillis = useMemo(() => {
    if (!activeChatId) return 0;
    const isChannel = DEFAULT_CHANNELS.some((c) => c.id === activeChatId);
    if (!isChannel) return 0;
    const norm = normalizeChannelId(activeChatId);
    const entry = user.historyFrom?.[norm] || user.historyFrom?.[activeChatId];
    if (!entry) return 0;
    if (typeof entry.toMillis === 'function') return entry.toMillis();
    if (typeof entry.seconds === 'number') return entry.seconds * 1000;
    return 0;
  }, [user.historyFrom, activeChatId]);

  const activeConversationType: 'channel' | 'direct' = useMemo(() => {
    if (!activeChatId) return 'channel';
    const isChan = DEFAULT_CHANNELS.some((c) => c.id === activeChatId);
    return isChan ? 'channel' : 'direct';
  }, [activeChatId]);

  // 4. Live Subscription to the Open Conversation's Messages
  useEffect(() => {
    if (!activeChatId) {
      setActiveMessages([]);
      return;
    }

    const isChan = activeConversationType === 'channel';
    if (isChan && !checkAccess(activeChatId)) {
      setActiveMessages([]);
      return;
    }

    const historyTimestamp =
      isChan && activeHistoryMillis > 0
        ? Timestamp.fromMillis(activeHistoryMillis)
        : undefined;

    const unsub = subscribeToConversationMessages(
      activeConversationType,
      activeChatId,
      messageLimit,
      user.uid,
      (newMsgs) => {
        setActiveMessages(newMsgs);
        setIsLoadingEarlier(false);

        if (newMsgs.length > 0) {
          const latest = newMsgs[newMsgs.length - 1];
          setLatestMessageMap((prev) => ({
            ...prev,
            [activeChatId]: {
              preview: formatLatestMessagePreview(latest),
              time: latest.timestamp,
            },
          }));
        }

        // If window is currently focused & visible, clear unread for active chat
        const isDocActive =
          typeof document !== 'undefined' && !document.hidden && document.hasFocus();
        if (isDocActive) {
          setUnreadMap((prev) => {
            if (!prev[activeChatId]) return prev;
            const next = { ...prev };
            delete next[activeChatId];
            return next;
          });
        }
      },
      (err) => {
        console.warn('Could not load messages for', activeChatId, err);
        setIsLoadingEarlier(false);
      },
      true,
      historyTimestamp
    );

    return () => {
      unsub();
    };
  }, [activeChatId, activeConversationType, messageLimit, user.uid, activeHistoryMillis]);

  // When window becomes active, mark unread messages in the active chat as read
  useEffect(() => {
    if (!isWindowActive || !activeChatId) return;

    setUnreadMap((prev) => {
      if (!prev[activeChatId]) return prev;
      const next = { ...prev };
      delete next[activeChatId];
      return next;
    });

    const unreadMsgIds = activeMessages
      .filter((m) => m.senderId !== user.uid && !m.readBy?.includes(user.uid))
      .map((m) => m.id);

    if (unreadMsgIds.length > 0) {
      markConversationMessagesAsRead(activeConversationType, activeChatId, user.uid, unreadMsgIds);
    }
  }, [isWindowActive, activeChatId, activeConversationType, activeMessages.length, user.uid]);

  // Stable keys for background subscription to avoid churning Firestore listeners
  const historyFromKey = useMemo(
    () => JSON.stringify(user.historyFrom || {}),
    [user.historyFrom]
  );
  const directChatsKey = useMemo(
    () => directChatsList.map((d) => d.id).sort().join(','),
    [directChatsList]
  );

  // 5. Background Unread Counts and New Message Notification Toasts
  useEffect(() => {
    if (!user.uid) return;

    // Listen to accessible conversations for unread counting and notifications
    const unsubs: (() => void)[] = [];

    // Accessible channels
    channels.forEach((ch) => {
      if (!ch.hasAccess) return;
      const chHistoryTs = getChannelHistoryFromTimestamp(user.historyFrom, ch.id);
      const unsub = subscribeToConversationMessages(
        'channel',
        ch.id,
        20,
        user.uid,
        (msgs) => {
          const isCurrentActive = activeChatIdRef.current === ch.id;
          const isDocActive =
            typeof document !== 'undefined' &&
            !document.hidden &&
            document.hasFocus() &&
            isWindowActiveRef.current;
          const unread = isCurrentActive && isDocActive
            ? 0
            : msgs.filter((m) => m.senderId !== user.uid && !m.readBy?.includes(user.uid)).length;

          setUnreadMap((prev) => (prev[ch.id] === unread ? prev : { ...prev, [ch.id]: unread }));

          // Update latest message preview for chat list
          if (msgs.length > 0) {
            const latest = msgs[msgs.length - 1];
            setLatestMessageMap((prev) => ({
              ...prev,
              [ch.id]: {
                preview: formatLatestMessagePreview(latest),
                time: latest.timestamp,
              },
            }));
          }

          // Notification check
          if (msgs.length > 0) {
            const latest = msgs[msgs.length - 1];
            const isNotOpen = activeChatIdRef.current !== ch.id || !isDocActive;
            const isFromOther = latest.senderId !== user.uid;
            const knownIds = lastKnownMsgIdRef.current[ch.id] || [];
            const isNew = knownIds.length > 0 && !knownIds.includes(latest.id);

            if (isNotOpen && isFromOther && isNew && notificationsEnabled && !latest.deleted) {
              setNotification({
                id: `notif-${latest.id}`,
                chatId: ch.id,
                chatName: ch.name,
                senderName: latest.senderName,
                text: latest.text || (latest.type === 'file' ? (latest.fileType?.startsWith('image/') ? 'Photo' : `File: ${latest.fileName || ''}`) : ''),
                isChannel: true,
              });
            }
            // Cap at most the latest 200 message ids per conversation
            const updated = [...knownIds, ...msgs.map((m) => m.id)]
              .filter((id, idx, arr) => arr.indexOf(id) === idx)
              .slice(-200);
            lastKnownMsgIdRef.current[ch.id] = updated;
          }
        },
        undefined,
        false,
        chHistoryTs
      );
      unsubs.push(unsub);
    });

    // Direct chats
    directConversations.forEach((dc) => {
      const unsub = subscribeToConversationMessages(
        'direct',
        dc.id,
        20,
        user.uid,
        (msgs) => {
          const isCurrentActive = activeChatIdRef.current === dc.id;
          const isDocActive =
            typeof document !== 'undefined' &&
            !document.hidden &&
            document.hasFocus() &&
            isWindowActiveRef.current;
          const unread = isCurrentActive && isDocActive
            ? 0
            : msgs.filter((m) => m.senderId !== user.uid && !m.readBy?.includes(user.uid)).length;

          setUnreadMap((prev) => (prev[dc.id] === unread ? prev : { ...prev, [dc.id]: unread }));

          // Update latest message preview for chat list
          if (msgs.length > 0) {
            const latest = msgs[msgs.length - 1];
            setLatestMessageMap((prev) => ({
              ...prev,
              [dc.id]: {
                preview: formatLatestMessagePreview(latest),
                time: latest.timestamp,
              },
            }));
          }

          // Notification check
          if (msgs.length > 0) {
            const latest = msgs[msgs.length - 1];
            const isNotOpen = activeChatIdRef.current !== dc.id || !isDocActive;
            const isFromOther = latest.senderId !== user.uid;
            const knownIds = lastKnownMsgIdRef.current[dc.id] || [];
            const isNew = knownIds.length > 0 && !knownIds.includes(latest.id);

            if (isNotOpen && isFromOther && isNew && notificationsEnabled && !latest.deleted) {
              setNotification({
                id: `notif-${latest.id}`,
                chatId: dc.id,
                chatName: dc.name,
                senderName: latest.senderName,
                text: latest.text || (latest.type === 'file' ? (latest.fileType?.startsWith('image/') ? 'Photo' : `File: ${latest.fileName || ''}`) : ''),
                isChannel: false,
              });
            }
            // Cap at most the latest 200 message ids per conversation
            const updated = [...knownIds, ...msgs.map((m) => m.id)]
              .filter((id, idx, arr) => arr.indexOf(id) === idx)
              .slice(-200);
            lastKnownMsgIdRef.current[dc.id] = updated;
          }
        },
        undefined,
        false
      );
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user.uid, historyFromKey, directChatsKey, notificationsEnabled]);

  // Live member notification when an administrator approves or declines their history request
  const lastKnownHistoryReqStatusRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!user.uid) return;
    const unsub = subscribeToUserHistoryRequests(user.uid, (requests) => {
      requests.forEach((req) => {
        const prevStatus = lastKnownHistoryReqStatusRef.current[req.id];
        if (prevStatus === 'open' && req.status === 'approved') {
          const chName = getChannelDisplayName(req.channelId);
          setToastMessage(`Your request for ${chName} history was approved`);
        } else if (prevStatus === 'open' && req.status === 'declined') {
          const chName = getChannelDisplayName(req.channelId);
          setToastMessage(`Your request for ${chName} history was declined`);
        }
        lastKnownHistoryReqStatusRef.current[req.id] = req.status;
      });
    });
    return () => unsub();
  }, [user.uid]);

  // 6. Update Browser Tab Title with dynamic unread counter badge
  // When tab is in the background and there are unread messages from unmuted conversations: "(3) Group Secure App"
  // Restore plain title when tab is focused or count is 0
  useEffect(() => {
    const baseTitle = 'Group Secure App - Secure Team Messaging';
    if (isWindowActive) {
      document.title = baseTitle;
      return () => {
        document.title = baseTitle;
      };
    }

    // Tab is in background: calculate unread count excluding muted channels
    let unreadCountExcludingMuted = 0;
    Object.entries(unreadMap).forEach(([chatId, count]) => {
      if (count > 0 && !isChannelMuted(chatId)) {
        unreadCountExcludingMuted += count;
      }
    });

    if (unreadCountExcludingMuted > 0) {
      document.title = `(${unreadCountExcludingMuted}) Group Secure App`;
    } else {
      document.title = baseTitle;
    }

    return () => {
      document.title = baseTitle;
    };
  }, [unreadMap, isWindowActive, isChannelMuted]);

  // 7. Auto-dismiss Toast Message
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleSelectChat = (chat: ChatConversation) => {
    setIsMyMeetingsPageOpen(false);
    if (activeChatId !== chat.id) {
      setActiveChatId(chat.id);
      setMessageLimit(50);
      setUnreadMap((prev) => {
        if (!prev[chat.id]) return prev;
        const next = { ...prev };
        delete next[chat.id];
        return next;
      });
    }
  };

  const handleRestrictedClick = (channelName: string) => {
    if (user.role === 'admin' && user.status === 'approved') {
      const norm = normalizeChannelId(channelName);
      const target = allChats.find(
        (c) =>
          c.name === channelName ||
          c.id === channelName ||
          normalizeChannelId(c.id) === norm ||
          normalizeChannelId(c.name) === norm
      );
      if (target) {
        setActiveChatId(target.id);
        return;
      }
    }
    setToastMessage('Ask an administrator to add you');
  };

  // 8. Sending Message with Optimistic Pending Write
  const handleSendMessage = async (
    text: string,
    replyTo?: MessageReplyTo
  ) => {
    if (!activeChatId || !activeChat) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    const tempId = `temp-${Date.now()}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Show instantly with clock icon (pending write)
    const optimisticMessage: ChatMessage = {
      id: tempId,
      senderId: user.uid,
      senderName: user.fullName,
      text: trimmed,
      timestamp: nowTime,
      isOutgoing: true,
      isPending: true,
      replyTo: replyTo,
    };

    setActiveMessages((prev) => [...prev, optimisticMessage]);

    try {
      await sendChatMessage(
        activeChat.type,
        activeChatId,
        user.uid,
        user.fullName,
        trimmed,
        undefined,
        replyTo
      );
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setToastMessage('Failed to send message. Please verify network connection.');
      // Remove optimistic message on failure
      setActiveMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  // 8b. Sending File Message with Optimistic Upload State
  const handleSendFileMessage = async (
    fileData: ProcessedFile,
    caption: string = '',
    replyTo?: MessageReplyTo
  ) => {
    if (!activeChatId || !activeChat) return;

    const tempId = `temp-file-${Date.now()}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Optimistic message with file thumbnail/info
    const optimisticMessage: ChatMessage = {
      id: tempId,
      senderId: user.uid,
      senderName: user.fullName,
      text: caption,
      timestamp: nowTime,
      isOutgoing: true,
      isPending: true,
      type: 'file',
      fileName: fileData.fileName,
      fileType: fileData.fileType,
      fileSize: fileData.fileSize,
      thumb: fileData.thumb,
      fileDataUrl: fileData.isImage ? (fileData.thumb || `data:${fileData.fileType};base64,${fileData.data}`) : undefined,
      replyTo: replyTo,
    };

    setActiveMessages((prev) => [...prev, optimisticMessage]);

    try {
      await sendFileChatMessage(
        activeChat.type,
        activeChatId,
        user.uid,
        user.fullName,
        {
          fileName: fileData.fileName,
          fileType: fileData.fileType,
          fileSize: fileData.fileSize,
          data: fileData.data,
          thumb: fileData.thumb,
        },
        caption,
        replyTo
      );
    } catch (err: any) {
      console.error('Failed to send file:', err);
      // Mark as failed instead of removing so user can tap to retry
      setActiveMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, isPending: false, uploadFailed: true } : m))
      );
      setToastMessage('Failed to send file. Tap to retry.');
    }
  };

  const handleRetryFileMessage = async (msg: ChatMessage) => {
    if (!activeChatId || !activeChat || !msg.fileDataUrl) return;
    // Remove failure flag
    setActiveMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, isPending: true, uploadFailed: false } : m))
    );
    try {
      await sendFileChatMessage(
        activeChat.type,
        activeChatId,
        user.uid,
        user.fullName,
        {
          fileName: msg.fileName || 'file',
          fileType: msg.fileType || 'application/octet-stream',
          fileSize: msg.fileSize || 0,
          data: msg.fileDataUrl.split(',')[1] || '',
          thumb: msg.thumb,
        },
        msg.text || '',
        msg.replyTo
      );
    } catch (err) {
      console.error('Retry failed:', err);
      setActiveMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, isPending: false, uploadFailed: true } : m))
      );
      setToastMessage('Retry failed. Please check network connection.');
    }
  };

  // 9. Load Earlier Messages Pagination
  const handleLoadEarlier = () => {
    setIsLoadingEarlier(true);
    setMessageLimit((prev) => prev + 50);
  };

  // 10. Start Direct Chat from Directory
  const handleStartDirectChat = async (colleague: DirectoryUser) => {
    try {
      const chatId = await getOrCreateDirectChat(user.uid, colleague.uid);
      setActiveChatId(chatId);
      setMessageLimit(50);
    } catch (err) {
      console.error('Failed to open direct chat:', err);
      setToastMessage('Failed to start conversation. Please try again.');
    }
  };

  return (
    <div className="h-screen w-screen bg-[#0B141A] text-[#E9EDEF] flex overflow-hidden font-sans antialiased p-0 m-0 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}

      {/* In-App Notification Toast for New Incoming Messages */}
      <NotificationToast
        notification={notification}
        onClose={() => setNotification(null)}
        onClick={(chatId) => {
          setActiveChatId(chatId);
          setNotification(null);
        }}
      />

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

      {/* Directory Modal for Direct Messages */}
      <DirectoryDialog
        isOpen={isDirectoryOpen}
        onClose={() => setIsDirectoryOpen(false)}
        currentUserId={user.uid}
        onSelectUser={handleStartDirectChat}
      />

      {/* Left Sidebar */}
      <div
        className={`${
          activeChatId || isMyMeetingsPageOpen ? 'hidden md:flex' : 'flex'
        } w-full md:w-auto h-full`}
      >
        <Sidebar
          user={user}
          chats={allChats}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onRestrictedClick={handleRestrictedClick}
          onLogout={onLogout}
          onOpenDirectory={() => setIsDirectoryOpen(true)}
          directoryUsers={directoryUsers}
          onSelectPerson={handleStartDirectChat}
        />
      </div>

      {/* Main Conversation Panel or My Meetings Page */}
      <div
        className={`${
          !activeChatId && !isMyMeetingsPageOpen ? 'hidden md:flex' : 'flex'
        } flex-1 h-full`}
      >
        {isMyMeetingsPageOpen ? (
          <MyMeetingsPage
            onBack={() => setIsMyMeetingsPageOpen(false)}
            currentUser={user}
          />
        ) : activeChat ? (
          <ConversationPanel
            key={activeChat.id}
            chat={activeChat}
            currentUser={user}
            onBack={() => setActiveChatId(null)}
            onSendMessage={handleSendMessage}
            onSendFileMessage={handleSendFileMessage}
            onRetryFileMessage={handleRetryFileMessage}
            onLoadEarlier={handleLoadEarlier}
            hasEarlierMessages={activeMessages.length >= messageLimit}
            isLoadingEarlier={isLoadingEarlier}
          />
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 text-center bg-[#111B21] border-l border-white/[0.04] select-none">
            <div className="w-16 h-16 rounded-full bg-[#1F2C33] border border-white/[0.08] flex items-center justify-center mb-4 text-[#00A884]">
              <Lock className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <h2 className="text-[20px] font-semibold text-[#E9EDEF] title-tracking mb-1.5">
              Group Secure App
            </h2>
            <p className="text-[13px] text-[#8696A0] max-w-[340px] leading-relaxed">
              Messages are visible only to the people in each conversation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
