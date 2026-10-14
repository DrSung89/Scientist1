const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/main.js', 'utf8');

function hed(values = {}) {
  let onReady;
  let onClick;
  const defaults = {
    'calculate-hed': null,
    'species-a': 'Mouse',
    'dose-a': '10',
    'dose-a-unit': 'mpk',
    'species-b': 'Human',
    'weight-b': '',
    'weight-b-unit': 'kg',
    'hed-result': null
  };
  const elements = {};
  for (const [id, value] of Object.entries({ ...defaults, ...values })) {
    elements[id] = {
      value: value === null ? '' : String(value),
      innerHTML: '',
      style: {},
      classList: { remove() {} },
      addEventListener(event, callback) {
        if (event === 'click') onClick = callback;
      }
    };
  }

  const document = {
    addEventListener(event, callback) {
      if (event === 'DOMContentLoaded') onReady = callback;
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    }
  };

  vm.runInNewContext(source, {
    document, console, Math, Number, String, Array, Object, JSON,
    parseFloat, isFinite
  }, { timeout: 1000 });

  assert.equal(typeof onReady, 'function', 'page initialization should register');
  onReady();
  assert.equal(typeof onClick, 'function', 'HED calculator should register a click handler');
  onClick();
  return elements['hed-result'].innerHTML;
}

test('HED uses the Km ratio for a standard mouse-to-human conversion', () => {
  const result = hed();
  assert.match(result, /Equivalent Dose: <strong[^>]*>0\.8108 mg\/kg<\/strong>/);
  assert.match(result, /Absolute Dose[\s\S]*?48\.6486 mg<\/strong>/);
});

test('HED converts an absolute source dose to mg/kg using the source species standard weight', () => {
  const result = hed({
    'dose-a': '0.2',
    'dose-a-unit': 'mg'
  });
  assert.match(result, /0\.2mg parsed as <strong>10\.00 mg\/kg<\/strong>/);
  assert.match(result, /Equivalent Dose: <strong[^>]*>0\.8108 mg\/kg<\/strong>/);
});

test('HED applies a custom target body weight entered in grams', () => {
  const result = hed({
    'species-b': 'Rat',
    'weight-b': '250',
    'weight-b-unit': 'g'
  });
  assert.match(result, /Equivalent Dose: <strong[^>]*>5\.0000 mg\/kg<\/strong>/);
  assert.match(result, /Absolute Dose[\s\S]*?Custom 0\.25kg[\s\S]*?1\.2500 mg<\/strong>/);
});

test('HED uses the target species standard weight when custom weight is blank', () => {
  const result = hed({ 'species-b': 'Rat' });
  assert.match(result, /Absolute Dose[\s\S]*?Standard 0\.15kg[\s\S]*?0\.7500 mg<\/strong>/);
});

test('HED rejects non-positive doses and non-positive custom target weights', () => {
  assert.match(hed({ 'dose-a': '0' }), /dose greater than zero/i);
  assert.match(hed({ 'dose-a': '-1' }), /dose greater than zero/i);
  assert.match(hed({ 'weight-b': '0' }), /body weight must be greater than zero/i);
});
