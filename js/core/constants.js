/**
 * Shared constants: day and month names, course colors, meeting types,
 * calendar views, holiday regions, fonts and size presets.
 *
 * All scripts attach to the global `TSB` namespace (Term Schedule Builder).
 * `globalThis` makes the same file work in browsers and in Node tests.
 */
(function (TSB) {
  'use strict';

  /** Day names indexed like Date#getDay() (0 = Sunday). */
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /** Short day letters used in compact summaries such as "MWF" or "TuTh". */
  const DAY_LETTERS = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** Order days are displayed in: Monday first, Sunday last. */
  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

  /** Days that always appear on the calendar. Weekends appear only when used. */
  const WEEKDAYS = [1, 2, 3, 4, 5];

  /** iCalendar BYDAY codes indexed like Date#getDay(). */
  const ICS_DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

  /**
   * Course color palettes. Switching palettes recolors classes by position,
   * so the nth standard color becomes the nth colorblind-safe color.
   * The colorblind-safe set is the Okabe–Ito palette.
   */
  const COURSE_PALETTES = {
    standard: [
      '#3b5bdb', '#0ca678', '#e8590c', '#c2255c', '#7048e8',
      '#1098ad', '#e0a100', '#2f9e44', '#868e96', '#a61e4d',
    ],
    colorblind: ['#0072b2', '#e69f00', '#009e73', '#cc79a7', '#56b4e9', '#d55e00', '#f0e442', '#000000'],
  };

  const COURSE_COLORS = COURSE_PALETTES.standard;

  /** Three-letter meeting type codes. LEC is the default for a course's main meeting. */
  const MEETING_TYPES = [
    { code: 'LEC', label: 'Lecture' },
    { code: 'LAB', label: 'Lab' },
    { code: 'SEM', label: 'Seminar' },
    { code: 'DIS', label: 'Discussion' },
    { code: 'STU', label: 'Studio' },
  ];

  const VIEWS = {
    week1: { label: 'First week', fileSuffix: 'first-week' },
    weekly: { label: 'Regular week', fileSuffix: 'regular-week' },
    finals: { label: 'Finals week', fileSuffix: 'finals-week' },
  };

  /** Regions with built-in holiday rules (see core/holidays.js). */
  const REGIONS = ['US', 'CA', 'JP'];

  /**
   * Curated font pairings for the calendar. The first is the default and
   * matches the rest of the site.
   * `googleQuery` is the family part of a Google Fonts css2 URL; null means
   * the font is already loaded by index.html.
   */
  const FONTS = [
    { id: 'clean', label: 'Clean', title: 'DM Sans', titleWeight: 700, body: 'DM Sans', code: 'DM Sans', codeWeight: 700, fallback: 'sans-serif', googleQuery: null },
    { id: 'rounded', label: 'Rounded', title: 'Nunito', titleWeight: 800, body: 'Nunito', code: 'Nunito', codeWeight: 800, fallback: 'sans-serif', googleQuery: 'Nunito:wght@400;600;800' },
    { id: 'serif', label: 'Serif', title: 'Fraunces', titleWeight: 600, body: 'Source Serif 4', code: 'Source Serif 4', codeWeight: 600, fallback: 'Georgia, serif', googleQuery: 'Fraunces:opsz,wght@9..144,600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600' },
    { id: 'hand', label: 'Handwritten', title: 'Caveat', titleWeight: 700, body: 'Patrick Hand', code: 'Patrick Hand', codeWeight: 400, fallback: 'cursive', googleQuery: 'Caveat:wght@700&family=Patrick+Hand' },
    { id: 'mono', label: 'Typewriter', title: 'JetBrains Mono', titleWeight: 700, body: 'JetBrains Mono', code: 'JetBrains Mono', codeWeight: 500, fallback: 'monospace', googleQuery: 'JetBrains+Mono:wght@400;500;700' },
    { id: 'condensed', label: 'Condensed', title: 'Barlow Condensed', titleWeight: 700, body: 'Barlow Semi Condensed', code: 'Barlow Semi Condensed', codeWeight: 600, fallback: 'sans-serif', googleQuery: 'Barlow+Condensed:wght@700&family=Barlow+Semi+Condensed:wght@400;600' },
    { id: 'readable', label: 'Readable', title: 'Lexend', titleWeight: 700, body: 'Lexend', code: 'Lexend', codeWeight: 500, fallback: 'sans-serif', googleQuery: 'Lexend:wght@400;500;700' },
  ];

  /** Separator between items in plain text, such as select options and image text. */
  const SEPARATOR = ' | ';

  /**
   * Calendar text elements with their own size, in points (1 pt = 1/72 inch).
   * `base` is the Medium preset. Other text follows these:
   * the view label and week range use the subtitle size, dates under day
   * names are 80% of the day header size, and "no classes" labels use the
   * class details size.
   */
  const FONT_SIZE_ELEMENTS = [
    { key: 'title', label: 'Title', base: 24, min: 12, max: 48 },
    { key: 'subtitle', label: 'Subtitle', base: 12, min: 7, max: 24 },
    { key: 'day', label: 'Day headers', base: 11, min: 7, max: 20 },
    { key: 'time', label: 'Time labels', base: 8, min: 5, max: 14 },
    { key: 'code', label: 'Class code', base: 9.5, min: 6, max: 18 },
    { key: 'details', label: 'Class details', base: 8, min: 5, max: 16 },
    { key: 'legend', label: 'Legend', base: 8.5, min: 6, max: 16 },
  ];

  /** Size presets as multipliers of the base sizes, rounded to the nearest half point. */
  const SIZE_PRESET_FACTORS = { S: 0.85, M: 1, L: 1.15, XL: 1.3 };

  /** @returns {Object<string, number>} point sizes for a preset key */
  function presetFontSizes(preset) {
    const factor = SIZE_PRESET_FACTORS[preset] || 1;
    return Object.fromEntries(FONT_SIZE_ELEMENTS.map((el) => [el.key, Math.round(el.base * factor * 2) / 2]));
  }

  /** Paper sizes in points, landscape orientation (width > height). */
  const PAPER_SIZES = {
    letter: { label: 'Letter', width: 792, height: 612, css: 'letter' },
    a4: { label: 'A4', width: 842, height: 595, css: 'A4' },
  };

  /** Page margins in points. */
  const PAGE_MARGINS = { narrow: 18, normal: 36, wide: 54 };

  /** Resolution of PNG/PDF/print images, in dots per inch. */
  const EXPORT_DPI = 200;

  /**
   * Which days the calendar shows. `null` means automatic: Monday–Friday,
   * plus a weekend day when any view has a class on it.
   */
  const DAY_RANGES = {
    auto: null,
    weekdays: [1, 2, 3, 4, 5],
    'mon-sat': [1, 2, 3, 4, 5, 6],
    all: [1, 2, 3, 4, 5, 6, 0],
  };

  TSB.constants = Object.freeze({
    DAY_NAMES,
    DAY_LETTERS,
    MONTH_NAMES,
    WEEK_ORDER,
    WEEKDAYS,
    ICS_DAY_CODES,
    COURSE_PALETTES,
    COURSE_COLORS,
    MEETING_TYPES,
    VIEWS,
    REGIONS,
    FONTS,
    SEPARATOR,
    FONT_SIZE_ELEMENTS,
    SIZE_PRESET_FACTORS,
    presetFontSizes,
    PAPER_SIZES,
    PAGE_MARGINS,
    EXPORT_DPI,
    DAY_RANGES,
  });
})(globalThis.TSB = globalThis.TSB || {});
