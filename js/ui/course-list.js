/**
 * Course list and the add/edit course form.
 *
 * While editing, the form works on `store.state.draft`. Every keystroke
 * updates the draft and refreshes the calendar preview; nothing is saved to
 * the schedule until the form is submitted.
 */
(function (TSB) {
  'use strict';

  const { COURSE_PALETTES, DAY_NAMES, DAY_LETTERS, WEEK_ORDER, MEETING_TYPES, SEPARATOR } = TSB.constants;
  const { parseDate, parseTime, formatDate, formatDays, formatTimeRange } = TSB.dates;
  const { byId, escapeHtml, joinWithSeparators, SEPARATOR_HTML, showToast } = TSB.dom;
  const model = TSB.schedule;
  const store = TSB.store;

  const list = () => byId('course-list');
  /** Swatch colors offered in the editor, from the chosen course palette. */
  const courseColors = () => COURSE_PALETTES[store.state.schedule.style.coursePalette] || COURSE_PALETTES.standard;
  const emptyFinal = () => ({ date: '', start: '', end: '', location: '' });

  /* ---------- course cards ---------- */

  function meetingSummaryHtml(course, meeting, clock) {
    const tag = model.hasMultipleMeetings(course) ? `<span class="type-tag">${escapeHtml(meeting.type)}</span>` : '';
    const time = model.isValidMeeting(meeting) ? formatTimeRange(parseTime(meeting.start), parseTime(meeting.end), clock) : '';
    const room = meeting.location ? `${SEPARATOR_HTML}${escapeHtml(meeting.location)}` : '';
    return `<li>${tag}<span><span class="tabular">${escapeHtml(formatDays(meeting.days))} ${escapeHtml(time)}</span>${room}</span></li>`;
  }

  function finalSummaryHtml(course, clock) {
    if (!model.hasValidFinal(course)) return '';
    const { date, start, end, location } = course.final;
    const parts = ['Final', formatDate(parseDate(date)), formatTimeRange(parseTime(start), parseTime(end), clock), location];
    return `<p class="course-card__final tabular">${joinWithSeparators(parts)}</p>`;
  }

  function courseCardHtml(course) {
    const { clock } = store.state.schedule.style;
    const id = escapeHtml(course.id);
    const actions = store.state.pendingDeleteId === course.id
      ? `<button class="btn btn--small btn--danger" data-action="confirm-delete" data-id="${id}">Confirm remove</button>
         <button class="btn btn--ghost btn--small" data-action="cancel-delete">Keep</button>`
      : `<button class="btn btn--ghost btn--small" data-action="edit" data-id="${id}">Edit</button>
         <button class="btn btn--ghost btn--small" data-action="delete" data-id="${id}">Remove</button>`;

    return `
      <article class="course-card" style="--course-color:${escapeHtml(course.color)}">
        <div class="course-card__head">
          <span class="course-card__swatch"></span>
          <div class="course-card__title">
            <h3><b>${escapeHtml(course.code)}</b>${course.name ? `: ${escapeHtml(course.name)}` : ''}</h3>
            ${course.instructor ? `<p class="course-card__instructor">${escapeHtml(course.instructor)}</p>` : ''}
          </div>
          <div class="course-card__actions">${actions}</div>
        </div>
        <ul class="course-card__meetings">${course.meetings.map((m) => meetingSummaryHtml(course, m, clock)).join('')}</ul>
        ${finalSummaryHtml(course, clock)}
      </article>`;
  }

  /* ---------- editor ---------- */

  function meetingEditorHtml(meeting, index) {
    const id = escapeHtml(meeting.id);
    const typeOptions = MEETING_TYPES
      .map((t) => `<option value="${t.code}" ${meeting.type === t.code ? 'selected' : ''}>${t.code}${SEPARATOR}${t.label}</option>`)
      .join('');
    const dayButtons = WEEK_ORDER
      .map((day) => `<button type="button" class="day-toggle" data-day="${day}" data-meeting="${id}" aria-pressed="${meeting.days.includes(day)}" aria-label="${DAY_NAMES[day]}">${DAY_LETTERS[day]}</button>`)
      .join('');
    const removeButton = index > 0
      ? `<button type="button" class="btn btn--ghost btn--small" data-action="remove-meeting" data-meeting="${id}">Remove</button>`
      : '';

    return `
      <div class="meeting-editor" data-meeting="${id}">
        <div class="meeting-editor__head">
          <span class="eyebrow">${index === 0 ? 'Main meeting' : `Section ${index}`}</span>
          <div class="meeting-editor__head-controls">
            <select data-meeting-field="type" data-meeting="${id}" aria-label="Meeting type">${typeOptions}</select>
            ${removeButton}
          </div>
        </div>
        <div class="day-toggles" role="group" aria-label="Days">${dayButtons}</div>
        <div class="field-row">
          <label class="field">Start<input type="time" step="300" data-meeting-field="start" data-meeting="${id}" value="${escapeHtml(meeting.start)}"></label>
          <label class="field">End<input type="time" step="300" data-meeting-field="end" data-meeting="${id}" value="${escapeHtml(meeting.end)}"></label>
          <label class="field">Room (optional)<input type="text" data-meeting-field="location" data-meeting="${id}" value="${escapeHtml(meeting.location)}" placeholder="Kane Hall 130"></label>
        </div>
      </div>`;
  }

  function editorHtml(draft, isNew) {
    const swatches = courseColors()
      .map((color) => `<button type="button" class="swatch-button" style="--swatch:${color}" data-color="${color}" aria-pressed="${draft.color.toLowerCase() === color}" aria-label="Color ${color}"></button>`)
      .join('');
    const final = draft.finalDraft;

    return `
      <form class="course-editor" id="course-editor" novalidate>
        <h3>${isNew ? 'New class' : `Edit ${escapeHtml(draft.code || 'class')}`}</h3>
        <div class="field-row">
          <label class="field">Course code<input type="text" data-field="code" value="${escapeHtml(draft.code)}" placeholder="CSE 143"></label>
          <label class="field">Course name<input type="text" data-field="name" value="${escapeHtml(draft.name)}" placeholder="Computer Programming II"></label>
        </div>
        <label class="field">Instructor (optional)<input type="text" data-field="instructor" value="${escapeHtml(draft.instructor)}" placeholder="Prof. Lin"></label>
        <div class="field">
          <span class="eyebrow">Color</span>
          <div class="swatches">${swatches}<input type="color" data-field="color" value="${escapeHtml(draft.color)}" aria-label="Custom color"></div>
        </div>
        ${draft.meetings.map(meetingEditorHtml).join('')}
        <div><button type="button" class="btn btn--small" data-action="add-meeting">+ Add lab or seminar section</button></div>
        <label class="checkbox"><input type="checkbox" data-field="hasFinal" ${draft.hasFinal ? 'checked' : ''}> Final exam</label>
        <div class="field-row" id="final-fields" ${draft.hasFinal ? '' : 'hidden'}>
          <label class="field">Date<input type="date" data-final-field="date" value="${escapeHtml(final.date)}"></label>
          <label class="field">Start<input type="time" step="300" data-final-field="start" value="${escapeHtml(final.start)}"></label>
          <label class="field">End<input type="time" step="300" data-final-field="end" value="${escapeHtml(final.end)}"></label>
          <label class="field">Room (optional)<input type="text" data-final-field="location" value="${escapeHtml(final.location)}"></label>
        </div>
        <p class="error-text" id="course-editor-error" hidden></p>
        <div class="actions">
          <button type="button" class="btn btn--ghost" data-action="cancel">Cancel</button>
          <button type="submit" class="btn btn--primary">${isNew ? 'Add class' : 'Save changes'}</button>
        </div>
      </form>`;
  }

  /* ---------- rendering ---------- */

  function render() {
    const { schedule, draft, editingId } = store.state;
    const parts = schedule.courses.map((course) => (course.id === editingId ? editorHtml(draft, false) : courseCardHtml(course)));
    if (editingId === 'new') parts.push(editorHtml(draft, true));
    if (!parts.length) parts.push('<div class="course-list__empty">No classes yet. Add your first class and it will appear on the calendar.</div>');

    list().innerHTML = parts.join('');
    byId('add-course').hidden = Boolean(editingId);

    const count = schedule.courses.length;
    const hours = +(model.weeklyClassMinutes(schedule.courses) / 60).toFixed(2);
    byId('course-summary').innerHTML = count ? joinWithSeparators([`${count} class${count === 1 ? '' : 'es'}`, `${hours} h in class / week`]) : '';
  }

  /* ---------- editing ---------- */

  function nextUnusedColor() {
    const used = new Set(store.state.schedule.courses.map((c) => c.color));
    const colors = courseColors();
    return colors.find((c) => !used.has(c)) || colors[store.state.schedule.courses.length % colors.length];
  }

  /** @param {string} courseId course id, or 'new' */
  function startEditing(courseId) {
    const { state } = store;
    state.pendingDeleteId = null;
    if (courseId === 'new') {
      state.draft = {
        id: model.createId(), code: '', name: '', instructor: '', color: nextUnusedColor(),
        meetings: [model.createMeeting()], final: null, hasFinal: false, finalDraft: emptyFinal(),
      };
    } else {
      const course = state.schedule.courses.find((c) => c.id === courseId);
      const copy = JSON.parse(JSON.stringify(course));
      state.draft = { ...copy, hasFinal: Boolean(course.final), finalDraft: copy.final || emptyFinal() };
    }
    state.editingId = courseId;
    store.emit('courses', 'calendar');

    const codeInput = list().querySelector('[data-field="code"]');
    codeInput.focus({ preventScroll: true });
    byId('course-editor').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function stopEditing() {
    store.state.draft = null;
    store.state.editingId = null;
  }

  function saveDraft() {
    const { state } = store;
    const draft = state.draft;
    const course = {
      id: draft.id,
      code: draft.code.trim(),
      name: draft.name.trim(),
      instructor: draft.instructor.trim(),
      color: draft.color,
      meetings: draft.meetings.map((m) => ({ ...m, location: m.location.trim() })),
      final: draft.hasFinal ? { ...draft.finalDraft, location: draft.finalDraft.location.trim() } : null,
    };

    const problem = model.validateCourse(course);
    if (problem) {
      const error = byId('course-editor-error');
      error.textContent = problem;
      error.hidden = false;
      return;
    }

    const index = state.schedule.courses.findIndex((c) => c.id === course.id);
    if (index >= 0) state.schedule.courses[index] = course;
    else state.schedule.courses.push(course);
    stopEditing();
    // Holidays depend on finals week, which depends on course finals.
    store.markChanged('courses', 'holidays', 'calendar');
    showToast(index >= 0 ? `Saved ${course.code}` : `Added ${course.code}`);
  }

  const findDraftMeeting = (id) => store.state.draft.meetings.find((m) => m.id === id);

  /* ---------- event handlers ---------- */

  function onInput(event) {
    const draft = store.state.draft;
    if (!draft) return;
    const target = event.target;
    const { field, meetingField, finalField } = target.dataset;

    if (field === 'hasFinal') {
      draft.hasFinal = target.checked;
      byId('final-fields').hidden = !target.checked;
    } else if (field) {
      draft[field] = target.value;
      if (field === 'color') {
        list().querySelectorAll('.swatch-button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === target.value.toLowerCase())));
      }
    } else if (meetingField) {
      findDraftMeeting(target.dataset.meeting)[meetingField] = target.value;
    } else if (finalField) {
      draft.finalDraft[finalField] = target.value;
    }
    store.emit('calendar');
  }

  function onClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const { state } = store;
    const { action, id, color, day, meeting } = button.dataset;

    if (color) {
      state.draft.color = color;
      list().querySelectorAll('.swatch-button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      list().querySelector('[data-field="color"]').value = color;
      store.emit('calendar');
      return;
    }

    if (day !== undefined) {
      const target = findDraftMeeting(meeting);
      const dayIndex = Number(day);
      target.days = target.days.includes(dayIndex) ? target.days.filter((d) => d !== dayIndex) : [...target.days, dayIndex];
      button.setAttribute('aria-pressed', String(target.days.includes(dayIndex)));
      store.emit('calendar');
      return;
    }

    switch (action) {
      case 'add-meeting': {
        const type = state.draft.meetings.some((m) => m.type === 'LAB') ? 'SEM' : 'LAB';
        const added = model.createMeeting(type);
        state.draft.meetings.push(added);
        store.emit('courses', 'calendar');
        list().querySelector(`.meeting-editor[data-meeting="${added.id}"] .day-toggle`).focus();
        break;
      }
      case 'remove-meeting':
        state.draft.meetings = state.draft.meetings.filter((m) => m.id !== meeting);
        store.emit('courses', 'calendar');
        break;
      case 'cancel':
        stopEditing();
        store.emit('courses', 'calendar');
        break;
      case 'edit':
        startEditing(id);
        break;
      case 'delete':
        state.pendingDeleteId = id;
        store.emit('courses');
        break;
      case 'cancel-delete':
        state.pendingDeleteId = null;
        store.emit('courses');
        break;
      case 'confirm-delete':
        state.schedule.courses = state.schedule.courses.filter((c) => c.id !== id);
        state.pendingDeleteId = null;
        store.markChanged('courses', 'holidays', 'calendar');
        break;
      default:
        break;
    }
  }

  function init() {
    list().addEventListener('input', onInput);
    list().addEventListener('click', onClick);
    list().addEventListener('submit', (event) => {
      event.preventDefault();
      saveDraft();
    });
    byId('add-course').addEventListener('click', () => startEditing('new'));
    store.subscribe('courses', render);
  }

  TSB.courseList = Object.freeze({ init });
})(globalThis.TSB = globalThis.TSB || {});
