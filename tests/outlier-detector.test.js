const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/main.js', 'utf8');
const outlierPage = fs.readFileSync('outlier-detector/index.html', 'utf8');
const homePage = fs.readFileSync('index.html', 'utf8');
const helpPage = fs.readFileSync('help/index.html', 'utf8');

function runOutlierCalculator(values, jStat, requestedMethod = 'iqr') {
  let onReady;
  let onClick;
  const input = { value: values.join(',') };
  const methodSelect = { value: requestedMethod };
  const result = { innerHTML: '', style: {} };
  const button = { addEventListener: (event, callback) => {
    if (event === 'click') onClick = callback;
  } };
  const elements = { 'check-outliers': button, 'outlier-data': input, 'outlier-method': methodSelect, 'outlier-result': result };
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
  assert.match(html, /Small sample; normality not assessed/);
  assert.doesNotMatch(html, /Assumed Normal|Assumed Non-Normal/);
});

test('Grubbs mode flags no more than one candidate in a single run', () => {
  const jStat = { chisquare: { cdf: () => 0 }, studentt: { inv: () => 2.5 } };
  const html = runOutlierCalculator([0, 1, 2, 3, 4, 5, 6, 30], jStat, 'grubbs');
  assert.match(html, /Method: Grubb's Test/);
  assert.match(html, /Outlier: 30/);
  assert.doesNotMatch(html, /Outlier: 0, 30|Outlier: 30, 0/);
});


test('D’Agostino-Pearson matches SciPy 1.17 reference for symmetric N=8 data', () => {
  const html = runOutlierCalculator([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.match(html, /Normality P-value: <strong>0\.427<\/strong>/);
  assert.match(html, /Method: IQR \(1\.5×\)/);
});

test('D’Agostino-Pearson matches SciPy 1.17 reference near alpha=0.05', () => {
  const html = runOutlierCalculator(Array.from({ length: 30 }, (_, i) => i + 1));
  assert.match(html, /Normality P-value: <strong>0\.039<\/strong>/);
  // A normality diagnostic must not automatically select Grubbs.
  assert.match(html, /Method: IQR \(1\.5×\)/);
  assert.doesNotMatch(html, /Method: Grubb's Test/);
});

test('D’Agostino-Pearson matches SciPy 1.17 reference for skewed observations', () => {
  const values = [1,1,1,1,2,2,2,3,3,3,4,4,5,5,6,7,8,9,10,12,14,16,18,21,25,30,36,43,51,60];
  const html = runOutlierCalculator(values);
  assert.match(html, /Normality P-value: <strong>0\.001<\/strong>/);
  assert.match(html, /Method: IQR \(1\.5×\)/);
});

test('Grubbs fallback does not claim a negative result beyond its validated table', () => {
  const values = Array.from({ length: 1001 }, (_, i) => i + 1);
  const html = runOutlierCalculator(values, undefined, 'grubbs');
  assert.match(html, /Critical value unavailable for this sample size/);
  assert.match(html, /Test not evaluated/);
  assert.doesNotMatch(html, /No Outliers Detected/);
});

test('invalid entries are rejected rather than silently ignored', () => {
  const html = runOutlierCalculator([1, 2, NaN]);
  assert.match(html, /Use only valid numbers/);
});

test('identical observations return a zero-standard-deviation warning', () => {
  const html = runOutlierCalculator([4, 4, 4, 4]);
  assert.match(html, /SD is 0/);
});

test('explicit IQR selection reports the exploratory screening method', () => {
  const jStat = { chisquare: { cdf: () => 0 }, studentt: { inv: () => 2.5 } };
  const html = runOutlierCalculator([0, 1, 2, 3, 4, 5, 6, 30], jStat, 'iqr');
  assert.match(html, /Method: IQR \(1\.5×\)/);
});

test('outlier UI and guidance describe the available methods without promising automatic routing', () => {
  const options = [...outlierPage.matchAll(/<option value="([^"]+)">/g)];
  assert.deepEqual(options.map(option => option[1]), ['iqr', 'grubbs']);
  assert.match(outlierPage, /IQR rule is the default exploratory screen/);
  assert.match(outlierPage, /does not select a method for you/);
  assert.match(homePage, /normality diagnostic alongside IQR screening/);
  assert.doesNotMatch(homePage, /routes to Grubb/i);
  assert.match(helpPage, /does not automatically select an outlier method/);
  assert.doesNotMatch(helpPage, /In automatic mode, .* routed to Grubbs/i);
});

test('manual Grubbs selection is available when small-sample normality is not assessed', () => {
  const html = runOutlierCalculator([1, 2, 3, 4, 5, 6, 100], undefined, 'grubbs');
  assert.match(html, /Normality P-value: <strong>Not assessed \(N<8\)<\/strong>/);
  assert.match(html, /Method: Grubb's Test/);
  assert.match(html, /Potential: 100/);
});

test('large-sample Grubbs fallback uses a conservative critical value without jStat', () => {
  const values = Array.from({ length: 200 }, (_, i) => i + 1);
  const html = runOutlierCalculator(values, undefined, 'grubbs');
  assert.match(html, /Critical G: 3\.610/);
});
