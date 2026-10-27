/**
 * Calendar fonts: loads them from Google Fonts on demand and measures text
 * for the page layout. The on-screen preview and image export use the same
 * measurer, so text wraps at the same words in both.
 */
(function (TSB) {
  'use strict';

  const { FONTS } = TSB.constants;

  /**
   * Add a font's stylesheet to the page if it isn't there yet.
   * @param {object} font entry from TSB.constants.FONTS
   */
  function ensureFontLoaded(font) {
    if (!font.googleQuery) return;
    const id = `font-${font.id}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${font.googleQuery}&display=swap`;
    document.head.appendChild(link);
  }

  /** Load every curated font, e.g. so the font picker can preview them. */
  function loadAllFonts() {
    FONTS.forEach(ensureFontLoaded);
  }

  /**
   * Wait until a font's faces are ready for drawing on a canvas.
   * Never rejects; a font that fails to load falls back to its CSS fallback.
   * @param {object} font
   */
  async function waitForFont(font) {
    ensureFontLoaded(font);
    try {
      await Promise.all([
        document.fonts.load(`${font.titleWeight} 24px "${font.title}"`),
        document.fonts.load(`400 24px "${font.body}"`),
        document.fonts.load(`500 24px "${font.body}"`),
        document.fonts.load(`400 24px "${font.code}"`),
        document.fonts.load(`${font.codeWeight} 24px "${font.code}"`),
      ]);
      await document.fonts.ready;
    } catch (error) {
      // Drawing continues with fallback fonts.
    }
  }

  /** @returns {string} a CSS font-family list, e.g. '"DM Sans", sans-serif' */
  function fontStack(family, font) {
    return `"${family}", ${font.fallback}`;
  }

  /* ---------- text measurement ---------- */

  let measureContext = null;
  const widthCache = new Map();

  /**
   * Create a measure function for TSB.pageLayout.buildPageLayout.
   * Widths are in the same units as the size passed in (points).
   * @param {object} font entry from TSB.constants.FONTS
   * @returns {(text: string, size: number, weight: number, role: 'title'|'body'|'code') => number}
   */
  function createTextMeasurer(font) {
    if (!measureContext) measureContext = document.createElement('canvas').getContext('2d');
    const families = { title: fontStack(font.title, font), body: fontStack(font.body, font), code: fontStack(font.code, font) };
    return (text, size, weight, role) => {
      const cssFont = `${weight} ${size}px ${families[role] || families.body}`;
      const key = `${cssFont}|${text}`;
      if (!widthCache.has(key)) {
        measureContext.font = cssFont;
        widthCache.set(key, measureContext.measureText(text).width);
      }
      return widthCache.get(key);
    };
  }

  /**
   * Call `callback` whenever web fonts finish loading. Measurements taken
   * before then used fallback fonts, so the cache is cleared first.
   * @param {() => void} callback
   */
  function onFontsLoaded(callback) {
    if (!document.fonts) return;
    document.fonts.addEventListener('loadingdone', () => {
      widthCache.clear();
      callback();
    });
  }

  TSB.fonts = Object.freeze({ ensureFontLoaded, loadAllFonts, waitForFont, fontStack, createTextMeasurer, onFontsLoaded });
})(globalThis.TSB = globalThis.TSB || {});
