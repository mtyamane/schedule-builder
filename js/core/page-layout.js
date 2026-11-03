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

  const { VIEWS, SEPARATOR, PAPER_SIZES, PAGE_MARGINS } = TSB.constants;
  const { formatHour, formatShortDate, formatDayName, formatTimeRange } = TSB.dates;
  const { buildWeekView } = TSB.weekView;
  const { eventHeading, eventTag, eventDetailLines } = TSB.eventText;
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
   * @typedef {{type: 'group', clip: {x: number, y: number, w: number, h: number, radius: number}, items: Array, tooltip?: string, courseId?: string, isPreview?: boolean, overlaps?: boolean}} GroupItem
   *   One class block. courseId, isPreview and overlaps are used by the on-screen preview; exports ignore them.
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
   * Courses that appear in a view, in legend order:
   * 'entered' keeps the class list's order, 'code' sorts by course code
   * (so "CSE 143" comes before "CSE 1430"), and 'time' sorts by each
   * course's first class of the displayed week.
   * @param {object[]} courses
   * @param {object} view WeekView
   * @param {'entered'|'code'|'time'} order
   * @returns {object[]}
   */
  function orderLegendCourses(courses, view, order) {
    const shown = courses.filter((course) => view.events.some((e) => e.course === course));
    if (order === 'code') {
      return [...shown].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
    }
    if (order === 'time') {
      const dayIndex = new Map(view.days.map((d, i) => [d.dayOfWeek, i]));
      const firstClass = (course) => Math.min(...view.events
        .filter((e) => e.course === course)
        .map((e) => dayIndex.get(e.dayOfWeek) * 24 * 60 + e.start));
      return [...shown].sort((a, b) => firstClass(a) - firstClass(b));
    }
    return shown;
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

    // A centered title keeps clear of the view label on both sides, so it stays centered on the page.
    const centered = style.titleAlign === 'center';
    const metaSpace = metaWidth ? metaWidth + 24 : 0;
    const titleMaxWidth = contentWidth - (centered ? 2 * metaSpace : metaSpace);
    const titleX = (width) => (centered ? margin + (contentWidth - width) / 2 : margin);
    const titleSize = sizes.title;
    const titleBaseline = margin + titleSize * 0.82;
    const titleWidthOf = widthFn(titleSize, font.titleWeight, 'title');
    const title = truncate(schedule.title || 'Class schedule', titleMaxWidth, titleWidthOf);
    items.push(text(titleX(titleWidthOf(title)), titleBaseline, title, titleSize, font.titleWeight, 'title', palette.ink));
    let titleBottom = titleBaseline + titleSize * 0.22;

    if (style.header.subtitle && schedule.subtitle) {
      const subtitleBaseline = titleBottom + sizes.subtitle * 1.05;
      const subtitleWidthOf = widthFn(sizes.subtitle, 400, 'body');
      const subtitle = truncate(schedule.subtitle, titleMaxWidth, subtitleWidthOf);
      items.push(text(titleX(subtitleWidthOf(subtitle)), subtitleBaseline, subtitle, sizes.subtitle, 400, 'body', palette.muted));
      titleBottom = subtitleBaseline + sizes.subtitle * 0.25;
    }
    const headerBottom = Math.max(titleBottom, metaBottom) + HEADER_GAP;

    /* ---------- legend (measured first; it takes space from the grid) ---------- */

    const legendSize = sizes.legend;
    const swatch = legendSize * 0.95;
    const swatchGap = legendSize * 0.5;
    const legendCourses = orderLegendCourses(courses, view, style.legendOrder);
    /**
     * Legend text for a course, by the "Legend shows" checkboxes:
     * `title` is the code and/or name (empty when both are off), `extras` the
     * instructor and the main meeting's room. With nothing chosen, the
     * entry is just its color swatch.
     */
    const legendParts = (course) => {
      const show = style.legendDetails;
      const room = course.meetings[0] && course.meetings[0].location;
      const title = [show.code && course.code, show.name && course.name].filter(Boolean).join(' ');
      return { title, extras: [show.instructor && course.instructor, show.room && room].filter(Boolean) };
    };
    const legendTexts = (course) => {
      const { title, extras } = legendParts(course);
      return [title, ...extras].filter(Boolean);
    };
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
        const joined = legendTexts(course).join(SEPARATOR);
        const label = joined ? truncate(joined, contentWidth - swatch - swatchGap, legendWidthOf) : '';
        const itemWidth = swatch + (label ? swatchGap + legendWidthOf(label) : 0);
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
      const widest = Math.max(0, ...legendCourses.flatMap((c) => legendTexts(c).map(legendWidthOf)));
      legendColumnWidth = Math.min(swatch + (widest ? swatchGap + widest : 0), contentWidth * 0.26);
      const textWidth = legendColumnWidth - swatch - swatchGap;
      for (const course of legendCourses) {
        // First line(s): code and/or name. Then one muted line each for instructor and room.
        const { title, extras } = legendParts(course);
        const lines = title ? wrap(title, textWidth, legendWidthOf) : [];
        const mutedFrom = lines.length;
        extras.forEach((extra) => lines.push(truncate(extra, textWidth, legendWidthOf)));
        const x = style.legend === 'left' ? margin : margin + contentWidth - legendColumnWidth;
        legendItems.push({ course, x, lines, mutedFrom });
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
        const area = { x: columnX(i), y: bodyTop, w: columnWidth, h: bodyBottom - bodyTop };
        items.push(style.stripeOffDays === false
          ? { type: 'rect', ...area, fill: palette.offDay }
          : { type: 'hatch', ...area, fill: palette.offDay, color: palette.hatch, spacing: 9 });
      }
    });

    for (let h = 0; h <= hours; h++) {
      const y = bodyTop + h * hourHeight;
      items.push({ type: 'line', x1: columnsLeft, y1: y, x2: gridRight, y2: y, color: h === 0 ? palette.line : palette.grid, width: LINE_WIDTH });
      if (h < hours && style.halfHourLines !== false) {
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
      const name = formatDayName(day.dayOfWeek, style.dayFormat);
      const nameWidth = measure(name, daySize, font.titleWeight, 'title');
      items.push(text(center - nameWidth / 2, dayNameBaseline, name, daySize, font.titleWeight, 'title', day.offLabel ? palette.muted : palette.ink));
      if (day.date) {
        const date = formatShortDate(day.date, style.dateFormat);
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

      // Bold first line: the course code, or the name when "Course code" is off.
      const tag = eventTag(event, style);
      const heading = eventHeading(event, style);
      const code = event.course.code;
      if (tag && codeWidthOf(`${heading}  ${tag}`) <= maxWidth) {
        children.push(text(textX, baseline, heading, codeSize, font.codeWeight, 'code', colors.text));
        children.push(text(textX + codeWidthOf(`${heading}  `), baseline, tag, codeSize, font.codeWeight, 'code', colors.text, { opacity: 0.7 }));
      } else {
        wrap(tag ? `${heading}  ${tag}` : heading, maxWidth, codeWidthOf).slice(0, 2).forEach((line, i) => {
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
        // For the on-screen preview only: which class to edit on click, and whether to flag an overlap.
        courseId: event.course.id,
        isPreview: event.isPreview,
        overlaps: event.overlaps,
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
        // Draw the separator in the muted color. An empty label means color only.
        let x = textX;
        const parts = item.lines[0] ? item.lines[0].split(SEPARATOR) : [];
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
        columnLegendY += Math.max(1, item.lines.length) * legendSize * 1.3 + legendSize * 0.7; // a color-only entry still takes one line
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

  TSB.pageLayout = Object.freeze({ buildPageLayout, orderLegendCourses, pageSize, wrap, truncate });
})(globalThis.TSB = globalThis.TSB || {});
