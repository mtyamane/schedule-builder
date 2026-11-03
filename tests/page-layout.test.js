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
  assert.ok(!textItems(right.items).some((t) => t.text === 'Prof. Lin')); // instructor is off by default

  // Top: the grid moves down and the legend sits above it.
  assert.ok(gridTop(top) > gridTop(off));
  assert.equal(gridBottom(top), gridBottom(off));
  assert.ok(legendText(top).y < gridTop(top));

  // Left: the grid moves right and the legend sits left of it.
  assert.ok(gridLeft(left) > gridLeft(off));
  assert.equal(gridRight(left), gridRight(off));
  assert.ok(legendText(left).x < gridLeft(left));
});

test('legend shows course name, instructor and room only when chosen', () => {
  const schedule = oneCourseSchedule();
  const legendLines = () => {
    const layout = layoutOf(schedule);
    const bodyBottom = Math.max(...layout.items.filter((i) => i.type === 'line').map((i) => i.y2));
    // Bottom legend: body text below the grid (hour labels use the code role). Rebuild each entry from its pieces.
    return textItems(layout.items).filter((t) => t.y > bodyBottom && t.role === 'body').map((t) => t.text).join('');
  };

  assert.equal(legendLines(), 'CSE 143 Computer Programming II'); // defaults: name on, instructor and room off

  schedule.style.legendDetails = { code: true, name: false, instructor: false, room: false };
  assert.equal(legendLines(), 'CSE 143');

  schedule.style.legendDetails = { code: false, name: true, instructor: false, room: false };
  assert.equal(legendLines(), 'Computer Programming II');

  schedule.style.legendDetails = { code: false, name: false, instructor: false, room: false };
  assert.equal(legendLines(), ''); // color swatch only
  const swatches = layoutOf(schedule).items.filter((i) => i.type === 'rect' && i.fill === '#3b5bdb' && i.w < 12);
  assert.equal(swatches.length, 1);

  schedule.style.legendDetails = { code: true, name: true, instructor: true, room: true };
  assert.equal(legendLines(), 'CSE 143 Computer Programming II | Prof. Lin | Kane Hall 130');

  // Column legends put the instructor and room on their own muted lines.
  schedule.style.legend = 'right';
  const layout = layoutOf(schedule);
  const texts = textItems(layout.items);
  const palette = TSB.pageTheme.pagePalette(schedule.style);
  assert.equal(texts.find((t) => t.text === 'Prof. Lin').color, palette.muted);
  assert.equal(texts.find((t) => t.text === 'Kane Hall 130' && t.color === palette.muted).text, 'Kane Hall 130');
});

test('legend order: as entered, by course code, or by first class of the week', () => {
  const schedule = oneCourseSchedule();
  const base = schedule.courses[0];
  const course = (id, code, days, start) => ({ ...base, id, code, final: null, meetings: [{ id: `m-${id}`, type: 'LEC', days, start, end: `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:00`, location: '' }] });
  schedule.courses = [course('a', 'MATH 126', [3], '08:00'), course('b', 'CSE 1430', [1], '13:00'), course('c', 'CSE 143', [1], '09:00')];
  const view = buildWeekView(schedule, 'weekly');
  const codes = (order) => TSB.pageLayout.orderLegendCourses(schedule.courses, view, order).map((c) => c.code);
  assert.deepEqual(codes('entered'), ['MATH 126', 'CSE 1430', 'CSE 143']);
  assert.deepEqual(codes('code'), ['CSE 143', 'CSE 1430', 'MATH 126']);
  assert.deepEqual(codes('time'), ['CSE 143', 'CSE 1430', 'MATH 126']); // Mon 9:00, Mon 1:00, Wed 8:00
});

test('class blocks can lead with the course name instead of the code', () => {
  const schedule = oneCourseSchedule();
  Object.assign(schedule.style.blockDetails, { code: false, name: true });
  const block = groups(layoutOf(schedule))[0];
  const texts = textItems(block.items).map((t) => t.text);
  assert.ok(texts[0].startsWith('Computer'));
  assert.ok(!texts.includes('CSE 143'));
  assert.equal(texts.filter((t) => t.includes('Computer')).length, texts[0] === 'Computer Programming II' ? 1 : 2); // name not repeated as a detail
});

test('title can be centered, clear of the view label', () => {
  const schedule = oneCourseSchedule();
  schedule.style.titleAlign = 'center';
  const layout = layoutOf(schedule);
  const title = textItems(layout.items).find((t) => t.text === 'Winter 2027');
  const center = title.x + measure(title.text, title.size) / 2;
  assert.ok(Math.abs(center - layout.width / 2) < 0.01);
});

test('day names and dates follow the chosen formats', () => {
  const schedule = oneCourseSchedule();
  const firstWeekTexts = () => textItems(layoutOf(schedule, 'week1').items).map((t) => t.text);
  schedule.style.dayFormat = 'long';
  schedule.style.dateFormat = 'numeric';
  assert.ok(firstWeekTexts().includes('Tuesday'));
  assert.ok(firstWeekTexts().includes('1/5'));
  assert.ok(firstWeekTexts().includes('Week of 1/4'));
  schedule.style.dayFormat = 'letter';
  schedule.style.dateFormat = 'day-month';
  assert.ok(firstWeekTexts().includes('Tu'));
  assert.ok(firstWeekTexts().includes('5 Jan'));
});

test('half-hour lines and striped off days can be turned off', () => {
  const schedule = oneCourseSchedule();
  const halfLines = () => layoutOf(schedule, 'week1').items.filter((i) => i.type === 'line' && i.color === TSB.pageTheme.pagePalette(schedule.style).halfHour).length;
  assert.ok(halfLines() > 0);
  assert.equal(layoutOf(schedule, 'week1').items.filter((i) => i.type === 'hatch').length, 1); // Monday before classes

  schedule.style.halfHourLines = false;
  schedule.style.stripeOffDays = false;
  assert.equal(halfLines(), 0);
  const items = layoutOf(schedule, 'week1').items;
  assert.equal(items.filter((i) => i.type === 'hatch').length, 0);
  assert.ok(items.some((i) => i.type === 'rect' && i.fill === TSB.pageTheme.pagePalette(schedule.style).offDay));
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

test('week can start on Sunday', () => {
  const schedule = oneCourseSchedule();
  schedule.style.weekStart = 'sunday';
  schedule.style.days = 'all';
  const week1 = buildWeekView(schedule, 'week1');
  assert.deepEqual(week1.days.map((d) => d.dayOfWeek), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(week1.rangeLabel, 'Week of Jan 3');
  assert.equal(TSB.dates.toIsoDate(TSB.schedule.finalsWeekStart(schedule)), '2027-03-14'); // Sunday before the Mar 15 final
});
