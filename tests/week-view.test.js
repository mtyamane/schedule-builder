'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const TSB = require('./helpers/load-app');
const { oneCourseSchedule } = require('./helpers/fixtures');

const { buildWeekView, assignLanes } = TSB.weekView;

test('regular week shows Mon–Fri and one event per meeting day', () => {
  const view = buildWeekView(oneCourseSchedule(), 'weekly');
  assert.deepEqual(view.days.map((d) => d.dayOfWeek), [1, 2, 3, 4, 5]);
  assert.equal(view.events.length, 3);
  assert.equal(view.startHour, 8);
  assert.equal(view.endHour, 17);
});

test('first week blocks out days before a midweek start', () => {
  const view = buildWeekView(oneCourseSchedule(), 'week1');
  assert.equal(view.days[0].offLabel, 'Before classes'); // Monday Jan 4
  assert.equal(view.days[1].offLabel, null);
  assert.deepEqual(view.events.map((e) => e.dayOfWeek).sort(), [3, 5]); // Monday's lecture removed
  assert.equal(view.rangeLabel, 'Week of Jan 4');
  assert.match(view.note, /1 weekday is blocked out/);
});

test('first week marks holidays', () => {
  const schedule = oneCourseSchedule({ holidays: [{ id: 'h', date: '2027-01-06', label: 'Snow day' }] });
  const view = buildWeekView(schedule, 'week1');
  assert.equal(view.days[2].offLabel, 'Snow day');
  assert.match(view.note, /No classes on Snow day/);
});

test('weekend days appear only when used', () => {
  const schedule = oneCourseSchedule();
  schedule.courses[0].meetings.push({ id: 'm2', type: 'LAB', days: [6], start: '10:00', end: '12:00', location: '' });
  const view = buildWeekView(schedule, 'weekly');
  assert.deepEqual(view.days.map((d) => d.dayOfWeek), [1, 2, 3, 4, 5, 6]);
  assert.equal(view.events.find((e) => e.dayOfWeek === 6).sectionType, 'LAB');
});

test('finals week lists finals and reports ones outside the week', () => {
  const schedule = oneCourseSchedule();
  schedule.courses.push({ ...schedule.courses[0], id: 'c2', code: 'MATH 126', final: { date: '2027-03-25', start: '08:30', end: '10:20', location: '' } });
  const view = buildWeekView(schedule, 'finals');
  assert.equal(view.events.length, 1);
  assert.equal(view.events[0].isFinal, true);
  assert.match(view.note, /Outside this week: MATH 126/);
});

test('the hour range expands to fit early and late classes', () => {
  const schedule = oneCourseSchedule();
  schedule.courses[0].meetings[0].start = '07:30';
  schedule.courses[0].meetings[0].end = '18:10';
  const view = buildWeekView(schedule, 'weekly');
  assert.equal(view.startHour, 7);
  assert.equal(view.endHour, 19);
});

test('assignLanes places overlapping events side by side', () => {
  const events = [
    { start: 540, end: 600 },
    { start: 570, end: 630 },
    { start: 660, end: 720 },
  ];
  assignLanes(events);
  assert.deepEqual(events.map((e) => [e.lane, e.laneCount]), [[0, 2], [1, 2], [0, 1]]);
});
