import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { NotificationToastData } from '../../types';
import { getAvatarColor, getInitials } from '../../lib/avatar';
import { ChannelAvatar } from '../common/ChannelAvatar';
import { displayChannelName } from '../../lib/channelAvatars';

interface NotificationToastProps {
  notification: NotificationToastData | null;
  onClose: () => void;
  onClick: (chatId: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  onClick,
}) => {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  if (!notification) return null;

  const avatar = getAvatarColor(notification.senderName);

  return (
    <div
      role="status"
      onClick={() => onClick(notification.chatId)}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:bottom-auto sm:top-6 sm:right-6 sm:left-auto sm:translate-x-0 z-50 w-[340px] max-w-[92vw] bg-[#1F2C33] border border-[#00A884]/40 rounded-[10px] shadow-xl p-3 flex items-start gap-3 cursor-pointer hover:bg-[#26353D] transition-standard select-none"
    >
      {/* Channel / Sender Avatar */}
      {notification.isChannel ? (
        <ChannelAvatar channelId={notification.chatId} size={40} className="mt-0.5" />
      ) : (
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm flex-shrink-0 mt-0.5 select-none"
          style={{
            backgroundColor: avatar.bg,
            color: avatar.text,
            border: `1px solid ${avatar.border}`,
          }}
        >
          {getInitials(notification.senderName)}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="text-[13px] font-semibold text-[#E9EDEF] truncate">
            {notification.senderName}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-[#8696A0] hover:text-[#E9EDEF] p-0.5 transition-standard -mr-1 rounded cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>

        {notification.isChannel && (
          <div className="text-[11px] text-[#00A884] font-medium mb-0.5 truncate">
            {displayChannelName(notification.chatName)}
          </div>
        )}

        <p className="text-[12px] text-[#8696A0] truncate leading-tight">
          {notification.text}
        </p>
      </div>
    </div>
  );
};
