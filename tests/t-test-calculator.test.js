const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('t-test-calculator/index.html', 'utf8');

function logGamma(z) {
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < coefficients.length; i++) x += coefficients[i] / (z + i + 1);
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaContinuedFraction(a, b, x) {
  const maxIterations = 300;
  const epsilon = 3e-14;
  const tiny = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return h;
}

function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const factor = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) +
    a * Math.log(x) + b * Math.log1p(-x)
  );
  if (x < (a + 1) / (a + b + 2)) {
    return factor * betaContinuedFraction(a, b, x) / a;
  }
  return 1 - factor * betaContinuedFraction(b, a, 1 - x) / b;
}

function referenceStudentTCdf(t, df) {
  if (t === 0) return 0.5;
  const x = df / (df + t * t);
  const tail = 0.5 * regularizedBeta(x, df / 2, 0.5);
  return t < 0 ? tail : 1 - tail;
}

function referenceFCdf(f, df1, df2) {
  if (f <= 0) return 0;
  return regularizedBeta((df1 * f) / (df1 * f + df2), df1 / 2, df2 / 2);
}

function extractFunction(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, name + ' should be defined');
  const brace = html.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}') {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  assert.fail(name + ' should have a closing brace');
}

const sandbox = {
  Math,
  jStat: {
    studentt: { cdf: (x, df) => referenceStudentTCdf(x, df) },
    centralF: { cdf: (f, df1, df2) => referenceFCdf(f, df1, df2) }
  }
};
for (const name of [
  'twoSidedStudentTPValue',
  'twoSidedFTestPValue',
  'calculateFTestDiagnostic',
  'formatPValue',
  'formatSignificantPValue',
  'calculateCohensD'
]) {
  vm.runInNewContext(extractFunction(name) + '\nglobalThis.__helper = ' + name + ';', sandbox);
  sandbox[name] = sandbox.__helper;
}

const pairedSandbox = {
  getMean: (values) => values.reduce((sum, value) => sum + value, 0) / values.length,
  getVariance: (values, mean) => values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1),
  twoSidedStudentTPValue: sandbox.twoSidedStudentTPValue,
  jStat: { studentt: { inv: (p, df) => (p === 0.025 && df === 4 ? -2.7764451051977987 : NaN) } }
};
vm.runInNewContext(extractFunction('calculatePairedTTest') + '\nglobalThis.calculatePairedTTest = calculatePairedTTest;', pairedSandbox);

const oneSampleSandbox = {
  Math,
  getMean: (values) => values.reduce((sum, value) => sum + value, 0) / values.length,
  getVariance: (values, mean) => values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1),
  twoSidedStudentTPValue: sandbox.twoSidedStudentTPValue,
  jStat: { studentt: { inv: (p, df) => (p === 0.025 && df === 4 ? -2.7764451051977987 : NaN) } }
};
vm.runInNewContext(extractFunction('calculateOneSampleTTest') + '\nglobalThis.calculateOneSampleTTest = calculateOneSampleTTest;', oneSampleSandbox);

test('Student t two-sided p-values retain small-tail precision', () => {
  const actual = sandbox.twoSidedStudentTPValue(10, 10);
  const expected = regularizedBeta(10 / 110, 5, 0.5);
  assert.ok(actual > 0, 'small p-value must not underflow to zero');
  assert.ok(Math.abs(actual - expected) < 1e-12, 'expected ' + expected + ', got ' + actual);
  assert.ok(Math.abs(sandbox.twoSidedStudentTPValue(-10, 10) - expected) < 1e-12);
  assert.equal(sandbox.twoSidedStudentTPValue(0, 10), 1);
});

test('F-test reciprocal-tail calculation agrees with an independent upper-tail identity', () => {
  const f = 10, df1 = 5, df2 = 8;
  const actual = sandbox.twoSidedFTestPValue(f, df1, df2);
  const expected = 2 * regularizedBeta(df2 / (df2 + df1 * f), df2 / 2, df1 / 2);
  assert.ok(Math.abs(actual - expected) < 1e-12, 'expected ' + expected + ', got ' + actual);
  assert.ok(sandbox.twoSidedFTestPValue(1e6, df1, df2) > 0);
  const atOneExpected = Math.min(1, 2 * regularizedBeta(df2 / (df2 + df1), df2 / 2, df1 / 2));
  assert.ok(Math.abs(sandbox.twoSidedFTestPValue(1, df1, df2) - atOneExpected) < 1e-12);
});

test('very small p-values display as a threshold, not 0.0000', () => {
  assert.equal(sandbox.formatPValue(0.000001), '<0.0001');
  assert.equal(sandbox.formatSignificantPValue(0.000001), '<span style="color:#ba1a1a"><0.0001 *</span>');
  assert.equal(sandbox.formatSignificantPValue(0.02), '<span style="color:#ba1a1a">0.0200 *</span>');
  assert.equal(sandbox.formatSignificantPValue(0.2), '0.2000');
});

test('signed Cohen d preserves Group A minus Group B direction', () => {
  assert.equal(sandbox.calculateCohensD(4, 4), 2);
  assert.equal(sandbox.calculateCohensD(-4, 4), -2);
  assert.match(html, /Prefer Welch's test as the default/);
  assert.match(html, /choosing Student's or Welch's test based on a preliminary variance test can distort the overall error rate/);
});

test('paired t-test matches reference statistics and confidence interval', () => {
  const result = pairedSandbox.calculatePairedTTest([1, 2, 3, 4, 5], [0, 1, 1, 2, 2]);
  const expectedT = 1.8 / Math.sqrt(0.7 / 5);
  const expectedP = regularizedBeta(4 / (4 + expectedT ** 2), 2, 0.5);
  assert.equal(result.n, 5);
  assert.equal(result.df, 4);
  assert.ok(Math.abs(result.meanDifference - 1.8) < 1e-12);
  assert.ok(Math.abs(result.t - expectedT) < 1e-12);
  assert.ok(Math.abs(result.pValue - expectedP) < 1e-12);
  assert.ok(Math.abs(result.ciLow - 0.7611493663164304) < 1e-12);
  assert.ok(Math.abs(result.ciHigh - 2.8388506336835695) < 1e-12);
  assert.ok(Math.abs(result.cohensDz - 2.1514114968019085) < 1e-12);
});

test('paired t-test rejects unequal pair counts and zero-variance differences', () => {
  assert.equal(pairedSandbox.calculatePairedTTest([1, 2, 3], [1, 2]), null);
  assert.equal(pairedSandbox.calculatePairedTTest([1, 2, 3], [0, 1, 2]), null);
  assert.equal(pairedSandbox.calculatePairedTTest([1], [0]), null);
});

test('one-sample t-test matches reference statistic, p-value, mean CI, and signed d', () => {
  const result = oneSampleSandbox.calculateOneSampleTTest([2, 3, 4, 5, 6], 2);
  const expectedT = 2 / Math.sqrt(0.5);
  const expectedP = regularizedBeta(4 / (4 + expectedT ** 2), 2, 0.5);
  assert.equal(result.n, 5);
  assert.equal(result.df, 4);
  assert.equal(result.mean, 4);
  assert.ok(Math.abs(result.t - expectedT) < 1e-12);
  assert.ok(Math.abs(result.pValue - expectedP) < 1e-12);
  assert.ok(Math.abs(result.ciLow - 2.036756838522439) < 1e-12);
  assert.ok(Math.abs(result.ciHigh - 5.9632431614775605) < 1e-12);
  assert.ok(Math.abs(result.cohensD - (2 / Math.sqrt(2.5))) < 1e-12);
});

test('one-sample t-test rejects inadequate or zero-variance samples and invalid reference means', () => {
  assert.equal(oneSampleSandbox.calculateOneSampleTTest([2], 0), null);
  assert.equal(oneSampleSandbox.calculateOneSampleTTest([2, 2, 2], 0), null);
  assert.equal(oneSampleSandbox.calculateOneSampleTTest([1, NaN, 3], 0), null);
  assert.equal(oneSampleSandbox.calculateOneSampleTTest([1, 2, 3], Infinity), null);
});

test('one-sample analysis renders only its result and ignores the unused Group B field', () => {
  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, { value: '', innerText: '', innerHTML: '', style: { display: '' } });
    return elements.get(id);
  };
  getElementById('group-a').value = '2, 3, 4, 5, 6';
  getElementById('group-b').value = 'not used';
  getElementById('reference-mean').value = '2';
  getElementById('analysis-type').value = 'one-sample';
  const alerts = [];
  const context = {
    Math, document: { getElementById }, alert: (message) => alerts.push(message),
    jStat: { studentt: { cdf: (value, df) => referenceStudentTCdf(value, df), inv: () => -2.7764451051977987 } }
  };
  const declarations = [
    'const getMean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;',
    'const getVariance = (arr, mean) => arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1);',
    extractFunction('twoSidedStudentTPValue'), extractFunction('formatPValue'),
    extractFunction('formatSignificantPValue'), extractFunction('calculateOneSampleTTest'),
    extractFunction('clearTTestResults'), extractFunction('runAnalysis')
  ].join('\n');
  vm.runInNewContext(declarations + '\nrunAnalysis();', context);
  assert.equal(alerts.length, 0);
  assert.equal(getElementById('summary-label-a').innerText, 'Sample');
  assert.equal(getElementById('row-one-sample').style.display, 'table-row');
  assert.equal(getElementById('row-paired').style.display, 'none');
  assert.equal(getElementById('row-welch').style.display, 'none');
  assert.equal(getElementById('f-test-box').style.display, 'none');
  assert.equal(getElementById('t-one-sample').innerText, '2.828');
  assert.equal(getElementById('df-one-sample').innerText, '4.0');
  assert.equal(getElementById('mean-diff').innerText, '2.000');
  assert.equal(getElementById('effect-size').innerText, '1.265');
  assert.equal(getElementById('result-area').style.display, 'block');
});

test('paired mode UI explains matching order and distinguishes Cohen dz', () => {
  assert.match(html, /Paired \/ repeated measurements/);
  assert.match(html, /same position in both lists/);
  assert.match(html, /signed Cohen's dz/);
  assert.match(html, /Pairing must come from the study design/);
});

test('paired analysis displays only its result and skips the independent-samples F-test', () => {
  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, { value: '', innerText: '', innerHTML: '', style: { display: '' } });
    return elements.get(id);
  };
  getElementById('group-a').value = '1, 2, 3, 4, 5';
  getElementById('group-b').value = '0, 1, 1, 2, 2';
  getElementById('analysis-type').value = 'paired';
  const alerts = [];
  const context = {
    Math,
    document: { getElementById },
    alert: (message) => alerts.push(message),
    jStat: { studentt: { cdf: (value, df) => referenceStudentTCdf(value, df), inv: () => -2.7764451051977987 } }
  };
  const functions = [
    'getMean', 'getVariance', 'twoSidedStudentTPValue', 'formatPValue', 'formatSignificantPValue',
    'calculatePairedTTest', 'clearTTestResults', 'runAnalysis'
  ];
  const declarations = functions.map((name) => name === 'getMean'
    ? 'const getMean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;'
    : name === 'getVariance'
      ? 'const getVariance = (arr, mean) => arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1);'
      : extractFunction(name)).join('\n');
  vm.runInNewContext(declarations + '\nrunAnalysis();', context);
  assert.equal(alerts.length, 0);
  assert.equal(getElementById('row-paired').style.display, 'table-row');
  assert.equal(getElementById('row-student').style.display, 'none');
  assert.equal(getElementById('row-welch').style.display, 'none');
  assert.equal(getElementById('f-test-box').style.display, 'none');
  assert.equal(getElementById('t-paired').innerText, '4.811');
  assert.equal(getElementById('df-paired').innerText, '4.0');
  assert.equal(getElementById('mean-diff').innerText, '1.800');
  assert.equal(getElementById('effect-size').innerText, '2.151');
  assert.equal(getElementById('result-area').style.display, 'block');
});

test('paired analysis rejects a mismatched number of observations', () => {
  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, { value: '', innerText: '', innerHTML: '', style: { display: '' } });
    return elements.get(id);
  };
  getElementById('group-a').value = '1, 2, 3';
  getElementById('group-b').value = '1, 2';
  getElementById('analysis-type').value = 'paired';
  const alerts = [];
  const context = { Math, document: { getElementById }, alert: (message) => alerts.push(message), jStat: {} };
  vm.runInNewContext(`${extractFunction('clearTTestResults')}\n${extractFunction('runAnalysis')}\nrunAnalysis();`, context);
  assert.match(alerts[0], /same number of observations/);
  assert.equal(getElementById('result-area').style.display, 'none');
});


test('F-test diagnostic is unavailable when either group has zero variance', () => {
  assert.equal(sandbox.calculateFTestDiagnostic(0, 4, 3, 3), null);
  assert.equal(sandbox.calculateFTestDiagnostic(4, 0, 3, 3), null);
  assert.equal(sandbox.calculateFTestDiagnostic(0, 0, 3, 3), null);
});

test('F-test diagnostic returns valid statistics for two positive variances', () => {
  const result = sandbox.calculateFTestDiagnostic(4, 1, 6, 8);
  assert.equal(result.f, 4);
  assert.equal(result.df1, 5);
  assert.equal(result.df2, 7);
  assert.ok(result.pValue > 0 && result.pValue <= 1);
});


test('new t-test analysis hides stale results before validation', () => {
  const start = html.indexOf('function clearTTestResults() {');
  const end = html.indexOf('function runAnalysis()', start);
  assert.ok(start >= 0 && end > start, 'result-reset helper should be defined before runAnalysis');

  const resultArea = { style: { display: 'block' } };
  const sandbox = {
    document: {
      getElementById(id) {
        return id === 'result-area' ? resultArea : null;
      }
    }
  };
  vm.runInNewContext(extractFunction('clearTTestResults') + '\nglobalThis.clearTTestResults = clearTTestResults;', sandbox);
  sandbox.clearTTestResults();
  assert.equal(resultArea.style.display, 'none');

  const runAnalysisStart = html.indexOf('function runAnalysis() {');
  const runAnalysisBody = html.slice(runAnalysisStart, runAnalysisStart + 180);
  assert.match(runAnalysisBody, /clearTTestResults\(\);/, 'runAnalysis must clear old results before validation');
});
