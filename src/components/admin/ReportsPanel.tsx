import React, { useState, useEffect } from 'react';
import { Flag, CheckCircle, Clock, MessageSquare, Check, Eye, Shield } from 'lucide-react';
import { ReportDoc } from '../../types';
import {
  subscribeToReports,
  resolveReportInFirestore,
  moderatorRemoveChatMessage,
  fetchSingleMessage,
} from '../../lib/firebaseService';
import {
  normalizeChannelId,
  getChannelDisplayName,
  displayChannelName,
} from '../../lib/channelAvatars';
import { useApp } from '../../context/AppContext';
import { RemoveMessageDialog } from '../common/RemoveMessageDialog';

export const ReportsPanel: React.FC = () => {
  const { currentSession, addAuditEntry, showToast, navigateToChatMessage } = useApp();
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Moderator remove dialog state for reports
  const [moderatingReport, setModeratingReport] = useState<ReportDoc | null>(null);
  const [isModerating, setIsModerating] = useState(false);

  useEffect(() => {
    const unsub = subscribeToReports(
      (list) => {
        setReports(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Error loading reports:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const isChannelMember = (channelIdOrName?: string): boolean => {
    if (!channelIdOrName || !currentSession) return false;
    const normTarget = normalizeChannelId(channelIdOrName);
    return (currentSession.channels || []).some(
      (c) => normalizeChannelId(c) === normTarget
    );
  };

  const handleResolve = async (report: ReportDoc) => {
    setResolvingId(report.id);
    try {
      await resolveReportInFirestore(report.id);
      await addAuditEntry(
        currentSession?.email || 'admin',
        'Report resolved',
        `Report from ${report.reporterName} (${report.reason}) marked resolved by ${currentSession?.email || 'admin'}`,
        'Approval'
      );
      showToast('Report marked resolved');
    } catch (err) {
      console.error('Failed to resolve report:', err);
      showToast('Failed to resolve report');
    } finally {
      setResolvingId(null);
    }
  };

  const handleViewMessage = (report: ReportDoc) => {
    if (!report.conversationId) return;
    navigateToChatMessage(report.conversationId, report.messageId);
  };

  const handleConfirmReportModeration = async (reason: string, note: string) => {
    if (!moderatingReport || !moderatingReport.conversationId || !moderatingReport.messageId) {
      return;
    }

    setIsModerating(true);
    try {
      // 1. Fetch single message doc to check for attached fileId if present
      let fileId: string | undefined;
      try {
        const single = await fetchSingleMessage(
          'channel',
          moderatingReport.conversationId,
          moderatingReport.messageId
        );
        fileId = single?.fileId;
      } catch (_) {}

      // 2. Perform guarded moderator removal in channels/{channelId}/messages/{messageId}
      await moderatorRemoveChatMessage(
        moderatingReport.conversationId,
        moderatingReport.messageId,
        reason,
        fileId
      );

      // 3. Write immutable audit log
      const adminName = currentSession?.fullName || currentSession?.email || 'Administrator';
      const chDisplayName = displayChannelName(
        getChannelDisplayName(moderatingReport.conversationId)
      );
      await addAuditEntry(
        currentSession?.email || adminName,
        `Message removed by ${adminName} in ${chDisplayName} (reason: ${reason})`,
        `Message ID: ${moderatingReport.messageId}, Sender: ${moderatingReport.reporterName}${
          note ? `. Note: ${note}` : ''
        }`,
        'Moderation'
      );

      // 4. Mark report resolved
      await resolveReportInFirestore(moderatingReport.id);
      showToast('Message removed and report resolved');
      setModeratingReport(null);
    } catch (err: any) {
      const errorCode = err?.code || err?.name || 'unknown';
      console.error('Moderator remove error code:', errorCode);
      showToast('Could not remove the message. Check your channel access.');
    } finally {
      setIsModerating(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (filter === 'open') return r.status === 'open';
    if (filter === 'resolved') return r.status === 'resolved';
    return true;
  });

  const openCount = reports.filter((r) => r.status === 'open').length;

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Recent';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="space-y-6">
      {/* Moderator Remove Dialog from Report */}
      <RemoveMessageDialog
        isOpen={moderatingReport !== null}
        onClose={() => setModeratingReport(null)}
        onConfirm={handleConfirmReportModeration}
        isRemoving={isModerating}
      />

      {/* Top Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <h2 className="text-[18px] font-semibold text-[#E9EDEF] flex items-center gap-2">
            <span>Reports & Feedback</span>
            {openCount > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E5484D] text-white">
                {openCount} open
              </span>
            )}
          </h2>
          <p className="text-[13px] text-[#8696A0] mt-0.5">
            Review reported messages and application feedback submitted by members. Message content is confidential and never shown in audit logs.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 bg-[#1F2C33] p-1 rounded-[10px] border border-white/[0.08] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-[#00A884] text-white'
                : 'text-[#8696A0] hover:text-[#E9EDEF]'
            }`}
          >
            All ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('open')}
            className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer ${
              filter === 'open'
                ? 'bg-[#00A884] text-white'
                : 'text-[#8696A0] hover:text-[#E9EDEF]'
            }`}
          >
            Open ({openCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('resolved')}
            className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer ${
              filter === 'resolved'
                ? 'bg-[#00A884] text-white'
                : 'text-[#8696A0] hover:text-[#E9EDEF]'
            }`}
          >
            Resolved ({reports.length - openCount})
          </button>
        </div>
      </div>

      {/* Reports Table / List */}
      <div className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[#8696A0] text-[13px]">
            Loading reports...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center text-[#8696A0] select-none">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-[#00A884]/60" />
            <p className="text-[14px] font-medium text-[#E9EDEF]">No reports found</p>
            <p className="text-[12px] text-[#8696A0] mt-0.5">
              {filter === 'open'
                ? 'All submitted reports have been reviewed and resolved.'
                : 'No member reports or feedback have been submitted yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="sticky top-0 bg-[#1F2C33] text-[#8696A0] border-b border-white/[0.06] select-none font-medium text-[13px]">
                <tr>
                  <th className="py-3.5 px-4 font-medium">Type</th>
                  <th className="py-3.5 px-4 font-medium">Reporter</th>
                  <th className="py-3.5 px-4 font-medium">Reason / Category</th>
                  <th className="py-3.5 px-4 font-medium">Note</th>
                  <th className="py-3.5 px-4 font-medium">Submitted</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredReports.map((report) => {
                  const isOpen = report.status === 'open';
                  const isMessage = report.conversationType !== 'app';
                  const isChannel = report.conversationType === 'channel';
                  const isDirect = report.conversationType === 'direct';
                  const memberOfReportChannel = isChannel && isChannelMember(report.conversationId);

                  return (
                    <tr
                      key={report.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            isMessage
                              ? 'bg-[#00A884]/15 text-[#00A884] border border-[#00A884]/30'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {isMessage ? (
                            <>
                              <MessageSquare className="w-3 h-3" />
                              <span>{isChannel ? 'Channel msg' : 'Direct msg'}</span>
                            </>
                          ) : (
                            <>
                              <Flag className="w-3 h-3" />
                              <span>App problem</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-[#E9EDEF]">
                        {report.reporterName}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-[#D1D7DB]">
                        <span className="font-medium text-[#E9EDEF]">
                          {report.reason}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 max-w-[280px]">
                        <p className="text-[13px] text-[#8696A0] break-words line-clamp-2">
                          {report.note || <span className="italic">No note provided</span>}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-[12px] text-[#8696A0] tabular-nums">
                        {formatTimestamp(report.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isOpen ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E5484D]/15 text-[#E5484D] border border-[#E5484D]/30">
                            <Clock className="w-3 h-3" />
                            <span>Open</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#00A884]/15 text-[#00A884] border border-[#00A884]/30">
                            <Check className="w-3 h-3" strokeWidth={2} />
                            <span>Resolved</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        {isOpen ? (
                          <div className="inline-flex items-center justify-end gap-2">
                            {/* Direct message report: show notice and only offer Mark resolved */}
                            {isDirect && (
                              <span className="text-[11px] text-[#8696A0] italic">
                                Direct messages can't be reviewed by administrators
                              </span>
                            )}

                            {/* Channel message report: if admin is member, show View message and Remove message */}
                            {isChannel && memberOfReportChannel && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleViewMessage(report)}
                                  className="h-[32px] px-2.5 rounded-[8px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                                  title="Open message in channel"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#00A884]" />
                                  <span>View message</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setModeratingReport(report)}
                                  className="h-[32px] px-2.5 rounded-[8px] bg-[#E5484D]/15 hover:bg-[#E5484D]/25 border border-[#E5484D]/30 text-[#E5484D] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                                  title="Remove message (admin)"
                                >
                                  <Shield className="w-3.5 h-3.5" />
                                  <span>Remove message</span>
                                </button>
                              </>
                            )}

                            {/* Channel message report where admin is NOT a member */}
                            {isChannel && !memberOfReportChannel && (
                              <span
                                title="Administrators cannot moderate channels they are not members of"
                                className="text-[11px] text-[#8696A0] italic"
                              >
                                Channel restricted (not a member)
                              </span>
                            )}

                            {/* Mark resolved button for all open reports */}
                            <button
                              type="button"
                              onClick={() => handleResolve(report)}
                              disabled={resolvingId === report.id}
                              className="h-[32px] px-3 rounded-[8px] bg-transparent hover:bg-[#00A884]/15 border border-[#00A884]/40 text-[#00A884] text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {resolvingId === report.id ? 'Saving...' : 'Mark resolved'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[12px] text-[#8696A0] select-none italic">
                            Resolved
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
