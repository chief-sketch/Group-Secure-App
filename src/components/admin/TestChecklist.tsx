import React, { useState, useEffect } from 'react';
import { RotateCcw, CheckCircle2 } from 'lucide-react';

const STORAGE_KEY = 'gsa_admin_test_checklist';

interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'test-1',
    label: 'Two approved users both see a message sent in General',
    hint: 'Both approved users have access to General and see incoming messages in real time.',
  },
  {
    id: 'test-2',
    label: 'A direct message between A and B is not visible to C',
    hint: 'Firestore security rules restrict directChats queries strictly to participants.',
  },
  {
    id: 'test-3',
    label: 'A user who is not in Finance Team sees it locked',
    hint: 'Displays lock icon and "Ask an administrator to add you" tooltip without querying messages.',
  },
  {
    id: 'test-4',
    label: 'Adding a user to a channel unlocks it for them without a refresh',
    hint: 'Real-time listener on users/{uid} updates permissions immediately when admin saves changes.',
  },
  {
    id: 'test-5',
    label: 'Removing a user from a channel locks it again',
    hint: 'Immediate removal from active channels locks channel and stops message queries.',
  },
  {
    id: 'test-6',
    label: 'A pending user cannot read any messages',
    hint: 'Unapproved accounts are blocked at login and cannot query channels or messages.',
  },
  {
    id: 'test-7',
    label: 'A staff user cannot open the admin pages',
    hint: 'Administrative routes and portal require admin role verification.',
  },
];

export const TestChecklist: React.FC = () => {
  const [checkedIds, setCheckedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('gs_test_checklist');
      if (localStorage.getItem('gs_test_checklist')) {
        localStorage.removeItem('gs_test_checklist');
      }
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedIds));
    } catch (e) {
      console.warn('Could not save checklist state to localStorage', e);
    }
  }, [checkedIds]);

  const toggleItem = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleReset = () => {
    setCheckedIds([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  };

  const completedCount = checkedIds.length;
  const totalCount = CHECKLIST_ITEMS.length;
  const isAllCompleted = completedCount === totalCount;

  return (
    <div className="space-y-6 max-w-[800px]">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-[24px] font-semibold text-[#E9EDEF] title-tracking">
              Test checklist
            </h2>
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#00A884]/15 text-[#00A884] border border-[#00A884]/30">
              Admin Only
            </span>
          </div>
          <p className="text-[13px] text-[#8696A0] leading-[1.5]">
            Interactive verification checklist for role-based message visibility and access controls. State is kept in your browser.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[13px] text-[#8696A0]">
            Passed:{' '}
            <span className="text-[#00A884] font-semibold tabular-nums">
              {completedCount}
            </span>{' '}
            / {totalCount}
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#1F2C33] hover:bg-[#2A3942] border border-white/[0.08] text-[12px] text-[#8696A0] hover:text-[#E9EDEF] transition-standard cursor-pointer"
            title="Reset all checklist items to unchecked"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#1F2C33] rounded-full h-2 overflow-hidden border border-white/[0.06]">
        <div
          className="bg-[#00A884] h-full transition-all duration-300"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      {isAllCompleted && (
        <div className="p-4 rounded-[10px] bg-[#00A884]/10 border border-[#00A884]/30 flex items-center gap-3 text-[#00A884]">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-[13px] font-medium">
            All visibility and security checks successfully verified.
          </span>
        </div>
      )}

      {/* Checklist Items */}
      <div className="bg-[#1F2C33] rounded-[12px] border border-white/[0.08] overflow-hidden divide-y divide-white/[0.04]">
        {CHECKLIST_ITEMS.map((item, index) => {
          const isChecked = checkedIds.includes(item.id);
          return (
            <label
              key={item.id}
              className={`p-4 flex items-start gap-3.5 transition-standard cursor-pointer select-none ${
                isChecked ? 'bg-[#00A884]/[0.03]' : 'hover:bg-white/[0.02]'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleItem(item.id)}
                className="mt-1 w-4 h-4 rounded border-white/20 text-[#00A884] focus:ring-0 focus:ring-offset-0 bg-[#2A3942] cursor-pointer accent-[#00A884]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-mono text-[#8696A0]">{index + 1}.</span>
                  <span
                    className={`text-[14px] font-medium leading-tight ${
                      isChecked ? 'text-[#E9EDEF] line-through opacity-70' : 'text-[#E9EDEF]'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                <p className="text-[12px] text-[#8696A0] mt-1 pl-5 leading-relaxed">
                  {item.hint}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};
