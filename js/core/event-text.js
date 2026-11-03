/**
 * The text shown inside a calendar block, based on the person's
 * "Show in class blocks" settings. Shared by screen and image rendering.
 */
(function (TSB) {
  'use strict';

  const { formatTimeRange, formatCompactRange } = TSB.dates;

  /**
   * The bold first line of a block: the course code, or the course name when
   * "Course code" is unchecked. Falls back to the code when there's no name.
   * @param {object} event CalendarEvent
   * @param {object} style CalendarStyle
   * @returns {string}
   */
  function eventHeading(event, style) {
    const showCode = style.blockDetails.code !== false;
    return showCode || !event.course.name ? event.course.code : event.course.name;
  }

  /**
   * Tag after the heading: "FINAL" for exams, otherwise the section type
   * when that detail is turned on.
   * @param {object} event CalendarEvent
   * @param {object} style CalendarStyle
   * @returns {string}
   */
  function eventTag(event, style) {
    if (event.isFinal) return 'FINAL';
    return style.blockDetails.type && event.sectionType ? event.sectionType : '';
  }

  /**
   * Lines shown under the heading. The course name is skipped when it is
   * already the heading.
   * @param {object} event CalendarEvent
   * @param {object} style CalendarStyle
   * @param {{fullTimes?: boolean}} [options] fullTimes adds AM/PM (used in images)
   * @returns {string[]}
   */
  function eventDetailLines(event, style, options = {}) {
    const show = style.blockDetails;
    const lines = [];
    if (show.name && event.course.name && eventHeading(event, style) !== event.course.name) lines.push(event.course.name);
    if (show.time) {
      lines.push(options.fullTimes
        ? formatTimeRange(event.start, event.end, style.clock)
        : formatCompactRange(event.start, event.end, style.clock));
    }
    if (show.room && event.location) lines.push(event.location);
    if (show.instructor && event.course.instructor) lines.push(event.course.instructor);
    return lines;
  }

  TSB.eventText = Object.freeze({ eventHeading, eventTag, eventDetailLines });
})(globalThis.TSB = globalThis.TSB || {});
