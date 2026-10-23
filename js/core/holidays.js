/**
 * Common public holidays by region, computed for any year.
 *
 * These are national holidays most schools close for. Schools differ, so the
 * app lets people remove any of these and add their own.
 */
(function (TSB) {
  'use strict';

  const { addDays, toIsoDate } = TSB.dates;

  /**
   * Easter Sunday for a Gregorian year (anonymous Gregorian algorithm).
   * @param {number} year
   * @returns {Date}
   */
  function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = h + l - 7 * m + 114;
    return new Date(year, Math.floor(n / 31) - 1, (n % 31) + 1);
  }

  /**
   * The nth given weekday of a month, e.g. the 3rd Monday of January.
   * @param {number} year
   * @param {number} month 0-based
   * @param {number} weekday 0 = Sunday
   * @param {number} n 1-based, or -1 for the last one in the month
   * @returns {Date}
   */
  function nthWeekday(year, month, weekday, n) {
    if (n > 0) {
      const first = new Date(year, month, 1);
      return addDays(first, ((weekday - first.getDay() + 7) % 7) + 7 * (n - 1));
    }
    const last = new Date(year, month + 1, 0);
    return addDays(last, -((last.getDay() - weekday + 7) % 7));
  }

  /** US federal rule: a Saturday holiday is observed Friday, a Sunday one on Monday. */
  function observedNearestWeekday(date) {
    if (date.getDay() === 6) return addDays(date, -1);
    if (date.getDay() === 0) return addDays(date, 1);
    return date;
  }

  /** Canada/UK substitute rule: a weekend holiday moves to the following Monday. */
  function observedNextWeekday(date) {
    if (date.getDay() === 6) return addDays(date, 2);
    if (date.getDay() === 0) return addDays(date, 1);
    return date;
  }

  /** Christmas and Boxing Day with UK/Canada substitute days. */
  function christmasAndBoxingDay(year) {
    const christmas = new Date(year, 11, 25);
    const day = (d) => new Date(year, 11, d);
    switch (christmas.getDay()) {
      case 5: // Friday: Boxing Day falls on Saturday
        return [[christmas, 'Christmas Day'], [day(28), 'Boxing Day (observed)']];
      case 6: // Saturday
        return [[day(27), 'Christmas Day (observed)'], [day(28), 'Boxing Day (observed)']];
      case 0: // Sunday: Boxing Day stays on Monday
        return [[day(26), 'Boxing Day'], [day(27), 'Christmas Day (observed)']];
      default:
        return [[christmas, 'Christmas Day'], [day(26), 'Boxing Day']];
    }
  }

  /** Each rule returns [Date, label] pairs for one calendar year. */
  const RULES = {
    US(year) {
      const thanksgiving = nthWeekday(year, 10, 4, 4);
      return [
        [observedNearestWeekday(new Date(year, 0, 1)), "New Year's Day"],
        [nthWeekday(year, 0, 1, 3), 'Martin Luther King Jr. Day'],
        [nthWeekday(year, 1, 1, 3), "Presidents' Day"],
        [nthWeekday(year, 4, 1, -1), 'Memorial Day'],
        [observedNearestWeekday(new Date(year, 5, 19)), 'Juneteenth'],
        [observedNearestWeekday(new Date(year, 6, 4)), 'Independence Day'],
        [nthWeekday(year, 8, 1, 1), 'Labor Day'],
        [observedNearestWeekday(new Date(year, 10, 11)), 'Veterans Day'],
        [thanksgiving, 'Thanksgiving'],
        [addDays(thanksgiving, 1), 'Day after Thanksgiving'],
        [observedNearestWeekday(new Date(year, 11, 25)), 'Christmas Day'],
      ];
    },

    CA(year) {
      const may24 = new Date(year, 4, 24);
      return [
        [observedNextWeekday(new Date(year, 0, 1)), "New Year's Day"],
        [nthWeekday(year, 1, 1, 3), 'Family Day (most provinces)'],
        [addDays(easterSunday(year), -2), 'Good Friday'],
        [addDays(may24, -((may24.getDay() + 6) % 7)), 'Victoria Day'], // Monday on or before May 24
        [observedNextWeekday(new Date(year, 6, 1)), 'Canada Day'],
        [nthWeekday(year, 7, 1, 1), 'Civic Holiday (most provinces)'],
        [nthWeekday(year, 8, 1, 1), 'Labour Day'],
        [observedNextWeekday(new Date(year, 8, 30)), 'Truth and Reconciliation Day'],
        [nthWeekday(year, 9, 1, 2), 'Thanksgiving'],
        [new Date(year, 10, 11), 'Remembrance Day'],
        ...christmasAndBoxingDay(year),
      ];
    },

    UK(year) {
      const easter = easterSunday(year);
      return [
        [observedNextWeekday(new Date(year, 0, 1)), "New Year's Day"],
        [addDays(easter, -2), 'Good Friday'],
        [addDays(easter, 1), 'Easter Monday'],
        [nthWeekday(year, 4, 1, 1), 'Early May bank holiday'],
        [nthWeekday(year, 4, 1, -1), 'Spring bank holiday'],
        [nthWeekday(year, 7, 1, -1), 'Summer bank holiday'],
        ...christmasAndBoxingDay(year),
      ];
    },
  };

  /**
   * @param {string} region one of TSB.constants.REGIONS
   * @param {number} year
   * @returns {{date: string, label: string}[]} sorted by date
   */
  function holidaysForRegion(region, year) {
    const rule = RULES[region];
    if (!rule) return [];
    return rule(year)
      .map(([date, label]) => ({ date: toIsoDate(date), label }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  TSB.holidays = Object.freeze({ easterSunday, nthWeekday, holidaysForRegion });
})(globalThis.TSB = globalThis.TSB || {});
