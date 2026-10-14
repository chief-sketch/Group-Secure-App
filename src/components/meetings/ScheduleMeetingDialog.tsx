import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, MapPin, Link2, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { MeetingDoc } from '../../types';

interface ScheduleMeetingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (meetingData: {
    title: string;
    startsAt: Timestamp;
    durationMinutes: number;
    location?: string;
    link?: string;
    note?: string;
  }) => Promise<void>;
  initialMeeting?: MeetingDoc | null;
  conversationName: string;
}

export const ScheduleMeetingDialog: React.FC<ScheduleMeetingDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  initialMeeting,
  conversationName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, isOpen, { onEscape: onClose, isDismissible: true });

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');

  const [errors, setErrors] = useState<{
    title?: string;
    time?: string;
    link?: string;
    location?: string;
    note?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // User's device local time zone name
  const timeZoneName =
    typeof Intl !== 'undefined' && Intl.DateTimeFormat
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time'
      : 'Local time';

  // Initialize form state
  useEffect(() => {
    if (!isOpen) return;

    if (initialMeeting) {
      setTitle(initialMeeting.title || '');
      setDuration(initialMeeting.durationMinutes || 30);
      setLocation(initialMeeting.location || '');
      setLink(initialMeeting.link || '');
      setNote(initialMeeting.note || '');

      let startDate: Date;
      if (initialMeeting.startsAt?.toDate) {
        startDate = initialMeeting.startsAt.toDate();
      } else if (initialMeeting.startsAt?.seconds) {
        startDate = new Date(initialMeeting.startsAt.seconds * 1000);
      } else {
        startDate = new Date(initialMeeting.startsAt || Date.now());
      }

      // Format date YYYY-MM-DD in local time
      const pad = (n: number) => String(n).padStart(2, '0');
      const yyyy = startDate.getFullYear();
      const mm = pad(startDate.getMonth() + 1);
      const dd = pad(startDate.getDate());
      setDate(`${yyyy}-${mm}-${dd}`);

      const hh = pad(startDate.getHours());
      const min = pad(startDate.getMinutes());
      setTime(`${hh}:${min}`);
    } else {
      // Default to today + next rounded 30-min block (or +1 hour)
      const now = new Date();
      now.setHours(now.getHours() + 1);
      now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);

      const pad = (n: number) => String(n).padStart(2, '0');
      const yyyy = now.getFullYear();
      const mm = pad(now.getMonth() + 1);
      const dd = pad(now.getDate());
      setDate(`${yyyy}-${mm}-${dd}`);

      const hh = pad(now.getHours());
      const min = pad(now.getMinutes());
      setTime(`${hh}:${min}`);

      setTitle('');
      setDuration(30);
      setLocation('');
      setLink('');
      setNote('');
    }

    setErrors({});
    setIsSubmitting(false);
  }, [isOpen, initialMeeting]);

  if (!isOpen) return null;

  const validateField = (field: string) => {
    const newErrors = { ...errors };

    if (field === 'title' || field === 'all') {
      const trimmed = title.trim();
      if (!trimmed) {
        newErrors.title = 'Title is required';
      } else if (trimmed.length > 100) {
        newErrors.title = 'Title cannot exceed 100 characters';
      } else {
        delete newErrors.title;
      }
    }

    if (field === 'time' || field === 'date' || field === 'all') {
      if (!date || !time) {
        newErrors.time = 'Date and time are required';
      } else {
        const [y, m, d] = date.split('-').map(Number);
        const [h, min] = time.split(':').map(Number);
        const targetDate = new Date(y, m - 1, d, h, min, 0, 0);

        if (isNaN(targetDate.getTime())) {
          newErrors.time = 'Invalid date or time';
        } else if (targetDate.getTime() <= Date.now() + 1000) {
          // Reject past times
          newErrors.time = 'Choose a time in the future';
        } else {
          delete newErrors.time;
        }
      }
    }

    if (field === 'link' || field === 'all') {
      const trimmed = link.trim();
      if (trimmed) {
        if (!trimmed.startsWith('https://')) {
          newErrors.link = 'Meeting link must start with https://';
        } else if (trimmed.length > 200) {
          newErrors.link = 'Meeting link cannot exceed 200 characters';
        } else {
          delete newErrors.link;
        }
      } else {
        delete newErrors.link;
      }
    }

    if (field === 'location' || field === 'all') {
      if (location.trim().length > 120) {
        newErrors.location = 'Location cannot exceed 120 characters';
      } else {
        delete newErrors.location;
      }
    }

    if (field === 'note' || field === 'all') {
      if (note.trim().length > 300) {
        newErrors.note = 'Note cannot exceed 300 characters';
      } else {
        delete newErrors.note;
      }
    }

    setErrors(newErrors);
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentErrors = validateField('all');
    if (Object.keys(currentErrors).length > 0) {
      return;
    }

    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = time.split(':').map(Number);
    const targetDate = new Date(y, m - 1, d, h, min, 0, 0);

    if (targetDate.getTime() <= Date.now()) {
      setErrors((prev) => ({ ...prev, time: 'Choose a time in the future' }));
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        startsAt: Timestamp.fromDate(targetDate),
        durationMinutes: duration,
        location: location.trim() || undefined,
        link: link.trim() || undefined,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to save meeting:', err);
      // Keep typed values on errors, and show error
      setErrors((prev) => ({
        ...prev,
        time: err?.message || 'Could not save meeting. Please check the time is in the future.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="w-full max-w-[480px] bg-[#1F2C33] rounded-[12px] border border-white/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Dialog Header */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0 bg-[#202C33]">
          <div>
            <h3
              id="schedule-dialog-title"
              className="text-[16px] font-semibold text-[#E9EDEF] leading-tight"
            >
              {initialMeeting ? 'Edit meeting' : 'Schedule a meeting'}
            </h3>
            <p className="text-[12px] text-[#8696A0] mt-0.5 truncate">
              {conversationName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center text-[#8696A0] hover:text-[#E9EDEF] rounded-[8px] hover:bg-white/[0.05] transition-standard cursor-pointer -mr-2"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Title */}
          <div>
            <label className="block text-[12px] font-medium text-[#8696A0] mb-1.5">
              Title <span className="text-[#00A884]">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => validateField('title')}
              placeholder="e.g. Weekly Standup, Project Review"
              className={`w-full h-10 px-3 rounded-[8px] bg-[#111B21] text-[#E9EDEF] text-[13px] border ${
                errors.title ? 'border-[#E5484D]' : 'border-white/[0.08]'
              } focus:border-[#00A884] focus:outline-none transition-standard`}
            />
            {errors.title && (
              <p className="text-[11px] text-[#E5484D] mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                <span>{errors.title}</span>
              </p>
            )}
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[#8696A0] mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Date <span className="text-[#00A884]">*</span></span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onBlur={() => validateField('date')}
                className="w-full h-10 px-3 rounded-[8px] bg-[#111B21] text-[#E9EDEF] text-[13px] border border-white/[0.08] focus:border-[#00A884] focus:outline-none transition-standard"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#8696A0] mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Time <span className="text-[#00A884]">*</span></span>
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                onBlur={() => validateField('time')}
                className={`w-full h-10 px-3 rounded-[8px] bg-[#111B21] text-[#E9EDEF] text-[13px] border ${
                  errors.time ? 'border-[#E5484D]' : 'border-white/[0.08]'
                } focus:border-[#00A884] focus:outline-none transition-standard`}
              />
              <p className="text-[10px] text-[#8696A0] mt-1">
                {timeZoneName}
              </p>
            </div>
          </div>

          {errors.time && (
            <p className="text-[11px] text-[#E5484D] -mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              <span>{errors.time}</span>
            </p>
          )}

          {/* Duration Dropdown */}
          <div>
            <label className="block text-[12px] font-medium text-[#8696A0] mb-1.5">
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-[8px] bg-[#111B21] text-[#E9EDEF] text-[13px] border border-white/[0.08] focus:border-[#00A884] focus:outline-none transition-standard cursor-pointer"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes (1 hr)</option>
              <option value={90}>90 minutes (1.5 hrs)</option>
              <option value={120}>120 minutes (2 hrs)</option>
            </select>
          </div>

          {/* Location or Room (Optional) */}
          <div>
            <label className="block text-[12px] font-medium text-[#8696A0] mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>Location or room (optional)</span>
            </label>
            <input
              type="text"
              maxLength={120}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={() => validateField('location')}
              placeholder="e.g. Conference Room B, HQ 3rd Floor"
              className={`w-full h-10 px-3 rounded-[8px] bg-[#111B21] text-[#E9EDEF] text-[13px] border ${
                errors.location ? 'border-[#E5484D]' : 'border-white/[0.08]'
              } focus:border-[#00A884] focus:outline-none transition-standard`}
            />
            {errors.location && (
              <p className="text-[11px] text-[#E5484D] mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                <span>{errors.location}</span>
              </p>
            )}
          </div>

          {/* Meeting Link (Optional) */}
          <div>
            <label className="block text-[12px] font-medium text-[#8696A0] mb-1.5 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" />
              <span>Meeting link (optional)</span>
            </label>
            <input
              type="url"
              maxLength={200}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onBlur={() => validateField('link')}
              placeholder="https://meet.google.com/... or https://zoom.us/..."
              className={`w-full h-10 px-3 rounded-[8px] bg-[#111B21] text-[#E9EDEF] text-[13px] border ${
                errors.link ? 'border-[#E5484D]' : 'border-white/[0.08]'
              } focus:border-[#00A884] focus:outline-none transition-standard`}
            />
            <p className="text-[11px] text-[#8696A0] mt-1">
              Paste a Google Meet or Zoom link if you have one
            </p>
            {errors.link && (
              <p className="text-[11px] text-[#E5484D] mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                <span>{errors.link}</span>
              </p>
            )}
          </div>

          {/* Note (Optional) */}
          <div>
            <label className="block text-[12px] font-medium text-[#8696A0] mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Note (optional)</span>
            </label>
            <textarea
              maxLength={300}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => validateField('note')}
              placeholder="Agenda items or preparation notes..."
              className={`w-full p-2.5 rounded-[8px] bg-[#111B21] text-[#E9EDEF] text-[13px] border ${
                errors.note ? 'border-[#E5484D]' : 'border-white/[0.08]'
              } focus:border-[#00A884] focus:outline-none transition-standard resize-none`}
            />
            {errors.note && (
              <p className="text-[11px] text-[#E5484D] mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                <span>{errors.note}</span>
              </p>
            )}
          </div>

          {/* Dialog Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 rounded-[8px] text-[13px] font-medium text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.05] transition-standard cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-5 py-2 rounded-[8px] text-[13px] font-semibold text-white bg-[#00A884] hover:bg-[#008f6f] disabled:opacity-50 transition-standard flex items-center gap-2 cursor-pointer shadow-md"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{initialMeeting ? 'Save changes' : 'Schedule meeting'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
