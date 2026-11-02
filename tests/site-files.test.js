'use strict';

/*
 * Checks that every stylesheet and script index.html loads exists, and that
 * every UI module app.js starts has a script tag. Catches a file that was
 * added or renamed but not uploaded or not linked.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const localRefs = [...html.matchAll(/(?:src|href)="((?:css|js)\/[^"]+)"/g)].map((m) => m[1]);

test('every local file index.html loads exists', () => {
  assert.ok(localRefs.length > 20);
  for (const ref of localRefs) {
    assert.ok(fs.existsSync(path.join(root, ref)), `${ref} is missing`);
  }
});

test('every js file is loaded by index.html', () => {
  const jsFiles = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith('.js')) jsFiles.push(rel);
    }
  };
  walk('js');
  for (const file of jsFiles) {
    assert.ok(localRefs.includes(file), `${file} exists but index.html doesn't load it`);
  }
});

test('every module app.js starts is loaded by index.html', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const files = [...app.matchAll(/'(js\/ui\/[^']+\.js)'/g)].map((m) => m[1]);
  assert.ok(files.length >= 8);
  for (const file of files) assert.ok(localRefs.includes(file), `${file} is not in index.html`);
});
