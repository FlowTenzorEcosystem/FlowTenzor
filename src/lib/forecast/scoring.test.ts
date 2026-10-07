import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRange, directionOf, scoreOf, toUnits, zFor } from "./scoring";

// The same vectors as contracts/test/ForecastOracle.t.sol, so the site and the oracle agree.
test("score vectors match the Solidity tests", () => {
  assert.deepEqual(scoreOf(toUnits(200), toUnits(201), 8000, toUnits(200), toUnits(199), 1), { score: 834, inRange: false });
  assert.deepEqual(scoreOf(toUnits(200), toUnits(201), 5000, toUnits(200), toUnits(199), 1), { score: 5834, inRange: false });
  assert.deepEqual(scoreOf(toUnits(200), toUnits(201), 5000, toUnits(200), toUnits(202), 1), { score: 5834, inRange: false });
  assert.deepEqual(scoreOf(toUnits(202), toUnits(204), 8000, toUnits(203), toUnits(203) + 1n, 0), { score: 5074, inRange: true });
  assert.deepEqual(scoreOf(toUnits(198), toUnits(204), 8000, toUnits(200), toUnits(203), 0), { score: 0, inRange: true });
});

test("a wider miss never scores higher", () => {
  let last = Infinity;
  for (let p = 202; p < 240; p += 0.5) {
    const { score } = scoreOf(toUnits(200), toUnits(202), 8000, toUnits(200), toUnits(p), 2);
    assert.ok(score <= last);
    last = score;
  }
});

test("direction and validation", () => {
  assert.equal(directionOf(toUnits(198), toUnits(204), toUnits(200)), 1);
  assert.equal(directionOf(toUnits(190), toUnits(205), toUnits(200)), -1);
  assert.equal(directionOf(toUnits(195), toUnits(205), toUnits(200)), 0);
  assert.equal(checkRange(toUnits(199), toUnits(201), 8000, toUnits(200)), null);
  assert.ok(checkRange(toUnits(201), toUnits(201), 8000, toUnits(200)));
  assert.ok(checkRange(toUnits(49), toUnits(201), 8000, toUnits(200)));
  assert.ok(checkRange(toUnits(199), toUnits(201), 9950, toUnits(200)));
});

test("normal quantile", () => {
  assert.ok(Math.abs(zFor(8000) - 1.2816) < 1e-3);
  assert.ok(Math.abs(zFor(9000) - 1.6449) < 1e-3);
  assert.ok(Math.abs(zFor(5000) - 0.6745) < 1e-3);
});
