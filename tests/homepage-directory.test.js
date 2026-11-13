const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function calculatorCardMatches(card, query, category) {');
assert.ok(start >= 0, 'calculator directory matching helper should exist');
const brace = html.indexOf('{', start);
let depth = 0;
let end = -1;
for (let i = brace; i < html.length; i++) {
  if (html[i] === '{') depth++;
  if (html[i] === '}') {
    depth--;
    if (depth === 0) { end = i + 1; break; }
  }
}
assert.ok(end > start, 'calculator directory matching helper should be complete');
const sandbox = {};
vm.runInNewContext(`${html.slice(start, end)}\nglobalThis.calculatorCardMatches = calculatorCardMatches;`, sandbox);

test('calculator directory search ignores case and surrounding whitespace', () => {
  const card = { title: 'T-Test', searchTerms: 'paired repeated measurements', category: 'statistics' };
  assert.equal(sandbox.calculatorCardMatches(card, '  PAIRED  ', 'all'), true);
  assert.equal(sandbox.calculatorCardMatches(card, 'molarity', 'all'), false);
});

test('calculator category filters preserve each tool in its intended group', () => {
  const cards = [
    { title: 'Protein', searchTerms: 'western blot', category: 'lab' },
    { title: 'Molarity', searchTerms: 'concentration', category: 'lab' },
    { title: 'Dilution', searchTerms: 'stock solution', category: 'lab' },
    { title: 'T-Test', searchTerms: 'paired', category: 'statistics' },
    { title: 'Chi-Square', searchTerms: 'fisher', category: 'statistics' },
    { title: 'Human Equivalent Dose', searchTerms: 'animal dose', category: 'dosing' }
  ];
  assert.equal(cards.filter(card => sandbox.calculatorCardMatches(card, '', 'lab')).length, 3);
  assert.equal(cards.filter(card => sandbox.calculatorCardMatches(card, '', 'statistics')).length, 2);
  assert.equal(cards.filter(card => sandbox.calculatorCardMatches(card, 'animal', 'dosing')).length, 1);
});

test('homepage directory includes all eight calculators, accessible filters, and empty-state feedback', () => {
  assert.equal((html.match(/\sdata-calculator-card\sdata-category=/g) || []).length, 8);
  for (const category of ['all', 'lab', 'statistics', 'dosing']) {
    assert.match(html, new RegExp(`<option value="${category}"`));
  }
  assert.match(html, /aria-label="Search calculators"/);
  assert.match(html, /calculator-no-results/);
  assert.match(html, /Browse Calculators/);
  assert.match(html, /calculator-directory/);
});
