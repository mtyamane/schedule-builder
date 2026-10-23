/**
 * The schedule data model: types, factories, validation, normalization of
 * imported files, and derived values such as the holiday list.
 */
(function (TSB) {
  'use strict';

  const { COURSE_COLORS, FONTS, REGIONS, ROW_HEIGHTS, SIZE_PRESETS, SIZE_RANGE } = TSB.constants;
  const { parseDate, parseTime, addDays, mondayOf } = TSB.dates;
  const { holidaysForRegion } = TSB.holidays;
  const { isHexColor } = TSB.color;

  /**
   * @typedef {Object} Meeting      One recurring meeting pattern of a course.
   * @property {string} id
   * @property {string} type        Three-letter code: LEC, LAB, SEM, DIS or STU.
   * @property {number[]} days      Day indexes, 0 = Sunday.
   * @property {string} start       "HH:MM"
   * @property {string} end         "HH:MM"
   * @property {string} location
   *
   * @typedef {Object} FinalExam
   * @property {string} date        "YYYY-MM-DD"
   * @property {string} start
   * @property {string} end
   * @property {string} location
   *
   * @typedef {Object} Course
   * @property {string} id
   * @property {string} code        e.g. "CSE 143"
   * @property {string} name
   * @property {string} instructor
   * @property {string} color       "#rrggbb"
   * @property {Meeting[]} meetings The first is the main meeting; the rest are sections.
   * @property {FinalExam|null} final
   * @property {boolean} [isPreview] Set on an unsaved course shown while editing.
   *
   * @typedef {Object} Holiday
   * @property {string} id          Manual holidays: random id. Automatic: "auto-YYYY-MM-DD".
   * @property {string} date
   * @property {string} label
   * @property {boolean} [isAutomatic]
   *
   * @typedef {Object} CalendarStyle
   * @property {string} font        id from TSB.constants.FONTS
   * @property {'S'|'M'|'L'|'XL'} sizePreset
   * @property {{title: number, day: number, block: number, time: number}} sizes  multipliers
   * @property {{name: boolean, time: boolean, room: boolean, instructor: boolean, type: boolean}} blockDetails
   * @property {'compact'|'normal'|'roomy'} rowHeight
   * @property {'12'|'24'} clock
   * @property {'rounded'|'square'} corners
   * @property {'soft'|'bold'} blockColor
   * @property {'white'|'tint'|'dark'} imageBackground
   *
   * @typedef {Object} Schedule
   * @property {string} title
   * @property {string} subtitle
   * @property {string} termStart       First day of classes.
   * @property {string} termEnd         Last day of instruction.
   * @property {string} finalsStart     Optional; finals week otherwise follows the earliest final.
   * @property {boolean} autoHolidays
   * @property {string} region
   * @property {string[]} skippedHolidays  Dates of automatic holidays the person removed.
   * @property {Holiday[]} holidays     Manual holidays.
   * @property {Course[]} courses
   * @property {CalendarStyle} style
   */

  const FILE_APP_ID = 'term-schedule-builder';
  const FILE_VERSION = 2;

  /** @returns {string} a short random id */
  function createId() {
    return Math.random().toString(36).slice(2, 10);
  }

  /** @returns {CalendarStyle} */
  function defaultStyle() {
    return {
      font: 'classic',
      sizePreset: 'M',
      sizes: { title: 1, day: 1, block: 1, time: 1 },
      blockDetails: { name: false, time: true, room: true, instructor: false, type: true },
      rowHeight: 'normal',
      clock: '12',
      corners: 'rounded',
      blockColor: 'soft',
      imageBackground: 'white',
    };
  }

  /** @returns {object} the font definition for an id, falling back to the first font */
  function findFont(id) {
    return FONTS.find((font) => font.id === id) || FONTS[0];
  }

  /**
   * Guess a holiday region from an IANA time zone name.
   * @param {string} timeZone
   * @returns {string}
   */
  function regionForTimeZone(timeZone) {
    const zone = String(timeZone || '');
    if (/^Europe\/(London|Belfast)$/.test(zone)) return 'UK';
    const canadianZones = /^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Montreal|Moncton|Whitehorse|Yellowknife|Iqaluit)$/;
    if (canadianZones.test(zone) || zone.startsWith('Canada/')) return 'CA';
    return 'US';
  }

  /** @returns {Meeting} */
  function createMeeting(type = 'LEC') {
    return { id: createId(), type, days: [], start: '', end: '', location: '' };
  }

  /**
   * @param {string} [region]
   * @param {CalendarStyle} [style]
   * @returns {Schedule}
   */
  function createBlankSchedule(region = 'US', style = defaultStyle()) {
    return {
      title: '',
      subtitle: '',
      termStart: '',
      termEnd: '',
      finalsStart: '',
      autoHolidays: false,
      region,
      skippedHolidays: [],
      holidays: [],
      courses: [],
      style,
    };
  }

  /** @returns {Schedule} a filled-in sample shown on first load */
  function createExampleSchedule() {
    const meeting = (type, days, start, end, location) => ({ id: createId(), type, days, start, end, location });
    const course = (fields) => ({ id: createId(), instructor: '', final: null, ...fields });
    return {
      ...createBlankSchedule('US'),
      title: 'Winter Quarter 2027',
      subtitle: 'Example schedule',
      termStart: '2027-01-05',
      termEnd: '2027-03-12',
      autoHolidays: true,
      courses: [
        course({
          code: 'CSE 143', name: 'Computer Programming II', instructor: 'Prof. Lin', color: COURSE_COLORS[0],
          meetings: [meeting('LEC', [1, 3, 5], '09:30', '10:20', 'Kane Hall 130'), meeting('SEM', [4], '10:30', '11:20', 'CSE2 G04')],
          final: { date: '2027-03-15', start: '08:30', end: '10:20', location: 'Kane Hall 130' },
        }),
        course({
          code: 'MATH 126', name: 'Calculus III', instructor: 'Dr. Alvarez', color: COURSE_COLORS[1],
          meetings: [meeting('LEC', [1, 3, 5], '11:30', '12:20', 'Gowen 301'), meeting('SEM', [2], '11:30', '12:20', 'Savery 239')],
          final: { date: '2027-03-16', start: '14:30', end: '16:20', location: 'Gowen 301' },
        }),
        course({
          code: 'CHEM 142', name: 'General Chemistry', color: COURSE_COLORS[2],
          meetings: [meeting('LEC', [1, 3, 5], '13:30', '14:20', 'Bagley 131'), meeting('LAB', [2], '14:30', '17:20', 'Bagley 271')],
          final: { date: '2027-03-17', start: '08:30', end: '10:20', location: 'Bagley 131' },
        }),
        course({
          code: 'ENGL 131', name: 'Composition: Exposition', instructor: 'Dr. Okafor', color: COURSE_COLORS[4],
          meetings: [meeting('LEC', [2, 4], '09:00', '10:20', 'Mary Gates 254')],
        }),
      ],
    };
  }

  /* ---------- validation ---------- */

  /** @param {Meeting} meeting */
  function isValidMeeting(meeting) {
    const start = parseTime(meeting.start);
    const end = parseTime(meeting.end);
    return meeting.days.length > 0 && start !== null && end !== null && end > start;
  }

  /** @param {Course} course */
  function hasValidFinal(course) {
    const final = course.final;
    if (!final || !parseDate(final.date)) return false;
    const start = parseTime(final.start);
    const end = parseTime(final.end);
    return start !== null && end !== null && end > start;
  }

  /**
   * Check a course before saving it.
   * @param {Course} course
   * @returns {string|null} a message describing the first problem, or null when valid
   */
  function validateCourse(course) {
    if (!course.code.trim()) return 'Add a course code, like "CSE 143".';
    for (const [index, meeting] of course.meetings.entries()) {
      const name = index === 0 ? 'the main meeting' : `section ${index} (${meeting.type})`;
      if (!meeting.days.length) return `Pick at least one day for ${name}.`;
      if (parseTime(meeting.start) === null || parseTime(meeting.end) === null) return `Set a start and end time for ${name}.`;
      if (parseTime(meeting.end) <= parseTime(meeting.start)) return `The end time for ${name} must be after its start time.`;
    }
    if (course.final) {
      if (!parseDate(course.final.date)) return 'Pick a date for the final exam, or uncheck Final exam.';
      if (!hasValidFinal(course)) return 'Set a final exam start time and a later end time.';
    }
    return null;
  }

  /**
   * Check that a schedule has what calendar exports need.
   * @param {Schedule} schedule
   * @returns {string|null}
   */
  function getExportProblem(schedule) {
    if (!schedule.courses.length) return 'Add at least one class to export.';
    const start = parseDate(schedule.termStart);
    const end = parseDate(schedule.termEnd);
    if (!start || !end) return 'Add the first day of classes and the last day of instruction before exporting.';
    if (end < start) return 'The last day of instruction is before the first day of classes.';
    return null;
  }

  /* ---------- derived values ---------- */

  /** A course shows section type codes only when it has more than one meeting. */
  function hasMultipleMeetings(course) {
    return course.meetings.length > 1;
  }

  /** @param {Course[]} courses @returns {number} scheduled minutes per regular week */
  function weeklyClassMinutes(courses) {
    let total = 0;
    for (const course of courses) {
      for (const meeting of course.meetings) {
        if (isValidMeeting(meeting)) {
          total += (parseTime(meeting.end) - parseTime(meeting.start)) * meeting.days.length;
        }
      }
    }
    return total;
  }

  /**
   * Monday of finals week: the explicit finals date, else the week of the
   * earliest final, else the week after instruction ends.
   * @param {Schedule} schedule
   * @param {Course[]} [courses]
   * @returns {Date|null}
   */
  function finalsWeekStart(schedule, courses = schedule.courses) {
    const explicit = parseDate(schedule.finalsStart);
    if (explicit) return mondayOf(explicit);
    const finalDates = courses
      .filter((course) => course.final && parseDate(course.final.date))
      .map((course) => parseDate(course.final.date))
      .sort((a, b) => a - b);
    if (finalDates.length) return mondayOf(finalDates[0]);
    const termEnd = parseDate(schedule.termEnd);
    return termEnd ? addDays(mondayOf(termEnd), 7) : null;
  }

  /**
   * Date range automatic holidays are listed for: first day of classes
   * through the end of finals week.
   * @returns {[Date, Date]|null}
   */
  function holidayWindow(schedule) {
    const start = parseDate(schedule.termStart);
    if (!start) return null;
    let end = parseDate(schedule.termEnd) || addDays(start, 7 * 20);
    const finals = finalsWeekStart(schedule);
    if (finals && addDays(finals, 6) > end) end = addDays(finals, 6);
    return [start, end];
  }

  /**
   * @param {Schedule} schedule
   * @returns {Holiday[]} automatic holidays in the term, excluding removed ones and dates with a manual holiday
   */
  function automaticHolidays(schedule) {
    if (!schedule.autoHolidays) return [];
    const window = holidayWindow(schedule);
    if (!window) return [];
    const [start, end] = window;
    const manualDates = new Set(schedule.holidays.map((h) => h.date));
    const result = [];
    for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
      for (const holiday of holidaysForRegion(schedule.region, year)) {
        const date = parseDate(holiday.date);
        const inTerm = date >= start && date <= end;
        if (inTerm && !manualDates.has(holiday.date) && !schedule.skippedHolidays.includes(holiday.date)) {
          result.push({ ...holiday, id: `auto-${holiday.date}`, isAutomatic: true });
        }
      }
    }
    return result;
  }

  /** @returns {Holiday[]} manual and automatic holidays, sorted by date */
  function allHolidays(schedule) {
    return [...schedule.holidays, ...automaticHolidays(schedule)].sort((a, b) => a.date.localeCompare(b.date));
  }

  /* ---------- saved files ---------- */

  const asString = (value) => (typeof value === 'string' ? value : '');
  const pickOne = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

  function clampSize(value) {
    const n = Number(value);
    if (!(n >= SIZE_RANGE.min && n <= SIZE_RANGE.max)) return 1;
    return Math.round(n * 20) / 20; // nearest 5%
  }

  /**
   * Fill in and clamp style settings from a saved file.
   * Accepts the field names used by earlier versions of the app.
   * @param {object} raw
   * @returns {CalendarStyle}
   */
  function normalizeStyle(raw) {
    const defaults = defaultStyle();
    if (!raw || typeof raw !== 'object') return defaults;
    const details = raw.blockDetails || raw.show || {};
    const sizes = raw.sizes || {};
    return {
      font: findFont(raw.font).id,
      sizePreset: pickOne(raw.sizePreset || raw.preset, Object.keys(SIZE_PRESETS), 'M'),
      sizes: {
        title: clampSize(sizes.title),
        day: clampSize(sizes.day),
        block: clampSize(sizes.block),
        time: clampSize(sizes.time),
      },
      blockDetails: Object.fromEntries(
        Object.entries(defaults.blockDetails).map(([key, value]) => [key, typeof details[key] === 'boolean' ? details[key] : value]),
      ),
      rowHeight: pickOne(raw.rowHeight, Object.keys(ROW_HEIGHTS), 'normal'),
      clock: pickOne(String(raw.clock), ['12', '24'], '12'),
      corners: pickOne(raw.corners, ['rounded', 'square'], 'rounded'),
      blockColor: pickOne(raw.blockColor || raw.blockStyle, ['soft', 'bold'], 'soft'),
      imageBackground: pickOne(raw.imageBackground || raw.exportBg, ['white', 'tint', 'dark'], 'white'),
    };
  }

  function normalizeMeeting(raw) {
    return {
      id: createId(),
      type: asString(raw.type) || 'LEC',
      days: (Array.isArray(raw.days) ? raw.days : []).map(Number).filter((d) => d >= 0 && d <= 6),
      start: asString(raw.start),
      end: asString(raw.end),
      location: asString(raw.location),
    };
  }

  function normalizeCourse(raw, index) {
    const final = raw.final && parseDate(raw.final.date)
      ? { date: raw.final.date, start: asString(raw.final.start), end: asString(raw.final.end), location: asString(raw.final.location) }
      : null;
    return {
      id: createId(),
      code: asString(raw.code),
      name: asString(raw.name),
      instructor: asString(raw.instructor),
      color: isHexColor(raw.color) ? raw.color : COURSE_COLORS[index % COURSE_COLORS.length],
      meetings: (Array.isArray(raw.meetings) ? raw.meetings : []).filter(Boolean).map(normalizeMeeting),
      final,
    };
  }

  /**
   * Turn a parsed saved file into a valid Schedule.
   * Accepts files from earlier versions ("classes" and "skipAuto" fields).
   * @param {object} raw
   * @returns {Schedule}
   * @throws {TypeError} when the file is not a saved schedule
   */
  function normalizeSchedule(raw) {
    const courses = raw && (raw.courses || raw.classes);
    if (!Array.isArray(courses)) throw new TypeError('Not a saved schedule');
    const skipped = raw.skippedHolidays || raw.skipAuto;
    return {
      title: asString(raw.title),
      subtitle: asString(raw.subtitle),
      termStart: asString(raw.termStart),
      termEnd: asString(raw.termEnd),
      finalsStart: asString(raw.finalsStart),
      autoHolidays: Boolean(raw.autoHolidays),
      region: pickOne(raw.region, REGIONS, 'US'),
      skippedHolidays: Array.isArray(skipped) ? skipped.filter((d) => parseDate(d)) : [],
      holidays: (Array.isArray(raw.holidays) ? raw.holidays : [])
        .filter((h) => h && parseDate(h.date))
        .map((h) => ({ id: createId(), date: h.date, label: asString(h.label) || 'Holiday' })),
      courses: courses.filter((c) => c && c.code).map(normalizeCourse),
      style: normalizeStyle(raw.style),
    };
  }

  /**
   * @param {Schedule} schedule
   * @returns {object} the JSON-ready contents of a saved file
   */
  function toSavedFile(schedule) {
    return { app: FILE_APP_ID, version: FILE_VERSION, ...schedule };
  }

  TSB.schedule = Object.freeze({
    createId,
    defaultStyle,
    findFont,
    regionForTimeZone,
    createMeeting,
    createBlankSchedule,
    createExampleSchedule,
    isValidMeeting,
    hasValidFinal,
    validateCourse,
    getExportProblem,
    hasMultipleMeetings,
    weeklyClassMinutes,
    finalsWeekStart,
    automaticHolidays,
    allHolidays,
    normalizeStyle,
    normalizeSchedule,
    toSavedFile,
  });
})(globalThis.TSB = globalThis.TSB || {});
