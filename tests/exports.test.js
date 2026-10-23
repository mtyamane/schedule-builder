'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const TSB = require('./helpers/load-app');
const { oneCourseSchedule } = require('./helpers/fixtures');

const { buildIcs, escapeText, foldLine } = TSB.ics;
const { buildGoogleCsv } = TSB.csv;
const { buildImagePdf } = TSB.pdf;

const NOW = new Date(Date.UTC(2026, 9, 23, 12, 0, 0));
const ics = (schedule) => buildIcs(schedule, { timeZone: 'America/Los_Angeles', now: NOW });

/* ---------- iCalendar ---------- */

test('ics creates a weekly repeating event starting on the first meeting day', () => {
  const output = ics(oneCourseSchedule());
  assert.match(output, /^BEGIN:VCALENDAR\r\n/);
  assert.match(output, /END:VCALENDAR\r\n$/);
  assert.match(output, /SUMMARY:CSE 143: Computer Programming II\r\n/);
  assert.match(output, /DTSTART;TZID=America\/Los_Angeles:20270106T093000/); // first Wednesday
  assert.match(output, /RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=/);
  assert.match(output, /DTSTAMP:20261023T120000Z/);
});

test('ics excludes holidays that fall on meeting days', () => {
  const output = ics(oneCourseSchedule({ autoHolidays: true }));
  assert.match(output, /EXDATE;TZID=America\/Los_Angeles:20270118T093000/);
  assert.match(output, /EXDATE;TZID=America\/Los_Angeles:20270215T093000/);
});

test('ics adds a single event for each final exam', () => {
  const output = ics(oneCourseSchedule());
  assert.match(output, /SUMMARY:CSE 143 Final Exam/);
  assert.match(output, /DTSTART;TZID=America\/Los_Angeles:20270315T083000/);
});

test('ics labels section types only when a course has several meetings', () => {
  const schedule = oneCourseSchedule();
  schedule.courses[0].meetings.push({ id: 'm2', type: 'LAB', days: [4], start: '10:30', end: '11:20', location: '' });
  const output = ics(schedule);
  assert.match(output, /SUMMARY:CSE 143: Computer Programming II \(LEC\)/);
  assert.match(output, /SUMMARY:CSE 143: Computer Programming II \(LAB\)/);
});

test('ics escapes text and folds long lines to 75 bytes', () => {
  assert.equal(escapeText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  const folded = foldLine(`DESCRIPTION:${'x'.repeat(200)}`);
  for (const line of folded.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  assert.equal(folded.replace(/\r\n /g, ''), `DESCRIPTION:${'x'.repeat(200)}`);
});

/* ---------- CSV ---------- */

test('csv lists every meeting with Google Calendar headers', () => {
  const lines = buildGoogleCsv(oneCourseSchedule()).trim().split('\r\n');
  assert.equal(lines[0], '"Subject","Start Date","Start Time","End Date","End Time","All Day Event","Description","Location","Private"');
  // Jan 5 – Mar 12 has 29 MWF days, plus one final.
  assert.equal(lines.length - 1, 30);
  assert.match(lines[1], /^"CSE 143: Computer Programming II","01\/06\/2027","09:30 AM","01\/06\/2027","10:20 AM"/);
  assert.match(lines.at(-1), /"CSE 143 Final Exam","03\/15\/2027","08:30 AM"/);
});

test('csv skips holidays', () => {
  const csv = buildGoogleCsv(oneCourseSchedule({ autoHolidays: true }));
  assert.doesNotMatch(csv, /01\/18\/2027/);
  assert.equal(csv.trim().split('\r\n').length - 1, 28);
});

/* ---------- PDF ---------- */

test('pdf has a valid header, trailer and cross-reference offsets', () => {
  const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = buildImagePdf(fakeJpeg, 2200, 1700);
  const text = Buffer.from(pdf).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));

  const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  assert.equal(offsets.length, 5);
  offsets.forEach((offset, i) => assert.ok(text.startsWith(`${i + 1} 0 obj`, offset), `object ${i + 1} offset`));

  const startxref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.ok(text.startsWith('xref', startxref));
});
