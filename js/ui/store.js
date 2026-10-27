/**
 * App state, undo/redo history and a small publish/subscribe mechanism.
 *
 * UI modules read `store.state`, change it, then call `markChanged(...topics)`
 * (for saved data, which also records an undo step) or `emit(...topics)`
 * (for view-only changes). Each module subscribes to the topics it renders.
 *
 * Topics:
 *   term        term fields (title, dates)
 *   holidays    holiday controls and list
 *   courses     course list and editor
 *   calendar    calendar preview
 *   style       Style tab controls
 *   status      "Not exported" chip
 *   banner      example-schedule banner
 *   history     undo/redo buttons
 *   navigation  Schedule/Style tabs and the phone tab bar
 */
(function (TSB) {
  'use strict';

  const model = TSB.schedule;
  const { createHistory } = TSB.history;

  const ALL_TOPICS = ['term', 'holidays', 'courses', 'calendar', 'style', 'status', 'banner', 'history', 'navigation'];

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
    /** @type {'schedule'|'style'} which tab the left pane shows */
    sideTab: 'schedule',
    /** @type {'schedule'|'style'|'preview'} which part phones show */
    mobileTab: 'schedule',
    /**
     * Course being edited, plus editor-only fields:
     * `hasFinal` (checkbox) and `finalDraft` (kept while the box is unchecked).
     */
    draft: null,
    /** @type {string|null} course id, 'new', or null when not editing */
    editingId: null,
  };

  const history = createHistory();
  const snapshot = () => JSON.stringify(state.schedule);
  history.reset(snapshot());

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

  /**
   * Group typing in one field into a single undo step. Clicks on buttons and
   * checkboxes are always their own step.
   */
  function currentGroupKey() {
    const el = document.activeElement;
    if (!el || !el.id) return null;
    const isTextLike = (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(el.type)) || el.tagName === 'TEXTAREA';
    return isTextLike ? el.id : null;
  }

  /** Record a change to saved data as an undo step, then re-render the given topics. */
  function markChanged(...topics) {
    state.hasUnexportedChanges = true;
    if (state.isExample) {
      state.isExample = false;
      topics.push('banner');
    }
    history.record(snapshot(), currentGroupKey());
    emit(...topics, 'status', 'history');
  }

  /** Record a successful export or save. */
  function markExported() {
    state.hasUnexportedChanges = false;
    state.hasExported = true;
    emit('status');
  }

  function closeEditor() {
    state.draft = null;
    state.editingId = null;
  }

  /** Replace the whole schedule (start blank or open a file); this also clears undo history. */
  function replaceSchedule(schedule) {
    Object.assign(state, { schedule, isExample: false, hasUnexportedChanges: false, hasExported: false });
    closeEditor();
    history.reset(snapshot());
    emitAll();
  }

  function restore(saved) {
    if (saved === null) return false;
    state.schedule = JSON.parse(saved);
    state.hasUnexportedChanges = true;
    closeEditor(); // an open editor would refer to the old version
    emitAll();
    return true;
  }

  /** @returns {boolean} false when there was nothing to undo */
  const undo = () => restore(history.undo());
  /** @returns {boolean} false when there was nothing to redo */
  const redo = () => restore(history.redo());

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

  TSB.store = Object.freeze({
    state,
    subscribe,
    emit,
    emitAll,
    markChanged,
    markExported,
    replaceSchedule,
    displayedCourses,
    undo,
    redo,
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
  });
})(globalThis.TSB = globalThis.TSB || {});
