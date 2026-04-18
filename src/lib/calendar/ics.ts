/**
 * Minimal RFC 5545 iCalendar formatter — enough for PAH to deliver a
 * bookable `.ics` file that imports cleanly into Google Calendar, Outlook,
 * and Apple Calendar. Supports single-event only (no recurrence yet).
 */

export interface ICalEvent {
  /** Stable unique ID for this event. Use booking UUID. */
  uid: string;
  /** Event title. */
  summary: string;
  /** Longer description (folded on \n). */
  description?: string;
  /** Physical location, or empty for VRI. */
  location?: string;
  /** ISO 8601 start timestamp (UTC). */
  startUtc: string;
  /** ISO 8601 end timestamp (UTC). */
  endUtc: string;
  /** Optional organizer email. */
  organizerEmail?: string;
  /** Optional attendees (cn=display name, email=mailto). */
  attendees?: Array<{ displayName?: string; email: string; role?: 'REQ-PARTICIPANT' | 'OPT-PARTICIPANT' }>;
  /** URL to pop open for details. */
  url?: string;
}

function toIcsDate(iso: string): string {
  // RFC 5545: YYYYMMDDTHHMMSSZ
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

/** Escape commas, semicolons, backslashes, newlines per RFC 5545. */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold long lines at 75 octets with \r\n + single space continuation (RFC 5545 line folding). */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let remainder = line;
  chunks.push(remainder.slice(0, 75));
  remainder = remainder.slice(75);
  while (remainder.length > 0) {
    chunks.push(' ' + remainder.slice(0, 74));
    remainder = remainder.slice(74);
  }
  return chunks.join('\r\n');
}

export function buildIcs(event: ICalEvent): string {
  const now = toIcsDate(new Date().toISOString());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PAH//Interpreter Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}@pah.app`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsDate(event.startUtc)}`,
    `DTEND:${toIcsDate(event.endUtc)}`,
    `SUMMARY:${escapeText(event.summary)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${escapeText(event.url)}`);
  if (event.organizerEmail) {
    lines.push(`ORGANIZER:mailto:${event.organizerEmail}`);
  }
  if (event.attendees) {
    for (const a of event.attendees) {
      const cn = a.displayName ? `;CN=${escapeText(a.displayName)}` : '';
      const role = a.role ?? 'REQ-PARTICIPANT';
      lines.push(`ATTENDEE;ROLE=${role}${cn}:mailto:${a.email}`);
    }
  }
  lines.push('STATUS:CONFIRMED');
  lines.push('TRANSP:OPAQUE');
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n');
}
