import React, { useState, useEffect, useRef } from 'react';
import { Trash2, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useApp } from '../../context/AppContext';
import { HoldToConfirmButton } from '../common/HoldToConfirmButton';
import { displayChannelName } from '../../lib/channelAvatars';

interface ClearChannelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
}

const PRESET_REASONS = [
  'Routine channel cleanup',
  'Confidential information cleanup',
  'Project / incident concluded',
  'Administrative reset',
  'Other / Custom reason',
];

export const ClearChannelDialog: React.FC<ClearChannelDialogProps> = ({
  isOpen,
  onClose,
  channelId,
  channelName,
}) => {
  const { clearChannelHistoryAction, currentSession } = useApp();
  const [selectedReason, setSelectedReason] = useState<string>(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [isClearing, setIsClearing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, isOpen, { onEscape: onClose });

  useEffect(() => {
    if (isOpen) {
      setSelectedReason(PRESET_REASONS[0]);
      setCustomReason('');
      setIsClearing(false);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const resolvedReason =
    selectedReason === 'Other / Custom reason'
      ? customReason.trim() || 'Administrative reset'
      : selectedReason;

  const handleConfirmClear = async () => {
    if (isClearing) return;
    setIsClearing(true);
    setErrorMessage(null);
    try {
      await clearChannelHistoryAction(channelId, resolvedReason);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to clear channel. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  const formattedName = displayChannelName(channelName);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-channel-title"
      aria-describedby="clear-channel-desc"
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
          aria-label="Close clear channel dialog"
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
              id="clear-channel-title"
              className="text-[17px] font-semibold text-[#E9EDEF] leading-snug"
            >
              Clear {formattedName}
            </h2>
            <p className="text-[12px] text-[#8696A0]">
              Administrative chat history reset
            </p>
          </div>
        </div>

        {/* Explanation Alert */}
        <div className="p-3.5 rounded-xl bg-[#0B1419] border border-[#2C3B44] mb-4 space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <p id="clear-channel-desc" className="text-[13px] text-[#D1D7DB] leading-relaxed">
              This will hide all previous messages in <span className="font-semibold text-white">{formattedName}</span> for <span className="font-semibold text-white">all members</span>.
            </p>
          </div>
          <div className="flex items-start gap-2.5 pt-1 border-t border-[#2C3B44]/50">
            <ShieldAlert className="w-4 h-4 text-[#3DDBB4] flex-shrink-0 mt-0.5" />
            <p className="text-[11.5px] text-[#8696A0] leading-relaxed">
              Messages remain safely preserved in compliance archives. An audit event will be recorded with your administrator ID ({currentSession?.fullName || currentSession?.email || 'Admin'}).
            </p>
          </div>
        </div>

        {/* Reason Selector */}
        <div className="mb-4">
          <label
            htmlFor="clear-reason-select"
            className="block text-[12px] font-semibold text-[#8696A0] uppercase tracking-wider mb-2"
          >
            Reason for clearance <span className="text-[#FF6B6B]">*</span>
          </label>
          <select
            id="clear-reason-select"
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            disabled={isClearing}
            className="w-full h-11 px-3 bg-[#0B1419] border border-[#2C3B44] rounded-xl text-[13.5px] text-[#E9EDEF] focus:outline-none focus:border-[#3DDBB4] transition-all cursor-pointer"
          >
            {PRESET_REASONS.map((r) => (
              <option key={r} value={r} className="bg-[#17232A] text-[#E9EDEF]">
                {r}
              </option>
            ))}
          </select>

          {selectedReason === 'Other / Custom reason' && (
            <input
              type="text"
              placeholder="Specify custom cleanup reason..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              disabled={isClearing}
              maxLength={120}
              className="mt-2 w-full h-10 px-3 bg-[#0B1419] border border-[#2C3B44] rounded-xl text-[13px] text-[#E9EDEF] placeholder-[#8696A0] focus:outline-none focus:border-[#3DDBB4] transition-all"
            />
          )}
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
            label="Hold to Clear Channel"
            holdingLabel="Clearing in 1s..."
            confirmedLabel="Channel Cleared"
            icon={<Trash2 className="w-4 h-4" />}
            durationMs={1000}
            variant="danger"
            disabled={isClearing}
            isLoading={isClearing}
            className="min-w-[190px] h-10"
            hintText="Hold 1s to clear"
          />
        </div>
      </div>
    </div>
  );
};
