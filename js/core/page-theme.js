/**
 * Colors for the calendar page: page backgrounds and the colors of each
 * course block. Used by both the on-screen preview and image export, so
 * they always match.
 */
(function (TSB) {
  'use strict';

  const { hexToRgb, mixRgb, rgbToCss, readableTextColor } = TSB.color;

  /** Page palettes for the "Page background" setting. */
  const PAGE_PALETTES = {
    white: { background: '#ffffff', ink: '#18202f', muted: '#5b667c', line: '#d6dce7', grid: '#e8ecf3', halfHour: '#f2f4f8', offDay: '#f1f3f7', hatch: '#e0e4ec', isDark: false },
    tint: { background: '#eff3f9', ink: '#18202f', muted: '#56617a', line: '#cbd3e1', grid: '#dde3ee', halfHour: '#e7ecf4', offDay: '#e3e8f0', hatch: '#d3d9e4', isDark: false },
    dark: { background: '#141922', ink: '#e8ebf2', muted: '#9aa3b8', line: '#323a4c', grid: '#242b3a', halfHour: '#1c2230', offDay: '#1a1f2a', hatch: '#272e3d', isDark: true },
  };

  /** @returns {object} the palette for a style */
  function pagePalette(style) {
    return PAGE_PALETTES[style.pageBackground] || PAGE_PALETTES.white;
  }

  const toHex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

  /**
   * A course color as it should be drawn: unchanged, or converted to gray
   * with the same perceived brightness when grayscale printing is on.
   * @param {string} hex
   * @param {object} style CalendarStyle
   * @returns {string} "#rrggbb"
   */
  function displayColor(hex, style) {
    if (!style.grayscale) return hex;
    const [r, g, b] = hexToRgb(hex);
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    return toHex([gray, gray, gray]);
  }

  /**
   * Fill, border and text colors for a course block.
   * - soft: light tint of the course color
   * - bold: solid course color with readable text
   * - outline: page-colored fill with a colored border, to save ink
   * @param {string} hex course color
   * @param {object} style CalendarStyle
   * @returns {{fill: string, border: string, text: string, borderScale: number}}
   */
  function blockColors(hex, style) {
    const palette = pagePalette(style);
    const color = displayColor(hex, style);
    const base = hexToRgb(color);
    const background = hexToRgb(palette.background);
    const white = [255, 255, 255];
    const black = [0, 0, 0];

    if (style.blockColor === 'bold') {
      return { fill: color, border: rgbToCss(mixRgb(base, black, 0.2)), text: readableTextColor(color), borderScale: 1 };
    }
    if (style.blockColor === 'outline') {
      return {
        fill: palette.background,
        border: rgbToCss(palette.isDark ? mixRgb(base, white, 0.15) : mixRgb(base, black, 0.1)),
        text: rgbToCss(palette.isDark ? mixRgb(base, white, 0.55) : mixRgb(base, black, 0.45)),
        borderScale: 1.75,
      };
    }
    if (palette.isDark) {
      return { fill: rgbToCss(mixRgb(base, background, 0.68)), border: rgbToCss(mixRgb(base, background, 0.15)), text: rgbToCss(mixRgb(base, white, 0.68)), borderScale: 1 };
    }
    return { fill: rgbToCss(mixRgb(base, white, 0.8)), border: rgbToCss(mixRgb(base, white, 0.25)), text: rgbToCss(mixRgb(base, black, 0.5)), borderScale: 1 };
  }

  TSB.pageTheme = Object.freeze({ PAGE_PALETTES, pagePalette, displayColor, blockColors });
})(globalThis.TSB = globalThis.TSB || {});
