import React from 'react';
import { motion } from 'motion/react';
import { Lock, Search, MessageSquare, BellOff } from 'lucide-react';
import { ChatConversation, DirectoryUser } from '../../types';
import { Avatar } from '../common/Avatar';
import { useApp } from '../../context/AppContext';
import { displayChannelName, normalizeChannelId } from '../../lib/channelAvatars';

interface ChatListProps {
  chats: ChatConversation[];
  activeChatId: string | null;
  onSelectChat: (chat: ChatConversation) => void;
  onRestrictedClick: (chatName: string) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
  matchingPeople?: DirectoryUser[];
  onSelectPerson?: (person: DirectoryUser) => void;
  activeTab?: 'all' | 'channels' | 'direct';
}

const getChannelStyle = (idOrName: string) => {
  const norm = normalizeChannelId(idOrName);
  switch (norm) {
    case 'finance':
      return { bg: 'bg-[#382F18]', text: 'text-[#F5A623]' };
    case 'it-support':
      return { bg: 'bg-[#162D3D]', text: 'text-[#38BDF8]' };
    case 'executive-board':
      return { bg: 'bg-[#2E1A3D]', text: 'text-[#C084FC]' };
    case 'general':
    default:
      return { bg: 'bg-[#13382F]', text: 'text-[#20E39F]' };
  }
};

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  onRestrictedClick,
  searchQuery,
  onClearSearch,
  matchingPeople = [],
  onSelectPerson,
  activeTab = 'all',
}) => {
  const { isChannelMuted, currentSession } = useApp();
  const isApprovedAdmin =
    currentSession?.role === 'admin' && currentSession?.status === 'approved';

  const channelChats = chats.filter((c) => c.type === 'channel');
  const directChats = chats.filter((c) => c.type === 'direct');

  const hasChats = chats.length > 0;
  const hasPeople = matchingPeople.length > 0;

  if (!hasChats && !hasPeople) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#8696A0] select-none">
        <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-2.5 text-[#8696A0]">
          {searchQuery ? (
            <Search className="w-5 h-5" strokeWidth={1.75} />
          ) : (
            <MessageSquare className="w-5 h-5" strokeWidth={1.75} />
          )}
        </div>
        <p className="font-semibold text-white text-[14px] mb-1">
          {searchQuery ? `No results for "${searchQuery}"` : 'No conversations yet'}
        </p>
        <p className="text-[12px] text-[#8696A0] max-w-[220px] leading-relaxed">
          {searchQuery
            ? 'Check the spelling or try searching another name.'
            : 'Your assigned channels and team messages will appear here.'}
        </p>
        {searchQuery && onClearSearch && (
          <button
            type="button"
            onClick={onClearSearch}
            className="mt-3 text-[12px] text-[#20E39F] hover:underline cursor-pointer font-medium"
          >
            Clear search
          </button>
        )}
      </div>
    );
  }

  const renderChatItem = (chat: ChatConversation) => {
    const isSelected = chat.id === activeChatId;
    const isChannel = chat.type === 'channel';
    const isMuted = isChannel && isChannelMuted(chat.id);
    const isRestricted = !chat.hasAccess;
    const isMessageDeleted =
      chat.lastMessage === 'Message deleted' || chat.lastMessage === 'Message removed';
    const hasUnread = chat.unreadCount > 0 && !isRestricted;
    const channelStyle = getChannelStyle(chat.name);

    const handleClick = () => {
      if (isRestricted) {
        if (isApprovedAdmin) {
          onSelectChat(chat);
        } else {
          onRestrictedClick(chat.name);
        }
      } else {
        onSelectChat(chat);
      }
    };

    return (
      <button
        key={chat.id}
        type="button"
        onClick={handleClick}
        title={
          isRestricted
            ? isApprovedAdmin
              ? 'Add yourself to this channel in Roles and channels to moderate it'
              : 'Ask an administrator to add you'
            : undefined
        }
        className={`w-full px-3.5 py-2.5 flex items-center gap-3 text-left chat-row transition-colors cursor-pointer relative overflow-hidden ${
          isSelected
            ? 'text-white'
            : 'hover:bg-white/[0.03] text-[#E9EDEF]'
        } ${isRestricted ? 'opacity-60' : ''}`}
      >
        {/* Active sliding highlight via layoutId */}
        {isSelected && (
          <motion.div
            layoutId="active-chat-highlight"
            className="absolute inset-0 bg-[#14262E] border-l-[3px] border-[#20E39F] pointer-events-none"
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
          />
        )}

        {/* Channel Icon or Direct Avatar */}
        <div className="relative z-10 flex-shrink-0">
          {isChannel ? (
            <div
              className={`w-9 h-9 rounded-[10px] flex items-center justify-center font-bold text-[16px] shadow-sm ${channelStyle.bg} ${channelStyle.text}`}
            >
              #
            </div>
          ) : (
            <div className="relative">
              <Avatar uid={chat.participantUid} name={chat.name} size={36} />
              {/* Online indicator dot */}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#20E39F] border-2 border-[#0D191F]" />
            </div>
          )}

          {/* Locked Badge if Restricted */}
          {isRestricted && (
            <div
              title="Restricted channel"
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#1F2C33] border border-white/[0.1] flex items-center justify-center text-[#F59E0B]"
            >
              <Lock className="w-2.5 h-2.5" strokeWidth={2} />
            </div>
          )}
        </div>

        {/* Content Column */}
        <div className="relative z-10 flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span
              className={`text-[13.5px] truncate flex items-center gap-1.5 ${
                isSelected ? 'font-semibold text-white' : 'font-medium text-[#E9EDEF]'
              }`}
            >
              <span className="truncate">
                {isChannel ? displayChannelName(chat.name) : chat.name}
              </span>
              {isMuted && (
                <span title="Muted" className="text-[#8696A0]">
                  <BellOff className="w-3.5 h-3.5" />
                </span>
              )}
              {isRestricted && (
                <span className="text-[10px] text-[#F59E0B] bg-[#F59E0B]/10 px-1.5 py-0.2 rounded font-normal">
                  Restricted
                </span>
              )}
            </span>
            <span className="text-[11px] text-[#8696A0] tabular-nums flex-shrink-0 ml-2">
              {chat.lastMessageTime}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <p
              className={`text-[12.5px] truncate pr-2 leading-tight ${
                isMessageDeleted
                  ? 'italic text-[#8696A0]'
                  : hasUnread
                  ? 'text-white font-medium'
                  : 'text-[#8696A0]'
              }`}
            >
              {chat.lastMessage || 'No messages yet'}
            </p>

            {/* Unread count pill matching mockup with pop animation */}
            {hasUnread && (
              <span className="min-w-[19px] h-[19px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center tabular-nums flex-shrink-0 bg-[#20E39F] text-[#0A1A14] animate-badge-pop">
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-white/[0.02]">
      {/* CHANNELS SECTION */}
      {channelChats.length > 0 && (activeTab === 'all' || activeTab === 'channels') && (
        <div className="pb-1">
          <div className="px-3.5 pt-3 pb-1 text-[11px] font-bold text-[#6B7D87] tracking-wider uppercase">
            Channels
          </div>
          {channelChats.map(renderChatItem)}
        </div>
      )}

      {/* DIRECT SECTION */}
      {directChats.length > 0 && (activeTab === 'all' || activeTab === 'direct') && (
        <div className="pb-2">
          <div className="px-3.5 pt-3 pb-1 text-[11px] font-bold text-[#6B7D87] tracking-wider uppercase">
            Direct
          </div>
          {directChats.map(renderChatItem)}
        </div>
      )}

      {/* PEOPLE DIRECTORY SEARCH RESULTS */}
      {hasPeople && (
        <div className="border-t border-white/[0.06] pt-1">
          <div className="px-3.5 py-1.5 text-[11px] font-bold text-[#20E39F] uppercase tracking-wider">
            People
          </div>
          {matchingPeople.map((person) => (
            <button
              key={person.uid}
              type="button"
              onClick={() => onSelectPerson?.(person)}
              className="w-full px-3.5 py-2.5 flex items-center gap-3 text-left chat-row hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <Avatar
                uid={person.uid}
                name={person.displayName}
                size={36}
                overrideMode="initials"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-medium text-white truncate">
                  {person.displayName}
                </div>
                <div className="text-[11.5px] text-[#8696A0] truncate">
                  {person.department || 'Staff Member'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
