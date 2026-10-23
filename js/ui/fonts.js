/**
 * Loads the curated calendar fonts from Google Fonts on demand.
 */
(function (TSB) {
  'use strict';

  const { FONTS } = TSB.constants;

  /**
   * Add a font's stylesheet to the page if it isn't there yet.
   * @param {object} font entry from TSB.constants.FONTS
   * @param {() => void} [onLoad] called once the stylesheet has loaded
   */
  function ensureFontLoaded(font, onLoad) {
    if (!font.googleQuery) return;
    const id = `font-${font.id}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${font.googleQuery}&display=swap`;
    if (onLoad) link.addEventListener('load', onLoad);
    document.head.appendChild(link);
  }

  /** Load every curated font, e.g. so the font picker can preview them. */
  function loadAllFonts() {
    FONTS.forEach((font) => ensureFontLoaded(font));
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
        document.fonts.load(`${font.titleWeight} 60px "${font.title}"`),
        document.fonts.load(`400 24px "${font.body}"`),
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

  TSB.fonts = Object.freeze({ ensureFontLoaded, loadAllFonts, waitForFont, fontStack });
})(globalThis.TSB = globalThis.TSB || {});
