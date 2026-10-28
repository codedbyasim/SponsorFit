import assert from "node:assert/strict";
import test from "node:test";
import { demographicAlignment, fitScore, toUnitInterval } from "./score";

test("full fit score uses 60/25/15 and stays on a 0-100 scale", () => {
  const scored = fitScore({ affinity: 0.8, popularity: 0.5, demographic: 40 });
  assert.equal(scored.fit, 66.5);
  assert.deepEqual(
    scored.factors.map((factor) => factor.weight),
    [0.6, 0.25, 0.15],
  );
  assert.equal(scored.formula, "60% × Qloo affinity + 25% × Qloo popularity + 15% × Demographic alignment");
});

test("missing demographic alignment renormalizes affinity and popularity", () => {
  const scored = fitScore({ affinity: 0.8, popularity: 0.4, demographic: null });
  assert.equal(scored.factors.length, 2);
  assert.equal(scored.factors[0].weight, 0.706);
  assert.equal(scored.factors[1].weight, 0.294);
  assert.equal(scored.fit, 68.3);
});

test("affinity is required and is never invented", () => {
  const scored = fitScore({ affinity: null, popularity: 0.9, demographic: 80 });
  assert.equal(scored.fit, null);
  assert.equal(scored.factors.length, 0);
  assert.match(scored.formula, /withheld/);
});

test("percent-style affinities above 1 are scaled down once", () => {
  assert.equal(toUnitInterval(82), 0.82);
  const scored = fitScore({ affinity: 80, popularity: 50, demographic: null });
  assert.equal(scored.fit, 71.2);
});

test("demographic alignment is cosine similarity mapped to 0-100", () => {
  const same = demographicAlignment({ a: 0.4, b: 0.2 }, { a: 0.4, b: 0.2 });
  assert.equal(same, 100);
  const opposite = demographicAlignment({ a: 0.5, b: -0.2 }, { a: -0.5, b: 0.2 });
  assert.equal(opposite, 0);
  assert.equal(demographicAlignment({ a: 0.2 }, { a: 0.2 }), null);
});
