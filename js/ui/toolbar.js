/**
 * Header toolbar and image actions: calendar exports, save/import,
 * PNG/PDF/print, the "Not exported" chip, the example banner and the
 * leave-page warning.
 */
(function (TSB) {
  'use strict';

  const { VIEWS, PAPER_SIZES } = TSB.constants;
  const { byId, showToast, showModal, downloadFile, printImage } = TSB.dom;
  const { buildIcs } = TSB.ics;
  const { buildGoogleCsv } = TSB.csv;
  const { buildImagePdf } = TSB.pdf;
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
      message: "You have changes that haven't been exported. Importing a file replaces everything on this page.",
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
      showToast(`Imported ${count} class${count === 1 ? '' : 'es'}`);
    } catch (error) {
      showToast("That file isn't a saved schedule from this page. Choose a .json file made with Save schedule.");
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

  async function downloadPdf() {
    const { canvas, layout } = await renderCurrentView();
    // The image already includes the page margins, so it fills the PDF page.
    const pdf = buildImagePdf(canvasToJpegBytes(canvas), canvas.width, canvas.height, {
      pageWidth: layout.width,
      pageHeight: layout.height,
      margin: 0,
    });
    downloadFile(`${imageBaseName()}.pdf`, new Blob([pdf], { type: 'application/pdf' }));
    showToast(`Downloaded ${imageBaseName()}.pdf`);
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

  function init() {
    byId('export-ics').addEventListener('click', exportIcs);
    byId('export-csv').addEventListener('click', exportCsv);
    byId('save-schedule').addEventListener('click', saveSchedule);
    byId('import-schedule').addEventListener('click', chooseImportFile);
    byId('import-file').addEventListener('change', importFile);
    byId('download-png').addEventListener('click', downloadPng);
    byId('download-pdf').addEventListener('click', downloadPdf);
    byId('print-calendar').addEventListener('click', printView);
    byId('start-blank').addEventListener('click', startBlank);

    window.addEventListener('beforeunload', (event) => {
      if (!store.state.hasUnexportedChanges) return;
      event.preventDefault();
      event.returnValue = ''; // required by some browsers to show the prompt
    });

    store.subscribe('status', renderStatus);
    store.subscribe('banner', renderBanner);
  }

  TSB.toolbar = Object.freeze({ init });
})(globalThis.TSB = globalThis.TSB || {});
