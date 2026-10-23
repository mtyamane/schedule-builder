/**
 * Entry point. Loaded last; wires up every UI module and draws the first frame.
 */
(function (TSB) {
  'use strict';

  TSB.termForm.init();
  TSB.holidaysPanel.init();
  TSB.courseList.init();
  TSB.calendarView.init();
  TSB.personalizePanel.init();
  TSB.toolbar.init();

  TSB.store.emitAll();
})(globalThis.TSB = globalThis.TSB || {});
