/**
 * Builds the data for one calendar view (first week, regular week or finals
 * week): which days to show, the events on each day, the visible hour range
 * and an explanatory note. Shared by the on-screen calendar and image export.
 */
(function (TSB) {
  'use strict';

  const { WEEK_ORDER, WEEKDAYS, MONTH_NAMES, DAY_RANGES } = TSB.constants;
  const { parseDate, parseTime, addDays, mondayOf, toIsoDate, formatDate, formatHour } = TSB.dates;
  const model = TSB.schedule;

  const DEFAULT_START_HOUR = 8;
  const DEFAULT_END_HOUR = 17;

  /**
   * @typedef {Object} DayColumn
   * @property {number} dayOfWeek
   * @property {Date|null} date       null for the regular-week view
   * @property {string|null} offLabel set when there are no classes that day ("Before classes", a holiday name)
   *
   * @typedef {Object} CalendarEvent
   * @property {number} dayOfWeek
   * @property {number} start         minutes after midnight
   * @property {number} end
   * @property {object} course
   * @property {string} sectionType   meeting type, shown only for courses with several meetings
   * @property {string} location
   * @property {boolean} isFinal
   * @property {boolean} isPreview
   * @property {number} lane          column within overlapping events
   * @property {number} laneCount
   * @property {boolean} overlaps     true when another event shares some of this time
   *
   * @typedef {Object} WeekView
   * @property {DayColumn[]} days
   * @property {CalendarEvent[]} events
   * @property {number} startHour
   * @property {number} endHour
   * @property {string} rangeLabel    e.g. "Week of Jan 4"; empty for the regular week
   * @property {string} note
   */

  const weekLabel = (monday) => `Week of ${MONTH_NAMES[monday.getMonth()]} ${monday.getDate()}`;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  function meetingEvent(course, meeting, dayOfWeek) {
    return {
      dayOfWeek,
      start: parseTime(meeting.start),
      end: parseTime(meeting.end),
      course,
      sectionType: model.hasMultipleMeetings(course) ? meeting.type : '',
      location: meeting.location,
      isFinal: false,
      isPreview: Boolean(course.isPreview),
    };
  }

  /** Events for every valid meeting on the given days of the week. */
  function regularEvents(courses, activeDays) {
    const events = [];
    for (const course of courses) {
      for (const meeting of course.meetings) {
        if (!model.isValidMeeting(meeting)) continue;
        for (const day of meeting.days) {
          if (activeDays.has(day)) events.push(meetingEvent(course, meeting, day));
        }
      }
    }
    return events;
  }

  const ALL_DAYS = new Set([0, 1, 2, 3, 4, 5, 6]);
  const undatedDays = () => WEEK_ORDER.map((dayOfWeek) => ({ dayOfWeek, date: null, offLabel: null }));

  function buildRegularWeek(schedule, courses) {
    const termStart = parseDate(schedule.termStart);
    const termEnd = parseDate(schedule.termEnd);
    let note = 'Your repeating weekly pattern. Add term dates to export it.';
    if (termStart && termEnd) {
      const skipped = model.allHolidays(schedule).filter((h) => {
        const date = parseDate(h.date);
        return date >= termStart && date <= termEnd && WEEKDAYS.includes(date.getDay());
      }).length;
      note = `Repeats weekly from ${formatDate(termStart)} through ${formatDate(termEnd)}`
        + (skipped ? `, skipping ${plural(skipped, 'holiday')}.` : '.');
    }
    return { days: undatedDays(), events: regularEvents(courses, ALL_DAYS), rangeLabel: '', note };
  }

  function buildFirstWeek(schedule, courses) {
    const termStart = parseDate(schedule.termStart);
    if (!termStart) {
      return {
        days: undatedDays(),
        events: regularEvents(courses, ALL_DAYS),
        rangeLabel: '',
        note: 'Add the first day of classes to build week 1. Showing the regular week until then.',
      };
    }

    const termEnd = parseDate(schedule.termEnd);
    const holidayNames = new Map(model.allHolidays(schedule).map((h) => [h.date, h.label || 'Holiday']));
    const monday = mondayOf(termStart);

    const days = WEEK_ORDER.map((dayOfWeek, index) => {
      const date = addDays(monday, index);
      let offLabel = null;
      if (date < termStart) offLabel = 'Before classes';
      else if (holidayNames.has(toIsoDate(date))) offLabel = holidayNames.get(toIsoDate(date));
      else if (termEnd && date > termEnd) offLabel = 'After term';
      return { dayOfWeek, date, offLabel };
    });

    const classDays = new Set(days.filter((d) => !d.offLabel).map((d) => d.dayOfWeek));
    const blockedBefore = days.filter((d) => d.date < termStart && WEEKDAYS.includes(d.dayOfWeek)).length;
    const holidaysThisWeek = days.filter((d) => d.offLabel && d.date >= termStart && d.offLabel !== 'After term');

    let note;
    if (termStart.getDay() === 1 && !holidaysThisWeek.length) {
      note = `Classes start on Monday, ${MONTH_NAMES[termStart.getMonth()]} ${termStart.getDate()}, so week 1 matches the regular week.`;
    } else {
      note = `Classes start ${formatDate(termStart)}.`;
      if (blockedBefore) note += ` ${plural(blockedBefore, 'weekday')} ${blockedBefore === 1 ? 'is' : 'are'} blocked out before then.`;
      if (holidaysThisWeek.length) note += ` No classes on ${holidaysThisWeek.map((d) => d.offLabel).join(', ')}.`;
    }

    return { days, events: regularEvents(courses, classDays), rangeLabel: weekLabel(monday), note };
  }

  function buildFinalsWeek(schedule, courses) {
    const monday = model.finalsWeekStart(schedule, courses);
    const withFinals = courses.filter(model.hasValidFinal);
    const events = [];
    const outside = [];
    let days = undatedDays();

    if (monday) {
      days = WEEK_ORDER.map((dayOfWeek, index) => ({ dayOfWeek, date: addDays(monday, index), offLabel: null }));
      const weekEnd = addDays(monday, 7);
      for (const course of withFinals) {
        const date = parseDate(course.final.date);
        if (date >= monday && date < weekEnd) {
          events.push({
            dayOfWeek: date.getDay(),
            start: parseTime(course.final.start),
            end: parseTime(course.final.end),
            course,
            sectionType: '',
            location: course.final.location,
            isFinal: true,
            isPreview: Boolean(course.isPreview),
          });
        } else {
          outside.push(course);
        }
      }
    }

    let note = 'No finals yet. Check "Final exam" when adding or editing a class.';
    if (withFinals.length) {
      note = `${plural(withFinals.length, 'final')} scheduled.`;
      if (outside.length) {
        note += ` Outside this week: ${outside.map((c) => `${c.code} (${formatDate(parseDate(c.final.date))})`).join(', ')}.`;
      }
    }
    return { days, events, rangeLabel: monday ? weekLabel(monday) : '', note };
  }

  /**
   * Assign side-by-side lanes to overlapping events on one day.
   * Mutates each event's `lane` and `laneCount`.
   * @param {CalendarEvent[]} events events for a single day
   */
  function assignLanes(events) {
    events.sort((a, b) => a.start - b.start || b.end - a.end);
    const clusters = [];
    let cluster = [];
    let clusterEnd = -1;
    for (const event of events) {
      if (cluster.length && event.start >= clusterEnd) {
        clusters.push(cluster);
        cluster = [];
        clusterEnd = -1;
      }
      cluster.push(event);
      clusterEnd = Math.max(clusterEnd, event.end);
    }
    if (cluster.length) clusters.push(cluster);

    for (const group of clusters) {
      const laneEnds = [];
      for (const event of group) {
        let lane = laneEnds.findIndex((end) => end <= event.start);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(0);
        }
        laneEnds[lane] = event.end;
        event.lane = lane;
      }
      for (const event of group) event.laneCount = laneEnds.length;
    }
  }

  /** Set `overlaps` on events that share time with another event on the same day. */
  function markOverlaps(dayEvents) {
    for (const event of dayEvents) {
      event.overlaps = dayEvents.some((other) => other !== event && event.start < other.end && other.start < event.end);
    }
  }

  const BUILDERS = { weekly: buildRegularWeek, week1: buildFirstWeek, finals: buildFinalsWeek };

  /**
   * Hours and days shared by all three views, so they line up.
   * Automatic hours cover 8 AM–5 PM plus any class in any view. Hours set by
   * the person stretch only when a class falls outside them, so no class is
   * ever hidden by the hour range.
   * @param {object} schedule
   * @param {object[]} courses
   * @returns {{startHour: number, endHour: number, days: number[], stretched: boolean}}
   */
  function displayFrame(schedule, courses) {
    const style = schedule.style || {};
    const allEvents = Object.values(BUILDERS).flatMap((build) => build(schedule, courses).events);

    let startHour = style.hourStart ?? DEFAULT_START_HOUR;
    let endHour = style.hourEnd ?? DEFAULT_END_HOUR;
    let stretched = false;
    if (allEvents.length) {
      const earliest = Math.floor(Math.min(...allEvents.map((e) => e.start)) / 60);
      const latest = Math.ceil(Math.max(...allEvents.map((e) => e.end)) / 60);
      if (earliest < startHour) {
        stretched = stretched || style.hourStart != null;
        startHour = earliest;
      }
      if (latest > endHour) {
        stretched = stretched || style.hourEnd != null;
        endHour = latest;
      }
    }
    startHour = Math.max(0, startHour);
    endHour = Math.min(24, Math.max(endHour, startHour + 1));

    const usedDays = new Set(allEvents.map((e) => e.dayOfWeek));
    const days = DAY_RANGES[style.days] || WEEK_ORDER.filter((d) => WEEKDAYS.includes(d) || usedDays.has(d));
    return { startHour, endHour, days, stretched };
  }

  /**
   * @param {object} schedule
   * @param {'week1'|'weekly'|'finals'} viewKey
   * @param {object[]} [courses] courses to show (defaults to the schedule's; may include an editing preview)
   * @returns {WeekView}
   */
  function buildWeekView(schedule, viewKey, courses = schedule.courses) {
    const build = BUILDERS[viewKey] || buildRegularWeek;
    const built = build(schedule, courses);
    const frame = displayFrame(schedule, courses);

    const shown = new Set(frame.days);
    const days = built.days.filter((d) => shown.has(d.dayOfWeek));
    const events = built.events.filter((e) => shown.has(e.dayOfWeek));
    for (const day of days) {
      const dayEvents = events.filter((e) => e.dayOfWeek === day.dayOfWeek);
      assignLanes(dayEvents);
      markOverlaps(dayEvents);
    }

    let note = built.note;
    const hidden = built.events.length - events.length;
    if (hidden) note += ` ${plural(hidden, 'meeting')} on hidden days ${hidden === 1 ? "isn't" : "aren't"} shown.`;
    if (frame.stretched) {
      const clock = (schedule.style && schedule.style.clock) || '12';
      note += ` Hours extended to ${formatHour(frame.startHour, clock)}–${formatHour(frame.endHour, clock)} to fit every class.`;
    }

    return { days, events, startHour: frame.startHour, endHour: frame.endHour, rangeLabel: built.rangeLabel, note };
  }

  TSB.weekView = Object.freeze({ buildWeekView, assignLanes, displayFrame });
})(globalThis.TSB = globalThis.TSB || {});
