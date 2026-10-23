/** "Personalize calendar" panel: font, sizes, block details, layout and colors. */
(function (TSB) {
  'use strict';

  const { FONTS } = TSB.constants;
  const { byId } = TSB.dom;
  const { loadAllFonts } = TSB.fonts;
  const store = TSB.store;

  const SIZE_KEYS = ['title', 'day', 'block', 'time'];
  const DEFAULT_SIZES = { title: 1, day: 1, block: 1, time: 1 };

  const style = () => store.state.schedule.style;

  function fontOptionHtml(font, isSelected, clock) {
    const sample = clock === '24' ? '09:30' : '9:30 AM';
    return `
      <button type="button" class="font-option" data-font="${font.id}" aria-pressed="${isSelected}">
        <b style="font-family:'${font.title}',${font.fallback};font-weight:${font.titleWeight}">${font.label}</b>
        <span style="font-family:'${font.body}',${font.fallback}">CSE 143 · ${sample}</span>
      </button>`;
  }

  function render() {
    const current = style();
    byId('font-grid').innerHTML = FONTS.map((f) => fontOptionHtml(f, f.id === current.font, current.clock)).join('');

    // Each segmented control has data-setting naming a style property.
    document.querySelectorAll('#personalize .segmented[data-setting]').forEach((group) => {
      const value = String(current[group.dataset.setting]);
      group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === value)));
    });

    for (const key of SIZE_KEYS) {
      const percent = Math.round(current.sizes[key] * 100);
      byId(`size-${key}`).value = percent;
      byId(`size-${key}-value`).textContent = `${percent}%`;
    }

    for (const [key, shown] of Object.entries(current.blockDetails)) byId(`detail-${key}`).checked = shown;
  }

  /** Style changes affect the calendar, and the clock setting also affects the course list. */
  function changed() {
    store.markChanged('style', 'calendar', 'courses');
  }

  function onClick(event) {
    const fontButton = event.target.closest('[data-font]');
    if (fontButton) {
      style().font = fontButton.dataset.font;
      changed();
      return;
    }
    const option = event.target.closest('.segmented[data-setting] button');
    if (option) {
      style()[option.closest('.segmented').dataset.setting] = option.dataset.value;
      changed();
    }
  }

  function onInput(event) {
    const { sizeKey, detail } = event.target.dataset;
    if (sizeKey) {
      style().sizes[sizeKey] = Number(event.target.value) / 100;
      byId(`size-${sizeKey}-value`).textContent = `${event.target.value}%`;
      store.markChanged('calendar');
    } else if (detail) {
      style().blockDetails[detail] = event.target.checked;
      store.markChanged('calendar');
    }
  }

  function init() {
    const panel = byId('personalize');
    // Load every font only when the picker is opened, to keep first load light.
    panel.addEventListener('toggle', () => {
      if (panel.open) loadAllFonts();
    });
    panel.addEventListener('click', onClick);
    panel.addEventListener('input', onInput);
    byId('reset-sizes').addEventListener('click', () => {
      style().sizePreset = 'M';
      style().sizes = { ...DEFAULT_SIZES };
      changed();
    });
    store.subscribe('style', render);
  }

  TSB.personalizePanel = Object.freeze({ init });
})(globalThis.TSB = globalThis.TSB || {});
