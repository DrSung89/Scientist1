const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('one-way-anova-calculator/index.html', 'utf8');

function logGamma(z) {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < coefficients.length; i++) x += coefficients[i] / (z + i + 1);
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaFraction(a, b, x) {
  let c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-300) d = 1e-300;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c; h *= delta;
    if (Math.abs(delta - 1) < 3e-14) break;
  }
  return h;
}

function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const factor = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  if (x < (a + 1) / (a + b + 2)) return factor * betaFraction(a, b, x) / a;
  return 1 - factor * betaFraction(b, a, 1 - x) / b;
}

function fCdf(f, df1, df2) {
  return regularizedBeta((df1 * f) / (df1 * f + df2), df1 / 2, df2 / 2);
}

function tCdf(t, df) {
  if (t === 0) return 0.5;
  const tail = 0.5 * regularizedBeta(df / (df + t * t), df / 2, 0.5);
  return t < 0 ? tail : 1 - tail;
}

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} should be defined`);
  const brace = html.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  assert.fail(`${name} should have a closing brace`);
}

const sandbox = {
  Math,
  jStat: {
    centralF: { cdf: fCdf },
    studentt: {
      cdf: tCdf,
      inv: (p, df) => {
        let low = -100, high = 100;
        for (let i = 0; i < 100; i++) {
          const mid = (low + high) / 2;
          if (tCdf(mid, df) < p) low = mid; else high = mid;
        }
        return (low + high) / 2;
      }
    }
  }
};
for (const name of ['summarizeGroups', 'calculateStandardAnova', 'calculateWelchAnova', 'twoSidedWelchPValue', 'calculatePairwiseWelch']) {
  vm.runInNewContext(`${extractFunction(name)}\nglobalThis.result = ${name};`, sandbox);
  sandbox[name] = sandbox.result;
}

test('standard one-way ANOVA reproduces SciPy reference data and reports effect sizes', () => {
  const groups = [
    [0.0571, 0.0813, 0.0831, 0.0976, 0.0817, 0.0859, 0.0735, 0.0659, 0.0923, 0.0836],
    [0.0873, 0.0662, 0.0672, 0.0819, 0.0749, 0.0649, 0.0835, 0.0725],
    [0.0974, 0.1352, 0.0817, 0.1016, 0.0968, 0.1064, 0.105],
    [0.1033, 0.0915, 0.0781, 0.0685, 0.0677, 0.0697, 0.0764, 0.0689],
    [0.0703, 0.1026, 0.0956, 0.0973, 0.1039, 0.1045]
  ].map((values, index) => ({ name: `Group ${String.fromCharCode(65 + index)}`, values }));
  const result = sandbox.calculateStandardAnova(sandbox.summarizeGroups(groups));
  assert.ok(Math.abs(result.statistic - 7.121019471642447) < 1e-12);
  assert.ok(Math.abs(result.pValue - 0.0002812242314534544) < 1e-12);
  assert.ok(result.etaSquared > 0 && result.etaSquared < 1);
  assert.ok(result.omegaSquared > 0 && result.omegaSquared < result.etaSquared);
  assert.equal(result.table.dfTotal, 38);
});

test('Welch ANOVA uses variance weights and refuses groups without estimable variance', () => {
  const summaries = sandbox.summarizeGroups([
    { name: 'A', values: [2, 4, 5, 7] },
    { name: 'B', values: [1, 2, 3, 4, 5, 6] },
    { name: 'C', values: [6, 8, 10, 12, 14] }
  ]);
  const result = sandbox.calculateWelchAnova(summaries);
  assert.ok(Number.isFinite(result.statistic) && result.statistic > 0);
  assert.equal(result.df1, 2);
  assert.ok(Number.isFinite(result.df2) && result.df2 > 0);
  assert.ok(result.pValue >= 0 && result.pValue <= 1);
  assert.equal(sandbox.calculateWelchAnova(sandbox.summarizeGroups([
    { name: 'A', values: [1, 1, 1] }, { name: 'B', values: [2, 3, 4] }
  ])), null);
});

test('pairwise Welch comparisons report signed differences and family-wise adjusted p-values', () => {
  const summaries = sandbox.summarizeGroups([
    { name: 'A', values: [1, 2, 3, 4] },
    { name: 'B', values: [4, 5, 6, 7] },
    { name: 'C', values: [7, 8, 9, 10] }
  ]);
  const pairs = sandbox.calculatePairwiseWelch(summaries);
  assert.equal(pairs.length, 3);
  assert.equal(pairs[0].a, 'A');
  assert.equal(pairs[0].b, 'B');
  assert.equal(pairs[0].difference, -3);
  assert.ok(pairs.every((pair) => pair.pAdjusted >= 0 && pair.pAdjusted <= 1));
  assert.ok(pairs.every((pair) => pair.ciLow < pair.difference && pair.ciHigh > pair.difference));
  assert.ok(pairs.every((pair) => pair.pAdjusted >= Math.min(1, 2 * sandbox.twoSidedWelchPValue(pair.difference / Math.sqrt(2 * 1.6666666666666667 / 4), pair.df))));
  const pairCount = summaries.length * (summaries.length - 1) / 2;
  const expectedMargin = Math.abs(sandbox.jStat.studentt.inv(1 - 0.05 / (2 * pairCount), pairs[0].df)) * Math.sqrt(2 * 1.6666666666666667 / 4);
  assert.ok(Math.abs((pairs[0].ciHigh - pairs[0].difference) - expectedMargin) < 1e-10);
});

test('ANOVA page documents assumptions, exposes method selection, and provides dynamic groups', () => {
  assert.match(html, /Welch ANOVA/);
  assert.match(html, /Standard one-way ANOVA/);
  assert.match(html, /Bonferroni/);
  assert.match(html, /independent observations/);
  assert.match(html, /MAX_GROUPS = 8/);
  assert.match(html, /aria-live="polite"/);
});

test('adding a group preserves values already entered in existing groups', () => {
  class Element {
    constructor(tagName) { this.tagName = tagName; this.children = []; this.dataset = {}; this.value = ''; }
    append(...children) { this.children.push(...children); }
    setAttribute() {}
    set innerHTML(value) { if (value === '') this.children = []; }
    querySelectorAll(selector) {
      if (selector !== 'textarea') return [];
      return this.children.flatMap((child) => child.children.filter((node) => node.tagName === 'textarea'));
    }
  }
  const container = new Element('div');
  const addButton = { disabled: false };
  const context = {
    String,
    document: {
      getElementById: (id) => id === 'groups' ? container : addButton,
      createElement: (tagName) => new Element(tagName)
    },
    groupCount: 3,
    MAX_GROUPS: 8
  };
  vm.runInNewContext(`${extractFunction('renderGroupInputs')}\nglobalThis.renderGroupInputs = renderGroupInputs;`, context);
  context.renderGroupInputs();
  container.children[0].children[1].value = '1, 2, 3';
  context.groupCount = 4;
  context.renderGroupInputs();
  assert.equal(container.children.length, 4);
  assert.equal(container.children[0].children[1].value, '1, 2, 3');
  assert.equal(addButton.disabled, false);
});
