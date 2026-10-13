const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('t-test-calculator/index.html', 'utf8');
const names = ['twoSidedStudentTPValue', 'twoSidedFTestPValue', 'formatPValue'];
const sandbox = {
  jStat: {
    studentt: { cdf: (x, df) => { sandbox.studentCall = { x, df }; return x < 0 ? 0.00002 : 0.99998; } },
    centralF: { cdf: (x, df1, df2) => { sandbox.fCall = { x, df1, df2 }; return 0.00003; } }
  }
};
for (const name of names) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} should be defined`);
  const brace = html.indexOf('{', start);
  let depth = 0, end = -1;
  for (let i = brace; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  assert.ok(end > brace, `${name} should be extractable`);
  vm.runInNewContext(`${html.slice(start, end)}; globalThis.__helper = ${name};`, sandbox);
  sandbox[name] = sandbox.__helper;
}
test('two-sided Student t p-value uses the lower tail and is bounded', () => {
  assert.equal(sandbox.twoSidedStudentTPValue(8, 12), 0.00004);
  assert.deepEqual(sandbox.studentCall, { x: -8, df: 12 });
  assert.equal(sandbox.twoSidedStudentTPValue(0, 12), 1);
});
test('two-sided F-test uses reciprocal F identity', () => {
  assert.equal(sandbox.twoSidedFTestPValue(10, 5, 8), 0.00006);
  assert.deepEqual(sandbox.fCall, { x: 0.1, df1: 8, df2: 5 });
});
test('very small p-values are not displayed as 0.0000', () => {
  assert.match(sandbox.formatPValue(0.000001), /<0\.0001/);
  assert.equal(sandbox.formatPValue(0.02), '<span style="color:#ba1a1a">0.0200 *</span>');
});
