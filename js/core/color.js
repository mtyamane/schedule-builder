/** Color helpers for course colors. */
(function (TSB) {
  'use strict';

  /**
   * @param {string} hex "#rgb" or "#rrggbb"
   * @returns {[number, number, number]}
   */
  function hexToRgb(hex) {
    let value = String(hex).replace('#', '');
    if (value.length === 3) value = value.split('').map((c) => c + c).join('');
    const n = parseInt(value, 16);
    if (Number.isNaN(n)) return [0, 0, 0];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /**
   * Blend two colors.
   * @param {number[]} from
   * @param {number[]} to
   * @param {number} amount 0 keeps `from`, 1 gives `to`
   * @returns {number[]}
   */
  function mixRgb(from, to, amount) {
    return from.map((v, i) => Math.round(v * (1 - amount) + to[i] * amount));
  }

  /** @returns {string} "rgb(r,g,b)" */
  function rgbToCss([r, g, b]) {
    return `rgb(${r},${g},${b})`;
  }

  /**
   * Pick dark or white text for a solid background, by relative luminance.
   * @param {string} hex
   * @returns {string}
   */
  function readableTextColor(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.42 ? '#141a24' : '#ffffff';
  }

  /** @returns {boolean} */
  function isHexColor(value) {
    return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
  }

  TSB.color = Object.freeze({ hexToRgb, mixRgb, rgbToCss, readableTextColor, isHexColor });
})(globalThis.TSB = globalThis.TSB || {});
