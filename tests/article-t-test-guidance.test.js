const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const article = fs.readFileSync('articles/brain-spinal-interface-nature/index.html', 'utf8');

test('brain-spinal article describes the t-test design and variance diagnostic accurately', () => {
  assert.match(article, /Repeated gait measurements from the same animals are not independent observations/);
  assert.match(article, /does not model trial-level nesting or longitudinal correlation/);
  assert.match(article, /reports an F-test only as a diagnostic; do not use it to choose/);
  assert.doesNotMatch(article, /automatically performs an F-test to recommend either Student's or Welch's/);
});
