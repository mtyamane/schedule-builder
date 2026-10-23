/**
 * CSV export in Google Calendar's import format.
 * CSV has no recurrence, so every class meeting is listed as its own event.
 */
(function (TSB) {
  'use strict';

  const { parseDate, parseTime, addDays, toIsoDate } = TSB.dates;
  const model = TSB.schedule;
  const { meetingTitle } = TSB.ics;

  const HEADER = ['Subject', 'Start Date', 'Start Time', 'End Date', 'End Time', 'All Day Event', 'Description', 'Location', 'Private'];
  const pad2 = (n) => String(n).padStart(2, '0');

  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  /** @returns {string} "MM/DD/YYYY" */
  const formatCsvDate = (date) => `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}/${date.getFullYear()}`;

  /** @returns {string} "09:30 AM" */
  function formatCsvTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const period = hours >= 12 ? 'PM' : 'AM';
    return `${pad2(hours % 12 || 12)}:${pad2(minutes % 60)} ${period}`;
  }

  function eventRow(subject, date, start, end, description, location) {
    return [subject, formatCsvDate(date), formatCsvTime(start), formatCsvDate(date), formatCsvTime(end), 'False', description, location, 'True'];
  }

  /**
   * @param {object} schedule a Schedule with term dates set
   * @returns {string} CSV contents, CRLF line endings, events sorted by date and time
   */
  function buildGoogleCsv(schedule) {
    const termStart = parseDate(schedule.termStart);
    const termEnd = parseDate(schedule.termEnd);
    const holidayDates = new Set(model.allHolidays(schedule).map((h) => h.date));
    const events = [];

    for (const course of schedule.courses) {
      const description = [course.name && `${course.code}: ${course.name}`, course.instructor && `Instructor: ${course.instructor}`]
        .filter(Boolean)
        .join(' | ');

      if (termStart && termEnd) {
        for (let date = termStart; date <= termEnd; date = addDays(date, 1)) {
          if (holidayDates.has(toIsoDate(date))) continue;
          for (const meeting of course.meetings) {
            if (!meeting.days.includes(date.getDay())) continue;
            const start = parseTime(meeting.start);
            events.push({ date, start, row: eventRow(meetingTitle(course, meeting), date, start, parseTime(meeting.end), description, meeting.location) });
          }
        }
      }

      if (model.hasValidFinal(course)) {
        const date = parseDate(course.final.date);
        const start = parseTime(course.final.start);
        events.push({ date, start, row: eventRow(`${course.code} Final Exam`, date, start, parseTime(course.final.end), description, course.final.location) });
      }
    }

    events.sort((a, b) => a.date - b.date || a.start - b.start);
    const rows = [HEADER, ...events.map((e) => e.row)];
    return rows.map((row) => row.map(quote).join(',')).join('\r\n') + '\r\n';
  }

  TSB.csv = Object.freeze({ buildGoogleCsv });
})(globalThis.TSB = globalThis.TSB || {});
