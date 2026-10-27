/**
 * Loads the browser-independent scripts into the global TSB namespace,
 * in the same order as index.html, and returns it.
 */
'use strict';

const path = require('node:path');

const SCRIPTS = [
  'core/constants.js',
  'core/dates.js',
  'core/holidays.js',
  'core/color.js',
  'core/schedule.js',
  'core/week-view.js',
  'core/event-text.js',
  'core/page-theme.js',
  'core/page-layout.js',
  'export/ics.js',
  'export/csv.js',
  'export/pdf.js',
];

for (const script of SCRIPTS) {
  require(path.join(__dirname, '..', '..', 'js', script));
}

module.exports = globalThis.TSB;
