/** On-screen weekly calendar: heading, view tabs, note and the time grid. */
(function (TSB) {
  'use strict';

  const { DAY_NAMES, SIZE_PRESETS, ROW_HEIGHTS } = TSB.constants;
  const { formatHour, formatMonthDay, formatTimeRange } = TSB.dates;
  const { readableTextColor } = TSB.color;
  const { buildWeekView } = TSB.weekView;
  const { eventTag, eventDetailLines } = TSB.eventText;
  const { byId, escapeHtml } = TSB.dom;
  const { ensureFontLoaded, fontStack } = TSB.fonts;
  const model = TSB.schedule;
  const store = TSB.store;

  const VIEW_ORDER = ['week1', 'weekly', 'finals'];

  /** Apply personalize settings as CSS variables on the calendar pane. */
  function applyStyleVariables() {
    const style = store.state.schedule.style;
    const font = model.findFont(style.font);
    ensureFontLoaded(font, render);

    const preset = SIZE_PRESETS[style.sizePreset] || 1;
    const blockScale = preset * style.sizes.block;
    const timeScale = preset * style.sizes.time;
    const variables = {
      '--cal-font-title': fontStack(font.title, font),
      '--cal-font-body': fontStack(font.body, font),
      '--cal-font-code': fontStack(font.code, font),
      '--cal-weight-title': font.titleWeight,
      '--cal-weight-code': font.codeWeight,
      '--scale-title': preset * style.sizes.title,
      '--scale-day': preset * style.sizes.day,
      '--scale-block': blockScale,
      '--scale-time': timeScale,
      // Rows grow with larger block text so details aren't cut off.
      '--hour': `${Math.round(ROW_HEIGHTS[style.rowHeight] * Math.max(1, blockScale))}px`,
      '--block-radius': style.corners === 'square' ? '0px' : '6px',
      '--time-column': `${Math.round(52 * Math.max(1, timeScale))}px`,
    };
    const pane = byId('calendar-pane');
    for (const [name, value] of Object.entries(variables)) pane.style.setProperty(name, String(value));
  }

  function eventHtml(event, view, style) {
    const top = (event.start - view.startHour * 60) / 60;
    const height = (event.end - event.start) / 60;
    const tag = eventTag(event, style);
    const classes = ['event', event.isFinal && 'event--final', event.isPreview && 'event--preview', style.blockColor === 'bold' && 'event--bold']
      .filter(Boolean)
      .join(' ');
    const position = [
      `--course-color:${event.course.color}`,
      `--on-color:${readableTextColor(event.course.color)}`,
      `top:calc(${top} * var(--hour) + 1px)`,
      `height:calc(${height} * var(--hour) - 2px)`,
      `left:calc(${event.lane} / ${event.laneCount} * 100% + 2px)`,
      `width:calc(100% / ${event.laneCount} - 4px)`,
    ].join(';');
    const tooltip = [
      `${event.course.code}${event.course.name ? `: ${event.course.name}` : ''}${event.sectionType ? ` (${event.sectionType})` : ''}`,
      formatTimeRange(event.start, event.end, style.clock),
      event.location,
      event.course.instructor,
    ].filter(Boolean).join('\n');

    return `
      <div class="${classes}" style="${escapeHtml(position)}" title="${escapeHtml(tooltip)}">
        <b>${escapeHtml(event.course.code)}${tag ? `<i>${escapeHtml(tag)}</i>` : ''}</b>
        ${eventDetailLines(event, style).map((line) => `<span>${escapeHtml(line)}</span>`).join('')}
      </div>`;
  }

  function calendarHtml(view, style) {
    const head = view.days.map((day) => `
      <div class="calendar__day-label ${day.offLabel ? 'is-off' : ''}">
        <b>${DAY_NAMES[day.dayOfWeek]}</b>${day.date ? `<span>${formatMonthDay(day.date)}</span>` : ''}
      </div>`).join('');

    let times = '';
    for (let hour = view.startHour; hour <= view.endHour; hour++) {
      times += `<span style="top:calc(${hour - view.startHour} * var(--hour))">${formatHour(hour, style.clock)}</span>`;
    }

    const columns = view.days.map((day) => {
      const events = view.events.filter((e) => e.dayOfWeek === day.dayOfWeek).map((e) => eventHtml(e, view, style)).join('');
      const offLabel = day.offLabel ? `<span class="calendar__off-label">${escapeHtml(day.offLabel)}</span>` : '';
      return `<div class="calendar__column ${day.offLabel ? 'is-off' : ''}">${offLabel}${events}</div>`;
    }).join('');

    return `
      <div class="calendar" style="--day-count:${view.days.length};--hour-count:${view.endHour - view.startHour}">
        <div class="calendar__head"><div></div>${head}</div>
        <div class="calendar__body"><div class="calendar__times">${times}</div>${columns}</div>
      </div>`;
  }

  function render() {
    const { schedule, view: viewKey } = store.state;
    applyStyleVariables();

    const title = byId('calendar-title');
    title.textContent = schedule.title || 'Untitled term';
    title.classList.toggle('is-placeholder', !schedule.title);
    const subtitle = byId('calendar-subtitle');
    subtitle.hidden = !schedule.subtitle;
    subtitle.textContent = schedule.subtitle;

    document.querySelectorAll('.view-tab').forEach((tab) => {
      const selected = tab.dataset.view === viewKey;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    const view = buildWeekView(schedule, viewKey, store.displayedCourses());
    byId('calendar-note').textContent = (view.rangeLabel ? `${view.rangeLabel} · ` : '') + view.note;
    byId('calendar').innerHTML = calendarHtml(view, schedule.style);
  }

  function selectView(viewKey) {
    store.state.view = viewKey;
    render();
  }

  function init() {
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
    store.subscribe('calendar', render);
  }

  TSB.calendarView = Object.freeze({ init });
})(globalThis.TSB = globalThis.TSB || {});
