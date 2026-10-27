'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const TSB = require('./helpers/load-app');

const { createHistory } = TSB.history;

/** A history with a controllable clock. */
function setup() {
  let time = 0;
  const history = createHistory({ groupWindowMs: 1000, now: () => time });
  history.reset('A');
  return { history, advance: (ms) => { time += ms; } };
}

test('undo and redo step through snapshots', () => {
  const { history, advance } = setup();
  history.record('B');
  advance(5000);
  history.record('C');
  assert.equal(history.undo(), 'B');
  assert.equal(history.undo(), 'A');
  assert.equal(history.undo(), null);
  assert.equal(history.redo(), 'B');
  assert.equal(history.redo(), 'C');
  assert.equal(history.redo(), null);
});

test('a new change clears redo', () => {
  const { history } = setup();
  history.record('B');
  history.undo();
  assert.equal(history.canRedo(), true);
  history.record('X');
  assert.equal(history.canRedo(), false);
});

test('typing in one field quickly becomes one undo step', () => {
  const { history, advance } = setup();
  history.record('T', 'title');
  advance(300);
  history.record('Ti', 'title');
  advance(300);
  history.record('Tit', 'title');
  assert.equal(history.undo(), 'A');
  assert.equal(history.canUndo(), false);
});

test('a pause, or a different field, starts a new step', () => {
  const { history, advance } = setup();
  history.record('T', 'title');
  advance(2000);
  history.record('Ti', 'title');
  advance(100);
  history.record('Ti+date', 'term-start');
  assert.equal(history.undo(), 'Ti');
  assert.equal(history.undo(), 'T');
  assert.equal(history.undo(), 'A');
});

test('recording an unchanged snapshot does nothing', () => {
  const { history } = setup();
  assert.equal(history.record('A'), false);
  assert.equal(history.canUndo(), false);
});

test('history is capped at the limit', () => {
  const history = createHistory({ limit: 3 });
  history.reset('0');
  for (let i = 1; i <= 5; i++) history.record(String(i));
  assert.equal(history.undo(), '4');
  assert.equal(history.undo(), '3');
  assert.equal(history.undo(), '2');
  assert.equal(history.undo(), null);
});
