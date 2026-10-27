/**
 * Undo/redo history of schedule snapshots.
 *
 * Snapshots are strings (serialized schedules). Changes made in quick
 * succession to the same field, such as typing a title, are grouped into a
 * single undo step.
 */
(function (TSB) {
  'use strict';

  /**
   * @param {{limit?: number, groupWindowMs?: number, now?: () => number}} [options]
   */
  function createHistory(options = {}) {
    const limit = options.limit ?? 100;
    const groupWindowMs = options.groupWindowMs ?? 1000;
    const now = options.now ?? (() => Date.now());

    let undoStack = [];
    let redoStack = [];
    let current = null;
    let lastGroupKey = null;
    let lastRecordedAt = 0;

    return {
      /** Start over from a snapshot, forgetting all history. */
      reset(snapshot) {
        current = snapshot;
        undoStack = [];
        redoStack = [];
        lastGroupKey = null;
      },

      /**
       * Record the state after a change.
       * @param {string} snapshot
       * @param {string|null} [groupKey] changes with the same key close together become one step
       * @returns {boolean} false when nothing changed
       */
      record(snapshot, groupKey = null) {
        if (snapshot === current) return false;
        const time = now();
        const continuesGroup = groupKey !== null && groupKey === lastGroupKey && time - lastRecordedAt < groupWindowMs;
        if (!continuesGroup) {
          undoStack.push(current);
          if (undoStack.length > limit) undoStack.shift();
        }
        current = snapshot;
        redoStack = [];
        lastGroupKey = groupKey;
        lastRecordedAt = time;
        return true;
      },

      /** @returns {string|null} the snapshot to restore, or null when there's nothing to undo */
      undo() {
        if (!undoStack.length) return null;
        redoStack.push(current);
        current = undoStack.pop();
        lastGroupKey = null;
        return current;
      },

      /** @returns {string|null} the snapshot to restore, or null when there's nothing to redo */
      redo() {
        if (!redoStack.length) return null;
        undoStack.push(current);
        current = redoStack.pop();
        lastGroupKey = null;
        return current;
      },

      canUndo: () => undoStack.length > 0,
      canRedo: () => redoStack.length > 0,
    };
  }

  TSB.history = Object.freeze({ createHistory });
})(globalThis.TSB = globalThis.TSB || {});
