/**
 * App state and a small publish/subscribe mechanism.
 *
 * UI modules read `store.state`, change it, then call `markChanged(...topics)`
 * (for saved data) or `emit(...topics)` (for view-only changes). Each module
 * subscribes to the topics it renders.
 *
 * Topics:
 *   term      term fields (title, dates)
 *   holidays  holiday controls and list
 *   courses   course list and editor
 *   calendar  calendar view
 *   style     personalize panel controls
 *   status    "Not exported" chip
 *   banner    example-schedule banner
 */
(function (TSB) {
  'use strict';

  const model = TSB.schedule;

  const ALL_TOPICS = ['term', 'holidays', 'courses', 'calendar', 'style', 'status', 'banner'];

  const state = {
    /** @type {object} the Schedule being edited */
    schedule: model.createExampleSchedule(),
    /** True until the person changes the example schedule. */
    isExample: true,
    /** True when there are changes not yet saved or exported. */
    hasUnexportedChanges: false,
    hasExported: false,
    /** @type {'week1'|'weekly'|'finals'} */
    view: 'weekly',
    /**
     * Course being edited, plus editor-only fields:
     * `hasFinal` (checkbox) and `finalDraft` (kept while the box is unchecked).
     */
    draft: null,
    /** @type {string|null} course id, 'new', or null when not editing */
    editingId: null,
    /** @type {string|null} course id awaiting delete confirmation */
    pendingDeleteId: null,
  };

  const listeners = new Map();

  /** @param {string} topic @param {() => void} listener */
  function subscribe(topic, listener) {
    if (!listeners.has(topic)) listeners.set(topic, []);
    listeners.get(topic).push(listener);
  }

  /** Notify subscribers of each topic once, in the order given. */
  function emit(...topics) {
    for (const topic of new Set(topics)) {
      (listeners.get(topic) || []).forEach((listener) => listener());
    }
  }

  function emitAll() {
    emit(...ALL_TOPICS);
  }

  /** Record a change to saved data, then re-render the given topics. */
  function markChanged(...topics) {
    state.hasUnexportedChanges = true;
    if (state.isExample) {
      state.isExample = false;
      topics.push('banner');
    }
    emit(...topics, 'status');
  }

  /** Record a successful export or save. */
  function markExported() {
    state.hasUnexportedChanges = false;
    state.hasExported = true;
    emit('status');
  }

  /** Replace the whole schedule (start blank or import) and re-render everything. */
  function replaceSchedule(schedule) {
    Object.assign(state, {
      schedule,
      isExample: false,
      hasUnexportedChanges: false,
      hasExported: false,
      draft: null,
      editingId: null,
      pendingDeleteId: null,
    });
    emitAll();
  }

  /** @returns {object[]} saved courses, with the course being edited shown as a preview */
  function displayedCourses() {
    const { schedule, draft, editingId } = state;
    if (!draft) return schedule.courses;
    const preview = {
      ...draft,
      code: draft.code || 'New class',
      final: draft.hasFinal ? draft.finalDraft : null,
      isPreview: true,
    };
    const courses = schedule.courses.map((course) => (course.id === editingId ? preview : course));
    if (editingId === 'new') courses.push(preview);
    return courses;
  }

  TSB.store = Object.freeze({ state, subscribe, emit, emitAll, markChanged, markExported, replaceSchedule, displayedCourses });
})(globalThis.TSB = globalThis.TSB || {});
