/**
 * iCalendar (.ics) export.
 *
 * Each meeting becomes one weekly repeating event from the first day of
 * classes through the last day of instruction, with holidays excluded.
 * Each final exam becomes a single event. Times use the person's time zone.
 */
(function (TSB) {
  'use strict';

  const { ICS_DAY_CODES, WEEK_ORDER } = TSB.constants;
  const { parseDate, parseTime, addDays, toIsoDate } = TSB.dates;
  const model = TSB.schedule;

  const encoder = new TextEncoder();
  const pad2 = (n) => String(n).padStart(2, '0');

  /** Escape text values per RFC 5545 section 3.3.11. */
  function escapeText(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  /** Fold a content line to at most 75 octets per line (RFC 5545 section 3.1). */
  function foldLine(line) {
    const parts = [];
    let current = '';
    let bytes = 0;
    for (const char of line) {
      const size = encoder.encode(char).length;
      const limit = parts.length ? 74 : 75; // continuation lines start with a space
      if (bytes + size > limit) {
        parts.push(current);
        current = '';
        bytes = 0;
      }
      current += char;
      bytes += size;
    }
    parts.push(current);
    return parts.join('\r\n ');
  }

  /** @returns {string} e.g. "20270105T173000Z" */
  function formatUtc(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  /** @returns {string} local date-time, e.g. "20270105T093000" */
  function formatLocal(date, minutes) {
    return `${toIsoDate(date).replace(/-/g, '')}T${pad2(Math.floor(minutes / 60))}${pad2(minutes % 60)}00`;
  }

  /** First date on or after `start` (and not after `end`) that falls on one of `days`. */
  function firstMeetingDate(start, end, days) {
    for (let offset = 0; offset < 7; offset++) {
      const date = addDays(start, offset);
      if (date > end) return null;
      if (days.includes(date.getDay())) return date;
    }
    return null;
  }

  /** @returns {string} e.g. "CSE 143: Computer Programming II (LAB)" */
  function meetingTitle(course, meeting) {
    const name = course.name ? `: ${course.name}` : '';
    const type = model.hasMultipleMeetings(course) ? ` (${meeting.type})` : '';
    return `${course.code}${name}${type}`;
  }

  function courseDescription(course) {
    return [course.name && `${course.code}: ${course.name}`, course.instructor && `Instructor: ${course.instructor}`]
      .filter(Boolean)
      .join('\n');
  }

  /**
   * @param {object} schedule a Schedule with term dates set
   * @param {{timeZone?: string, now?: Date}} [options]
   * @returns {string} the .ics file contents, CRLF line endings
   */
  function buildIcs(schedule, options = {}) {
    const timeZone = options.timeZone || 'America/Los_Angeles';
    const stamp = formatUtc(options.now || new Date());
    const termStart = parseDate(schedule.termStart);
    const termEnd = parseDate(schedule.termEnd);
    const holidays = model.allHolidays(schedule).map((h) => parseDate(h.date));
    const until = formatUtc(new Date(termEnd.getFullYear(), termEnd.getMonth(), termEnd.getDate(), 23, 59, 59));

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Term Schedule Builder//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeText(schedule.title || 'Class schedule')}`,
      `X-WR-TIMEZONE:${timeZone}`,
    ];

    for (const course of schedule.courses) {
      const description = courseDescription(course);

      for (const meeting of course.meetings) {
        const first = firstMeetingDate(termStart, termEnd, meeting.days);
        if (!first) continue;
        const start = parseTime(meeting.start);
        const end = parseTime(meeting.end);
        const byDay = WEEK_ORDER.filter((d) => meeting.days.includes(d)).map((d) => ICS_DAY_CODES[d]).join(',');

        lines.push(
          'BEGIN:VEVENT',
          `UID:${course.id}-${meeting.id}@term-schedule`,
          `DTSTAMP:${stamp}`,
          `SUMMARY:${escapeText(meetingTitle(course, meeting))}`,
          `DTSTART;TZID=${timeZone}:${formatLocal(first, start)}`,
          `DTEND;TZID=${timeZone}:${formatLocal(first, end)}`,
          `RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${until}`,
        );
        for (const holiday of holidays) {
          if (holiday >= termStart && holiday <= termEnd && meeting.days.includes(holiday.getDay())) {
            lines.push(`EXDATE;TZID=${timeZone}:${formatLocal(holiday, start)}`);
          }
        }
        if (meeting.location) lines.push(`LOCATION:${escapeText(meeting.location)}`);
        if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
        lines.push(`COLOR:${course.color}`, 'END:VEVENT');
      }

      if (model.hasValidFinal(course)) {
        const date = parseDate(course.final.date);
        lines.push(
          'BEGIN:VEVENT',
          `UID:${course.id}-final@term-schedule`,
          `DTSTAMP:${stamp}`,
          `SUMMARY:${escapeText(`${course.code} Final Exam`)}`,
          `DTSTART;TZID=${timeZone}:${formatLocal(date, parseTime(course.final.start))}`,
          `DTEND;TZID=${timeZone}:${formatLocal(date, parseTime(course.final.end))}`,
        );
        if (course.final.location) lines.push(`LOCATION:${escapeText(course.final.location)}`);
        if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
        lines.push('END:VEVENT');
      }
    }

    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join('\r\n') + '\r\n';
  }

  TSB.ics = Object.freeze({ buildIcs, escapeText, foldLine, meetingTitle });
})(globalThis.TSB = globalThis.TSB || {});
