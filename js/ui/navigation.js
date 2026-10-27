/**
 * Moving between the parts of the page: the Schedule | Style tabs on the
 * left pane, and the Schedule | Style | Preview tab bar on phones.
 */
(function (TSB) {
  'use strict';

  const { byId } = TSB.dom;
  const store = TSB.store;

  const SIDE_TABS = ['schedule', 'style'];

  function render() {
    const { sideTab, mobileTab } = store.state;
    document.body.dataset.mobileTab = mobileTab;

    for (const tab of SIDE_TABS) {
      const selected = tab === sideTab;
      const button = byId(`side-tab-${tab}`);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      byId(`panel-${tab}`).hidden = !selected;
    }

    document.querySelectorAll('.mobile-tabs [data-mobile-tab]').forEach((button) => {
      if (button.dataset.mobileTab === mobileTab) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  /** Show the Schedule or Style tab (on phones too). */
  function showSideTab(tab) {
    store.state.sideTab = tab;
    store.state.mobileTab = tab;
    store.emit('navigation');
  }

  /** On phones, show one part: 'schedule', 'style' or 'preview'. */
  function showMobileTab(tab) {
    store.state.mobileTab = tab;
    if (SIDE_TABS.includes(tab)) store.state.sideTab = tab;
    store.emit('navigation');
    window.scrollTo({ top: 0 });
  }

  function init() {
    const tabs = document.querySelector('.side-tabs');
    tabs.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-side-tab]');
      if (tab) showSideTab(tab.dataset.sideTab);
    });
    // Arrow keys move between tabs (ARIA tabs pattern).
    tabs.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const next = store.state.sideTab === 'schedule' ? 'style' : 'schedule';
      showSideTab(next);
      byId(`side-tab-${next}`).focus();
    });

    document.querySelector('.mobile-tabs').addEventListener('click', (event) => {
      const button = event.target.closest('[data-mobile-tab]');
      if (button) showMobileTab(button.dataset.mobileTab);
    });

    store.subscribe('navigation', render);
  }

  TSB.navigation = Object.freeze({ init, showSideTab, showMobileTab });
})(globalThis.TSB = globalThis.TSB || {});
