import React, { useState, useRef } from 'react';
import { X, Search, Users, MessageSquarePlus, Building2 } from 'lucide-react';
import { DirectoryUser } from '../../types';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface DirectoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onSelectUser: (user: DirectoryUser) => void;
}

export const DirectoryDialog: React.FC<DirectoryDialogProps> = ({
  isOpen,
  onClose,
  currentUserId,
  onSelectUser,
}) => {
  const { directoryUsers, directoryLoading } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, isOpen, { onEscape: onClose });

  if (!isOpen) return null;

  const users = directoryUsers.filter((u) => u.uid !== currentUserId);

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q)
    );
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-[460px] bg-[#1F2C33] rounded-[16px] border border-white/[0.08] shadow-2xl p-6 text-left relative flex flex-col max-h-[85vh] outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-[#00A884]/15 border border-[#00A884]/30 flex items-center justify-center text-[#00A884]">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[18px] font-semibold text-[#E9EDEF]">
                New Direct Message
              </h2>
              <p className="text-[12px] text-[#8696A0]">
                Select an approved colleague from the staff directory
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-[#8696A0] hover:text-[#E9EDEF] p-1 rounded-full hover:bg-white/[0.05] transition-standard cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="py-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-[#8696A0] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={1.75}
            />
            <input
              type="text"
              autoFocus
              placeholder="Search by name or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[40px] pl-10 pr-3.5 rounded-[10px] bg-[#2A3942] border border-white/[0.08] text-[#E9EDEF] text-[13px] placeholder-[#8696A0] focus:outline-none focus:border-[#00A884] transition-standard"
            />
          </div>
        </div>

        {/* Users list */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04] scrollbar-thin -mx-2 px-2">
          {directoryLoading ? (
            <div className="py-12 text-center text-[#8696A0] text-[13px]">
              Loading directory...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-[#8696A0] text-[13px] select-none">
              <Users className="w-8 h-8 mx-auto mb-2 text-[#8696A0]/40" strokeWidth={1.5} />
              <p className="font-semibold text-[#E9EDEF] mb-0.5">
                {searchQuery ? 'No staff found' : 'No other staff members'}
              </p>
              <p className="text-[12px]">
                {searchQuery
                  ? `No colleagues match "${searchQuery}"`
                  : 'Approved staff members will appear here.'}
              </p>
            </div>
          ) : (
            filteredUsers.map((colleague) => {
              return (
                <button
                  key={colleague.uid}
                  type="button"
                  onClick={() => {
                    onSelectUser(colleague);
                    onClose();
                  }}
                  className="w-full p-3 flex items-center justify-between text-left rounded-[10px] hover:bg-white/[0.04] transition-standard cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar uid={colleague.uid} name={colleague.displayName} size={40} />
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-[#E9EDEF] truncate group-hover:text-[#00A884] transition-colors">
                        {colleague.displayName}
                      </div>
                      <div className="text-[12px] text-[#8696A0] flex items-center gap-1 mt-0.5 truncate">
                        <Building2 className="w-3 h-3 text-[#8696A0] flex-shrink-0" strokeWidth={1.75} />
                        <span className="truncate">{colleague.department}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[12px] text-[#00A884] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Message &rarr;
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
