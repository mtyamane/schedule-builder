'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const TSB = require('./helpers/load-app');

const { easterSunday, nthWeekday, holidaysForRegion } = TSB.holidays;
const { toIsoDate } = TSB.dates;

const datesOf = (region, year) => Object.fromEntries(holidaysForRegion(region, year).map((h) => [h.label, h.date]));

test('easterSunday matches known dates', () => {
  assert.equal(toIsoDate(easterSunday(2024)), '2024-03-31');
  assert.equal(toIsoDate(easterSunday(2026)), '2026-04-05');
  assert.equal(toIsoDate(easterSunday(2027)), '2027-03-28');
});

test('nthWeekday finds nth and last weekdays', () => {
  assert.equal(toIsoDate(nthWeekday(2027, 0, 1, 3)), '2027-01-18'); // 3rd Monday of January
  assert.equal(toIsoDate(nthWeekday(2027, 4, 1, -1)), '2027-05-31'); // last Monday of May
  assert.equal(toIsoDate(nthWeekday(2027, 10, 4, 4)), '2027-11-25'); // 4th Thursday of November
});

test('US holidays for 2027, including observed dates', () => {
  const us = datesOf('US', 2027);
  assert.equal(us['Martin Luther King Jr. Day'], '2027-01-18');
  assert.equal(us["Presidents' Day"], '2027-02-15');
  assert.equal(us.Juneteenth, '2027-06-18'); // Saturday → Friday
  assert.equal(us['Independence Day'], '2027-07-05'); // Sunday → Monday
  assert.equal(us['Day after Thanksgiving'], '2027-11-26');
  assert.equal(us['Christmas Day'], '2027-12-24'); // Saturday → Friday
});

test('Canadian holidays for 2027', () => {
  const ca = datesOf('CA', 2027);
  assert.equal(ca['Victoria Day'], '2027-05-24');
  assert.equal(ca.Thanksgiving, '2027-10-11');
  assert.equal(ca['Good Friday'], '2027-03-26');
  assert.equal(ca['Christmas Day (observed)'], '2027-12-27');
  assert.equal(ca['Boxing Day (observed)'], '2027-12-28');
});

test('UK bank holidays for 2027', () => {
  const uk = datesOf('UK', 2027);
  assert.equal(uk['Easter Monday'], '2027-03-29');
  assert.equal(uk['Early May bank holiday'], '2027-05-03');
  assert.equal(uk['Summer bank holiday'], '2027-08-30');
});

test('holidays are sorted and unknown regions return nothing', () => {
  const dates = holidaysForRegion('US', 2027).map((h) => h.date);
  assert.deepEqual(dates, [...dates].sort());
  assert.deepEqual(holidaysForRegion('XX', 2027), []);
});
