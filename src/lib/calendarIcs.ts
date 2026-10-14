/**
 * RFC 5545 iCalendar (.ics) generation and download utility for Group Secure App meetings.
 */

interface IcsMeetingData {
  id: string;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  location?: string;
  link?: string;
  note?: string;
  conversationName: string;
}

/**
 * Escapes characters per RFC 5545 section 3.3.11 (Text)
 * Commas, semicolons, backslashes, and newlines must be escaped.
 */
function escapeIcsText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Formats a Date object into UTC iCalendar date-time string: YYYYMMDDTHHMMSSZ
 */
function formatUtcDateTime(date: Date): string {
  const pad = (num: number) => String(num).padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Folds lines longer than 75 octets by inserting CRLF followed by a single space (RFC 5545 section 3.1)
 */
function foldLine(line: string): string {
  const MAX_LINE_LENGTH = 75;
  if (line.length <= MAX_LINE_LENGTH) {
    return line;
  }
  let result = '';
  let remaining = line;
  while (remaining.length > MAX_LINE_LENGTH) {
    result += remaining.slice(0, MAX_LINE_LENGTH) + '\r\n ';
    remaining = remaining.slice(MAX_LINE_LENGTH);
  }
  result += remaining;
  return result;
}

/**
 * Generates RFC 5545 compliant VCALENDAR string
 */
export function generateIcsContent(meeting: IcsMeetingData): string {
  const dtStamp = formatUtcDateTime(new Date());
  const dtStart = formatUtcDateTime(meeting.startsAt);
  const endMs = meeting.startsAt.getTime() + (meeting.durationMinutes || 30) * 60 * 1000;
  const dtEnd = formatUtcDateTime(new Date(endMs));

  const uid = `${meeting.id || Date.now()}@groupsecureapp`;
  const summary = escapeIcsText(meeting.title);
  
  const descParts: string[] = [];
  if (meeting.note && meeting.note.trim()) {
    descParts.push(meeting.note.trim());
  }
  if (meeting.conversationName) {
    descParts.push(`Conversation: ${meeting.conversationName}`);
  }
  if (meeting.link && meeting.link.trim()) {
    descParts.push(`Meeting link: ${meeting.link.trim()}`);
  }
  const description = escapeIcsText(descParts.join('\n\n'));

  const locationRaw = meeting.location?.trim() || meeting.link?.trim() || '';
  const location = escapeIcsText(locationRaw);

  const rawLines: string[] = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Group Secure App//Meetings//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
  ];

  if (description) {
    rawLines.push(`DESCRIPTION:${description}`);
  }
  if (location) {
    rawLines.push(`LOCATION:${location}`);
  }

  // 15-minute before reminder alarm
  rawLines.push(
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM'
  );

  rawLines.push('END:VEVENT', 'END:VCALENDAR');

  return rawLines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Initiates browser download of .ics file for a meeting
 */
export function downloadMeetingIcs(meeting: IcsMeetingData): void {
  const icsString = generateIcsContent(meeting);
  const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  // Sanitize title for filename: remove unsafe chars, replace spaces with underscores
  const safeTitle = (meeting.title || 'meeting')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  const filename = `${safeTitle || 'meeting'}.ics`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
