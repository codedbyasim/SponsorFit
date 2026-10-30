import assert from "node:assert/strict";
import test from "node:test";
import { cellSizeLabel, focusCluster, formatCoord } from "./geo";
import type { HeatCell } from "./types";

const cell = (lat: number, lng: number): HeatCell => ({ lat, lng, affinity: 1, popularity: null });

test("focusCluster drops far-away strays for any city", () => {
  // Lahore cluster plus two cells in other cities hundreds of km away.
  const cells = [
    cell(31.52, 74.35),
    cell(31.5, 74.33),
    cell(31.55, 74.3),
    cell(31.48, 74.4),
    cell(33.68, 73.05),
    cell(24.86, 67.0),
  ];
  const kept = focusCluster(cells);
  assert.equal(kept.length, 4);
  assert.ok(kept.every((item) => item.lat > 31 && item.lat < 32));
});

test("focusCluster keeps everything when the set is small or tight", () => {
  const few = [cell(1, 1), cell(40, 40)];
  assert.equal(focusCluster(few).length, 2);
});

test("formatCoord uses the right hemisphere letters", () => {
  assert.equal(formatCoord(31.52, 74.35), "31.520°N, 74.350°E");
  assert.equal(formatCoord(40.71, -74.0), "40.710°N, 74.000°W");
  assert.equal(formatCoord(-33.86, 151.2), "33.860°S, 151.200°E");
});

test("cellSizeLabel reflects geohash precision", () => {
  assert.equal(cellSizeLabel("dr5re"), "~5 km area");
  assert.equal(cellSizeLabel("dr5re9"), "~1 km area");
});
