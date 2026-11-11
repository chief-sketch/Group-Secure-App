import React, { useRef } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { OrgUser } from '../../types';
import { Avatar } from '../common/Avatar';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { HoldToConfirmButton } from '../common/HoldToConfirmButton';

interface DeleteUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  user: OrgUser | null;
  isDeleting: boolean;
}

export const DeleteUserDialog: React.FC<DeleteUserDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  user,
  isDeleting,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, isOpen, {
    onEscape: () => {
      if (!isDeleting) onClose();
    },
  });

  if (!isOpen || !user) return null;

  const roleLabel =
    user.role === 'admin'
      ? 'Administrator'
      : user.role === 'team_lead'
      ? 'Team Lead'
      : 'Staff Member';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 modal-scrim-animate"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-[460px] bg-[#1F2C33] rounded-[16px] border border-white/[0.08] shadow-2xl p-6 text-left select-none outline-none modal-content-animate"
      >
        {/* Header Icon & Title */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-red-500/15 border border-red-500/30 text-red-400">
            <Trash2 className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <h3
              id="delete-dialog-title"
              className="text-[17px] sm:text-[18px] font-semibold text-[#E9EDEF] leading-tight"
            >
              Permanently delete account?
            </h3>
            <p className="text-[12px] text-red-400 font-medium mt-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>This action cannot be undone.</span>
            </p>
          </div>
        </div>

        {/* User Card Summary */}
        <div className="p-3.5 bg-[#111B21] rounded-[10px] border border-white/[0.06] mb-4 flex items-center gap-3">
          <Avatar uid={user.id} name={user.fullName} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-semibold text-[#E9EDEF] truncate">
                {user.fullName}
              </span>
              <span className="text-[11px] text-[#8696A0] uppercase font-mono tracking-wider">
                {roleLabel}
              </span>
            </div>
            <p className="text-[12px] text-[#8696A0] truncate">{user.email}</p>
            <div className="text-[11px] text-[#8696A0] mt-0.5 flex items-center gap-1.5">
              <span>{user.department || 'Operations'}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{user.status}</span>
            </div>
          </div>
        </div>

        {/* Description & Impact Warning */}
        <div id="delete-dialog-desc" className="text-[13px] text-[#8696A0] leading-relaxed mb-6 space-y-2">
          <p>
            Deleting this user will permanently remove their profile and staff directory card.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-[12px] text-[#8696A0]">
            <li>Active sessions will be immediately terminated.</li>
            <li>The user will lose access to all channels, direct messages, and meetings.</li>
            <li>An irreversible audit event will be recorded in system logs.</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 min-h-[44px] h-[44px] rounded-[12px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <HoldToConfirmButton
            label="Delete account"
            holdingLabel="Hold to delete..."
            confirmedLabel="Deleting account..."
            onConfirm={onConfirm}
            disabled={isDeleting}
            variant="danger"
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
};
