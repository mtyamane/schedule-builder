/**
 * iCalendar (.ics) export.
 *
 * Each meeting pattern becomes ONE weekly repeating event covering all of its
 * days (e.g. a Mon/Wed/Fri lecture is a single series with BYDAY=MO,WE,FR),
 * from the first day of classes through the last day of instruction, with
 * holidays excluded. Each final exam is a single event. Times are wall-clock
 * times in the person's time zone, which is described in a VTIMEZONE block so
 * calendar apps place every occurrence correctly across daylight-saving changes.
 */
(function (TSB) {
  'use strict';

  const { ICS_DAY_CODES, WEEK_ORDER } = TSB.constants;
  const { parseDate, parseTime, addDays, toIsoDate } = TSB.dates;
  const model = TSB.schedule;
  const { localToUtc, vtimezoneLines } = TSB.timeZone;

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

  const DEFAULT_TITLES = { format: 'code-name', sectionType: true };

  /**
   * The course part of an event title, by the "Event titles" setting.
   * Falls back to the code when the name is empty.
   * @returns {string} "CSE 143: Computer Programming II", "CSE 143" or "Computer Programming II"
   */
  function courseTitle(course, titles = DEFAULT_TITLES) {
    if (titles.format === 'code' || !course.name) return course.code;
    if (titles.format === 'name') return course.name;
    return `${course.code}: ${course.name}`;
  }

  /**
   * Calendar event title for a class meeting. The section type is added
   * only for classes with more than one meeting type, when chosen.
   * @param {object} course
   * @param {object} meeting
   * @param {{format: string, sectionType: boolean}} [titles] the style's eventTitles
   * @returns {string} e.g. "CSE 143: Computer Programming II (LAB)"
   */
  function meetingTitle(course, meeting, titles = DEFAULT_TITLES) {
    const type = titles.sectionType && model.hasMultipleMeetings(course) ? ` (${meeting.type})` : '';
    return `${courseTitle(course, titles)}${type}`;
  }

  /**
   * Calendar event title for a final exam: the code, or the name when only
   * names are chosen.
   * @returns {string} e.g. "CSE 143 Final Exam"
   */
  function finalTitle(course, titles = DEFAULT_TITLES) {
    const label = titles.format === 'name' && course.name ? course.name : course.code;
    return `${label} Final Exam`;
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
    const titles = (schedule.style && schedule.style.eventTitles) || DEFAULT_TITLES;
    const stamp = formatUtc(options.now || new Date());
    const termStart = parseDate(schedule.termStart);
    const termEnd = parseDate(schedule.termEnd);
    const holidays = model.allHolidays(schedule).map((h) => parseDate(h.date));
    // The series ends at the end of the last day of instruction in the class's
    // time zone (UNTIL must be in UTC when DTSTART has a TZID).
    const until = formatUtc(new Date(localToUtc(timeZone, termEnd.getFullYear(), termEnd.getMonth(), termEnd.getDate(), 24 * 60) - 1000));

    // Describe the time zone for every year the term and its finals touch.
    const finalYears = schedule.courses.filter(model.hasValidFinal).map((c) => parseDate(c.final.date).getFullYear());
    const firstYear = termStart.getFullYear();
    const lastYear = Math.max(termEnd.getFullYear(), ...finalYears);

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Term Schedule Builder//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeText(schedule.title || 'Class schedule')}`,
      `X-WR-TIMEZONE:${timeZone}`,
      ...vtimezoneLines(timeZone, firstYear, lastYear),
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
          `SUMMARY:${escapeText(meetingTitle(course, meeting, titles))}`,
          `DTSTART;TZID=${timeZone}:${formatLocal(first, start)}`,
          `DTEND;TZID=${timeZone}:${formatLocal(first, end)}`,
          `RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${until}`,
        );
        // Holidays that fall on this meeting's days are skipped, all on one line.
        const skipped = holidays
          .filter((holiday) => holiday >= termStart && holiday <= termEnd && meeting.days.includes(holiday.getDay()))
          .map((holiday) => formatLocal(holiday, start));
        if (skipped.length) lines.push(`EXDATE;TZID=${timeZone}:${skipped.join(',')}`);
        if (meeting.location) lines.push(`LOCATION:${escapeText(meeting.location)}`);
        if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
        lines.push('END:VEVENT');
      }

      if (model.hasValidFinal(course)) {
        const date = parseDate(course.final.date);
        lines.push(
          'BEGIN:VEVENT',
          `UID:${course.id}-final@term-schedule`,
          `DTSTAMP:${stamp}`,
          `SUMMARY:${escapeText(finalTitle(course, titles))}`,
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

  TSB.ics = Object.freeze({ buildIcs, escapeText, foldLine, meetingTitle, finalTitle });
})(globalThis.TSB = globalThis.TSB || {});
