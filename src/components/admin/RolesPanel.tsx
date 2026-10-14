import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  AlertTriangle,
  X,
  Sliders,
  Check,
  Building2,
  Users,
  UserPlus,
  Loader2,
  Trash2,
  UserX,
  UserCheck,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { useApp, ALL_CHANNELS } from '../../context/AppContext';
import { OrgUser, UserRole } from '../../types';
import { Avatar } from '../common/Avatar';
import { ChannelAvatar } from '../common/ChannelAvatar';
import {
  normalizeChannelId,
  getChannelDisplayName,
  displayChannelName,
} from '../../lib/channelAvatars';
import { Timestamp } from '../../lib/firebaseService';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export const RolesPanel: React.FC = () => {
  const {
    users,
    currentSession,
    updateUserRoleAndChannels,
    suspendUser,
    reactivateUser,
    reconsiderUser,
    showToast,
    getDirectoryUser,
    adminRemoveUserPhoto,
    changeUserChannelHistoryAccess,
  } = useApp();

  const activeAndSuspendedUsers = users.filter(
    (u) => u.status === 'approved' || u.status === 'suspended' || u.status === 'rejected'
  );
  const approvedAdminsCount = users.filter(
    (u) => u.role === 'admin' && u.status === 'approved'
  ).length;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(
    activeAndSuspendedUsers[0] || null
  );

  // Sync selected user with live users list from Firestore
  useEffect(() => {
    if (selectedUser) {
      const live = users.find((u) => u.id === selectedUser.id);
      if (live && live !== selectedUser) {
        setSelectedUser(live);
      }
    }
  }, [users]);

  // Suspend / Reactivate Modal State
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isSubmittingSuspend, setIsSubmittingSuspend] = useState(false);

  // Reconsider Modal State
  const [isReconsiderModalOpen, setIsReconsiderModalOpen] = useState(false);
  const [isSubmittingReconsider, setIsSubmittingReconsider] = useState(false);

  // Bulk Add to Channel State
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkChannel, setBulkChannel] = useState<string>('General');
  const [bulkHistoryOption, setBulkHistoryOption] = useState<'now' | 'full'>('now');
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);

  // Channel History Options when adding channels in the panel
  const [channelHistoryOptions, setChannelHistoryOptions] = useState<Record<string, 'now' | 'full'>>({});

  // Single user channel history change dialog
  const [changeHistoryChannel, setChangeHistoryChannel] = useState<string | null>(null);
  const [changeHistoryMode, setChangeHistoryMode] = useState<'now' | 'full'>('full');
  const [isSavingHistoryChange, setIsSavingHistoryChange] = useState(false);

  // Remove Photo Moderation State
  const [isRemovePhotoConfirmOpen, setIsRemovePhotoConfirmOpen] = useState(false);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);

  // Form State for Selected User
  const [editRole, setEditRole] = useState<UserRole>(selectedUser?.role || 'staff');
  const [editChannels, setEditChannels] = useState<string[]>(selectedUser?.channels || ['General']);

  // Privilege Conflict Warning Modal State
  const [conflictWarning, setConflictWarning] = useState<{
    message: string;
    details: string;
    pendingRole: UserRole;
    pendingChannels: string[];
  } | null>(null);

  const bulkDialogRef = useRef<HTMLDivElement>(null);
  const photoDialogRef = useRef<HTMLDivElement>(null);
  const suspendDialogRef = useRef<HTMLDivElement>(null);
  const historyDialogRef = useRef<HTMLDivElement>(null);
  const conflictDialogRef = useRef<HTMLDivElement>(null);
  const reconsiderDialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(bulkDialogRef, isBulkModalOpen, { onEscape: () => setIsBulkModalOpen(false) });
  useFocusTrap(photoDialogRef, isRemovePhotoConfirmOpen, { onEscape: () => setIsRemovePhotoConfirmOpen(false) });
  useFocusTrap(suspendDialogRef, isSuspendModalOpen, { onEscape: () => setIsSuspendModalOpen(false) });
  useFocusTrap(historyDialogRef, Boolean(changeHistoryChannel && selectedUser), { onEscape: () => setChangeHistoryChannel(null) });
  useFocusTrap(conflictDialogRef, Boolean(conflictWarning), { onEscape: () => setConflictWarning(null) });
  useFocusTrap(reconsiderDialogRef, isReconsiderModalOpen, { onEscape: () => setIsReconsiderModalOpen(false) });

  const handleConfirmReconsider = async () => {
    if (!selectedUser) return;
    setIsSubmittingReconsider(true);
    try {
      await reconsiderUser(selectedUser.id);
      setIsReconsiderModalOpen(false);
    } catch {
      // Handled in context
    } finally {
      setIsSubmittingReconsider(false);
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map((u) => u.id));
    }
  };

  const handleApplyBulk = async () => {
    if (selectedUserIds.length === 0 || !bulkChannel) return;
    setIsApplyingBulk(true);

    const usersToUpdate = activeAndSuspendedUsers.filter((u) => selectedUserIds.includes(u.id));
    let affectedCount = 0;

    for (const u of usersToUpdate) {
      if (!u.channels.includes(bulkChannel)) {
        const nextChannels = [...u.channels, bulkChannel];
        await updateUserRoleAndChannels(u.id, u.role, nextChannels, { [bulkChannel]: bulkHistoryOption });
        affectedCount++;
      }
    }

    setIsApplyingBulk(false);
    setIsBulkModalOpen(false);
    setSelectedUserIds([]);
    showToast(`Added ${affectedCount} user(s) to ${bulkChannel}`);
  };

  // Sync edit state when selected user changes
  const handleSelectUser = (user: OrgUser) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditChannels([...user.channels]);
    setChannelHistoryOptions({});
  };

  const filteredUsers = activeAndSuspendedUsers.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleChannelToggle = (ch: string) => {
    if (editChannels.includes(ch)) {
      if (editChannels.length === 1) return; // Keep at least one channel
      setEditChannels(editChannels.filter((c) => c !== ch));
    } else {
      setEditChannels([...editChannels, ch]);
      // When an admin removes someone and later adds them back, the default is "From now" again
      setChannelHistoryOptions((prev) => ({ ...prev, [ch]: 'now' }));
    }
  };

  const formatChannelHistoryLabel = (user: OrgUser, chName: string): string => {
    const normId = normalizeChannelId(chName);
    const raw = user.historyFrom?.[normId] || user.historyFrom?.[chName];
    if (!raw) return 'Full history';
    try {
      const millis =
        typeof raw.toMillis === 'function'
          ? raw.toMillis()
          : raw instanceof Date
          ? raw.getTime()
          : typeof raw === 'number'
          ? raw
          : new Date(raw).getTime();
      if (!millis || millis <= 0) return 'Full history';
      const d = typeof raw.toDate === 'function' ? raw.toDate() : new Date(millis);
      return `Sees messages from ${d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Full history';
    }
  };

  const openChangeHistoryModal = (chName: string) => {
    if (!selectedUser) return;
    const normId = normalizeChannelId(chName);
    const raw = selectedUser.historyFrom?.[normId] || selectedUser.historyFrom?.[chName];
    const millis = raw && typeof raw.toMillis === 'function' ? raw.toMillis() : 0;
    const isFull = !raw || millis === 0;
    setChangeHistoryChannel(chName);
    setChangeHistoryMode(isFull ? 'now' : 'full');
  };

  const handleConfirmChangeHistory = async () => {
    if (!selectedUser || !changeHistoryChannel) return;
    setIsSavingHistoryChange(true);
    try {
      await changeUserChannelHistoryAccess(
        selectedUser.id,
        changeHistoryChannel,
        changeHistoryMode
      );
      const normId = normalizeChannelId(changeHistoryChannel);
      setSelectedUser({
        ...selectedUser,
        historyFrom: {
          ...(selectedUser.historyFrom || {}),
          [normId]: changeHistoryMode === 'full' ? Timestamp.fromMillis(0) : Timestamp.now(),
        },
      });
      setChangeHistoryChannel(null);
    } catch (err) {
      console.error('Failed to change channel history access:', err);
    } finally {
      setIsSavingHistoryChange(false);
    }
  };

  const handleSaveClick = () => {
    if (!selectedUser) return;

    // Check 1: Admin self-demotion check
    if (
      selectedUser.email === currentSession?.email &&
      selectedUser.role === 'admin' &&
      editRole !== 'admin'
    ) {
      setConflictWarning({
        message: 'Administrative Self-Demotion Warning',
        details:
          'You are removing the Administrator role from your own active session account. Proceeding will revoke your administrative access on the next refresh or re-login.',
        pendingRole: editRole,
        pendingChannels: editChannels,
      });
      return;
    }

    // Check 2: Executive Board given to Staff (must be Team Lead or Admin)
    const hasExecutive = editChannels.includes('Executive Board');
    if (hasExecutive && editRole === 'staff') {
      setConflictWarning({
        message: 'RBAC Policy Conflict: Executive Board Access',
        details:
          'Channel Executive Board contains high-level governance and confidential audit records. Organizational RBAC policy restricts this channel to Team Lead or Admin roles. Assigning it to Staff creates an elevated privilege exception.',
        pendingRole: editRole,
        pendingChannels: editChannels,
      });
      return;
    }

    // No conflict: save directly
    executeSave(editRole, editChannels);
  };

  const executeSave = async (roleToSave: UserRole, channelsToSave: string[]) => {
    if (!selectedUser) return;
    await updateUserRoleAndChannels(selectedUser.id, roleToSave, channelsToSave, channelHistoryOptions);
    setConflictWarning(null);

    // Update local selected state
    setSelectedUser({
      ...selectedUser,
      role: roleToSave,
      channels: channelsToSave,
    });
  };

  const handleConfirmSuspendAction = async () => {
    if (!selectedUser) return;
    setIsSubmittingSuspend(true);
    try {
      if (selectedUser.status === 'suspended') {
        await reactivateUser(selectedUser.id);
        setSelectedUser((prev) => (prev ? { ...prev, status: 'approved' } : prev));
      } else {
        await suspendUser(selectedUser.id);
        setSelectedUser((prev) => (prev ? { ...prev, status: 'suspended' } : prev));
      }
      setIsSuspendModalOpen(false);
    } catch (err) {
      console.error('Error modifying user status:', err);
    } finally {
      setIsSubmittingSuspend(false);
    }
  };

  const handleConfirmRemovePhoto = async () => {
    if (!selectedUser) return;
    setIsRemovingPhoto(true);
    try {
      await adminRemoveUserPhoto(selectedUser.id, selectedUser.fullName);
      showToast(`Profile photo removed for ${selectedUser.fullName}`);
      setIsRemovePhotoConfirmOpen(false);
    } catch (err) {
      console.error('Failed to remove photo:', err);
      showToast('Failed to remove profile photo');
    } finally {
      setIsRemovingPhoto(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#00A884]/15 text-[#00A884] border border-[#00A884]/30 uppercase tracking-wider label-tracking">
            Admin
          </span>
        );
      case 'team_lead':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 uppercase tracking-wider label-tracking">
            Team Lead
          </span>
        );
      case 'staff':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.08] text-[#8696A0] border border-white/[0.1] uppercase tracking-wider label-tracking">
            Staff
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-[24px] font-semibold text-[#E9EDEF] title-tracking">
            Roles & channel permissions
          </h2>
          <p className="text-[13px] text-[#8696A0] mt-1 leading-[1.5]">
            Configure roles, channel memberships, and member account status.
          </p>
        </div>
        <div className="text-[13px] text-[#8696A0]">
          Total users: <span className="text-[#E9EDEF] font-semibold tabular-nums">{activeAndSuspendedUsers.length}</span>
        </div>
      </div>

      {/* Two Column Layout: User List and Edit Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: User Directory (5 cols) */}
        <div className="lg:col-span-5 bg-[#1F2C33] rounded-[12px] border border-white/[0.08] overflow-hidden flex flex-col">
          {/* Search Header & Bulk Action Bar */}
          <div className="p-3 border-b border-white/[0.06] bg-[#26353D]/40 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-[#8696A0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
              <input
                type="text"
                placeholder="Search approved users"
                aria-label="Search approved users"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-[40px] pl-9 pr-3 rounded-[8px] bg-[#202C33] text-[#E9EDEF] placeholder-[#8696A0] text-[13px] border border-white/[0.08] focus:border-[#00A884] focus:outline-none transition-standard"
              />
            </div>

            {/* Bulk Selection Controls */}
            <div className="flex items-center justify-between pt-1 text-[12px]">
              <label className="flex items-center gap-2 text-[#8696A0] cursor-pointer select-none hover:text-[#E9EDEF]">
                <input
                  type="checkbox"
                  checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                  onChange={handleSelectAll}
                  className="w-3.5 h-3.5 rounded border-white/20 text-[#00A884] bg-[#2A3942] cursor-pointer accent-[#00A884]"
                />
                <span>
                  {selectedUserIds.length > 0
                    ? `${selectedUserIds.length} of ${filteredUsers.length} selected`
                    : 'Select all'}
                </span>
              </label>

              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                disabled={selectedUserIds.length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#00A884] hover:bg-[#008F72] text-white font-medium transition-standard cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Bulk add to channel</span>
                {selectedUserIds.length > 0 && (
                  <span className="ml-0.5 bg-black/20 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                    {selectedUserIds.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* User List */}
          <div className="divide-y divide-white/[0.04] max-h-[540px] overflow-y-auto scrollbar-thin">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-[#8696A0] text-[13px] select-none">
                <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-2 text-[#8696A0]">
                  {searchQuery ? (
                    <Search className="w-5 h-5" strokeWidth={1.75} />
                  ) : (
                    <Users className="w-5 h-5" strokeWidth={1.75} />
                  )}
                </div>
                <p className="font-semibold text-[#E9EDEF] mb-0.5">
                  {searchQuery ? 'No users found' : 'No users yet'}
                </p>
                <p className="text-[12px] text-[#8696A0]">
                  {searchQuery
                    ? `No active staff match \u201c${searchQuery}\u201d`
                    : 'Approved staff members will appear here.'}
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-3 text-[12px] text-[#00A884] hover:underline cursor-pointer font-medium"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedUser?.id === user.id;
                const isChecked = selectedUserIds.includes(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className={`w-full p-3.5 flex items-center justify-between text-left transition-standard cursor-pointer ${
                      isSelected ? 'bg-[#202C33]' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Multi-select Checkbox */}
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelectUser(user.id)}
                        aria-label={`Select ${user.fullName}`}
                        className="w-4 h-4 rounded border-white/20 text-[#00A884] bg-[#2A3942] cursor-pointer accent-[#00A884] flex-shrink-0"
                      />

                      <Avatar uid={user.id} name={user.fullName} size={40} />
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium text-[#E9EDEF] truncate">
                          {user.fullName}
                        </div>
                        <div className="text-[12px] text-[#8696A0] font-mono truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
                      <div className="flex items-center gap-1.5">
                        {user.status === 'suspended' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#2A3942] text-[#8696A0] border border-white/[0.08] uppercase tracking-wider">
                            Suspended
                          </span>
                        ) : user.status === 'rejected' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#2A3942] text-[#8696A0] border border-white/[0.08] uppercase tracking-wider">
                            Rejected
                          </span>
                        ) : (
                          getRoleBadge(user.role)
                        )}
                      </div>
                      <span className="text-[11px] text-[#8696A0] tabular-nums">
                        {user.channels.length} {user.channels.length === 1 ? 'channel' : 'channels'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Role & Channel Assignment Editor (7 cols) */}
        <div className="lg:col-span-7 bg-[#1F2C33] rounded-[12px] border border-white/[0.08] p-6">
          {selectedUser ? (
            <div>
              {/* Selected User Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-5">
                <div className="flex items-center gap-3.5 min-w-0">
                  <Avatar uid={selectedUser.id} name={selectedUser.fullName} size={48} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[16px] font-semibold text-[#E9EDEF] truncate">
                        {selectedUser.fullName}
                      </h3>
                      {selectedUser.status === 'suspended' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#2A3942] text-[#8696A0] border border-white/[0.08] uppercase tracking-wider">
                          Suspended
                        </span>
                      )}
                      {selectedUser.status === 'rejected' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#2A3942] text-[#8696A0] border border-white/[0.08] uppercase tracking-wider">
                          Rejected
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-[#8696A0] font-mono truncate">
                      {selectedUser.email}
                    </div>
                    <div className="text-[12px] text-[#8696A0] flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-[#8696A0]" strokeWidth={1.75} />
                      <span>{selectedUser.department}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="text-right">
                    <span className="text-[11px] text-[#8696A0] block">Enrolled since</span>
                    <span className="text-[12px] text-[#E9EDEF] tabular-nums">{selectedUser.dateRegistered}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Suspend / Reactivate / Reconsider Action Button */}
                    {selectedUser.status === 'rejected' ? (
                      <button
                        type="button"
                        onClick={() => setIsReconsiderModalOpen(true)}
                        className="h-[30px] px-2.5 rounded-[8px] bg-[#00A884]/15 hover:bg-[#00A884]/25 border border-[#00A884]/40 text-[#00A884] text-[11px] font-medium flex items-center gap-1.5 transition-standard cursor-pointer"
                        title="Reconsider applicant and return to pending approvals"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reconsider</span>
                      </button>
                    ) : selectedUser.status === 'suspended' ? (
                      <button
                        type="button"
                        onClick={() => setIsSuspendModalOpen(true)}
                        className="h-[30px] px-2.5 rounded-[8px] bg-[#00A884]/15 hover:bg-[#00A884]/25 border border-[#00A884]/40 text-[#00A884] text-[11px] font-medium flex items-center gap-1.5 transition-standard cursor-pointer"
                        title="Reactivate user access"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Reactivate user</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsSuspendModalOpen(true)}
                        disabled={
                          selectedUser.id === currentSession?.uid ||
                          (selectedUser.role === 'admin' && approvedAdminsCount <= 1)
                        }
                        title={
                          selectedUser.id === currentSession?.uid
                            ? 'You cannot suspend your own account'
                            : selectedUser.role === 'admin' && approvedAdminsCount <= 1
                            ? 'Cannot suspend the last remaining administrator'
                            : 'Suspend user'
                        }
                        className="h-[30px] px-2.5 rounded-[8px] bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-medium flex items-center gap-1.5 transition-standard cursor-pointer"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Suspend user</span>
                      </button>
                    )}

                    {getDirectoryUser(selectedUser.id)?.avatarPhoto ? (
                      <button
                        type="button"
                        onClick={() => setIsRemovePhotoConfirmOpen(true)}
                        className="h-[30px] px-2.5 rounded-[8px] bg-transparent hover:bg-red-500/10 border border-red-500/30 text-red-400 hover:text-red-300 text-[11px] font-medium flex items-center gap-1.5 transition-standard cursor-pointer"
                        title="Remove profile photo and reset to initials"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove photo</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Assign Role Buttons */}
              <div className="mb-6">
                <label className="block text-[13px] text-[#8696A0] font-medium mb-2.5">
                  Assign RBAC role:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['staff', 'team_lead', 'admin'] as UserRole[]).map((r) => {
                    const isSelected = editRole === r;
                    const label = r === 'staff' ? 'Staff' : r === 'team_lead' ? 'Team Lead' : 'Admin';
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setEditRole(r)}
                        className={`h-[44px] rounded-[10px] text-[13px] font-medium transition-standard cursor-pointer border flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#00A884] text-white border-[#00A884]'
                            : 'bg-[#202C33] text-[#8696A0] border-white/[0.08] hover:text-[#E9EDEF]'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4" strokeWidth={2} />}
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assign Channels Checkboxes */}
              <div className="mb-6">
                <label className="block text-[13px] text-[#8696A0] font-medium mb-2.5">
                  Assign channel access:
                </label>
                <div className="space-y-2">
                  {ALL_CHANNELS.map((chName) => {
                    const isChecked = editChannels.includes(chName);
                    const isExecutive = chName === 'Executive Board';
                    const isExistingMember = selectedUser?.channels.includes(chName);
                    const historyLabel = selectedUser ? formatChannelHistoryLabel(selectedUser, chName) : 'Full history';
                    const historyOpt = channelHistoryOptions[chName] || 'now';

                    return (
                      <div
                        key={chName}
                        onClick={() => handleChannelToggle(chName)}
                        className={`flex items-center justify-between p-3 rounded-[10px] border transition-standard cursor-pointer select-none ${
                          isChecked
                            ? 'bg-[#202C33] border-[#00A884]/40 text-[#E9EDEF]'
                            : 'bg-[#202C33]/50 border-white/[0.06] text-[#8696A0] hover:text-[#E9EDEF]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleChannelToggle(chName)}
                            className="w-4 h-4 rounded bg-[#2A3942] border-white/20 text-[#00A884] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                          <ChannelAvatar channelId={chName} size={28} />
                          <div>
                            <span className="text-[14px] font-medium text-[#E9EDEF]">{displayChannelName(chName)}</span>
                            <span className="block text-[11px] text-[#8696A0]">
                              {isExecutive
                                ? 'Fiduciary governance & audit committee records'
                                : chName === 'General'
                                ? 'Organization-wide announcements & staff notice board'
                                : chName === 'Finance Team'
                                ? 'Financial disbursements & procurement budgets'
                                : 'Network infrastructure, VPNs & identity systems'}
                            </span>
                          </div>
                        </div>

                        {isChecked && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2"
                          >
                            {isExistingMember ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] text-[#8696A0] font-mono">
                                  {historyLabel}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openChangeHistoryModal(chName);
                                  }}
                                  className="text-[12px] text-[#00A884] hover:underline font-medium cursor-pointer"
                                >
                                  Change
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center rounded-[6px] bg-[#111B21] p-0.5 border border-white/[0.08] text-[11px]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setChannelHistoryOptions((prev) => ({ ...prev, [chName]: 'now' }))
                                  }
                                  className={`px-2 py-0.5 rounded-[4px] font-medium transition-standard ${
                                    historyOpt === 'now'
                                      ? 'bg-[#00A884] text-white shadow-sm'
                                      : 'text-[#8696A0] hover:text-[#E9EDEF]'
                                  }`}
                                >
                                  From now
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setChannelHistoryOptions((prev) => ({ ...prev, [chName]: 'full' }))
                                  }
                                  className={`px-2 py-0.5 rounded-[4px] font-medium transition-standard ${
                                    historyOpt === 'full'
                                      ? 'bg-[#00A884] text-white shadow-sm'
                                      : 'text-[#8696A0] hover:text-[#E9EDEF]'
                                  }`}
                                >
                                  Full history
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Save Changes Button: 44px tall */}
              <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[12px] text-[#8696A0]">
                  {editChannels.length} channels authorized
                </span>
                <button
                  type="button"
                  onClick={handleSaveClick}
                  className="h-[44px] px-6 rounded-[10px] bg-[#00A884] hover:bg-[#008F72] text-white text-[14px] font-medium flex items-center gap-2 transition-standard cursor-pointer"
                >
                  <Sliders className="w-4 h-4" strokeWidth={1.75} />
                  <span>Save Permissions</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-[#8696A0]">
              <Users className="w-8 h-8 mx-auto mb-2 text-[#8696A0]/40" strokeWidth={1.75} />
              <p className="text-[14px]">Select an approved user on the left to configure their role and channel permissions.</p>
            </div>
          )}
        </div>
      </div>

      {/* PRIVILEGE CONFLICT WARNING MODAL */}
      {conflictWarning && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConflictWarning(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-standard"
        >
          <div
            ref={conflictDialogRef}
            tabIndex={-1}
            className="w-full max-w-[440px] bg-[#1F2C33] rounded-[12px] border border-[#F59E0B]/30 shadow-xl p-6 text-center select-none outline-none"
          >
            <div className="w-11 h-11 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-5 h-5" strokeWidth={1.75} />
            </div>

            <h3 className="text-[18px] font-semibold text-[#E9EDEF] title-tracking mb-2 leading-tight">
              {conflictWarning.message}
            </h3>

            <p className="text-[13px] text-[#8696A0] leading-relaxed mb-6 text-left">
              {conflictWarning.details}
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() =>
                  executeSave(conflictWarning.pendingRole, conflictWarning.pendingChannels)
                }
                className="w-full h-[44px] rounded-[10px] bg-[#F59E0B] hover:bg-[#d98b0a] text-[#111B21] text-[14px] font-semibold transition-standard cursor-pointer flex items-center justify-center"
              >
                Proceed & Override Policy
              </button>
              <button
                type="button"
                onClick={() => setConflictWarning(null)}
                className="w-full h-[44px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[14px] font-medium transition-standard cursor-pointer flex items-center justify-center"
              >
                Cancel & Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ADD TO CHANNEL CONFIRMATION MODAL */}
      {isBulkModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsBulkModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-standard"
        >
          <div
            ref={bulkDialogRef}
            tabIndex={-1}
            className="w-full max-w-[480px] bg-[#1F2C33] rounded-[12px] border border-white/[0.1] shadow-2xl p-6 select-none outline-none"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-[17px] font-semibold text-[#E9EDEF]">
                  Bulk add to channel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="text-[#8696A0] hover:text-[#E9EDEF] p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[13px] text-[#8696A0] mb-4 leading-relaxed">
              Select the channel to assign to all <span className="text-[#E9EDEF] font-semibold">{selectedUserIds.length}</span> selected user(s).
            </p>

            {/* Target Channel Selector */}
            <div className="space-y-2 mb-5">
              <label className="text-[12px] font-medium text-[#8696A0] uppercase tracking-wider block">
                Target Channel
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_CHANNELS.map((ch) => {
                  const isSelected = bulkChannel === ch;
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setBulkChannel(ch)}
                      className={`p-2.5 rounded-[8px] text-[13px] font-medium text-left border transition-standard cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-[#00A884] bg-[#00A884]/10 text-[#00A884]'
                          : 'border-white/[0.08] bg-[#26353D] text-[#E9EDEF] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <ChannelAvatar channelId={ch} size={24} />
                        <span className="truncate">{displayChannelName(ch)}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message History Access Control (One control for the whole batch) */}
            <div className="mb-5">
              <label className="text-[12px] font-medium text-[#8696A0] uppercase tracking-wider block mb-2">
                Message History Access
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#26353D] rounded-[8px] border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setBulkHistoryOption('now')}
                  className={`py-2 px-3 rounded-[6px] text-[13px] font-medium transition-standard cursor-pointer text-center ${
                    bulkHistoryOption === 'now'
                      ? 'bg-[#00A884] text-white shadow-sm'
                      : 'text-[#8696A0] hover:text-[#E9EDEF]'
                  }`}
                >
                  From now (default)
                </button>
                <button
                  type="button"
                  onClick={() => setBulkHistoryOption('full')}
                  className={`py-2 px-3 rounded-[6px] text-[13px] font-medium transition-standard cursor-pointer text-center ${
                    bulkHistoryOption === 'full'
                      ? 'bg-[#00A884] text-white shadow-sm'
                      : 'text-[#8696A0] hover:text-[#E9EDEF]'
                  }`}
                >
                  Full history
                </button>
              </div>
              <p className="text-[11px] text-[#8696A0] mt-1.5">
                {bulkHistoryOption === 'now'
                  ? 'Selected members see channel messages sent from this moment onward.'
                  : 'Selected members can read full channel history from creation.'}
              </p>
            </div>

            {/* Selected Users List Confirmation */}
            <div className="mb-6">
              <label className="text-[12px] font-medium text-[#8696A0] uppercase tracking-wider block mb-2">
                Users to be updated ({selectedUserIds.length})
              </label>
              <div className="max-h-[140px] overflow-y-auto divide-y divide-white/[0.04] bg-[#26353D]/50 rounded-[8px] p-2 border border-white/[0.06] scrollbar-thin">
                {activeAndSuspendedUsers
                  .filter((u) => selectedUserIds.includes(u.id))
                  .map((u) => (
                    <div key={u.id} className="py-1 px-1.5 flex items-center justify-between text-[13px]">
                      <span className="text-[#E9EDEF] font-medium truncate">{u.fullName}</span>
                      <span className="text-[11px] text-[#8696A0] font-mono truncate ml-2">{u.email}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="flex-1 h-[42px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[13px] font-medium transition-standard cursor-pointer flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyBulk}
                disabled={isApplyingBulk}
                className="flex-1 h-[42px] rounded-[10px] bg-[#00A884] hover:bg-[#008F72] text-white text-[13px] font-semibold transition-standard cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isApplyingBulk ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Applying...</span>
                  </>
                ) : (
                  <span>Confirm & Add ({selectedUserIds.length})</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Moderation: Remove Profile Photo Confirmation Modal */}
      {isRemovePhotoConfirmOpen && selectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
        >
          <div
            ref={photoDialogRef}
            tabIndex={-1}
            className="w-full max-w-[420px] bg-[#1F2C33] rounded-[14px] border border-white/[0.08] shadow-2xl p-6 text-left outline-none"
          >
            <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <h3 className="text-[17px] font-semibold text-[#E9EDEF] text-center mb-1.5">
              Remove profile photo?
            </h3>
            <p className="text-[13px] text-[#8696A0] text-center leading-relaxed mb-6">
              Are you sure you want to remove the profile photo for <strong className="text-[#E9EDEF]">{selectedUser.fullName}</strong>? Their avatar will be reset to initials.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsRemovePhotoConfirmOpen(false)}
                disabled={isRemovingPhoto}
                className="flex-1 h-[40px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.1] text-[#E9EDEF] text-[13px] font-medium transition-standard cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemovePhoto}
                disabled={isRemovingPhoto}
                className="flex-1 h-[40px] rounded-[10px] bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-standard cursor-pointer flex items-center justify-center gap-2"
              >
                {isRemovingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Remove photo</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUSPEND / REACTIVATE USER CONFIRMATION MODAL */}
      {isSuspendModalOpen && selectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingSuspend) {
              setIsSuspendModalOpen(false);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
        >
          <div
            ref={suspendDialogRef}
            tabIndex={-1}
            className="w-full max-w-[420px] bg-[#1F2C33] rounded-[14px] border border-white/[0.08] shadow-2xl p-6 text-center select-none outline-none"
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3.5 ${
                selectedUser.status === 'suspended'
                  ? 'bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884]'
                  : 'bg-red-500/15 border border-red-500/30 text-red-400'
              }`}
            >
              {selectedUser.status === 'suspended' ? (
                <UserCheck className="w-6 h-6" strokeWidth={1.75} />
              ) : (
                <UserX className="w-6 h-6" strokeWidth={1.75} />
              )}
            </div>

            <h3 className="text-[18px] font-semibold text-[#E9EDEF] title-tracking mb-2 leading-tight">
              {selectedUser.status === 'suspended'
                ? `Reactivate ${selectedUser.fullName}?`
                : `Suspend ${selectedUser.fullName}?`}
            </h3>

            <p className="text-[13px] text-[#8696A0] leading-relaxed mb-6">
              {selectedUser.status === 'suspended'
                ? `Reactivate ${selectedUser.fullName}? Their access will be restored.`
                : `Suspend ${selectedUser.fullName}? They will lose access immediately and can't read any messages until reactivated.`}
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsSuspendModalOpen(false)}
                disabled={isSubmittingSuspend}
                className="flex-1 h-[42px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[13px] font-medium transition-standard cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSuspendAction}
                disabled={isSubmittingSuspend}
                className={`flex-1 h-[42px] rounded-[10px] text-white text-[13px] font-semibold transition-standard cursor-pointer flex items-center justify-center gap-2 ${
                  selectedUser.status === 'suspended'
                    ? 'bg-[#00A884] hover:bg-[#008F72]'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {isSubmittingSuspend ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : selectedUser.status === 'suspended' ? (
                  'Reactivate user'
                ) : (
                  'Suspend user'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE CHANNEL HISTORY MODAL */}
      {Boolean(changeHistoryChannel && selectedUser) && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingHistoryChange) {
              setChangeHistoryChannel(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-standard animate-in fade-in duration-150"
        >
          <div
            ref={historyDialogRef}
            tabIndex={-1}
            className="w-full max-w-[420px] bg-[#1F2C33] rounded-[12px] border border-white/[0.08] shadow-2xl p-6 select-none relative outline-none"
          >
            <button
              type="button"
              disabled={isSavingHistoryChange}
              onClick={() => setChangeHistoryChannel(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.06] transition-standard cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-[#E9EDEF] title-tracking">
                  Change message history access
                </h3>
                <p className="text-[12px] text-[#00A884] font-medium">
                  {getChannelDisplayName(changeHistoryChannel || '')}
                </p>
              </div>
            </div>

            <p className="text-[13px] text-[#8696A0] leading-relaxed mb-4">
              This changes which past messages <strong className="text-[#E9EDEF]">{selectedUser?.fullName}</strong> can read in <strong className="text-[#E9EDEF]">{getChannelDisplayName(changeHistoryChannel || '')}</strong>.
            </p>

            <div className="mb-5">
              <label className="block text-[12px] font-medium text-[#8696A0] mb-2 uppercase tracking-wider">
                Select access window:
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#111B21] rounded-[8px] border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setChangeHistoryMode('now')}
                  className={`py-2 px-3 rounded-[6px] text-[13px] font-medium transition-standard cursor-pointer text-center ${
                    changeHistoryMode === 'now'
                      ? 'bg-[#00A884] text-white shadow-sm'
                      : 'text-[#8696A0] hover:text-[#E9EDEF]'
                  }`}
                >
                  From now
                </button>
                <button
                  type="button"
                  onClick={() => setChangeHistoryMode('full')}
                  className={`py-2 px-3 rounded-[6px] text-[13px] font-medium transition-standard cursor-pointer text-center ${
                    changeHistoryMode === 'full'
                      ? 'bg-[#00A884] text-white shadow-sm'
                      : 'text-[#8696A0] hover:text-[#E9EDEF]'
                  }`}
                >
                  Full history
                </button>
              </div>
              <p className="text-[11px] text-[#8696A0] mt-2">
                {changeHistoryMode === 'now'
                  ? 'User will only see messages sent from this moment onward.'
                  : 'User will see all past and future messages in this channel.'}
              </p>
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                disabled={isSavingHistoryChange}
                onClick={() => setChangeHistoryChannel(null)}
                className="flex-1 h-[40px] rounded-[8px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#8696A0] hover:text-[#E9EDEF] text-[13px] font-medium transition-standard cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingHistoryChange}
                onClick={handleConfirmChangeHistory}
                className="flex-1 h-[40px] rounded-[8px] bg-[#00A884] hover:bg-[#008F72] text-white text-[13px] font-medium flex items-center justify-center gap-2 transition-standard cursor-pointer disabled:opacity-50"
              >
                {isSavingHistoryChange ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Save changes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECONSIDER APPLICANT CONFIRMATION MODAL */}
      {isReconsiderModalOpen && selectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingReconsider) {
              setIsReconsiderModalOpen(false);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
        >
          <div
            ref={reconsiderDialogRef}
            tabIndex={-1}
            className="w-full max-w-[420px] bg-[#1F2C33] rounded-[14px] border border-white/[0.08] shadow-2xl p-6 text-center select-none outline-none"
          >
            <div className="w-12 h-12 rounded-full bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center mx-auto mb-3.5">
              <RotateCcw className="w-6 h-6" strokeWidth={1.75} />
            </div>

            <h3 className="text-[18px] font-semibold text-[#E9EDEF] title-tracking mb-2 leading-tight">
              Reconsider applicant?
            </h3>

            <p className="text-[13px] text-[#8696A0] leading-relaxed mb-6">
              Are you sure you want to return <strong className="text-[#E9EDEF]">{selectedUser.fullName}</strong> to pending approvals? They will appear in Pending Approvals for channel and role assignment.
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsReconsiderModalOpen(false)}
                disabled={isSubmittingReconsider}
                className="flex-1 h-[42px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[13px] font-medium transition-standard cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReconsider}
                disabled={isSubmittingReconsider}
                className="flex-1 h-[42px] rounded-[10px] bg-[#00A884] hover:bg-[#008F72] text-white text-[13px] font-semibold transition-standard cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmittingReconsider ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  'Confirm Reconsider'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
