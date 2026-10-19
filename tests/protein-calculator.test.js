const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/main.js', 'utf8');

function calculate(values = {}, mode = 'std') {
  let ready;
  let click;
  const defaults = {
    'prot-mode': mode,
    'prot-std-conc': '0, 1, 2',
    'prot-std-od': '0.1, 0.3, 0.5',
    'prot-sample-od': '0.3, 0.5',
    'prot-blank-od': '0.1',
    'prot-target-mass': '10',
    'prot-total-vol': '20',
    'prot-dye-x': '5',
    'prot-replicates': '1',
    'protein-result': null,
    'calculate-protein': null
  };
  const elements = {};
  for (const [id, value] of Object.entries({ ...defaults, ...values })) {
    elements[id] = {
      value: value === null ? '' : String(value),
      innerHTML: '',
      style: {},
      disabled: false,
      classList: {
        contains() { return false; },
        remove() {}
      },
      addEventListener(event, callback) {
        if (id === 'calculate-protein' && event === 'click') click = callback;
      },
      insertAdjacentHTML(position, html) {
        this.innerHTML = position === 'afterbegin' ? html + this.innerHTML : this.innerHTML + html;
      }
    };
  }
  const modeRadio = { value: mode, checked: true, addEventListener() {} };
  const document = {
    addEventListener(event, callback) {
      if (event === 'DOMContentLoaded') ready = callback;
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(selector) {
      if (selector === 'input[name="prot-mode"]:checked') return modeRadio;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'input[name="prot-mode"]') return [modeRadio];
      return [];
    }
  };
  vm.runInNewContext(source, {
    document, console, Math, Number, String, Array, Object, JSON,
    parseFloat, isFinite, Set
  }, { timeout: 1000 });
  assert.equal(typeof ready, 'function', 'page initialization should register');
  ready();
  assert.equal(typeof click, 'function', 'protein calculator should register a click handler');
  click();
  return elements['protein-result'].innerHTML;
}

test('standard curve regression recovers a known concentration and calculates loading volumes', () => {
  const result = calculate();
  assert.match(result, /O\.D\. = 0\.2000 × Conc \+ 0\.1000/);
  assert.match(result, /R² = 1\.0000/);
  // OD 0.3 -> 1 µg/µL; 10 µg needs 10 µL, 5X dye needs 4 µL, buffer fills to 20 µL.
  assert.match(result, /<td>1\.00<\/td>/);
  assert.match(result, /10\.00/);
  assert.match(result, /6\.00/);
  assert.match(result, /4\.00/);
});

test('low R-squared prompts review without attributing the cause only to pipetting', () => {
  const result = calculate({ 'prot-std-od': '0.1, 0.3, 1.5' });
  assert.match(result, /R² < 0\.95/);
  assert.match(result, /Review standards, assay range, pipetting, and assay conditions/i);
});

test('replicate multiplier scales all recipe components and final volume', () => {
  const result = calculate({ 'prot-replicates': '3' });
  assert.match(result, /Volumes multiplied by 3x/);
  assert.match(result, /30\.00/);
  assert.match(result, /18\.00/);
  assert.match(result, /12\.00/);
  assert.match(result, /60\.00/);
});

test('relative quantification subtracts blank and normalizes sample volumes', () => {
  const result = calculate({ 'prot-sample-od': '0.3, 0.5', 'prot-blank-od': '0.1' }, 'rel');
  assert.match(result, /Reference O\.D\. \(Most dilute sample\) = <strong>0\.2000<\/strong>/);
  assert.match(result, /1\.00x \(Ref\)/);
  assert.match(result, /2\.00x/);
  // Max sample volume is 16 µL; second sample needs half as much.
  assert.match(result, /16\.00/);
  assert.match(result, /8\.00/);
});

test('rejects mismatched standard concentration and absorbance lists', () => {
  const result = calculate({ 'prot-std-od': '0.1, 0.3' });
  assert.match(result, /same number of values/i);
});

test('rejects invalid sample OD tokens instead of silently ignoring them', () => {
  const result = calculate({ 'prot-sample-od': '0.3, nope' });
  assert.match(result, /Enter valid sample O\.D\. values/i);
});

test('rejects a target mass that is zero or negative in standard curve mode', () => {
  assert.match(calculate({ 'prot-target-mass': '0' }), /Target mass must be greater than zero/i);
  assert.match(calculate({ 'prot-target-mass': '-1' }), /Target mass must be greater than zero/i);
});

test('rejects a relative sample whose blank-corrected absorbance is not positive', () => {
  const result = calculate({ 'prot-sample-od': '0.1, 0.3', 'prot-blank-od': '0.1' }, 'rel');
  assert.match(result, /Net O\.D\. ≤ 0/i);
});


test('rejects blank O.D. values that are empty or non-numeric in relative mode', () => {
  assert.match(calculate({ 'prot-blank-od': '' }, 'rel'), /valid numeric Blank O\.D\. value/i);
  assert.match(calculate({ 'prot-blank-od': 'abc' }, 'rel'), /valid numeric Blank O\.D\. value/i);
});

test('allows zero and negative blank O.D. when blank-corrected sample values are positive', () => {
  const zeroBlank = calculate({ 'prot-blank-od': '0', 'prot-sample-od': '0.1, 0.3' }, 'rel');
  assert.match(zeroBlank, /Reference O\.D\. \(Most dilute sample\) = <strong>0\.1000<\/strong>/);

  const negativeBlank = calculate({ 'prot-blank-od': '-0.05', 'prot-sample-od': '-0.01, -0.03' }, 'rel');
  assert.match(negativeBlank, /Reference O\.D\. \(Most dilute sample\) = <strong>0\.0200<\/strong>/);
  assert.doesNotMatch(negativeBlank, /valid numeric Blank O\.D\. value/i);
});
