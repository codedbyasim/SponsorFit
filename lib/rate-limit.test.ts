import assert from "node:assert/strict";
import test from "node:test";
import { allowQlooCall, allowRequest, resetLimits } from "./rate-limit";

test("per-visitor scout limit trips on the ninth request in a window", () => {
  resetLimits();
  const now = 1_700_000_000_000;
  for (let i = 0; i < 8; i += 1) {
    assert.equal(allowRequest("203.0.113.9", now), true);
  }
  assert.equal(allowRequest("203.0.113.9", now), false);
  assert.equal(allowRequest("203.0.113.10", now), true);
});

test("global Qloo budget is separate from the visitor limit", () => {
  resetLimits();
  const now = 1_700_000_000_000;
  for (let i = 0; i < 30; i += 1) assert.equal(allowQlooCall(now), true);
  assert.equal(allowQlooCall(now), false);
});
