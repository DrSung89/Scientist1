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
const closingWrapper = source.match(/\r?\n\}\);\s*$/);
const logRankEnd = closingWrapper ? closingWrapper.index : -1;
assert.notEqual(logRankStart, -1, "log-rank function exists");
assert.ok(logRankEnd > logRankStart, "log-rank function block exists");
const logRankSnippet = source.slice(logRankStart, logRankEnd);
const logRankContext = {};
vm.runInNewContext(
  logRankSnippet + "\nglobalThis.runLogRank = runLogRank; globalThis.fitCoxHR = fitCoxHR;",
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

test("Kaplan–Meier does not report a median when survival never reaches 50%", () => {
  const result = km.calculateSingleKM([
    { time: 1, status: 1 },
    { time: 2, status: 0 },
    { time: 3, status: 0 },
    { time: 4, status: 0 }
  ]);
  assert.equal(result.median, "Not Reached");
  assert.ok(Math.abs(result.points.at(-1).y - 0.75) < 1e-12);
});

test("Kaplan–Meier all-censored data retains survival at 100% and has no median", () => {
  const result = km.calculateSingleKM([
    { time: 1, status: 0 },
    { time: 2, status: 0 },
    { time: 3, status: 0 }
  ]);
  assert.equal(result.median, "Not Reached");
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.points)),
    [{ x: 0, y: 1 }]
  );
  assert.equal(result.censoredPoints.length, 3);
  assert.ok(result.censoredPoints.every(point => point.y === 1));
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

test("log-rank matches independent reference values for test statistic, p-value, and approximate HR", () => {
  // Reference values calculated independently from the standard one-degree-of-freedom
  // log-rank equations and the score-based HR approximation. The HR interval is a
  // Wald-style approximation, not a Cox-model confidence interval.
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
  const result = logRankContext.runLogRank(group1, group2);
  assert.ok(Math.abs(result.chisq - 1.719836400818) < 1e-8);
  assert.ok(Math.abs(result.p - 0.189714105128) < 1e-6);
  assert.ok(Math.abs(result.hr - 0.250630279840) < 1e-9);
  assert.ok(Math.abs(result.hrLower - 0.031685084273) < 1e-9);
  assert.ok(Math.abs(result.hrUpper - 1.982495505843) < 1e-9);
});


test("log-rank does not report an approximate HR or CI when either group has zero events", () => {
  const noEventsGroup = [{ time: 5, status: 0 }];
  const eventGroup = [
    { time: 1, status: 1 },
    { time: 2, status: 1 },
    { time: 3, status: 1 },
    { time: 4, status: 0 }
  ];

  for (const [g1, g2] of [
    [noEventsGroup, eventGroup],
    [eventGroup, noEventsGroup]
  ]) {
    const result = logRankContext.runLogRank(g1, g2);
    assert.ok(Number.isFinite(result.chisq));
    assert.ok(Number.isFinite(result.p));
    assert.ok(Number.isNaN(result.hr));
    assert.ok(Number.isNaN(result.hrLower));
    assert.ok(Number.isNaN(result.hrUpper));
  }
});

test("log-rank with no observed events returns chi-square 0 and p-value 1", () => {
  const group1 = [
    { time: 1, status: 0 },
    { time: 2, status: 0 }
  ];
  const group2 = [
    { time: 1, status: 0 },
    { time: 3, status: 0 }
  ];
  const result = logRankContext.runLogRank(group1, group2);
  assert.equal(result.chisq, 0);
  assert.equal(result.p, 1);
  assert.ok(Number.isNaN(result.hr));
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


test("approximate HR matches independent reference values across survival-data scenarios", () => {
  // These fixtures pin the calculator's score-based approximation, not Cox-model estimates.
  // The companion comparison used an independent univariate Cox partial-likelihood solver
  // with Breslow handling of tied event times. Strong effects can materially separate the
  // two estimates, so the UI must continue to identify this result as approximate.
  const scenarios = [
    {
      name: "moderate effect",
      group1: [
        { time: 1, status: 1 }, { time: 2, status: 1 },
        { time: 3, status: 0 }, { time: 4, status: 1 },
        { time: 5, status: 0 }, { time: 6, status: 1 },
        { time: 7, status: 0 }, { time: 8, status: 0 }
      ],
      group2: [
        { time: 2, status: 1 }, { time: 3, status: 0 },
        { time: 4, status: 0 }, { time: 5, status: 1 },
        { time: 6, status: 0 }, { time: 7, status: 0 },
        { time: 8, status: 1 }, { time: 9, status: 0 }
      ],
      expectedHr: 0.582153525153
    },
    {
      name: "strong effect with few events",
      group1: [
        { time: 1, status: 1 }, { time: 2, status: 1 },
        { time: 3, status: 1 }, { time: 4, status: 1 },
        { time: 5, status: 1 }, { time: 6, status: 0 },
        { time: 7, status: 0 }, { time: 8, status: 0 }
      ],
      group2: [
        { time: 3, status: 0 }, { time: 4, status: 0 },
        { time: 5, status: 0 }, { time: 6, status: 1 },
        { time: 7, status: 0 }, { time: 8, status: 0 },
        { time: 9, status: 0 }, { time: 10, status: 0 }
      ],
      expectedHr: 0.191775869715
    },
    {
      name: "tied event times",
      group1: [
        { time: 1, status: 1 }, { time: 1, status: 1 },
        { time: 2, status: 1 }, { time: 3, status: 0 },
        { time: 4, status: 1 }, { time: 5, status: 0 },
        { time: 6, status: 0 }
      ],
      group2: [
        { time: 1, status: 0 }, { time: 2, status: 1 },
        { time: 2, status: 1 }, { time: 3, status: 1 },
        { time: 4, status: 0 }, { time: 5, status: 0 },
        { time: 6, status: 0 }
      ],
      expectedHr: 0.664432671779
    },
    {
      name: "heavy censoring",
      group1: [
        { time: 1, status: 1 }, { time: 2, status: 0 },
        { time: 3, status: 0 }, { time: 4, status: 0 },
        { time: 5, status: 1 }, { time: 6, status: 0 },
        { time: 7, status: 0 }, { time: 8, status: 0 },
        { time: 9, status: 1 }
      ],
      group2: [
        { time: 1, status: 0 }, { time: 2, status: 0 },
        { time: 3, status: 1 }, { time: 4, status: 0 },
        { time: 5, status: 0 }, { time: 6, status: 0 },
        { time: 7, status: 0 }, { time: 8, status: 1 },
        { time: 9, status: 0 }
      ],
      expectedHr: 0.670320046036
    }
  ];

  for (const scenario of scenarios) {
    const result = logRankContext.runLogRank(scenario.group1, scenario.group2);
    assert.ok(
      Math.abs(result.hr - scenario.expectedHr) < 1e-9,
      scenario.name + ": approximate HR should match the independent reference"
    );
    assert.ok(result.hrLower < result.hr, scenario.name + ": lower interval should be below HR");
    assert.ok(result.hr < result.hrUpper, scenario.name + ": upper interval should be above HR");
  }
});


test("Cox HR uses Efron ties and returns a finite Wald confidence interval", () => {
  const group1 = [
    { time: 1, status: 1 }, { time: 2, status: 1 },
    { time: 3, status: 0 }, { time: 4, status: 1 },
    { time: 5, status: 0 }, { time: 6, status: 1 },
    { time: 7, status: 0 }, { time: 8, status: 0 }
  ];
  const group2 = [
    { time: 2, status: 1 }, { time: 3, status: 0 },
    { time: 4, status: 0 }, { time: 5, status: 1 },
    { time: 6, status: 0 }, { time: 7, status: 0 },
    { time: 8, status: 1 }, { time: 9, status: 0 }
  ];
  const result = logRankContext.fitCoxHR(group1, group2);
  assert.equal(result.converged, true);
  assert.ok(Number.isFinite(result.hr) && result.hr > 0);
  assert.ok(Number.isFinite(result.se) && result.se > 0);
  assert.ok(result.hrLower > 0 && result.hrLower < result.hr);
  assert.ok(result.hrUpper > result.hr);
  // Fixed reference values from a separate Efron partial-likelihood score/information calculation.
  assert.ok(Math.abs(result.beta - (-0.527277415214)) < 1e-8);
  assert.ok(Math.abs(result.hr - 0.590209680103) < 1e-8);
  assert.ok(Math.abs(result.se - 0.767710369598) < 1e-8);
  assert.ok(Math.abs(result.hrLower - 0.131074457468) < 1e-8);
  assert.ok(Math.abs(result.hrUpper - 2.657630427893) < 1e-8);
  assert.ok(Math.abs(Math.log(result.hr) - result.beta) < 1e-12);
});

test("Cox HR handles tied events and is reciprocal when groups are reversed", () => {
  const group1 = [
    { time: 1, status: 1 }, { time: 1, status: 1 },
    { time: 2, status: 1 }, { time: 3, status: 0 },
    { time: 4, status: 1 }, { time: 5, status: 0 },
    { time: 6, status: 0 }
  ];
  const group2 = [
    { time: 1, status: 0 }, { time: 2, status: 1 },
    { time: 2, status: 1 }, { time: 3, status: 1 },
    { time: 4, status: 0 }, { time: 5, status: 0 },
    { time: 6, status: 0 }
  ];
  const forward = logRankContext.fitCoxHR(group1, group2);
  const reverse = logRankContext.fitCoxHR(group2, group1);
  assert.equal(forward.converged, true);
  assert.equal(reverse.converged, true);
  // Fixed reference for Efron's method with tied deaths.
  assert.ok(Math.abs(forward.hr - 0.693643961322) < 1e-8);
  assert.ok(Math.abs(forward.beta - (-0.365796474149)) < 1e-8);
  assert.ok(Math.abs(forward.hrLower - 0.155087125106) < 1e-8);
  assert.ok(Math.abs(forward.hrUpper - 3.102397731269) < 1e-8);
  assert.ok(Math.abs(forward.hr * reverse.hr - 1) < 1e-7);
  assert.ok(Math.abs(forward.beta + reverse.beta) < 1e-7);
});

test("Cox HR reports N/A for all-censored data, a zero-event group, and separated estimates", () => {
  const allCensored1 = [{ time: 1, status: 0 }, { time: 2, status: 0 }];
  const allCensored2 = [{ time: 1, status: 0 }, { time: 3, status: 0 }];
  assert.equal(logRankContext.fitCoxHR(allCensored1, allCensored2).converged, false);

  const eventGroup = [
    { time: 1, status: 1 }, { time: 2, status: 1 }, { time: 3, status: 0 }
  ];
  const noEventGroup = [{ time: 1, status: 0 }, { time: 2, status: 0 }];
  assert.equal(logRankContext.fitCoxHR(eventGroup, noEventGroup).converged, false);
  assert.equal(logRankContext.fitCoxHR(noEventGroup, eventGroup).converged, false);

  const earlyEvents = [
    { time: 1, status: 1 }, { time: 2, status: 1 }, { time: 3, status: 1 }
  ];
  const lateEvents = [
    { time: 4, status: 1 }, { time: 5, status: 1 }, { time: 6, status: 1 }
  ];
  assert.equal(logRankContext.fitCoxHR(earlyEvents, lateEvents).converged, false);
});
