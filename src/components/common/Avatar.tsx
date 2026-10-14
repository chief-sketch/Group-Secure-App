import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getAvatarColor, getInitials } from '../../lib/avatar';

interface AvatarProps {
  uid?: string;
  name?: string;
  size?: number; // pixel size: 24, 32, 40, 48, 96, etc. Default 40
  className?: string;
  overridePhoto?: string;
  overrideColor?: string;
  overrideMode?: 'initials' | 'photo';
  showSkeleton?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  uid,
  name = '',
  size = 40,
  className = '',
  overridePhoto,
  overrideColor,
  overrideMode,
  showSkeleton = false,
}) => {
  const { getDirectoryUser, directoryLoading } = useApp();
  const [imageError, setImageError] = useState(false);

  const dirUser = uid ? getDirectoryUser(uid) : undefined;
  const displayName = name || dirUser?.displayName || 'User';

  const mode = overrideMode || dirUser?.avatarMode || 'initials';
  const photo = overridePhoto !== undefined ? overridePhoto : dirUser?.avatarPhoto;
  const customColor = overrideColor || dirUser?.avatarColor;

  const colorTheme = getAvatarColor(displayName, customColor);
  const initials = getInitials(displayName);

  // Compute font size relative to avatar size
  const fontSize = Math.max(10, Math.round(size * 0.4));

  // If initial directory is loading and skeleton is requested
  if (showSkeleton && directoryLoading && !dirUser && !name) {
    return (
      <div
        style={{ width: `${size}px`, height: `${size}px` }}
        className={`rounded-full bg-white/10 animate-pulse flex-shrink-0 ${className}`}
        aria-hidden="true"
      />
    );
  }

  // Photo mode when valid photo URL is present and not errored
  if (mode === 'photo' && photo && !imageError) {
    return (
      <div
        style={{ width: `${size}px`, height: `${size}px` }}
        className={`rounded-full overflow-hidden flex-shrink-0 border border-white/[0.1] bg-[#1F2C33] select-none ${className}`}
      >
        <img
          src={photo}
          alt={`${displayName}'s avatar`}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover rounded-full block pointer-events-none"
        />
      </div>
    );
  }

  // Initials mode (or fallback if photo missing/failed)
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: colorTheme.bg,
        color: colorTheme.text,
        border: `1px solid ${colorTheme.border}`,
        fontSize: `${fontSize}px`,
      }}
      className={`rounded-full flex items-center justify-center font-semibold select-none flex-shrink-0 tracking-wide ${className}`}
      aria-label={`${displayName}'s avatar`}
      role="img"
    >
      {initials}
    </div>
  );
};
