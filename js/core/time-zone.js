/**
 * Time zone helpers built on the browser's (or Node's) Intl time zone data.
 * Used by the iCalendar export to place times correctly and to describe the
 * time zone, including daylight-saving changes, inside the .ics file.
 */
(function (TSB) {
  'use strict';

  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  const formatters = new Map();

  function formatterFor(timeZone, style) {
    const key = `${timeZone}|${style}`;
    if (!formatters.has(key)) {
      formatters.set(key, new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: style, year: 'numeric' }));
    }
    return formatters.get(key);
  }

  /**
   * @param {string} timeZone IANA name, e.g. "America/Los_Angeles"
   * @param {number} utcMs a moment in time
   * @returns {number} minutes the zone is ahead of UTC at that moment (e.g. -480 for PST)
   */
  function offsetMinutes(timeZone, utcMs) {
    const part = formatterFor(timeZone, 'longOffset').formatToParts(new Date(utcMs)).find((p) => p.type === 'timeZoneName');
    const match = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(part ? part.value : '');
    if (!match) return 0; // "GMT" alone means UTC
    const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
    return match[1] === '-' ? -minutes : minutes;
  }

  /** @returns {string|null} a short name such as "PDT", or null when the zone has none */
  function shortName(timeZone, utcMs) {
    const part = formatterFor(timeZone, 'short').formatToParts(new Date(utcMs)).find((p) => p.type === 'timeZoneName');
    return part && /^[A-Z]{2,5}$/.test(part.value) ? part.value : null;
  }

  /**
   * The UTC moment of a wall-clock time in a zone.
   * @param {string} timeZone
   * @param {number} year
   * @param {number} month 0-based
   * @param {number} day
   * @param {number} [minutes] minutes after midnight
   * @returns {number} UTC milliseconds
   */
  function localToUtc(timeZone, year, month, day, minutes = 0) {
    const asUtc = Date.UTC(year, month, day, 0, minutes);
    let utc = asUtc - offsetMinutes(timeZone, asUtc) * MINUTE;
    // Re-check once, in case the guess landed on the other side of a daylight-saving change.
    utc = asUtc - offsetMinutes(timeZone, utc) * MINUTE;
    return utc;
  }

  /**
   * Moments when the zone's offset changes between two times.
   * @returns {{at: number, from: number, to: number}[]} UTC ms and offsets in minutes
   */
  function offsetChanges(timeZone, fromMs, toMs) {
    const changes = [];
    let previous = offsetMinutes(timeZone, fromMs);
    for (let t = fromMs + DAY; t <= toMs + DAY; t += DAY) {
      const current = offsetMinutes(timeZone, t);
      if (current === previous) continue;
      // Narrow the change down to the minute.
      let low = t - DAY;
      let high = t;
      while (high - low > MINUTE) {
        const mid = low + Math.floor((high - low) / 2 / MINUTE) * MINUTE;
        if (offsetMinutes(timeZone, mid) === previous) low = mid;
        else high = mid;
      }
      changes.push({ at: high, from: previous, to: current });
      previous = current;
    }
    return changes;
  }

  const pad2 = (n) => String(n).padStart(2, '0');

  /** @returns {string} e.g. "-0800" */
  function formatOffset(minutes) {
    const sign = minutes < 0 ? '-' : '+';
    const abs = Math.abs(minutes);
    return `${sign}${pad2(Math.floor(abs / 60))}${pad2(abs % 60)}`;
  }

  /** @returns {string} a UTC moment as wall-clock time at `offset`, e.g. "20270314T020000" */
  function formatWallClock(utcMs, offset) {
    const d = new Date(utcMs + offset * MINUTE);
    return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}00`;
  }

  /**
   * An iCalendar VTIMEZONE component describing the zone for whole years,
   * with one STANDARD or DAYLIGHT entry per offset change.
   * @param {string} timeZone
   * @param {number} firstYear
   * @param {number} lastYear
   * @returns {string[]} content lines
   */
  function vtimezoneLines(timeZone, firstYear, lastYear) {
    const from = Date.UTC(firstYear, 0, 1);
    const to = Date.UTC(lastYear, 11, 31, 23, 59);
    const initial = offsetMinutes(timeZone, from);
    const changes = offsetChanges(timeZone, from, to);

    // The offset in effect at the start, then each change. A change to a larger
    // offset is daylight time; a change back is standard time.
    const entries = [{ at: from, from: initial, to: initial, isDaylight: changes.length > 0 && changes[0].from > changes[0].to }];
    for (const change of changes) entries.push({ ...change, isDaylight: change.to > change.from });

    const lines = ['BEGIN:VTIMEZONE', `TZID:${timeZone}`];
    for (const entry of entries) {
      const kind = entry.isDaylight ? 'DAYLIGHT' : 'STANDARD';
      const name = shortName(timeZone, entry.at + MINUTE);
      // The first entry starts at a fixed early date so it covers any time before the first change.
      const start = entry === entries[0] ? '19700101T000000' : formatWallClock(entry.at, entry.from);
      lines.push(
        `BEGIN:${kind}`,
        `DTSTART:${start}`,
        `TZOFFSETFROM:${formatOffset(entry.from)}`,
        `TZOFFSETTO:${formatOffset(entry.to)}`,
        ...(name ? [`TZNAME:${name}`] : []),
        `END:${kind}`,
      );
    }
    lines.push('END:VTIMEZONE');
    return lines;
  }

  TSB.timeZone = Object.freeze({ offsetMinutes, localToUtc, offsetChanges, vtimezoneLines, formatOffset });
})(globalThis.TSB = globalThis.TSB || {});
