/** Small DOM helpers: lookups, escaping, toast, modal, downloads and printing. */
(function (TSB) {
  'use strict';

  /** @returns {HTMLElement} */
  const byId = (id) => document.getElementById(id);

  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  /** Escape text for safe use inside HTML markup and attributes. */
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
  }

  /** Markup for the muted pipe separator (styled by .sep in base.css). */
  const SEPARATOR_HTML = '<span class="sep">|</span>';

  /**
   * Join items with the muted pipe separator. Items are escaped.
   * @param {string[]} items
   * @returns {string} HTML
   */
  function joinWithSeparators(items) {
    return items.filter(Boolean).map(escapeHtml).join(SEPARATOR_HTML);
  }

  let toastTimer = null;

  /**
   * Show a short message at the bottom of the screen, optionally with one
   * action button (e.g. Undo). Messages with an action stay up longer.
   * @param {string} message
   * @param {{label: string, onClick: () => void}} [action]
   */
  function showToast(message, action) {
    const toast = byId('toast');
    toast.innerHTML = `<span>${escapeHtml(message)}</span>${action ? `<button class="toast__action">${escapeHtml(action.label)}</button>` : ''}`;
    toast.hidden = false;
    const hide = () => {
      toast.hidden = true;
    };
    if (action) {
      toast.querySelector('button').addEventListener('click', () => {
        hide();
        action.onClick();
      });
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hide, action ? 6000 : 3200);
  }

  /**
   * A dropdown menu: a button that opens a list of menu items.
   * Closes on outside click, Escape, or choosing an item. Arrow keys move between items.
   * @param {HTMLButtonElement} button
   * @param {HTMLElement} list element with role="menu" containing [role="menuitem"] buttons
   * @param {(item: HTMLElement) => void} onSelect
   * @returns {{close: () => void}}
   */
  function setupMenu(button, list, onSelect) {
    const items = () => [...list.querySelectorAll('[role="menuitem"]')];
    const isOpen = () => !list.hidden;

    function open() {
      list.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      items()[0].focus();
    }

    function close({ restoreFocus = false } = {}) {
      if (!isOpen()) return;
      list.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (restoreFocus) button.focus();
    }

    button.addEventListener('click', () => (isOpen() ? close() : open()));
    list.addEventListener('click', (event) => {
      const item = event.target.closest('[role="menuitem"]');
      if (!item) return;
      close({ restoreFocus: true });
      onSelect(item);
    });
    list.addEventListener('keydown', (event) => {
      const all = items();
      const index = all.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') all[(index + 1) % all.length].focus();
      else if (event.key === 'ArrowUp') all[(index - 1 + all.length) % all.length].focus();
      else if (event.key === 'Home') all[0].focus();
      else if (event.key === 'End') all[all.length - 1].focus();
      else if (event.key === 'Escape' || event.key === 'Tab') close({ restoreFocus: event.key === 'Escape' });
      else return;
      event.preventDefault();
    });
    document.addEventListener('click', (event) => {
      if (!button.contains(event.target) && !list.contains(event.target)) close();
    });
    return { close };
  }

  /**
   * Show a modal dialog with buttons. The first action is the primary one.
   * @param {{title: string, message: string, actions: {label: string, value: string}[], onAction?: (value: string) => void}} options
   */
  function showModal({ title, message, actions, onAction }) {
    const root = byId('modal-root');
    root.innerHTML = `
      <div class="modal-scrim">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <h3 id="modal-title">${escapeHtml(title)}</h3>
          <p>${escapeHtml(message)}</p>
          <div class="actions">
            ${actions.map((a, i) => `<button class="btn ${i === 0 ? 'btn--primary' : ''}" data-value="${escapeHtml(a.value)}">${escapeHtml(a.label)}</button>`).join('')}
          </div>
        </div>
      </div>`;

    const close = () => {
      root.innerHTML = '';
      document.removeEventListener('keydown', onKeydown);
    };
    const onKeydown = (event) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeydown);

    root.querySelector('.modal-scrim').addEventListener('click', (event) => {
      if (event.target.classList.contains('modal-scrim')) return close();
      const button = event.target.closest('[data-value]');
      if (!button) return;
      close();
      if (onAction) onAction(button.dataset.value);
    });
    root.querySelector('[data-value]').focus();
  }

  /**
   * Save data as a file through the browser.
   * @param {string} filename
   * @param {Blob|string} data
   * @param {string} [type] MIME type when `data` is a string
   */
  function downloadFile(filename, data, type = 'text/plain') {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /**
   * Print a full-page image using a hidden iframe.
   * @param {string} imageUrl data: or blob: URL
   * @param {string} title document title shown in the print dialog
   * @param {string} [pageSize] CSS @page size, e.g. "letter landscape" or "A4 portrait"
   */
  function printImage(imageUrl, title, pageSize = 'letter landscape') {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);

    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><title>${escapeHtml(title)}</title>
      <style>@page{size:${pageSize};margin:0}html,body{margin:0}img{display:block;width:100%;height:auto}</style>
      <img id="print-image" alt="">`);
    doc.close();

    const image = doc.getElementById('print-image');
    image.addEventListener('load', () => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 1500);
    });
    image.src = imageUrl;
  }

  TSB.dom = Object.freeze({ byId, escapeHtml, SEPARATOR_HTML, joinWithSeparators, showToast, setupMenu, showModal, downloadFile, printImage });
})(globalThis.TSB = globalThis.TSB || {});
