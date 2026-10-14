import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  CHANNEL_ICONS,
  ChannelIconName,
  resolveChannelAvatarData,
  getChannelDisplayName,
} from '../../lib/channelAvatars';

export interface ChannelAvatarProps {
  channelId: string;
  size?: number; // 24, 40, 48, 96, etc. Default: 40
  isLocked?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const ChannelAvatar: React.FC<ChannelAvatarProps> = ({
  channelId,
  size = 40,
  isLocked = false,
  className = '',
  onClick,
}) => {
  const { getChannelDoc, channelsLoading } = useApp();
  const [imageError, setImageError] = useState(false);

  const channelDoc = getChannelDoc(channelId);
  const resolved = resolveChannelAvatarData(channelId, channelDoc);
  const displayName = getChannelDisplayName(resolved.name || channelId);

  // Show a skeleton circle while the channels load from Firestore if doc not yet cached
  if (channelsLoading && !channelDoc) {
    return (
      <div
        role="img"
        aria-label={`${displayName} channel avatar`}
        className={`rounded-full bg-[#202C33] animate-pulse flex-shrink-0 select-none ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Calculate icon scaling relative to circle size
  const getIconSize = (avatarSize: number): number => {
    if (avatarSize <= 24) return 13;
    if (avatarSize <= 32) return 16;
    if (avatarSize <= 44) return 20;
    if (avatarSize <= 64) return 26;
    if (avatarSize <= 96) return 44;
    return Math.round(avatarSize * 0.48);
  };

  const iconSize = getIconSize(size);
  const IconComponent = CHANNEL_ICONS[resolved.avatarIcon as ChannelIconName] || CHANNEL_ICONS.Users;

  const isPhoto = resolved.avatarMode === 'photo' && Boolean(resolved.avatarPhoto) && !imageError;

  return (
    <div
      role="img"
      aria-label={`${displayName} channel avatar`}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center rounded-full flex-shrink-0 select-none overflow-visible transition-opacity ${
        isLocked ? 'opacity-50' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Inner Avatar Circle */}
      <div
        className="w-full h-full rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
        style={{
          backgroundColor: isPhoto ? '#1F2C33' : resolved.avatarColor,
        }}
      >
        {isPhoto ? (
          <img
            src={resolved.avatarPhoto}
            alt=""
            onError={() => setImageError(true)}
            className="w-full h-full object-cover rounded-full"
            loading="lazy"
          />
        ) : (
          <IconComponent
            size={iconSize}
            strokeWidth={1.75}
            className="text-white flex-shrink-0"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Small lock badge in corner for locked/inaccessible channels */}
      {isLocked && (
        <div
          title="Restricted channel"
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#1F2C33] border border-white/[0.1] flex items-center justify-center text-[#F59E0B] shadow-sm pointer-events-none"
        >
          <Lock className="w-2.5 h-2.5" strokeWidth={2} />
        </div>
      )}
    </div>
  );
};
