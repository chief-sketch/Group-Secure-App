import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  ArrowLeft,
  CalendarX2,
  Loader2,
  CalendarCheck,
} from 'lucide-react';
import { MeetingDoc, MyMeetingDoc, MeetingRsvpStatus, UserSession } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  getMeetingDoc,
  syncMyMeetingDoc,
  removeMyMeetingDoc,
  updateMeetingRsvpInFirestore,
  updateMeetingInFirestore,
  cancelMeetingInFirestore,
} from '../../lib/firebaseService';
import { MeetingCard } from './MeetingCard';
import { ScheduleMeetingDialog } from './ScheduleMeetingDialog';

interface MyMeetingsPageProps {
  onBack?: () => void;
  currentUser: UserSession;
}

interface EnrichedMyMeeting {
  myMeeting: MyMeetingDoc;
  fullDoc: MeetingDoc | null;
}

export const MyMeetingsPage: React.FC<MyMeetingsPageProps> = ({
  onBack,
  currentUser,
}) => {
  const { myMeetings, openMeetingConversation, showToast } = useApp();

  const [loadingDetails, setLoadingDetails] = useState(true);
  const [enrichedMeetings, setEnrichedMeetings] = useState<EnrichedMyMeeting[]>([]);
  const [editingMeeting, setEditingMeeting] = useState<MeetingDoc | null>(null);

  // When page opens, fetch each meeting document once to show current details and RSVP counts, and hide cancelled ones.
  useEffect(() => {
    let isCancelled = false;

    const fetchDetails = async () => {
      setLoadingDetails(true);
      const results: EnrichedMyMeeting[] = [];

      for (const item of myMeetings) {
        try {
          const docData = await getMeetingDoc(
            item.conversationType,
            item.conversationId,
            item.id
          );

          if (!docData) continue;

          // Hide cancelled ones & clean up personal myMeetings
          if (docData.status === 'cancelled') {
            await removeMyMeetingDoc(currentUser.uid, item.id);
            continue;
          }

          // If startsAt changed, update personal myMeetings entry
          const itemStartsAtMs =
            typeof item.startsAt?.toMillis === 'function'
              ? item.startsAt.toMillis()
              : typeof item.startsAt?.seconds === 'number'
              ? item.startsAt.seconds * 1000
              : new Date(item.startsAt).getTime();

          const docStartsAtMs =
            typeof docData.startsAt?.toMillis === 'function'
              ? docData.startsAt.toMillis()
              : typeof docData.startsAt?.seconds === 'number'
              ? docData.startsAt.seconds * 1000
              : new Date(docData.startsAt).getTime();

          if (itemStartsAtMs !== docStartsAtMs || item.title !== docData.title) {
            await syncMyMeetingDoc(currentUser.uid, item.id, {
              title: docData.title,
              startsAt: docData.startsAt,
            });
          }

          results.push({
            myMeeting: item,
            fullDoc: docData,
          });
        } catch (err) {
          console.warn('Error fetching meeting doc for myMeetings:', err);
        }
      }

      if (!isCancelled) {
        setEnrichedMeetings(results);
        setLoadingDetails(false);
      }
    };

    fetchDetails();

    return () => {
      isCancelled = true;
    };
  }, [myMeetings, currentUser.uid]);

  // Group into Today, Tomorrow, and Later
  const grouped = (() => {
    const today: EnrichedMyMeeting[] = [];
    const tomorrow: EnrichedMyMeeting[] = [];
    const later: EnrichedMyMeeting[] = [];

    const now = new Date();
    const todayDateStr = now.toDateString();

    const tmrw = new Date(now);
    tmrw.setDate(tmrw.getDate() + 1);
    const tmrwDateStr = tmrw.toDateString();

    for (const item of enrichedMeetings) {
      const startsAtVal = item.fullDoc?.startsAt || item.myMeeting.startsAt;
      const date: Date = (() => {
        if (startsAtVal?.toDate) return startsAtVal.toDate();
        if (startsAtVal?.seconds) return new Date(startsAtVal.seconds * 1000);
        return new Date(startsAtVal || Date.now());
      })();

      const dateStr = date.toDateString();
      if (dateStr === todayDateStr) {
        today.push(item);
      } else if (dateStr === tmrwDateStr) {
        tomorrow.push(item);
      } else {
        later.push(item);
      }
    }

    return { today, tomorrow, later };
  })();

  const handleRsvp = async (meetingId: string, status: MeetingRsvpStatus) => {
    const target = enrichedMeetings.find((m) => m.myMeeting.id === meetingId);
    if (!target) return;
    const conversationType = target.myMeeting.conversationType;
    const conversationId = target.myMeeting.conversationId;
    const conversationName = target.myMeeting.conversationName;
    const title = target.fullDoc?.title || target.myMeeting.title;
    const startsAt = target.fullDoc?.startsAt || target.myMeeting.startsAt;

    await updateMeetingRsvpInFirestore(
      conversationType,
      conversationId,
      conversationName,
      meetingId,
      status,
      { uid: currentUser.uid },
      title,
      startsAt
    );

    // If declined, remove from local list
    if (status === 'declined') {
      setEnrichedMeetings((prev) => prev.filter((m) => m.myMeeting.id !== meetingId));
    }
  };

  const handleSaveEdit = async (meetingData: any) => {
    if (!editingMeeting) return;
    const target = enrichedMeetings.find((m) => m.myMeeting.id === editingMeeting.id);
    if (!target) return;

    await updateMeetingInFirestore(
      target.myMeeting.conversationType,
      target.myMeeting.conversationId,
      editingMeeting.id,
      meetingData,
      currentUser.uid
    );
    showToast('Meeting updated');
    setEditingMeeting(null);
  };

  const handleCancel = async (meeting: MeetingDoc) => {
    const target = enrichedMeetings.find((m) => m.myMeeting.id === meeting.id);
    if (!target) return;

    await cancelMeetingInFirestore(
      target.myMeeting.conversationType,
      target.myMeeting.conversationId,
      meeting.id,
      {
        uid: currentUser.uid,
        fullName: currentUser.fullName,
        email: currentUser.email,
        role: currentUser.role,
      },
      target.myMeeting.conversationName,
      meeting.createdBy
    );

    setEnrichedMeetings((prev) => prev.filter((m) => m.myMeeting.id !== meeting.id));
    showToast('Meeting cancelled');
  };

  const totalMeetings = enrichedMeetings.length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B141A] overflow-hidden select-none">
      {/* Schedule / Edit Dialog */}
      {editingMeeting && (
        <ScheduleMeetingDialog
          isOpen={true}
          onClose={() => setEditingMeeting(null)}
          onSave={handleSaveEdit}
          initialMeeting={editingMeeting}
          conversationName={
            enrichedMeetings.find((m) => m.myMeeting.id === editingMeeting.id)
              ?.myMeeting.conversationName || 'Meeting'
          }
        />
      )}

      {/* Page Header */}
      <div className="h-[60px] bg-[#1F2C33] border-b border-white/[0.06] px-4 sm:px-6 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-10 h-10 flex items-center justify-center text-[#8696A0] hover:text-[#E9EDEF] rounded-full hover:bg-white/[0.05] transition-standard cursor-pointer -ml-1"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="w-5 h-5" strokeWidth={1.75} />
            </button>
          )}

          <div className="w-9 h-9 rounded-full bg-[#00A884]/15 text-[#00A884] flex items-center justify-center flex-shrink-0">
            <CalendarCheck className="w-5 h-5" strokeWidth={2} />
          </div>

          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[#E9EDEF] truncate leading-tight">
              My Meetings
            </h2>
            <p className="text-[11px] text-[#8696A0] truncate">
              {totalMeetings} upcoming meeting{totalMeetings === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      {/* Helper text banner below header */}
      <div className="px-4 sm:px-6 py-2.5 bg-[#182229] border-b border-white/[0.04] text-[12px] text-[#8696A0] flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-[#00A884] flex-shrink-0" />
        <span>
          Reminders appear while Group Secure App is open. Use Add to calendar for reminders on your phone.
        </span>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-4xl mx-auto w-full">
        {loadingDetails && enrichedMeetings.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-[#00A884] animate-spin mb-3" />
            <p className="text-[13px] text-[#8696A0]">Loading your upcoming meetings...</p>
          </div>
        ) : totalMeetings === 0 ? (
          <div className="py-20 px-4 text-center bg-[#1F2C33]/50 border border-white/[0.04] rounded-[12px] max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-full bg-[#1F2C33] border border-white/[0.08] flex items-center justify-center mx-auto mb-4 text-[#8696A0]">
              <CalendarX2 className="w-7 h-7" strokeWidth={1.5} />
            </div>
            <h3 className="text-[16px] font-semibold text-[#E9EDEF] mb-2">
              No upcoming meetings
            </h3>
            <p className="text-[13px] text-[#8696A0] max-w-[340px] mx-auto leading-relaxed">
              No upcoming meetings. Open a chat and tap the calendar icon to schedule one.
            </p>
          </div>
        ) : (
          <>
            {/* Group: Today */}
            {grouped.today.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00A884]" />
                  <h3 className="text-[13px] font-semibold text-[#E9EDEF] uppercase tracking-wider">
                    Today ({grouped.today.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {grouped.today.map((item) => (
                    <MeetingCard
                      key={item.myMeeting.id}
                      meeting={
                        item.fullDoc || {
                          id: item.myMeeting.id,
                          title: item.myMeeting.title,
                          startsAt: item.myMeeting.startsAt,
                          durationMinutes: 30,
                          status: 'scheduled',
                          createdBy: '',
                          createdByName: 'User',
                          createdAt: null,
                          rsvp: {},
                        }
                      }
                      currentUser={currentUser}
                      conversationName={item.myMeeting.conversationName}
                      conversationType={item.myMeeting.conversationType}
                      conversationId={item.myMeeting.conversationId}
                      showConversationBadge={true}
                      onRsvp={handleRsvp}
                      onEdit={(m) => setEditingMeeting(m)}
                      onCancel={handleCancel}
                      onOpenConversation={() =>
                        openMeetingConversation(
                          item.myMeeting.conversationType,
                          item.myMeeting.conversationId
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Group: Tomorrow */}
            {grouped.tomorrow.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                  <h3 className="text-[13px] font-semibold text-[#E9EDEF] uppercase tracking-wider">
                    Tomorrow ({grouped.tomorrow.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {grouped.tomorrow.map((item) => (
                    <MeetingCard
                      key={item.myMeeting.id}
                      meeting={
                        item.fullDoc || {
                          id: item.myMeeting.id,
                          title: item.myMeeting.title,
                          startsAt: item.myMeeting.startsAt,
                          durationMinutes: 30,
                          status: 'scheduled',
                          createdBy: '',
                          createdByName: 'User',
                          createdAt: null,
                          rsvp: {},
                        }
                      }
                      currentUser={currentUser}
                      conversationName={item.myMeeting.conversationName}
                      conversationType={item.myMeeting.conversationType}
                      conversationId={item.myMeeting.conversationId}
                      showConversationBadge={true}
                      onRsvp={handleRsvp}
                      onEdit={(m) => setEditingMeeting(m)}
                      onCancel={handleCancel}
                      onOpenConversation={() =>
                        openMeetingConversation(
                          item.myMeeting.conversationType,
                          item.myMeeting.conversationId
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Group: Later */}
            {grouped.later.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#8696A0]" />
                  <h3 className="text-[13px] font-semibold text-[#E9EDEF] uppercase tracking-wider">
                    Later ({grouped.later.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {grouped.later.map((item) => (
                    <MeetingCard
                      key={item.myMeeting.id}
                      meeting={
                        item.fullDoc || {
                          id: item.myMeeting.id,
                          title: item.myMeeting.title,
                          startsAt: item.myMeeting.startsAt,
                          durationMinutes: 30,
                          status: 'scheduled',
                          createdBy: '',
                          createdByName: 'User',
                          createdAt: null,
                          rsvp: {},
                        }
                      }
                      currentUser={currentUser}
                      conversationName={item.myMeeting.conversationName}
                      conversationType={item.myMeeting.conversationType}
                      conversationId={item.myMeeting.conversationId}
                      showConversationBadge={true}
                      onRsvp={handleRsvp}
                      onEdit={(m) => setEditingMeeting(m)}
                      onCancel={handleCancel}
                      onOpenConversation={() =>
                        openMeetingConversation(
                          item.myMeeting.conversationType,
                          item.myMeeting.conversationId
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
