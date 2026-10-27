/**
 * "Personalize calendar" panel: page setup, font, point sizes, block
 * details, header and legend, hours and days, layout and colors.
 */
(function (TSB) {
  'use strict';

  const { FONTS, FONT_SIZE_ELEMENTS, presetFontSizes } = TSB.constants;
  const { formatHour } = TSB.dates;
  const { byId, escapeHtml, SEPARATOR_HTML } = TSB.dom;
  const { loadAllFonts } = TSB.fonts;
  const model = TSB.schedule;
  const store = TSB.store;

  const style = () => store.state.schedule.style;

  /** Read a style value by dotted path, e.g. "page.paper". */
  function getSetting(path) {
    return path.split('.').reduce((obj, key) => obj[key], style());
  }

  /** Set a style value by dotted path. */
  function setSetting(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((obj, key) => obj[key], style())[last] = value;
  }

  /* ---------- rendering ---------- */

  function fontOptionHtml(font, isSelected, clock) {
    const sample = clock === '24' ? '09:30' : '9:30 AM';
    return `
      <button type="button" class="font-option" data-font="${font.id}" aria-pressed="${isSelected}">
        <b style="font-family:'${font.title}',${font.fallback};font-weight:${font.titleWeight}">${font.label}</b>
        <span style="font-family:'${font.body}',${font.fallback}">CSE 143${SEPARATOR_HTML}${sample}</span>
      </button>`;
  }

  function sizeFieldHtml(element, value) {
    const id = `font-size-${element.key}`;
    return `
      <label class="size-field" for="${id}">
        <span>${escapeHtml(element.label)}</span>
        <span class="size-field__input">
          <input type="number" id="${id}" data-font-size="${element.key}" value="${value}" min="${element.min}" max="${element.max}" step="0.5" inputmode="decimal">
          pt
        </span>
      </label>`;
  }

  function hourOptionsHtml(selected, from, to, clock) {
    let html = `<option value="auto" ${selected === null ? 'selected' : ''}>Auto</option>`;
    for (let hour = from; hour <= to; hour++) {
      html += `<option value="${hour}" ${selected === hour ? 'selected' : ''}>${formatHour(hour, clock)}</option>`;
    }
    return html;
  }

  function renderPresetButtons() {
    const preset = model.matchingSizePreset(style().fontSizes);
    byId('size-presets').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === preset)));
  }

  function render() {
    const current = style();
    byId('font-grid').innerHTML = FONTS.map((f) => fontOptionHtml(f, f.id === current.font, current.clock)).join('');
    byId('size-grid').innerHTML = FONT_SIZE_ELEMENTS.map((el) => sizeFieldHtml(el, current.fontSizes[el.key])).join('');
    renderPresetButtons();

    // Each segmented control's data-setting names the style value it sets.
    document.querySelectorAll('#personalize .segmented[data-setting]').forEach((group) => {
      const value = String(getSetting(group.dataset.setting));
      group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === value)));
    });

    for (const [key, shown] of Object.entries(current.blockDetails)) byId(`detail-${key}`).checked = shown;
    for (const [key, shown] of Object.entries(current.header)) byId(`header-${key}`).checked = shown;
    byId('style-grayscale').checked = current.grayscale;

    byId('hour-start').innerHTML = hourOptionsHtml(current.hourStart, 0, 23, current.clock);
    byId('hour-end').innerHTML = hourOptionsHtml(current.hourEnd, 1, 24, current.clock);
  }

  /* ---------- changes ---------- */

  /** Style changes redraw the calendar; the clock and course colors also show in the course list. */
  function changed() {
    store.markChanged('style', 'calendar', 'courses');
  }

  function setCoursePalette(palette) {
    const { schedule } = store.state;
    if (palette === schedule.style.coursePalette) return;
    schedule.courses = model.recolorCourses(schedule.courses, schedule.style.coursePalette, palette);
    schedule.style.coursePalette = palette;
    changed();
  }

  function onClick(event) {
    const fontButton = event.target.closest('[data-font]');
    if (fontButton) {
      style().font = fontButton.dataset.font;
      changed();
      return;
    }

    const presetButton = event.target.closest('[data-preset]');
    if (presetButton) {
      style().fontSizes = presetFontSizes(presetButton.dataset.preset);
      changed();
      return;
    }

    const option = event.target.closest('.segmented[data-setting] button');
    if (option) {
      const setting = option.closest('.segmented').dataset.setting;
      if (setting === 'coursePalette') {
        setCoursePalette(option.dataset.value);
      } else {
        setSetting(setting, option.dataset.value);
        changed();
      }
    }
  }

  /** While typing a size, update the calendar but leave the field alone. */
  function onInput(event) {
    const target = event.target;
    const { fontSize, detail, header } = target.dataset;

    if (fontSize) {
      const value = model.clampFontSize(fontSize, target.value);
      if (value === null) return;
      style().fontSizes[fontSize] = value;
      renderPresetButtons();
      store.markChanged('calendar');
    } else if (detail) {
      style().blockDetails[detail] = target.checked;
      store.markChanged('calendar');
    } else if (header) {
      style().header[header] = target.checked;
      store.markChanged('calendar');
    } else if (target.id === 'style-grayscale') {
      style().grayscale = target.checked;
      store.markChanged('calendar');
    }
  }

  /** When a size field is left, show the value that was actually applied. */
  function onChange(event) {
    const target = event.target;
    if (target.dataset.fontSize) {
      target.value = style().fontSizes[target.dataset.fontSize];
      return;
    }
    if (target.id === 'hour-start' || target.id === 'hour-end') {
      const current = style();
      const value = target.value === 'auto' ? null : Number(target.value);
      if (target.id === 'hour-start') current.hourStart = value;
      else current.hourEnd = value;
      // Keep the end after the start.
      if (current.hourStart !== null && current.hourEnd !== null && current.hourEnd <= current.hourStart) {
        if (target.id === 'hour-start') current.hourEnd = Math.min(24, current.hourStart + 1);
        else current.hourStart = Math.max(0, current.hourEnd - 1);
      }
      changed();
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
    panel.addEventListener('change', onChange);
    byId('reset-sizes').addEventListener('click', () => {
      style().fontSizes = presetFontSizes('M');
      changed();
    });
    store.subscribe('style', render);
  }

  TSB.personalizePanel = Object.freeze({ init });
})(globalThis.TSB = globalThis.TSB || {});
