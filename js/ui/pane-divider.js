/**
 * Draggable divider between the left pane and the preview (desktop only).
 * The split starts at half and half and is kept only for the current visit.
 * Drag it, use the arrow keys when it has focus, or double-click to reset.
 */
(function (TSB) {
  'use strict';

  const { byId } = TSB.dom;

  const DEFAULT_SHARE = 0.5;
  const KEY_STEP = 0.02;
  /* Must match the minmax() minimums in css/layout.css. */
  const MIN_SIDE = 340;
  const MIN_PREVIEW = 420;

  let share = DEFAULT_SHARE;

  /** Keep both panes at or above their minimum widths. */
  function clampShare(value, totalWidth) {
    const min = MIN_SIDE / totalWidth;
    const max = 1 - MIN_PREVIEW / totalWidth;
    return min > max ? DEFAULT_SHARE : Math.min(max, Math.max(min, value));
  }

  function apply(workspace, divider) {
    workspace.style.setProperty('--side-fr', `${share}fr`);
    workspace.style.setProperty('--preview-fr', `${1 - share}fr`);
    divider.setAttribute('aria-valuenow', String(Math.round(share * 100)));
  }

  function init() {
    const workspace = document.querySelector('.workspace');
    const divider = byId('pane-divider');
    divider.setAttribute('aria-valuemin', '0');
    divider.setAttribute('aria-valuemax', '100');
    divider.setAttribute('aria-valuetext', 'Left panel width, percent of window');
    apply(workspace, divider);

    const setShare = (value) => {
      share = clampShare(value, workspace.getBoundingClientRect().width);
      apply(workspace, divider);
    };

    divider.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      divider.setPointerCapture(event.pointerId);
      divider.classList.add('is-dragging');
      document.body.classList.add('is-resizing');
    });
    divider.addEventListener('pointermove', (event) => {
      if (!divider.hasPointerCapture(event.pointerId)) return;
      const box = workspace.getBoundingClientRect();
      setShare((event.clientX - box.left) / box.width);
    });
    const stopDragging = (event) => {
      if (divider.hasPointerCapture(event.pointerId)) divider.releasePointerCapture(event.pointerId);
      divider.classList.remove('is-dragging');
      document.body.classList.remove('is-resizing');
    };
    divider.addEventListener('pointerup', stopDragging);
    divider.addEventListener('pointercancel', stopDragging);

    divider.addEventListener('dblclick', () => setShare(DEFAULT_SHARE));
    divider.addEventListener('keydown', (event) => {
      const moves = { ArrowLeft: share - KEY_STEP, ArrowRight: share + KEY_STEP, Home: 0, End: 1, Enter: DEFAULT_SHARE };
      if (!(event.key in moves)) return;
      event.preventDefault();
      setShare(moves[event.key]);
    });
  }

  TSB.paneDivider = Object.freeze({ init });
})(globalThis.TSB = globalThis.TSB || {});
