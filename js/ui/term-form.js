/** Term fields: title, subtitle, first/last day of classes and finals start. */
(function (TSB) {
  'use strict';

  const { byId } = TSB.dom;
  const store = TSB.store;

  /** Input id → schedule property. */
  const FIELDS = {
    'term-title': 'title',
    'term-subtitle': 'subtitle',
    'term-start': 'termStart',
    'term-end': 'termEnd',
    'term-finals': 'finalsStart',
  };

  const DATE_FIELDS = new Set(['termStart', 'termEnd', 'finalsStart']);

  function render() {
    for (const [id, key] of Object.entries(FIELDS)) byId(id).value = store.state.schedule[key];
  }

  function init() {
    for (const [id, key] of Object.entries(FIELDS)) {
      byId(id).addEventListener('input', (event) => {
        store.state.schedule[key] = event.target.value;
        // Dates change which automatic holidays apply.
        store.markChanged('calendar', ...(DATE_FIELDS.has(key) ? ['holidays'] : []));
      });
    }
    store.subscribe('term', render);
  }

  TSB.termForm = Object.freeze({ init });
})(globalThis.TSB = globalThis.TSB || {});
