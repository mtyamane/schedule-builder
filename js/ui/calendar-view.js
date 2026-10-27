/**
 * On-screen calendar: view tabs, the note above the page, and a live page
 * preview. The preview is an SVG drawn from the same page layout as the
 * PNG/PDF/print export, scaled to fit the pane. On top of the export, the
 * preview lets you click a class to edit it and outlines overlapping classes.
 */
(function (TSB) {
  'use strict';

  const { VIEWS } = TSB.constants;
  const { buildPageLayout } = TSB.pageLayout;
  const { byId, escapeHtml, joinWithSeparators } = TSB.dom;
  const { ensureFontLoaded, createTextMeasurer, onFontsLoaded } = TSB.fonts;
  const model = TSB.schedule;
  const store = TSB.store;

  const VIEW_ORDER = ['week1', 'weekly', 'finals'];
  const OVERLAP_COLOR = '#e8590c';
  const round = (n) => Math.round(n * 100) / 100;

  /* ---------- SVG from the display list ---------- */

  /** @returns {string} SVG markup for one display-list item */
  function itemSvg(item, fontFamilies, defs, ids) {
    switch (item.type) {
      case 'rect': {
        const stroke = item.stroke
          ? ` stroke="${item.stroke}" stroke-width="${round(item.strokeWidth || 1)}"${item.dashed ? ' stroke-dasharray="3 2"' : ''}`
          : '';
        return `<rect x="${round(item.x)}" y="${round(item.y)}" width="${round(item.w)}" height="${round(item.h)}" rx="${round(item.radius || 0)}" fill="${item.fill || 'none'}"${stroke}/>`;
      }
      case 'hatch': {
        const id = `hatch-${ids.next++}`;
        // Same diagonal lines as the canvas: `spacing` apart horizontally, rising to the right.
        const gap = round(item.spacing * Math.SQRT1_2);
        defs.push(`<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${gap}" stroke="${item.color}" stroke-width="0.7"/></pattern>`);
        const box = `x="${round(item.x)}" y="${round(item.y)}" width="${round(item.w)}" height="${round(item.h)}"`;
        return `<rect ${box} fill="${item.fill}"/><rect ${box} fill="url(#${id})"/>`;
      }
      case 'line':
        return `<line x1="${round(item.x1)}" y1="${round(item.y1)}" x2="${round(item.x2)}" y2="${round(item.y2)}" stroke="${item.color}" stroke-width="${item.width}"/>`;
      case 'text':
        return `<text x="${round(item.x)}" y="${round(item.y)}" font-family="${escapeHtml(fontFamilies[item.role] || fontFamilies.body)}" font-size="${item.size}" font-weight="${item.weight}" fill="${item.color}"${item.opacity !== undefined ? ` opacity="${item.opacity}"` : ''}>${escapeHtml(item.text)}</text>`;
      case 'group': {
        const id = `clip-${ids.next++}`;
        const { x, y, w, h, radius } = item.clip;
        defs.push(`<clipPath id="${id}"><rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${round(radius)}"/></clipPath>`);
        const tooltip = [item.tooltip, item.overlaps && 'Overlaps another class', !item.isPreview && 'Click to edit'].filter(Boolean).join('\n');
        const content = `<g clip-path="url(#${id})">${item.items.map((child) => itemSvg(child, fontFamilies, defs, ids)).join('')}</g>`;
        // Overlap outline: drawn just outside the block, on screen only.
        const outline = item.overlaps
          ? `<rect class="page-event__overlap" x="${round(x - 1.2)}" y="${round(y - 1.2)}" width="${round(w + 2.4)}" height="${round(h + 2.4)}" rx="${round(radius + 1.2)}" fill="none" stroke="${OVERLAP_COLOR}" stroke-width="1.3" stroke-dasharray="3 1.6"/>`
          : '';
        if (item.isPreview) return `<g class="page-event">${content}${outline}</g>`;
        const label = `Edit ${item.tooltip.split('\n')[0]}`;
        return `<g class="page-event page-event--editable" data-course-id="${escapeHtml(item.courseId)}" tabindex="0" role="button" aria-label="${escapeHtml(label)}"><title>${escapeHtml(tooltip)}</title>${content}${outline}</g>`;
      }
      default:
        return '';
    }
  }

  /** @returns {string} a complete <svg> element for a page layout */
  function layoutSvg(layout, label) {
    const defs = [];
    const ids = { next: 0 };
    const body = layout.items.map((item) => itemSvg(item, layout.fontFamilies, defs, ids)).join('');
    return `
      <svg class="page-svg" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${escapeHtml(label)}">
        <defs>${defs.join('')}</defs>
        <rect width="${layout.width}" height="${layout.height}" fill="${layout.background}"/>
        ${body}
      </svg>`;
  }

  /* ---------- rendering ---------- */

  function render() {
    const { schedule, view: viewKey } = store.state;
    const font = model.findFont(schedule.style.font);
    ensureFontLoaded(font);

    document.querySelectorAll('.view-tab').forEach((tab) => {
      const selected = tab.dataset.view === viewKey;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    const layout = buildPageLayout(schedule, viewKey, store.displayedCourses(), createTextMeasurer(font));
    const overlapCount = layout.view.events.filter((e) => e.overlaps).length;
    const overlapNote = overlapCount ? `${overlapCount} overlapping class block${overlapCount === 1 ? ' is' : 's are'} outlined in orange.` : '';
    byId('calendar-note').innerHTML = joinWithSeparators([layout.view.rangeLabel, layout.view.note, overlapNote]);

    const frame = byId('calendar');
    frame.dataset.orientation = schedule.style.page.orientation;
    frame.innerHTML = layoutSvg(layout, `${schedule.title || 'Class schedule'}, ${VIEWS[viewKey].label}`);
  }

  function selectView(viewKey) {
    store.state.view = viewKey;
    render();
  }

  /** Open a class in the editor, switching to the Schedule tab first. */
  function editCourse(courseId) {
    TSB.navigation.showSideTab('schedule');
    TSB.courseList.startEditing(courseId);
  }

  function init() {
    const frame = byId('calendar');
    frame.addEventListener('click', (event) => {
      const block = event.target.closest('[data-course-id]');
      if (block) editCourse(block.dataset.courseId);
    });
    frame.addEventListener('keydown', (event) => {
      const block = event.target.closest('[data-course-id]');
      if (block && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        editCourse(block.dataset.courseId);
      }
    });

    const tabs = document.querySelector('.view-tabs');
    tabs.addEventListener('click', (event) => {
      const tab = event.target.closest('.view-tab');
      if (tab) selectView(tab.dataset.view);
    });
    // Arrow keys move between tabs (ARIA tabs pattern).
    tabs.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const next = VIEW_ORDER[(VIEW_ORDER.indexOf(store.state.view) + step + VIEW_ORDER.length) % VIEW_ORDER.length];
      selectView(next);
      byId(`tab-${next}`).focus();
    });
    // Re-measure once web fonts arrive; until then, widths come from fallback fonts.
    onFontsLoaded(render);
    store.subscribe('calendar', render);
  }

  TSB.calendarView = Object.freeze({ init, layoutSvg });
})(globalThis.TSB = globalThis.TSB || {});
