'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const TSB = require('./helpers/load-app');
const { oneCourseSchedule } = require('./helpers/fixtures');

const model = TSB.schedule;
const { toIsoDate } = TSB.dates;

test('validateCourse reports the first problem', () => {
  const course = oneCourseSchedule().courses[0];
  assert.equal(model.validateCourse(course), null);
  assert.match(model.validateCourse({ ...course, code: ' ' }), /course code/);
  assert.match(model.validateCourse({ ...course, meetings: [{ ...course.meetings[0], days: [] }] }), /at least one day/);
  assert.match(model.validateCourse({ ...course, meetings: [{ ...course.meetings[0], end: '09:00' }] }), /after its start/);
  assert.match(model.validateCourse({ ...course, final: { ...course.final, date: '' } }), /date for the final/);
});

test('getExportProblem requires courses and valid term dates', () => {
  assert.equal(model.getExportProblem(oneCourseSchedule()), null);
  assert.match(model.getExportProblem(oneCourseSchedule({ courses: [] })), /at least one class/);
  assert.match(model.getExportProblem(oneCourseSchedule({ termEnd: '' })), /first day of classes/);
  assert.match(model.getExportProblem(oneCourseSchedule({ termEnd: '2026-12-01' })), /before the first day/);
});

test('weeklyClassMinutes sums valid meetings', () => {
  assert.equal(model.weeklyClassMinutes(oneCourseSchedule().courses), 150); // 3 × 50 min
});

test('finalsWeekStart prefers the explicit date, then the earliest final', () => {
  assert.equal(toIsoDate(model.finalsWeekStart(oneCourseSchedule())), '2027-03-15');
  assert.equal(toIsoDate(model.finalsWeekStart(oneCourseSchedule({ finalsStart: '2027-03-20' }))), '2027-03-15');
  const noFinals = oneCourseSchedule();
  noFinals.courses[0].final = null;
  assert.equal(toIsoDate(model.finalsWeekStart(noFinals)), '2027-03-15'); // week after Mar 12
});

test('automaticHolidays lists holidays in the term only when turned on', () => {
  assert.deepEqual(model.automaticHolidays(oneCourseSchedule()), []);
  const labels = model.automaticHolidays(oneCourseSchedule({ autoHolidays: true })).map((h) => h.label);
  assert.deepEqual(labels, ['Martin Luther King Jr. Day', "Presidents' Day"]);
});

test('automaticHolidays skips removed dates and dates with a manual holiday', () => {
  const schedule = oneCourseSchedule({
    autoHolidays: true,
    skippedHolidays: ['2027-01-18'],
    holidays: [{ id: 'h1', date: '2027-02-15', label: 'Campus closed' }],
  });
  assert.deepEqual(model.automaticHolidays(schedule), []);
  assert.deepEqual(model.allHolidays(schedule).map((h) => h.label), ['Campus closed']);
});

test('normalizeSchedule accepts files from earlier versions', () => {
  const schedule = model.normalizeSchedule({
    title: 'Old file',
    region: 'CA',
    skipAuto: ['2027-01-18', 'not-a-date'],
    classes: [{ code: 'MATH 126', color: 'red', meetings: [{ days: [1, '3', 9], start: '11:30', end: '12:20' }] }],
    style: { preset: 'L', show: { name: true }, blockStyle: 'bold', exportBg: 'dark', sizes: { title: 5 } },
  });
  assert.equal(schedule.region, 'CA');
  assert.deepEqual(schedule.skippedHolidays, ['2027-01-18']);
  assert.equal(schedule.courses[0].code, 'MATH 126');
  assert.match(schedule.courses[0].color, /^#/);
  assert.deepEqual(schedule.courses[0].meetings[0].days, [1, 3]);
  assert.equal(schedule.style.fontSizes.title, 27.5); // Large preset, old title multiplier out of range → 100%
  assert.equal(schedule.style.fontSizes.code, 11);
  assert.equal(schedule.style.blockDetails.name, true);
  assert.equal(schedule.style.blockDetails.time, true); // default kept
  assert.equal(schedule.style.blockColor, 'bold');
  assert.equal(schedule.style.pageBackground, 'dark');
});

test('normalizeStyle maps the removed "classic" font to the default Clean font', () => {
  assert.equal(model.defaultStyle().font, 'clean');
  assert.equal(model.normalizeStyle({ font: 'classic' }).font, 'clean');
  assert.equal(model.normalizeStyle({ font: 'serif' }).font, 'serif');
});

test('font sizes: presets, matching and clamping', () => {
  const { presetFontSizes } = TSB.constants;
  assert.deepEqual(presetFontSizes('M'), { title: 24, subtitle: 12, day: 11, time: 8, code: 9.5, details: 8, legend: 8.5 });
  assert.equal(presetFontSizes('L').title, 27.5);
  assert.equal(model.matchingSizePreset(presetFontSizes('S')), 'S');
  assert.equal(model.matchingSizePreset({ ...presetFontSizes('M'), title: 25 }), null);
  assert.equal(model.clampFontSize('title', '100'), 48);
  assert.equal(model.clampFontSize('code', '10.3'), 10.5);
  assert.equal(model.clampFontSize('code', ''), null);
});

test('normalizeStyle keeps valid new settings and rejects bad ones', () => {
  const style = model.normalizeStyle({
    page: { paper: 'a4', orientation: 'portrait', margins: 'huge' },
    hourStart: 9, hourEnd: 7, days: 'mon-sat', legend: 'right', grayscale: true,
    coursePalette: 'colorblind', blockColor: 'outline', header: { subtitle: false },
    fontSizes: { title: 30, code: 'big' },
  });
  assert.deepEqual(style.page, { paper: 'a4', orientation: 'portrait', margins: 'normal' });
  assert.equal(style.hourStart, 9);
  assert.equal(style.hourEnd, null); // end before start is dropped
  assert.equal(style.days, 'mon-sat');
  assert.equal(style.legend, 'right');
  assert.equal(style.grayscale, true);
  assert.equal(style.coursePalette, 'colorblind');
  assert.equal(style.blockColor, 'outline');
  assert.deepEqual(style.header, { subtitle: false, viewLabel: true, weekRange: true });
  assert.equal(style.fontSizes.title, 30);
  assert.equal(style.fontSizes.code, 9.5); // invalid → default
});

test('normalizeSchedule rejects files that are not schedules', () => {
  assert.throws(() => model.normalizeSchedule({ hello: 'world' }), TypeError);
  assert.throws(() => model.normalizeSchedule(null), TypeError);
});

test('saved files round-trip through normalizeSchedule', () => {
  const original = oneCourseSchedule({ autoHolidays: true });
  const saved = JSON.parse(JSON.stringify(model.toSavedFile(original)));
  assert.equal(saved.app, 'term-schedule-builder');
  const restored = model.normalizeSchedule(saved);
  assert.equal(restored.title, original.title);
  assert.equal(restored.courses[0].meetings[0].start, '09:30');
  assert.deepEqual(restored.style, original.style);
});

test('regionForTimeZone maps common zones', () => {
  assert.equal(model.regionForTimeZone('America/Los_Angeles'), 'US');
  assert.equal(model.regionForTimeZone('America/Toronto'), 'CA');
  assert.equal(model.regionForTimeZone('Asia/Tokyo'), 'JP');
  assert.equal(model.regionForTimeZone('Europe/London'), 'US');
});
