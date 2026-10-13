const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "survival-calculator", "main.js"),
  "utf8"
);

function loadFunctions(startMarker, endMarker, exportStatement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, "start marker exists: " + startMarker);
  assert.notEqual(end, -1, "end marker exists: " + endMarker);
  const snippet = source.slice(start, end);
  const context = {};
  vm.runInNewContext(snippet + "\n" + exportStatement, context);
  return context;
}

const km = loadFunctions(
  "function calculateSingleKM",
  "function escapeHtml",
  "globalThis.calculateSingleKM = calculateSingleKM;"
);

const logRankStart = source.indexOf("function runLogRank");
const closingWrapper = source.match(/\r?\n\}\);\s*$/);\nconst logRankEnd = closingWrapper ? closingWrapper.index : -1;
assert.notEqual(logRankStart, -1, "log-rank function exists");
assert.ok(logRankEnd > logRankStart, "log-rank function block exists");
const logRankSnippet = source.slice(logRankStart, logRankEnd);
const logRankContext = {};
vm.runInNewContext(
  logRankSnippet + "\nglobalThis.runLogRank = runLogRank;",
  logRankContext
);

test("Kaplan–Meier handles an event and censoring at the same time", () => {
  const result = km.calculateSingleKM([
    { time: 1, status: 1 },
    { time: 1, status: 0 },
    { time: 2, status: 1 }
  ]);
  assert.equal(result.median, 2);
  assert.equal(result.points.length, 3);
  assert.ok(Math.abs(result.points[1].y - 2 / 3) < 1e-12);
  assert.equal(result.points[2].y, 0);
});

test("log-rank includes subjects censored at an event time in the risk set", () => {
  const group1 = [
    { time: 1, status: 1 },
    { time: 1, status: 0 },
    { time: 2, status: 0 }
  ];
  const group2 = [
    { time: 1, status: 1 },
    { time: 3, status: 0 },
    { time: 4, status: 0 }
  ];
  const result = logRankContext.runLogRank(group1, group2);
  assert.ok(Math.abs(result.chisq) < 1e-12, "equal event counts and risk sets should yield zero score");
  assert.ok(Math.abs(result.p - 1) < 1e-8, "zero chi-square should yield p approximately 1");
});

test("log-rank chi-square and p-value are invariant to group order", () => {
  const group1 = [
    { time: 1, status: 1 },
    { time: 2, status: 1 },
    { time: 3, status: 1 },
    { time: 4, status: 0 }
  ];
  const group2 = [
    { time: 2, status: 1 },
    { time: 3, status: 0 },
    { time: 4, status: 0 },
    { time: 5, status: 0 }
  ];
  const forward = logRankContext.runLogRank(group1, group2);
  const reverse = logRankContext.runLogRank(group2, group1);
  assert.ok(Math.abs(forward.chisq - reverse.chisq) < 1e-10);
  assert.ok(Math.abs(forward.p - reverse.p) < 1e-8);
  assert.ok(Number.isFinite(forward.hr) && Number.isFinite(reverse.hr));
  assert.ok(Math.abs(forward.hr * reverse.hr - 1) < 1e-8, "reversing groups should invert the approximate HR");
});
