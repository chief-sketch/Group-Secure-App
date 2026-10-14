import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  CalendarX2,
  Loader2,
} from 'lucide-react';
import { MeetingDoc, MeetingRsvpStatus, UserSession } from '../../types';
import {
  subscribeToConversationMeetings,
  createMeetingInFirestore,
  updateMeetingInFirestore,
  updateMeetingRsvpInFirestore,
  cancelMeetingInFirestore,
  getCancelledMeetingsForConversation,
} from '../../lib/firebaseService';
import { MeetingCard } from './MeetingCard';
import { ScheduleMeetingDialog } from './ScheduleMeetingDialog';
import { displayChannelName } from '../../lib/channelAvatars';

interface ConversationMeetingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversationType: 'channel' | 'direct';
  conversationId: string;
  conversationName: string;
  currentUser: UserSession;
  isChannelMember?: boolean;
  onMeetingCountChange?: (count: number) => void;
}

export const ConversationMeetingsPanel: React.FC<ConversationMeetingsPanelProps> = ({
  isOpen,
  onClose,
  conversationType,
  conversationId,
  conversationName,
  currentUser,
  isChannelMember = true,
  onMeetingCountChange,
}) => {
  const [meetings, setMeetings] = useState<MeetingDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Collapsed cancelled meetings group
  const [showCancelled, setShowCancelled] = useState(false);
  const [cancelledMeetings, setCancelledMeetings] = useState<MeetingDoc[]>([]);
  const [isLoadingCancelled, setIsLoadingCancelled] = useState(false);

  // Dialog state
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingDoc | null>(null);

  // Subscribe to conversation meetings ONLY while panel is open!
  useEffect(() => {
    if (!isOpen || !conversationId) {
      setMeetings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsub = subscribeToConversationMeetings(
      conversationType,
      conversationId,
      (list) => {
        setMeetings(list);
        setIsLoading(false);
        if (onMeetingCountChange) {
          onMeetingCountChange(list.length);
        }
      },
      (err) => {
        console.warn('Meetings subscription error:', err);
        setIsLoading(false);
      }
    );

    return () => {
      unsub();
    };
  }, [isOpen, conversationType, conversationId, onMeetingCountChange]);

  // Load cancelled meetings when group is expanded
  const handleToggleCancelled = async () => {
    const nextState = !showCancelled;
    setShowCancelled(nextState);
    if (nextState && cancelledMeetings.length === 0) {
      setIsLoadingCancelled(true);
      try {
        const list = await getCancelledMeetingsForConversation(
          conversationType,
          conversationId
        );
        setCancelledMeetings(list);
      } finally {
        setIsLoadingCancelled(false);
      }
    }
  };

  const handleSaveMeeting = async (meetingData: any) => {
    const displayName =
      conversationType === 'channel'
        ? displayChannelName(conversationName)
        : conversationName;

    if (editingMeeting) {
      await updateMeetingInFirestore(
        conversationType,
        conversationId,
        editingMeeting.id,
        meetingData,
        currentUser.uid
      );
      setEditingMeeting(null);
    } else {
      await createMeetingInFirestore(
        conversationType,
        conversationId,
        displayName,
        meetingData,
        {
          uid: currentUser.uid,
          fullName: currentUser.fullName,
        }
      );
    }
  };

  const handleRsvp = async (meetingId: string, status: MeetingRsvpStatus) => {
    const target = meetings.find((m) => m.id === meetingId);
    if (!target) return;
    const displayName =
      conversationType === 'channel'
        ? displayChannelName(conversationName)
        : conversationName;

    await updateMeetingRsvpInFirestore(
      conversationType,
      conversationId,
      displayName,
      meetingId,
      status,
      { uid: currentUser.uid },
      target.title,
      target.startsAt
    );
  };

  const handleCancelMeeting = async (meeting: MeetingDoc) => {
    const displayName =
      conversationType === 'channel'
        ? displayChannelName(conversationName)
        : conversationName;

    await cancelMeetingInFirestore(
      conversationType,
      conversationId,
      meeting.id,
      {
        uid: currentUser.uid,
        fullName: currentUser.fullName,
        email: currentUser.email,
        role: currentUser.role,
      },
      displayName,
      meeting.createdBy
    );

    // Refresh cancelled list if open
    if (showCancelled) {
      const refreshed = await getCancelledMeetingsForConversation(
        conversationType,
        conversationId
      );
      setCancelledMeetings(refreshed);
    }
  };

  if (!isOpen) return null;

  const displayName =
    conversationType === 'channel'
      ? displayChannelName(conversationName)
      : conversationName;

  return (
    <>
      {/* Schedule / Edit Dialog */}
      <ScheduleMeetingDialog
        isOpen={isScheduleOpen}
        onClose={() => {
          setIsScheduleOpen(false);
          setEditingMeeting(null);
        }}
        onSave={handleSaveMeeting}
        initialMeeting={editingMeeting}
        conversationName={displayName}
      />

      {/* Side Panel Overlay / Container */}
      <div
        className="fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] bg-[#111B21] border-l border-white/[0.08] shadow-2xl flex flex-col animate-slideInRight"
        role="region"
        aria-label="Meetings side panel"
      >
        {/* Panel Header */}
        <div className="h-[60px] bg-[#1F2C33] px-4 flex items-center justify-between border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#00A884]/15 text-[#00A884] flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-[#E9EDEF] leading-tight truncate">
                Meetings
              </h3>
              <p className="text-[11px] text-[#8696A0] truncate">
                {displayName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center text-[#8696A0] hover:text-[#E9EDEF] rounded-[8px] hover:bg-white/[0.05] transition-standard cursor-pointer -mr-2"
            aria-label="Close meetings panel"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Panel Actions: Green Schedule Meeting Button */}
        <div className="p-4 bg-[#111B21] border-b border-white/[0.04] flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditingMeeting(null);
              setIsScheduleOpen(true);
            }}
            className="w-full min-h-[44px] px-4 py-2.5 bg-[#00A884] hover:bg-[#008f6f] text-white rounded-[8px] font-semibold text-[13px] flex items-center justify-center gap-2 transition-standard cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span>Schedule a meeting</span>
          </button>
        </div>

        {/* Panel Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[12px] font-semibold text-[#8696A0] uppercase tracking-wider">
              Upcoming ({meetings.length})
            </h4>
          </div>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-6 h-6 text-[#00A884] animate-spin mb-2" />
              <p className="text-[12px] text-[#8696A0]">Loading meetings...</p>
            </div>
          ) : meetings.length === 0 ? (
            <div className="py-10 px-4 text-center bg-[#1F2C33]/50 border border-white/[0.04] rounded-[10px]">
              <CalendarX2 className="w-10 h-10 text-[#8696A0]/50 mx-auto mb-2.5" />
              <p className="text-[13px] font-medium text-[#E9EDEF] mb-1">
                No upcoming meetings
              </p>
              <p className="text-[12px] text-[#8696A0] max-w-[260px] mx-auto leading-relaxed">
                Schedule a meeting to collaborate with team members in this conversation.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  currentUser={currentUser}
                  conversationName={displayName}
                  conversationType={conversationType}
                  conversationId={conversationId}
                  isChannelMember={isChannelMember}
                  onRsvp={handleRsvp}
                  onEdit={(m) => {
                    setEditingMeeting(m);
                    setIsScheduleOpen(true);
                  }}
                  onCancel={handleCancelMeeting}
                />
              ))}
            </div>
          )}

          {/* Collapsed Cancelled Group (Last 7 Days) */}
          <div className="pt-4 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={handleToggleCancelled}
              className="w-full py-2 flex items-center justify-between text-[12px] font-medium text-[#8696A0] hover:text-[#E9EDEF] transition-standard cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                {showCancelled ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <span>Cancelled meetings (last 7 days)</span>
              </div>
              {showCancelled && (
                <span className="text-[11px] text-[#8696A0] tabular-nums">
                  {cancelledMeetings.length}
                </span>
              )}
            </button>

            {showCancelled && (
              <div className="mt-2 space-y-3 pl-2 border-l border-white/[0.06]">
                {isLoadingCancelled ? (
                  <div className="py-4 flex items-center justify-center gap-2 text-[12px] text-[#8696A0]">
                    <Loader2 className="w-4 h-4 text-[#8696A0] animate-spin" />
                    <span>Loading cancelled meetings...</span>
                  </div>
                ) : cancelledMeetings.length === 0 ? (
                  <p className="text-[12px] text-[#8696A0]/70 py-2 italic">
                    No cancelled meetings in the last 7 days.
                  </p>
                ) : (
                  cancelledMeetings.map((meeting) => (
                    <MeetingCard
                      key={meeting.id}
                      meeting={meeting}
                      currentUser={currentUser}
                      conversationName={displayName}
                      conversationType={conversationType}
                      conversationId={conversationId}
                      isChannelMember={isChannelMember}
                      onRsvp={handleRsvp}
                      onEdit={() => {}}
                      onCancel={handleCancelMeeting}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
