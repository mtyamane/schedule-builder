/**
 * Date and time helpers.
 *
 * Dates are stored as "YYYY-MM-DD" strings and handled as local-midnight
 * Date objects. Times are stored as "HH:MM" strings and handled as minutes
 * after midnight.
 */
(function (TSB) {
  'use strict';

  const { DAY_NAMES, DAY_LETTERS, MONTH_NAMES, WEEK_ORDER } = TSB.constants;

  const pad2 = (n) => String(n).padStart(2, '0');

  /**
   * Parse a "YYYY-MM-DD" string into a local Date at midnight.
   * @param {string} value
   * @returns {Date|null} null when the value is missing or malformed
   */
  function parseDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  /**
   * Format a Date as "YYYY-MM-DD" using its local date.
   * @param {Date} date
   * @returns {string}
   */
  function toIsoDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  /**
   * @param {Date} date
   * @param {number} days may be negative
   * @returns {Date} a new Date at local midnight
   */
  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  /**
   * @param {Date} date
   * @returns {Date} the Monday on or before `date`
   */
  function mondayOf(date) {
    return addDays(date, -((date.getDay() + 6) % 7));
  }

  /**
   * Parse an "HH:MM" string into minutes after midnight.
   * @param {string} value
   * @returns {number|null}
   */
  function parseTime(value) {
    if (typeof value !== 'string' || !/^\d{1,2}:\d{2}/.test(value)) return null;
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  const periodOf = (minutes) => (Math.floor(minutes / 60) % 24 >= 12 ? 'PM' : 'AM');

  /**
   * @param {number} minutes minutes after midnight
   * @param {'12'|'24'} [clock]
   * @param {boolean} [withPeriod] include AM/PM (12-hour clock only)
   * @returns {string} e.g. "9:30 AM" or "09:30"
   */
  function formatTime(minutes, clock = '12', withPeriod = true) {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    if (clock === '24') return `${pad2(hours)}:${pad2(mins)}`;
    const text = `${hours % 12 || 12}:${pad2(mins)}`;
    return withPeriod ? `${text} ${periodOf(minutes)}` : text;
  }

  /**
   * Full time range. AM/PM appears once when both ends share it.
   * @returns {string} e.g. "9:30–10:20 AM", "11:30 AM–12:20 PM" or "09:30–10:20"
   */
  function formatTimeRange(start, end, clock = '12') {
    if (clock === '24') return `${formatTime(start, '24')}–${formatTime(end, '24')}`;
    const samePeriod = periodOf(start) === periodOf(end);
    return `${formatTime(start, '12', !samePeriod)}–${formatTime(end, '12')}`;
  }

  /**
   * Compact range for small calendar blocks, without AM/PM.
   * @returns {string} e.g. "9:30–10:20"
   */
  function formatCompactRange(start, end, clock = '12') {
    return `${formatTime(start, clock, false)}–${formatTime(end, clock, false)}`;
  }

  /**
   * Hour label for the calendar's time column.
   * @param {number} hour 0–24
   * @returns {string} e.g. "8 AM" or "08:00"
   */
  function formatHour(hour, clock = '12') {
    if (clock === '24') return `${pad2(hour % 24)}:00`;
    return `${hour % 12 || 12} ${hour % 24 >= 12 ? 'PM' : 'AM'}`;
  }

  /** @returns {string} e.g. "Tue, Jan 5" */
  function formatDate(date) {
    return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
  }

  /** @returns {string} e.g. "Jan 5" */
  function formatMonthDay(date) {
    return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
  }

  /**
   * @param {number[]} days day indexes (0 = Sunday)
   * @returns {string} e.g. "MWF" or "TuTh", Monday first
   */
  function formatDays(days) {
    return WEEK_ORDER.filter((day) => days.includes(day)).map((day) => DAY_LETTERS[day]).join('');
  }

  TSB.dates = Object.freeze({
    parseDate,
    toIsoDate,
    addDays,
    mondayOf,
    parseTime,
    formatTime,
    formatTimeRange,
    formatCompactRange,
    formatHour,
    formatDate,
    formatMonthDay,
    formatDays,
  });
})(globalThis.TSB = globalThis.TSB || {});
