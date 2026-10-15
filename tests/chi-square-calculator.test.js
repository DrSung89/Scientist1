const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('chi-square-calculator/index.html', 'utf8');
const start = html.indexOf('function chiSquarePValue(x, df) {');
const end = html.indexOf('\n        function calcChi()', start);
const formatStart = html.indexOf('function formatChiSquarePValue(p) {');
const formatEnd = html.indexOf('\n        function calcChi()', formatStart);
assert.ok(start >= 0 && end > start, 'chi-square p-value function should exist in the calculator page');
assert.ok(formatStart >= 0 && formatEnd > formatStart, 'chi-square p-value formatter should exist in the calculator page');

const source = html.slice(start, formatStart) + html.slice(formatStart, formatEnd);
const sandbox = {};
vm.runInNewContext(`${source}\nglobalThis.chiSquarePValue = chiSquarePValue;\nglobalThis.formatChiSquarePValue = formatChiSquarePValue;`, sandbox);
const chiSquarePValue = sandbox.chiSquarePValue;
const formatChiSquarePValue = sandbox.formatChiSquarePValue;

test('df=1 chi-square survival function matches reference values', () => {
  const cases = [
    [0, 1],
    [3.841458820694124, 0.05],
    [10.827566170662733, 0.001],
    [30, 4.320463e-8],
    [100, 1.5239706e-23],
  ];

  for (const [statistic, expected] of cases) {
    const actual = chiSquarePValue(statistic, 1);
    assert.ok(Number.isFinite(actual), `p-value should be finite for chi-square=${statistic}`);
    assert.ok(Math.abs(actual - expected) <= Math.max(expected * 0.002, 1e-14),
      `chi-square=${statistic}: expected about ${expected}, got ${actual}`);
  }
});

test('rejects unsupported degrees of freedom and invalid statistics', () => {
  assert.ok(Number.isNaN(chiSquarePValue(1, 2)));
  assert.ok(Number.isNaN(chiSquarePValue(-1, 1)));
  assert.ok(Number.isNaN(chiSquarePValue(Number.NaN, 1)));
});


test('very small chi-square p-values are displayed as a threshold, not zero', () => {
  assert.equal(formatChiSquarePValue(0.000001), '<0.00001');
  assert.equal(formatChiSquarePValue(0), '<0.00001');
  assert.equal(formatChiSquarePValue(0.00001), '0.00001');
  assert.equal(formatChiSquarePValue(0.05), '0.05000');
});

test('invalid chi-square p-values are not displayed as valid results', () => {
  assert.equal(formatChiSquarePValue(Number.NaN), 'Not available');
  assert.equal(formatChiSquarePValue(-0.1), 'Not available');
  assert.equal(formatChiSquarePValue(1.1), 'Not available');
});


test('clearChiSquareResults clears stale results before a new calculation', () => {
  const start = html.indexOf('function clearChiSquareResults() {');
  const end = html.indexOf('function calcChi()', start);
  assert.ok(start >= 0 && end > start, 'result-reset helper should exist before calcChi');

  const elements = {};
  const ids = ['result-area', 'warning-msg', 'exp-a', 'exp-b', 'exp-c', 'exp-d', 'p-val', 'sig-msg', 'chi-stat', 'cramers-v'];
  for (const id of ids) {
    elements[id] = { innerText: 'stale result', style: { display: 'block' } };
  }
  const sandbox = { document: { getElementById: (id) => elements[id] } };
  vm.runInNewContext(`${html.slice(start, end)}\nglobalThis.clearChiSquareResults = clearChiSquareResults;`, sandbox);
  sandbox.clearChiSquareResults();

  assert.equal(elements['result-area'].style.display, 'none');
  assert.equal(elements['warning-msg'].style.display, 'none');
  for (const id of ['exp-a', 'exp-b', 'exp-c', 'exp-d']) {
    assert.equal(elements[id].innerText, 'Exp: -');
  }
  for (const id of ['p-val', 'sig-msg', 'chi-stat', 'cramers-v']) {
    assert.equal(elements[id].innerText, '');
  }
});
