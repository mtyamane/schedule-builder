'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const TSB = require('./helpers/load-app');
const { oneCourseSchedule } = require('./helpers/fixtures');

const { buildIcs, escapeText, foldLine } = TSB.ics;
const { buildGoogleCsv } = TSB.csv;
const { buildImagePdf, buildPdf } = TSB.pdf;

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
  // Both holidays on one line: MLK Day and Presidents' Day.
  assert.match(output, /EXDATE;TZID=America\/Los_Angeles:20270118T093000,20270215T093000\r\n/);
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

test('ics has one repeating series per meeting pattern, plus one event per final', () => {
  const schedule = TSB.schedule.createExampleSchedule();
  const output = buildIcs(schedule, { timeZone: 'America/Los_Angeles', now: NOW });
  const meetings = schedule.courses.reduce((n, c) => n + c.meetings.length, 0);
  const finals = schedule.courses.filter((c) => c.final).length;
  assert.equal((output.match(/BEGIN:VEVENT/g) || []).length, meetings + finals);
  assert.equal((output.match(/^RRULE:/gm) || []).length, meetings);
  assert.match(output, /BEGIN:VTIMEZONE\r\nTZID:America\/Los_Angeles/);
  assert.doesNotMatch(output, /^COLOR:/m);
});

test('the ics series end at the end of the last day of instruction, in the class time zone', () => {
  assert.match(ics(oneCourseSchedule()), /UNTIL=20270313T075959Z/); // Mar 12, 11:59:59 PM PST
  const tokyo = buildIcs(oneCourseSchedule(), { timeZone: 'Asia/Tokyo', now: NOW });
  assert.match(tokyo, /UNTIL=20270312T145959Z/); // Mar 12, 11:59:59 PM JST
});

/**
 * Expand the weekly series in an .ics the way a calendar app would and
 * return every class meeting as "Subject|MM/DD/YYYY|hh:mm AM".
 */
function expandIcs(text, timeZone) {
  const { localToUtc } = TSB.timeZone;
  const unfolded = text.replace(/\r\n /g, '');
  const codes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const pad = (n) => String(n).padStart(2, '0');
  const occurrences = [];
  for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const field = (name) => (block.match(new RegExp(`^${name}[^:]*:(.*)$`, 'm')) || [])[1];
    const rule = field('RRULE');
    if (!rule) continue;
    const summary = field('SUMMARY').replace(/\\([,;\\])/g, '$1');
    const [, y, mo, d, h, mi] = field('DTSTART').match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/).map(Number);
    const days = rule.match(/BYDAY=([^;]+)/)[1].split(',').map((c) => codes.indexOf(c));
    const until = Date.parse(rule.match(/UNTIL=(\d{8}T\d{6}Z)/)[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'));
    const skipped = new Set((field('EXDATE') || '').split(',').filter(Boolean).map((s) => s.slice(0, 8)));
    for (let date = new Date(Date.UTC(y, mo - 1, d)); ; date = new Date(date.getTime() + 86400000)) {
      const [yy, mm, dd] = [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()];
      if (localToUtc(timeZone, yy, mm, dd, h * 60 + mi) > until) break;
      if (!days.includes(date.getUTCDay()) || skipped.has(`${yy}${pad(mm + 1)}${pad(dd)}`)) continue;
      const hour12 = pad(h % 12 || 12);
      occurrences.push(`${summary}|${pad(mm + 1)}/${pad(dd)}/${yy}|${hour12}:${pad(mi)} ${h >= 12 ? 'PM' : 'AM'}`);
    }
  }
  return occurrences.sort();
}

test('the ics series produce exactly the same class meetings as the CSV', () => {
  const schedule = TSB.schedule.createExampleSchedule(); // includes automatic holidays
  const fromIcs = expandIcs(buildIcs(schedule, { timeZone: 'America/Los_Angeles', now: NOW }), 'America/Los_Angeles');
  const fromCsv = buildGoogleCsv(schedule).trim().split('\r\n').slice(1)
    .map((line) => line.slice(1, -1).split('","'))
    .filter((cells) => !cells[0].endsWith('Final Exam'))
    .map((cells) => `${cells[0]}|${cells[1]}|${cells[2]}`)
    .sort();
  assert.equal(fromIcs.length, 131);
  assert.deepEqual(fromIcs, fromCsv);
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

test('pdf can hold several pages, each with its own size', () => {
  const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = buildPdf([
    { jpeg: fakeJpeg, width: 2200, height: 1700, pageWidth: 792, pageHeight: 612, margin: 0 },
    { jpeg: fakeJpeg, width: 2200, height: 1700, pageWidth: 792, pageHeight: 612, margin: 0 },
    { jpeg: fakeJpeg, width: 1653, height: 2339, pageWidth: 595, pageHeight: 842, margin: 0 },
  ]);
  const text = Buffer.from(pdf).toString('latin1');
  assert.match(text, /\/Count 3/);
  assert.equal((text.match(/\/Type \/Page /g) || []).length, 3);
  assert.match(text, /\/MediaBox \[0 0 595 842\]/);

  const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  assert.equal(offsets.length, 11);
  offsets.forEach((offset, i) => assert.ok(text.startsWith(`${i + 1} 0 obj`, offset), `object ${i + 1} offset`));
});
