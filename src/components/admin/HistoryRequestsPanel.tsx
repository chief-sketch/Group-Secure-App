import React, { useState } from 'react';
import {
  Clock,
  Check,
  X,
  CheckCircle2,
  XCircle,
  MessageSquare,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { ChannelAvatar } from '../common/ChannelAvatar';
import { getChannelDisplayName } from '../../lib/channelAvatars';
import { HistoryRequest } from '../../types';

export const HistoryRequestsPanel: React.FC = () => {
  const {
    historyRequests,
    approveHistoryRequest,
    declineHistoryRequest,
  } = useApp();

  const [processingId, setProcessingId] = useState<string | null>(null);

  const openRequests = historyRequests.filter((r) => r.status === 'open');
  const pastRequests = historyRequests.filter((r) => r.status !== 'open');

  const formatRequestTime = (rawCreatedAt: any): string => {
    if (!rawCreatedAt) return 'Just now';
    try {
      const date = rawCreatedAt.toDate ? rawCreatedAt.toDate() : new Date(rawCreatedAt);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Recently';
    }
  };

  const handleApprove = async (req: HistoryRequest) => {
    setProcessingId(req.id);
    const chName = getChannelDisplayName(req.channelId);
    try {
      await approveHistoryRequest(
        req.id,
        req.uid,
        req.channelId,
        req.userName,
        chName
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (req: HistoryRequest) => {
    setProcessingId(req.id);
    const chName = getChannelDisplayName(req.channelId);
    try {
      await declineHistoryRequest(
        req.id,
        req.uid,
        req.channelId,
        req.userName,
        chName
      );
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-[24px] font-semibold text-[#E9EDEF] title-tracking">
            Channel history access requests
          </h2>
          <p className="text-[13px] text-[#8696A0] mt-1 leading-[1.5]">
            Review member requests to read channel messages sent before they joined.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[#8696A0]">Awaiting review:</span>
          <span className="px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#00A884]/15 text-[#00A884] border border-[#00A884]/30 tabular-nums">
            {openRequests.length}
          </span>
        </div>
      </div>

      {historyRequests.length === 0 ? (
        /* Empty State */
        <div className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] p-12 text-center select-none">
          <div className="w-12 h-12 rounded-full bg-[#182229] border border-white/[0.08] flex items-center justify-center mx-auto mb-3 text-[#00A884]">
            <Clock className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <h3 className="text-[18px] font-semibold text-[#E9EDEF] title-tracking mb-1">
            No history requests
          </h3>
          <p className="text-[13px] text-[#8696A0] max-w-[340px] mx-auto leading-relaxed">
            When members with restricted access ask for earlier messages, their requests will appear here for review.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active / Open Requests Table */}
          <div className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-[#E9EDEF]">
                  Pending requests
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.06] text-[#8696A0] tabular-nums">
                  {openRequests.length}
                </span>
              </div>
            </div>

            {openRequests.length === 0 ? (
              <div className="p-8 text-center text-[#8696A0] text-[13px]">
                All pending history requests have been reviewed.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[14px]">
                  <thead className="bg-[#1F2C33] text-[#8696A0] border-b border-white/[0.06] select-none font-medium">
                    <tr>
                      <th className="py-3 px-5 font-medium">Staff member</th>
                      <th className="py-3 px-5 font-medium">Channel</th>
                      <th className="py-3 px-5 font-medium">Note</th>
                      <th className="py-3 px-5 font-medium">Submitted</th>
                      <th className="py-3 px-5 font-medium text-right">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {openRequests.map((req) => {
                      const isProcessing = processingId === req.id;
                      const chDisplayName = getChannelDisplayName(req.channelId);

                      return (
                        <tr
                          key={req.id}
                          className="hover:bg-white/[0.03] transition-standard"
                        >
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-2.5">
                              <Avatar uid={req.uid} name={req.userName} size={30} />
                              <div className="min-w-0">
                                <div className="font-medium text-[#E9EDEF]">
                                  {req.userName}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-white/[0.05] border border-white/[0.08] text-[12px] font-medium text-[#E9EDEF]">
                              <ChannelAvatar channelId={req.channelId} size={16} />
                              <span>{chDisplayName}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-[13px] text-[#E9EDEF] max-w-[260px]">
                            {req.note ? (
                              <p className="truncate" title={req.note}>
                                "{req.note}"
                              </p>
                            ) : (
                              <span className="text-[#8696A0] italic text-[12px]">
                                No note provided
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-[#8696A0] tabular-nums text-[12px] whitespace-nowrap">
                            {formatRequestTime(req.createdAt)}
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleApprove(req)}
                                className="h-[34px] px-3.5 rounded-[8px] bg-[#00A884] hover:bg-[#008F72] text-white text-[13px] font-medium flex items-center gap-1.5 transition-standard cursor-pointer disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                                )}
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleDecline(req)}
                                className="h-[34px] px-3 rounded-[8px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] hover:border-[#E5484D]/50 hover:text-[#E5484D] text-[#8696A0] text-[13px] font-medium flex items-center gap-1.5 transition-standard cursor-pointer disabled:opacity-50"
                              >
                                <X className="w-3.5 h-3.5" strokeWidth={2} />
                                <span>Decline</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Past Requests History Table */}
          {pastRequests.length > 0 && (
            <div className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] overflow-hidden opacity-90">
              <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.01]">
                <span className="text-[13px] font-medium text-[#8696A0]">
                  Resolved requests ({pastRequests.length})
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-[#1F2C33] text-[#8696A0] border-b border-white/[0.06] select-none font-medium text-[12px]">
                    <tr>
                      <th className="py-2.5 px-5 font-medium">Staff member</th>
                      <th className="py-2.5 px-5 font-medium">Channel</th>
                      <th className="py-2.5 px-5 font-medium">Note</th>
                      <th className="py-2.5 px-5 font-medium">Status</th>
                      <th className="py-2.5 px-5 font-medium text-right">Resolved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-[#8696A0]">
                    {pastRequests.map((req) => {
                      const chDisplayName = getChannelDisplayName(req.channelId);
                      const isApproved = req.status === 'approved';

                      return (
                        <tr key={req.id} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-5 text-[#E9EDEF]">
                            <div className="flex items-center gap-2">
                              <Avatar uid={req.uid} name={req.userName} size={22} />
                              <span>{req.userName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-5">
                            {chDisplayName}
                          </td>
                          <td className="py-2.5 px-5 truncate max-w-[200px]">
                            {req.note || '—'}
                          </td>
                          <td className="py-2.5 px-5">
                            {isApproved ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#00A884]/15 text-[#00A884] border border-[#00A884]/30">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Approved (Full history)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.06] text-[#8696A0] border border-white/[0.1]">
                                <XCircle className="w-3 h-3" />
                                <span>Declined</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-5 text-right tabular-nums text-[12px]">
                            {formatRequestTime(req.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
