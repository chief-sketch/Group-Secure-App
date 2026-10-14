import React, { useState } from 'react';
import { Search, Download, Filter } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AuditCategory } from '../../types';
import { Avatar } from '../common/Avatar';

export const AuditLog: React.FC = () => {
  const { auditLogs, users, loadMoreAuditLogs } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const filteredLogs = auditLogs.filter((entry) => {
    const matchesCategory =
      categoryFilter === 'all' || entry.category === categoryFilter;

    const query = searchQuery.toLowerCase();
    const matchesSearch =
      entry.actor.toLowerCase().includes(query) ||
      entry.action.toLowerCase().includes(query) ||
      entry.details.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });

  const getCategoryBadge = (cat: AuditCategory) => {
    switch (cat) {
      case 'Auth':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.08] text-[#CBD5E1] border border-white/[0.1] uppercase tracking-wider label-tracking">
            Auth
          </span>
        );
      case 'Role change':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 uppercase tracking-wider label-tracking">
            Role change
          </span>
        );
      case 'Approval':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#00A884]/15 text-[#00A884] border border-[#00A884]/30 uppercase tracking-wider label-tracking">
            Approval
          </span>
        );
      case 'Retention':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 uppercase tracking-wider label-tracking">
            Retention
          </span>
        );
      case 'Purge':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#E5484D]/15 text-[#E5484D] border border-[#E5484D]/30 uppercase tracking-wider label-tracking">
            Purge
          </span>
        );
      case 'Moderation':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#A855F7]/15 text-[#C084FC] border border-[#A855F7]/30 uppercase tracking-wider label-tracking">
            Moderation
          </span>
        );
    }
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Timestamp', 'Actor', 'Action', 'Category', 'Details'];
    const rows = filteredLogs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.actor}"`,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.category}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `audit-logs-export-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Top Description and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/[0.06]">
        <div>
          <h3 className="text-[17px] font-semibold text-[#E9EDEF]">
            Immutable governance audit trail
          </h3>
          <p className="text-[13px] text-[#8696A0] mt-0.5">
            Append-only record of administrative actions, authorizations, and moderation events.
          </p>
        </div>

        {/* Export CSV Button */}
        <button
          type="button"
          onClick={handleExportCSV}
          className="h-[40px] px-3.5 rounded-[10px] bg-[#26353D] hover:bg-white/[0.08] text-[#E9EDEF] border border-white/[0.1] text-[13px] font-medium flex items-center gap-2 transition-standard cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-[#00A884]" strokeWidth={1.75} />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Search and Category Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8696A0] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
          <input
            type="text"
            aria-label="Search audit logs"
            placeholder="Search by actor, action, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[40px] pl-10 pr-3.5 rounded-[10px] bg-[#1F2C33] text-[#E9EDEF] placeholder-[#8696A0]/75 text-[13px] border border-white/[0.08] focus:border-[#00A884] focus:outline-none transition-standard"
          />
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Filter className="w-4 h-4 text-[#8696A0]" strokeWidth={1.75} />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-[40px] px-3 rounded-[10px] bg-[#1F2C33] text-[#E9EDEF] border border-white/[0.08] focus:border-[#00A884] focus:outline-none text-[13px] cursor-pointer transition-standard"
          >
            <option value="all">All categories</option>
            <option value="Auth">Auth</option>
            <option value="Role change">Role change</option>
            <option value="Approval">Approval</option>
            <option value="Retention">Retention</option>
            <option value="Purge">Purge</option>
            <option value="Moderation">Moderation</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead className="sticky top-0 bg-[#1F2C33] text-[#8696A0] border-b border-white/[0.06] select-none font-medium text-[13px]">
              <tr>
                <th className="py-3.5 px-4 font-medium">Timestamp</th>
                <th className="py-3.5 px-4 font-medium">Actor</th>
                <th className="py-3.5 px-4 font-medium">Action & Details</th>
                <th className="py-3.5 px-4 font-medium text-right">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[#8696A0]">
                    <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-2 text-[#8696A0]">
                      <Search className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <p className="font-medium text-[#E9EDEF] mb-0.5">
                      {searchQuery || categoryFilter !== 'all'
                        ? 'No matching audit records'
                        : 'No audit entries yet'}
                    </p>
                    <p className="text-[12px]">
                      {searchQuery || categoryFilter !== 'all'
                        ? 'Try modifying your search or clearing category filters.'
                        : 'System administrative activities and authentication events will appear here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const actorUser = users.find(
                    (u) =>
                      u.email.toLowerCase() === log.actor.toLowerCase() ||
                      u.fullName.toLowerCase() === log.actor.toLowerCase()
                  );

                  return (
                    <tr key={log.id} className="h-[52px] hover:bg-white/[0.03] transition-standard">
                      <td className="py-3 px-4 text-[#8696A0] whitespace-nowrap font-mono text-[12px] tabular-nums">
                        {log.timestamp}
                      </td>

                      <td className="py-3 px-4 text-[#E9EDEF] whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            uid={actorUser?.id}
                            name={actorUser?.fullName || log.actor}
                            size={24}
                          />
                          <span className="text-[13px] font-medium">
                            {log.actor}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 min-w-[280px]">
                      <div className="font-medium text-[#E9EDEF] text-[13px]">{log.action}</div>
                      <div className="text-[12px] text-[#8696A0] mt-0.5 leading-snug">
                        {log.details}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {getCategoryBadge(log.category)}
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3.5 bg-black/10 border-t border-white/[0.06] text-[12px] text-[#8696A0] flex items-center justify-between">
          <span className="tabular-nums">Showing {filteredLogs.length} entries</span>
          <span className="text-[#8696A0]/80 text-[11px]">
            Immutable governance ledger &bull; Hardware signed
          </span>
        </div>
      </div>
    </div>
  );
};
