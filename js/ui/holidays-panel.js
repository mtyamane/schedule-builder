/** Holiday controls: automatic holidays by region, the combined list, and the manual add form. */
(function (TSB) {
  'use strict';

  const { byId, escapeHtml, showToast } = TSB.dom;
  const { parseDate, formatDate } = TSB.dates;
  const model = TSB.schedule;
  const store = TSB.store;

  const AUTO_ID_PREFIX = 'auto-';

  function holidayItemHtml(holiday) {
    const date = parseDate(holiday.date);
    const label = holiday.label || 'Holiday';
    return `
      <li>
        <span class="holiday-list__date">${escapeHtml(date ? formatDate(date) : holiday.date)}</span>
        <span class="holiday-list__label">${escapeHtml(label)}${holiday.isAutomatic ? '<span class="auto-tag">AUTO</span>' : ''}</span>
        <button class="btn btn--ghost btn--small" data-remove="${escapeHtml(holiday.id)}" aria-label="Remove ${escapeHtml(label)}">Remove</button>
      </li>`;
  }

  function emptyMessage(schedule) {
    if (schedule.autoHolidays && !parseDate(schedule.termStart)) return 'Set the first day of classes to list holidays for the term.';
    if (schedule.autoHolidays) return 'No common holidays fall in this term.';
    return 'No holidays added.';
  }

  function render() {
    const { schedule } = store.state;
    byId('auto-holidays').checked = schedule.autoHolidays;
    byId('holiday-region').value = schedule.region;
    byId('holiday-region').disabled = !schedule.autoHolidays;
    byId('auto-holidays-hint').hidden = !schedule.autoHolidays;

    const holidays = model.allHolidays(schedule);
    let html = holidays.length
      ? holidays.map(holidayItemHtml).join('')
      : `<li class="holiday-list__note"><span class="hint">${emptyMessage(schedule)}</span></li>`;

    const skippedCount = schedule.autoHolidays ? schedule.skippedHolidays.length : 0;
    if (skippedCount) {
      html += `<li class="holiday-list__note"><button class="btn btn--ghost btn--small" data-restore>Restore ${skippedCount} removed holiday${skippedCount === 1 ? '' : 's'}</button></li>`;
    }
    byId('holiday-list').innerHTML = html;
  }

  function changed() {
    store.markChanged('holidays', 'calendar');
  }

  function addManualHoliday() {
    const dateInput = byId('holiday-date');
    const labelInput = byId('holiday-label');
    if (!parseDate(dateInput.value)) {
      showToast('Pick a date for the holiday.');
      dateInput.focus();
      return;
    }
    store.state.schedule.holidays.push({ id: model.createId(), date: dateInput.value, label: labelInput.value.trim() || 'Holiday' });
    dateInput.value = '';
    labelInput.value = '';
    changed();
  }

  function onListClick(event) {
    const { schedule } = store.state;
    if (event.target.closest('[data-restore]')) {
      schedule.skippedHolidays = [];
      changed();
      return;
    }
    const button = event.target.closest('[data-remove]');
    if (!button) return;
    const id = button.dataset.remove;
    if (id.startsWith(AUTO_ID_PREFIX)) {
      schedule.skippedHolidays.push(id.slice(AUTO_ID_PREFIX.length));
    } else {
      schedule.holidays = schedule.holidays.filter((h) => h.id !== id);
    }
    changed();
  }

  function init() {
    byId('auto-holidays').addEventListener('change', (event) => {
      store.state.schedule.autoHolidays = event.target.checked;
      changed();
    });
    byId('holiday-region').addEventListener('change', (event) => {
      store.state.schedule.region = event.target.value;
      store.state.schedule.skippedHolidays = [];
      changed();
    });
    byId('holiday-add').addEventListener('click', addManualHoliday);
    byId('holiday-list').addEventListener('click', onListClick);
    store.subscribe('holidays', render);
  }

  TSB.holidaysPanel = Object.freeze({ init });
})(globalThis.TSB = globalThis.TSB || {});
