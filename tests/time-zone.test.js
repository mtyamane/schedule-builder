'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const TSB = require('./helpers/load-app');

const { offsetMinutes, localToUtc, offsetChanges, vtimezoneLines } = TSB.timeZone;

test('offsetMinutes follows daylight saving', () => {
  assert.equal(offsetMinutes('America/Los_Angeles', Date.UTC(2027, 0, 15)), -480);
  assert.equal(offsetMinutes('America/Los_Angeles', Date.UTC(2027, 6, 15)), -420);
  assert.equal(offsetMinutes('Asia/Tokyo', Date.UTC(2027, 6, 15)), 540);
  assert.equal(offsetMinutes('UTC', Date.UTC(2027, 6, 15)), 0);
});

test('localToUtc converts wall-clock time in a zone', () => {
  // Midnight at the end of Fri, Mar 12, 2027 in Los Angeles (PST) is 08:00 UTC on Mar 13.
  assert.equal(new Date(localToUtc('America/Los_Angeles', 2027, 2, 12, 24 * 60)).toISOString(), '2027-03-13T08:00:00.000Z');
  // After the change to PDT, 9:30 AM is 16:30 UTC.
  assert.equal(new Date(localToUtc('America/Los_Angeles', 2027, 2, 15, 570)).toISOString(), '2027-03-15T16:30:00.000Z');
});

test('offsetChanges finds daylight-saving switches to the minute', () => {
  const changes = offsetChanges('America/Los_Angeles', Date.UTC(2027, 0, 1), Date.UTC(2027, 11, 31));
  assert.deepEqual(changes.map((c) => [new Date(c.at).toISOString(), c.from, c.to]), [
    ['2027-03-14T10:00:00.000Z', -480, -420],
    ['2027-11-07T09:00:00.000Z', -420, -480],
  ]);
  assert.deepEqual(offsetChanges('Asia/Tokyo', Date.UTC(2027, 0, 1), Date.UTC(2027, 11, 31)), []);
});

test('vtimezoneLines describes standard and daylight time', () => {
  const la = vtimezoneLines('America/Los_Angeles', 2027, 2027).join('\n');
  assert.match(la, /BEGIN:DAYLIGHT\nDTSTART:20270314T020000\nTZOFFSETFROM:-0800\nTZOFFSETTO:-0700/);
  assert.match(la, /BEGIN:STANDARD\nDTSTART:20271107T020000\nTZOFFSETFROM:-0700\nTZOFFSETTO:-0800/);

  const tokyo = vtimezoneLines('Asia/Tokyo', 2027, 2027).join('\n');
  assert.doesNotMatch(tokyo, /DAYLIGHT/);
  assert.match(tokyo, /TZOFFSETTO:\+0900/);
});
