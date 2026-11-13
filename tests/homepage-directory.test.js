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

function extractFunction(name) {
  const functionStart = html.indexOf(`function ${name}(`);
  assert.ok(functionStart >= 0, `${name} should exist`);
  const functionBrace = html.indexOf('{', functionStart);
  let functionDepth = 0;
  for (let i = functionBrace; i < html.length; i++) {
    if (html[i] === '{') functionDepth++;
    if (html[i] === '}') {
      functionDepth--;
      if (functionDepth === 0) return html.slice(functionStart, i + 1);
    }
  }
  assert.fail(`${name} should have a closing brace`);
}

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

test('directory filtering hides non-matching cards and exposes the no-results state', () => {
  const cards = [
    { innerText: 'T-Test', dataset: { searchTerms: 'paired repeated', category: 'statistics' }, style: {}, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } },
    { innerText: 'Molarity', dataset: { searchTerms: 'concentration solution', category: 'lab' }, style: {}, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } }
  ];
  const search = { value: 'paired' };
  const category = { value: 'all' };
  const count = { innerText: '' };
  const emptyState = { classList: { hidden: true, toggle(name, force) { this.hidden = force; } } };
  const elements = { 'calculator-search': search, 'calculator-category': category, 'calculator-results-count': count, 'calculator-no-results': emptyState };
  const context = {
    document: {
      getElementById: (id) => elements[id],
      querySelectorAll: () => cards
    }
  };
  vm.runInNewContext(`${extractFunction('calculatorCardMatches')}\n${extractFunction('filterCalculatorDirectory')}\nfilterCalculatorDirectory();`, context);

  assert.equal(cards[0].style.display, '');
  assert.equal(cards[0].attributes['aria-hidden'], 'false');
  assert.equal(cards[1].style.display, 'none');
  assert.equal(cards[1].attributes['aria-hidden'], 'true');
  assert.equal(count.innerText, 'Showing 1 of 2 calculators');
  assert.equal(emptyState.classList.hidden, true);

  search.value = 'no matching tool';
  vm.runInNewContext('filterCalculatorDirectory();', context);
  assert.equal(cards[0].style.display, 'none');
  assert.equal(cards[1].style.display, 'none');
  assert.equal(count.innerText, 'Showing 0 of 2 calculators');
  assert.equal(emptyState.classList.hidden, false);
});
