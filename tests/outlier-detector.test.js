const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/main.js', 'utf8');

function runOutlierCalculator(values, jStat) {
  let onReady;
  let onClick;
  const input = { value: values.join(',') };
  const result = { innerHTML: '', style: {} };
  const button = { addEventListener: (event, callback) => {
    if (event === 'click') onClick = callback;
  } };
  const elements = { 'check-outliers': button, 'outlier-data': input, 'outlier-result': result };
  const document = {
    addEventListener: (event, callback) => { if (event === 'DOMContentLoaded') onReady = callback; },
    getElementById: (id) => elements[id] || null,
    querySelector: () => null,
  };
  const sandbox = { document, console, Math, Number, String, Array, Object, JSON, isFinite, parseFloat };
  if (jStat) sandbox.jStat = jStat;
  vm.runInNewContext(source, sandbox, { timeout: 1000 });
  assert.equal(typeof onReady, 'function');
  onReady();
  assert.equal(typeof onClick, 'function');
  onClick();
  return result.innerHTML;
}

test('small samples do not display a fabricated normality p-value and use IQR screening', () => {
  const html = runOutlierCalculator([1, 2, 3, 4, 5, 6, 100]);
  assert.match(html, /Normality P-value: <strong>Not assessed \(N<8\)<\/strong>/);
  assert.match(html, /Method: IQR \(1\.5×\)/);
  assert.match(html, /Small sample; IQR screening used/);
  assert.doesNotMatch(html, /Assumed Normal|Assumed Non-Normal/);
});

test('Grubbs mode flags no more than one candidate in a single run', () => {
  const jStat = { chisquare: { cdf: () => 0 }, studentt: { inv: () => 2.5 } };
  const html = runOutlierCalculator([0, 1, 2, 3, 4, 5, 6, 30], jStat);
  assert.match(html, /Method: Grubb's Test/);
  assert.match(html, /Outlier: 30/);
  assert.doesNotMatch(html, /Outlier: 0, 30|Outlier: 30, 0/);
});

test('invalid entries are rejected rather than silently ignored', () => {
  const html = runOutlierCalculator([1, 2, NaN]);
  assert.match(html, /Use only valid numbers/);
});

test('identical observations return a zero-standard-deviation warning', () => {
  const html = runOutlierCalculator([4, 4, 4, 4]);
  assert.match(html, /SD is 0/);
});
