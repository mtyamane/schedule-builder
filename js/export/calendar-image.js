/**
 * Draws a calendar page onto a canvas for PNG, PDF and print output.
 * The page comes from TSB.pageLayout, the same layout the on-screen
 * preview draws, rendered here at TSB.constants.EXPORT_DPI.
 */
(function (TSB) {
  'use strict';

  const { EXPORT_DPI } = TSB.constants;
  const { buildPageLayout } = TSB.pageLayout;
  const { findFont } = TSB.schedule;
  const { waitForFont, createTextMeasurer } = TSB.fonts;

  const POINTS_PER_INCH = 72;

  function roundedRectPath(ctx, x, y, width, height, radius = 0) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  /** Draw one display-list item. Coordinates are in points; the context is pre-scaled. */
  function drawItem(ctx, item, fontFamilies) {
    switch (item.type) {
      case 'rect':
        roundedRectPath(ctx, item.x, item.y, item.w, item.h, item.radius);
        if (item.fill) {
          ctx.fillStyle = item.fill;
          ctx.fill();
        }
        if (item.stroke) {
          ctx.setLineDash(item.dashed ? [3, 2] : []);
          ctx.lineWidth = item.strokeWidth || 1;
          ctx.strokeStyle = item.stroke;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        break;

      case 'hatch':
        ctx.fillStyle = item.fill;
        ctx.fillRect(item.x, item.y, item.w, item.h);
        ctx.save();
        ctx.beginPath();
        ctx.rect(item.x, item.y, item.w, item.h);
        ctx.clip();
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 0.7;
        for (let k = -item.h; k < item.w; k += item.spacing) {
          ctx.beginPath();
          ctx.moveTo(item.x + k, item.y + item.h);
          ctx.lineTo(item.x + k + item.h, item.y);
          ctx.stroke();
        }
        ctx.restore();
        break;

      case 'line':
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.width;
        ctx.beginPath();
        ctx.moveTo(item.x1, item.y1);
        ctx.lineTo(item.x2, item.y2);
        ctx.stroke();
        break;

      case 'text':
        ctx.font = `${item.weight} ${item.size}px ${fontFamilies[item.role] || fontFamilies.body}`;
        ctx.fillStyle = item.color;
        ctx.globalAlpha = item.opacity ?? 1;
        ctx.fillText(item.text, item.x, item.y);
        ctx.globalAlpha = 1;
        break;

      case 'group':
        ctx.save();
        roundedRectPath(ctx, item.clip.x, item.clip.y, item.clip.w, item.clip.h, item.clip.radius);
        ctx.clip();
        item.items.forEach((child) => drawItem(ctx, child, fontFamilies));
        ctx.restore();
        break;

      default:
        break;
    }
  }

  /**
   * @param {object} schedule
   * @param {'week1'|'weekly'|'finals'} viewKey
   * @param {object[]} [courses]
   * @returns {Promise<{canvas: HTMLCanvasElement, layout: object}>}
   */
  async function renderCalendarImage(schedule, viewKey, courses = schedule.courses) {
    const font = findFont(schedule.style.font);
    await waitForFont(font);
    const layout = buildPageLayout(schedule, viewKey, courses, createTextMeasurer(font));

    const scale = EXPORT_DPI / POINTS_PER_INCH;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(layout.width * scale);
    canvas.height = Math.round(layout.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = layout.background;
    ctx.fillRect(0, 0, layout.width, layout.height);
    layout.items.forEach((item) => drawItem(ctx, item, layout.fontFamilies));
    return { canvas, layout };
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @returns {Uint8Array} JPEG bytes
   */
  function canvasToJpegBytes(canvas) {
    const base64 = canvas.toDataURL('image/jpeg', 0.93).split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  TSB.calendarImage = Object.freeze({ renderCalendarImage, canvasToJpegBytes });
})(globalThis.TSB = globalThis.TSB || {});
