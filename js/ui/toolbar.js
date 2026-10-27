/**
 * Header toolbar: undo/redo, Open and Save, the Export menu (calendar
 * files, images of the current view and the three-page PDF), the
 * "Not exported" chip, the example banner and the leave-page warning.
 */
(function (TSB) {
  'use strict';

  const { VIEWS, PAPER_SIZES } = TSB.constants;
  const { byId, showToast, showModal, setupMenu, downloadFile, printImage } = TSB.dom;
  const { buildIcs } = TSB.ics;
  const { buildGoogleCsv } = TSB.csv;
  const { buildPdf } = TSB.pdf;
  const { renderCalendarImage, canvasToJpegBytes } = TSB.calendarImage;
  const model = TSB.schedule;
  const store = TSB.store;

  /** @returns {string} a filename-safe version of the schedule title */
  function fileBaseName() {
    const slug = (store.state.schedule.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return slug || 'class-schedule';
  }

  /** Show a toast and return true when the schedule can't be exported yet. */
  function blockedExport() {
    const problem = model.getExportProblem(store.state.schedule);
    if (!problem) return false;
    showToast(problem);
    if (problem.startsWith('Add the first day')) byId('term-start').focus();
    return true;
  }

  function saveFile(filename, data, type) {
    downloadFile(filename, data, type);
    showToast(`Downloaded ${filename}`);
    store.markExported();
  }

  /* ---------- calendar exports and saved files ---------- */

  function exportIcs() {
    if (blockedExport()) return;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    saveFile(`${fileBaseName()}.ics`, buildIcs(store.state.schedule, { timeZone }), 'text/calendar');
  }

  function exportCsv() {
    if (blockedExport()) return;
    saveFile(`${fileBaseName()}.csv`, buildGoogleCsv(store.state.schedule), 'text/csv');
  }

  function saveSchedule() {
    const contents = JSON.stringify(model.toSavedFile(store.state.schedule), null, 2);
    saveFile(`${fileBaseName()}-schedule.json`, contents, 'application/json');
  }

  function chooseImportFile() {
    if (!store.state.hasUnexportedChanges) {
      byId('import-file').click();
      return;
    }
    showModal({
      title: 'Replace this schedule?',
      message: "You have changes that haven't been saved or exported. Opening a file replaces everything on this page.",
      actions: [{ label: 'Choose file anyway', value: 'import' }, { label: 'Cancel', value: 'cancel' }],
      onAction: (value) => {
        if (value === 'import') byId('import-file').click();
      },
    });
  }

  async function importFile(event) {
    const file = event.target.files[0];
    event.target.value = ''; // allow choosing the same file again
    if (!file) return;
    try {
      const schedule = model.normalizeSchedule(JSON.parse(await file.text()));
      store.replaceSchedule(schedule);
      const count = schedule.courses.length;
      showToast(`Opened ${count} class${count === 1 ? '' : 'es'}`);
    } catch (error) {
      showToast("That file isn't a saved schedule from this page. Choose a .json file made with Save.");
    }
  }

  /* ---------- images ---------- */

  async function renderCurrentView() {
    return renderCalendarImage(store.state.schedule, store.state.view, store.displayedCourses());
  }

  const imageBaseName = () => `${fileBaseName()}-${VIEWS[store.state.view].fileSuffix}`;

  async function downloadPng() {
    const { canvas } = await renderCurrentView();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    downloadFile(`${imageBaseName()}.png`, blob);
    showToast(`Downloaded ${imageBaseName()}.png`);
  }

  /** A PDF page from a rendered view. The image already includes the page margins, so it fills the page. */
  function pdfPage({ canvas, layout }) {
    return { jpeg: canvasToJpegBytes(canvas), width: canvas.width, height: canvas.height, pageWidth: layout.width, pageHeight: layout.height, margin: 0 };
  }

  async function downloadPdf() {
    const pdf = buildPdf([pdfPage(await renderCurrentView())]);
    downloadFile(`${imageBaseName()}.pdf`, new Blob([pdf], { type: 'application/pdf' }));
    showToast(`Downloaded ${imageBaseName()}.pdf`);
  }

  /** One PDF with first week, regular week and finals week, one per page. */
  async function downloadAllViewsPdf() {
    const { schedule } = store.state;
    const pages = [];
    for (const viewKey of Object.keys(VIEWS)) {
      pages.push(pdfPage(await renderCalendarImage(schedule, viewKey, store.displayedCourses())));
    }
    const filename = `${fileBaseName()}-all-views.pdf`;
    downloadFile(filename, new Blob([buildPdf(pages)], { type: 'application/pdf' }));
    showToast(`Downloaded ${filename}`);
  }

  async function printView() {
    const { canvas, layout } = await renderCurrentView();
    const pageSize = `${PAPER_SIZES[layout.page.paper].css} ${layout.page.orientation}`;
    printImage(canvas.toDataURL('image/png'), store.state.schedule.title || 'Class schedule', pageSize);
  }

  /* ---------- status, banner, leave warning ---------- */

  function renderStatus() {
    const { schedule, hasUnexportedChanges, hasExported } = store.state;
    const chip = byId('export-status');
    const hasContent = schedule.courses.length || schedule.title || schedule.termStart;
    if (hasUnexportedChanges && hasContent) {
      chip.hidden = false;
      chip.className = 'status-chip status-chip--warn';
      chip.textContent = 'Not exported';
    } else if (hasExported) {
      chip.hidden = false;
      chip.className = 'status-chip status-chip--ok';
      chip.textContent = 'Exported';
    } else {
      chip.hidden = true;
    }
  }

  function renderBanner() {
    byId('example-banner').hidden = !store.state.isExample;
  }

  function startBlank() {
    const current = store.state.schedule;
    const region = model.regionForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    store.replaceSchedule(model.createBlankSchedule(region, current.style));
  }

  /* ---------- undo / redo ---------- */

  function renderHistory() {
    byId('undo').disabled = !store.canUndo();
    byId('redo').disabled = !store.canRedo();
    byId('menu-view-name').textContent = VIEWS[store.state.view].label;
  }

  /** Text fields keep the browser's own undo; everywhere else, Ctrl/Cmd+Z undoes schedule changes. */
  function onKeydown(event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    const isUndo = key === 'z' && !event.shiftKey;
    const isRedo = (key === 'z' && event.shiftKey) || key === 'y';
    if (!isUndo && !isRedo) return;
    const el = document.activeElement;
    const inTextField = el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'range'].includes(el.type)));
    if (inTextField) return;
    event.preventDefault();
    const done = isUndo ? store.undo() : store.redo();
    if (done) showToast(isUndo ? 'Undone' : 'Redone');
  }

  const EXPORTS = {
    ics: exportIcs,
    csv: exportCsv,
    png: downloadPng,
    pdf: downloadPdf,
    print: printView,
    'pdf-all': downloadAllViewsPdf,
  };

  function init() {
    setupMenu(byId('export-button'), byId('export-menu'), (item) => EXPORTS[item.dataset.export]());
    byId('save-schedule').addEventListener('click', saveSchedule);
    byId('import-schedule').addEventListener('click', chooseImportFile);
    byId('import-file').addEventListener('change', importFile);
    byId('start-blank').addEventListener('click', startBlank);
    byId('undo').addEventListener('click', () => store.undo());
    byId('redo').addEventListener('click', () => store.redo());
    document.addEventListener('keydown', onKeydown);

    window.addEventListener('beforeunload', (event) => {
      if (!store.state.hasUnexportedChanges) return;
      event.preventDefault();
      event.returnValue = ''; // required by some browsers to show the prompt
    });

    store.subscribe('status', renderStatus);
    store.subscribe('banner', renderBanner);
    store.subscribe('history', renderHistory);
    store.subscribe('calendar', renderHistory); // keeps the menu's view name current
  }

  TSB.toolbar = Object.freeze({ init });
})(globalThis.TSB = globalThis.TSB || {});
