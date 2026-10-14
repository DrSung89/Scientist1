const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/main.js', 'utf8');

function runCalculator(buttonId, initialValues) {
  let onReady;
  let onClick;
  const elements = {};
  for (const [id, value] of Object.entries(initialValues)) {
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
  elements[buttonId] ??= {
    addEventListener(event, callback) {
      if (event === 'click') onClick = callback;
    }
  };

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

  const sandbox = {
    document, console, Math, Number, String, Array, Object, JSON,
    parseFloat, isFinite
  };
  vm.runInNewContext(source, sandbox, { timeout: 1000 });
  assert.equal(typeof onReady, 'function', 'page initialization should register');
  onReady();
  assert.equal(typeof onClick, 'function', buttonId + ' should register a click handler');
  onClick();
  return elements;
}

function molarity(values) {
  return runCalculator('calculate-molarity', {
    'calculate-molarity': null,
    mass: null, 'mass-unit': 'g',
    concentration: null, 'conc-unit': 'mM',
    volume: null, 'vol-unit': 'mL',
    mw: 180,
    'molarity-result': null,
    ...values
  })['molarity-result'].innerHTML;
}

function dilution(values) {
  return runCalculator('calculate-dilution', {
    'calculate-dilution': null,
    m1: null, 'm1-unit': 'M',
    v1: null, 'v1-unit': 'mL',
    m2: null, 'm2-unit': 'mM',
    v2: null, 'v2-unit': 'mL',
    'dilution-result': null,
    ...values
  })['dilution-result'].innerHTML;
}

test('molarity calculator computes concentration from mass and volume', () => {
  assert.match(molarity({ mass: 0.018, volume: 100 }), /1\.000 mM/);
});

test('molarity calculator computes required mass with unit conversion', () => {
  assert.match(molarity({ mass: null, volume: 100, concentration: 10 }), /0\.180 g/);
});

test('molarity calculator computes required volume', () => {
  assert.match(molarity({ mass: 0.18, volume: null, concentration: 10 }), /100\.000 mL/);
});

test('molarity calculator rejects non-positive molecular weight and invalid known values', () => {
  assert.match(molarity({ mw: 0, mass: 1, volume: 10 }), /molecular weight greater than zero/i);
  assert.match(molarity({ mass: 0, volume: 10 }), /greater than zero/i);
  assert.match(molarity({ mass: 1, volume: 10, concentration: 2 }), /exactly two/i);
});

test('dilution calculator computes stock volume and solvent volume', () => {
  assert.match(dilution({ m1: 1, v1: null, m2: 10, v2: 100 }), /Stock Vol: <strong>1\.000 mL<\/strong>/);
  assert.match(dilution({ m1: 1, v1: null, m2: 10, v2: 100 }), /99\.000 mL Solvent/);
});

test('dilution calculator solves each of the other unknown variables', () => {
  assert.match(dilution({ m1: null, v1: 10, m2: 10, v2: 100 }), /100\.000 mM/);
  assert.match(dilution({ m1: 1, v1: 1, m2: null, v2: 100 }), /10\.000 mM/);
  assert.match(dilution({ m1: 1, v1: 1, m2: 10, v2: null }), /100\.000 mL/);
});

test('dilution calculator rejects invalid inputs and impossible dilution volumes', () => {
  assert.match(dilution({ m1: 1, v1: 1, m2: 10, v2: 100 }), /exactly three/i);
  assert.match(dilution({ m1: 1, v1: 0, m2: 10, v2: null }), /greater than zero/i);
  assert.match(dilution({ m1: 1, v1: null, m2: 2000, v2: 10 }), /exceeds the final volume/i);
});

test('dilution calculator formats nanomolar results without losing the unit scale', () => {
  assert.match(dilution({ m1: 0.001, 'm1-unit': 'mM', v1: 1, m2: null, 'm2-unit': 'nM', v2: 1000 }), /1\.000 nM/);
});
