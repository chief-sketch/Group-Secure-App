import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  Edit2,
  Trash2,
  CalendarPlus,
  Users,
  Check,
  HelpCircle,
  XCircle,
} from 'lucide-react';
import { MeetingDoc, MeetingRsvpStatus, UserSession } from '../../types';
import { Avatar } from '../common/Avatar';
import { downloadMeetingIcs } from '../../lib/calendarIcs';
import { CancelMeetingDialog } from './CancelMeetingDialog';

interface MeetingCardProps {
  meeting: MeetingDoc;
  currentUser: UserSession;
  conversationName: string;
  conversationType: 'channel' | 'direct';
  conversationId: string;
  isChannelMember?: boolean;
  onRsvp: (meetingId: string, status: MeetingRsvpStatus) => Promise<void>;
  onEdit: (meeting: MeetingDoc) => void;
  onCancel: (meeting: MeetingDoc) => Promise<void>;
  onOpenConversation?: () => void;
  showConversationBadge?: boolean;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  currentUser,
  conversationName,
  conversationType,
  conversationId,
  isChannelMember = true,
  onRsvp,
  onEdit,
  onCancel,
  onOpenConversation,
  showConversationBadge = false,
}) => {
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRsvpUpdating, setIsRsvpUpdating] = useState(false);

  const isCreator = meeting.createdBy === currentUser.uid;
  const isApprovedAdmin = currentUser.role === 'admin' && currentUser.status === 'approved';
  // Admin who is member of channel can cancel
  const canAdminCancel = conversationType === 'channel' && isApprovedAdmin && isChannelMember;
  const canCancel = (isCreator || canAdminCancel) && meeting.status === 'scheduled';
  const canEdit = isCreator && meeting.status === 'scheduled';

  // Parse startsAt
  const startsAtDate: Date = (() => {
    if (meeting.startsAt?.toDate) return meeting.startsAt.toDate();
    if (meeting.startsAt?.seconds) return new Date(meeting.startsAt.seconds * 1000);
    return new Date(meeting.startsAt || Date.now());
  })();

  const formatDateTime = (): string => {
    const endDate = new Date(startsAtDate.getTime() + (meeting.durationMinutes || 30) * 60 * 1000);

    const dayName = startsAtDate.toLocaleDateString(undefined, { weekday: 'short' });
    const dayNum = startsAtDate.getDate();
    const monthName = startsAtDate.toLocaleDateString(undefined, { month: 'short' });

    const startTime = startsAtDate.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const endTime = endDate.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${dayName} ${dayNum} ${monthName}, ${startTime} to ${endTime}`;
  };

  const getRelativeLabel = (): string => {
    const now = Date.now();
    const diffMs = startsAtDate.getTime() - now;
    const endMs = startsAtDate.getTime() + (meeting.durationMinutes || 30) * 60 * 1000;

    if (now >= startsAtDate.getTime() && now <= endMs) {
      return 'Happening now';
    }
    if (diffMs < 0) {
      const minsAgo = Math.floor(-diffMs / 60000);
      if (minsAgo < 60) return `${minsAgo}m ago`;
      const hoursAgo = Math.floor(minsAgo / 60);
      if (hoursAgo < 24) return `${hoursAgo}h ago`;
      const daysAgo = Math.floor(hoursAgo / 24);
      return `${daysAgo}d ago`;
    }
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) {
      return `in ${diffMins} min${diffMins === 1 ? '' : 's'}`;
    }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
  };

  // RSVP breakdown
  const rsvpMap = meeting.rsvp || {};
  const userRsvp: MeetingRsvpStatus | undefined = rsvpMap[currentUser.uid];

  const goingCount = Object.values(rsvpMap).filter((v) => v === 'going').length;
  const maybeCount = Object.values(rsvpMap).filter((v) => v === 'maybe').length;

  const countLabelParts: string[] = [];
  if (goingCount > 0) {
    countLabelParts.push(`${goingCount} going`);
  }
  if (maybeCount > 0) {
    countLabelParts.push(`${maybeCount} maybe`);
  }
  const countLabel = countLabelParts.join(', ') || 'No responses yet';

  const handleRsvpClick = async (status: MeetingRsvpStatus) => {
    if (meeting.status === 'cancelled' || isRsvpUpdating) return;
    setIsRsvpUpdating(true);
    try {
      await onRsvp(meeting.id, status);
    } finally {
      setIsRsvpUpdating(false);
    }
  };

  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    try {
      await onCancel(meeting);
      setIsCancelDialogOpen(false);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleAddToCalendar = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadMeetingIcs({
      id: meeting.id,
      title: meeting.title,
      startsAt: startsAtDate,
      durationMinutes: meeting.durationMinutes || 30,
      location: meeting.location,
      link: meeting.link,
      note: meeting.note,
      conversationName,
    });
  };

  const isCancelled = meeting.status === 'cancelled';

  return (
    <>
      <CancelMeetingDialog
        isOpen={isCancelDialogOpen}
        onClose={() => setIsCancelDialogOpen(false)}
        onConfirm={handleConfirmCancel}
        isCancelling={isCancelling}
        meetingTitle={meeting.title}
      />

      <div
        className={`bg-[#1F2C33] border rounded-[10px] p-4 transition-standard relative ${
          isCancelled
            ? 'border-white/[0.04] opacity-75'
            : 'border-white/[0.08] hover:border-white/[0.14]'
        }`}
      >
        {/* Top Badges & Relative Time */}
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {showConversationBadge && (
              <button
                type="button"
                onClick={onOpenConversation}
                className="text-[11px] font-medium text-[#00A884] bg-[#00A884]/10 hover:bg-[#00A884]/20 px-2 py-0.5 rounded transition-standard cursor-pointer"
                title="Go to conversation"
              >
                {conversationName}
              </button>
            )}

            {isCancelled ? (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white/[0.06] text-[#8696A0]">
                Cancelled
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#00A884]/15 text-[#00A884]">
                {getRelativeLabel()}
              </span>
            )}

            {meeting.editedAt && !isCancelled && (
              <span className="text-[10px] font-medium text-[#8696A0] bg-white/[0.04] px-1.5 py-0.5 rounded">
                edited
              </span>
            )}
          </div>

          {/* Add to Calendar button */}
          {!isCancelled && (
            <button
              type="button"
              onClick={handleAddToCalendar}
              className="min-h-[36px] px-2.5 py-1 text-[11px] font-medium text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.06] rounded-[6px] border border-white/[0.06] flex items-center gap-1.5 transition-standard cursor-pointer"
              title="Download .ics calendar event"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-[#00A884]" />
              <span>Add to calendar</span>
            </button>
          )}
        </div>

        {/* Meeting Title */}
        <h4
          onClick={onOpenConversation}
          className={`text-[15px] font-semibold text-[#E9EDEF] leading-snug mb-1.5 ${
            isCancelled ? 'line-through text-[#8696A0]' : ''
          } ${onOpenConversation ? 'cursor-pointer hover:text-[#00A884]' : ''}`}
        >
          {meeting.title}
        </h4>

        {/* Date and Time in Local Time */}
        <div className="flex items-center gap-2 text-[12px] text-[#8696A0] mb-2.5">
          <Clock className="w-3.5 h-3.5 flex-shrink-0 text-[#00A884]" />
          <span className="font-medium text-[#E9EDEF]">{formatDateTime()}</span>
        </div>

        {/* Location or Link */}
        {(meeting.location || meeting.link) && (
          <div className="flex flex-col gap-1 mb-2.5 text-[12px]">
            {meeting.location && (
              <div className="flex items-center gap-2 text-[#8696A0]">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-[#8696A0]" />
                <span className="truncate">{meeting.location}</span>
              </div>
            )}
            {meeting.link && (
              <div className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-[#00A884]" />
                <a
                  href={meeting.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00A884] hover:underline truncate"
                >
                  {meeting.link}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Note */}
        {meeting.note && (
          <p className="text-[12px] text-[#8696A0] bg-[#111B21] p-2.5 rounded-[6px] mb-3 leading-relaxed whitespace-pre-wrap">
            {meeting.note}
          </p>
        )}

        {/* Creator Avatar & Name and RSVP Counts */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.04] text-[12px] mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar uid={meeting.createdBy} name={meeting.createdByName} size={24} />
            <span className="text-[#8696A0] truncate">
              Created by <span className="text-[#E9EDEF]">{meeting.createdByName}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-[#8696A0] flex-shrink-0">
            <Users className="w-3 h-3 text-[#8696A0]" />
            <span className="tabular-nums">{countLabel}</span>
          </div>
        </div>

        {/* RSVP Buttons (if scheduled) */}
        {!isCancelled && (
          <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                disabled={isRsvpUpdating}
                onClick={() => handleRsvpClick('going')}
                className={`min-h-[38px] px-3 py-1.5 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-standard cursor-pointer ${
                  userRsvp === 'going'
                    ? 'bg-[#00A884] text-white font-semibold shadow-sm'
                    : 'bg-white/[0.05] text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.08]'
                }`}
              >
                <Check className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Going</span>
              </button>

              <button
                type="button"
                disabled={isRsvpUpdating}
                onClick={() => handleRsvpClick('maybe')}
                className={`min-h-[38px] px-3 py-1.5 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-standard cursor-pointer ${
                  userRsvp === 'maybe'
                    ? 'bg-[#F59E0B] text-black font-semibold shadow-sm'
                    : 'bg-white/[0.05] text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.08]'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Maybe</span>
              </button>

              <button
                type="button"
                disabled={isRsvpUpdating}
                onClick={() => handleRsvpClick('declined')}
                className={`min-h-[38px] px-3 py-1.5 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-standard cursor-pointer ${
                  userRsvp === 'declined'
                    ? 'bg-[#E5484D] text-white font-semibold shadow-sm'
                    : 'bg-white/[0.05] text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.08]'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Can't go</span>
              </button>
            </div>

            {/* Creator / Admin actions: Edit & Cancel */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(meeting)}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.06] rounded-[6px] transition-standard cursor-pointer"
                  title="Edit meeting"
                  aria-label="Edit meeting"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => setIsCancelDialogOpen(true)}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center text-[#8696A0] hover:text-[#E5484D] hover:bg-[#E5484D]/10 rounded-[6px] transition-standard cursor-pointer"
                  title="Cancel meeting"
                  aria-label="Cancel meeting"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
