import React from 'react';
import { Lock, Search, MessageSquare, BellOff } from 'lucide-react';
import { ChatConversation, DirectoryUser } from '../../types';
import { Avatar } from '../common/Avatar';
import { ChannelAvatar } from '../common/ChannelAvatar';
import { useApp } from '../../context/AppContext';
import { displayChannelName } from '../../lib/channelAvatars';

interface ChatListProps {
  chats: ChatConversation[];
  activeChatId: string | null;
  onSelectChat: (chat: ChatConversation) => void;
  onRestrictedClick: (chatName: string) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
  matchingPeople?: DirectoryUser[];
  onSelectPerson?: (person: DirectoryUser) => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  onRestrictedClick,
  searchQuery,
  onClearSearch,
  matchingPeople = [],
  onSelectPerson,
}) => {
  const { isChannelMuted, currentSession } = useApp();
  const hasChats = chats.length > 0;
  const hasPeople = matchingPeople.length > 0;
  const isApprovedAdmin =
    currentSession?.role === 'admin' && currentSession?.status === 'approved';

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
        <p className="font-semibold text-[#E9EDEF] text-[14px] mb-1">
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
            className="mt-3 text-[12px] text-[#00A884] hover:underline cursor-pointer font-medium"
          >
            Clear search
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04] scrollbar-thin">
      {/* Chats Section */}
      {hasChats &&
        chats.map((chat) => {
          const isSelected = chat.id === activeChatId;
          const isChannel = chat.type === 'channel';
          const isMuted = isChannel && isChannelMuted(chat.id);
          const isRestricted = !chat.hasAccess;
          const isMessageDeleted =
            chat.lastMessage === 'Message deleted' || chat.lastMessage === 'Message removed';
          const hasUnread = chat.unreadCount > 0 && !isRestricted;

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
              className={`w-full px-3.5 py-3 flex items-center gap-3 text-left transition-standard cursor-pointer ${
                isRestricted
                  ? 'opacity-55 hover:bg-white/[0.02]'
                  : isSelected
                  ? 'bg-[#202C33]'
                  : 'hover:bg-white/[0.03]'
              }`}
            >
              {/* Avatar (40px in lists) */}
              <div className="relative flex-shrink-0">
                {isChannel ? (
                  <ChannelAvatar channelId={chat.id} size={40} isLocked={isRestricted} />
                ) : (
                  <>
                    <Avatar uid={chat.participantUid} name={chat.name} size={40} />
                    {isRestricted && (
                      <div
                        title="Ask an administrator to add you"
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#1F2C33] border border-white/[0.1] flex items-center justify-center text-[#F59E0B]"
                      >
                        <Lock className="w-2.5 h-2.5" strokeWidth={2} />
                      </div>
                    )}
                  </>
                )}

                {/* Unread indicator dot on avatar */}
                {hasUnread && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#111B21] ring-2 ${
                      isMuted
                        ? 'bg-[#8696A0] ring-white/10 opacity-70'
                        : 'bg-[#00A884] ring-[#00A884]/20'
                    }`}
                    title={`${chat.unreadCount} unread message${chat.unreadCount > 1 ? 's' : ''}${isMuted ? ' (muted)' : ''}`}
                  />
                )}
              </div>

              {/* Middle Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[14px] truncate flex items-center gap-1.5 ${
                      isRestricted
                        ? 'text-[#8696A0]'
                        : hasUnread
                        ? 'text-white font-bold'
                        : 'text-[#E9EDEF] font-medium'
                    }`}
                  >
                    <span className="truncate">
                      {isChannel ? displayChannelName(chat.name) : chat.name}
                    </span>
                    {isMuted && (
                      <span title="Channel muted" className="text-[#8696A0] flex-shrink-0">
                        <BellOff className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {isRestricted && (
                      <span className="text-[10px] text-[#F59E0B] bg-[#F59E0B]/10 px-1.5 py-0.5 rounded font-normal label-tracking">
                        Restricted
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[11px] tabular-nums flex-shrink-0 ml-2 ${
                      hasUnread ? (isMuted ? 'text-[#8696A0]' : 'text-[#00A884] font-semibold') : 'text-[#8696A0]'
                    }`}
                  >
                    {chat.lastMessageTime}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <p
                    className={`text-[13px] truncate pr-2 leading-tight ${
                      isMessageDeleted
                        ? 'italic text-[#8696A0]'
                        : hasUnread
                        ? 'text-[#E9EDEF] font-medium'
                        : 'text-[#8696A0]'
                    }`}
                  >
                    {chat.lastMessage || 'No messages yet'}
                  </p>

                  {/* Unread count badge */}
                  {hasUnread && (
                    <span
                      className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center tabular-nums flex-shrink-0 shadow-sm ${
                        isMuted
                          ? 'bg-[#8696A0]/25 text-[#8696A0] border border-white/[0.08]'
                          : 'bg-[#00A884] text-white'
                      }`}
                      title={isMuted ? 'Muted' : undefined}
                    >
                      {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

      {/* People Group from Directory Search */}
      {hasPeople && (
        <div className="border-t border-white/[0.06]">
          <div className="px-3.5 py-2 text-[11px] font-semibold text-[#00A884] uppercase tracking-wider bg-[#111B21]/90 sticky top-0">
            People
          </div>
          {matchingPeople.map((person) => (
            <button
              key={person.uid}
              type="button"
              onClick={() => onSelectPerson?.(person)}
              className="w-full px-3.5 py-2.5 flex items-center gap-3 text-left hover:bg-white/[0.03] transition-standard cursor-pointer"
            >
              <Avatar
                uid={person.uid}
                name={person.displayName}
                size={40}
                overrideMode="initials"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-[#E9EDEF] truncate">
                  {person.displayName}
                </div>
                <div className="text-[12px] text-[#8696A0] truncate">
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
