import React, { useState, useRef } from 'react';
import { Edit2, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ChannelAvatar } from '../common/ChannelAvatar';
import { EditChannelDialog } from './EditChannelDialog';
import {
  normalizeChannelId,
  getChannelDisplayName,
  DEFAULT_CHANNEL_MAP,
} from '../../lib/channelAvatars';
import { ChannelDoc } from '../../types';

export const ChannelsPanel: React.FC = () => {
  const { channelsList, users } = useApp();
  const [editingChannel, setEditingChannel] = useState<ChannelDoc | null>(null);
  const editButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Merge default channels with any custom channel docs from Firestore
  const allChannels: ChannelDoc[] = Object.keys(DEFAULT_CHANNEL_MAP).map((defId) => {
    const existing = channelsList.find((c) => normalizeChannelId(c.id) === defId);
    if (existing) return existing;
    const def = DEFAULT_CHANNEL_MAP[defId];
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      avatarMode: def.avatarMode,
      avatarIcon: def.avatarIcon,
      avatarColor: def.avatarColor,
      avatarPhoto: def.avatarPhoto,
    };
  });

  // Also include any additional channels in channelsList that aren't in defaults
  channelsList.forEach((c) => {
    const norm = normalizeChannelId(c.id);
    if (!allChannels.some((existing) => normalizeChannelId(existing.id) === norm)) {
      allChannels.push(c);
    }
  });

  const getMemberCount = (channel: ChannelDoc): number => {
    const normId = normalizeChannelId(channel.id);
    const normName = normalizeChannelId(channel.name);
    return users.filter(
      (u) =>
        u.status === 'approved' &&
        Array.isArray(u.channels) &&
        u.channels.some((c) => {
          const normUserCh = normalizeChannelId(c);
          return normUserCh === normId || normUserCh === normName;
        })
    ).length;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <h1 className="text-[22px] font-semibold text-[#E9EDEF] title-tracking">
            Channels
          </h1>
          <p className="text-[13px] text-[#8696A0] mt-1">
            Configure channel avatars, visual branding, and descriptions for staff discovery.
          </p>
        </div>
      </div>

      {/* Channel Rows */}
      <div className="bg-[#1F2C33] rounded-[14px] border border-white/[0.08] divide-y divide-white/[0.06] overflow-hidden shadow-xl">
        {allChannels.map((ch) => {
          const displayName = getChannelDisplayName(ch.name || ch.id);
          const memberCount = getMemberCount(ch);

          return (
            <div
              key={ch.id}
              className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* 48px Channel Avatar */}
                <ChannelAvatar channelId={ch.id} size={48} />

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-[#E9EDEF] truncate">
                      {displayName}
                    </h3>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#111B21] text-[#8696A0] border border-white/[0.06]">
                      <Users className="w-3 h-3 text-[#00A884]" />
                      <span>{memberCount} member{memberCount === 1 ? '' : 's'}</span>
                    </span>
                  </div>

                  <p className="text-[13px] text-[#8696A0] truncate mt-0.5 max-w-xl">
                    {ch.description || 'No description set'}
                  </p>

                  <div className="sm:hidden text-[11px] text-[#8696A0] mt-1 flex items-center gap-1">
                    <Users className="w-3 h-3 text-[#00A884]" />
                    <span>{memberCount} member{memberCount === 1 ? '' : 's'}</span>
                  </div>
                </div>
              </div>

              {/* Edit button */}
              <button
                ref={(el) => {
                  editButtonRefs.current[ch.id] = el;
                }}
                type="button"
                onClick={() => setEditingChannel(ch)}
                className="h-[36px] px-3.5 rounded-[8px] bg-[#2A3942] hover:bg-[#34454F] border border-white/[0.08] text-[#E9EDEF] text-[13px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                aria-label={`Edit ${displayName} channel`}
              >
                <Edit2 className="w-3.5 h-3.5 text-[#00A884]" />
                <span>Edit</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Edit Channel Dialog */}
      {editingChannel && (
        <EditChannelDialog
          isOpen={editingChannel !== null}
          channel={editingChannel}
          onClose={() => setEditingChannel(null)}
          returnFocusRef={{
            current: editButtonRefs.current[editingChannel.id] || null,
          }}
        />
      )}
    </div>
  );
};
