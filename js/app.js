/**
 * Entry point. Loaded last; wires up every UI module and draws the first frame.
 *
 * Each module starts on its own, so if one script fails to load (for
 * example, a file missing from the server) the rest of the page still works
 * and the console names the missing file.
 */
(function (TSB) {
  'use strict';

  /** UI modules in start-up order, with the file each comes from. */
  const MODULES = [
    ['navigation', 'js/ui/navigation.js'],
    ['paneDivider', 'js/ui/pane-divider.js'],
    ['termForm', 'js/ui/term-form.js'],
    ['holidaysPanel', 'js/ui/holidays-panel.js'],
    ['courseList', 'js/ui/course-list.js'],
    ['calendarView', 'js/ui/calendar-view.js'],
    ['stylePanel', 'js/ui/style-panel.js'],
    ['toolbar', 'js/ui/toolbar.js'],
  ];

  const missing = [];
  for (const [name, file] of MODULES) {
    try {
      if (!TSB[name]) throw new Error(`${file} didn't load`);
      TSB[name].init();
    } catch (error) {
      missing.push(file);
      console.error(`Term Schedule Builder: ${file} could not start. Check that this file is uploaded to the site.`, error);
    }
  }

  if (TSB.store) TSB.store.emitAll();
  if (missing.length && TSB.dom) {
    TSB.dom.showToast(`Part of the page didn't load (${missing.join(', ')}). Some features may not work.`);
  }
})(globalThis.TSB = globalThis.TSB || {});
