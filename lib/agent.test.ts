import assert from "node:assert/strict";
import test from "node:test";
import { runScout } from "./agent";
import { findDemoProperty } from "./demo/fixtures";
import { pitchIsGrounded, type PitchContext } from "./pitch";
import type { ScoutResult } from "./types";

function contexts(result: ScoutResult): PitchContext[] {
  const destination = result.taste.find((item) => item.domain === "destination") ?? null;
  return result.pitches.map((pitch) => {
    const brand = result.brands.find((row) => row.id === pitch.brandId);
    if (!brand || brand.fit == null || brand.affinity == null) {
      throw new Error(`missing brand for ${pitch.brandName}`);
    }
    return {
      propertyName: result.property.name,
      brandId: brand.id,
      brandName: brand.name,
      rank: brand.rank,
      fit: brand.fit,
      formula: brand.formula,
      factors: brand.factors,
      affinity: brand.affinity,
      popularity: brand.popularity,
      demoAlignment: brand.demoAlignment,
      why: brand.why,
      audience: result.audience,
      taste: result.taste,
      destinationName: destination?.name ?? null,
      destinationAffinity: destination?.affinity ?? null,
      heatmapCity: result.activation?.city ?? null,
      heatmapSource: result.activation?.citySource ?? null,
      topCellAffinity: result.activation?.cells[0]?.affinity ?? null,
    };
  });
}

test("demo mode scouts Chelsea against the Dodgers without a Qloo key", async () => {
  const events: string[] = [];
  const result = await runScout(
    { query: "Chelsea FC", compareQuery: "LA Dodgers" },
    (event) => events.push(event.type),
    { forceDemo: true, allowLlm: false },
  );

  assert.equal(result.source, "demo");
  assert.equal(result.needsConfirmation, false);
  assert.equal(result.property.name, "Chelsea FC");
  assert.ok(result.brands.length >= 5);
  assert.ok((result.brands[0]?.fit ?? 0) >= (result.brands[1]?.fit ?? 0));
  assert.equal(result.pitches.length, 5);
  assert.ok(result.pitches.every((pitch) => pitch.writer === "template"));
  assert.ok(result.activation);
  assert.equal(result.activation?.city, "London");
  assert.ok(result.compare);
  assert.ok(result.compare?.sharedBrands.some((brand) => brand.name === "Nike"));
  assert.ok(result.trace.some((step) => step.id === "brands" && step.params?.["filter.type"] === "urn:entity:brand"));
  assert.deepEqual(
    contexts(result).map((ctx, index) => pitchIsGrounded(result.pitches[index], ctx)),
    [true, true, true, true, true],
  );
  assert.ok(events.includes("result"));
});

test("demo mode does not invent a property it does not have", async () => {
  await assert.rejects(
    () => runScout({ query: "Taylor Swift" }, () => undefined, { forceDemo: true, allowLlm: false }),
    /SmartLess/,
  );
});

test("personal contact data never becomes a Qloo query", async () => {
  await assert.rejects(
    () => runScout({ query: "scout@example.com" }, () => undefined, { forceDemo: true, allowLlm: false }),
    /Personal contact/,
  );
  assert.equal(findDemoProperty("chelsea fc")?.name, "Chelsea FC");
});
