/**
 * Lays out one calendar view as a printed page and returns a display list:
 * plain shapes and text positioned in points (1/72 inch). The on-screen
 * preview (SVG) and the PNG/PDF/print export (canvas) both draw this same
 * list, so they match.
 *
 * Text widths come from a `measure` function supplied by the caller, so the
 * layout itself has no DOM access and can be tested in Node.
 */
(function (TSB) {
  'use strict';

  const { DAY_NAMES, VIEWS, SEPARATOR, PAPER_SIZES, PAGE_MARGINS } = TSB.constants;
  const { formatHour, formatMonthDay, formatTimeRange } = TSB.dates;
  const { buildWeekView } = TSB.weekView;
  const { eventTag, eventDetailLines } = TSB.eventText;
  const { pagePalette, displayColor, blockColors } = TSB.pageTheme;
  const { findFont } = TSB.schedule;

  /* Spacing, in points. */
  const HEADER_GAP = 14;
  const LEGEND_SIDE_GAP = 16;
  const LINE_WIDTH = 0.7;
  const BLOCK_INSET_X = 1.5;
  const BLOCK_INSET_Y = 1;
  const BLOCK_PADDING_X = 4.5;
  const BLOCK_PADDING_TOP = 3;
  const BLOCK_RADIUS = 3.5;

  /**
   * @typedef {(text: string, size: number, weight: number, role: 'title'|'body'|'code') => number} MeasureText
   *   Width of `text` in points at `size` points.
   *
   * Display list items (all coordinates in points, origin top-left):
   * @typedef {{type: 'rect', x: number, y: number, w: number, h: number, fill?: string, stroke?: string, strokeWidth?: number, radius?: number, dashed?: boolean}} RectItem
   * @typedef {{type: 'hatch', x: number, y: number, w: number, h: number, fill: string, color: string, spacing: number}} HatchItem
   * @typedef {{type: 'line', x1: number, y1: number, x2: number, y2: number, color: string, width: number}} LineItem
   * @typedef {{type: 'text', x: number, y: number, text: string, size: number, weight: number, role: string, color: string, opacity?: number}} TextItem
   *   `y` is the text baseline; `x` is the left edge.
   * @typedef {{type: 'group', clip: {x: number, y: number, w: number, h: number, radius: number}, items: Array, tooltip?: string}} GroupItem
   *
   * @typedef {Object} PageLayout
   * @property {number} width
   * @property {number} height
   * @property {string} background
   * @property {{title: string, body: string, code: string}} fontFamilies  CSS font-family lists by role
   * @property {Array<RectItem|HatchItem|LineItem|TextItem|GroupItem>} items
   * @property {object} view        the WeekView that was laid out
   * @property {{paper: string, orientation: string}} page
   */

  /** @returns {{width: number, height: number}} page size in points */
  function pageSize(pageSettings) {
    const paper = PAPER_SIZES[pageSettings.paper] || PAPER_SIZES.letter;
    return pageSettings.orientation === 'portrait'
      ? { width: paper.height, height: paper.width }
      : { width: paper.width, height: paper.height };
  }

  /** Shorten text with "…" until it fits. */
  function truncate(text, maxWidth, widthOf) {
    if (widthOf(text) <= maxWidth) return text;
    let cut = text;
    while (cut.length > 1 && widthOf(`${cut}…`) > maxWidth) cut = cut.slice(0, -1);
    return `${cut}…`;
  }

  /** Word-wrap text to a width; words longer than a line are truncated. */
  function wrap(text, maxWidth, widthOf) {
    const lines = [];
    let line = '';
    for (const word of String(text).split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || widthOf(candidate) <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.map((l) => truncate(l, maxWidth, widthOf));
  }

  /**
   * @param {object} schedule
   * @param {'week1'|'weekly'|'finals'} viewKey
   * @param {object[]} courses courses to draw (may include an editing preview)
   * @param {MeasureText} measure
   * @returns {PageLayout}
   */
  function buildPageLayout(schedule, viewKey, courses, measure) {
    const style = schedule.style;
    const sizes = style.fontSizes;
    const font = findFont(style.font);
    const palette = pagePalette(style);
    const { width: W, height: H } = pageSize(style.page);
    const margin = PAGE_MARGINS[style.page.margins] || PAGE_MARGINS.normal;
    const contentWidth = W - 2 * margin;
    const view = buildWeekView(schedule, viewKey, courses);
    const items = [];

    const widthFn = (size, weight, role) => (text) => measure(text, size, weight, role);
    const text = (x, y, value, size, weight, role, color, extra = {}) => ({ type: 'text', x, y, text: value, size, weight, role, color, ...extra });

    /* ---------- header ---------- */

    const metaSize = sizes.subtitle;
    const meta = [];
    if (style.header.viewLabel) meta.push({ value: VIEWS[viewKey].label.toUpperCase(), weight: 700, color: palette.ink });
    if (style.header.weekRange && view.rangeLabel) meta.push({ value: view.rangeLabel, weight: 400, color: palette.muted });
    const metaWidth = Math.max(0, ...meta.map((m) => measure(m.value, metaSize, m.weight, 'body')));

    let metaBaseline = margin + metaSize * 0.85;
    let metaBottom = margin;
    meta.forEach((m, i) => {
      if (i > 0) metaBaseline += metaSize * 1.35;
      const w = measure(m.value, metaSize, m.weight, 'body');
      items.push(text(margin + contentWidth - w, metaBaseline, m.value, metaSize, m.weight, 'body', m.color));
      metaBottom = metaBaseline + metaSize * 0.25;
    });

    const titleMaxWidth = contentWidth - (metaWidth ? metaWidth + 24 : 0);
    const titleSize = sizes.title;
    const titleBaseline = margin + titleSize * 0.82;
    const title = truncate(schedule.title || 'Class schedule', titleMaxWidth, widthFn(titleSize, font.titleWeight, 'title'));
    items.push(text(margin, titleBaseline, title, titleSize, font.titleWeight, 'title', palette.ink));
    let titleBottom = titleBaseline + titleSize * 0.22;

    if (style.header.subtitle && schedule.subtitle) {
      const subtitleBaseline = titleBottom + sizes.subtitle * 1.05;
      const subtitle = truncate(schedule.subtitle, titleMaxWidth, widthFn(sizes.subtitle, 400, 'body'));
      items.push(text(margin, subtitleBaseline, subtitle, sizes.subtitle, 400, 'body', palette.muted));
      titleBottom = subtitleBaseline + sizes.subtitle * 0.25;
    }
    const headerBottom = Math.max(titleBottom, metaBottom) + HEADER_GAP;

    /* ---------- legend (measured first; it takes space from the grid) ---------- */

    const legendSize = sizes.legend;
    const swatch = legendSize * 0.95;
    const swatchGap = legendSize * 0.5;
    const legendCourses = [...new Map(view.events.map((e) => [e.course.id, e.course])).values()];
    const legendParts = (course) => [`${course.code}${course.name ? ` ${course.name}` : ''}`, course.instructor].filter(Boolean);
    const legendWidthOf = widthFn(legendSize, 400, 'body');
    const legendItems = [];
    // Top and bottom legends are rows across the page; left and right legends are a column.
    const isRowLegend = style.legend === 'top' || style.legend === 'bottom';
    const isColumnLegend = style.legend === 'left' || style.legend === 'right';
    let legendHeight = 0;
    let legendColumnWidth = 0;

    if (isRowLegend && legendCourses.length) {
      const rowHeight = legendSize * 1.8;
      let x = margin;
      let row = 0;
      for (const course of legendCourses) {
        const label = truncate(legendParts(course).join(SEPARATOR), contentWidth - swatch - swatchGap, legendWidthOf);
        const itemWidth = swatch + swatchGap + legendWidthOf(label);
        if (x + itemWidth > margin + contentWidth && x > margin) {
          row++;
          x = margin;
        }
        legendItems.push({ course, x, row, lines: [label] });
        x += itemWidth + legendSize * 1.6;
      }
      legendHeight = (row + 1) * rowHeight + legendSize * 0.6;
      // `y` is each row's text baseline.
      const firstBaseline = style.legend === 'top'
        ? headerBottom + legendSize
        : H - margin - legendHeight + legendSize * 0.6 + legendSize;
      legendItems.forEach((item) => {
        item.y = firstBaseline + item.row * rowHeight;
      });
    } else if (isColumnLegend && legendCourses.length) {
      const widest = Math.max(...legendCourses.flatMap((c) => legendParts(c).map(legendWidthOf)));
      legendColumnWidth = Math.min(swatch + swatchGap + widest, contentWidth * 0.26);
      const textWidth = legendColumnWidth - swatch - swatchGap;
      for (const course of legendCourses) {
        const [first, instructor] = legendParts(course);
        const lines = wrap(first, textWidth, legendWidthOf);
        if (instructor) lines.push(truncate(instructor, textWidth, legendWidthOf));
        const x = style.legend === 'left' ? margin : margin + contentWidth - legendColumnWidth;
        legendItems.push({ course, x, lines, mutedFrom: instructor ? lines.length - 1 : lines.length });
      }
    }

    /* ---------- grid geometry ---------- */

    const legendSpace = legendColumnWidth ? legendColumnWidth + LEGEND_SIDE_GAP : 0;
    const gridLeft = margin + (style.legend === 'left' ? legendSpace : 0);
    const gridRight = margin + contentWidth - (style.legend === 'right' ? legendSpace : 0);
    const gridTop = headerBottom + (style.legend === 'top' ? legendHeight : 0);
    const daySize = sizes.day;
    const dateSize = daySize * 0.8;
    const hasDates = view.days.some((d) => d.date);
    const dayNameBaseline = gridTop + 4 + daySize * 0.85;
    const dayDateBaseline = dayNameBaseline + dateSize * 1.3;
    const bodyTop = (hasDates ? dayDateBaseline : dayNameBaseline) + daySize * 0.35 + 3;
    const timeSize = sizes.time;
    // Leave room below the last hour label when there's no legend under the grid.
    const bodyBottom = H - margin - Math.max(style.legend === 'bottom' ? legendHeight : 0, timeSize * 0.6);

    const hours = view.endHour - view.startHour;
    const hourLabels = [];
    for (let h = view.startHour; h <= view.endHour; h++) hourLabels.push(formatHour(h, style.clock));
    const timeWidthOf = widthFn(timeSize, 400, 'code');
    const columnsLeft = gridLeft + Math.max(...hourLabels.map(timeWidthOf)) + 8;

    const dayCount = Math.max(1, view.days.length);
    const columnWidth = (gridRight - columnsLeft) / dayCount;
    const hourHeight = (bodyBottom - bodyTop) / hours;
    const columnX = (i) => columnsLeft + i * columnWidth;

    /* ---------- grid ---------- */

    view.days.forEach((day, i) => {
      if (day.offLabel) {
        items.push({ type: 'hatch', x: columnX(i), y: bodyTop, w: columnWidth, h: bodyBottom - bodyTop, fill: palette.offDay, color: palette.hatch, spacing: 9 });
      }
    });

    for (let h = 0; h <= hours; h++) {
      const y = bodyTop + h * hourHeight;
      items.push({ type: 'line', x1: columnsLeft, y1: y, x2: gridRight, y2: y, color: h === 0 ? palette.line : palette.grid, width: LINE_WIDTH });
      if (h < hours) {
        const half = y + hourHeight / 2;
        items.push({ type: 'line', x1: columnsLeft, y1: half, x2: gridRight, y2: half, color: palette.halfHour, width: LINE_WIDTH });
      }
      const label = hourLabels[h];
      items.push(text(columnsLeft - 5 - timeWidthOf(label), y + timeSize * 0.33, label, timeSize, 400, 'code', palette.muted));
    }

    for (let i = 0; i <= dayCount; i++) {
      items.push({ type: 'line', x1: columnX(i), y1: gridTop, x2: columnX(i), y2: bodyBottom, color: palette.line, width: LINE_WIDTH });
    }
    items.push({ type: 'line', x1: columnsLeft, y1: gridTop, x2: gridRight, y2: gridTop, color: palette.line, width: LINE_WIDTH });

    view.days.forEach((day, i) => {
      const center = columnX(i) + columnWidth / 2;
      const name = DAY_NAMES[day.dayOfWeek];
      const nameWidth = measure(name, daySize, font.titleWeight, 'title');
      items.push(text(center - nameWidth / 2, dayNameBaseline, name, daySize, font.titleWeight, 'title', day.offLabel ? palette.muted : palette.ink));
      if (day.date) {
        const date = formatMonthDay(day.date);
        const dateWidth = measure(date, dateSize, 400, 'code');
        items.push(text(center - dateWidth / 2, dayDateBaseline, date, dateSize, 400, 'code', palette.muted));
      }
      if (day.offLabel) {
        const offSize = sizes.details;
        const offWidthOf = widthFn(offSize, 500, 'body');
        wrap(day.offLabel, columnWidth - 10, offWidthOf).forEach((line, k) => {
          items.push(text(center - offWidthOf(line) / 2, bodyTop + offSize * 1.6 + k * offSize * 1.3, line, offSize, 500, 'body', palette.muted));
        });
      }
    });

    /* ---------- class blocks ---------- */

    const codeSize = sizes.code;
    const detailSize = sizes.details;
    const codeWidthOf = widthFn(codeSize, font.codeWeight, 'code');
    const detailWidthOf = widthFn(detailSize, 400, 'body');

    for (const event of view.events) {
      const column = view.days.findIndex((d) => d.dayOfWeek === event.dayOfWeek);
      if (column < 0) continue;

      const laneWidth = columnWidth / event.laneCount;
      const x = columnX(column) + event.lane * laneWidth + BLOCK_INSET_X;
      const y = bodyTop + ((event.start - view.startHour * 60) / 60) * hourHeight + BLOCK_INSET_Y;
      const w = laneWidth - 2 * BLOCK_INSET_X;
      const h = ((event.end - event.start) / 60) * hourHeight - 2 * BLOCK_INSET_Y;
      const radius = style.corners === 'square' ? 0 : Math.min(BLOCK_RADIUS, h / 2);
      const colors = blockColors(event.course.color, style);
      const children = [];

      const textX = x + BLOCK_PADDING_X;
      const maxWidth = w - 2 * BLOCK_PADDING_X;
      const bottomLimit = y + h - 1.5;
      let baseline = y + BLOCK_PADDING_TOP + codeSize * 0.85;

      const tag = eventTag(event, style);
      const code = event.course.code;
      if (tag && codeWidthOf(`${code}  ${tag}`) <= maxWidth) {
        children.push(text(textX, baseline, code, codeSize, font.codeWeight, 'code', colors.text));
        children.push(text(textX + codeWidthOf(`${code}  `), baseline, tag, codeSize, font.codeWeight, 'code', colors.text, { opacity: 0.7 }));
      } else {
        wrap(tag ? `${code}  ${tag}` : code, maxWidth, codeWidthOf).slice(0, 2).forEach((line, i) => {
          if (i > 0) baseline += codeSize * 1.15;
          children.push(text(textX, baseline, line, codeSize, font.codeWeight, 'code', colors.text));
        });
      }

      outer: for (const detail of eventDetailLines(event, style, { fullTimes: true })) {
        for (const line of wrap(detail, maxWidth, detailWidthOf)) {
          const next = baseline + detailSize * 1.3;
          if (next + detailSize * 0.2 > bottomLimit) break outer;
          baseline = next;
          children.push(text(textX, baseline, line, detailSize, 400, 'body', colors.text));
        }
      }

      const tooltip = [
        `${code}${event.course.name ? `: ${event.course.name}` : ''}${event.sectionType ? ` (${event.sectionType})` : ''}`,
        formatTimeRange(event.start, event.end, style.clock),
        event.location,
        event.course.instructor,
      ].filter(Boolean).join('\n');

      items.push({
        type: 'group',
        clip: { x, y, w, h, radius },
        tooltip,
        items: [
          { type: 'rect', x, y, w, h, radius, fill: colors.fill, stroke: colors.border, strokeWidth: (event.isFinal ? 1.4 : 0.75) * colors.borderScale, dashed: event.isPreview },
          ...children,
        ],
      });
    }

    if (!view.events.length) {
      const message = viewKey === 'finals' ? 'No finals scheduled' : 'No classes yet';
      const messageWidth = measure(message, sizes.subtitle, 400, 'body');
      items.push(text((columnsLeft + gridRight) / 2 - messageWidth / 2, (bodyTop + bodyBottom) / 2, message, sizes.subtitle, 400, 'body', palette.muted));
    }

    /* ---------- legend ---------- */

    let columnLegendY = bodyTop;
    for (const item of legendItems) {
      const top = isColumnLegend ? columnLegendY : item.y - legendSize * 0.82;
      const swatchColor = displayColor(item.course.color, style);
      items.push({ type: 'rect', x: item.x, y: top + (legendSize - swatch) / 2 - legendSize * 0.08, w: swatch, h: swatch, radius: style.corners === 'square' ? 0 : swatch * 0.22, fill: swatchColor });

      const textX = item.x + swatch + swatchGap;
      if (isRowLegend) {
        // Draw the separator in the muted color.
        let x = textX;
        const parts = item.lines[0].split(SEPARATOR);
        parts.forEach((part, i) => {
          if (i > 0) {
            items.push(text(x, item.y, SEPARATOR, legendSize, 400, 'body', palette.muted));
            x += legendWidthOf(SEPARATOR);
          }
          items.push(text(x, item.y, part, legendSize, 400, 'body', palette.ink));
          x += legendWidthOf(part);
        });
      } else {
        item.lines.forEach((line, i) => {
          const color = i >= item.mutedFrom ? palette.muted : palette.ink;
          items.push(text(textX, columnLegendY + legendSize * 0.82 + i * legendSize * 1.3, line, legendSize, 400, 'body', color));
        });
        columnLegendY += item.lines.length * legendSize * 1.3 + legendSize * 0.7;
      }
    }

    const stack = (family) => `"${family}", ${font.fallback}`;
    return {
      width: W,
      height: H,
      background: palette.background,
      fontFamilies: { title: stack(font.title), body: stack(font.body), code: stack(font.code) },
      items,
      view,
      page: { paper: style.page.paper, orientation: style.page.orientation },
    };
  }

  TSB.pageLayout = Object.freeze({ buildPageLayout, pageSize, wrap, truncate });
})(globalThis.TSB = globalThis.TSB || {});
