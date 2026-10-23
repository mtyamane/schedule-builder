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

  /** Canada substitute rule: a weekend holiday moves to the following Monday. */
  function observedNextWeekday(date) {
    if (date.getDay() === 6) return addDays(date, 2);
    if (date.getDay() === 0) return addDays(date, 1);
    return date;
  }

  /** Christmas and Boxing Day with Canadian substitute days. */
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

  /**
   * Japan's vernal and autumnal equinox days, from the standard
   * approximation published by the National Astronomical Observatory
   * (accurate for 1980–2099).
   */
  function japaneseEquinoxes(year) {
    const t = year - 1980;
    const leapCorrection = Math.floor(t / 4);
    const vernal = Math.floor(20.8431 + 0.242194 * t - leapCorrection);
    const autumnal = Math.floor(23.2488 + 0.242194 * t - leapCorrection);
    return [new Date(year, 2, vernal), new Date(year, 8, autumnal)];
  }

  /**
   * Add Japan's two derived holiday types to a list of national holidays:
   * - Citizens' Holiday: a single day between two holidays is also a holiday.
   * - Substitute Holiday: a holiday on a Sunday moves to the next non-holiday day.
   * @param {[Date, string][]} holidays
   * @returns {[Date, string][]}
   */
  function addJapaneseDerivedHolidays(holidays) {
    const taken = new Set(holidays.map(([date]) => toIsoDate(date)));
    const result = [...holidays];

    for (const [date] of holidays) {
      const between = addDays(date, 1);
      if (!taken.has(toIsoDate(between)) && taken.has(toIsoDate(addDays(date, 2))) && between.getDay() !== 0) {
        result.push([between, "Citizens' Holiday"]);
        taken.add(toIsoDate(between));
      }
    }

    for (const [date] of [...result].sort((a, b) => a[0] - b[0])) {
      if (date.getDay() !== 0) continue;
      let substitute = addDays(date, 1);
      while (taken.has(toIsoDate(substitute))) substitute = addDays(substitute, 1);
      result.push([substitute, 'Substitute Holiday']);
      taken.add(toIsoDate(substitute));
    }
    return result;
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

    JP(year) {
      const [vernalEquinox, autumnalEquinox] = japaneseEquinoxes(year);
      return addJapaneseDerivedHolidays([
        [new Date(year, 0, 1), "New Year's Day"],
        [nthWeekday(year, 0, 1, 2), 'Coming of Age Day'],
        [new Date(year, 1, 11), 'National Foundation Day'],
        [new Date(year, 1, 23), "Emperor's Birthday"],
        [vernalEquinox, 'Vernal Equinox Day'],
        [new Date(year, 3, 29), 'Showa Day'],
        [new Date(year, 4, 3), 'Constitution Memorial Day'],
        [new Date(year, 4, 4), 'Greenery Day'],
        [new Date(year, 4, 5), "Children's Day"],
        [nthWeekday(year, 6, 1, 3), 'Marine Day'],
        [new Date(year, 7, 11), 'Mountain Day'],
        [nthWeekday(year, 8, 1, 3), 'Respect for the Aged Day'],
        [autumnalEquinox, 'Autumnal Equinox Day'],
        [nthWeekday(year, 9, 1, 2), 'Sports Day'],
        [new Date(year, 10, 3), 'Culture Day'],
        [new Date(year, 10, 23), 'Labor Thanksgiving Day'],
      ]);
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

  TSB.holidays = Object.freeze({ easterSunday, nthWeekday, japaneseEquinoxes, holidaysForRegion });
})(globalThis.TSB = globalThis.TSB || {});
