import React, { useState, useEffect, useRef } from 'react';
import { Trash2, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useApp } from '../../context/AppContext';
import { HoldToConfirmButton } from '../common/HoldToConfirmButton';

interface ClearActivityDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClearActivityDialog: React.FC<ClearActivityDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { clearGovernanceActivity, currentSession } = useApp();
  const [isClearing, setIsClearing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, isOpen, { onEscape: onClose });

  useEffect(() => {
    if (isOpen) {
      setIsClearing(false);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmClear = async () => {
    if (isClearing) return;
    setIsClearing(true);
    setErrorMessage(null);
    try {
      await clearGovernanceActivity();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to clear governance activity. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  const adminDisplayName = currentSession?.fullName || currentSession?.email || 'Administrator';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-activity-title"
      aria-describedby="clear-activity-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isClearing) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 modal-scrim-animate"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-[460px] bg-[#17232A] rounded-[20px] border border-[#2C3B44] shadow-2xl p-6 select-none relative outline-none modal-content-animate font-montserrat"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isClearing}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-40"
          aria-label="Close clear activity dialog"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>

        {/* Header with Danger Badge */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-xl bg-[#E5484D]/15 border border-[#E5484D]/30 text-[#FF6B6B] flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5" strokeWidth={2} />
          </div>
          <div>
            <h2
              id="clear-activity-title"
              className="text-[17px] font-semibold text-[#E9EDEF] leading-snug"
            >
              Clear Governance Activity
            </h2>
            <p className="text-[12px] text-[#8696A0]">
              Administrative log purge and feed reset
            </p>
          </div>
        </div>

        {/* Explanation Alert */}
        <div className="p-3.5 rounded-xl bg-[#0B1419] border border-[#2C3B44] mb-4 space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <p id="clear-activity-desc" className="text-[13px] text-[#D1D7DB] leading-relaxed">
              This will permanently purge current governance activity and audit records from Firestore and reset the Recent Activity feed.
            </p>
          </div>
          <div className="flex items-start gap-2.5 pt-1 border-t border-[#2C3B44]/50">
            <ShieldAlert className="w-4 h-4 text-[#3DDBB4] flex-shrink-0 mt-0.5" />
            <p className="text-[11.5px] text-[#8696A0] leading-relaxed">
              A single authoritative audit log entry will be created documenting that <span className="text-[#3DDBB4] font-medium">{adminDisplayName}</span> performed this log clearance.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-[#E5484D]/15 border border-[#E5484D]/30 text-[#FF6B6B] text-[12.5px]">
            {errorMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#2C3B44]">
          <button
            type="button"
            onClick={onClose}
            disabled={isClearing}
            className="h-10 px-4 rounded-xl text-[13.5px] font-medium text-[#D1D7DB] hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>

          <HoldToConfirmButton
            onConfirm={handleConfirmClear}
            label="Hold to Clear Activity"
            holdingLabel="Clearing logs in 1s..."
            confirmedLabel="Activity Cleared"
            icon={<Trash2 className="w-4 h-4" />}
            durationMs={1000}
            variant="danger"
            disabled={isClearing}
            isLoading={isClearing}
            className="min-w-[195px] h-10"
            hintText="Hold 1s to clear"
          />
        </div>
      </div>
    </div>
  );
};
