/**
 * Draws a calendar view onto a canvas for PNG, PDF and print output.
 * The canvas is US Letter landscape proportions (11 × 8.5) at 200 dpi.
 */
(function (TSB) {
  'use strict';

  const { DAY_NAMES, VIEWS, SIZE_PRESETS, SEPARATOR } = TSB.constants;
  const { formatHour, formatMonthDay } = TSB.dates;
  const { hexToRgb, mixRgb, rgbToCss, readableTextColor } = TSB.color;
  const { buildWeekView } = TSB.weekView;
  const { eventTag, eventDetailLines } = TSB.eventText;
  const { findFont } = TSB.schedule;
  const { waitForFont, fontStack } = TSB.fonts;

  const WIDTH = 2200;
  const HEIGHT = 1700;
  const MARGIN = 90;

  /** Image color palettes for the "Image background" setting. */
  const PALETTES = {
    white: { background: '#ffffff', ink: '#18202f', muted: '#5b667c', line: '#d6dce7', grid: '#e8ecf3', halfHour: '#f2f4f8', offDay: '#f1f3f7', hatch: '#e0e4ec', isDark: false },
    tint: { background: '#eff3f9', ink: '#18202f', muted: '#56617a', line: '#cbd3e1', grid: '#dde3ee', halfHour: '#e7ecf4', offDay: '#e3e8f0', hatch: '#d3d9e4', isDark: false },
    dark: { background: '#141922', ink: '#e8ebf2', muted: '#9aa3b8', line: '#323a4c', grid: '#242b3a', halfHour: '#1c2230', offDay: '#1a1f2a', hatch: '#272e3d', isDark: true },
  };

  /* ---------- canvas helpers ---------- */

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  /** Word-wrap text to a width using the context's current font; truncates words that are too long. */
  function wrapText(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const word of String(text).split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.map((l) => {
      if (ctx.measureText(l).width <= maxWidth) return l;
      let cut = l;
      while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
      return `${cut}…`;
    });
  }

  /** Fill, border and text colors for an event block. */
  function blockColors(hex, style, palette) {
    const base = hexToRgb(hex);
    if (style.blockColor === 'bold') {
      return { fill: base, border: mixRgb(base, [0, 0, 0], 0.2), text: hexToRgb(readableTextColor(hex)) };
    }
    if (palette.isDark) {
      const background = hexToRgb(palette.background);
      return { fill: mixRgb(base, background, 0.68), border: mixRgb(base, background, 0.15), text: mixRgb(base, [255, 255, 255], 0.68) };
    }
    return { fill: mixRgb(base, [255, 255, 255], 0.8), border: mixRgb(base, [255, 255, 255], 0.25), text: mixRgb(base, [0, 0, 0], 0.5) };
  }

  /* ---------- drawing steps ---------- */

  /** Title, subtitle and view label. Returns the y position below the header. */
  function drawHeader(ctx, d) {
    const { schedule, view, viewKey, font, fonts, palette, scale } = d;
    let y = MARGIN;
    const titleSize = 66 * scale.title;

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = palette.ink;
    ctx.font = `${font.titleWeight} ${titleSize}px ${fonts.title}`;
    ctx.fillText(wrapText(ctx, schedule.title || 'Class Schedule', WIDTH - 2 * MARGIN - 560)[0], MARGIN, y + titleSize * 0.85);

    ctx.textAlign = 'right';
    ctx.font = `${font.codeWeight} 30px ${fonts.code}`;
    ctx.fillText(VIEWS[viewKey].label.toUpperCase(), WIDTH - MARGIN, y + 30);
    if (view.rangeLabel) {
      ctx.font = `400 26px ${fonts.code}`;
      ctx.fillStyle = palette.muted;
      ctx.fillText(view.rangeLabel, WIDTH - MARGIN, y + 66);
    }

    ctx.textAlign = 'left';
    y += Math.max(70, titleSize * 1.05);
    if (schedule.subtitle) {
      const subtitleSize = 32 * (0.5 + 0.5 * scale.title);
      ctx.font = `400 ${subtitleSize}px ${fonts.body}`;
      ctx.fillStyle = palette.muted;
      ctx.fillText(schedule.subtitle, MARGIN, y + subtitleSize * 1.15);
      y += subtitleSize * 1.5;
    }
    return y + 34;
  }

  /** Legend text parts for a course, e.g. ["CSE 143 Computer Programming II", "Prof. Lin"]. */
  function legendParts(course) {
    return [`${course.code}${course.name ? ` ${course.name}` : ''}`, course.instructor].filter(Boolean);
  }

  /** Width of legend parts joined by separators, using the context's current font. */
  function legendTextWidth(ctx, parts) {
    return ctx.measureText(parts.join(SEPARATOR)).width;
  }

  /** Lay out the course legend in rows across the bottom. */
  function layoutLegend(ctx, d) {
    const courses = [...new Map(d.view.events.map((e) => [e.course.id, e.course])).values()];
    ctx.font = `400 24px ${d.fonts.body}`;
    const items = [];
    let x = MARGIN;
    let row = 0;
    for (const course of courses) {
      const parts = legendParts(course);
      const width = 36 + legendTextWidth(ctx, parts) + 40;
      if (x + width > WIDTH - MARGIN && x > MARGIN) {
        row++;
        x = MARGIN;
      }
      items.push({ course, parts, x, row });
      x += width;
    }
    const height = items.length ? (row + 1) * 40 + 40 : 0;
    return { items, height };
  }

  function drawGrid(ctx, d, g) {
    const { view, font, fonts, palette, scale, style } = d;

    view.days.forEach((day, i) => {
      const x = g.left + i * g.columnWidth;
      if (day.offLabel) {
        ctx.fillStyle = palette.offDay;
        ctx.fillRect(x, g.bodyTop, g.columnWidth, g.bodyBottom - g.bodyTop);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, g.bodyTop, g.columnWidth, g.bodyBottom - g.bodyTop);
        ctx.clip();
        ctx.strokeStyle = palette.hatch;
        ctx.lineWidth = 2;
        const height = g.bodyBottom - g.bodyTop;
        for (let k = -height; k < g.columnWidth; k += 26) {
          ctx.beginPath();
          ctx.moveTo(x + k, g.bodyBottom);
          ctx.lineTo(x + k + height, g.bodyTop);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = day.offLabel ? palette.muted : palette.ink;
      ctx.font = `${font.titleWeight} ${32 * scale.day}px ${fonts.title}`;
      ctx.fillText(DAY_NAMES[day.dayOfWeek], x + g.columnWidth / 2, g.top + 36 * scale.day);
      if (day.date) {
        ctx.font = `400 ${24 * scale.day}px ${fonts.code}`;
        ctx.fillStyle = palette.muted;
        ctx.fillText(formatMonthDay(day.date), x + g.columnWidth / 2, g.top + 66 * scale.day);
      }
    });

    // Hour lines and labels
    const hours = view.endHour - view.startHour;
    ctx.lineWidth = 2;
    for (let h = 0; h <= hours; h++) {
      const y = g.bodyTop + h * g.hourHeight;
      ctx.strokeStyle = h === 0 ? palette.line : palette.grid;
      ctx.beginPath();
      ctx.moveTo(g.left, y);
      ctx.lineTo(g.right, y);
      ctx.stroke();
      if (h < hours) {
        ctx.strokeStyle = palette.halfHour;
        ctx.beginPath();
        ctx.moveTo(g.left, y + g.hourHeight / 2);
        ctx.lineTo(g.right, y + g.hourHeight / 2);
        ctx.stroke();
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = palette.muted;
      ctx.font = `400 ${22 * scale.time}px ${fonts.code}`;
      ctx.fillText(formatHour(view.startHour + h, style.clock), g.left - 16, y);
      ctx.textBaseline = 'alphabetic';
    }

    // Column lines and top border
    ctx.strokeStyle = palette.line;
    for (let i = 0; i <= view.days.length; i++) {
      const x = g.left + i * g.columnWidth;
      ctx.beginPath();
      ctx.moveTo(x, g.top);
      ctx.lineTo(x, g.bodyBottom);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(g.left, g.top);
    ctx.lineTo(g.right, g.top);
    ctx.stroke();

    // Labels on days without classes
    view.days.forEach((day, i) => {
      if (!day.offLabel) return;
      ctx.textAlign = 'center';
      ctx.fillStyle = palette.muted;
      ctx.font = `500 ${24 * scale.day}px ${fonts.body}`;
      wrapText(ctx, day.offLabel, g.columnWidth - 30).forEach((line, k) => {
        ctx.fillText(line, g.left + i * g.columnWidth + g.columnWidth / 2, g.bodyTop + 44 * scale.day + k * 30 * scale.day);
      });
    });
  }

  function drawEvents(ctx, d, g) {
    const { view, style, font, fonts, palette, scale, radius } = d;
    const headingSize = 26 * scale.block;
    const lineSize = 22 * scale.block;
    const padding = 14;

    for (const event of view.events) {
      const column = view.days.findIndex((day) => day.dayOfWeek === event.dayOfWeek);
      if (column < 0) continue;

      const laneWidth = g.columnWidth / event.laneCount;
      const x = g.left + column * g.columnWidth + event.lane * laneWidth + 5;
      const y = g.bodyTop + ((event.start - view.startHour * 60) / 60) * g.hourHeight + 3;
      const width = laneWidth - 10;
      const height = ((event.end - event.start) / 60) * g.hourHeight - 6;
      const colors = blockColors(event.course.color || '#3b5bdb', style, palette);

      roundedRect(ctx, x, y, width, height, radius);
      ctx.fillStyle = rgbToCss(colors.fill);
      ctx.fill();
      ctx.lineWidth = event.isFinal ? 4 : 2;
      ctx.strokeStyle = rgbToCss(colors.border);
      ctx.stroke();

      ctx.save();
      roundedRect(ctx, x, y, width, height, radius);
      ctx.clip();
      ctx.textAlign = 'left';
      ctx.fillStyle = rgbToCss(colors.text);
      const textWidth = width - padding * 2;
      let textY = y + headingSize + 6;

      const tag = eventTag(event, style);
      ctx.font = `${font.codeWeight} ${headingSize}px ${fonts.code}`;
      for (const line of wrapText(ctx, event.course.code + (tag ? `  ${tag}` : ''), textWidth).slice(0, 2)) {
        ctx.fillText(line, x + padding, textY);
        textY += headingSize * 1.15;
      }

      ctx.font = `400 ${lineSize}px ${fonts.body}`;
      outer: for (const detail of eventDetailLines(event, style, { fullTimes: true })) {
        for (const line of wrapText(ctx, detail, textWidth)) {
          if (textY > y + height - 4) break outer;
          ctx.fillText(line, x + padding, textY);
          textY += lineSize * 1.25;
        }
      }
      ctx.restore();
    }

    if (!view.events.length) {
      ctx.textAlign = 'center';
      ctx.fillStyle = palette.muted;
      ctx.font = `400 30px ${fonts.body}`;
      ctx.fillText(d.viewKey === 'finals' ? 'No finals scheduled' : 'No classes yet', (g.left + g.right) / 2, (g.bodyTop + g.bodyBottom) / 2);
    }
  }

  function drawLegend(ctx, d, legend, bodyBottom) {
    for (const item of legend.items) {
      const y = bodyBottom + 56 + item.row * 40;
      ctx.fillStyle = item.course.color;
      roundedRect(ctx, item.x, y - 20, 24, 24, d.radius ? 5 : 0);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.font = `400 24px ${d.fonts.body}`;

      // Draw each part in ink and the separators in the muted color.
      let x = item.x + 36;
      item.parts.forEach((part, index) => {
        if (index > 0) {
          ctx.fillStyle = d.palette.muted;
          ctx.fillText(SEPARATOR, x, y);
          x += ctx.measureText(SEPARATOR).width;
        }
        ctx.fillStyle = d.palette.ink;
        ctx.fillText(part, x, y);
        x += ctx.measureText(part).width;
      });
    }
  }

  /**
   * @param {object} schedule
   * @param {'week1'|'weekly'|'finals'} viewKey
   * @param {object[]} [courses]
   * @returns {Promise<HTMLCanvasElement>}
   */
  async function renderCalendarImage(schedule, viewKey, courses = schedule.courses) {
    const style = schedule.style;
    const font = findFont(style.font);
    await waitForFont(font);

    const preset = SIZE_PRESETS[style.sizePreset] || 1;
    const drawing = {
      schedule,
      viewKey,
      style,
      font,
      view: buildWeekView(schedule, viewKey, courses),
      palette: PALETTES[style.imageBackground] || PALETTES.white,
      fonts: { title: fontStack(font.title, font), body: fontStack(font.body, font), code: fontStack(font.code, font) },
      scale: {
        title: preset * style.sizes.title,
        day: preset * style.sizes.day,
        block: preset * style.sizes.block,
        time: preset * style.sizes.time,
      },
      radius: style.corners === 'square' ? 0 : 10,
    };

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = drawing.palette.background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const gridTop = drawHeader(ctx, drawing);
    const legend = layoutLegend(ctx, drawing);

    const timeColumn = 120 * Math.max(1, drawing.scale.time);
    const headerHeight = 78 * Math.max(1, drawing.scale.day);
    const grid = {
      left: MARGIN + timeColumn,
      right: WIDTH - MARGIN,
      top: gridTop,
      bodyTop: gridTop + headerHeight,
      bodyBottom: HEIGHT - MARGIN - legend.height,
    };
    grid.columnWidth = (grid.right - grid.left) / drawing.view.days.length;
    grid.hourHeight = (grid.bodyBottom - grid.bodyTop) / (drawing.view.endHour - drawing.view.startHour);

    drawGrid(ctx, drawing, grid);
    drawEvents(ctx, drawing, grid);
    drawLegend(ctx, drawing, legend, grid.bodyBottom);
    return canvas;
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
