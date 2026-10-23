'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const TSB = require('./helpers/load-app');

const d = TSB.dates;

test('parseDate reads YYYY-MM-DD as local midnight and rejects bad input', () => {
  const date = d.parseDate('2027-01-05');
  assert.equal(date.getFullYear(), 2027);
  assert.equal(date.getMonth(), 0);
  assert.equal(date.getDate(), 5);
  assert.equal(date.getHours(), 0);
  assert.equal(d.parseDate(''), null);
  assert.equal(d.parseDate('01/05/2027'), null);
  assert.equal(d.parseDate(undefined), null);
});

test('toIsoDate round-trips parseDate', () => {
  assert.equal(d.toIsoDate(d.parseDate('2026-12-31')), '2026-12-31');
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(d.toIsoDate(d.addDays(d.parseDate('2026-12-30'), 3)), '2027-01-02');
  assert.equal(d.toIsoDate(d.addDays(d.parseDate('2027-03-01'), -1)), '2027-02-28');
});

test('mondayOf returns the Monday on or before a date', () => {
  assert.equal(d.toIsoDate(d.mondayOf(d.parseDate('2027-01-05'))), '2027-01-04'); // Tuesday
  assert.equal(d.toIsoDate(d.mondayOf(d.parseDate('2027-01-04'))), '2027-01-04'); // Monday
  assert.equal(d.toIsoDate(d.mondayOf(d.parseDate('2027-01-10'))), '2027-01-04'); // Sunday
});

test('parseTime converts HH:MM to minutes', () => {
  assert.equal(d.parseTime('09:30'), 570);
  assert.equal(d.parseTime('00:00'), 0);
  assert.equal(d.parseTime(''), null);
});

test('formatTimeRange shows AM/PM once when both ends share it', () => {
  assert.equal(d.formatTimeRange(570, 620), '9:30–10:20 AM');
  assert.equal(d.formatTimeRange(690, 740), '11:30 AM–12:20 PM');
  assert.equal(d.formatTimeRange(570, 620, '24'), '09:30–10:20');
});

test('formatCompactRange and formatHour respect the clock setting', () => {
  assert.equal(d.formatCompactRange(810, 860), '1:30–2:20');
  assert.equal(d.formatCompactRange(810, 860, '24'), '13:30–14:20');
  assert.equal(d.formatHour(0), '12 AM');
  assert.equal(d.formatHour(12), '12 PM');
  assert.equal(d.formatHour(17, '24'), '17:00');
});

test('formatDays lists days Monday first', () => {
  assert.equal(d.formatDays([5, 1, 3]), 'MWF');
  assert.equal(d.formatDays([4, 2]), 'TuTh');
  assert.equal(d.formatDays([0, 6]), 'SaSu');
});
