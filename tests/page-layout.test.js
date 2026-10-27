'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const TSB = require('./helpers/load-app');
const { oneCourseSchedule } = require('./helpers/fixtures');

const { buildPageLayout, pageSize, wrap } = TSB.pageLayout;
const { buildWeekView } = TSB.weekView;

/** Simple stand-in for canvas text measurement: half the font size per character. */
const measure = (text, size) => text.length * size * 0.5;

const layoutOf = (schedule, view = 'weekly') => buildPageLayout(schedule, view, schedule.courses, measure);
const textItems = (items) => items.flatMap((item) => (item.type === 'group' ? textItems(item.items) : item.type === 'text' ? [item] : []));
const groups = (layout) => layout.items.filter((item) => item.type === 'group');

/* ---------- page setup ---------- */

test('page size follows paper and orientation', () => {
  assert.deepEqual(pageSize({ paper: 'letter', orientation: 'landscape' }), { width: 792, height: 612 });
  assert.deepEqual(pageSize({ paper: 'letter', orientation: 'portrait' }), { width: 612, height: 792 });
  assert.deepEqual(pageSize({ paper: 'a4', orientation: 'landscape' }), { width: 842, height: 595 });
});

test('everything stays inside the page margins', () => {
  for (const [margins, legend] of [['narrow', 'off'], ['normal', 'bottom'], ['wide', 'right'], ['narrow', 'top'], ['normal', 'left']]) {
    const schedule = oneCourseSchedule();
    schedule.style.page.margins = margins;
    schedule.style.legend = legend;
    const margin = TSB.constants.PAGE_MARGINS[margins];
    const layout = layoutOf(schedule);
    for (const item of layout.items) {
      let box;
      if (item.type === 'line') {
        box = { x1: Math.min(item.x1, item.x2), x2: Math.max(item.x1, item.x2), y1: Math.min(item.y1, item.y2), y2: Math.max(item.y1, item.y2) };
      } else if (item.type === 'text') {
        // Cap height above the baseline, descenders below it.
        box = { x1: item.x, x2: item.x + measure(item.text, item.size), y1: item.y - item.size * 0.75, y2: item.y + item.size * 0.2 };
      } else {
        const r = item.clip || item;
        box = { x1: r.x, x2: r.x + r.w, y1: r.y, y2: r.y + r.h };
      }
      const label = `${item.type} "${item.text || ''}" inside ${margins} margins`;
      assert.ok(box.x1 >= margin - 0.01 && box.x2 <= layout.width - margin + 0.01, label);
      assert.ok(box.y1 >= margin - 0.01 && box.y2 <= layout.height - margin + 0.01, label);
    }
  }
});

/* ---------- sizes ---------- */

test('text uses the point sizes from the style', () => {
  const schedule = oneCourseSchedule({ subtitle: 'Example' });
  Object.assign(schedule.style.fontSizes, { title: 30, subtitle: 14, code: 12, details: 9 });
  const texts = textItems(layoutOf(schedule).items);
  assert.equal(texts.find((t) => t.text === 'Winter 2027').size, 30);
  assert.equal(texts.find((t) => t.text === 'Example').size, 14);
  assert.equal(texts.find((t) => t.text === 'CSE 143').size, 12);
  assert.equal(texts.find((t) => t.text === '9:30–10:20 AM').size, 9);
  assert.equal(texts.find((t) => t.text === 'REGULAR WEEK').size, 14); // view label follows the subtitle
});

test('block text never extends below its block', () => {
  const schedule = oneCourseSchedule();
  Object.assign(schedule.style.blockDetails, { name: true, instructor: true });
  schedule.style.fontSizes.details = 12;
  for (const group of groups(layoutOf(schedule))) {
    for (const t of textItems(group.items).slice(1)) {
      assert.ok(t.y <= group.clip.y + group.clip.h, `"${t.text}" fits`);
    }
  }
});

test('wrap splits on words and truncates long words', () => {
  const widthOf = (text) => text.length;
  assert.deepEqual(wrap('Computer Programming II', 12, widthOf), ['Computer', 'Programming', 'II']);
  assert.deepEqual(wrap('Supercalifragilistic', 8, widthOf), ['Superca…']);
});

/* ---------- header and legend ---------- */

test('header items can be hidden', () => {
  const schedule = oneCourseSchedule({ subtitle: 'Example' });
  Object.assign(schedule.style.header, { subtitle: false, viewLabel: false, weekRange: false });
  const texts = textItems(layoutOf(schedule, 'week1').items).map((t) => t.text);
  assert.ok(!texts.includes('Example'));
  assert.ok(!texts.includes('FIRST WEEK'));
  assert.ok(!texts.includes('Week of Jan 4'));
});

test('legend position changes the grid area', () => {
  const schedule = oneCourseSchedule();
  const gridRight = (layout) => Math.max(...layout.items.filter((i) => i.type === 'line').map((i) => i.x2));
  const gridBottom = (layout) => Math.max(...layout.items.filter((i) => i.type === 'line').map((i) => i.y2));

  schedule.style.legend = 'off';
  const off = layoutOf(schedule);
  schedule.style.legend = 'bottom';
  const bottom = layoutOf(schedule);
  schedule.style.legend = 'right';
  const right = layoutOf(schedule);
  schedule.style.legend = 'top';
  const top = layoutOf(schedule);
  schedule.style.legend = 'left';
  const left = layoutOf(schedule);

  const gridLeft = (layout) => Math.min(...layout.items.filter((i) => i.type === 'line').map((i) => i.x1));
  const gridTop = (layout) => Math.min(...layout.items.filter((i) => i.type === 'line').map((i) => i.y1));
  const legendText = (layout) => textItems(layout.items).find((t) => t.text === 'Prof. Lin' || t.text.startsWith('CSE 143 Computer'));

  assert.ok(gridBottom(bottom) < gridBottom(off));
  assert.ok(gridRight(right) < gridRight(off));
  assert.equal(gridBottom(right), gridBottom(off));
  assert.ok(textItems(right.items).some((t) => t.text === 'Prof. Lin'));

  // Top: the grid moves down and the legend sits above it.
  assert.ok(gridTop(top) > gridTop(off));
  assert.equal(gridBottom(top), gridBottom(off));
  assert.ok(legendText(top).y < gridTop(top));

  // Left: the grid moves right and the legend sits left of it.
  assert.ok(gridLeft(left) > gridLeft(off));
  assert.equal(gridRight(left), gridRight(off));
  assert.ok(legendText(left).x < gridLeft(left));
});

/* ---------- hours and days ---------- */

test('all three views share the same hours', () => {
  const schedule = oneCourseSchedule();
  schedule.courses[0].final.start = '19:00';
  schedule.courses[0].final.end = '21:00';
  const hours = ['week1', 'weekly', 'finals'].map((v) => {
    const view = buildWeekView(schedule, v);
    return [view.startHour, view.endHour];
  });
  assert.deepEqual(hours, [[8, 21], [8, 21], [8, 21]]);
});

test('fixed hours are used, and stretch to fit a class outside them', () => {
  const schedule = oneCourseSchedule();
  schedule.courses[0].final = null; // its 8:30 AM final would stretch every view
  schedule.style.hourStart = 9;
  schedule.style.hourEnd = 12;
  let view = buildWeekView(schedule, 'weekly');
  assert.deepEqual([view.startHour, view.endHour], [9, 12]);

  schedule.style.hourStart = 10;
  view = buildWeekView(schedule, 'weekly');
  assert.equal(view.startHour, 9); // 9:30 class
  assert.match(view.note, /Hours extended/);
});

test('day settings choose which days show', () => {
  const schedule = oneCourseSchedule();
  schedule.style.days = 'all';
  assert.deepEqual(buildWeekView(schedule, 'weekly').days.map((d) => d.dayOfWeek), [1, 2, 3, 4, 5, 6, 0]);

  schedule.courses[0].meetings[0].days = [1, 6];
  schedule.style.days = 'weekdays';
  const view = buildWeekView(schedule, 'weekly');
  assert.deepEqual(view.days.map((d) => d.dayOfWeek), [1, 2, 3, 4, 5]);
  assert.match(view.note, /1 meeting on hidden days isn't shown/);
});

/* ---------- colors ---------- */

test('grayscale and outline styles change block colors', () => {
  const style = TSB.schedule.defaultStyle();
  const { blockColors, displayColor } = TSB.pageTheme;
  assert.equal(displayColor('#3b5bdb', { ...style, grayscale: true }), '#606060'); // same perceived brightness
  assert.equal(blockColors('#3b5bdb', { ...style, blockColor: 'outline' }).fill, '#ffffff');
  assert.equal(blockColors('#3b5bdb', { ...style, blockColor: 'bold' }).fill, '#3b5bdb');
});

test('switching course palettes recolors palette colors and keeps custom ones', () => {
  const { COURSE_PALETTES } = TSB.constants;
  const courses = [{ color: COURSE_PALETTES.standard[2] }, { color: '#123456' }];
  const recolored = TSB.schedule.recolorCourses(courses, 'standard', 'colorblind');
  assert.equal(recolored[0].color, COURSE_PALETTES.colorblind[2]);
  assert.equal(recolored[1].color, '#123456');
  assert.equal(TSB.schedule.recolorCourses(recolored, 'colorblind', 'standard')[0].color, COURSE_PALETTES.standard[2]);
});
